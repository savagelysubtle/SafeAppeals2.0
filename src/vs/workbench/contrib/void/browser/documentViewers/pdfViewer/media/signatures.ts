/*--------------------------------------------------------------------------------------
 *  PDF Signature Manager
 *  Handles the signature modal (draw/type modes), placement on PDF, drag, resize,
 *  and context menu. Extracted from the original pdfViewer.js.
 *--------------------------------------------------------------------------------------*/

import { AnnotationManager } from './annotations.js';

export class SignatureManager {
	// Canvas state
	private signatureCanvas: HTMLCanvasElement | null = null;
	private signatureCtx: CanvasRenderingContext2D | null = null;
	private signatureTextCanvas: HTMLCanvasElement | null = null;
	private signatureTextCtx: CanvasRenderingContext2D | null = null;

	// Drawing state
	private isDrawing = false;
	private lastX = 0;
	private lastY = 0;
	private signatureImageData: string | null = null;
	private signatureMode: 'draw' | 'type' = 'draw';
	private signatureText = '';
	private signatureFont = 'signature1';
	private signatureSize = 40;

	// Placement state
	private isPlacementMode = false;
	private placeSignatureHandler: ((e: MouseEvent) => void) | null = null;

	// Drag state
	private isDraggingSignature = false;
	private draggedSignatureElement: HTMLElement | null = null;
	private draggedAnnotationId: string | null = null;
	private dragOffsetX = 0;
	private dragOffsetY = 0;

	// Resize state
	private isResizingSignature = false;
	private resizedSignatureElement: HTMLElement | null = null;
	private resizedAnnotationId: string | null = null;
	private resizeStartX = 0;
	private resizeStartY = 0;
	private resizeHandle: string | null = null;
	private originalBounds: { x: number; y: number; width: number; height: number } | null = null;

	// Context menu state
	private contextMenuElement: HTMLElement | null = null;

	// Saved signatures
	private savedSignatures: Array<{ id: string; dataURL: string; createdAt: number }> = [];

	// Dependencies
	private getCurrentPage: () => number;
	private getScale: () => number;
	private getPdfUri: () => string | null;
	private postMessage: (msg: unknown) => void;
	private annotationManager: AnnotationManager;

	constructor(
		getCurrentPage: () => number,
		getScale: () => number,
		getPdfUri: () => string | null,
		postMessage: (msg: unknown) => void,
		annotationManager: AnnotationManager,
	) {
		this.getCurrentPage = getCurrentPage;
		this.getScale = getScale;
		this.getPdfUri = getPdfUri;
		this.postMessage = postMessage;
		this.annotationManager = annotationManager;

		// Wire up annotation callbacks
		this.annotationManager.onSignatureStartDrag = (e, el, id) => this.startDragging(e, el, id);
		this.annotationManager.onSignatureStartResize = (e, el, id, handle) => this.startResizing(e, el, id, handle);
		this.annotationManager.onSignatureContextMenu = (e, id) => this.showContextMenu(e, id);

		this.setupModalHandlers();
	}

	// ==================== MODAL ====================

	private setupModalHandlers() {
		const closeBtn = document.getElementById('close-signature-modal');
		const cancelBtn = document.getElementById('cancel-signature');
		const clearBtn = document.getElementById('clear-signature');
		const saveBtn = document.getElementById('save-signature');
		const doneBtn = document.getElementById('done-signature');
		const drawModeBtn = document.getElementById('draw-mode-btn');
		const typeModeBtn = document.getElementById('type-mode-btn');
		const textInput = document.getElementById('signature-text-input') as HTMLInputElement | null;
		const fontSelect = document.getElementById('signature-font-select') as HTMLSelectElement | null;
		const sizeSlider = document.getElementById('signature-size-slider') as HTMLInputElement | null;
		const sizeValue = document.getElementById('signature-size-value');

		closeBtn?.addEventListener('click', () => this.hideModal());
		cancelBtn?.addEventListener('click', () => this.hideModal());
		clearBtn?.addEventListener('click', () => this.clearCanvas());
		saveBtn?.addEventListener('click', () => this.saveSignature());
		doneBtn?.addEventListener('click', () => this.doneSignature());

		drawModeBtn?.addEventListener('click', () => this.setMode('draw'));
		typeModeBtn?.addEventListener('click', () => this.setMode('type'));

		textInput?.addEventListener('input', (e) => {
			this.signatureText = (e.target as HTMLInputElement).value;
			this.renderTypedSignature();
		});

		fontSelect?.addEventListener('change', (e) => {
			this.signatureFont = (e.target as HTMLSelectElement).value;
			this.renderTypedSignature();
		});

		sizeSlider?.addEventListener('input', (e) => {
			this.signatureSize = parseInt((e.target as HTMLInputElement).value);
			if (sizeValue) sizeValue.textContent = this.signatureSize + 'px';
			this.renderTypedSignature();
		});
	}

