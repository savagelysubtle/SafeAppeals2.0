/*--------------------------------------------------------------------------------------
 *  PDF Annotation Manager
 *  Handles highlight annotations: rendering, selection, creation from text selection,
 *  and deletion. Extracted from the original pdfViewer.js.
 *--------------------------------------------------------------------------------------*/

export interface BoundingBox {
	page: number;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Annotation {
	id: string;
	pdfUri: string;
	page: number;
	text: string;
	color: string;
	boundingBoxes: BoundingBox[];
	note?: string;
	imageData?: string;
	createdAt: number;
}

const COLOR_MAP: Record<string, string> = {
	yellow: 'rgba(255, 235, 59, 0.4)',
	green: 'rgba(76, 175, 80, 0.4)',
	blue: 'rgba(33, 150, 243, 0.4)',
	pink: 'rgba(233, 30, 99, 0.4)',
	redact: 'rgba(0, 0, 0, 1)',
};

export class AnnotationManager {
	private annotations: Annotation[] = [];
	private selectedAnnotationId: string | null = null;
	private currentHighlightColor = 'yellow';
	private isRedactionMode = false;
	private notePopup: HTMLElement | null = null;

	private getPdfUri: () => string | null;
	private postMessage: (msg: unknown) => void;

	// Callbacks for signature manager to use
	public onSignatureStartDrag?: (e: MouseEvent, el: HTMLElement, id: string) => void;
	public onSignatureStartResize?: (e: MouseEvent, el: HTMLElement, id: string, handle: string) => void;
	public onSignatureContextMenu?: (e: MouseEvent, id: string) => void;

	constructor(
		public readonly getCurrentPage: () => number,
		public readonly getScale: () => number,
		getPdfUri: () => string | null,
		postMessage: (msg: unknown) => void,
	) {
		this.getPdfUri = getPdfUri;
		this.postMessage = postMessage;
	}

	setHighlightColor(color: string) {
		this.currentHighlightColor = color;
	}

	setRedactionMode(active: boolean) {
		this.isRedactionMode = active;
	}

	getRedactionMode(): boolean {
		return this.isRedactionMode;
	}

	setAnnotations(annotations: Annotation[]) {
		this.annotations = annotations;
	}

	addLocalAnnotation(annotation: Annotation) {
		this.annotations.push(annotation);
	}

	getBookmarks(): Array<{ id: string; page: number; text: string }> {
		return this.annotations
			.filter(a => a.color === 'bookmark')
			.map(a => ({ id: a.id, page: a.page, text: a.text }));
	}

	/**
	 * Create a highlight annotation from the current text selection.
	 */
	createHighlightFromSelection(currentPage: number, scale: number) {
		const selection = window.getSelection();
		console.log(`[PDF Viewer] createHighlightFromSelection: selection exists=${!!selection}, isCollapsed=${selection?.isCollapsed}, text="${selection?.toString().substring(0, 50)}"`);

		if (!selection || selection.isCollapsed) {
			console.warn('[PDF Viewer] No active text selection - select text first, then click a highlight button');
			return;
		}

		const selectedText = selection.toString().trim();
		if (!selectedText) {
			console.warn('[PDF Viewer] Selection text is empty');
			return;
		}

		const pdfUri = this.getPdfUri();
		if (!pdfUri) {
			console.warn('[PDF Viewer] No PDF URI available');
			return;
		}

		const boundingBoxes: BoundingBox[] = [];
		for (let i = 0; i < selection.rangeCount; i++) {
			const range = selection.getRangeAt(i);
			const rects = range.getClientRects();
			const renderContainer = document.getElementById('pdf-render-container');
			const containerRect = renderContainer ? renderContainer.getBoundingClientRect() : { left: 0, top: 0 };

			for (let j = 0; j < rects.length; j++) {
				const rect = rects[j];
				boundingBoxes.push({
					page: currentPage,
					x: (rect.left - containerRect.left) / scale,
					y: (rect.top - containerRect.top) / scale,
					width: rect.width / scale,
					height: rect.height / scale,
				});
			}
		}

		console.log(`[PDF Viewer] Highlight: ${boundingBoxes.length} bounding boxes for "${selectedText.substring(0, 30)}..." on page ${currentPage}`);

		if (boundingBoxes.length === 0) {
			console.warn('[PDF Viewer] No bounding boxes computed from selection');
			return;
		}

		this.postMessage({
			type: 'addAnnotation',
			annotation: {
				pdfUri,
				page: currentPage,
				text: selectedText,
				color: this.currentHighlightColor,
				boundingBoxes,
			}
		});

		selection.removeAllRanges();
	}

