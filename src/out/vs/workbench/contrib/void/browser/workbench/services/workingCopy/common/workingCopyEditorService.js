/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
export const IWorkingCopyEditorService = createDecorator('workingCopyEditorService');
export class WorkingCopyEditorService extends Disposable {
    editorService;
    _onDidRegisterHandler = this._register(new Emitter());
    onDidRegisterHandler = this._onDidRegisterHandler.event;
    handlers = new Set();
    constructor(editorService) {
        super();
        this.editorService = editorService;
    }
    registerHandler(handler) {
        // Add to registry and emit as event
        this.handlers.add(handler);
        this._onDidRegisterHandler.fire(handler);
        return toDisposable(() => this.handlers.delete(handler));
    }
    findEditor(workingCopy) {
        for (const editorIdentifier of this.editorService.getEditors(0 /* EditorsOrder.MOST_RECENTLY_ACTIVE */)) {
            if (this.isOpen(workingCopy, editorIdentifier.editor)) {
                return editorIdentifier;
            }
        }
        return undefined;
    }
    isOpen(workingCopy, editor) {
        for (const handler of this.handlers) {
            if (handler.isOpen(workingCopy, editor)) {
                return true;
            }
        }
        return false;
    }
}
// Register Service
registerSingleton(IWorkingCopyEditorService, WorkingCopyEditorService, 1 /* InstantiationType.Delayed */);
