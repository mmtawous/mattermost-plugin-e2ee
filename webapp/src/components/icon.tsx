import PropTypes from 'prop-types';
import React, {useEffect, useState} from 'react';
import {connect} from 'react-redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import {bindActionCreators} from 'redux';
import {KEYLOCK_OPEN, KEYLOCK_CLOSED} from 'svgs';

import type {GlobalState} from '@mattermost/types/store';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/common';
import type {ActionFunc, DispatchFunc} from 'mattermost-redux/types/actions';

import {getChannelEncryptionMethod} from 'actions';
import {getPluginState} from 'selectors';

function mapStateToProps(state: GlobalState) {
    const chanID = getCurrentChannelId(state);
    const chansEncrMethod = getPluginState(state).chansEncrMethod;
    return {chanID, chansEncrMethod};
}

type Actions = {
    getChannelEncryptionMethod: (chanID: string) => Promise<{ data: string }>;
};

function mapDispatchToProps(dispatch: DispatchFunc) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({getChannelEncryptionMethod}, dispatch),
    };
}

export type IconComponentProps = ReturnType<typeof mapStateToProps> &
ReturnType<typeof mapDispatchToProps>;

const IconComponent: React.FC<IconComponentProps> = (props) => {
    const [isEncrypted, setIsEncrypted] = useState(false);

    const {chanID, chansEncrMethod, actions} = props;
    useEffect(() => {
        actions.getChannelEncryptionMethod(chanID).then((meth) => {
            setIsEncrypted(meth.data !== 'none');
        });
    }, [chanID, actions, chansEncrMethod]);
    const style = getStyle();
    return (
        <span
            style={style.iconStyle}
            className='icon'
            aria-hidden='true'
            dangerouslySetInnerHTML={{__html: isEncrypted ? KEYLOCK_CLOSED : KEYLOCK_OPEN}}
        />
    );
};

function getStyle(): { [key: string]: React.CSSProperties } {
    return {
        iconStyle: {
        },
    };
}

IconComponent.propTypes = {
    chanID: PropTypes.string.isRequired,

    // @ts-ignore
    chansEncrMethod: PropTypes.object.isRequired,
    actions: {

        // @ts-ignore
        getChannelEncryptionMethod: PropTypes.func.isRequired,
    },
};

const Icon = connect(mapStateToProps, mapDispatchToProps)(IconComponent);
export default Icon;
