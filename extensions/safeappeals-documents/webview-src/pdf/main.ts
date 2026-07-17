/*--------------------------------------------------------------------------------------
 *  PDF Viewer - Webview Entry Point (Rust/WASM powered)
 *  This runs inside a VSCode webview (Electron iframe).
 *  - Dual-WASM initialization: PDFium (Emscripten) + Rust wrapper (wasm-bindgen)
 *  - Coordinates renderer, sidebar, annotations, signatures
 *  - Handles postMessage protocol with the VSCode extension host
 *--------------------------------------------------------------------------------------*/

import init, { PdfRenderer, init_panic_hook, initialize_pdfium_render } from './wasm/pdf_viewer.js';
import { PdfCanvasRenderer } from './renderer.js';
import { Sidebar, OutlineItem } from './sidebar.js';
import { AnnotationManager } from './annotations.js';
import { SignatureManager } from './signatures.js';
import { ContinuousScrollManager } from './continuousScroll.js';
import { FormOverlayManager, FormField } from './forms.js';

// VS Code API (available in webview context)
declare function acquireVsCodeApi(): { postMessage(msg: unknown): void; getState(): unknown; setState(state: unknown): void };
declare const PDFiumModule: (() => Promise<unknown>) | undefined;

const vscode = acquireVsCodeApi();

// Restore state
const previousState = (vscode.getState() || {}) as {
	currentPage?: number;
	loadedPdfUri?: string;
	scale?: number;
};

// Core state
let pdfRenderer: PdfRenderer | null = null;
let canvasRenderer: PdfCanvasRenderer | null = null;
let sidebar: Sidebar | null = null;
let annotationManager: AnnotationManager | null = null;
let signatureManager: SignatureManager | null = null;
let continuousScrollManager: ContinuousScrollManager | null = null;
let formOverlayManager: FormOverlayManager | null = null;

let currentPage = previousState.currentPage || 1;
let loadedPdfUri: string | null = previousState.loadedPdfUri || null;
let scale = previousState.scale || 0.8;
let rendering = false;
let wasmReady = false;
let pendingLoadMessage: MessageEvent['data'] | null = null;
let pageCount = 0;
let preloadStrategy = 'adjacent';

// Feature state
let currentFitMode: 'none' | 'width' | 'page' | 'actual' = 'none';
let pageRotation = 0; // 0, 90, 180, 270
let darkModeReading = false;
let scrollMode: 'single' | 'continuous' = 'single';

// Page dimensions cache (from WASM metadata)
let pageDimensions: Array<{ width: number; height: number }> = [];

// Preloaded ImageData cache for fast page switching
const imageDataCache = new Map<number, ImageData>();

async function initialize() {
	console.log('[PDF Viewer] Initializing...');

	// Initialize sub-modules
	const canvasEl = document.getElementById('pdf-canvas') as HTMLCanvasElement | null;
	const textLayerEl = document.getElementById('pdf-text-layer');
	const renderContainer = document.getElementById('pdf-render-container');

	if (canvasEl && textLayerEl && renderContainer) {
		canvasRenderer = new PdfCanvasRenderer(canvasEl, textLayerEl, renderContainer);
		formOverlayManager = new FormOverlayManager(renderContainer);

		// Stop VSCode webview event listeners from interfering with text selection
		textLayerEl.addEventListener('mousemove', (e) => e.stopPropagation());
	}

	// Sidebar
	const thumbnailsContainer = document.getElementById('thumbnails-container');
	const outlineContainer = document.getElementById('outline-container');
	const bookmarksContainer = document.getElementById('bookmarks-container');
	if (thumbnailsContainer && outlineContainer && bookmarksContainer) {
		sidebar = new Sidebar(thumbnailsContainer, outlineContainer, bookmarksContainer, (page: number) => {
			console.log(`[PDF Viewer] Thumbnail clicked → navigating to page ${page}`);
			renderPage(page);
		});
	}

	// Annotations
	annotationManager = new AnnotationManager(
		() => currentPage,
		() => scale,
		() => loadedPdfUri,
		(msg: unknown) => vscode.postMessage(msg)
	);

	// Signatures
	signatureManager = new SignatureManager(
		() => currentPage,
		() => scale,
		() => loadedPdfUri,
		(msg: unknown) => vscode.postMessage(msg),
		annotationManager
	);

	// Set up UI event handlers
	setupUIHandlers();

	// Initialize WASM (dual-module loading)
	await initializeWasm();
}

