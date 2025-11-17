import type { Store, Action } from 'redux'

import { getConfig } from 'mattermost-redux/selectors/entities/general'

import { APIClient } from './client'
import E2EEImportModal from './components/e2ee_import_modal'
import E2EEPost from './components/e2ee_post'
import { E2EE_POST_TYPE } from './constants'
import E2EEHooks from './hooks'
import manifest from './manifest'
import Reducer from './reducers'
import { getServerRoute } from './selectors'
// eslint-disable-next-line import/no-unresolved
import type { PluginRegistry } from './types/mattermost-webapp'
import { GlobalState } from '@mattermost/types/store'

export default class Plugin {
    hooks?: E2EEHooks

    public async initialize(registry: PluginRegistry, store: Store<GlobalState, Action<Record<string, unknown>>>) {
        const mmconfig = getConfig(store.getState())

        // TODO: require mattermost version >= 8.1


        this.hooks = new E2EEHooks(store)
        this.hooks.register(registry)

        registry.registerRootComponent(E2EEImportModal)
        registry.registerReducer(Reducer)
        registry.registerPostTypeComponent(E2EE_POST_TYPE, E2EEPost)

        APIClient.setServerRoute(getServerRoute(store.getState()))
    }
}

declare global {
    interface Window {
        registerPlugin(id: string, plugin: Plugin): void
    }
}

window.registerPlugin(manifest.id, new Plugin())