	/**
	 * Render all annotations for the current page into the highlight layer.
	 */
	renderAnnotations(currentPage: number, scale: number) {
		let highlightLayer = document.getElementById('pdf-highlight-layer');
		if (!highlightLayer) {
			highlightLayer = document.createElement('div');
			highlightLayer.id = 'pdf-highlight-layer';
			highlightLayer.style.position = 'absolute';
			highlightLayer.style.left = '0';
			highlightLayer.style.top = '0';
			highlightLayer.style.pointerEvents = 'none';
			highlightLayer.style.zIndex = '3';
			const renderContainer = document.getElementById('pdf-render-container');
			const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement | null;
			if (renderContainer && canvas) {
				highlightLayer.style.width = canvas.width + 'px';
				highlightLayer.style.height = canvas.height + 'px';
				renderContainer.appendChild(highlightLayer);
			}
		}

		// Update size
		const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement | null;
		if (canvas) {
			highlightLayer.style.width = canvas.width + 'px';
			highlightLayer.style.height = canvas.height + 'px';
		}

		highlightLayer.innerHTML = '';

		// Filter annotations for current page (excluding bookmarks)
		const pageAnnotations = this.annotations.filter(a =>
			a.page === currentPage && a.color !== 'bookmark'
		);

		for (const annotation of pageAnnotations) {
			for (const box of annotation.boundingBoxes) {
				if (box.page !== currentPage) continue;

				if (annotation.imageData && annotation.color === 'signature') {
					this.renderSignatureAnnotation(highlightLayer, annotation, box, scale);
				} else {
					this.renderHighlightAnnotation(highlightLayer, annotation, box, scale);
				}
			}
		}
	}

	private renderSignatureAnnotation(
		layer: HTMLElement,
		annotation: Annotation,
		box: BoundingBox,
		scale: number,
	) {
		const container = document.createElement('div');
		container.className = 'pdf-signature-container';
		container.dataset.annotationId = annotation.id;
		container.style.position = 'absolute';
		container.style.left = (box.x * scale) + 'px';
		container.style.top = (box.y * scale) + 'px';
		container.style.width = (box.width * scale) + 'px';
		container.style.height = (box.height * scale) + 'px';
		container.style.cursor = 'pointer';
		container.style.pointerEvents = 'auto';

		const img = document.createElement('img');
		img.className = 'pdf-signature';
		img.src = annotation.imageData!;
		img.style.width = '100%';
		img.style.height = '100%';
		img.style.borderRadius = '2px';
		img.style.pointerEvents = 'none';
		container.appendChild(img);

		// Add resize handles
		const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
		for (const handle of handles) {
			const handleElement = document.createElement('div');
			handleElement.className = `resize-handle resize-handle-${handle}`;
			handleElement.dataset.handle = handle;
			handleElement.addEventListener('mousedown', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.onSignatureStartResize?.(e, container, annotation.id, handle);
			});
			container.appendChild(handleElement);
		}

		// Hover to select
		container.addEventListener('mouseenter', () => {
			this.selectAnnotation(annotation.id);
		});

		// Drag
		container.addEventListener('mousedown', (e) => {
			if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
			e.preventDefault();
			e.stopPropagation();
			this.onSignatureStartDrag?.(e, container, annotation.id);
		});