	showModal() {
		const modal = document.getElementById('signature-modal');
		if (!modal) return;

		if (!this.signatureCanvas) {
			this.signatureCanvas = document.getElementById('signature-canvas') as HTMLCanvasElement | null;
			if (this.signatureCanvas) {
				this.signatureCtx = this.signatureCanvas.getContext('2d');
				this.setupDrawCanvas();
			}
		}

		// Request saved signatures from host
		this.postMessage({ type: 'loadPdfSignatures' });

		modal.style.display = 'flex';
		modal.style.opacity = '1';
		modal.style.pointerEvents = 'auto';

		this.setMode('draw');
		this.clearCanvas();
	}

	private hideModal() {
		const modal = document.getElementById('signature-modal');
		if (!modal) return;
		modal.style.display = 'none';
		modal.style.opacity = '0';
		modal.style.pointerEvents = 'none';
		this.exitPlacementMode();
	}

	// ==================== DRAW / TYPE MODES ====================

	private setupDrawCanvas() {
		if (!this.signatureCanvas || !this.signatureCtx) return;

		this.signatureCtx.strokeStyle = '#000000';
		this.signatureCtx.lineWidth = 2;
		this.signatureCtx.lineCap = 'round';
		this.signatureCtx.lineJoin = 'round';
		this.signatureCtx.fillStyle = 'white';
		this.signatureCtx.fillRect(0, 0, this.signatureCanvas.width, this.signatureCanvas.height);

		this.signatureCanvas.addEventListener('mousedown', (e) => this.startDrawing(e));
		this.signatureCanvas.addEventListener('mousemove', (e) => this.draw(e));
		this.signatureCanvas.addEventListener('mouseup', () => this.stopDrawing());
		this.signatureCanvas.addEventListener('mouseout', () => this.stopDrawing());

		this.signatureCanvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
		this.signatureCanvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
		this.signatureCanvas.addEventListener('touchend', () => this.stopDrawing());

		// Setup text canvas
		const textCanvasEl = document.getElementById('signature-text-canvas') as HTMLCanvasElement | null;
		if (textCanvasEl) {
			this.signatureTextCanvas = textCanvasEl;
			this.signatureTextCtx = textCanvasEl.getContext('2d');
			if (this.signatureTextCtx) {
				this.signatureTextCtx.fillStyle = 'white';
				this.signatureTextCtx.fillRect(0, 0, textCanvasEl.width, textCanvasEl.height);
			}
		}
	}

	private startDrawing(e: MouseEvent) {
		this.isDrawing = true;
		const rect = this.signatureCanvas!.getBoundingClientRect();
		this.lastX = e.clientX - rect.left;
		this.lastY = e.clientY - rect.top;
	}

	private draw(e: MouseEvent) {
		if (!this.isDrawing || !this.signatureCtx) return;
		const rect = this.signatureCanvas!.getBoundingClientRect();
		const currentX = e.clientX - rect.left;
		const currentY = e.clientY - rect.top;

		this.signatureCtx.beginPath();
		this.signatureCtx.moveTo(this.lastX, this.lastY);
		this.signatureCtx.lineTo(currentX, currentY);
		this.signatureCtx.stroke();

		this.lastX = currentX;
		this.lastY = currentY;
	}

