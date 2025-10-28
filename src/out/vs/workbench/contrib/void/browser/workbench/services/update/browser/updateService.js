/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../base/common/event.js';
import { IUpdateService, State } from '../../../../platform/update/common/update.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
export class BrowserUpdateService extends Disposable {
    environmentService;
    hostService;
    _onStateChange = this._register(new Emitter());
    onStateChange = this._onStateChange.event;
    _state = State.Uninitialized;
    get state() { return this._state; }
    set state(state) {
        this._state = state;
        this._onStateChange.fire(state);
    }
    constructor(environmentService, hostService) {
        super();
        this.environmentService = environmentService;
        this.hostService = hostService;
        this.checkForUpdates(false);
    }
    async isLatestVersion() {
        const update = await this.doCheckForUpdates(false);
        if (update === undefined) {
            return undefined; // no update provider
        }
        return !!update;
    }
    async checkForUpdates(explicit) {
        await this.doCheckForUpdates(explicit);
    }
    async doCheckForUpdates(explicit) {
        if (this.environmentService.options && this.environmentService.options.updateProvider) {
            const updateProvider = this.environmentService.options.updateProvider;
            // State -> Checking for Updates
            this.state = State.CheckingForUpdates(explicit);
            const update = await updateProvider.checkForUpdate();
            if (update) {
                // State -> Downloaded
                this.state = State.Ready({ version: update.version, productVersion: update.version });
            }
            else {
                // State -> Idle
                this.state = State.Idle(1 /* UpdateType.Archive */);
            }
            return update;
        }
        return undefined; // no update provider to ask
    }
    async downloadUpdate() {
        // no-op
    }
    async applyUpdate() {
        this.hostService.reload();
    }
    async quitAndInstall() {
        this.hostService.reload();
    }
    async _applySpecificUpdate(packagePath) {
        // noop
    }
}
registerSingleton(IUpdateService, BrowserUpdateService, 0 /* InstantiationType.Eager */);
