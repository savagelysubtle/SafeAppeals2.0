/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../instantiation/common/instantiation.js';
export const IUndoRedoService = createDecorator('undoRedoService');
export class ResourceEditStackSnapshot {
    resource;
    elements;
    constructor(resource, elements) {
        this.resource = resource;
        this.elements = elements;
    }
}
export class UndoRedoGroup {
    static _ID = 0;
    id;
    order;
    constructor() {
        this.id = UndoRedoGroup._ID++;
        this.order = 1;
    }
    nextOrder() {
        if (this.id === 0) {
            return 0;
        }
        return this.order++;
    }
    static None = new UndoRedoGroup();
}
export class UndoRedoSource {
    static _ID = 0;
    id;
    order;
    constructor() {
        this.id = UndoRedoSource._ID++;
        this.order = 1;
    }
    nextOrder() {
        if (this.id === 0) {
            return 0;
        }
        return this.order++;
    }
    static None = new UndoRedoSource();
}
