/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface TextCanvasConfig {
	fontSize: number;
	fontFamily: string;
	lineHeight: number;
	leftMargin: number;
	rightMargin: number;
	topMargin: number;
	bottomMargin: number;
}

export interface RenderPosition {
	x: number;
	y: number;
	line: number;
	char: number;
}

export class TextCanvas {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private config: TextCanvasConfig;
	private lines: string[] = [];
	private cursorVisible: boolean = true;
	private cursorInterval: number | null = null;
	private selectionStart: RenderPosition | null = null;
	private selectionEnd: RenderPosition | null = null;
	private scrollX: number = 0;
	private scrollY: number = 0;
	private charWidth: number = 0;
	private lineHeightPx: number = 0;

	constructor(canvas: HTMLCanvasElement, config: TextCanvasConfig) {
		this.canvas = canvas;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Canvas 2D context not supported');
		}
		this.ctx = ctx;
		this.config = config;
		this.measureFont();
		this.startCursorBlink();
	}

	private measureFont(): void {
		this.ctx.font = `${this.config.fontSize}px ${this.config.fontFamily}`;
		// Measure average character width using a sample
		const sample = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const metrics = this.ctx.measureText(sample);
		this.charWidth = metrics.width / sample.length;
		this.lineHeightPx = this.config.lineHeight;
	}

	public updateConfig(config: Partial<TextCanvasConfig>): void {
		this.config = { ...this.config, ...config };
		this.measureFont();
	}

	public resize(width: number, height: number): void {
		this.canvas.width = width;
		this.canvas.height = height;
		this.render();
	}

	public syncWithEditor(text: string): void {
		this.lines = text.split('\n');
		this.render();
	}

	public setScroll(x: number, y: number): void {
		this.scrollX = x;
		this.scrollY = y;
		this.render();
	}

	public setCursor(_line: number, _char: number): void {
		// Cursor position tracking for rendering
		this.render();
	}

	public setSelection(startLine: number, startChar: number, endLine: number, endChar: number): void {
		this.selectionStart = { x: 0, y: 0, line: startLine, char: startChar };
		this.selectionEnd = { x: 0, y: 0, line: endLine, char: endChar };
		this.render();
	}

	public clearSelection(): void {
		this.selectionStart = null;
		this.selectionEnd = null;
		this.render();
	}

	private startCursorBlink(): void {
		if (this.cursorInterval) {
			clearInterval(this.cursorInterval);
		}
		this.cursorInterval = window.setInterval(() => {
			this.cursorVisible = !this.cursorVisible;
			this.render();
		}, 500);
	}

	public stopCursorBlink(): void {
		if (this.cursorInterval) {
			clearInterval(this.cursorInterval);
			this.cursorInterval = null;
		}
	}

	public render(): void {
		// Clear canvas
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// Set font
		this.ctx.font = `${this.config.fontSize}px ${this.config.fontFamily}`;
		this.ctx.fillStyle = '#000000';
		this.ctx.textBaseline = 'top';

		// Calculate visible range
		const startLine = Math.floor(this.scrollY / this.lineHeightPx);
		const endLine = Math.ceil((this.scrollY + this.canvas.height) / this.lineHeightPx);

		// Render visible lines
		for (let i = startLine; i < Math.min(endLine, this.lines.length); i++) {
			const line = this.lines[i];
			const y = this.config.topMargin + (i * this.lineHeightPx) - this.scrollY;

			if (y + this.lineHeightPx < 0 || y > this.canvas.height) {
				continue;
			}

			// Render selection highlight if this line is selected
			if (this.selectionStart && this.selectionEnd) {
				this.renderSelectionForLine(i, y);
			}

			// Render text
			this.renderText(line, y);
		}

		// Render cursor
		this.renderCursor();
	}

	private renderText(line: string, y: number): void {
		const x = this.config.leftMargin - this.scrollX;

		// Break line at right margin if needed
		const maxWidth = this.canvas.width - this.config.leftMargin - this.config.rightMargin;

		if (this.ctx.measureText(line).width <= maxWidth) {
			this.ctx.fillText(line, x, y);
		} else {
			// Render with wrapping
			let currentLine = '';
			let currentX = x;

			for (let i = 0; i < line.length; i++) {
				const char = line[i];
				const testLine = currentLine + char;
				const metrics = this.ctx.measureText(testLine);

				if (metrics.width > maxWidth && currentLine.length > 0) {
					this.ctx.fillText(currentLine, currentX, y);
					currentLine = char;
					currentX = x;
				} else {
					currentLine = testLine;
				}
			}

			if (currentLine.length > 0) {
				this.ctx.fillText(currentLine, currentX, y);
			}
		}
	}

	private renderCursor(): void {
		if (!this.cursorVisible) {
			return;
		}

		// Get cursor position from contenteditable
		// For now, render at start of first visible line
		const cursorX = this.config.leftMargin - this.scrollX;
		const cursorY = this.config.topMargin - this.scrollY;

		this.ctx.fillStyle = '#000000';
		this.ctx.fillRect(cursorX, cursorY, 2, this.lineHeightPx);
	}

	private renderSelectionForLine(lineIndex: number, y: number): void {
		if (!this.selectionStart || !this.selectionEnd) {
			return;
		}

		const start = this.selectionStart;
		const end = this.selectionEnd;

		// Check if this line is within selection
		if (lineIndex < start.line || lineIndex > end.line) {
			return;
		}

		const line = this.lines[lineIndex];
		let startChar = 0;
		let endChar = line.length;

		if (lineIndex === start.line) {
			startChar = start.char;
		}
		if (lineIndex === end.line) {
			endChar = end.char;
		}

		// Calculate selection bounds
		const beforeText = line.substring(0, startChar);
		const selectedText = line.substring(startChar, endChar);

		const startX = this.config.leftMargin + this.ctx.measureText(beforeText).width - this.scrollX;
		const width = this.ctx.measureText(selectedText).width;

		// Draw selection highlight
		this.ctx.fillStyle = 'rgba(0, 120, 215, 0.3)';
		this.ctx.fillRect(startX, y, width, this.lineHeightPx);
	}

	public calculateLineBreaks(text: string): string[] {
		const lines: string[] = [];
		const maxWidth = this.canvas.width - this.config.leftMargin - this.config.rightMargin;

		const paragraphs = text.split('\n');

		for (const paragraph of paragraphs) {
			if (paragraph.length === 0) {
				lines.push('');
				continue;
			}

			const words = paragraph.split(' ');
			let currentLine = '';

			for (const word of words) {
				const testLine = currentLine.length === 0 ? word : currentLine + ' ' + word;
				const metrics = this.ctx.measureText(testLine);

				if (metrics.width > maxWidth && currentLine.length > 0) {
					lines.push(currentLine);
					currentLine = word;
				} else {
					currentLine = testLine;
				}
			}

			if (currentLine.length > 0) {
				lines.push(currentLine);
			}
		}

		return lines;
	}

	public getCharWidth(): number {
		return this.charWidth;
	}

	public getLineHeight(): number {
		return this.lineHeightPx;
	}

	public dispose(): void {
		this.stopCursorBlink();
	}
}
