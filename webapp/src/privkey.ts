import type {Store} from 'redux';

import {Client4} from 'mattermost-redux/client';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFuncAsync, DispatchFunc, GetStateFunc, ActionResult} from 'mattermost-redux/types/actions';

import {KSTypes} from './action_types';
import {getPubKeys, setPrivKey} from './actions';
import {gpgBackupFormat, gpgEncrypt, gpgParseBackup} from './backup_gpg';
import {APIClient} from './client';
import {PrivateKeyMaterial, PublicKeyMaterial, pubkeyEqual} from './e2ee';
import HKP from './hkp';
import {KeyStore, KeyStoreError} from './keystore';
import {selectPrivkey, selectKS} from './selectors';
import {observeStore} from './utils';
import { GlobalState } from '@mattermost/types/store'

type StoreTy = Store;

export class AppPrivKeyIsDifferent extends Error { }

interface GeneratedKey {
    privkey: PrivateKeyMaterial;
    backupClear: string;
    backupGPG: string | null;
}

export class AppPrivKey {
    static init(store: StoreTy): ActionFuncAsync {
        return async (): Promise<ActionResult> => {
            const user = getCurrentUserId(store.getState());
            let ks: KeyStore;
            try {
                ks = await KeyStore.open(user);
            } catch (error) {
                return {error};
            }
            store.dispatch({
                type: KSTypes.GOT_KS,
                data: ks,
            });
            observeStore(store, selectPrivkey, AppPrivKey.privkeyChanged);

            // @ts-ignore
            const {error} = await store.dispatch(AppPrivKey.load(ks));
            if (error) {
                return {error};
            }
            return {data: ks};
        };
    }

    private static async privkeyChanged(store: Store, privkey: PrivateKeyMaterial | null) {
        if (privkey !== null) {
            const state = store.getState();
            const ks = selectKS(state);
            await privkey.save(ks!, getCurrentUserId(state), true);
        }
    }

    static getUserPubkey(): ActionFuncAsync<PublicKeyMaterial | null> {
        return async (dispatch: DispatchFunc, getState: GetStateFunc): Promise<ActionResult> => {
            const userId = getCurrentUserId(getState());
            const {data: pubkeys, error} = await dispatch(getPubKeys([userId]));
            if (error) {
                return {error};
            }

            if (!pubkeys || !pubkeys.has(userId)) {
                return {data: null};
            }

            return {data: pubkeys.get(userId)};
        };
    }

    static userHasPubkey(): ActionFuncAsync {
        return async (dispatch: DispatchFunc) => {
            const {data, error} = await dispatch(AppPrivKey.getUserPubkey());
            if (error) {
                return {data: false};
            }
            return {data: (data !== null)};
        };
    }

    static import(backupGPG: string, force: boolean): ActionFuncAsync {
        return async (dispatch: DispatchFunc) => {
            try {
                const key = await gpgParseBackup(backupGPG, false /* exportable */);
                if (!force) {
                    if (!await AppPrivKey.checkPrivKey(dispatch, key)) {
                        return {error: new AppPrivKeyIsDifferent()};
                    }
                }
                await dispatch(AppPrivKey.setPrivKey(key, true /* store */, null));
                return {data: key};
            } catch (error) {
                return {error};
            }
        };
    }

    static load(ks: KeyStore): ActionFuncAsync {
        return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
            let key: PrivateKeyMaterial;
            try {
                key = await PrivateKeyMaterial.load(ks!, getCurrentUserId(getState()));
            } catch (e) {
                if (e instanceof KeyStoreError) {
                    return {data: null};
                }
                return {error: e};
            }
            if (!await AppPrivKey.checkPrivKey(dispatch, key)) {
                return {error: new AppPrivKeyIsDifferent()};
            }
            await dispatch(AppPrivKey.setPrivKey(key, false /* store */, null));
            return {data: key};
        };
    }

    static async checkPrivKey(dispatch: DispatchFunc, key: PrivateKeyMaterial): Promise<boolean> {
        // @ts-ignore
        const {data, error} = await dispatch(AppPrivKey.getUserPubkey());
        if (error) {
            throw error;
        }
        if (data !== null && data !== undefined && ! await pubkeyEqual(key.pubKey(), data)) {
            return false;
        }
        return true;
    }

    static generate(): ActionFuncAsync {
        return async (dispatch: DispatchFunc) => {
            const privkeyProm = PrivateKeyMaterial.create(true /* exportable */);
            const gpgArmoredPubKeyProm = dispatch(this.getGPGPubKey());
            let privkey: PrivateKeyMaterial = await privkeyProm;
            const backupClear = await gpgBackupFormat(privkey);
            let backupGPG;
            try {
                const {data: gpgArmoredPubKey, error} = await gpgArmoredPubKeyProm;
                if (error) {
                    throw error;
                }
                if (typeof gpgArmoredPubKey === 'undefined' || gpgArmoredPubKey === null) {
                    // Should not happen
                    throw new Error('no GPG public key returned');
                }
                backupGPG = {data: await gpgEncrypt(backupClear, gpgArmoredPubKey)};
            } catch (e) {
                backupGPG = {error: e};
            }

            // Reimport the key as non extractible
            privkey = await gpgParseBackup(backupClear, false /* extractible */);

            // @ts-ignore
            const {error} = await dispatch(AppPrivKey.setPrivKey(privkey, true /* store */, backupGPG.data || null));
            if (error) {
                return {error};
            }
            return {data: {privkey, backupGPG, backupClear}};
        };
    }

    private static getGPGPubKey() : ActionFuncAsync<string> {
        return async (_dispatch: DispatchFunc, getState: GetStateFunc) => {
            try {
                const userId = getCurrentUserId(getState());
                const email = (await Client4.getUser(userId)).email;

                const gpgKeyServer = await APIClient.getGPGKeyServer();
                const hkp = new HKP(gpgKeyServer);
                const keys = await hkp.index(email);

                // Get first valid key id
                const key = keys.find((k) => !k.IsRevoked && !k.IsDisabled && !k.IsExpired);
                if (typeof key === 'undefined') {
                    return {error: 'no valid key found'};
                }

                const msg = 'We are going to encrypt your private key with a public GPG key gathered from "' + gpgKeyServer + '", whose ID is 0x' + key.KeyID + '.\nDo you confirm this public key belongs to you?';
                /* eslint-disable no-alert */
                if (!confirm(msg)) {
                    return {error: 'untrusted public GPG key'};
                }

                // Get key
                const keyArmored = await hkp.get('0x' + key.KeyID);
                return {data: keyArmored};
            } catch (e) {
                return {error: e};
            }
        };
    }

    private static setPrivKey(key: PrivateKeyMaterial, store: boolean, backupGPG: string | null) {
        return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
            await dispatch(setPrivKey(key));
            if (store) {
                try {
                    await APIClient.pushPubKey(await key.pubKey(), backupGPG);
                } catch (e) {
                    return {error: e};
                }
            }
            return {data: true};
        };
    }

    static exists(state: GlobalState): boolean {
        return selectPrivkey(state) !== null;
    }
}
