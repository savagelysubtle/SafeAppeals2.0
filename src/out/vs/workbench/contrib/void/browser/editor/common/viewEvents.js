/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class ViewCompositionStartEvent {
    type = 0 /* ViewEventType.ViewCompositionStart */;
    constructor() { }
}
export class ViewCompositionEndEvent {
    type = 1 /* ViewEventType.ViewCompositionEnd */;
    constructor() { }
}
export class ViewConfigurationChangedEvent {
    type = 2 /* ViewEventType.ViewConfigurationChanged */;
    _source;
    constructor(source) {
        this._source = source;
    }
    hasChanged(id) {
        return this._source.hasChanged(id);
    }
}
export class ViewCursorStateChangedEvent {
    selections;
    modelSelections;
    reason;
    type = 3 /* ViewEventType.ViewCursorStateChanged */;
    constructor(selections, modelSelections, reason) {
        this.selections = selections;
        this.modelSelections = modelSelections;
        this.reason = reason;
    }
}
export class ViewDecorationsChangedEvent {
    type = 4 /* ViewEventType.ViewDecorationsChanged */;
    affectsMinimap;
    affectsOverviewRuler;
    affectsGlyphMargin;
    affectsLineNumber;
    constructor(source) {
        if (source) {
            this.affectsMinimap = source.affectsMinimap;
            this.affectsOverviewRuler = source.affectsOverviewRuler;
            this.affectsGlyphMargin = source.affectsGlyphMargin;
            this.affectsLineNumber = source.affectsLineNumber;
        }
        else {
            this.affectsMinimap = true;
            this.affectsOverviewRuler = true;
            this.affectsGlyphMargin = true;
            this.affectsLineNumber = true;
        }
    }
}
export class ViewFlushedEvent {
    type = 5 /* ViewEventType.ViewFlushed */;
    constructor() {
        // Nothing to do
    }
}
export class ViewFocusChangedEvent {
    type = 6 /* ViewEventType.ViewFocusChanged */;
    isFocused;
    constructor(isFocused) {
        this.isFocused = isFocused;
    }
}
export class ViewLanguageConfigurationEvent {
    type = 7 /* ViewEventType.ViewLanguageConfigurationChanged */;
}
export class ViewLineMappingChangedEvent {
    type = 8 /* ViewEventType.ViewLineMappingChanged */;
    constructor() {
        // Nothing to do
    }
}
export class ViewLinesChangedEvent {
    fromLineNumber;
    count;
    type = 9 /* ViewEventType.ViewLinesChanged */;
    constructor(
    /**
     * The first line that has changed.
     */
    fromLineNumber, 
    /**
     * The number of lines that have changed.
     */
    count) {
        this.fromLineNumber = fromLineNumber;
        this.count = count;
    }
}
export class ViewLinesDeletedEvent {
    type = 10 /* ViewEventType.ViewLinesDeleted */;
    /**
     * At what line the deletion began (inclusive).
     */
    fromLineNumber;
    /**
     * At what line the deletion stopped (inclusive).
     */
    toLineNumber;
    constructor(fromLineNumber, toLineNumber) {
        this.fromLineNumber = fromLineNumber;
        this.toLineNumber = toLineNumber;
    }
}
export class ViewLinesInsertedEvent {
    type = 11 /* ViewEventType.ViewLinesInserted */;
    /**
     * Before what line did the insertion begin
     */
    fromLineNumber;
    /**
     * `toLineNumber` - `fromLineNumber` + 1 denotes the number of lines that were inserted
     */
    toLineNumber;
    constructor(fromLineNumber, toLineNumber) {
        this.fromLineNumber = fromLineNumber;
        this.toLineNumber = toLineNumber;
    }
}
export class ViewRevealRangeRequestEvent {
    source;
    minimalReveal;
    range;
    selections;
    verticalType;
    revealHorizontal;
    scrollType;
    type = 12 /* ViewEventType.ViewRevealRangeRequest */;
    constructor(
    /**
     * Source of the call that caused the event.
     */
    source, 
    /**
     * Reduce the revealing to a minimum (e.g. avoid scrolling if the bounding box is visible and near the viewport edge).
     */
    minimalReveal, 
    /**
     * Range to be reavealed.
     */
    range, 
    /**
     * Selections to be revealed.
     */
    selections, 
    /**
     * The vertical reveal strategy.
     */
    verticalType, 
    /**
     * If true: there should be a horizontal & vertical revealing.
     * If false: there should be just a vertical revealing.
     */
    revealHorizontal, 
    /**
     * The scroll type.
     */
    scrollType) {
        this.source = source;
        this.minimalReveal = minimalReveal;
        this.range = range;
        this.selections = selections;
        this.verticalType = verticalType;
        this.revealHorizontal = revealHorizontal;
        this.scrollType = scrollType;
    }
}
export class ViewScrollChangedEvent {
    type = 13 /* ViewEventType.ViewScrollChanged */;
    scrollWidth;
    scrollLeft;
    scrollHeight;
    scrollTop;
    scrollWidthChanged;
    scrollLeftChanged;
    scrollHeightChanged;
    scrollTopChanged;
    constructor(source) {
        this.scrollWidth = source.scrollWidth;
        this.scrollLeft = source.scrollLeft;
        this.scrollHeight = source.scrollHeight;
        this.scrollTop = source.scrollTop;
        this.scrollWidthChanged = source.scrollWidthChanged;
        this.scrollLeftChanged = source.scrollLeftChanged;
        this.scrollHeightChanged = source.scrollHeightChanged;
        this.scrollTopChanged = source.scrollTopChanged;
    }
}
export class ViewThemeChangedEvent {
    theme;
    type = 14 /* ViewEventType.ViewThemeChanged */;
    constructor(theme) {
        this.theme = theme;
    }
}
export class ViewTokensChangedEvent {
    type = 15 /* ViewEventType.ViewTokensChanged */;
    ranges;
    constructor(ranges) {
        this.ranges = ranges;
    }
}
export class ViewTokensColorsChangedEvent {
    type = 16 /* ViewEventType.ViewTokensColorsChanged */;
    constructor() {
        // Nothing to do
    }
}
export class ViewZonesChangedEvent {
    type = 17 /* ViewEventType.ViewZonesChanged */;
    constructor() {
        // Nothing to do
    }
}
