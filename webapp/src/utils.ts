import { GlobalState } from '@mattermost/types/store'
import type {Store} from 'redux';

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    var binaryString = atob(base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function concatArrayBuffers(...buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const out = new Uint8Array(totalLength);

  let offset = 0;
  for (const buf of buffers) {
    out.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  return out.buffer;
}

export function eqSet<T>(A: Set<T>, B: Set<T>) {
    if (A.size !== B.size) {
        return false;
    }
    for (const a of A) {
        if (!B.has(a)) {
            return false;
        }
    }
    return true;
}

export function arrayBufferEqual(A: ArrayBuffer, B: ArrayBuffer) {
    const VA = new DataView(A);
    const VB = new DataView(B);
    if (VA.byteLength !== VB.byteLength) {
        return false;
    }
    for (let i = 0; i < VA.byteLength; i++) {
        if (VA.getUint8(i) !== VB.getUint8(i)) {
            return false;
        }
    }
    return true;
}

export function observeStore<T>(store: Store, select: (s: GlobalState) => T, onChange: (store: Store, v: T) => Promise<void>) {
    let currentState: T;

    async function handleChange() {
        const nextState = select(store.getState());
        if (nextState !== currentState) {
            currentState = nextState;
            await onChange(store, currentState);
        }
    }

    const unsubscribe = store.subscribe(handleChange);
    handleChange();
    return unsubscribe;
}

export function debouncedMerge<T, R>(func: (a: T[]) => Promise<R>, reducer: (res: R, org: T[]) => R, wait: number): (a: T[]) => Promise<R> {
    const merged = new Set<T>();
    let timeout: any = null;
    let cbs_success: any = [];
    let cbs_reject: any = [];
    return async (arg: T[]): Promise<R> => {
        for (const v of arg) {
            merged.add(v);
        }
        return new Promise((resolve, reject) => {
            const doCall = () => {
                timeout = null;

                // We copy & clean the shared state **before** calling the
                // asynchronous function, as we could yield back into the
                // debounced function, which would modify the state during the
                // call, hence ending up in a race condition!
                // We then clear this shared state so that we can properly
                // register the next round.
                const local_cbs_success = [...cbs_success];
                const local_cbs_reject = [...cbs_reject];
                const local_merged = [...merged];
                merged.clear();
                cbs_success = [];
                cbs_reject = [];
                func(local_merged).then((res) => {
                    for (const cb of local_cbs_success) {
                        cb(res);
                    }
                }).catch((e) => {
                    for (const cb of local_cbs_reject) {
                        cb(e);
                    }
                });
            };
            cbs_success.push((res: R) => {
                try {
                    resolve(reducer(res, arg));
                } catch (e) {
                    reject(e);
                }
            });
            cbs_reject.push((e: any) => {
                reject(e);
            });
            if (timeout === null) {
                timeout = setTimeout(doCall, wait);
            }
        });
    };
}

export function debouncedMergeMapArrayReducer<K, V>(funcres: Map<K, V>, keys: K[]) {
    const ret = new Map();
    for (const v of keys) {
        ret.set(v, funcres.get(v));
    }
    return ret;
}

// Based on mattermost-webapp/utils/utils.jsx
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 22;
const RESERVED_USERNAMES = [
    'valet',
    'all',
    'channel',
    'here',
    'matterbot',
    'system',
    'e2ee',
];

export function isValidUsername(name: string): boolean {
    if (!name) {
        return false;
    } else if (name.length < MIN_USERNAME_LENGTH || name.length > MAX_USERNAME_LENGTH) {
        return false;
    } else if (!(/^[a-z0-9.\-_]+$/).test(name)) {
        return false;
    } else if (!(/[a-z]/).test(name.charAt(0))) { //eslint-disable-line no-negated-condition
        return false;
    }
    for (const reserved of RESERVED_USERNAMES) {
        if (name === reserved) {
            return false;
        }
    }

    return true;
}
