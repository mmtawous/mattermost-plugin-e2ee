import * as openpgp from 'openpgp';

import {PrivateKeyMaterial} from './e2ee';

import {base64ToArrayBuffer, arrayBufferToBase64} from './utils';

const ArmorHeader = '-----BEGIN MM E2EE PRIVATE KEY-----';
const ArmorFooter = '-----END MM E2EE PRIVATE KEY-----';

function armor(data: ArrayBuffer): string {
    let str = ArmorHeader + '\n';
    const b64data = arrayBufferToBase64(data);
    const cols = 60;
    const lenrnd = Math.floor(b64data.length / cols) * cols;
    for (let i = 0; i < lenrnd; i += cols) {
        str += b64data.substring(i, i + cols) + '\n';
    }
    if (lenrnd !== b64data.length) {
        str += b64data.substring(lenrnd, b64data.length) + '\n';
    }
    str += ArmorFooter;
    return str;
}

function unarmor(text: string): ArrayBuffer | null {
    const idxHeader = text.indexOf(ArmorHeader);
    if (idxHeader === -1) {
        return null;
    }
    const idxFooter = text.indexOf(ArmorFooter);
    if (idxFooter === -1) {
        return null;
    }
    const b64data = text.substring(idxHeader + ArmorHeader.length, idxFooter).replace(/\s/g, '');
    return base64ToArrayBuffer(b64data);
}

export async function gpgBackupFormat(privKey: PrivateKeyMaterial): Promise<string> {
    const data = JSON.stringify(await privKey.jsonable(true /* tob64 */));
    return armor(new TextEncoder().encode(data).buffer);
}

export async function gpgParseBackup(backup: string, exportable: boolean): Promise<PrivateKeyMaterial> {
    const json = unarmor(backup);
    if (json === null) {
        throw new Error('invalid armor format');
    }
    const data = JSON.parse(new TextDecoder().decode(json));
    return PrivateKeyMaterial.fromJsonable(data, true /* fromb64 */, exportable);
}

export async function gpgEncrypt(data: string, gpgPubKeyArmored: string): Promise<string> {
    const keys = (await openpgp.readKeys({"armoredKeys": gpgPubKeyArmored}));
    const message = await openpgp.createMessage({ text: data });
    const encrypted = await openpgp.encrypt({message, encryptionKeys: keys});
    return encrypted;
}
