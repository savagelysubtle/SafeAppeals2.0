/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Range } from '../core/range.js';
import { TokenQuality, TokenStore } from './tokenStore.js';
import { registerSingleton } from '../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
export const ITreeSitterTokenizationStoreService = createDecorator('treeSitterTokenizationStoreService');
class TreeSitterTokenizationStoreService {
    _serviceBrand;
    tokens = new Map();
    constructor() { }
    setTokens(model, tokens, tokenQuality) {
        const disposables = new DisposableStore();
        const store = disposables.add(new TokenStore(model));
        this.tokens.set(model, { store: store, accurateVersion: model.getVersionId(), disposables, guessVersion: model.getVersionId() });
        store.buildStore(tokens, tokenQuality);
        disposables.add(model.onWillDispose(() => {
            const storeInfo = this.tokens.get(model);
            if (storeInfo) {
                storeInfo.disposables.dispose();
                this.tokens.delete(model);
            }
        }));
    }
    handleContentChanged(model, e) {
        const storeInfo = this.tokens.get(model);
        if (!storeInfo) {
            return;
        }
        storeInfo.guessVersion = e.versionId;
        for (const change of e.changes) {
            if (change.text.length > change.rangeLength) {
                // If possible, use the token before the change as the starting point for the new token.
                // This is more likely to let the new text be the correct color as typeing is usually at the end of the token.
                const offset = change.rangeOffset > 0 ? change.rangeOffset - 1 : change.rangeOffset;
                const oldToken = storeInfo.store.getTokenAt(offset);
                let newToken;
                if (oldToken) {
                    // Insert. Just grow the token at this position to include the insert.
                    newToken = { startOffsetInclusive: oldToken.startOffsetInclusive, length: oldToken.length + change.text.length - change.rangeLength, token: oldToken.token };
                    // Also mark tokens that are in the range of the change as needing a refresh.
                    storeInfo.store.markForRefresh(offset, change.rangeOffset + (change.text.length > change.rangeLength ? change.text.length : change.rangeLength));
                }
                else {
                    // The document got larger and the change is at the end of the document.
                    newToken = { startOffsetInclusive: offset, length: change.text.length, token: 0 };
                }
                storeInfo.store.update(oldToken?.length ?? 0, [newToken], TokenQuality.EditGuess);
            }
            else if (change.text.length < change.rangeLength) {
                // Delete. Delete the tokens at the corresponding range.
                const deletedCharCount = change.rangeLength - change.text.length;
                storeInfo.store.delete(deletedCharCount, change.rangeOffset);
            }
        }
    }
    rangeHasTokens(model, range, minimumTokenQuality) {
        const tokens = this.tokens.get(model);
        if (!tokens) {
            return false;
        }
        return tokens.store.rangeHasTokens(model.getOffsetAt(range.getStartPosition()), model.getOffsetAt(range.getEndPosition()), minimumTokenQuality);
    }
    hasTokens(model, accurateForRange) {
        const tokens = this.tokens.get(model);
        if (!tokens) {
            return false;
        }
        if (!accurateForRange || (tokens.guessVersion === tokens.accurateVersion)) {
            return true;
        }
        return !tokens.store.rangeNeedsRefresh(model.getOffsetAt(accurateForRange.getStartPosition()), model.getOffsetAt(accurateForRange.getEndPosition()));
    }
    getTokens(model, line) {
        const tokens = this.tokens.get(model)?.store;
        if (!tokens) {
            return undefined;
        }
        const lineStartOffset = model.getOffsetAt({ lineNumber: line, column: 1 });
        const lineTokens = tokens.getTokensInRange(lineStartOffset, model.getOffsetAt({ lineNumber: line, column: model.getLineLength(line) }) + 1);
        const result = new Uint32Array(lineTokens.length * 2);
        for (let i = 0; i < lineTokens.length; i++) {
            result[i * 2] = lineTokens[i].startOffsetInclusive - lineStartOffset + lineTokens[i].length;
            result[i * 2 + 1] = lineTokens[i].token;
        }
        return result;
    }
    updateTokens(model, version, updates, tokenQuality) {
        const existingTokens = this.tokens.get(model);
        if (!existingTokens) {
            return;
        }
        existingTokens.accurateVersion = version;
        for (const update of updates) {
            const lastToken = update.newTokens.length > 0 ? update.newTokens[update.newTokens.length - 1] : undefined;
            let oldRangeLength;
            if (lastToken && (existingTokens.guessVersion >= version)) {
                oldRangeLength = lastToken.startOffsetInclusive + lastToken.length - update.newTokens[0].startOffsetInclusive;
            }
            else if (update.oldRangeLength) {
                oldRangeLength = update.oldRangeLength;
            }
            else {
                oldRangeLength = 0;
            }
            existingTokens.store.update(oldRangeLength, update.newTokens, tokenQuality);
        }
    }
    markForRefresh(model, range) {
        const tree = this.tokens.get(model)?.store;
        if (!tree) {
            return;
        }
        tree.markForRefresh(model.getOffsetAt(range.getStartPosition()), model.getOffsetAt(range.getEndPosition()));
    }
    getNeedsRefresh(model) {
        const needsRefreshOffsetRanges = this.tokens.get(model)?.store.getNeedsRefresh();
        if (!needsRefreshOffsetRanges) {
            return [];
        }
        return needsRefreshOffsetRanges.map(range => ({
            range: Range.fromPositions(model.getPositionAt(range.startOffset), model.getPositionAt(range.endOffset)),
            startOffset: range.startOffset,
            endOffset: range.endOffset
        }));
    }
    delete(model) {
        const storeInfo = this.tokens.get(model);
        if (storeInfo) {
            storeInfo.disposables.dispose();
            this.tokens.delete(model);
        }
    }
    dispose() {
        for (const [, value] of this.tokens) {
            value.disposables.dispose();
        }
    }
}
registerSingleton(ITreeSitterTokenizationStoreService, TreeSitterTokenizationStoreService, 1 /* InstantiationType.Delayed */);
