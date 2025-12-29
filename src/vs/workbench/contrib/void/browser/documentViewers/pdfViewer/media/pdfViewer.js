// PDF Viewer Webview Script
(function () {
	// Communication with host
	const vscode = acquireVsCodeApi();

	// Get previous state if it exists
	const previousState = vscode.getState() || {};

	let pdfDoc = null;
	let currentPage = previousState.currentPage || 1;
	let loadedPdfUri = previousState.loadedPdfUri || null; // Track which PDF is loaded
	let scale = previousState.scale || 0.8;
	let rendering = false;
	let pdfJsReady = false;
	let pendingLoadMessage = null;

	// Page cache for preloading
	let pageCache = new Map();
	let preloadStrategy = 'all'; // Default strategy

	// Annotation state
	let annotations = [];
	let selectedAnnotationId = null;
	let currentHighlightColor = 'yellow';

	// Get DOM elements
	const canvas = document.getElementById('pdf-canvas');
	const ctx = canvas?.getContext('2d');
	const textLayer = document.getElementById('pdf-text-layer');
	const prevButton = document.getElementById('prev-page');
	const nextButton = document.getElementById('next-page');
	const zoomInButton = document.getElementById('zoom-in');
	const zoomOutButton = document.getElementById('zoom-out');
	const currentPageSpan = document.getElementById('current-page');
	const totalPagesSpan = document.getElementById('total-pages');

	// Sidebar elements
	const sidebar = document.getElementById('sidebar');
	const toggleSidebarButton = document.getElementById('toggle-sidebar');
	const sidebarTabs = document.querySelectorAll('.sidebar-tab');
	const thumbnailsContainer = document.getElementById('thumbnails-container');
	const outlineContainer = document.getElementById('outline-container');
	const thumbnailsView = document.getElementById('thumbnails-view');
	const outlineView = document.getElementById('outline-view');
	const bookmarksView = document.getElementById('bookmarks-view');
	const bookmarksContainer = document.getElementById('bookmarks-container');
	const addBookmarkButton = document.getElementById('add-bookmark');

	// Annotation toolbar elements
	const highlightButtons = document.querySelectorAll('.highlight-btn');
	const deleteHighlightButton = document.getElementById('delete-highlight');

	// Sidebar toggle
	if (toggleSidebarButton) {
		toggleSidebarButton.addEventListener('click', () => {
			sidebar.classList.toggle('collapsed');
		});
	}

	// Tab switching
	sidebarTabs.forEach(tab => {
		tab.addEventListener('click', () => {
			const tabName = tab.dataset.tab;

			// Update active tab
			sidebarTabs.forEach(t => t.classList.remove('active'));
			tab.classList.add('active');

			// Update visible content
			thumbnailsView.classList.remove('active');
			outlineView.classList.remove('active');
			bookmarksView.classList.remove('active');

			if (tabName === 'thumbnails') {
				thumbnailsView.classList.add('active');
			} else if (tabName === 'outline') {
				outlineView.classList.add('active');
			} else if (tabName === 'bookmarks') {
				bookmarksView.classList.add('active');
			}
		});
	});

	// Annotation toolbar handlers
	highlightButtons.forEach(btn => {
		btn.addEventListener('click', () => {
			currentHighlightColor = btn.dataset.color;
			// Update active state
			highlightButtons.forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			// Create highlight from current selection
			createHighlightFromSelection();
		});
	});

	if (deleteHighlightButton) {
		deleteHighlightButton.addEventListener('click', () => {
			if (selectedAnnotationId) {
				vscode.postMessage({
					type: 'deleteAnnotation',
					annotationId: selectedAnnotationId
				});
				selectedAnnotationId = null;
			}
		});
	}

	// Bookmark button handler
	if (addBookmarkButton) {
		addBookmarkButton.addEventListener('click', () => {
			if (pdfDoc && loadedPdfUri) {
				const bookmarkName = prompt('Bookmark name:', `Page ${currentPage}`);
				if (bookmarkName) {
					vscode.postMessage({
						type: 'addAnnotation',
						annotation: {
							pdfUri: loadedPdfUri,
							page: currentPage,
							text: bookmarkName,
							color: 'bookmark',
							boundingBoxes: []
						}
					});
				}
			}
		});
	}

	// Check if scripts are in the DOM
	console.log('DOM Scripts:', Array.from(document.scripts).map(s => ({ src: s.src, loaded: s.hasAttribute('data-loaded') })));
	console.log('PDF_WORKER_URI:', window.PDF_WORKER_URI);

	// Wait for PDF.js to load
	let retryCount = 0;
	const MAX_RETRIES = 50; // Stop after 5 seconds

	function initPdfJs() {
		console.log('Checking for PDF.js... (attempt ' + (retryCount + 1) + ')');
		if (typeof pdfjsLib !== 'undefined') {
			console.log('PDF.js loaded successfully');
			if (window.PDF_WORKER_URI) {
				pdfjsLib.GlobalWorkerOptions.workerSrc = window.PDF_WORKER_URI;
				console.log('PDF.js worker configured:', window.PDF_WORKER_URI);
			} else {
				console.warn('PDF worker URI not set');
			}
			pdfJsReady = true;

			// Notify host that webview is ready
			vscode.postMessage({ type: 'ready' });

			// Process any pending load message
			if (pendingLoadMessage) {
				console.log('Processing pending PDF load');
				handleLoadPDF(pendingLoadMessage);
				pendingLoadMessage = null;
			}
		} else {
			retryCount++;
			if (retryCount >= MAX_RETRIES) {
				console.error('PDF.js failed to load after ' + MAX_RETRIES + ' attempts. Check CSP and script URLs.');
				console.error('Available scripts:', Array.from(document.scripts).map(s => s.src));
				return;
			}
			console.warn('PDF.js (pdfjsLib) not loaded yet, retrying... (' + retryCount + '/' + MAX_RETRIES + ')');
			// Retry after a short delay
			setTimeout(initPdfJs, 100);
		}
	}

	// Initialize PDF.js when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initPdfJs);
	} else {
		initPdfJs();
	}

	// Listen for messages from host
	window.addEventListener('message', async (event) => {
		const message = event.data;

		switch (message.type) {
			case 'loadPDF':
				if (pdfJsReady) {
					await handleLoadPDF(message);
				} else {
					console.log('PDF.js not ready yet, queuing load request');
					pendingLoadMessage = message;
				}
				break;
			case 'getState':
				// Host asking for current state
				const savedPageFromHost = message.savedPage || 1;
				vscode.postMessage({
					type: 'state',
					loadedPdfUri: loadedPdfUri,
					currentPage: currentPage,
					hasPDF: !!pdfDoc,
					savedPage: savedPageFromHost
				});

				// If we have the same PDF loaded but are on wrong page, navigate to saved page
				if (pdfDoc && loadedPdfUri === message.requestedUri && currentPage !== savedPageFromHost) {
					console.log('[PDF Viewer] Same PDF, navigating from page', currentPage, 'to saved page', savedPageFromHost);
					await renderPage(savedPageFromHost);
				}
				break;
			case 'goToPage':
				// Navigate to a specific page without reloading the PDF
				if (pdfDoc && message.page) {
					const targetPage = Math.max(1, Math.min(message.page, pdfDoc.numPages));
					console.log('[PDF Viewer] Navigating to saved page:', targetPage);
					await renderPage(targetPage);
				} else {
					console.warn('[PDF Viewer] Cannot navigate - PDF not loaded yet');
				}
				break;
			case 'clearPDF':
				pdfDoc = null;
				currentPage = 1;
				loadedPdfUri = null;
				pageCache.clear();
				if (ctx && canvas) {
					ctx.clearRect(0, 0, canvas.width, canvas.height);
				}
				break;
			case 'getSelectionRect':
				// Send back selection rectangle for Ctrl+K positioning
				const selection = window.getSelection();
				if (selection && selection.rangeCount > 0) {
					const range = selection.getRangeAt(0);
					const rect = range.getBoundingClientRect();
					vscode.postMessage({
						type: 'selectionRect',
						rect: {
							left: rect.left,
							top: rect.top,
							right: rect.right,
							bottom: rect.bottom,
							width: rect.width,
							height: rect.height
						}
					});
				} else {
					vscode.postMessage({
						type: 'selectionRect',
						rect: null
					});
				}
				break;
			case 'loadAnnotations':
				// Load annotations from host
				annotations = message.annotations || [];
				console.log('[PDF Viewer] Loaded annotations:', annotations.length);
				renderAnnotations();
				renderBookmarks();
				break;
		}
	});

	async function handleLoadPDF(message) {
		try {
			if (!pdfjsLib) {
				console.error('PDF.js not loaded');
				return;
			}
			console.log('Loading PDF...');

			// Get preload strategy and start page from message
			preloadStrategy = message.preloadStrategy || 'all';
			const startPage = message.startPage || 1;
			const skipPreload = message.skipPreload || false;
			console.log('PDF preload strategy:', preloadStrategy);
			console.log('PDF starting page:', startPage);
			console.log('PDF skip preload:', skipPreload);

			// Track the URI of this PDF
			loadedPdfUri = message.pdfUri;

			// Save state
			vscode.setState({
				currentPage: startPage,
				loadedPdfUri: loadedPdfUri,
				scale: scale
			});

			// Load PDF from base64 encoded data
			let uint8Array;
			if (message.encoding === 'base64') {
				// Decode base64 to binary string, then to Uint8Array
				const binaryString = atob(message.data);
				uint8Array = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					uint8Array[i] = binaryString.charCodeAt(i);
				}
			} else {
				// Fallback: assume it's already an array
				uint8Array = new Uint8Array(message.data);
			}

			console.log('PDF data size:', uint8Array.length, 'bytes');
			const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
			pdfDoc = await loadingTask.promise;
			console.log('PDF loaded successfully, pages:', pdfDoc.numPages);

			// Validate and clamp start page
			currentPage = Math.max(1, Math.min(startPage, pdfDoc.numPages));
			scale = 0.8;
			pageCache.clear();

			if (totalPagesSpan) {
				totalPagesSpan.textContent = pdfDoc.numPages.toString();
			}

			// Generate thumbnails and outline
			await generateThumbnails();
			await extractOutline();

			// Render saved page (or page 1 if invalid)
			await renderPage(currentPage);

			// Apply preload strategy (skip if we're just restoring state)
			if (!skipPreload) {
				if (preloadStrategy === 'all') {
					await preloadAllPages();
				} else if (preloadStrategy === 'adjacent') {
					await preloadAdjacentPages(currentPage);
				}
			}
			// 'on-demand' doesn't preload anything

			// Notify host that PDF is loaded so it can send annotations
			vscode.postMessage({ type: 'pdfLoaded' });

		} catch (error) {
			console.error('Error loading PDF:', error);
			vscode.postMessage({
				type: 'error',
				error: error.message
			});
		}
	}

	// Preload all pages into memory (aggressive strategy)
	async function preloadAllPages() {
		if (!pdfDoc) return;

		const maxPages = 500; // Safety limit
		if (pdfDoc.numPages > maxPages) {
			console.warn(`PDF has ${pdfDoc.numPages} pages, limiting preload to ${maxPages} for memory safety`);
		}

		const pagesToPreload = Math.min(pdfDoc.numPages, maxPages);
		console.log(`Preloading all ${pagesToPreload} pages into memory...`);

		const preloadPromises = [];
		for (let i = 1; i <= pagesToPreload; i++) {
			if (!pageCache.has(i)) {
				preloadPromises.push(
					pdfDoc.getPage(i).then(page => {
						pageCache.set(i, page);
					}).catch(err => {
						console.error(`Failed to preload page ${i}:`, err);
					})
				);
			}
		}

		await Promise.all(preloadPromises);
		console.log(`✓ All ${pagesToPreload} pages preloaded into memory!`);
	}

	// Preload adjacent pages (smart strategy)
	async function preloadAdjacentPages(centerPage) {
		if (!pdfDoc) return;

		const PRELOAD_RANGE = 2; // Preload ±2 pages
		const startPage = Math.max(1, centerPage - PRELOAD_RANGE);
		const endPage = Math.min(pdfDoc.numPages, centerPage + PRELOAD_RANGE);

		// Preload adjacent pages
		for (let i = startPage; i <= endPage; i++) {
			if (!pageCache.has(i)) {
				pdfDoc.getPage(i).then(page => {
					pageCache.set(i, page);
				}).catch(err => {
					console.error(`Failed to preload page ${i}:`, err);
				});
			}
		}

		// Clear old cache entries (keep only ±5 pages)
		const minKeep = Math.max(1, centerPage - 5);
		const maxKeep = Math.min(pdfDoc.numPages, centerPage + 5);
		for (let [pageNum] of pageCache) {
			if (pageNum < minKeep || pageNum > maxKeep) {
				pageCache.delete(pageNum);
			}
		}
	}

	async function renderPage(pageNum) {
		if (!pdfDoc || rendering) return;

		rendering = true;

		try {
			// Use cached page if available, otherwise fetch
			let page = pageCache.get(pageNum);
			if (!page) {
				page = await pdfDoc.getPage(pageNum);
				pageCache.set(pageNum, page);
			}

			const viewport = page.getViewport({ scale });

			// Render canvas first
			if (canvas && ctx) {
				canvas.height = viewport.height;
				canvas.width = viewport.width;

				const renderContext = {
					canvasContext: ctx,
					viewport: viewport
				};

				await page.render(renderContext).promise;
			}

			// Create/update highlight layer if it doesn't exist
			let highlightLayer = document.getElementById('pdf-highlight-layer');
			if (!highlightLayer) {
				highlightLayer = document.createElement('div');
				highlightLayer.id = 'pdf-highlight-layer';
				highlightLayer.style.position = 'absolute';
				highlightLayer.style.left = '0';
				highlightLayer.style.top = '0';
				highlightLayer.style.width = viewport.width + 'px';
				highlightLayer.style.height = viewport.height + 'px';
				// Layer itself has pointer-events: none, but individual highlights have pointer-events: auto
				highlightLayer.style.pointerEvents = 'none';
				highlightLayer.style.zIndex = '3'; // Above text layer

				// Insert after text layer so highlights are on top
				const renderContainer = document.getElementById('pdf-render-container');
				if (renderContainer && textLayer) {
					renderContainer.appendChild(highlightLayer);
				}
			} else {
				highlightLayer.style.width = viewport.width + 'px';
				highlightLayer.style.height = viewport.height + 'px';
			}

			// Render text layer for selection/copying
			if (textLayer) {
				// Clear previous text layer
				textLayer.innerHTML = '';

				// Set text layer dimensions to match canvas exactly
				textLayer.style.width = viewport.width + 'px';
				textLayer.style.height = viewport.height + 'px';

				// Set the scale factor CSS variable (required by PDF.js)
				textLayer.style.setProperty('--scale-factor', scale.toString());

				try {
					const textContent = await page.getTextContent();

					// Render text layer using PDF.js with enhanced options
					const textLayerRenderTask = pdfjsLib.renderTextLayer({
						textContentSource: textContent,
						container: textLayer,
						viewport: viewport,
						textDivs: [],
						enhanceTextSelection: true // Better selection precision
					});

					await textLayerRenderTask.promise;
					console.log('Text layer rendered successfully');

					// Fine-tune text positioning for better alignment
					improveTextLayerAlignment(textLayer, scale);
				} catch (error) {
					console.error('Error rendering text layer:', error);
				}
			}

			currentPage = pageNum;

			// Save state to persist across tab switches
			vscode.setState({
				currentPage: currentPage,
				loadedPdfUri: loadedPdfUri,
				scale: scale
			});

			// Update UI
			if (currentPageSpan) {
				currentPageSpan.textContent = currentPage.toString();
			}
			if (prevButton) {
				prevButton.disabled = currentPage <= 1;
			}
			if (nextButton) {
				nextButton.disabled = currentPage >= pdfDoc.numPages;
			}

			// Update active thumbnail
			updateActiveThumbnail(currentPage);

			// Notify host of page change
			vscode.postMessage({
				type: 'pageChanged',
				page: pageNum
			});

			// Preload adjacent pages if using adjacent strategy
			if (preloadStrategy === 'adjacent') {
				preloadAdjacentPages(pageNum);
			}

			// Render annotations for this page
			renderAnnotations();

		} catch (error) {
			console.error('Error rendering page:', error);
		} finally {
			rendering = false;
		}
	}

	// Improve text layer alignment for better selection precision
	function improveTextLayerAlignment(textLayerElement, currentScale) {
		const spans = textLayerElement.querySelectorAll('span');
		spans.forEach(span => {
			// Skip empty spans
			if (!span.textContent || span.textContent.trim().length === 0) {
				return;
			}

			// Get computed font size
			const computedStyle = window.getComputedStyle(span);
			const fontSize = parseFloat(computedStyle.fontSize);

			// Apply baseline correction (empirically determined)
			// This helps align text with the underlying canvas
			const baselineOffset = fontSize * 0.12 * currentScale;

			// Get existing transform or create new one
			const currentTransform = span.style.transform || '';
			if (!currentTransform.includes('translateY')) {
				span.style.transform = `${currentTransform} translateY(${baselineOffset}px)`.trim();
			}
		});
	}

	// Generate thumbnails for all pages (non-blocking batched rendering)
	async function generateThumbnails() {
		if (!pdfDoc || !thumbnailsContainer) {
			console.log('Skipping thumbnail generation - PDF not loaded or container missing');
			return;
		}

		thumbnailsContainer.innerHTML = '';
		console.log('Generating thumbnails for', pdfDoc.numPages, 'pages...');

		// Double-check pdfDoc is still valid
		if (!pdfDoc) {
			console.warn('PDF became null during thumbnail generation');
			return;
		}

		// Generate thumbnails in smaller batches with yielding to keep UI responsive
		const batchSize = 5;
		for (let i = 1; i <= pdfDoc.numPages; i += batchSize) {
			const batch = [];
			for (let j = i; j < Math.min(i + batchSize, pdfDoc.numPages + 1); j++) {
				batch.push(generateThumbnail(j));
			}
			await Promise.all(batch);

			// Yield to browser to keep UI responsive
			await new Promise(resolve => setTimeout(resolve, 0));
		}

		console.log('Thumbnails generated');
	}

	async function generateThumbnail(pageNum) {
		try {
			const page = await pdfDoc.getPage(pageNum);
			const viewport = page.getViewport({ scale: 0.2 }); // Small scale for thumbnails

			// Create thumbnail container
			const thumbItem = document.createElement('div');
			thumbItem.className = 'thumbnail-item';
			thumbItem.dataset.page = pageNum;

			// Create canvas for thumbnail
			const thumbCanvas = document.createElement('canvas');
			thumbCanvas.className = 'thumbnail-canvas';
			thumbCanvas.width = viewport.width;
			thumbCanvas.height = viewport.height;

			// Render thumbnail
			const thumbCtx = thumbCanvas.getContext('2d');
			await page.render({
				canvasContext: thumbCtx,
				viewport: viewport
			}).promise;

			// Create label
			const label = document.createElement('div');
			label.className = 'thumbnail-label';
			label.textContent = `Page ${pageNum}`;

			// Assemble thumbnail
			thumbItem.appendChild(thumbCanvas);
			thumbItem.appendChild(label);

			// Click handler
			thumbItem.addEventListener('click', () => {
				renderPage(pageNum);
			});

			thumbnailsContainer.appendChild(thumbItem);

			// Mark current page as active
			if (pageNum === currentPage) {
				thumbItem.classList.add('active');
			}
		} catch (error) {
			console.error('Error generating thumbnail for page', pageNum, error);
		}
	}

	function updateActiveThumbnail(pageNum) {
		const thumbnails = thumbnailsContainer.querySelectorAll('.thumbnail-item');
		thumbnails.forEach(thumb => {
			if (parseInt(thumb.dataset.page) === pageNum) {
				thumb.classList.add('active');
				// Scroll thumbnail into view
				thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			} else {
				thumb.classList.remove('active');
			}
		});
	}

	// Extract PDF outline (table of contents)
	async function extractOutline() {
		if (!pdfDoc || !outlineContainer) return;

		try {
			const outline = await pdfDoc.getOutline();

			if (!outline || outline.length === 0) {
				outlineContainer.innerHTML = '<div class="outline-empty">No outline available</div>';
				return;
			}

			console.log('PDF outline:', outline);
			outlineContainer.innerHTML = '';

			// Render outline items recursively
			renderOutlineItems(outline, outlineContainer, 1);
		} catch (error) {
			console.error('Error extracting outline:', error);
			outlineContainer.innerHTML = '<div class="outline-empty">Failed to load outline</div>';
		}
	}

	function renderOutlineItems(items, container, level) {
		items.forEach(item => {
			const outlineItem = document.createElement('div');
			outlineItem.className = `outline-item level-${Math.min(level, 3)}`;
			outlineItem.textContent = item.title;
			outlineItem.title = item.title; // Full title on hover

			// Click handler to navigate to destination
			if (item.dest) {
				outlineItem.style.cursor = 'pointer';
				outlineItem.addEventListener('click', async () => {
					try {
						// Get destination page
						let destPage;
						if (typeof item.dest === 'string') {
							destPage = await pdfDoc.getPageIndex(item.dest);
						} else if (Array.isArray(item.dest)) {
							const ref = item.dest[0];
							destPage = await pdfDoc.getPageIndex(ref);
						}

						if (destPage !== undefined) {
							renderPage(destPage + 1); // Page numbers are 1-indexed
						}
					} catch (error) {
						console.error('Error navigating to outline destination:', error);
					}
				});
			}

			container.appendChild(outlineItem);

			// Recursively render children
			if (item.items && item.items.length > 0) {
				renderOutlineItems(item.items, container, level + 1);
			}
		});
	}

	// Button handlers
	if (prevButton) {
		prevButton.addEventListener('click', () => {
			if (currentPage > 1) {
				renderPage(currentPage - 1);
			}
		});
	}

	if (nextButton) {
		nextButton.addEventListener('click', () => {
			if (pdfDoc && currentPage < pdfDoc.numPages) {
				renderPage(currentPage + 1);
			}
		});
	}

	// Zoom controls with wheel
	let isZooming = false;
	const canvasWrapper = document.getElementById('canvas-wrapper');
	if (canvasWrapper) {
		canvasWrapper.addEventListener('wheel', (e) => {
			// Only handle zoom with Ctrl key
			if (!e.ctrlKey) {
				return;
			}

			e.preventDefault();

			// Debounce zoom for performance
			if (isZooming) {
				return;
			}

			isZooming = true;

			// Calculate new scale
			const delta = e.deltaY > 0 ? 0.9 : 1.1;
			const newScale = Math.max(0.5, Math.min(3.0, scale * delta));

			// Only rerender if scale changed significantly
			if (Math.abs(newScale - scale) > 0.01) {
				scale = newScale;
				console.log(`[PDF Zoom] New scale: ${scale.toFixed(2)}`);

				// Rerender current page with new scale
				renderPage(currentPage).then(() => {
					isZooming = false;
				});
			} else {
				isZooming = false;
			}
		}, { passive: false });
	}

	if (zoomInButton) {
		zoomInButton.addEventListener('click', () => {
			scale *= 1.2;
			renderPage(currentPage);
		});
	}

	if (zoomOutButton) {
		zoomOutButton.addEventListener('click', () => {
			scale /= 1.2;
			renderPage(currentPage);
		});
	}

	// Print button handler
	const printButton = document.getElementById('print-btn');
	if (printButton) {
		printButton.addEventListener('click', () => {
			handlePrint();
		});
	}

	// Print function - opens original PDF in system browser for native printing
	// This is much more efficient than rendering pages to images
	function handlePrint() {
		if (!pdfDoc) {
			console.warn('[PDF Viewer] No PDF loaded for printing');
			return;
		}

		console.log('[PDF Viewer] Requesting print via system browser...');

		// Send request to host to open the original PDF in system browser
		// The browser can print PDFs natively, which is more efficient and higher quality
		vscode.postMessage({
			type: 'printPdf'
		});
		console.log('[PDF Viewer] Sent print request to host');
	}

	// Keyboard shortcut for print (Ctrl+P / Cmd+P)
	document.addEventListener('keydown', (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
			e.preventDefault();
			handlePrint();
		}
	});

	// Text selection handling (for Ctrl+K)
	document.addEventListener('mouseup', () => {
		const selection = window.getSelection();
		if (selection && selection.toString()) {
			vscode.postMessage({
				type: 'textSelected',
				selection: {
					startPage: currentPage,
					endPage: currentPage,
					text: selection.toString()
				}
			});
		} else {
			vscode.postMessage({
				type: 'clearSelection'
			});
		}
	});

	// Keyboard navigation
	document.addEventListener('keydown', (e) => {
		if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (currentPage > 1) {
				renderPage(currentPage - 1);
			}
		} else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
			e.preventDefault();
			if (pdfDoc && currentPage < pdfDoc.numPages) {
				renderPage(currentPage + 1);
			}
		}
	});

	// ==================== ANNOTATION FUNCTIONS ====================

	// Create a highlight annotation from the current text selection
	function createHighlightFromSelection() {
		const selection = window.getSelection();
		if (!selection || selection.isCollapsed || !loadedPdfUri) {
			return;
		}

		const selectedText = selection.toString().trim();
		if (!selectedText) {
			return;
		}

		// Get bounding boxes for all selected ranges
		const boundingBoxes = [];
		for (let i = 0; i < selection.rangeCount; i++) {
			const range = selection.getRangeAt(i);
			const rects = range.getClientRects();

			// Get the render container position for offset calculation
			const renderContainer = document.getElementById('pdf-render-container');
			const containerRect = renderContainer ? renderContainer.getBoundingClientRect() : { left: 0, top: 0 };

			for (let j = 0; j < rects.length; j++) {
				const rect = rects[j];
				// Convert to coordinates relative to the PDF canvas
				boundingBoxes.push({
					page: currentPage,
					x: (rect.left - containerRect.left) / scale,
					y: (rect.top - containerRect.top) / scale,
					width: rect.width / scale,
					height: rect.height / scale
				});
			}
		}

		if (boundingBoxes.length === 0) {
			return;
		}

		// Send annotation to host
		vscode.postMessage({
			type: 'addAnnotation',
			annotation: {
				pdfUri: loadedPdfUri,
				page: currentPage,
				text: selectedText,
				color: currentHighlightColor,
				boundingBoxes: boundingBoxes
			}
		});

		// Clear selection after highlighting
		selection.removeAllRanges();
	}

	// Render all annotations for the current page
	function renderAnnotations() {
		// Get or create the highlight layer
		let highlightLayer = document.getElementById('pdf-highlight-layer');
		if (!highlightLayer) {
			highlightLayer = document.createElement('div');
			highlightLayer.id = 'pdf-highlight-layer';
			highlightLayer.style.position = 'absolute';
			highlightLayer.style.left = '0';
			highlightLayer.style.top = '0';
			// Layer has pointer-events: none so clicks pass through to text layer
			// Individual highlights have pointer-events: auto so they're clickable
			highlightLayer.style.pointerEvents = 'none';
			highlightLayer.style.zIndex = '3'; // Above text layer

			const renderContainer = document.getElementById('pdf-render-container');
			if (renderContainer && canvas) {
				highlightLayer.style.width = canvas.width + 'px';
				highlightLayer.style.height = canvas.height + 'px';
				renderContainer.appendChild(highlightLayer);
			}
		}

		// Ensure layer is on top and positioned correctly
		highlightLayer.style.zIndex = '3';

		// Update size
		if (canvas) {
			highlightLayer.style.width = canvas.width + 'px';
			highlightLayer.style.height = canvas.height + 'px';
		}

		// Clear existing highlights
		highlightLayer.innerHTML = '';

		// Filter annotations for current page (excluding bookmarks)
		const pageAnnotations = annotations.filter(a =>
			a.page === currentPage && a.color !== 'bookmark'
		);

		// Render each annotation
		pageAnnotations.forEach(annotation => {
			annotation.boundingBoxes.forEach(box => {
				if (box.page === currentPage) {
					const highlight = document.createElement('div');
					highlight.className = 'pdf-highlight';
					highlight.dataset.annotationId = annotation.id;

					// Position and size (scale to current zoom level)
					highlight.style.position = 'absolute';
					highlight.style.left = (box.x * scale) + 'px';
					highlight.style.top = (box.y * scale) + 'px';
					highlight.style.width = (box.width * scale) + 'px';
					highlight.style.height = (box.height * scale) + 'px';

					// Color
					const colorMap = {
						yellow: 'rgba(255, 235, 59, 0.4)',
						green: 'rgba(76, 175, 80, 0.4)',
						blue: 'rgba(33, 150, 243, 0.4)',
						pink: 'rgba(233, 30, 99, 0.4)'
					};
					highlight.style.backgroundColor = colorMap[annotation.color] || colorMap.yellow;
					highlight.style.mixBlendMode = 'multiply';
					highlight.style.cursor = 'pointer';
					highlight.style.borderRadius = '2px';
					// CRITICAL: Enable pointer events on individual highlights
					// (parent layer has pointer-events: none for text selection to work)
					highlight.style.pointerEvents = 'auto';

					// Click to select
					highlight.addEventListener('click', (e) => {
						e.stopPropagation();
						selectAnnotation(annotation.id);
					});

					// Show note on hover if present
					if (annotation.note) {
						highlight.title = annotation.note;
					}

					highlightLayer.appendChild(highlight);
				}
			});
		});
	}

	// Select an annotation (for editing/deletion)
	function selectAnnotation(annotationId) {
		// Deselect previous
		document.querySelectorAll('.pdf-highlight.selected').forEach(el => {
			el.classList.remove('selected');
			el.style.outline = 'none';
		});

		selectedAnnotationId = annotationId;

		// Highlight selected annotation
		document.querySelectorAll(`.pdf-highlight[data-annotation-id="${annotationId}"]`).forEach(el => {
			el.classList.add('selected');
			el.style.outline = '2px solid var(--vscode-focusBorder, #007acc)';
		});
	}

	// Render bookmarks in the sidebar
	function renderBookmarks() {
		if (!bookmarksContainer) {
			return;
		}

		// Clear existing bookmarks
		bookmarksContainer.innerHTML = '';

		// Filter bookmark annotations
		const bookmarks = annotations.filter(a => a.color === 'bookmark');

		if (bookmarks.length === 0) {
			bookmarksContainer.innerHTML = '<div class="bookmarks-empty">No bookmarks yet</div>';
			return;
		}

		// Sort by page number
		bookmarks.sort((a, b) => a.page - b.page);

		// Render each bookmark
		bookmarks.forEach(bookmark => {
			const item = document.createElement('div');
			item.className = 'bookmark-item';
			item.dataset.annotationId = bookmark.id;

			const label = document.createElement('span');
			label.className = 'bookmark-label';
			label.textContent = bookmark.text || `Page ${bookmark.page}`;

			const pageNum = document.createElement('span');
			pageNum.className = 'bookmark-page';
			pageNum.textContent = `p.${bookmark.page}`;

			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'bookmark-delete';
			deleteBtn.textContent = '×';
			deleteBtn.title = 'Delete bookmark';
			deleteBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				vscode.postMessage({
					type: 'deleteAnnotation',
					annotationId: bookmark.id
				});
			});

			item.appendChild(label);
			item.appendChild(pageNum);
			item.appendChild(deleteBtn);

			// Click to navigate
			item.addEventListener('click', () => {
				renderPage(bookmark.page);
			});

			bookmarksContainer.appendChild(item);
		});
	}

	// Click anywhere to deselect (except on highlights or annotation toolbar)
	document.addEventListener('click', (e) => {
		// Don't deselect if clicking on a highlight, the delete button, or highlight buttons
		if (!e.target.closest('.pdf-highlight') &&
			!e.target.closest('#delete-highlight') &&
			!e.target.closest('.highlight-btn') &&
			!e.target.closest('#annotation-toolbar')) {
			selectedAnnotationId = null;
			document.querySelectorAll('.pdf-highlight.selected').forEach(el => {
				el.classList.remove('selected');
				el.style.outline = 'none';
			});
		}
	});
})();
