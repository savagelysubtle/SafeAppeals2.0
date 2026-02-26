/*--------------------------------------------------------------------------------------
 *  PDF Canvas Renderer
 *  Handles painting WASM-rendered ImageData to the canvas and building the text layer
 *  overlay from WASM text extraction data.
 *--------------------------------------------------------------------------------------*/

export interface TextBlock {
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
	font_size: number;
}

export class PdfCanvasRenderer {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private textLayer: HTMLElement;
	private renderContainer: HTMLElement;
	private highlightLayer: HTMLElement | null = null;

	constructor(canvas: HTMLCanvasElement, textLayer: HTMLElement, renderContainer: HTMLElement) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d')!;
		this.textLayer = textLayer;
		this.renderContainer = renderContainer;
	}

	/**
	 * Paint an ImageData (from WASM) onto the canvas at the given pixel dimensions.
	 */
	renderImageData(imageData: ImageData, width: number, height: number) {
		this.canvas.width = width;
		this.canvas.height = height;
		this.ctx.putImageData(imageData, 0, 0);

		// Update highlight layer size
		this.ensureHighlightLayer();
		if (this.highlightLayer) {
			this.highlightLayer.style.width = width + 'px';
			this.highlightLayer.style.height = height + 'px';
		}
	}

	/**
	 * Build the text layer overlay from WASM text extraction data.
	 * Creates positioned <span> elements over the canvas for text selection.
	 *
	 * @param blocks - Array of text blocks with positions in PDF points
	 * @param pageWidth - Page width in PDF points
	 * @param pageHeight - Page height in PDF points
	 * @param scale - Current zoom scale
	 */
	renderTextLayer(
		blocks: TextBlock[],
		pageWidth: number,
		pageHeight: number,
		scale: number
	) {
		// Clear previous text layer
		this.textLayer.innerHTML = '';

		// Calculate the ratio between canvas pixels and PDF points
		const canvasWidth = this.canvas.width;
		const canvasHeight = this.canvas.height;
		const scaleX = canvasWidth / pageWidth;
		const scaleY = canvasHeight / pageHeight;

		// Set text layer dimensions to match canvas
		this.textLayer.style.width = canvasWidth + 'px';
		this.textLayer.style.height = canvasHeight + 'px';
		this.textLayer.style.setProperty('--scale-factor', scale.toString());

		let spanCount = 0;
		for (const block of blocks) {
			if (!block.text.trim()) continue;

			const span = document.createElement('span');
			span.textContent = block.text;

			const left = block.x * scaleX;
			const top = block.y * scaleY;
			const width = block.width * scaleX;
			const height = block.height * scaleY;
			const fontSize = block.font_size * scaleY;

			span.style.position = 'absolute';
			span.style.left = left + 'px';
			span.style.top = top + 'px';
			span.style.width = width + 'px';
			span.style.height = height + 'px';
			span.style.fontSize = fontSize + 'px';
			span.style.lineHeight = fontSize + 'px';
			span.style.color = 'transparent';
			span.style.whiteSpace = 'pre';
			span.style.overflow = 'hidden';

			this.textLayer.appendChild(span);
			spanCount++;
		}

		console.log(`[PDF Viewer] Text layer: ${spanCount} spans from ${blocks.length} blocks`);
	}

	/**
	 * Get or create the highlight layer (sits above text layer for annotations).
	 */
	ensureHighlightLayer(): HTMLElement {
		if (!this.highlightLayer) {
			this.highlightLayer = document.createElement('div');
			this.highlightLayer.id = 'pdf-highlight-layer';
			this.highlightLayer.style.position = 'absolute';
			this.highlightLayer.style.left = '0';
			this.highlightLayer.style.top = '0';
			this.highlightLayer.style.width = this.canvas.width + 'px';
			this.highlightLayer.style.height = this.canvas.height + 'px';
			this.highlightLayer.style.pointerEvents = 'none';
			this.highlightLayer.style.zIndex = '3';
			this.renderContainer.appendChild(this.highlightLayer);
		}
		return this.highlightLayer;
	}

	/**
	 * Get the highlight layer element (for annotations to render into).
	 */
	getHighlightLayer(): HTMLElement {
		return this.ensureHighlightLayer();
	}

	/**
	 * Get the render container element.
	 */
	getRenderContainer(): HTMLElement {
		return this.renderContainer;
	}

	/**
	 * Get current canvas dimensions.
	 */
	getCanvasDimensions(): { width: number; height: number } {
		return { width: this.canvas.width, height: this.canvas.height };
	}

	/**
	 * Clear the canvas and text layer.
	 */
	clear() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.textLayer.innerHTML = '';
		if (this.highlightLayer) {
			this.highlightLayer.innerHTML = '';
		}
	}
}
