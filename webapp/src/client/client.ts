import type {PublicKeyMaterialJSON} from 'e2ee';
import {PublicKeyMaterial} from 'e2ee';
import id from 'manifest';
import {debouncedMerge, debouncedMergeMapArrayReducer} from 'utils';

import {Client4, ClientError} from '@mattermost/client';

export class GPGBackupDisabledError extends Error { }

export class ClientClass {
    client: Client4;
    url!: string;
    getPubKeysDebounced: (userIds: string[]) => Promise<Map<string, PublicKeyMaterial>>;

    constructor() {
        this.client = new Client4();
        this.getPubKeysDebounced = debouncedMerge(this.getPubKeys.bind(this), debouncedMergeMapArrayReducer, 1);
    }

    setServerRoute(url: string) {
        this.url = url + `/plugins/${id}/api/v1`;
    }

    async pushPubKey(pubkey: PublicKeyMaterial, backupGPG: string | null) {
        return this.doPost(this.url + '/pubkey/push',
            {pubkey: await pubkey.jsonable(), backupGPG});
    }

    async getPubKeys(userIds: string[]): Promise<Map<string, PublicKeyMaterial>> {
        const resp = await this.doPost(this.url + '/pubkey/get', {userIds});
        const data = await resp.json();
        const ret = new Map();
        await Promise.all(Object.entries(data.pubKeys).map(async ([userId, pubKeyData]) => {
            let pubkey: PublicKeyMaterial | null = null;
            if (pubKeyData !== null) {
                pubkey = await PublicKeyMaterial.fromJsonable(pubKeyData as PublicKeyMaterialJSON);
            }
            ret.set(userId, pubkey);
        }));
        return ret;
    }

    async getChannelEncryptionMethod(chanID: string): Promise<string> {
        const resp = await this.doGet(this.url + '/channel/encryption_method?chanID=' + chanID).then((r) => r.json());
        return resp.method;
    }

    async setChannelEncryptionMethod(chanID: string, method: string): Promise<void> {
        await this.doPost(this.url + '/channel/encryption_method?chanID=' + chanID + '&method=' + method, {});
    }

    async getGPGPubKey(): Promise<string> {
        return (await this.doGet(this.url + '/gpg/get_pub_key').then((r) => r.json())).key;
    }

    async getGPGKeyServer(): Promise<string> {
        try {
            return (await this.doGet(this.url + '/gpg/key_server').then((r) => r.json())).url;
        } catch (e) {
            if (e.status_code === 404) {
                throw new GPGBackupDisabledError();
            }
            throw e;
        }
    }

    private async doGet(url: string, headers = {}) {
        const options = {
            method: 'get',
            headers,
        };

        const response = await fetch(url, this.client.getOptions(options));

        if (response.ok) {
            return response;
        }

        const text = await response.text();

        throw new ClientError(this.client.url, {
            message: text || '',
            status_code: response.status,
            url,
        });
    }

    private async doPost(url: string, body: object, headers = {}) {
        const options = {
            method: 'post',
            body: JSON.stringify(body),
            headers,
        };

        const response = await fetch(url, this.client.getOptions(options));

        if (response.ok) {
            return response;
        }

        const text = await response.text();

        throw new ClientError(this.client.url, {
            message: text || '',
            status_code: response.status,
            url,
        });
    }
}
