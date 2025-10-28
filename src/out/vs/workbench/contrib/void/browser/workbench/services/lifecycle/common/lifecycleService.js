/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../base/common/event.js';
import { Barrier } from '../../../../base/common/async.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { LifecyclePhaseToString } from './lifecycle.js';
import { mark } from '../../../../base/common/performance.js';
import { WillSaveStateReason } from '../../../../platform/storage/common/storage.js';
export class AbstractLifecycleService extends Disposable {
    logService;
    storageService;
    static LAST_SHUTDOWN_REASON_KEY = 'lifecyle.lastShutdownReason';
    _onBeforeShutdown = this._register(new Emitter());
    onBeforeShutdown = this._onBeforeShutdown.event;
    _onWillShutdown = this._register(new Emitter());
    onWillShutdown = this._onWillShutdown.event;
    _onDidShutdown = this._register(new Emitter());
    onDidShutdown = this._onDidShutdown.event;
    _onBeforeShutdownError = this._register(new Emitter());
    onBeforeShutdownError = this._onBeforeShutdownError.event;
    _onShutdownVeto = this._register(new Emitter());
    onShutdownVeto = this._onShutdownVeto.event;
    _startupKind;
    get startupKind() { return this._startupKind; }
    _phase = 1 /* LifecyclePhase.Starting */;
    get phase() { return this._phase; }
    _willShutdown = false;
    get willShutdown() { return this._willShutdown; }
    phaseWhen = new Map();
    shutdownReason;
    constructor(logService, storageService) {
        super();
        this.logService = logService;
        this.storageService = storageService;
        // Resolve startup kind
        this._startupKind = this.resolveStartupKind();
        // Save shutdown reason to retrieve on next startup
        this._register(this.storageService.onWillSaveState(e => {
            if (e.reason === WillSaveStateReason.SHUTDOWN) {
                this.storageService.store(AbstractLifecycleService.LAST_SHUTDOWN_REASON_KEY, this.shutdownReason, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
            }
        }));
    }
    resolveStartupKind() {
        const startupKind = this.doResolveStartupKind() ?? 1 /* StartupKind.NewWindow */;
        this.logService.trace(`[lifecycle] starting up (startup kind: ${startupKind})`);
        return startupKind;
    }
    doResolveStartupKind() {
        // Retrieve and reset last shutdown reason
        const lastShutdownReason = this.storageService.getNumber(AbstractLifecycleService.LAST_SHUTDOWN_REASON_KEY, 1 /* StorageScope.WORKSPACE */);
        this.storageService.remove(AbstractLifecycleService.LAST_SHUTDOWN_REASON_KEY, 1 /* StorageScope.WORKSPACE */);
        // Convert into startup kind
        let startupKind = undefined;
        switch (lastShutdownReason) {
            case 3 /* ShutdownReason.RELOAD */:
                startupKind = 3 /* StartupKind.ReloadedWindow */;
                break;
            case 4 /* ShutdownReason.LOAD */:
                startupKind = 4 /* StartupKind.ReopenedWindow */;
                break;
        }
        return startupKind;
    }
    set phase(value) {
        if (value < this.phase) {
            throw new Error('Lifecycle cannot go backwards');
        }
        if (this._phase === value) {
            return;
        }
        this.logService.trace(`lifecycle: phase changed (value: ${value})`);
        this._phase = value;
        mark(`code/LifecyclePhase/${LifecyclePhaseToString(value)}`);
        const barrier = this.phaseWhen.get(this._phase);
        if (barrier) {
            barrier.open();
            this.phaseWhen.delete(this._phase);
        }
    }
    async when(phase) {
        if (phase <= this._phase) {
            return;
        }
        let barrier = this.phaseWhen.get(phase);
        if (!barrier) {
            barrier = new Barrier();
            this.phaseWhen.set(phase, barrier);
        }
        await barrier.wait();
    }
}
