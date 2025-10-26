/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
import { equals } from '../../../../base/common/objects.js';
import { mapsStrictEqualIgnoreOrder } from '../../../../base/common/map.js';
export class ShellEnvDetectionCapability extends Disposable {
    type = 5 /* TerminalCapability.ShellEnvDetection */;
    _pendingEnv;
    _env = { value: new Map(), isTrusted: true };
    get env() {
        return this._createStateObject();
    }
    _onDidChangeEnv = this._register(new Emitter());
    onDidChangeEnv = this._onDidChangeEnv.event;
    setEnvironment(env, isTrusted) {
        if (equals(this.env.value, env)) {
            return;
        }
        this._env.value.clear();
        for (const [key, value] of Object.entries(env)) {
            if (value !== undefined) {
                this._env.value.set(key, value);
            }
        }
        this._env.isTrusted = isTrusted;
        this._fireEnvChange();
    }
    startEnvironmentSingleVar(clear, isTrusted) {
        if (clear) {
            this._pendingEnv = {
                value: new Map(),
                isTrusted
            };
        }
        else {
            this._pendingEnv = {
                value: new Map(this._env.value),
                isTrusted: this._env.isTrusted && isTrusted
            };
        }
    }
    setEnvironmentSingleVar(key, value, isTrusted) {
        if (!this._pendingEnv) {
            return;
        }
        if (key !== undefined && value !== undefined) {
            this._pendingEnv.value.set(key, value);
            this._pendingEnv.isTrusted &&= isTrusted;
        }
    }
    endEnvironmentSingleVar(isTrusted) {
        if (!this._pendingEnv) {
            return;
        }
        this._pendingEnv.isTrusted &&= isTrusted;
        const envDiffers = !mapsStrictEqualIgnoreOrder(this._env.value, this._pendingEnv.value);
        if (envDiffers) {
            this._env = this._pendingEnv;
            this._fireEnvChange();
        }
        this._pendingEnv = undefined;
    }
    deleteEnvironmentSingleVar(key, value, isTrusted) {
        if (!this._pendingEnv) {
            return;
        }
        if (key !== undefined && value !== undefined) {
            this._pendingEnv.value.delete(key);
            this._pendingEnv.isTrusted &&= isTrusted;
        }
    }
    _fireEnvChange() {
        this._onDidChangeEnv.fire(this._createStateObject());
    }
    _createStateObject() {
        return {
            value: Object.fromEntries(this._env.value),
            isTrusted: this._env.isTrusted
        };
    }
}
