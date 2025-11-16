import type {PrivateKeyMaterial} from 'e2ee';
import {AppPrivKey} from 'privkey';
import {connect} from 'react-redux';
import type {ActionCreatorsMapObject} from 'redux';
import {bindActionCreators} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import type {ActionFunc, ActionResult, DispatchFunc} from 'mattermost-redux/types/actions';

import {closeImportModal, openImportModal} from 'actions';
import {selectImportModalVisible} from 'selectors';

import {E2EEImportModal} from './e2ee_import_modal';

function mapStateToProps(state: GlobalState) {
    return {
        visible: selectImportModalVisible(state),
    };
}

type Actions = {
    open: () => Promise<ActionResult>;
    close: () => Promise<ActionResult>;
    appPrivKeyImport: (privkey: PrivateKeyMaterial) => Promise<ActionResult>;
};

function mapDispatchToProps(dispatch: DispatchFunc) {
    return {actions:
        bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            close: closeImportModal,
            open: openImportModal,
            appPrivKeyImport: AppPrivKey.import,
        }, dispatch),
    };
}

export type E2EEImportModalProps =
    ReturnType<typeof mapStateToProps> &
    ReturnType<typeof mapDispatchToProps>;

export default connect(mapStateToProps, mapDispatchToProps)(E2EEImportModal);
