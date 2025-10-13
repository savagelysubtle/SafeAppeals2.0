/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface MarginBounds {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

export class RulerManager {
	private topRulerCanvas: HTMLCanvasElement | null = null;
	private leftMarginCanvas: HTMLCanvasElement | null = null;
	private topRulerCtx: CanvasRenderingContext2D | null = null;
	private leftMarginCtx: CanvasRenderingContext2D | null = null;
	private margins: MarginBounds;
	private scrollX: number = 0;
	private scrollY: number = 0;
	private charWidth: number = 8;
	private lineHeight: number = 20;
	private currentLine: number = 0;

	constructor(margins: MarginBounds) {
		this.margins = margins;
	}

	public initializeTopRuler(canvas: HTMLCanvasElement): void {
		this.topRulerCanvas = canvas;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Cannot get 2D context for top ruler');
		}
		this.topRulerCtx = ctx;
		this.renderTopRuler();
	}

	public initializeLeftMargin(canvas: HTMLCanvasElement): void {
		this.leftMarginCanvas = canvas;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Cannot get 2D context for left margin');
		}
		this.leftMarginCtx = ctx;
		this.renderLeftMargin();
	}

	public updateMargins(left: number, right: number, top: number, bottom: number): void {
		this.margins = { left, right, top, bottom };
		this.renderTopRuler();
		this.renderLeftMargin();
	}

	public getMarginBounds(): MarginBounds {
		return { ...this.margins };
	}

	public setScroll(x: number, y: number): void {
		this.scrollX = x;
		this.scrollY = y;
		this.renderTopRuler();
		this.renderLeftMargin();
	}

	public setCharWidth(width: number): void {
		this.charWidth = width;
		this.renderTopRuler();
	}

	public setLineHeight(height: number): void {
		this.lineHeight = height;
		this.renderLeftMargin();
	}

	public setCurrentLine(line: number): void {
		this.currentLine = line;
		this.renderLeftMargin();
	}

	public renderTopRuler(): void {
		if (!this.topRulerCanvas || !this.topRulerCtx) {
			return;
		}

		const ctx = this.topRulerCtx;
		const canvas = this.topRulerCanvas;

		// Clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Background
		ctx.fillStyle = '#f0f0f0';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Border
		ctx.strokeStyle = '#d0d0d0';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, canvas.height - 0.5);
		ctx.lineTo(canvas.width, canvas.height - 0.5);
		ctx.stroke();

		// Draw ruler marks
		ctx.fillStyle = '#333333';
		ctx.font = '10px sans-serif';
		ctx.textBaseline = 'top';

		const startChar = Math.floor(this.scrollX / this.charWidth);
		const endChar = Math.ceil((this.scrollX + canvas.width) / this.charWidth);

		for (let i = 0; i <= endChar - startChar; i++) {
			const charPos = startChar + i;
			const x = (charPos * this.charWidth) - this.scrollX;

			if (x < 0 || x > canvas.width) {
				continue;
			}

			// Draw major marks every 10 characters
			if (charPos % 10 === 0) {
				ctx.beginPath();
				ctx.moveTo(x, canvas.height - 10);
				ctx.lineTo(x, canvas.height);
				ctx.stroke();

				// Draw number
				ctx.fillText(charPos.toString(), x + 2, 2);
			}
			// Draw minor marks every 5 characters
			else if (charPos % 5 === 0) {
				ctx.beginPath();
				ctx.moveTo(x, canvas.height - 6);
				ctx.lineTo(x, canvas.height);
				ctx.stroke();
			}
		}
	}

	public renderLeftMargin(): void {
		if (!this.leftMarginCanvas || !this.leftMarginCtx) {
			return;
		}

		const ctx = this.leftMarginCtx;
		const canvas = this.leftMarginCanvas;

		// Clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Background
		ctx.fillStyle = '#f8f8f8';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Border
		ctx.strokeStyle = '#d0d0d0';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(canvas.width - 0.5, 0);
		ctx.lineTo(canvas.width - 0.5, canvas.height);
		ctx.stroke();

		// Draw line numbers
		ctx.font = '12px monospace';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'top';

		const startLine = Math.floor(this.scrollY / this.lineHeight);
		const endLine = Math.ceil((this.scrollY + canvas.height) / this.lineHeight);

		for (let i = startLine; i <= endLine; i++) {
			const y = (i * this.lineHeight) - this.scrollY;

			if (y < -this.lineHeight || y > canvas.height) {
				continue;
			}

			// Highlight current line
			if (i === this.currentLine) {
				ctx.fillStyle = '#e0e0e0';
				ctx.fillRect(0, y, canvas.width - 1, this.lineHeight);
			}

			// Draw line number
			ctx.fillStyle = i === this.currentLine ? '#000000' : '#666666';
			ctx.fillText((i + 1).toString(), canvas.width - 8, y + 2);
		}
	}

	public resize(rulerWidth: number, rulerHeight: number, marginWidth: number, marginHeight: number): void {
		if (this.topRulerCanvas) {
			this.topRulerCanvas.width = rulerWidth;
			this.topRulerCanvas.height = rulerHeight;
			this.renderTopRuler();
		}

		if (this.leftMarginCanvas) {
			this.leftMarginCanvas.width = marginWidth;
			this.leftMarginCanvas.height = marginHeight;
			this.renderLeftMargin();
		}
	}

	public dispose(): void {
		this.topRulerCanvas = null;
		this.leftMarginCanvas = null;
		this.topRulerCtx = null;
		this.leftMarginCtx = null;
	}
}