	private stopDrawing() {
		this.isDrawing = false;
		if (this.signatureCanvas && this.signatureMode === 'draw') {
			this.signatureImageData = this.signatureCanvas.toDataURL('image/png');
		}
	}

	private handleTouchStart(e: TouchEvent) {
		e.preventDefault();
		const touch = e.touches[0];
		const mouseEvent = new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY });
		this.signatureCanvas!.dispatchEvent(mouseEvent);
	}

	private handleTouchMove(e: TouchEvent) {
		e.preventDefault();
		const touch = e.touches[0];
		const mouseEvent = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY });
		this.signatureCanvas!.dispatchEvent(mouseEvent);
	}

	private setMode(mode: 'draw' | 'type') {
		this.signatureMode = mode;

		const drawModeBtn = document.getElementById('draw-mode-btn');
		const typeModeBtn = document.getElementById('type-mode-btn');
		drawModeBtn?.classList.toggle('active', mode === 'draw');
		typeModeBtn?.classList.toggle('active', mode === 'type');

		const drawContainer = document.getElementById('draw-mode-container');
		const typeContainer = document.getElementById('type-mode-container');
		drawContainer?.classList.toggle('hidden', mode !== 'draw');
		typeContainer?.classList.toggle('hidden', mode !== 'type');

		const instructions = document.querySelector('.signature-instructions');
		if (instructions) {
			instructions.textContent = mode === 'draw'
				? 'Draw your signature using mouse or touch'
				: 'Type your name and adjust the style';
		}

		if (mode === 'draw' && this.signatureCanvas) {
			this.signatureImageData = this.signatureCanvas.toDataURL('image/png');
		} else if (mode === 'type') {
			this.renderTypedSignature();
		}
	}

	private renderTypedSignature() {
		if (!this.signatureTextCtx || !this.signatureTextCanvas) return;

		this.signatureTextCtx.fillStyle = 'white';
		this.signatureTextCtx.fillRect(0, 0, this.signatureTextCanvas.width, this.signatureTextCanvas.height);

		if (!this.signatureText.trim()) {
			this.signatureImageData = null;
			return;
		}

		let fontFamily = 'cursive';
		let fontWeight = 'normal';
		const fontStyle = 'normal';

		switch (this.signatureFont) {
			case 'signature1': fontFamily = '"Brush Script MT", cursive'; break;
			case 'signature2': fontFamily = '"Lucida Handwriting", cursive'; break;
			case 'signature3': fontFamily = '"Segoe Script", cursive'; break;
			case 'signature4': fontFamily = '"Edwardian Script ITC", cursive'; fontWeight = 'bold'; break;
		}

		this.signatureTextCtx.font = `${fontStyle} ${fontWeight} ${this.signatureSize}px ${fontFamily}`;
		this.signatureTextCtx.fillStyle = '#000000';
		this.signatureTextCtx.textAlign = 'center';
		this.signatureTextCtx.textBaseline = 'middle';

		const centerX = this.signatureTextCanvas.width / 2;
		const centerY = this.signatureTextCanvas.height / 2;
		const randomOffset = (Math.random() - 0.5) * 2;
		this.signatureTextCtx.fillText(this.signatureText, centerX + randomOffset, centerY + randomOffset);

		this.signatureTextCtx.shadowColor = 'rgba(0, 0, 0, 0.1)';
		this.signatureTextCtx.shadowBlur = 1;
		this.signatureTextCtx.shadowOffsetX = 1;
		this.signatureTextCtx.shadowOffsetY = 1;
		this.signatureTextCtx.fillText(this.signatureText, centerX, centerY);

		this.signatureImageData = this.signatureTextCanvas.toDataURL('image/png');
	}

	private clearCanvas() {
		if (this.signatureMode === 'draw') {
			if (!this.signatureCanvas || !this.signatureCtx) return;
			this.signatureCtx.fillStyle = 'white';
			this.signatureCtx.fillRect(0, 0, this.signatureCanvas.width, this.signatureCanvas.height);
			this.signatureImageData = null;
		} else {
			const textInput = document.getElementById('signature-text-input') as HTMLInputElement | null;
			if (textInput) textInput.value = '';
			this.signatureText = '';
			this.renderTypedSignature();
		}
	}

	private saveSignature() {
		if (!this.signatureImageData) {
			alert('Please create a signature first');
			return;
		}

		const newSignature = {
			id: Date.now().toString(),
			dataURL: this.signatureImageData,
			createdAt: Date.now(),
		};

		this.postMessage({ type: 'savePdfSignature', signature: newSignature });
		alert('Signature saved!');
	}

	renderSavedSignatures(signatures: Array<{ id: string; dataURL: string; createdAt: number }>) {
		const list = document.getElementById('saved-signatures-list');
		if (!list) return;

		this.savedSignatures = signatures || [];
		list.innerHTML = '';

		if (this.savedSignatures.length === 0) {
			list.innerHTML = '<div class="no-saved-signatures">No saved signatures</div>';
			return;
		}

		for (const sig of this.savedSignatures) {
			const sigItem = document.createElement('div');
			sigItem.className = 'saved-signature-item';

			const img = document.createElement('img');
			img.src = sig.dataURL;
			img.alt = 'Saved signature';
			img.addEventListener('click', () => this.loadSavedSignature(sig.id));

			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'delete-saved-signature';
			deleteBtn.textContent = '\u00d7';
			deleteBtn.addEventListener('click', () => {
				this.postMessage({ type: 'deletePdfSignature', signatureId: sig.id });
			});

			sigItem.appendChild(img);
			sigItem.appendChild(deleteBtn);
			list.appendChild(sigItem);
		}
	}

	private loadSavedSignature(id: string) {
		const signature = this.savedSignatures.find(s => s.id === id);
		if (signature && this.signatureCanvas && this.signatureCtx) {
			const img = new Image();
			img.onload = () => {
				this.signatureCtx!.fillStyle = 'white';
				this.signatureCtx!.fillRect(0, 0, this.signatureCanvas!.width, this.signatureCanvas!.height);
				this.signatureCtx!.drawImage(img, 0, 0, this.signatureCanvas!.width, this.signatureCanvas!.height);
				this.signatureImageData = signature.dataURL;
			};
			img.src = signature.dataURL;
		}
	}

	private doneSignature() {
		if (!this.signatureImageData) {
			alert('Please create a signature first');
			return;
		}
		this.hideModal();
		this.enterPlacementMode();
	}

	// ==================== PLACEMENT MODE ====================

	private enterPlacementMode() {
		this.isPlacementMode = true;
		document.body.style.cursor = 'crosshair';

		let instructions = document.getElementById('placement-instructions');
		if (!instructions) {
			instructions = document.createElement('div');
			instructions.id = 'placement-instructions';
			instructions.className = 'placement-instructions';
			instructions.textContent = 'Click on the PDF to place your signature';
			document.body.appendChild(instructions);
		}
		instructions.style.display = 'block';

		this.placeSignatureHandler = (e: MouseEvent) => this.placeSignature(e);
		document.addEventListener('click', this.placeSignatureHandler);
	}

	private exitPlacementMode() {
		this.isPlacementMode = false;
		document.body.style.cursor = 'default';

		const instructions = document.getElementById('placement-instructions');
		if (instructions) instructions.style.display = 'none';

		if (this.placeSignatureHandler) {
			document.removeEventListener('click', this.placeSignatureHandler);
			this.placeSignatureHandler = null;
		}
	}

	private placeSignature(e: MouseEvent) {
		if (!this.isPlacementMode || !this.signatureImageData) return;
		const pdfUri = this.getPdfUri();
		if (!pdfUri) return;

		const pdfContainer = document.getElementById('pdf-render-container');
		if (!pdfContainer) return;

		const containerRect = pdfContainer.getBoundingClientRect();
		if (e.clientX < containerRect.left || e.clientX > containerRect.right ||
			e.clientY < containerRect.top || e.clientY > containerRect.bottom) {
			return;
		}

		const scale = this.getScale();
		const relativeX = (e.clientX - containerRect.left) / scale;
		const relativeY = (e.clientY - containerRect.top) / scale;

		this.postMessage({
			type: 'addSignatureAnnotation',
			annotation: {
				pdfUri,
				page: this.getCurrentPage(),
				text: 'Signature',
				color: 'signature',
				imageData: this.signatureImageData,
				boundingBoxes: [{
					page: this.getCurrentPage(),
					x: relativeX - 50,
					y: relativeY - 25,
					width: 100,
					height: 50,
				}]
			}
		});

		this.exitPlacementMode();
	}

	// ==================== DRAG ====================

	private startDragging(e: MouseEvent, el: HTMLElement, annotationId: string) {
		this.isDraggingSignature = true;
		this.draggedSignatureElement = el;
		this.draggedAnnotationId = annotationId;

		const rect = el.getBoundingClientRect();
		this.dragOffsetX = e.clientX - rect.left;
		this.dragOffsetY = e.clientY - rect.top;

		el.classList.add('dragging');
		el.style.cursor = 'grabbing';
		el.style.zIndex = '10';
		e.preventDefault();
		document.body.classList.add('dragging');
	}

	private dragSignature(e: MouseEvent) {
		if (!this.isDraggingSignature || !this.draggedSignatureElement) return;

		const containerRect = document.getElementById('pdf-render-container')!.getBoundingClientRect();
		let newLeft = e.clientX - containerRect.left - this.dragOffsetX;
		let newTop = e.clientY - containerRect.top - this.dragOffsetY;

		const elementRect = this.draggedSignatureElement.getBoundingClientRect();
		const maxLeft = containerRect.width - elementRect.width;
		const maxTop = containerRect.height - elementRect.height;
		newLeft = Math.max(0, Math.min(newLeft, maxLeft));
		newTop = Math.max(0, Math.min(newTop, maxTop));

		this.draggedSignatureElement.style.left = newLeft + 'px';
		this.draggedSignatureElement.style.top = newTop + 'px';
	}

	private stopDragging() {
		if (!this.isDraggingSignature || !this.draggedSignatureElement || !this.draggedAnnotationId) return;

		this.draggedSignatureElement.classList.remove('dragging');
		this.draggedSignatureElement.style.cursor = 'pointer';
		this.draggedSignatureElement.style.zIndex = '';
		document.body.classList.remove('dragging');

		const containerRect = document.getElementById('pdf-render-container')!.getBoundingClientRect();
		const elementRect = this.draggedSignatureElement.getBoundingClientRect();
		const scale = this.getScale();
		const pdfX = (elementRect.left - containerRect.left) / scale;
		const pdfY = (elementRect.top - containerRect.top) / scale;

		const annotation = this.annotationManager.getAnnotation(this.draggedAnnotationId);
		if (annotation && annotation.boundingBoxes.length > 0) {
			const box = annotation.boundingBoxes[0];
			box.x = pdfX;
			box.y = pdfY;
			this.annotationManager.updateAnnotationBoundingBoxes(this.draggedAnnotationId, annotation.boundingBoxes);
		}

		this.isDraggingSignature = false;
		this.draggedSignatureElement = null;
		this.draggedAnnotationId = null;
	}

	// ==================== RESIZE ====================

	private startResizing(e: MouseEvent, el: HTMLElement, annotationId: string, handle: string) {
		this.isResizingSignature = true;
		this.resizedSignatureElement = el;
		this.resizedAnnotationId = annotationId;
		this.resizeHandle = handle;

		const rect = el.getBoundingClientRect();
		const containerRect = document.getElementById('pdf-render-container')!.getBoundingClientRect();
		this.originalBounds = {
			x: rect.left - containerRect.left,
			y: rect.top - containerRect.top,
			width: rect.width,
			height: rect.height,
		};

		this.resizeStartX = e.clientX;
		this.resizeStartY = e.clientY;

		el.classList.add('resizing');
		el.style.zIndex = '10';
		e.preventDefault();
		document.body.classList.add('dragging');
	}

	private resizeSignature(e: MouseEvent) {
		if (!this.isResizingSignature || !this.resizedSignatureElement || !this.originalBounds) return;

		const deltaX = e.clientX - this.resizeStartX;
		const deltaY = e.clientY - this.resizeStartY;
		let { x: newX, y: newY, width: newWidth, height: newHeight } = this.originalBounds;

		switch (this.resizeHandle) {
			case 'nw': newX += deltaX; newY += deltaY; newWidth -= deltaX; newHeight -= deltaY; break;
			case 'ne': newY += deltaY; newWidth += deltaX; newHeight -= deltaY; break;
			case 'sw': newX += deltaX; newWidth -= deltaX; newHeight += deltaY; break;
			case 'se': newWidth += deltaX; newHeight += deltaY; break;
			case 'n': newY += deltaY; newHeight -= deltaY; break;
			case 's': newHeight += deltaY; break;
			case 'e': newWidth += deltaX; break;
			case 'w': newX += deltaX; newWidth -= deltaX; break;
		}

		const minSize = 20;
		newWidth = Math.max(minSize, newWidth);
		newHeight = Math.max(minSize, newHeight);

		this.resizedSignatureElement.style.left = newX + 'px';
		this.resizedSignatureElement.style.top = newY + 'px';
		this.resizedSignatureElement.style.width = newWidth + 'px';
		this.resizedSignatureElement.style.height = newHeight + 'px';
	}

	private stopResizing() {
		if (!this.isResizingSignature || !this.resizedSignatureElement || !this.resizedAnnotationId) return;

		this.resizedSignatureElement.classList.remove('resizing');
		this.resizedSignatureElement.style.zIndex = '';
		document.body.classList.remove('dragging');

		const containerRect = document.getElementById('pdf-render-container')!.getBoundingClientRect();
		const elementRect = this.resizedSignatureElement.getBoundingClientRect();
		const scale = this.getScale();
		const pdfX = (elementRect.left - containerRect.left) / scale;
		const pdfY = (elementRect.top - containerRect.top) / scale;
		const pdfWidth = elementRect.width / scale;
		const pdfHeight = elementRect.height / scale;

		const annotation = this.annotationManager.getAnnotation(this.resizedAnnotationId);
		if (annotation && annotation.boundingBoxes.length > 0) {
			const box = annotation.boundingBoxes[0];
			box.x = pdfX;
			box.y = pdfY;
			box.width = pdfWidth;
			box.height = pdfHeight;
			this.annotationManager.updateAnnotationBoundingBoxes(this.resizedAnnotationId, annotation.boundingBoxes);
		}

		this.isResizingSignature = false;
		this.resizedSignatureElement = null;
		this.resizedAnnotationId = null;
		this.resizeHandle = null;
		this.originalBounds = null;
	}

	// ==================== CONTEXT MENU ====================

	private showContextMenu(e: MouseEvent, annotationId: string) {
		this.hideContextMenu();

		this.contextMenuElement = document.createElement('div');
		this.contextMenuElement.className = 'signature-context-menu';
		this.contextMenuElement.style.position = 'absolute';
		this.contextMenuElement.style.left = e.clientX + 'px';
		this.contextMenuElement.style.top = e.clientY + 'px';
		this.contextMenuElement.style.zIndex = '1000';

		const deleteOption = document.createElement('div');
		deleteOption.className = 'context-menu-item';
		deleteOption.textContent = 'Delete Signature';
		deleteOption.addEventListener('click', () => {
			this.postMessage({ type: 'deleteAnnotation', annotationId });
			this.hideContextMenu();
		});

		this.contextMenuElement.appendChild(deleteOption);
		document.body.appendChild(this.contextMenuElement);

		setTimeout(() => {
			document.addEventListener('click', () => this.hideContextMenu(), { once: true });
		}, 0);
	}

	private hideContextMenu() {
		if (this.contextMenuElement) {
			this.contextMenuElement.remove();
			this.contextMenuElement = null;
		}
	}

	// ==================== GLOBAL EVENT HANDLERS ====================

	handleGlobalMouseMove(e: MouseEvent) {
		if (this.isDraggingSignature) {
			this.dragSignature(e);
		} else if (this.isResizingSignature) {
			this.resizeSignature(e);
		}
	}

	handleGlobalMouseUp() {
		if (this.isDraggingSignature) {
			this.stopDragging();
		} else if (this.isResizingSignature) {
			this.stopResizing();
		}
	}
}
