// PDF Viewer Webview Script
(function () {
	// Communication with host
	const vscode = acquireVsCodeApi();

	let pdfDoc = null;
	let currentPage = 1;
	let scale = 1.5;
	let rendering = false;
	let pdfJsReady = false;
	let pendingLoadMessage = null;

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
			if (tabName === 'thumbnails') {
				thumbnailsView.classList.add('active');
				outlineView.classList.remove('active');
			} else if (tabName === 'outline') {
				thumbnailsView.classList.remove('active');
				outlineView.classList.add('active');
			}
		});
	});

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
			case 'clearPDF':
				pdfDoc = null;
				currentPage = 1;
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
		}
	});

	async function handleLoadPDF(message) {
		try {
			if (!pdfjsLib) {
				console.error('PDF.js not loaded');
				return;
			}
			console.log('Loading PDF...');

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

			currentPage = 1;
			scale = 1.5;
			if (totalPagesSpan) {
				totalPagesSpan.textContent = pdfDoc.numPages.toString();
			}

			// Generate thumbnails and outline
			await generateThumbnails();
			await extractOutline();

			await renderPage(1);
		} catch (error) {
			console.error('Error loading PDF:', error);
			vscode.postMessage({
				type: 'error',
				error: error.message
			});
		}
	}

	async function renderPage(pageNum) {
		if (!pdfDoc || rendering) return;

		rendering = true;

		try {
			const page = await pdfDoc.getPage(pageNum);
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
				} catch (error) {
					console.error('Error rendering text layer:', error);
				}
			}

			currentPage = pageNum;

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
		} catch (error) {
			console.error('Error rendering page:', error);
		} finally {
			rendering = false;
		}
	}

	// Generate thumbnails for all pages
	async function generateThumbnails() {
		if (!pdfDoc || !thumbnailsContainer) return;

		thumbnailsContainer.innerHTML = '';
		console.log('Generating thumbnails for', pdfDoc.numPages, 'pages...');

		// Generate thumbnails in batches to avoid blocking
		const batchSize = 10;
		for (let i = 1; i <= pdfDoc.numPages; i += batchSize) {
			const batch = [];
			for (let j = i; j < Math.min(i + batchSize, pdfDoc.numPages + 1); j++) {
				batch.push(generateThumbnail(j));
			}
			await Promise.all(batch);
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

			// Mark first page as active
			if (pageNum === 1) {
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
})();

