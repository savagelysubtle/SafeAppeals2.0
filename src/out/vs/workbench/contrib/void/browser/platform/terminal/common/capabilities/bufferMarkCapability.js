/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
/**
 * Manages "marks" in the buffer which are lines that are tracked when lines are added to or removed
 * from the buffer.
 */
export class BufferMarkCapability extends Disposable {
    _terminal;
    type = 4 /* TerminalCapability.BufferMarkDetection */;
    _idToMarkerMap = new Map();
    _anonymousMarkers = new Map();
    _onMarkAdded = this._register(new Emitter());
    onMarkAdded = this._onMarkAdded.event;
    constructor(_terminal) {
        super();
        this._terminal = _terminal;
    }
    *markers() {
        for (const m of this._idToMarkerMap.values()) {
            yield m;
        }
        for (const m of this._anonymousMarkers.values()) {
            yield m;
        }
    }
    addMark(properties) {
        const marker = properties?.marker || this._terminal.registerMarker();
        const id = properties?.id;
        if (!marker) {
            return;
        }
        if (id) {
            this._idToMarkerMap.set(id, marker);
            marker.onDispose(() => this._idToMarkerMap.delete(id));
        }
        else {
            this._anonymousMarkers.set(marker.id, marker);
            marker.onDispose(() => this._anonymousMarkers.delete(marker.id));
        }
        this._onMarkAdded.fire({ marker, id, hidden: properties?.hidden, hoverMessage: properties?.hoverMessage });
    }
    getMark(id) {
        return this._idToMarkerMap.get(id);
    }
}
