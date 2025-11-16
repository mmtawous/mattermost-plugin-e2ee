import {connect} from 'react-redux';
import type {ActionCreatorsMapObject} from 'redux';
import {bindActionCreators} from 'redux';

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult, ActionFunc, DispatchFunc} from 'mattermost-redux/types/actions';

import {getPubKeys} from 'actions';
import {getPluginState} from 'selectors';

import type {PluginState} from 'types';

import {E2EEPost} from './e2ee_post';

function mapStateToProps(state: GlobalState) {
    // @ts-ignore
    const pstate: PluginState = getPluginState(state);
    const currentUserID: string = getCurrentUserId(state);
    return {privkey: pstate.privkey, currentUserID};
}

type Actions = {
    getPubKeys: (pubkeys: string[]) => Promise<ActionResult>;
};

function mapDispatchToProps(dispatch: DispatchFunc) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({getPubKeys}, dispatch),
    };
}

export type E2EEPostProps = ReturnType<typeof mapStateToProps> &
ReturnType<typeof mapDispatchToProps> & {
    post: Post;
};

export default connect(mapStateToProps, mapDispatchToProps)(E2EEPost);
