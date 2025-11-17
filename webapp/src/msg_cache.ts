import { Post } from "@mattermost/types/posts"
import {EncryptedP2PMessage} from './e2ee';

const MAX_MSGS = 5000;

class MsgCacheImpl {
    cacheDecrypted: Map<string, [string, ArrayBuffer]>;

    constructor() {
        this.cacheDecrypted = new Map();
    }

    addMine(post: Post, orgMsg: string) {
        if (!post.props || !post.props.e2ee || !(post.props.e2ee instanceof EncryptedP2PMessage)) {
            return;
        }
        
        // Adding an encrypted message that we sent ourselves. In this case,
        // the post does not have an ID yet, only a pending_post_id.
        if (typeof post.pending_post_id === 'undefined' 
            || post.pending_post_id === '') {
            return;
        }
        this.cacheDecrypted.set(post.pending_post_id, [orgMsg, post.props.e2ee.signature]);
        MsgCacheImpl.checkSize(this.cacheDecrypted);
    }

    addDecrypted(post: Post, msg: string) {
        // If we are adding a decrypted message, the post must have an ID.
        if (typeof post.id === 'undefined' 
            || !post.props || !post.props.e2ee 
            || !(post.props.e2ee instanceof EncryptedP2PMessage)) {
            return;
        }

        this.cacheDecrypted.set(post.id, [msg, post.props.e2ee.signature]);
        MsgCacheImpl.checkSize(this.cacheDecrypted);
    }

    addUpdated(post: Post, msg: string) {
        // On updated messages, pending_post_id is still there, but the post
        // already has an actual post ID. So force the usage of the ID in this
        // case.
        if (typeof post.id === 'undefined' 
            || !post.props || !post.props.e2ee 
            || !(post.props.e2ee instanceof EncryptedP2PMessage)) {
            return;
        }
        this.cacheDecrypted.set(post.id, [msg, post.props.e2ee.signature]);
        MsgCacheImpl.checkSize(this.cacheDecrypted);
    }

    get(post: Post): string | null {
        if (!post.props || !post.props.e2ee || !(post.props.e2ee instanceof EncryptedP2PMessage)) {
            return null;
        }
        if (typeof post.id === 'undefined') {
            return null;
        }
        const id = MsgCacheImpl.postID(post);
        const data = this.cacheDecrypted.get(id) || null;
        if (data === null) {
            return null;
        }
        const [msg, signature] = data;
        return (post.props.e2ee.signature === signature) ? msg : null;
    }

    clear() {
        this.cacheDecrypted.clear();
    }

    private static checkSize(obj: Map<string, [string, ArrayBuffer]>) {
        if (obj.size < MAX_MSGS) {
            return;
        }

        // This works because the order of insertion in the Map object is saved
        // (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map).
        const first = obj.keys().next().value;

        // We checked the size above, should not be undefined.
        // @ts-ignore
        obj.delete(first);
    }

    private static postID(post: Post): string {
        if (post.pending_post_id && post.pending_post_id !== '') {
            return post.pending_post_id;
        }
        return post.id;
    }
}

const msgCache = new MsgCacheImpl();
export {msgCache, MsgCacheImpl};