async function initializeWasm() {
	const configEl = document.getElementById('config');
	const wasmUrl = configEl?.getAttribute('data-wasm-url');

	if (!wasmUrl) {
		console.error('[PDF Viewer] No WASM URL provided');
		return;
	}

	try {
		// Step 1: Initialize PDFium (Emscripten module)
		// The pdfium.js script is loaded via a <script> tag and exposes PDFiumModule globally
		let pdfiumModule: unknown = null;
		if (typeof PDFiumModule !== 'undefined') {
			console.log('[PDF Viewer] Initializing PDFium...');
			pdfiumModule = await PDFiumModule();
			console.log('[PDF Viewer] PDFium initialized');
		} else {
			console.error('[PDF Viewer] PDFium module not found - PDF rendering will fail');
			return;
		}

		// Step 2: Initialize Rust WASM module
		console.log('[PDF Viewer] Initializing Rust WASM...');
		const rustModule = await init(wasmUrl);
		init_panic_hook();

		// Step 3: Bind pdfium-render to the PDFium Emscripten module
		// This MUST be called before any pdfium-render API usage
		console.log('[PDF Viewer] Binding pdfium-render to PDFium...');
		const bindResult = initialize_pdfium_render(pdfiumModule, rustModule);
		if (!bindResult) {
			console.error('[PDF Viewer] Failed to bind pdfium-render to PDFium');
			vscode.postMessage({ type: 'error', error: 'Failed to initialize PDFium bindings' });
			return;
		}
		console.log('[PDF Viewer] PDFium bindings established');

		// Step 4: Create renderer instance
		pdfRenderer = new PdfRenderer();

		wasmReady = true;
		console.log('[PDF Viewer] WASM initialized successfully');
		vscode.postMessage({ type: 'ready' });

		// Process any pending load message
		if (pendingLoadMessage) {
			console.log('[PDF Viewer] Processing pending PDF load');
			await handleLoadPDF(pendingLoadMessage);
			pendingLoadMessage = null;
		}
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[PDF Viewer] WASM init failed:', message);
		vscode.postMessage({ type: 'error', error: message });
	}
}

// ==================== MESSAGE HANDLING ====================

window.addEventListener('message', async (event) => {
	const message = event.data;

	switch (message.type) {
		case 'loadPDF':
			if (wasmReady) {
				await handleLoadPDF(message);
			} else {
				console.log('[PDF Viewer] WASM not ready yet, queuing load');
				pendingLoadMessage = message;
			}
			break;

		case 'getState':
			vscode.postMessage({
				type: 'state',
				loadedPdfUri,
				currentPage,
				hasPDF: pageCount > 0,
				savedPage: message.savedPage || 1
			});
			if (pageCount > 0 && loadedPdfUri === message.requestedUri && currentPage !== (message.savedPage || 1)) {
				await renderPage(message.savedPage || 1);
			}
			break;

		case 'goToPage':
			if (pageCount > 0 && message.page) {
				const targetPage = Math.max(1, Math.min(message.page, pageCount));
				await renderPage(targetPage);
			}
			break;

		case 'clearPDF': {
			pdfRenderer?.close();
			pageCount = 0;
			currentPage = 1;
			loadedPdfUri = null;
			pageDimensions = [];
			imageDataCache.clear();
			canvasRenderer?.clear();
			sidebar?.clearThumbnails();
			break;
		}

		case 'getSelectionRect': {
			const selection = window.getSelection();
			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const rect = range.getBoundingClientRect();
				vscode.postMessage({
					type: 'selectionRect',
					rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
				});
			} else {
				vscode.postMessage({ type: 'selectionRect', rect: null });
			}
			break;
		}

		case 'loadAnnotations':
			if (annotationManager) {
				annotationManager.setAnnotations(message.annotations || []);
				annotationManager.renderAnnotations(currentPage, scale);
				sidebar?.renderBookmarks(annotationManager.getBookmarks());
			}
			break;

		case 'savedSignatures':
			signatureManager?.renderSavedSignatures(message.signatures || []);
			break;

		case 'addSignatureAnnotation': {
			const sigAnnotation = message.annotation;
			sigAnnotation.id = 'sig_' + Date.now();
			sigAnnotation.createdAt = Date.now();
			annotationManager?.addLocalAnnotation(sigAnnotation);
			annotationManager?.renderAnnotations(currentPage, scale);
			break;
		}

		case 'downloadAnnotations': {
			// Trigger a JSON download in the webview
			const blob = new Blob([message.json as string], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'annotations.json';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			break;
		}
	}
});

// ==================== PDF LOADING ====================

