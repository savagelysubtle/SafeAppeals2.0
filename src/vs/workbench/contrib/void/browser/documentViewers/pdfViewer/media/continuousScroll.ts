/*--------------------------------------------------------------------------------------
 *  PDF Viewer — Continuous Scroll Mode
 *  Renders all pages stacked vertically in a scrollable container with lazy rendering
 *  via IntersectionObserver. Each page gets its own canvas + text layer.
 *--------------------------------------------------------------------------------------*/

export interface TextBlock {
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
	font_size: number;
}

export class ContinuousScrollManager {
	private pageWrappers: Map<number, { wrapper: HTMLElement; canvas: HTMLCanvasElement; textLayer: HTMLElement }> = new Map();
	private renderedPages: Set<number> = new Set();
	private renderQueue: number[] = [];
	private isProcessingQueue = false;
	private observer: IntersectionObserver | null = null;

	constructor(
		private readonly scrollContainer: HTMLElement,
		private readonly pageCount: number,
		private readonly pageDimensions: Array<{ width: number; height: number }>,
		private readonly scale: number,
		private readonly renderPageImageData: (page: number) => ImageData,
		private readonly getTextBlocks: (page: number) => TextBlock[],
		private readonly onPageChange: (page: number) => void,
	) {
		this.buildLayout();
		this.setupObserver();
	}

	private buildLayout() {
		this.scrollContainer.innerHTML = '';
		const dpi = 96;

		for (let i = 1; i <= this.pageCount; i++) {
			const dims = this.pageDimensions[i - 1];
			const pw = Math.round(dims.width * this.scale * dpi / 72);
			const ph = Math.round(dims.height * this.scale * dpi / 72);

			const wrapper = document.createElement('div');
			wrapper.className = 'continuous-page-wrapper';
			wrapper.dataset.page = i.toString();
			wrapper.style.width = pw + 'px';
			wrapper.style.height = ph + 'px';
			wrapper.style.position = 'relative';
			wrapper.style.margin = '0 auto 20px';
			wrapper.style.backgroundColor = 'white';
			wrapper.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
			wrapper.style.flexShrink = '0';

			const canvas = document.createElement('canvas');
			canvas.width = pw;
			canvas.height = ph;
			// Explicit CSS dimensions prevent the canvas from collapsing to its default 300×150 intrinsic size
			canvas.style.display = 'block';
			canvas.style.width = pw + 'px';
			canvas.style.height = ph + 'px';

			const textLayer = document.createElement('div');
			textLayer.className = 'pdf-text-layer';
			textLayer.style.position = 'absolute';
			textLayer.style.left = '0';
			textLayer.style.top = '0';
			textLayer.style.width = pw + 'px';
			textLayer.style.height = ph + 'px';
			textLayer.style.userSelect = 'text';
			textLayer.style.pointerEvents = 'auto';
			textLayer.addEventListener('mousemove', (e) => e.stopPropagation());

			wrapper.appendChild(canvas);
			wrapper.appendChild(textLayer);
			this.scrollContainer.appendChild(wrapper);
			this.pageWrappers.set(i, { wrapper, canvas, textLayer });
		}
	}

	private setupObserver() {
		this.observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					const page = parseInt((entry.target as HTMLElement).dataset.page || '0');
					if (page > 0) {
						this.onPageChange(page);
						if (!this.renderedPages.has(page)) {
							this.enqueueRender(page);
						}
					}
				}
			}
		}, {
			root: this.scrollContainer,
			threshold: 0.05,
		});

		for (const [, { wrapper }] of this.pageWrappers) {
			this.observer.observe(wrapper);
		}
	}

	private enqueueRender(page: number) {
		if (!this.renderQueue.includes(page)) {
			this.renderQueue.push(page);
		}
		this.processQueue();
	}

	private processQueue() {
		if (this.isProcessingQueue) return;
		this.isProcessingQueue = true;

		const process = () => {
			const page = this.renderQueue.shift();
			if (page === undefined) {
				this.isProcessingQueue = false;
				return;
			}
			if (!this.renderedPages.has(page)) {
				this.renderPageOnCanvas(page);
			}
			// Yield to browser between renders
			setTimeout(process, 0);
		};

		setTimeout(process, 0);
	}

	private renderPageOnCanvas(page: number) {
		const parts = this.pageWrappers.get(page);
		if (!parts) return;
		const { canvas, textLayer } = parts;

		try {
			const rawImageData = this.renderPageImageData(page);
			// Copy pixel data out of WASM memory immediately — pdfium reuses its bitmap
			// buffer across renders, so without a copy subsequent pages overwrite earlier ones.
			const imageData = new ImageData(
				new Uint8ClampedArray(rawImageData.data),
				rawImageData.width,
				rawImageData.height,
			);
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.putImageData(imageData, 0, 0);
			}
			this.renderedPages.add(page);

			// Build text layer
			const dims = this.pageDimensions[page - 1];
			const textBlocks = this.getTextBlocks(page);
			textLayer.innerHTML = '';

			const scaleX = canvas.width / dims.width;
			const scaleY = canvas.height / dims.height;

			for (const block of textBlocks) {
				if (!block.text.trim()) continue;
				const span = document.createElement('span');
				span.textContent = block.text;
				span.style.position = 'absolute';
				span.style.left = (block.x * scaleX) + 'px';
				span.style.top = (block.y * scaleY) + 'px';
				span.style.width = (block.width * scaleX) + 'px';
				span.style.height = (block.height * scaleY) + 'px';
				span.style.fontSize = (block.font_size * scaleY) + 'px';
				span.style.lineHeight = (block.font_size * scaleY) + 'px';
				span.style.color = 'transparent';
				span.style.whiteSpace = 'pre';
				span.style.overflow = 'hidden';
				textLayer.appendChild(span);
			}
		} catch (e) {
			console.error(`[ContinuousScroll] Failed to render page ${page}:`, e);
		}
	}

	scrollToPage(page: number) {
		const parts = this.pageWrappers.get(page);
		if (parts) {
			parts.wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	destroy() {
		this.observer?.disconnect();
		this.observer = null;
		this.scrollContainer.innerHTML = '';
		this.pageWrappers.clear();
		this.renderedPages.clear();
		this.renderQueue.length = 0;
	}
}
