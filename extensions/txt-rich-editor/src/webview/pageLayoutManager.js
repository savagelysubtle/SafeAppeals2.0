/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Page Layout Manager for webview
 * Handles canvas rendering, rulers, margins, and zoom functionality
 */
class PageLayoutManager {
	constructor() {
		this.canvas = null;
		this.rulerCanvas = null;
		this.marginCanvas = null;
		this.editor = null;
		this.zoom = 1.0;
		this.margins = { top: 96, right: 96, bottom: 96, left: 96 }; // 1 inch at 96 DPI
		this.pageSize = { width: 816, height: 1056 }; // Letter size
		this.orientation = 'portrait';
		this.isLocked = false;
		this.dragHandle = null;
		this.isDragging = false;
		this.dragStartX = 0;
		this.dragStartY = 0;
		this.animationFrame = null;
	}

	/**
	 * Initialize the page layout manager
	 */
	initialize(canvas, rulerCanvas, marginCanvas, editor) {
		this.canvas = canvas;
		this.rulerCanvas = rulerCanvas;
		this.marginCanvas = marginCanvas;
		this.editor = editor;

		this.setupEventListeners();
		this.setupDragHandles();
		this.updateLayout();
		this.drawRulers();
		this.drawMargins();
	}

	/**
	 * Setup event listeners
	 */
	setupEventListeners() {
		// Window resize
		window.addEventListener('resize', () => {
			this.updateLayout();
			this.drawRulers();
			this.drawMargins();
		});

		// Zoom controls
		document.addEventListener('keydown', (e) => {
			if (e.ctrlKey || e.metaKey) {
				if (e.key === '=' || e.key === '+') {
					e.preventDefault();
					this.zoomIn();
				} else if (e.key === '-') {
					e.preventDefault();
					this.zoomOut();
				} else if (e.key === '0') {
					e.preventDefault();
					this.resetZoom();
				}
			}
		});

		// Mouse wheel zoom
		this.canvas.addEventListener('wheel', (e) => {
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();
				const delta = e.deltaY > 0 ? -0.1 : 0.1;
				this.setZoom(this.zoom + delta);
			}
		});
	}

	/**
	 * Setup drag handles for margins
	 */
	setupDragHandles() {
		const leftHandle = document.getElementById('leftMarginHandle');
		const rightHandle = document.getElementById('rightMarginHandle');

		if (leftHandle) {
			leftHandle.addEventListener('mousedown', (e) => this.startDrag(e, 'left'));
		}

		if (rightHandle) {
			rightHandle.addEventListener('mousedown', (e) => this.startDrag(e, 'right'));
		}

		// Global mouse events
		document.addEventListener('mousemove', (e) => this.handleDrag(e));
		document.addEventListener('mouseup', () => this.endDrag());
	}

	/**
	 * Start dragging a margin handle
	 */
	startDrag(event, handle) {
		if (this.isLocked) return;

		event.preventDefault();
		this.isDragging = true;
		this.dragHandle = handle;
		this.dragStartX = event.clientX;
		this.dragStartY = event.clientY;

		document.body.style.cursor = 'ew-resize';
		document.body.style.userSelect = 'none';
	}

	/**
	 * Handle drag movement
	 */
	handleDrag(event) {
		if (!this.isDragging || !this.dragHandle) return;

		const deltaX = event.clientX - this.dragStartX;
		const deltaY = event.clientY - this.dragStartY;

		if (this.dragHandle === 'left') {
			this.margins.left = Math.max(0, Math.min(this.margins.left + deltaX, this.pageSize.width - this.margins.right - 100));
		} else if (this.dragHandle === 'right') {
			this.margins.right = Math.max(0, Math.min(this.margins.right - deltaX, this.pageSize.width - this.margins.left - 100));
		}

		this.dragStartX = event.clientX;
		this.dragStartY = event.clientY;

		this.updateLayout();
		this.drawMargins();
	}

	/**
	 * End dragging
	 */
	endDrag() {
		if (!this.isDragging) return;

		this.isDragging = false;
		this.dragHandle = null;

		document.body.style.cursor = '';
		document.body.style.userSelect = '';

		// Emit layout changed event
		this.emitLayoutChanged();
	}

	/**
	 * Update layout based on current settings
	 */
	updateLayout() {
		if (!this.editor) return;

		const contentArea = this.getContentArea();

		// Update editor positioning
		this.editor.style.marginLeft = `${contentArea.x}px`;
		this.editor.style.marginRight = `${contentArea.width}px`;
		this.editor.style.marginTop = `${contentArea.y}px`;
		this.editor.style.marginBottom = `${contentArea.height}px`;

		// Update zoom
		this.editor.style.transform = `scale(${this.zoom})`;
		this.editor.style.transformOrigin = 'top left';

		// Update canvas size
		if (this.canvas) {
			this.canvas.style.width = `${this.pageSize.width * this.zoom}px`;
			this.canvas.style.height = `${this.pageSize.height * this.zoom}px`;
		}
	}

	/**
	 * Get content area dimensions
	 */
	getContentArea() {
		return {
			x: this.margins.left * this.zoom,
			y: this.margins.top * this.zoom,
			width: (this.pageSize.width - this.margins.left - this.margins.right) * this.zoom,
			height: (this.pageSize.height - this.margins.top - this.margins.bottom) * this.zoom
		};
	}

	/**
	 * Draw horizontal ruler
	 */
	drawRulers() {
		if (!this.rulerCanvas) return;

		const ctx = this.rulerCanvas.getContext('2d');
		if (!ctx) return;

		const rect = this.rulerCanvas.getBoundingClientRect();
		const width = rect.width;
		const height = rect.height;

		// Set canvas dimensions
		this.rulerCanvas.width = width;
		this.rulerCanvas.height = height;

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// Background
		ctx.fillStyle = '#fafafa';
		ctx.fillRect(0, 0, width, height);

		// Draw ruler marks
		ctx.strokeStyle = '#999';
		ctx.lineWidth = 1;
		ctx.font = '10px Arial';
		ctx.fillStyle = '#333';

		// Mark every inch
		for (let i = 0; i < width; i += 96 * this.zoom) {
			const inches = Math.floor(i / (96 * this.zoom));
			const markHeight = inches % 2 === 0 ? 12 : 8;

			ctx.beginPath();
			ctx.moveTo(i, height - markHeight);
			ctx.lineTo(i, height);
			ctx.stroke();

			// Draw inch labels
			if (inches % 2 === 0 && inches > 0) {
				ctx.fillText(inches.toString(), i + 2, height - 2);
			}
		}

		// Draw half-inch marks
		ctx.strokeStyle = '#ccc';
		ctx.lineWidth = 0.5;
		for (let i = 48 * this.zoom; i < width; i += 96 * this.zoom) {
			ctx.beginPath();
			ctx.moveTo(i, height - 6);
			ctx.lineTo(i, height);
			ctx.stroke();
		}
	}

	/**
	 * Draw vertical ruler
	 */
	drawMargins() {
		if (!this.marginCanvas) return;

		const ctx = this.marginCanvas.getContext('2d');
		if (!ctx) return;

		const rect = this.marginCanvas.getBoundingClientRect();
		const width = rect.width;
		const height = rect.height;

		// Set canvas dimensions
		this.marginCanvas.width = width;
		this.marginCanvas.height = height;

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// Background
		ctx.fillStyle = '#fafafa';
		ctx.fillRect(0, 0, width, height);

		// Draw ruler marks
		ctx.strokeStyle = '#999';
		ctx.lineWidth = 1;
		ctx.font = '10px Arial';
		ctx.fillStyle = '#333';

		// Mark every inch
		for (let i = 0; i < height; i += 96 * this.zoom) {
			const inches = Math.floor(i / (96 * this.zoom));
			const markWidth = inches % 2 === 0 ? 12 : 8;

			ctx.beginPath();
			ctx.moveTo(width - markWidth, i);
			ctx.lineTo(width, i);
			ctx.stroke();

			// Draw inch labels
			if (inches % 2 === 0 && inches > 0) {
				ctx.save();
				ctx.translate(width - 2, i + 2);
				ctx.rotate(-Math.PI / 2);
				ctx.fillText(inches.toString(), 0, 0);
				ctx.restore();
			}
		}

		// Draw half-inch marks
		ctx.strokeStyle = '#ccc';
		ctx.lineWidth = 0.5;
		for (let i = 48 * this.zoom; i < height; i += 96 * this.zoom) {
			ctx.beginPath();
			ctx.moveTo(width - 6, i);
			ctx.lineTo(width, i);
			ctx.stroke();
		}
	}

	/**
	 * Draw page breaks
	 */
	drawPageBreaks() {
		if (!this.canvas) return;

		const ctx = this.canvas.getContext('2d');
		if (!ctx) return;

		const pageHeight = this.pageSize.height * this.zoom;
		const pageBreaks = this.getPageBreaks();

		ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
		ctx.lineWidth = 2;
		ctx.setLineDash([5, 5]);

		pageBreaks.forEach(breakY => {
			ctx.beginPath();
			ctx.moveTo(0, breakY);
			ctx.lineTo(this.pageSize.width * this.zoom, breakY);
			ctx.stroke();
		});

		ctx.setLineDash([]);
	}

	/**
	 * Get page break positions
	 */
	getPageBreaks() {
		const breaks = [];
		const pageHeight = this.pageSize.height * this.zoom;
		let currentY = pageHeight;

		// Calculate where page breaks would occur
		while (currentY < 10000) { // Arbitrary limit
			breaks.push(currentY);
			currentY += pageHeight;
		}

		return breaks;
	}

	/**
	 * Set zoom level
	 */
	setZoom(zoom) {
		this.zoom = Math.max(0.25, Math.min(3.0, zoom));
		this.updateLayout();
		this.drawRulers();
		this.drawMargins();
		this.emitLayoutChanged();
	}

	/**
	 * Zoom in
	 */
	zoomIn() {
		this.setZoom(this.zoom + 0.1);
	}

	/**
	 * Zoom out
	 */
	zoomOut() {
		this.setZoom(this.zoom - 0.1);
	}

	/**
	 * Reset zoom
	 */
	resetZoom() {
		this.setZoom(1.0);
	}

	/**
	 * Set page size
	 */
	setPageSize(size) {
		this.pageSize = { ...size };
		this.updateLayout();
		this.drawRulers();
		this.drawMargins();
		this.emitLayoutChanged();
	}

	/**
	 * Set orientation
	 */
	setOrientation(orientation) {
		this.orientation = orientation;

		// Swap dimensions for landscape
		if (orientation === 'landscape') {
			this.pageSize = {
				width: this.pageSize.height,
				height: this.pageSize.width
			};
		}

		this.updateLayout();
		this.drawRulers();
		this.drawMargins();
		this.emitLayoutChanged();
	}

	/**
	 * Set margins
	 */
	setMargins(margins) {
		this.margins = { ...margins };
		this.updateLayout();
		this.drawMargins();
		this.emitLayoutChanged();
	}

	/**
	 * Lock margins
	 */
	lockMargins(locked) {
		this.isLocked = locked;

		// Hide/show drag handles
		const leftHandle = document.getElementById('leftMarginHandle');
		const rightHandle = document.getElementById('rightMarginHandle');

		if (leftHandle) leftHandle.style.display = locked ? 'none' : 'flex';
		if (rightHandle) rightHandle.style.display = locked ? 'none' : 'flex';

		this.emitLayoutChanged();
	}

	/**
	 * Get current layout
	 */
	getLayout() {
		return {
			margins: { ...this.margins },
			orientation: this.orientation,
			size: { ...this.pageSize },
			zoom: this.zoom
		};
	}

	/**
	 * Emit layout changed event
	 */
	emitLayoutChanged() {
		const event = new CustomEvent('page-layout-changed', {
			detail: this.getLayout()
		});
		window.dispatchEvent(event);
	}

	/**
	 * Dispose the page layout manager
	 */
	dispose() {
		if (this.animationFrame) {
			cancelAnimationFrame(this.animationFrame);
		}
	}
}

// Export for use in webview
window.PageLayoutManager = PageLayoutManager;