async function handleLoadPDF(message: Record<string, unknown>) {
	if (!pdfRenderer) {
		console.error('[PDF Viewer] Renderer not initialized');
		return;
	}

	// Clear stale thumbnails immediately so old content never persists.
	// Also tears down the previous document's observer + render queue.
	sidebar?.clearThumbnails();

	try {
		preloadStrategy = (message.preloadStrategy as string) || 'adjacent';
		const startPage = (message.startPage as number) || 1;
		const skipPreload = (message.skipPreload as boolean) || false;

		loadedPdfUri = message.pdfUri as string;

		// Save state
		vscode.setState({ currentPage: startPage, loadedPdfUri, scale });

		// Decode base64 to bytes
		let uint8Array: Uint8Array;
		if (message.encoding === 'base64') {
			const binaryString = atob(message.data as string);
			uint8Array = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				uint8Array[i] = binaryString.charCodeAt(i);
			}
		} else {
			uint8Array = new Uint8Array(message.data as ArrayBuffer);
		}

		console.log('[PDF Viewer] Loading PDF, size:', uint8Array.length, 'bytes');

		// Load into Rust WASM
		const metadataJson = pdfRenderer.load(uint8Array);
		const metadata = JSON.parse(metadataJson) as { page_count: number; pages: Array<{ width: number; height: number }> };

		pageCount = metadata.page_count;
		pageDimensions = metadata.pages;
		imageDataCache.clear();

		console.log('[PDF Viewer] PDF loaded, pages:', pageCount);

		// Update UI
		const totalPagesSpan = document.getElementById('total-pages');
		if (totalPagesSpan) totalPagesSpan.textContent = pageCount.toString();

		// Validate start page
		currentPage = Math.max(1, Math.min(startPage, pageCount));
		scale = 0.8;

		// Thumbnails (lazy placeholders) + outline via WASM
		try {
			setupThumbnails();
		} catch (thumbErr) {
			console.error('[PDF Viewer] Thumbnail setup failed:', thumbErr);
		}
		try {
			await extractOutline();
		} catch (outlineErr) {
			console.error('[PDF Viewer] Outline extraction failed:', outlineErr);
		}

		// Render starting page
		await renderPage(currentPage);

		// Preload strategy
		if (!skipPreload) {
			if (preloadStrategy === 'all') {
				await preloadAllPages();
			} else if (preloadStrategy === 'adjacent') {
				preloadAdjacentPages(currentPage);
			}
		}

		// Notify host
		vscode.postMessage({ type: 'pdfLoaded' });

	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error('[PDF Viewer] Error loading PDF:', msg);
		vscode.postMessage({ type: 'error', error: msg });
	}
}

// ==================== PAGE RENDERING ====================

async function renderPage(pageNum: number) {
	if (!pdfRenderer || !canvasRenderer || rendering) return;


	rendering = true;

	try {
		const dims = pageDimensions[pageNum - 1];
		if (!dims) throw new Error(`No dimensions for page ${pageNum}`);

		// Calculate pixel dimensions from page points and scale
		const dpi = 96;
		const pixelWidth = Math.round(dims.width * scale * dpi / 72);
		const pixelHeight = Math.round(dims.height * scale * dpi / 72);

		// Render from WASM
		const imageData = pdfRenderer.render_page(pageNum - 1, pixelWidth, pixelHeight);
		imageDataCache.set(pageNum, imageData);

		// Paint to canvas with fade-in transition
		canvasRenderer.renderImageData(imageData, pixelWidth, pixelHeight);
		const canvas = document.getElementById('pdf-canvas');
		if (canvas) {
			canvas.classList.remove('page-transition');
			// Force reflow so the animation replays
			void (canvas as HTMLElement).offsetWidth;
			canvas.classList.add('page-transition');
		}

		// Build text layer from WASM text extraction
		let textBlocks: Array<{ text: string; x: number; y: number; width: number; height: number; font_size: number }> = [];
		try {
			console.log(`[PDF Viewer] ===== EXTRACTING TEXT page ${pageNum} =====`);
			const textJson = pdfRenderer.get_page_text(pageNum - 1);
			console.log(`[PDF Viewer] Raw JSON length: ${textJson.length}, preview: ${textJson.substring(0, 200)}`);
			const rawBlocks = JSON.parse(textJson) as Array<Record<string, unknown>>;
			console.log(`[PDF Viewer] Parsed ${rawBlocks.length} raw blocks`);

			for (const block of rawBlocks) {
				const x = block.x as number;
				const y = block.y as number;
				const w = block.width as number;
				const h = block.height as number;
				const fs = block.font_size as number;
				const text = block.text as string;

				if (text && typeof x === 'number' && typeof y === 'number' &&
					typeof w === 'number' && typeof h === 'number' &&
					isFinite(x) && isFinite(y) && isFinite(w) && isFinite(h) &&
					w > 0 && h > 0) {
					textBlocks.push({ text, x, y, width: w, height: h, font_size: typeof fs === 'number' && isFinite(fs) ? fs : 12 });
				}
			}
			console.log(`[PDF Viewer] Valid blocks: ${textBlocks.length} / ${rawBlocks.length}`);
		} catch (textError) {
			console.error('[PDF Viewer] ===== TEXT EXTRACTION FAILED =====', textError);
		}
		canvasRenderer.renderTextLayer(textBlocks, dims.width, dims.height, scale);

		// Detect and render interactive form fields (only if WASM exposes get_form_fields)
		if (formOverlayManager) {
			try {
				const rendererWithForms = pdfRenderer as PdfRenderer & { get_form_fields?: (index: number) => string };
				if (typeof rendererWithForms.get_form_fields === 'function') {
					const formJson = rendererWithForms.get_form_fields(pageNum - 1);
					const formFields = JSON.parse(formJson) as FormField[];
					if (formFields.length > 0) {
						formOverlayManager.renderFormFields(formFields, dims.width, dims.height, pixelWidth, pixelHeight);
					} else {
						formOverlayManager.removeOverlay();
					}
				} else {
					formOverlayManager.removeOverlay();
				}
			} catch {
				formOverlayManager.removeOverlay();
			}
		}

		currentPage = pageNum;

		// Save state
		vscode.setState({ currentPage, loadedPdfUri, scale });

		// Update UI
		const currentPageSpan = document.getElementById('current-page');
		if (currentPageSpan) currentPageSpan.textContent = currentPage.toString();

		const prevButton = document.getElementById('prev-page') as HTMLButtonElement | null;
		const nextButton = document.getElementById('next-page') as HTMLButtonElement | null;
		if (prevButton) prevButton.disabled = currentPage <= 1;
		if (nextButton) nextButton.disabled = currentPage >= pageCount;

		// Update sidebar
		sidebar?.updateActiveThumbnail(currentPage);

		// Notify host
		vscode.postMessage({ type: 'pageChanged', page: pageNum });

		// Preload adjacent if using that strategy
		if (preloadStrategy === 'adjacent') {
			preloadAdjacentPages(pageNum);
		}

		// Render annotations
		annotationManager?.renderAnnotations(currentPage, scale);

	} catch (error) {
		console.error('[PDF Viewer] Error rendering page:', error);
	} finally {
		rendering = false;
	}
}

