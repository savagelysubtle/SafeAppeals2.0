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
	const prevButton = document.getElementById('prev-page');
	const nextButton = document.getElementById('next-page');
	const zoomInButton = document.getElementById('zoom-in');
	const zoomOutButton = document.getElementById('zoom-out');
	const currentPageSpan = document.getElementById('current-page');
	const totalPagesSpan = document.getElementById('total-pages');

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

			if (canvas && ctx) {
				canvas.height = viewport.height;
				canvas.width = viewport.width;

				const renderContext = {
					canvasContext: ctx,
					viewport: viewport
				};

				await page.render(renderContext).promise;
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

