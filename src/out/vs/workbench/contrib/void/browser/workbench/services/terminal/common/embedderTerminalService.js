/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
export const IEmbedderTerminalService = createDecorator('embedderTerminalService');
class EmbedderTerminalService {
    _onDidCreateTerminal = new Emitter();
    onDidCreateTerminal = Event.buffer(this._onDidCreateTerminal.event);
    createTerminal(options) {
        const slc = {
            name: options.name,
            isFeatureTerminal: true,
            customPtyImplementation(terminalId, cols, rows) {
                return new EmbedderTerminalProcess(terminalId, options.pty);
            },
        };
        this._onDidCreateTerminal.fire(slc);
    }
}
class EmbedderTerminalProcess extends Disposable {
    id;
    _pty;
    shouldPersist = false;
    onProcessData;
    _onProcessReady = this._register(new Emitter());
    onProcessReady = this._onProcessReady.event;
    _onDidChangeProperty = this._register(new Emitter());
    onDidChangeProperty = this._onDidChangeProperty.event;
    _onProcessExit = this._register(new Emitter());
    onProcessExit = this._onProcessExit.event;
    constructor(id, pty) {
        super();
        this.id = id;
        this._pty = pty;
        this.onProcessData = this._pty.onDidWrite;
        if (this._pty.onDidClose) {
            this._register(this._pty.onDidClose(e => this._onProcessExit.fire(e || undefined)));
        }
        if (this._pty.onDidChangeName) {
            this._register(this._pty.onDidChangeName(e => this._onDidChangeProperty.fire({
                type: "title" /* ProcessPropertyType.Title */,
                value: e
            })));
        }
    }
    async start() {
        this._onProcessReady.fire({ pid: -1, cwd: '', windowsPty: undefined });
        this._pty.open();
        return undefined;
    }
    shutdown() {
        this._pty.close();
    }
    // TODO: A lot of these aren't useful for some implementations of ITerminalChildProcess, should
    // they be optional? Should there be a base class for "external" consumers to implement?
    input() {
        // not supported
    }
    async processBinary() {
        // not supported
    }
    resize() {
        // no-op
    }
    clearBuffer() {
        // no-op
    }
    acknowledgeDataEvent() {
        // no-op, flow control not currently implemented
    }
    async setUnicodeVersion() {
        // no-op
    }
    async getInitialCwd() {
        return '';
    }
    async getCwd() {
        return '';
    }
    refreshProperty(property) {
        throw new Error(`refreshProperty is not suppported in EmbedderTerminalProcess. property: ${property}`);
    }
    updateProperty(property, value) {
        throw new Error(`updateProperty is not suppported in EmbedderTerminalProcess. property: ${property}, value: ${value}`);
    }
}
registerSingleton(IEmbedderTerminalService, EmbedderTerminalService, 1 /* InstantiationType.Delayed */);