// ==================== PRELOADING ====================

// NOTE: 'all' is no longer sent by the extension host (it preloads every page at
// full scale — unusable for large documents). Kept for compatibility, with a yield
// per page so it can never hard-block the main thread if re-enabled.
async function preloadAllPages() {
	if (!pdfRenderer) return;
	const maxPages = Math.min(pageCount, 500);
	const loadingUri = loadedPdfUri;
	console.log(`[PDF Viewer] Preloading ${maxPages} pages...`);

	for (let i = 1; i <= maxPages; i++) {
		// Abandon if another document was loaded meanwhile
		if (loadedPdfUri !== loadingUri || !pdfRenderer) return;
		if (imageDataCache.has(i)) continue;
		try {
			const dims = pageDimensions[i - 1];
			const dpi = 96;
			const pw = Math.round(dims.width * scale * dpi / 72);
			const ph = Math.round(dims.height * scale * dpi / 72);
			const img = pdfRenderer.render_page(i - 1, pw, ph);
			imageDataCache.set(i, img);
		} catch (e) {
			console.error(`[PDF Viewer] Failed to preload page ${i}:`, e);
		}
		// Yield to the browser between pages
		await new Promise(resolve => setTimeout(resolve, 0));
	}
	console.log(`[PDF Viewer] Preload complete`);
}

function preloadAdjacentPages(centerPage: number) {
	if (!pdfRenderer) return;
	const range = 2;
	const start = Math.max(1, centerPage - range);
	const end = Math.min(pageCount, centerPage + range);

	for (let i = start; i <= end; i++) {
		if (imageDataCache.has(i)) continue;
		try {
			const dims = pageDimensions[i - 1];
			const dpi = 96;
			const pw = Math.round(dims.width * scale * dpi / 72);
			const ph = Math.round(dims.height * scale * dpi / 72);
			const img = pdfRenderer.render_page(i - 1, pw, ph);
			imageDataCache.set(i, img);
		} catch (e) {
			console.error(`[PDF Viewer] Failed to preload page ${i}:`, e);
		}
	}

	// Evict old entries
	const minKeep = Math.max(1, centerPage - 5);
	const maxKeep = Math.min(pageCount, centerPage + 5);
	for (const [page] of imageDataCache) {
		if (page < minKeep || page > maxKeep) {
			imageDataCache.delete(page);
		}
	}
}

// ==================== THUMBNAILS & OUTLINE ====================

