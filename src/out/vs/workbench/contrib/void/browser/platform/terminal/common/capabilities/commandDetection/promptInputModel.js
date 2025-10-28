/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { LogLevel } from '../../../../log/common/log.js';
import { throttle } from '../../../../../base/common/decorators.js';
let PromptInputModel = (() => {
    let _classSuper = Disposable;
    let _instanceExtraInitializers = [];
    let __sync_decorators;
    return class PromptInputModel extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            __sync_decorators = [throttle(0)];
            __esDecorate(this, null, __sync_decorators, { kind: "method", name: "_sync", static: false, private: false, access: { has: obj => "_sync" in obj, get: obj => obj._sync }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        _xterm = __runInitializers(this, _instanceExtraInitializers);
        _logService;
        _state = 0 /* PromptInputState.Unknown */;
        _commandStartMarker;
        _commandStartX = 0;
        _lastPromptLine;
        _continuationPrompt;
        _shellType;
        _lastUserInput = '';
        _value = '';
        get value() { return this._value; }
        get prefix() { return this._value.substring(0, this._cursorIndex); }
        get suffix() { return this._value.substring(this._cursorIndex, this._ghostTextIndex === -1 ? undefined : this._ghostTextIndex); }
        _cursorIndex = 0;
        get cursorIndex() { return this._cursorIndex; }
        _ghostTextIndex = -1;
        get ghostTextIndex() { return this._ghostTextIndex; }
        _onDidStartInput = this._register(new Emitter());
        onDidStartInput = this._onDidStartInput.event;
        _onDidChangeInput = this._register(new Emitter());
        onDidChangeInput = this._onDidChangeInput.event;
        _onDidFinishInput = this._register(new Emitter());
        onDidFinishInput = this._onDidFinishInput.event;
        _onDidInterrupt = this._register(new Emitter());
        onDidInterrupt = this._onDidInterrupt.event;
        constructor(_xterm, onCommandStart, onCommandStartChanged, onCommandExecuted, _logService) {
            super();
            this._xterm = _xterm;
            this._logService = _logService;
            this._register(Event.any(this._xterm.onCursorMove, this._xterm.onData, this._xterm.onWriteParsed)(() => this._sync()));
            this._register(this._xterm.onData(e => this._handleUserInput(e)));
            this._register(onCommandStart(e => this._handleCommandStart(e)));
            this._register(onCommandStartChanged(() => this._handleCommandStartChanged()));
            this._register(onCommandExecuted(() => this._handleCommandExecuted()));
            this._register(this.onDidStartInput(() => this._logCombinedStringIfTrace('PromptInputModel#onDidStartInput')));
            this._register(this.onDidChangeInput(() => this._logCombinedStringIfTrace('PromptInputModel#onDidChangeInput')));
            this._register(this.onDidFinishInput(() => this._logCombinedStringIfTrace('PromptInputModel#onDidFinishInput')));
            this._register(this.onDidInterrupt(() => this._logCombinedStringIfTrace('PromptInputModel#onDidInterrupt')));
        }
        _logCombinedStringIfTrace(message) {
            // Only generate the combined string if trace
            if (this._logService.getLevel() === LogLevel.Trace) {
                this._logService.trace(message, this.getCombinedString());
            }
        }
        setShellType(shellType) {
            this._shellType = shellType;
        }
        setContinuationPrompt(value) {
            this._continuationPrompt = value;
            this._sync();
        }
        setLastPromptLine(value) {
            this._lastPromptLine = value;
            this._sync();
        }
        setConfidentCommandLine(value) {
            if (this._value !== value) {
                this._value = value;
                this._cursorIndex = -1;
                this._ghostTextIndex = -1;
                this._onDidChangeInput.fire(this._createStateObject());
            }
        }
        getCombinedString(emptyStringWhenEmpty) {
            const value = this._value.replaceAll('\n', '\u23CE');
            if (this._cursorIndex === -1) {
                return value;
            }
            let result = `${value.substring(0, this.cursorIndex)}|`;
            if (this.ghostTextIndex !== -1) {
                result += `${value.substring(this.cursorIndex, this.ghostTextIndex)}[`;
                result += `${value.substring(this.ghostTextIndex)}]`;
            }
            else {
                result += value.substring(this.cursorIndex);
            }
            if (result === '|' && emptyStringWhenEmpty) {
                return '';
            }
            return result;
        }
        serialize() {
            return {
                modelState: this._createStateObject(),
                commandStartX: this._commandStartX,
                lastPromptLine: this._lastPromptLine,
                continuationPrompt: this._continuationPrompt,
                lastUserInput: this._lastUserInput
            };
        }
        deserialize(serialized) {
            this._value = serialized.modelState.value;
            this._cursorIndex = serialized.modelState.cursorIndex;
            this._ghostTextIndex = serialized.modelState.ghostTextIndex;
            this._commandStartX = serialized.commandStartX;
            this._lastPromptLine = serialized.lastPromptLine;
            this._continuationPrompt = serialized.continuationPrompt;
            this._lastUserInput = serialized.lastUserInput;
        }
        _handleCommandStart(command) {
            if (this._state === 1 /* PromptInputState.Input */) {
                return;
            }
            this._state = 1 /* PromptInputState.Input */;
            this._commandStartMarker = command.marker;
            this._commandStartX = this._xterm.buffer.active.cursorX;
            this._value = '';
            this._cursorIndex = 0;
            this._onDidStartInput.fire(this._createStateObject());
            this._onDidChangeInput.fire(this._createStateObject());
            // Trigger a sync if prompt terminator is set as that could adjust the command start X
            if (this._lastPromptLine) {
                if (this._commandStartX !== this._lastPromptLine.length) {
                    const line = this._xterm.buffer.active.getLine(this._commandStartMarker.line);
                    if (line?.translateToString(true).startsWith(this._lastPromptLine)) {
                        this._commandStartX = this._lastPromptLine.length;
                        this._sync();
                    }
                }
            }
        }
        _handleCommandStartChanged() {
            if (this._state !== 1 /* PromptInputState.Input */) {
                return;
            }
            this._commandStartX = this._xterm.buffer.active.cursorX;
            this._onDidChangeInput.fire(this._createStateObject());
            this._sync();
        }
        _handleCommandExecuted() {
            if (this._state === 2 /* PromptInputState.Execute */) {
                return;
            }
            this._cursorIndex = -1;
            // Remove any ghost text from the input if it exists on execute
            if (this._ghostTextIndex !== -1) {
                this._value = this._value.substring(0, this._ghostTextIndex);
                this._ghostTextIndex = -1;
            }
            const event = this._createStateObject();
            if (this._lastUserInput === '\u0003') {
                this._lastUserInput = '';
                this._onDidInterrupt.fire(event);
            }
            this._state = 2 /* PromptInputState.Execute */;
            this._onDidFinishInput.fire(event);
            this._onDidChangeInput.fire(event);
        }
        _sync() {
            try {
                this._doSync();
            }
            catch (e) {
                this._logService.error('Error while syncing prompt input model', e);
            }
        }
        _doSync() {
            if (this._state !== 1 /* PromptInputState.Input */) {
                return;
            }
            let commandStartY = this._commandStartMarker?.line;
            if (commandStartY === undefined) {
                return;
            }
            const buffer = this._xterm.buffer.active;
            let line = buffer.getLine(commandStartY);
            const absoluteCursorY = buffer.baseY + buffer.cursorY;
            let cursorIndex;
            let commandLine = line?.translateToString(true, this._commandStartX);
            if (this._shellType === "fish" /* PosixShellType.Fish */ && (!line || !commandLine)) {
                commandStartY += 1;
                line = buffer.getLine(commandStartY);
                if (line) {
                    commandLine = line.translateToString(true);
                    cursorIndex = absoluteCursorY === commandStartY ? buffer.cursorX : commandLine?.trimEnd().length;
                }
            }
            if (line === undefined || commandLine === undefined) {
                this._logService.trace(`PromptInputModel#_sync: no line`);
                return;
            }
            let value = commandLine;
            let ghostTextIndex = -1;
            if (cursorIndex === undefined) {
                if (absoluteCursorY === commandStartY) {
                    cursorIndex = this._getRelativeCursorIndex(this._commandStartX, buffer, line);
                }
                else {
                    cursorIndex = commandLine.trimEnd().length;
                }
            }
            // From command start line to cursor line
            for (let y = commandStartY + 1; y <= absoluteCursorY; y++) {
                const nextLine = buffer.getLine(y);
                const lineText = nextLine?.translateToString(true);
                if (lineText && nextLine) {
                    // Check if the line wrapped without a new line (continuation) or
                    // we're on the last line and the continuation prompt is not present, so we need to add the value
                    if (nextLine.isWrapped || (absoluteCursorY === y && this._continuationPrompt && !this._lineContainsContinuationPrompt(lineText))) {
                        value += `${lineText}`;
                        const relativeCursorIndex = this._getRelativeCursorIndex(0, buffer, nextLine);
                        if (absoluteCursorY === y) {
                            cursorIndex += relativeCursorIndex;
                        }
                        else {
                            cursorIndex += lineText.length;
                        }
                    }
                    else if (this._shellType === "fish" /* PosixShellType.Fish */) {
                        if (value.endsWith('\\')) {
                            // Trim off the trailing backslash
                            value = value.substring(0, value.length - 1);
                            value += `${lineText.trim()}`;
                            cursorIndex += lineText.trim().length - 1;
                        }
                        else {
                            if (/^ {6,}/.test(lineText)) {
                                // Was likely a new line
                                value += `\n${lineText.trim()}`;
                                cursorIndex += lineText.trim().length + 1;
                            }
                            else {
                                value += lineText;
                                cursorIndex += lineText.length;
                            }
                        }
                    }
                    // Verify continuation prompt if we have it, if this line doesn't have it then the
                    // user likely just pressed enter.
                    else if (this._continuationPrompt === undefined || this._lineContainsContinuationPrompt(lineText)) {
                        const trimmedLineText = this._trimContinuationPrompt(lineText);
                        value += `\n${trimmedLineText}`;
                        if (absoluteCursorY === y) {
                            const continuationCellWidth = this._getContinuationPromptCellWidth(nextLine, lineText);
                            const relativeCursorIndex = this._getRelativeCursorIndex(continuationCellWidth, buffer, nextLine);
                            cursorIndex += relativeCursorIndex + 1;
                        }
                        else {
                            cursorIndex += trimmedLineText.length + 1;
                        }
                    }
                }
            }
            // Below cursor line
            for (let y = absoluteCursorY + 1; y < buffer.baseY + this._xterm.rows; y++) {
                const belowCursorLine = buffer.getLine(y);
                const lineText = belowCursorLine?.translateToString(true);
                if (lineText && belowCursorLine) {
                    if (this._shellType === "fish" /* PosixShellType.Fish */) {
                        value += `${lineText}`;
                    }
                    else if (this._continuationPrompt === undefined || this._lineContainsContinuationPrompt(lineText)) {
                        value += `\n${this._trimContinuationPrompt(lineText)}`;
                    }
                    else {
                        value += lineText;
                    }
                }
                else {
                    break;
                }
            }
            if (this._logService.getLevel() === LogLevel.Trace) {
                this._logService.trace(`PromptInputModel#_sync: ${this.getCombinedString()}`);
            }
            // Adjust trailing whitespace
            {
                let trailingWhitespace = this._value.length - this._value.trimEnd().length;
                // Handle backspace key
                if (this._lastUserInput === '\x7F') {
                    this._lastUserInput = '';
                    if (cursorIndex === this._cursorIndex - 1) {
                        // If trailing whitespace is being increased by removing a non-whitespace character
                        if (this._value.trimEnd().length > value.trimEnd().length && value.trimEnd().length <= cursorIndex) {
                            trailingWhitespace = Math.max((this._value.length - 1) - value.trimEnd().length, 0);
                        }
                        // Standard case; subtract from trailing whitespace
                        else {
                            trailingWhitespace = Math.max(trailingWhitespace - 1, 0);
                        }
                    }
                }
                // Handle delete key
                if (this._lastUserInput === '\x1b[3~') {
                    this._lastUserInput = '';
                    if (cursorIndex === this._cursorIndex) {
                        trailingWhitespace = Math.max(trailingWhitespace - 1, 0);
                    }
                }
                const valueLines = value.split('\n');
                const isMultiLine = valueLines.length > 1;
                const valueEndTrimmed = value.trimEnd();
                if (!isMultiLine) {
                    // Adjust trimmed whitespace value based on cursor position
                    if (valueEndTrimmed.length < value.length) {
                        // Handle space key
                        if (this._lastUserInput === ' ') {
                            this._lastUserInput = '';
                            if (cursorIndex > valueEndTrimmed.length && cursorIndex > this._cursorIndex) {
                                trailingWhitespace++;
                            }
                        }
                        trailingWhitespace = Math.max(cursorIndex - valueEndTrimmed.length, trailingWhitespace, 0);
                    }
                    // Handle case where a non-space character is inserted in the middle of trailing whitespace
                    const charBeforeCursor = cursorIndex === 0 ? '' : value[cursorIndex - 1];
                    if (trailingWhitespace > 0 && cursorIndex === this._cursorIndex + 1 && this._lastUserInput !== '' && charBeforeCursor !== ' ') {
                        trailingWhitespace = this._value.length - this._cursorIndex;
                    }
                }
                if (isMultiLine) {
                    valueLines[valueLines.length - 1] = valueLines.at(-1)?.trimEnd() ?? '';
                    const continuationOffset = (valueLines.length - 1) * (this._continuationPrompt?.length ?? 0);
                    trailingWhitespace = Math.max(0, cursorIndex - value.length - continuationOffset);
                }
                value = valueLines.map(e => e.trimEnd()).join('\n') + ' '.repeat(trailingWhitespace);
            }
            ghostTextIndex = this._scanForGhostText(buffer, line, cursorIndex);
            if (this._value !== value || this._cursorIndex !== cursorIndex || this._ghostTextIndex !== ghostTextIndex) {
                this._value = value;
                this._cursorIndex = cursorIndex;
                this._ghostTextIndex = ghostTextIndex;
                this._onDidChangeInput.fire(this._createStateObject());
            }
        }
        _handleUserInput(e) {
            this._lastUserInput = e;
        }
        /**
         * Detect ghost text by looking for italic or dim text in or after the cursor and
         * non-italic/dim text in the first non-whitespace cell following command start and before the cursor.
         */
        _scanForGhostText(buffer, line, cursorIndex) {
            if (!this.value.trim().length) {
                return -1;
            }
            // Check last non-whitespace character has non-ghost text styles
            let ghostTextIndex = -1;
            let proceedWithGhostTextCheck = false;
            let x = buffer.cursorX;
            while (x > 0) {
                const cell = line.getCell(--x);
                if (!cell) {
                    break;
                }
                if (cell.getChars().trim().length > 0) {
                    proceedWithGhostTextCheck = !this._isCellStyledLikeGhostText(cell);
                    break;
                }
            }
            // Check to the end of the line for possible ghost text. For example pwsh's ghost text
            // can look like this `Get-|Ch[ildItem]`
            if (proceedWithGhostTextCheck) {
                let potentialGhostIndexOffset = 0;
                let x = buffer.cursorX;
                while (x < line.length) {
                    const cell = line.getCell(x++);
                    if (!cell || cell.getCode() === 0) {
                        break;
                    }
                    if (this._isCellStyledLikeGhostText(cell)) {
                        ghostTextIndex = cursorIndex + potentialGhostIndexOffset;
                        break;
                    }
                    potentialGhostIndexOffset += cell.getChars().length;
                }
            }
            // Ghost text may not be italic or dimmed, but will have a different style than the
            // rest of the line that precedes it.
            if (ghostTextIndex === -1) {
                ghostTextIndex = this._scanForGhostTextAdvanced(buffer, line, cursorIndex);
            }
            if (ghostTextIndex > -1 && this.value.substring(ghostTextIndex).endsWith(' ')) {
                this._value = this.value.trim();
                if (!this.value.substring(ghostTextIndex)) {
                    ghostTextIndex = -1;
                }
            }
            return ghostTextIndex;
        }
        _scanForGhostTextAdvanced(buffer, line, cursorIndex) {
            let ghostTextIndex = -1;
            let currentPos = buffer.cursorX; // Start scanning from the cursor position
            // Map to store styles and their corresponding positions
            const styleMap = new Map();
            // Identify the last non-whitespace character in the line
            let lastNonWhitespaceCell = line.getCell(currentPos);
            let nextCell = lastNonWhitespaceCell;
            // Scan from the cursor position to the end of the line
            while (nextCell && currentPos < line.length) {
                const styleKey = this._getCellStyleAsString(nextCell);
                // Track all occurrences of each unique style in the line
                styleMap.set(styleKey, [...(styleMap.get(styleKey) ?? []), currentPos]);
                // Move to the next cell
                nextCell = line.getCell(++currentPos);
                // Update `lastNonWhitespaceCell` only if the new cell contains visible characters
                if (nextCell?.getChars().trim().length) {
                    lastNonWhitespaceCell = nextCell;
                }
            }
            // If there's no valid last non-whitespace cell OR the first and last styles match (indicating no ghost text)
            if (!lastNonWhitespaceCell?.getChars().trim().length ||
                this._cellStylesMatch(line.getCell(this._commandStartX), lastNonWhitespaceCell)) {
                return -1;
            }
            // Retrieve the positions of all cells with the same style as `lastNonWhitespaceCell`
            const positionsWithGhostStyle = styleMap.get(this._getCellStyleAsString(lastNonWhitespaceCell));
            if (positionsWithGhostStyle) {
                // Ensure these positions are contiguous
                for (let i = 1; i < positionsWithGhostStyle.length; i++) {
                    if (positionsWithGhostStyle[i] !== positionsWithGhostStyle[i - 1] + 1) {
                        // Discontinuous styles, so may be syntax highlighting vs ghost text
                        return -1;
                    }
                }
                // Calculate the ghost text start index
                if (buffer.baseY + buffer.cursorY === this._commandStartMarker?.line) {
                    ghostTextIndex = positionsWithGhostStyle[0] - this._commandStartX;
                }
                else {
                    ghostTextIndex = positionsWithGhostStyle[0];
                }
            }
            // Ensure no earlier cells in the line match `lastNonWhitespaceCell`'s style,
            // which would indicate the text is not ghost text.
            if (ghostTextIndex !== -1) {
                for (let checkPos = buffer.cursorX; checkPos >= this._commandStartX; checkPos--) {
                    const checkCell = line.getCell(checkPos);
                    if (!checkCell?.getChars.length) {
                        continue;
                    }
                    if (checkCell && checkCell.getCode() !== 0 && this._cellStylesMatch(lastNonWhitespaceCell, checkCell)) {
                        return -1;
                    }
                }
            }
            return ghostTextIndex >= cursorIndex ? ghostTextIndex : -1;
        }
        _getCellStyleAsString(cell) {
            return `${cell.getFgColor()}${cell.getBgColor()}${cell.isBold()}${cell.isItalic()}${cell.isDim()}${cell.isUnderline()}${cell.isBlink()}${cell.isInverse()}${cell.isInvisible()}${cell.isStrikethrough()}${cell.isOverline()}${cell.getFgColorMode()}${cell.getBgColorMode()}`;
        }
        _cellStylesMatch(a, b) {
            if (!a || !b) {
                return false;
            }
            return a.getFgColor() === b.getFgColor()
                && a.getBgColor() === b.getBgColor()
                && a.isBold() === b.isBold()
                && a.isItalic() === b.isItalic()
                && a.isDim() === b.isDim()
                && a.isUnderline() === b.isUnderline()
                && a.isBlink() === b.isBlink()
                && a.isInverse() === b.isInverse()
                && a.isInvisible() === b.isInvisible()
                && a.isStrikethrough() === b.isStrikethrough()
                && a.isOverline() === b.isOverline()
                && a?.getBgColorMode() === b?.getBgColorMode()
                && a?.getFgColorMode() === b?.getFgColorMode();
        }
        _trimContinuationPrompt(lineText) {
            if (this._lineContainsContinuationPrompt(lineText)) {
                lineText = lineText.substring(this._continuationPrompt.length);
            }
            return lineText;
        }
        _lineContainsContinuationPrompt(lineText) {
            return !!(this._continuationPrompt && lineText.startsWith(this._continuationPrompt.trimEnd()));
        }
        _getContinuationPromptCellWidth(line, lineText) {
            if (!this._continuationPrompt || !lineText.startsWith(this._continuationPrompt.trimEnd())) {
                return 0;
            }
            let buffer = '';
            let x = 0;
            let cell;
            while (buffer !== this._continuationPrompt) {
                cell = line.getCell(x++);
                if (!cell) {
                    break;
                }
                buffer += cell.getChars();
            }
            return x;
        }
        _getRelativeCursorIndex(startCellX, buffer, line) {
            return line?.translateToString(true, startCellX, buffer.cursorX).length ?? 0;
        }
        _isCellStyledLikeGhostText(cell) {
            return !!(cell.isItalic() || cell.isDim());
        }
        _createStateObject() {
            return Object.freeze({
                value: this._value,
                prefix: this.prefix,
                suffix: this.suffix,
                cursorIndex: this._cursorIndex,
                ghostTextIndex: this._ghostTextIndex
            });
        }
    };
})();
export { PromptInputModel };