		// Right-click
		container.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.selectAnnotation(annotation.id);
			this.onSignatureContextMenu?.(e, annotation.id);
		});

		// Click to select
		container.addEventListener('click', (e) => {
			e.stopPropagation();
			this.selectAnnotation(annotation.id);
		});

		layer.appendChild(container);
	}

	private renderHighlightAnnotation(
		layer: HTMLElement,
		annotation: Annotation,
		box: BoundingBox,
		scale: number,
	) {
		const isRedaction = annotation.color === 'redact';

		const highlight = document.createElement('div');
		highlight.className = 'pdf-highlight' + (isRedaction ? ' pdf-redaction' : '');
		highlight.dataset.annotationId = annotation.id;
		highlight.style.position = 'absolute';
		highlight.style.left = (box.x * scale) + 'px';
		highlight.style.top = (box.y * scale) + 'px';
		highlight.style.width = (box.width * scale) + 'px';
		highlight.style.height = (box.height * scale) + 'px';
		highlight.style.backgroundColor = COLOR_MAP[annotation.color] || COLOR_MAP.yellow;
		if (!isRedaction) {
			highlight.style.mixBlendMode = 'multiply';
		}
		highlight.style.cursor = isRedaction ? 'crosshair' : 'pointer';
		highlight.style.borderRadius = isRedaction ? '0' : '2px';
		highlight.style.pointerEvents = 'auto';

		highlight.addEventListener('click', (e) => {
			e.stopPropagation();
			// Allow selecting redactions so they can be deleted
			this.selectAnnotation(annotation.id);
		});

		// Double-click opens note editor on non-redaction highlights
		if (!isRedaction) {
			highlight.addEventListener('dblclick', (e) => {
				e.stopPropagation();
				this.openNoteEditor(annotation, highlight);
			});
		}

		if (annotation.note && !isRedaction) {
			highlight.title = annotation.note;
			// Show small indicator that a note exists
			const noteIndicator = document.createElement('div');
			noteIndicator.className = 'pdf-note-indicator';
			noteIndicator.textContent = '💬';
			noteIndicator.style.position = 'absolute';
			noteIndicator.style.top = '-10px';
			noteIndicator.style.right = '-4px';
			noteIndicator.style.fontSize = '10px';
			noteIndicator.style.lineHeight = '10px';
			noteIndicator.style.pointerEvents = 'none';
			highlight.appendChild(noteIndicator);
		}

		layer.appendChild(highlight);
	}

	/**
	 * Open an inline popup to add or edit the note on a highlight annotation.
	 */
	private openNoteEditor(annotation: Annotation, anchorEl: HTMLElement) {
		this.closeNoteEditor();

		const popup = document.createElement('div');
		popup.className = 'pdf-note-popup';
		popup.style.position = 'fixed';

		// Position relative to viewport
		const rect = anchorEl.getBoundingClientRect();
		popup.style.left = Math.min(rect.left, window.innerWidth - 280) + 'px';
		popup.style.top = (rect.bottom + 4) + 'px';
		popup.style.zIndex = '10000';
		popup.style.width = '260px';

		const textarea = document.createElement('textarea');
		textarea.className = 'pdf-note-textarea';
		textarea.value = annotation.note || '';
		textarea.placeholder = 'Add a note…';
		textarea.rows = 4;

		const row = document.createElement('div');
		row.style.display = 'flex';
		row.style.gap = '6px';
		row.style.marginTop = '6px';

		const saveBtn = document.createElement('button');
		saveBtn.className = 'pdf-note-save-btn';
		saveBtn.textContent = 'Save';
		saveBtn.addEventListener('click', () => {
			const note = textarea.value.trim();
			this.postMessage({
				type: 'updateAnnotation',
				annotationId: annotation.id,
				updates: { note: note || undefined },
			});
			annotation.note = note || undefined;
			this.closeNoteEditor();
		});

		const cancelBtn = document.createElement('button');
		cancelBtn.className = 'pdf-note-cancel-btn';
		cancelBtn.textContent = 'Cancel';
		cancelBtn.addEventListener('click', () => this.closeNoteEditor());

		row.appendChild(saveBtn);
		row.appendChild(cancelBtn);
		popup.appendChild(textarea);
		popup.appendChild(row);
		document.body.appendChild(popup);
		this.notePopup = popup;
		textarea.focus();

		// Close on outside click
		const onOutside = (e: MouseEvent) => {
			if (!popup.contains(e.target as Node)) {
				this.closeNoteEditor();
				document.removeEventListener('mousedown', onOutside);
			}
		};
		setTimeout(() => document.addEventListener('mousedown', onOutside), 100);
	}

	private closeNoteEditor() {
		if (this.notePopup) {
			this.notePopup.remove();
			this.notePopup = null;
		}
	}

	selectAnnotation(annotationId: string) {
		this.deselectAll();
		this.selectedAnnotationId = annotationId;

		document.querySelectorAll(
			`.pdf-highlight[data-annotation-id="${annotationId}"], .pdf-signature-container[data-annotation-id="${annotationId}"]`
		).forEach(el => {
			el.classList.add('selected');
			(el as HTMLElement).style.outline = '2px solid var(--vscode-focusBorder, #007acc)';
		});
	}

	deselectAll() {
		this.selectedAnnotationId = null;
		document.querySelectorAll('.pdf-highlight.selected, .pdf-signature-container.selected').forEach(el => {
			el.classList.remove('selected');
			(el as HTMLElement).style.outline = 'none';
		});
	}

	deleteSelectedAnnotation() {
		if (this.selectedAnnotationId) {
			this.postMessage({
				type: 'deleteAnnotation',
				annotationId: this.selectedAnnotationId,
			});
			this.selectedAnnotationId = null;
		}
	}

	/**
	 * Update annotation bounding boxes (used by signature drag/resize).
	 */
	updateAnnotationBoundingBoxes(annotationId: string, newBoxes: BoundingBox[]) {
		const annotation = this.annotations.find(a => a.id === annotationId);
		if (annotation) {
			annotation.boundingBoxes = newBoxes;
			this.postMessage({
				type: 'updateAnnotation',
				annotationId,
				updates: { boundingBoxes: newBoxes },
			});
		}
	}

	getAnnotation(id: string): Annotation | undefined {
		return this.annotations.find(a => a.id === id);
	}

	/**
	 * Create a redaction annotation from a drag rectangle on the canvas.
	 * @param x - Left in canvas pixels
	 * @param y - Top in canvas pixels
	 * @param w - Width in canvas pixels
	 * @param h - Height in canvas pixels
	 * @param currentPage - Current page number (1-indexed)
	 * @param scale - Current zoom scale
	 */
	createRedactionFromDrag(x: number, y: number, w: number, h: number, currentPage: number, scale: number) {
		const pdfUri = this.getPdfUri();
		if (!pdfUri || w <= 2 || h <= 2) return;

		this.postMessage({
			type: 'addAnnotation',
			annotation: {
				pdfUri,
				page: currentPage,
				text: '[REDACTED]',
				color: 'redact',
				boundingBoxes: [{
					page: currentPage,
					x: x / scale,
					y: y / scale,
					width: w / scale,
					height: h / scale,
				}],
			},
		});
	}
}