function setupThumbnails() {
	if (!pdfRenderer || !sidebar) return;

	console.log(`[PDF Viewer] Creating ${pageCount} thumbnail placeholders, uri: ${loadedPdfUri}`);

	// Placeholders appear instantly; the sidebar rasterizes tiles lazily via
	// IntersectionObserver + one-per-frame queue (all rasterization stays in WASM).
	sidebar.setThumbnailPlaceholders(pageCount, pageDimensions, currentPage, (pageNum: number) => {
		if (!pdfRenderer) return null;
		const img = pdfRenderer.render_thumbnail(pageNum - 1, 150);
		// Copy pixel data immediately — pdfium's WASM buffer is reused across
		// renders, so without a copy all ImageData objects would reference the
		// same (last-rendered) page.
		return new ImageData(
			new Uint8ClampedArray(img.data),
			img.width,
			img.height
		);
	});
}

async function extractOutline() {
	if (!pdfRenderer || !sidebar) return;

	try {
		const outlineJson = pdfRenderer.get_outline();
		const outline = JSON.parse(outlineJson) as OutlineItem[];
		sidebar.setOutline(outline);
	} catch (e) {
		console.error('[PDF Viewer] Failed to extract outline:', e);
		sidebar.setOutline([]);
	}
}

// ==================== CONTINUOUS SCROLL ====================

function enterContinuousMode() {
	if (!pdfRenderer || pageCount === 0) return;
	scrollMode = 'continuous';

	const canvasWrapper = document.getElementById('canvas-wrapper');
	const continuousContainer = document.getElementById('continuous-scroll-container');
	if (!canvasWrapper || !continuousContainer) return;

	canvasWrapper.style.display = 'none';
	continuousContainer.style.display = 'flex';

	continuousScrollManager = new ContinuousScrollManager(
		continuousContainer,
		pageCount,
		pageDimensions,
		scale,
		(page: number) => {
			if (!pdfRenderer) throw new Error('No renderer');
			const dims = pageDimensions[page - 1];
			const dpi = 96;
			const pw = Math.round(dims.width * scale * dpi / 72);
			const ph = Math.round(dims.height * scale * dpi / 72);
			return pdfRenderer.render_page(page - 1, pw, ph);
		},
		(page: number) => {
			if (!pdfRenderer) return [];
			try {
				const textJson = pdfRenderer.get_page_text(page - 1);
				const rawBlocks = JSON.parse(textJson) as Array<Record<string, unknown>>;
				return rawBlocks.filter(b => {
					const x = b.x as number; const y = b.y as number;
					const w = b.width as number; const h = b.height as number;
					return b.text && typeof x === 'number' && typeof y === 'number' &&
						typeof w === 'number' && typeof h === 'number' &&
						isFinite(x) && isFinite(y) && isFinite(w) && isFinite(h) && w > 0 && h > 0;
				}).map(b => ({
					text: b.text as string,
					x: b.x as number, y: b.y as number,
					width: b.width as number, height: b.height as number,
					font_size: typeof b.font_size === 'number' && isFinite(b.font_size as number) ? b.font_size as number : 12,
				}));
			} catch {
				return [];
			}
		},
		(page: number) => {
			currentPage = page;
			const span = document.getElementById('current-page');
			if (span) span.textContent = page.toString();
			sidebar?.updateActiveThumbnail(page);
			vscode.setState({ currentPage: page, loadedPdfUri, scale });
		},
	);

	// Jump to the current page immediately
	continuousScrollManager.scrollToPage(currentPage);
}

function exitContinuousMode() {
	scrollMode = 'single';
	continuousScrollManager?.destroy();
	continuousScrollManager = null;

	const canvasWrapper = document.getElementById('canvas-wrapper');
	const continuousContainer = document.getElementById('continuous-scroll-container');
	if (canvasWrapper) canvasWrapper.style.display = '';
	if (continuousContainer) continuousContainer.style.display = 'none';

	if (pageCount > 0) renderPage(currentPage);
}

// ==================== UI EVENT HANDLERS ====================

