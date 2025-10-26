/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class LinesDiff {
    changes;
    moves;
    hitTimeout;
    constructor(changes, 
    /**
     * Sorted by original line ranges.
     * The original line ranges and the modified line ranges must be disjoint (but can be touching).
     */
    moves, 
    /**
     * Indicates if the time out was reached.
     * In that case, the diffs might be an approximation and the user should be asked to rerun the diff with more time.
     */
    hitTimeout) {
        this.changes = changes;
        this.moves = moves;
        this.hitTimeout = hitTimeout;
    }
}
export class MovedText {
    lineRangeMapping;
    /**
     * The diff from the original text to the moved text.
     * Must be contained in the original/modified line range.
     * Can be empty if the text didn't change (only moved).
     */
    changes;
    constructor(lineRangeMapping, changes) {
        this.lineRangeMapping = lineRangeMapping;
        this.changes = changes;
    }
    flip() {
        return new MovedText(this.lineRangeMapping.flip(), this.changes.map(c => c.flip()));
    }
}
