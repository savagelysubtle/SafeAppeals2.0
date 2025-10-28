/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../base/common/event.js';
class InputModeImpl {
    _inputMode = 'insert';
    _onDidChangeInputMode = new Emitter();
    onDidChangeInputMode = this._onDidChangeInputMode.event;
    getInputMode() {
        return this._inputMode;
    }
    setInputMode(inputMode) {
        this._inputMode = inputMode;
        this._onDidChangeInputMode.fire(this._inputMode);
    }
}
/**
 * Controls the type mode, whether insert or overtype
 */
export const InputMode = new InputModeImpl();