function setupUIHandlers() {
	// Navigation buttons
	const prevButton = document.getElementById('prev-page');
	const nextButton = document.getElementById('next-page');

	prevButton?.addEventListener('click', () => {
		if (currentPage > 1) renderPage(currentPage - 1);
	});
	nextButton?.addEventListener('click', () => {
		if (currentPage < pageCount) renderPage(currentPage + 1);
	});

	// Zoom controls
	const zoomInButton = document.getElementById('zoom-in');
	const zoomOutButton = document.getElementById('zoom-out');
	let isZooming = false;

	zoomInButton?.addEventListener('click', () => {
		scale *= 1.2;
		imageDataCache.clear(); // Clear cache since scale changed
		renderPage(currentPage);
	});
	zoomOutButton?.addEventListener('click', () => {
		scale /= 1.2;
		imageDataCache.clear();
		renderPage(currentPage);
	});

	// Ctrl+Scroll zoom
	const canvasWrapperEl = document.getElementById('canvas-wrapper');
	canvasWrapperEl?.addEventListener('wheel', (e) => {
		if (!e.ctrlKey) return;
		e.preventDefault();
		if (isZooming) return;
		isZooming = true;

		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		const newScale = Math.max(0.5, Math.min(3.0, scale * delta));
		if (Math.abs(newScale - scale) > 0.01) {
			scale = newScale;
			imageDataCache.clear();
			renderPage(currentPage).then(() => { isZooming = false; });
		} else {
			isZooming = false;
		}
	}, { passive: false });

	// Print button
	const printButton = document.getElementById('print-btn');
	printButton?.addEventListener('click', () => {
		if (pageCount > 0) vscode.postMessage({ type: 'printPdf' });
	});

	// Keyboard: Ctrl+P print
	document.addEventListener('keydown', (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
			e.preventDefault();
			if (pageCount > 0) vscode.postMessage({ type: 'printPdf' });
		}
	});

	// Keyboard navigation
	document.addEventListener('keydown', (e) => {
		if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (currentPage > 1) renderPage(currentPage - 1);
		} else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
			e.preventDefault();
			if (currentPage < pageCount) renderPage(currentPage + 1);
		}
	});

	// Text selection handling for Ctrl+K
	document.addEventListener('mouseup', () => {
		const selection = window.getSelection();
		if (selection && selection.toString()) {
			vscode.postMessage({
				type: 'textSelected',
				selection: { startPage: currentPage, endPage: currentPage, text: selection.toString() }
			});
		} else {
			vscode.postMessage({ type: 'clearSelection' });
		}
	});

	// Sidebar toggle
	const toggleSidebarButton = document.getElementById('toggle-sidebar');
	const sidebarEl = document.getElementById('sidebar');
	toggleSidebarButton?.addEventListener('click', () => {
		sidebarEl?.classList.toggle('collapsed');
	});

	// Tab switching
	const sidebarTabs = document.querySelectorAll('.sidebar-tab');
	const thumbnailsView = document.getElementById('thumbnails-view');
	const outlineView = document.getElementById('outline-view');
	const bookmarksView = document.getElementById('bookmarks-view');

	sidebarTabs.forEach(tab => {
		tab.addEventListener('click', () => {
			const tabName = (tab as HTMLElement).dataset.tab;
			sidebarTabs.forEach(t => t.classList.remove('active'));
			tab.classList.add('active');
			thumbnailsView?.classList.remove('active');
			outlineView?.classList.remove('active');
			bookmarksView?.classList.remove('active');
			if (tabName === 'thumbnails') thumbnailsView?.classList.add('active');
			else if (tabName === 'outline') outlineView?.classList.add('active');
			else if (tabName === 'bookmarks') bookmarksView?.classList.add('active');
		});
	});

	// Highlight buttons
	const highlightButtons = document.querySelectorAll('.highlight-btn');
	highlightButtons.forEach(btn => {
		// Prevent mousedown from clearing the text selection
		btn.addEventListener('mousedown', (e) => {
			e.preventDefault();
		});
		btn.addEventListener('click', () => {
			const color = (btn as HTMLElement).dataset.color || 'yellow';
			console.log(`[PDF Viewer] Highlight button clicked: ${color}`);
			annotationManager?.setHighlightColor(color);
			highlightButtons.forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			annotationManager?.createHighlightFromSelection(currentPage, scale);
		});
	});

	// Delete highlight
	const deleteHighlightButton = document.getElementById('delete-highlight');
	deleteHighlightButton?.addEventListener('click', () => {
		annotationManager?.deleteSelectedAnnotation();
	});

	// Bookmark button — uses inline input since prompt() is blocked in sandboxed webviews
	const addBookmarkButton = document.getElementById('add-bookmark');
	addBookmarkButton?.addEventListener('click', () => {
		if (pageCount <= 0 || !loadedPdfUri) return;

		const container = document.getElementById('bookmarks-header');
		if (!container || container.querySelector('.bookmark-input-row')) return;

		const row = document.createElement('div');
		row.className = 'bookmark-input-row';

		const pageInput = document.createElement('input');
		pageInput.type = 'number';
		pageInput.className = 'bookmark-page-input';
		pageInput.min = '1';
		pageInput.max = pageCount.toString();
		pageInput.value = currentPage.toString();
		pageInput.title = 'Page number';

		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'bookmark-name-input';
		input.placeholder = 'Bookmark name';
		input.value = `Page ${currentPage}`;

		const saveBtn = document.createElement('button');
		saveBtn.className = 'bookmark-save-btn';
		saveBtn.textContent = 'Save';

		const cancelBtn = document.createElement('button');
		cancelBtn.className = 'bookmark-cancel-btn';
		cancelBtn.textContent = 'Cancel';

		// Update the name field when page number changes
		pageInput.addEventListener('input', () => {
			const p = parseInt(pageInput.value);
			if (!isNaN(p)) input.value = `Page ${p}`;
		});

		const submit = () => {
			const name = input.value.trim();
			const targetPage = Math.max(1, Math.min(pageCount, parseInt(pageInput.value) || currentPage));
			if (name) {
				vscode.postMessage({
					type: 'addAnnotation',
					annotation: {
						pdfUri: loadedPdfUri,
						page: targetPage,
						text: name,
						color: 'bookmark',
						boundingBoxes: []
					}
				});
			}
			row.remove();
		};

		const onKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Enter') submit();
			if (e.key === 'Escape') row.remove();
		};
		input.addEventListener('keydown', onKeydown);
		pageInput.addEventListener('keydown', onKeydown);
		saveBtn.addEventListener('click', submit);
		cancelBtn.addEventListener('click', () => row.remove());

		row.appendChild(pageInput);
		row.appendChild(input);
		row.appendChild(saveBtn);
		row.appendChild(cancelBtn);
		container.appendChild(row);
		input.select();
	});

	// Delete bookmark handler — sidebar dispatches this custom event
	document.addEventListener('deleteBookmark', ((e: CustomEvent) => {
		const annotationId = e.detail;
		if (annotationId) {
			vscode.postMessage({ type: 'deleteAnnotation', annotationId });
		}
	}) as EventListener);

	// ==================== FIT MODES ====================

	const fitWidthButton = document.getElementById('fit-width');
	const fitPageButton = document.getElementById('fit-page');
	const actualSizeButton = document.getElementById('actual-size');

	function applyFitMode() {
		if (!pageDimensions[currentPage - 1] || currentFitMode === 'none') return;
		const wrapper = document.getElementById('canvas-wrapper');
		if (!wrapper) return;
		const dims = pageDimensions[currentPage - 1];
		const dpi = 96;
		const wrapperW = wrapper.clientWidth - 40;
		const wrapperH = wrapper.clientHeight - 40;
		if (currentFitMode === 'width') {
			scale = wrapperW / (dims.width * dpi / 72);
		} else if (currentFitMode === 'page') {
			scale = Math.min(wrapperW / (dims.width * dpi / 72), wrapperH / (dims.height * dpi / 72));
		} else if (currentFitMode === 'actual') {
			scale = 1.0;
		}
	}

	function setFitMode(mode: 'none' | 'width' | 'page' | 'actual') {
		currentFitMode = mode;
		[fitWidthButton, fitPageButton, actualSizeButton].forEach(btn => btn?.classList.remove('active'));
		if (mode === 'width') fitWidthButton?.classList.add('active');
		else if (mode === 'page') fitPageButton?.classList.add('active');
		else if (mode === 'actual') actualSizeButton?.classList.add('active');
		applyFitMode();
		imageDataCache.clear();
		if (pageCount > 0) renderPage(currentPage);
	}

	fitWidthButton?.addEventListener('click', () => setFitMode(currentFitMode === 'width' ? 'none' : 'width'));
	fitPageButton?.addEventListener('click', () => setFitMode(currentFitMode === 'page' ? 'none' : 'page'));
	actualSizeButton?.addEventListener('click', () => setFitMode(currentFitMode === 'actual' ? 'none' : 'actual'));

	// Reapply fit mode when container resizes
	const canvasWrapper = document.getElementById('canvas-wrapper');
	if (canvasWrapper && typeof ResizeObserver !== 'undefined') {
		const resizeObs = new ResizeObserver(() => {
			if (currentFitMode !== 'none' && pageCount > 0) {
				applyFitMode();
				imageDataCache.clear();
				renderPage(currentPage);
			}
		});
		resizeObs.observe(canvasWrapper);
	}

	// ==================== ROTATE VIEW ====================

	const rotateButton = document.getElementById('rotate-view');
	rotateButton?.addEventListener('click', () => {
		pageRotation = (pageRotation + 90) % 360;
		const renderContainer = document.getElementById('pdf-render-container');
		if (renderContainer) {
			renderContainer.classList.remove('rotated-90', 'rotated-180', 'rotated-270');
			if (pageRotation !== 0) renderContainer.classList.add(`rotated-${pageRotation}`);
		}
	});

	// ==================== DARK MODE READING ====================

	const darkModeButton = document.getElementById('dark-mode-reading');
	darkModeButton?.addEventListener('click', () => {
		darkModeReading = !darkModeReading;
		const cvs = document.getElementById('pdf-canvas') as HTMLCanvasElement | null;
		if (cvs) cvs.style.filter = darkModeReading ? 'invert(1) hue-rotate(180deg)' : '';
		darkModeButton.classList.toggle('active', darkModeReading);
	});

	// ==================== CONTINUOUS SCROLL MODE ====================

	const scrollModeButton = document.getElementById('scroll-mode-toggle');
	scrollModeButton?.addEventListener('click', () => {
		if (scrollMode === 'single') {
			enterContinuousMode();
		} else {
			exitContinuousMode();
		}
		scrollModeButton.classList.toggle('active', scrollMode === 'continuous');
	});

	// ==================== EXPORT ANNOTATIONS ====================

	const exportAnnotationsButton = document.getElementById('export-annotations');
	exportAnnotationsButton?.addEventListener('click', () => {
		if (pageCount > 0) vscode.postMessage({ type: 'exportAnnotations' });
	});

	// ==================== REDACTION TOOL ====================

	const redactToolButton = document.getElementById('redact-tool');
	redactToolButton?.addEventListener('mousedown', (e) => e.preventDefault());
	redactToolButton?.addEventListener('click', () => {
		const isActive = annotationManager?.getRedactionMode() ?? false;
		annotationManager?.setRedactionMode(!isActive);
		redactToolButton.classList.toggle('active', !isActive);
		// Update cursor on the text layer
		const textLayer = document.getElementById('pdf-text-layer');
		if (textLayer) textLayer.style.cursor = !isActive ? 'crosshair' : 'text';
	});

	// Redaction drag logic on the text layer
	const textLayerEl = document.getElementById('pdf-text-layer');
	if (textLayerEl) {
		let redactStartX = 0;
		let redactStartY = 0;
		let redactPreview: HTMLElement | null = null;
		let isRedactDragging = false;

		textLayerEl.addEventListener('mousedown', (e) => {
			if (!annotationManager?.getRedactionMode()) return;
			e.preventDefault();
			e.stopPropagation();
			isRedactDragging = true;
			const rect = textLayerEl.getBoundingClientRect();
			redactStartX = e.clientX - rect.left;
			redactStartY = e.clientY - rect.top;

			redactPreview = document.createElement('div');
			redactPreview.style.position = 'absolute';
			redactPreview.style.background = 'rgba(0,0,0,0.5)';
			redactPreview.style.border = '2px dashed #ff0000';
			redactPreview.style.left = redactStartX + 'px';
			redactPreview.style.top = redactStartY + 'px';
			redactPreview.style.width = '0';
			redactPreview.style.height = '0';
			redactPreview.style.pointerEvents = 'none';
			redactPreview.style.zIndex = '10';
			textLayerEl.appendChild(redactPreview);
		});

		textLayerEl.addEventListener('mousemove', (e) => {
			if (!isRedactDragging || !redactPreview) return;
			e.stopPropagation();
			const rect = textLayerEl.getBoundingClientRect();
			const curX = e.clientX - rect.left;
			const curY = e.clientY - rect.top;
			const left = Math.min(redactStartX, curX);
			const top = Math.min(redactStartY, curY);
			const w = Math.abs(curX - redactStartX);
			const h = Math.abs(curY - redactStartY);
			redactPreview.style.left = left + 'px';
			redactPreview.style.top = top + 'px';
			redactPreview.style.width = w + 'px';
			redactPreview.style.height = h + 'px';
		});

		textLayerEl.addEventListener('mouseup', (e) => {
			if (!isRedactDragging) return;
			isRedactDragging = false;
			const rect = textLayerEl.getBoundingClientRect();
			const curX = e.clientX - rect.left;
			const curY = e.clientY - rect.top;
			const left = Math.min(redactStartX, curX);
			const top = Math.min(redactStartY, curY);
			const w = Math.abs(curX - redactStartX);
			const h = Math.abs(curY - redactStartY);
			redactPreview?.remove();
			redactPreview = null;
			if (annotationManager?.getRedactionMode()) {
				annotationManager.createRedactionFromDrag(left, top, w, h, currentPage, scale);
			}
		});
	}

	// Signature button
	const addSignatureButton = document.getElementById('add-signature');
	addSignatureButton?.addEventListener('click', () => {
		signatureManager?.showModal();
	});

	// DocuSign retired — button omitted from host HTML.

	// Click to deselect annotations
	document.addEventListener('click', (e) => {
		const target = e.target as HTMLElement;
		if (!target.closest('.pdf-highlight') &&
			!target.closest('.pdf-signature-container') &&
			!target.closest('.resize-handle') &&
			!target.closest('#delete-highlight') &&
			!target.closest('.highlight-btn') &&
			!target.closest('#annotation-toolbar') &&
			!target.closest('.signature-context-menu')) {
			annotationManager?.deselectAll();
		}
	});

	// Global mouse events for signature drag/resize
	document.addEventListener('mousemove', (e) => {
		signatureManager?.handleGlobalMouseMove(e);
	});
	document.addEventListener('mouseup', () => {
		signatureManager?.handleGlobalMouseUp();
	});
}

// ==================== ENTRY POINT ====================

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initialize);
} else {
	initialize();
}
