// DOCX Viewer Webview Script - MS Word Style Edition
(function () {
	const vscode = acquireVsCodeApi();

	let tiptapEditor = null;
	let contentModified = false;
	let docxUri = null;
	let currentZoom = 100;
	let currentPage = 1;
	let totalPages = 1;
	let activeRibbonTab = 'home';

	// Debounce timer for content change notifications
	let contentChangeDebounceTimer = null;
	const CONTENT_CHANGE_DEBOUNCE_MS = 300;

	// Page dimensions at 96 DPI
	const PAGE_SIZES = {
		letter: { width: 816, height: 1056, cssWidth: '8.5in', cssHeight: '11in' },
		legal: { width: 816, height: 1344, cssWidth: '8.5in', cssHeight: '14in' },
		tabloid: { width: 1056, height: 1632, cssWidth: '11in', cssHeight: '17in' },
		a4: { width: 794, height: 1123, cssWidth: '210mm', cssHeight: '297mm' },
		a3: { width: 1123, height: 1587, cssWidth: '297mm', cssHeight: '420mm' },
	};

	// Margin presets in pixels (96 DPI)
	const MARGIN_PRESETS = {
		normal: { top: 96, right: 96, bottom: 96, left: 96 },
		narrow: { top: 48, right: 48, bottom: 48, left: 48 },
		moderate: { top: 96, right: 72, bottom: 96, left: 72 },
		wide: { top: 96, right: 192, bottom: 96, left: 192 },
	};

	// Get DOM elements
	const container = document.getElementById('docx-container');
	if (container) container.classList.add('void-scrollbar');

	const saveBtn = document.getElementById('save-btn');
	const statusText = document.getElementById('status-text');
	const pageSizeSelect = document.getElementById('page-size-select');
	const marginPresetSelect = document.getElementById('margin-preset-select');
	const rulerContainer = document.getElementById('docx-ruler-container');
	const ruler = document.getElementById('docx-ruler');
	const pageCountDisplay = document.getElementById('page-count-display');
	const zoomDisplay = document.getElementById('zoom-display');
	const zoomSlider = document.getElementById('zoom-slider');

	// Formatting buttons
	const boldBtn = document.getElementById('bold-btn');
	const italicBtn = document.getElementById('italic-btn');
	const underlineBtn = document.getElementById('underline-btn');
	const heading1Btn = document.getElementById('heading1-btn');
	const heading2Btn = document.getElementById('heading2-btn');
	const pageBreakBtn = document.getElementById('page-break-btn');

	// Debounced content change notification
	function notifyContentChanged() {
		if (contentChangeDebounceTimer) {
			clearTimeout(contentChangeDebounceTimer);
		}
		contentChangeDebounceTimer = setTimeout(() => {
			sendContentUpdate();
			contentChangeDebounceTimer = null;
		}, CONTENT_CHANGE_DEBOUNCE_MS);
	}

	async function sendContentUpdate() {
		if (!tiptapEditor) return;
		try {
			const blob = await tiptapEditor.saveToDocx();
			const arrayBuffer = await blob.arrayBuffer();
			const uint8Array = new Uint8Array(arrayBuffer);
			let binaryString = '';
			for (let i = 0; i < uint8Array.length; i++) {
				binaryString += String.fromCharCode(uint8Array[i]);
			}
			const base64 = btoa(binaryString);
			vscode.postMessage({
				type: 'contentChanged',
				docxData: base64,
				data: base64 // support both
			});
		} catch (e) {
			console.error("[DOCX Webview] Failed to serialize content for update:", e);
		}
	}

	// Flush updates on visibility change or blur
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) {
			sendContentUpdate();
		}
	});
	window.addEventListener("blur", () => {
		sendContentUpdate();
	});

	// Track modification state (with debouncing)
	function trackModification() {
		if (!contentModified) {
			contentModified = true;
			updateStatus('Modified');
		}
		// Always debounce the notification to host
		notifyContentChanged();
	}

	function updateStatus(text) {
		if (statusText) {
			statusText.textContent = text;
		}
	}

	// ============================================
	// PAGE NUMBER TRACKING
	// ============================================

	function updatePageCount() {
		if (!tiptapEditor || !tiptapEditor.editor) return;

		// Count pages directly from the DOM if PageExtension is active
		// The extension creates elements with class 'Page' (or similar, checking for common classes)
		const pages = container.querySelectorAll('.Page, [data-page], .page-wrapper, page');

		console.log('[DOCX Webview] Detected pages:', pages.length, 'Selector matched:', pages);

		if (pages.length > 0) {
			totalPages = pages.length;
		} else {
			// Fallback estimation
			const editorElement = container.querySelector('.ProseMirror');
			if (!editorElement) return;

			const pageSize = pageSizeSelect ? pageSizeSelect.value : 'letter';
			const pageHeight = PAGE_SIZES[pageSize]?.height || 1056;
			const marginPreset = marginPresetSelect ? marginPresetSelect.value : 'normal';
			const margins = MARGIN_PRESETS[marginPreset] || MARGIN_PRESETS.normal;
			const contentHeight = pageHeight - margins.top - margins.bottom;

			const scrollHeight = editorElement.scrollHeight;
			totalPages = Math.max(1, Math.ceil(scrollHeight / contentHeight));
		}

		// Update page count display
		if (pageCountDisplay) {
			pageCountDisplay.textContent = `Page ${currentPage} of ${totalPages}`;
		}

		// Update page footers if they exist
		updatePageFooters();
	}

	function updatePageFooters() {
		const pageFooters = container.querySelectorAll('.page-footer .page-number-display');
		pageFooters.forEach((footer, index) => {
			footer.textContent = `Page ${index + 1} of ${totalPages}`;
		});
	}

	// ============================================
	// VISUAL PAGE SPLITTING
	// Handled by @adalat-ai/page-extension
	// ============================================

	// Manual pagination logic removed in favor of PageExtension


	// ============================================
	// RULER FUNCTIONS
	// ============================================

	function initializeRuler() {
		if (!ruler) return;

		const pageSize = pageSizeSelect ? pageSizeSelect.value : 'letter';
		const marginPreset = marginPresetSelect ? marginPresetSelect.value : 'normal';

		renderRuler(pageSize, marginPreset);
	}

	function renderRuler(pageSize, marginPreset) {
		if (!ruler) return;

		// Clear existing ruler content
		ruler.innerHTML = '';

		const pageDimensions = PAGE_SIZES[pageSize] || PAGE_SIZES.letter;
		const margins = MARGIN_PRESETS[marginPreset] || MARGIN_PRESETS.normal;

		// Set ruler width to match page
		ruler.style.width = pageDimensions.cssWidth;

		// Calculate inches for Letter (8.5in)
		const widthInches = pageSize === 'a4' || pageSize === 'a3' ?
			(pageDimensions.width / 96 * 2.54) : // cm for A sizes
			(pageDimensions.width / 96); // inches

		const isMetric = pageSize === 'a4' || pageSize === 'a3';
		const unit = isMetric ? 'cm' : 'in';
		const divisions = isMetric ? 10 : 8; // 10 for cm, 8 for inches

		// Add margin indicators
		const leftMargin = document.createElement('div');
		leftMargin.className = 'ruler-margin left';
		leftMargin.style.width = `${margins.left}px`;
		ruler.appendChild(leftMargin);

		const rightMargin = document.createElement('div');
		rightMargin.className = 'ruler-margin right';
		rightMargin.style.width = `${margins.right}px`;
		ruler.appendChild(rightMargin);

		// Add tick marks
		const totalUnits = Math.ceil(widthInches);
		const tickSpacing = pageDimensions.width / totalUnits / divisions;

		for (let i = 0; i <= totalUnits * divisions; i++) {
			const tick = document.createElement('div');
			tick.className = 'ruler-tick';

			if (i % divisions === 0) {
				tick.classList.add('major');
				// Add number label
				const num = document.createElement('div');
				num.className = 'ruler-number';
				num.textContent = i / divisions;
				num.style.left = `${i * tickSpacing}px`;
				ruler.appendChild(num);
			} else if (i % (divisions / 2) === 0) {
				tick.classList.add('half');
			} else {
				tick.classList.add('minor');
			}

			tick.style.left = `${i * tickSpacing}px`;
			ruler.appendChild(tick);
		}
	}

	// ============================================
	// RIBBON TAB FUNCTIONS
	// ============================================

	function initializeRibbon() {
		const ribbonTabs = document.querySelectorAll('.ribbon-tab');
		const ribbonPanels = document.querySelectorAll('.ribbon-panel');

		ribbonTabs.forEach(tab => {
			tab.addEventListener('click', () => {
				const tabId = tab.dataset.tab;
				switchRibbonTab(tabId);
			});
		});
	}

	function switchRibbonTab(tabId) {
		activeRibbonTab = tabId;

		// Update tab active states
		const ribbonTabs = document.querySelectorAll('.ribbon-tab');
		ribbonTabs.forEach(tab => {
			tab.classList.toggle('active', tab.dataset.tab === tabId);
		});

		// Update panel visibility
		const ribbonPanels = document.querySelectorAll('.ribbon-panel');
		ribbonPanels.forEach(panel => {
			panel.classList.toggle('active', panel.dataset.panel === tabId);
		});
	}

	// ============================================
	// ZOOM FUNCTIONS
	// ============================================

	function setZoom(zoomLevel) {
		currentZoom = Math.min(200, Math.max(50, zoomLevel));

		const editorElement = container.querySelector('.tiptap-editor, .ProseMirror');
		if (editorElement) {
			editorElement.style.transform = `scale(${currentZoom / 100})`;
			editorElement.style.transformOrigin = 'top center';
		}

		if (zoomDisplay) {
			zoomDisplay.textContent = `${currentZoom}%`;
		}

		if (zoomSlider) {
			zoomSlider.value = currentZoom;
		}
	}

	// Initialize zoom slider if present
	if (zoomSlider) {
		zoomSlider.addEventListener('input', (e) => {
			setZoom(parseInt(e.target.value, 10));
		});
	}

	// Initialize Tiptap editor
	function initializeTiptapEditor() {
		console.log('[DOCX Webview] Initializing Tiptap editor');

		try {
			// Get page dimensions based on selected size
			const pageSize = pageSizeSelect ? pageSizeSelect.value : 'letter';
			const marginPreset = marginPresetSelect ? marginPresetSelect.value : 'normal';
			const margin = getMarginPixels(marginPreset);
			const orientationSelect = document.getElementById('orientation-select');
			const orientation = orientationSelect ? orientationSelect.value : 'portrait';

			// Configure page height precisely for visual breaks (Letter = 11in = 1056px @ 96 DPI)
			// Subtracting a small buffer to ensure breaks happen before visual overflow
			const pageHeight = PAGE_SIZES[pageSize]?.height || 1056;

			// Create Tiptap editor with pagination
			tiptapEditor = new window.TiptapDocxEditor(container, {
				pageSize: pageSize,
				orientation: orientation,
				margin: margin,
				enableAutoPageBreaks: true,
				onContentChange: () => {
					// Use debounced trackModification to avoid excessive IPC calls
					trackModification();
					// Update page count on content change
					updatePageCount();
					// Update word count
					updateWordCount();
				},
			});

			// Set initial CSS variable for margin styling
			document.documentElement.style.setProperty('--docx-margin', `${margin}px`);
			console.log('[DOCX Webview] Set --docx-margin CSS variable to:', margin, 'px');

			// Ensure editor is editable immediately after creation
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.setEditable(true);
				console.log('[DOCX Webview] Tiptap editor initialized and set to editable:', tiptapEditor.editor.isEditable);
			}

			// Initialize ruler
			initializeRuler();

			// Initialize ribbon tabs
			initializeRibbon();

			// Initial page count and word count
			setTimeout(() => {
				updatePageCount();
				updateWordCount();
			}, 100);

			updateStatus('Ready');

		} catch (error) {
			console.error('[DOCX Webview] Failed to initialize Tiptap:', error);
			updateStatus('Error initializing editor');
		}
	}

	function getPageDimensions(pageSize) {
		return PAGE_SIZES[pageSize] || PAGE_SIZES.letter;
	}

	function getMarginPixels(preset) {
		const margins = MARGIN_PRESETS[preset] || MARGIN_PRESETS.normal;
		return margins.left; // Return single value for compatibility
	}

	// Handle loading DOCX
	async function handleLoadDOCX(message) {
		console.log('[DOCX Webview] Loading DOCX');
		updateStatus('Loading document...');

		try {
			// Decode base64 data
			const binaryString = atob(message.data);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

		// Load into Tiptap
		await tiptapEditor.loadFromDocx(bytes.buffer);

		// Ensure editor is editable after loading content
		if (tiptapEditor && tiptapEditor.editor) {
			tiptapEditor.editor.setEditable(true);
			console.log('[DOCX Webview] Editor confirmed editable after load:', tiptapEditor.editor.isEditable);
		}

		docxUri = message.docxUri;
		contentModified = false;
		updateStatus('Document loaded');
		console.log('[DOCX Webview] DOCX loaded successfully');

		// Update counts after a short delay to let DOM settle
		setTimeout(() => {
			updatePageCount();
		}, 100);

		} catch (error) {
			console.error('[DOCX Webview] Failed to load DOCX:', error);
			updateStatus('Error loading document');
		}
	}

	// Handle save request
	async function handleSaveRequest() {
		console.log('[DOCX Webview] Save requested');
		updateStatus('Saving...');

		try {
			if (!tiptapEditor) {
				throw new Error('Editor not initialized');
			}

			// Export to DOCX blob
			const blob = await tiptapEditor.saveToDocx();

			// Convert blob to base64
			const arrayBuffer = await blob.arrayBuffer();
			const uint8Array = new Uint8Array(arrayBuffer);
			let binaryString = '';
			for (let i = 0; i < uint8Array.length; i++) {
				binaryString += String.fromCharCode(uint8Array[i]);
			}
			const base64 = btoa(binaryString);

			// Get plain text as fallback
			const text = tiptapEditor.getText();
			const html = tiptapEditor.getHTML();

			// Send to host
			vscode.postMessage({
				type: 'saveRequested',
				docxData: base64,
				text: text,
				html: html,
				docxUri: docxUri,
			});

		} catch (error) {
			console.error('[DOCX Webview] Failed to save:', error);
			updateStatus('Error saving document');

			// Send text-only fallback
			vscode.postMessage({
				type: 'saveRequested',
				text: tiptapEditor ? tiptapEditor.getText() : '',
				html: tiptapEditor ? tiptapEditor.getHTML() : '',
				docxUri: docxUri,
			});
		}
	}

	function handleSaveComplete(message) {
		if (message.success) {
			contentModified = false;
			updateStatus('Saved');
			console.log('[DOCX Webview] Save successful');
		} else {
			updateStatus(`Save failed: ${message.error || 'Unknown error'}`);
			console.error('[DOCX Webview] Save failed:', message.error);
		}
	}

	// Page size selector
	if (pageSizeSelect) {
		pageSizeSelect.addEventListener('change', () => {
			const pageSize = pageSizeSelect.value;
			const marginPreset = marginPresetSelect ? marginPresetSelect.value : 'normal';
			console.log('[DOCX Webview] Page size changed to:', pageSize);

			if (tiptapEditor) {
				tiptapEditor.setPageSize(pageSize);
				trackModification();
			}

			// Update ruler to match new page size
			renderRuler(pageSize, marginPreset);

			// Update page count
			updatePageCount();
		});
	}

	// Margin preset selector
	if (marginPresetSelect) {
		marginPresetSelect.addEventListener('change', () => {
			const pageSize = pageSizeSelect ? pageSizeSelect.value : 'letter';
			const marginPreset = marginPresetSelect.value;
			console.log('[DOCX Webview] Margin preset changed to:', marginPreset);

			if (tiptapEditor) {
				const margin = getMarginPixels(marginPreset);
				tiptapEditor.setMargin(margin);
				trackModification();

				// Update CSS variable for margin styling
				document.documentElement.style.setProperty('--docx-margin', `${margin}px`);
			}

			// Update ruler to match new margins
			renderRuler(pageSize, marginPreset);

			// Update page count
			updatePageCount();
		});
	}

	// Save button
	if (saveBtn) {
		saveBtn.addEventListener('click', handleSaveRequest);
	}

	// Print button
	const printBtn = document.getElementById('print-btn');
	if (printBtn) {
		printBtn.addEventListener('click', handlePrint);
	}

	// Print function - exports HTML and prints
	async function handlePrint() {
		if (!tiptapEditor) {
			console.warn('[DOCX Webview] Editor not initialized for printing');
			return;
		}

		console.log('[DOCX Webview] Starting print process...');

		try {
			// Create hidden iframe for printing
			const printFrame = document.createElement('iframe');
			printFrame.style.position = 'absolute';
			printFrame.style.left = '-9999px';
			printFrame.style.width = '0';
			printFrame.style.height = '0';
			printFrame.style.border = 'none';
			printFrame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-modals');
			document.body.appendChild(printFrame);

			// Get HTML content from Tiptap editor
			const htmlContent = tiptapEditor.getHTML();

			// Get current page settings
			const pageSize = pageSizeSelect ? pageSizeSelect.value : 'letter';
			const marginPreset = marginPresetSelect ? marginPresetSelect.value : 'normal';

			// Page dimensions in CSS
			const pageSizes = {
				letter: { width: '8.5in', height: '11in' },
				legal: { width: '8.5in', height: '14in' },
				tabloid: { width: '11in', height: '17in' },
				a4: { width: '210mm', height: '297mm' },
				a3: { width: '297mm', height: '420mm' }
			};

			const margins = {
				normal: '1in',
				narrow: '0.5in',
				moderate: '0.75in',
				wide: '2in'
			};

			const pageStyle = pageSizes[pageSize] || pageSizes.letter;
			const marginStyle = margins[marginPreset] || margins.normal;

			// Build print HTML with proper styling
			const printHTML = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="UTF-8">
					<title>Print Document</title>
					<style>
						@page {
							size: ${pageStyle.width} ${pageStyle.height};
							margin: ${marginStyle};
						}
						body {
							margin: 0;
							padding: 0;
							font-family: 'Calibri', 'Arial', sans-serif;
							font-size: 11pt;
							line-height: 1.5;
							color: #000;
							background: #fff;
						}
						.ProseMirror {
							outline: none;
							white-space: pre-wrap;
							word-wrap: break-word;
						}
						h1 { font-size: 24pt; margin: 12pt 0; font-weight: bold; }
						h2 { font-size: 18pt; margin: 10pt 0; font-weight: bold; }
						h3 { font-size: 14pt; margin: 8pt 0; font-weight: bold; }
						h4 { font-size: 12pt; margin: 6pt 0; font-weight: bold; }
						p { margin: 0 0 10pt 0; }
						ul, ol { margin: 0 0 10pt 0; padding-left: 40px; }
						li { margin: 0 0 5pt 0; }
						strong { font-weight: bold; }
						em { font-style: italic; }
						u { text-decoration: underline; }
						s { text-decoration: line-through; }
						.page-break { page-break-after: always; }
						@media print {
							body { margin: 0; }
						}
					</style>
				</head>
				<body>
					<div class="ProseMirror">
						${htmlContent}
					</div>
				</body>
				</html>
			`;

			// Write to iframe and trigger print
			const doc = printFrame.contentDocument || printFrame.contentWindow.document;
			doc.open();
			doc.write(printHTML);
			doc.close();

			// Wait for content to load, then print
			setTimeout(() => {
				printFrame.contentWindow.focus();
				printFrame.contentWindow.print();

				// Cleanup after print dialog closes
				setTimeout(() => {
					document.body.removeChild(printFrame);
					console.log('[DOCX Webview] Print process complete');
				}, 1000);
			}, 500);

		} catch (error) {
			console.error('[DOCX Webview] Print error:', error);
		}
	}

	// Formatting buttons
	const undoBtn = document.getElementById('undo-btn');
	const redoBtn = document.getElementById('redo-btn');
	const strikethroughBtn = document.getElementById('strikethrough-btn');
	const bulletListBtn = document.getElementById('bullet-list-btn');
	const orderedListBtn = document.getElementById('ordered-list-btn');
	const alignLeftBtn = document.getElementById('align-left-btn');
	const alignCenterBtn = document.getElementById('align-center-btn');
	const alignRightBtn = document.getElementById('align-right-btn');
	const textStyleSelect = document.getElementById('text-style-select');

	// Existing buttons
	if (boldBtn) {
		boldBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleBold().run();
				trackModification();
			}
		});
	}

	if (italicBtn) {
		italicBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleItalic().run();
				trackModification();
			}
		});
	}

	if (underlineBtn) {
		underlineBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleUnderline().run();
				trackModification();
			}
		});
	}

	// New buttons
	if (undoBtn) {
		undoBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().undo().run();
			}
		});
	}

	if (redoBtn) {
		redoBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().redo().run();
			}
		});
	}

	if (strikethroughBtn) {
		strikethroughBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleStrike().run();
				trackModification();
			}
		});
	}

	if (bulletListBtn) {
		bulletListBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleBulletList().run();
				trackModification();
			}
		});
	}

	if (orderedListBtn) {
		orderedListBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleOrderedList().run();
				trackModification();
			}
		});
	}

	if (alignLeftBtn) {
		alignLeftBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().setTextAlign('left').run();
				trackModification();
			}
		});
	}

	if (alignCenterBtn) {
		alignCenterBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().setTextAlign('center').run();
				trackModification();
			}
		});
	}

	if (alignRightBtn) {
		alignRightBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().setTextAlign('right').run();
				trackModification();
			}
		});
	}

	if (textStyleSelect) {
		textStyleSelect.addEventListener('change', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				const value = textStyleSelect.value;
				switch (value) {
					case 'paragraph':
						tiptapEditor.editor.chain().focus().setParagraph().run();
						break;
					case 'heading1':
						tiptapEditor.editor.chain().focus().toggleHeading({ level: 1 }).run();
						break;
					case 'heading2':
						tiptapEditor.editor.chain().focus().toggleHeading({ level: 2 }).run();
						break;
					case 'heading3':
						tiptapEditor.editor.chain().focus().toggleHeading({ level: 3 }).run();
						break;
					case 'heading4':
						tiptapEditor.editor.chain().focus().toggleHeading({ level: 4 }).run();
						break;
				}
				trackModification();
			}
		});
	}

	// Remove old heading buttons
	if (heading1Btn) {
		heading1Btn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleHeading({ level: 1 }).run();
				trackModification();
			}
		});
	}

	if (heading2Btn) {
		heading2Btn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleHeading({ level: 2 }).run();
				trackModification();
			}
		});
	}

	if (pageBreakBtn) {
		pageBreakBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().setHardBreak().run();
				trackModification();
			}
		});
	}

	// ============================================
	// ZOOM CONTROLS
	// ============================================

	const zoomInBtn = document.getElementById('zoom-in-btn');
	const zoomOutBtn = document.getElementById('zoom-out-btn');

	if (zoomInBtn) {
		zoomInBtn.addEventListener('click', () => {
			setZoom(currentZoom + 10);
		});
	}

	if (zoomOutBtn) {
		zoomOutBtn.addEventListener('click', () => {
			setZoom(currentZoom - 10);
		});
	}

	// ============================================
	// FONT CONTROLS (NOTE: Requires TextStyle extension)
	// ============================================

	const fontFamilySelect = document.getElementById('font-family-select');
	const fontSizeSelect = document.getElementById('font-size-select');
	const fontColorPicker = document.getElementById('font-color-picker');

	if (fontFamilySelect) {
		fontFamilySelect.addEventListener('change', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				// Note: Requires @tiptap/extension-font-family
				const fontFamily = fontFamilySelect.value;
				try {
					tiptapEditor.editor.chain().focus().setFontFamily(fontFamily).run();
					trackModification();
				} catch (e) {
					console.warn('[DOCX Webview] Font family extension not available');
				}
			}
		});
	}

	if (fontSizeSelect) {
		fontSizeSelect.addEventListener('change', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				// Note: Requires custom font size extension
				const fontSize = fontSizeSelect.value + 'pt';
				try {
					// Try to set font size via mark if available
					const editorElement = container.querySelector('.ProseMirror');
					if (editorElement) {
						editorElement.style.fontSize = fontSize;
					}
					trackModification();
				} catch (e) {
					console.warn('[DOCX Webview] Font size change failed');
				}
			}
		});
	}

	if (fontColorPicker) {
		fontColorPicker.addEventListener('input', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				const color = fontColorPicker.value;
				try {
					// Note: Requires @tiptap/extension-color
					tiptapEditor.editor.chain().focus().setColor(color).run();
					trackModification();
				} catch (e) {
					console.warn('[DOCX Webview] Color extension not available');
				}
			}
		});
	}

	// ============================================
	// INSERT CONTROLS
	// ============================================

	const insertTableBtn = document.getElementById('insert-table-btn');
	const insertImageBtn = document.getElementById('insert-image-btn');
	const insertLinkBtn = document.getElementById('insert-link-btn');
	const insertHrBtn = document.getElementById('insert-hr-btn');

	if (insertTableBtn) {
		insertTableBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				try {
					// Note: Requires @tiptap/extension-table
					tiptapEditor.editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run();
					trackModification();
				} catch (e) {
					console.warn('[DOCX Webview] Table extension not available');
					alert('Table insertion requires the Table extension');
				}
			}
		});
	}

	if (insertImageBtn) {
		insertImageBtn.addEventListener('click', () => {
			// TODO: Implement image upload dialog
			console.log('[DOCX Webview] Image insertion requested');
			alert('Image insertion coming soon');
		});
	}

	if (insertLinkBtn) {
		insertLinkBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				const url = prompt('Enter URL:');
				if (url) {
					try {
						tiptapEditor.editor.chain().focus().setLink({ href: url }).run();
						trackModification();
					} catch (e) {
						console.warn('[DOCX Webview] Link extension not available');
					}
				}
			}
		});
	}

	if (insertHrBtn) {
		insertHrBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				try {
					tiptapEditor.editor.chain().focus().setHorizontalRule().run();
					trackModification();
				} catch (e) {
					console.warn('[DOCX Webview] HorizontalRule extension not available');
				}
			}
		});
	}

	// ============================================
	// ORIENTATION CONTROLS (placeholder)
	// ============================================

	const orientationPortraitBtn = document.getElementById('orientation-portrait-btn');
	const orientationLandscapeBtn = document.getElementById('orientation-landscape-btn');

	if (orientationPortraitBtn) {
		orientationPortraitBtn.addEventListener('click', () => {
			// TODO: Implement orientation change
			console.log('[DOCX Webview] Portrait orientation requested');
		});
	}

	if (orientationLandscapeBtn) {
		orientationLandscapeBtn.addEventListener('click', () => {
			// TODO: Implement orientation change
			console.log('[DOCX Webview] Landscape orientation requested');
		});
	}

	// ============================================
	// WORD COUNT
	// ============================================

	const wordCountDisplay = document.getElementById('word-count-display');

	function updateWordCount() {
		if (!tiptapEditor || !tiptapEditor.editor) return;

		const text = tiptapEditor.getText();
		const words = text.trim().split(/\s+/).filter(word => word.length > 0);
		const wordCount = words.length;

		if (wordCountDisplay) {
			wordCountDisplay.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
		}
	}

	// Keyboard shortcuts
	document.addEventListener('keydown', (e) => {
		// Ctrl+S / Cmd+S - Save
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			handleSaveRequest();
		}

		// Ctrl+P / Cmd+P - Print
		if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
			e.preventDefault();
			handlePrint();
		}

		// Ctrl+Z - Undo
		if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().undo().run();
			}
		}

		// Ctrl+Y / Ctrl+Shift+Z - Redo
		if (((e.ctrlKey || e.metaKey) && e.key === 'y') ||
		    ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
			e.preventDefault();
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().redo().run();
			}
		}

		// Ctrl+B - Bold
		if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
			e.preventDefault();
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleBold().run();
			}
		}

		// Ctrl+I - Italic
		if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
			e.preventDefault();
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleItalic().run();
			}
		}

		// Ctrl+U - Underline
		if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
			e.preventDefault();
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleUnderline().run();
			}
		}
	});

	// Listen for messages from host
	window.addEventListener('message', async (event) => {
		const message = event.data;

		switch (message.type) {
			case 'loadDOCX':
				await handleLoadDOCX(message);
				break;
			case 'saveRequest':
				// Auto-save or manual save request from VS Code
				console.log('[DOCX Webview] Save request received, reason:', message.reason);
				handleSaveRequest();
				break;
			case 'saveComplete':
				handleSaveComplete(message);
				break;
			case 'clearDOCX':
				if (tiptapEditor) {
					tiptapEditor.loadFromHTML('<p></p>');
					docxUri = null;
					contentModified = false;
					updateStatus('Ready');
				}
				break;
		}
	});

	// Initialize when all dependencies are loaded
	let waitAttempts = 0;
	const maxWaitAttempts = 50; // 5 seconds max

	function waitForTiptap() {
		waitAttempts++;

		// Check if all required globals are loaded from our bundle
		const hasDocx = typeof window.docx !== 'undefined';
		const hasTiptapEditor = typeof window.TiptapDocxEditor !== 'undefined';
		const hasEditor = typeof window.TiptapEditor !== 'undefined';
		const hasStarterKit = typeof window.TiptapStarterKit !== 'undefined';
		const hasPageExtension = typeof window.TiptapPageExtension !== 'undefined';

		console.log('[DOCX Webview] Checking dependencies (attempt', waitAttempts + '):', {
			docx: hasDocx,
			TiptapDocxEditor: hasTiptapEditor,
			TiptapEditor: hasEditor,
			TiptapStarterKit: hasStarterKit,
			TiptapPageExtension: hasPageExtension,
			'Available Tiptap globals': Object.keys(window).filter(k => k.toLowerCase().includes('tiptap') || k === 'Editor' || k === 'StarterKit')
		});

		if (hasTiptapEditor && hasDocx && hasEditor && hasStarterKit && hasPageExtension) {
			console.log('[DOCX Webview] All dependencies loaded, initializing');
			initializeTiptapEditor();
			// Notify host that webview is ready
			vscode.postMessage({ type: 'ready' });
		} else if (waitAttempts < maxWaitAttempts) {
			setTimeout(waitForTiptap, 100);
		} else {
			console.error('[DOCX Webview] Timeout waiting for dependencies after', waitAttempts, 'attempts');
			console.error('[DOCX Webview] Missing:', {
				'TiptapEditor': !hasEditor,
				'TiptapStarterKit': !hasStarterKit,
				'TiptapDocxEditor': !hasTiptapEditor,
				'docx': !hasDocx,
				'TiptapPageExtension': !hasPageExtension
			});
			updateStatus('Error: Failed to load editor dependencies');
			// Still notify ready so user can see the error
			vscode.postMessage({ type: 'ready' });
		}
	}

	// Start waiting for dependencies
	waitForTiptap();

})();

