import {PostTypes} from 'mattermost-redux/action_types';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {PubKeyTypes, EncrStatutTypes, ImportModalTypes, PrivKeyTypes} from './action_types';
import {APIClient} from './client';
import type {PrivateKeyMaterial, PublicKeyMaterial} from './e2ee';
import manifest from './manifest';
import {getPluginState, selectPubkeys} from './selectors';
import { ActionFunc, ActionFuncAsync, ActionResult, DispatchFunc, GetStateFunc } from 'mattermost-redux/types/actions'

export function getPubKeys(userIds: string[]): ActionFuncAsync<Map<string, PublicKeyMaterial>> {
    return async (dispatch: DispatchFunc, getState: GetStateFunc): Promise<ActionResult> => {
        const ret = new Map<string, PublicKeyMaterial>();
        const setIds = new Set(userIds);

        const statePubKeys = selectPubkeys(getState());
        for (const userId of userIds) {
            const cached = statePubKeys.get(userId);
            if (typeof cached === 'undefined') {
                continue;
            }
            if (cached.data !== null) {
                ret.set(userId, cached.data);
            }
            setIds.delete(userId);
        }
        if (setIds.size > 0) {
            try {
                const apires = await APIClient.getPubKeysDebounced(Array.from(setIds));
                dispatch({
                    type: PubKeyTypes.RECEIVED_PUBKEYS,
                    data: apires,
                });
                for (const [userId, pubkey] of apires) {
                    if (pubkey !== null) {
                        ret.set(userId, pubkey);
                    }
                }
            } catch (error) {
                return {error};
            }
        }

        return {data: ret};
    };
}

export function getChannelEncryptionMethod(chanID: string): ActionFuncAsync<string> {
    return async (dispatch: DispatchFunc, getState: GetStateFunc): Promise<ActionResult> => {
        // @ts-expect-error TS2345
        const method = getPluginState(getState()).chansEncrMethod.get(chanID) || null;
        if (method != null) {
            return {data: method};
        }

        try {
            const apimethod = await APIClient.getChannelEncryptionMethod(chanID);
            dispatch({
                type: EncrStatutTypes.RECEIVED_ENCRYPTION_STATUS,
                data: {chanID, method: apimethod},
            });
            return {data: apimethod};
        } catch (error) {
            return {error};
        }
    };
}

// From mattermost-plugin-anonymous
export function sendEphemeralPost(message: string, channelId: string): ActionFunc {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const timestamp = Date.now();
        const post = {
            id: manifest.id + Date.now(),
            user_id: getState().entities.users.currentUserId,
            channel_id: channelId,
            message,
            type: 'system_ephemeral',
            create_at: timestamp,
            update_at: timestamp,
            root_id: '',
            parent_id: '',
            props: {},
        };

        dispatch({
            type: PostTypes.RECEIVED_NEW_POST,
            data: post,
            channelId,
        });

        return {data: true};
    };
}

export function openImportModal(): ActionFunc {
    return (dispatch: DispatchFunc) => {
        dispatch({
            type: ImportModalTypes.IMPORT_MODAL_OPEN,
            data: {},
        });
        return {data: null};
    };
}

export function closeImportModal(): ActionFunc {
    return (dispatch: DispatchFunc,) => {
        dispatch({
            type: ImportModalTypes.IMPORT_MODAL_CLOSE,
            data: {},
        });
        return {data: null};
    };
}

export function setPrivKey(privkey: PrivateKeyMaterial): ActionFuncAsync {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const data = {
            privkey,
            pubkey: await privkey.pubKey(),
            userID: getCurrentUserId(getState()),
        };
        dispatch({
            type: PrivKeyTypes.GOT_PRIVKEY,
            data,
        });
        return {data};
    };
}
