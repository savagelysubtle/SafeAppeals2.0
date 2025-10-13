/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MarginBounds } from './rulerManager';

export interface BreakPoint {
	line: number;
	char: number;
}

export class MarginController {
	private margins: MarginBounds;
	private charWidth: number;
	private viewportWidth: number;
	private enabled: boolean = true;

	constructor(margins: MarginBounds, charWidth: number, viewportWidth: number) {
		this.margins = margins;
		this.charWidth = charWidth;
		this.viewportWidth = viewportWidth;
	}

	public updateMargins(margins: MarginBounds): void {
		this.margins = margins;
	}

	public updateCharWidth(width: number): void {
		this.charWidth = width;
	}

	public updateViewport(width: number): void {
		this.viewportWidth = width;
	}

	public setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	public isEnabled(): boolean {
		return this.enabled;
	}

	public getAvailableWidth(): number {
		return this.viewportWidth - this.margins.left - this.margins.right;
	}

	public getMaxCharsPerLine(): number {
		const availableWidth = this.getAvailableWidth();
		return Math.floor(availableWidth / this.charWidth);
	}

	public constrainText(text: string): string {
		if (!this.enabled) {
			return text;
		}

		const lines = text.split('\n');
		const constrainedLines: string[] = [];

		for (const line of lines) {
			if (line.length === 0) {
				constrainedLines.push('');
				continue;
			}

			const wrappedLines = this.wrapLine(line);
			constrainedLines.push(...wrappedLines);
		}

		return constrainedLines.join('\n');
	}

	private wrapLine(line: string): string[] {
		const maxChars = this.getMaxCharsPerLine();
		const wrappedLines: string[] = [];

		if (line.length <= maxChars) {
			wrappedLines.push(line);
			return wrappedLines;
		}

		// Word-wrap algorithm
		const words = line.split(' ');
		let currentLine = '';

		for (const word of words) {
			// If the word itself is longer than max chars, break it
			if (word.length > maxChars) {
				if (currentLine.length > 0) {
					wrappedLines.push(currentLine.trim());
					currentLine = '';
				}

				// Break the long word into chunks
				for (let i = 0; i < word.length; i += maxChars) {
					wrappedLines.push(word.substring(i, Math.min(i + maxChars, word.length)));
				}
				continue;
			}

			const testLine = currentLine.length === 0 ? word : currentLine + ' ' + word;

			if (testLine.length > maxChars) {
				// Current line is full, push it and start new line with this word
				wrappedLines.push(currentLine.trim());
				currentLine = word;
			} else {
				currentLine = testLine;
			}
		}

		if (currentLine.length > 0) {
			wrappedLines.push(currentLine.trim());
		}

		return wrappedLines;
	}

	public applyIndentation(text: string, level: number = 0): string {
		const indent = '  '.repeat(level); // 2 spaces per level
		const lines = text.split('\n');
		return lines.map(line => line.length > 0 ? indent + line : line).join('\n');
	}

	public calculateLineBreaks(text: string): BreakPoint[] {
		const breakPoints: BreakPoint[] = [];
		const maxChars = this.getMaxCharsPerLine();

		const lines = text.split('\n');
		let globalLineIndex = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (line.length === 0) {
				globalLineIndex++;
				continue;
			}

			if (line.length <= maxChars) {
				globalLineIndex++;
				continue;
			}

			// Calculate break points for this line
			const words = line.split(' ');
			let currentLength = 0;
			let charIndex = 0;

			for (let j = 0; j < words.length; j++) {
				const word = words[j];
				const wordLength = word.length + (j > 0 ? 1 : 0); // +1 for space

				if (currentLength + wordLength > maxChars && currentLength > 0) {
					// Break here
					breakPoints.push({ line: globalLineIndex, char: charIndex });
					globalLineIndex++;
					currentLength = word.length;
				} else {
					currentLength += wordLength;
				}

				charIndex += wordLength;
			}

			globalLineIndex++;
		}

		return breakPoints;
	}

	public shouldBreakAt(text: string, position: number): boolean {
		if (!this.enabled) {
			return false;
		}

		const maxChars = this.getMaxCharsPerLine();

		// Find current line
		const beforeCursor = text.substring(0, position);
		const lines = beforeCursor.split('\n');
		const currentLine = lines[lines.length - 1];

		return currentLine.length >= maxChars;
	}

	public insertLineBreak(text: string, position: number): string {
		return text.substring(0, position) + '\n' + text.substring(position);
	}

	public getLeftMarginIndent(): string {
		// Calculate indent based on left margin width
		const indentChars = Math.floor(this.margins.left / this.charWidth);
		return ' '.repeat(Math.max(0, indentChars - 2)); // Subtract ruler width estimate
	}

	public dispose(): void {
		// Cleanup if needed
	}
}
