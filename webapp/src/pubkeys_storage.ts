import type {PublicKeyMaterial} from './e2ee';
import {arrayBufferEqual} from './utils';
import { arrayBufferToBase64, base64ToArrayBuffer } from './utils';

// Returns true if the key has changed, and false if we didn't know the key, or
// if it is the same we already had.
export async function pubkeyStore(userID: string, pubkey: PublicKeyMaterial): Promise<boolean> {
    const pubkeyID = await pubkey.id();
    return new Promise((resolve, reject) => {
        const key = 'pubkeyID:' + userID;
        const knownPubkey = localStorage.getItem(key);
        try {
            if (knownPubkey === null) {
                localStorage.setItem(key, arrayBufferToBase64(pubkeyID));
                resolve(false);
                return;
            }
            if (arrayBufferEqual(base64ToArrayBuffer(knownPubkey), pubkeyID)) {
                resolve(false);
                return;
            }
            localStorage.setItem(key, arrayBufferToBase64(pubkeyID));
            resolve(true);
        } catch (e) {
            reject(e);
        }
    });
}

export async function getNewChannelPubkeys(chanID: string, pubkeys: Map<string, PublicKeyMaterial>): Promise<Array<[string, PublicKeyMaterial]>> {
    const ret: Array<[string, PublicKeyMaterial]> = [];
    const key = 'e2eeChannelRecipients:' + chanID;
    const chanRecipients = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
    for (const [userID, pubkey] of pubkeys) {
        // eslint-disable-next-line no-await-in-loop
        if (!chanRecipients.has(arrayBufferToBase64(await pubkey.id()))) {
            ret.push([userID, pubkey]);
        }
    }
    return ret;
}

export async function storeChannelPubkeys(chanID: string, pubkeys: PublicKeyMaterial[]) {
    const key = 'e2eeChannelRecipients:' + chanID;
    const val = await Promise.all(pubkeys.map((pk) => pk.id().then((v) => arrayBufferToBase64(v))));
    localStorage.setItem(key, JSON.stringify(val));
}
