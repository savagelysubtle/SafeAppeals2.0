// DOCX Viewer Webview Script - Tiptap Edition
(function () {
	const vscode = acquireVsCodeApi();

	let tiptapEditor = null;
	let contentModified = false;
	let docxUri = null;

	// Get DOM elements
	const container = document.getElementById('docx-container');
	container.classList.add('void-scrollbar');

	const saveBtn = document.getElementById('save-btn');
	const statusText = document.getElementById('status-text');
	const pageSizeSelect = document.getElementById('page-size-select');
	const marginPresetSelect = document.getElementById('margin-preset-select');

	// Formatting buttons
	const boldBtn = document.getElementById('bold-btn');
	const italicBtn = document.getElementById('italic-btn');
	const underlineBtn = document.getElementById('underline-btn');
	const heading1Btn = document.getElementById('heading1-btn');
	const heading2Btn = document.getElementById('heading2-btn');
	const pageBreakBtn = document.getElementById('page-break-btn');

	// Track modification state
	function trackModification() {
		if (!contentModified) {
			contentModified = true;
			updateStatus('Modified');
			vscode.postMessage({ type: 'contentChanged' });
		}
	}

	function updateStatus(text) {
		if (statusText) {
			statusText.textContent = text;
		}
	}

	// Initialize Tiptap editor
	function initializeTiptapEditor() {
		console.log('[DOCX Webview] Initializing Tiptap editor');

		try {
			// Get page dimensions based on selected size
			const dimensions = getPageDimensions(pageSizeSelect.value);
			const margin = getMarginPixels(marginPresetSelect.value);

			// Create Tiptap editor with pagination
			tiptapEditor = new window.TiptapDocxEditor(container, {
				pageSize: pageSizeSelect.value,
				margin: margin,
				enableAutoPageBreaks: true,
				onContentChange: () => {
					trackModification();
				},
			});

			console.log('[DOCX Webview] Tiptap editor initialized');
			updateStatus('Ready');

		} catch (error) {
			console.error('[DOCX Webview] Failed to initialize Tiptap:', error);
			updateStatus('Error initializing editor');
		}
	}

	function getPageDimensions(pageSize) {
		const dimensions = {
			letter: { width: 816, height: 1056 },
			legal: { width: 816, height: 1344 },
			tabloid: { width: 1056, height: 1632 },
			a4: { width: 794, height: 1123 },
			a3: { width: 1123, height: 1587 },
		};
		return dimensions[pageSize] || dimensions.letter;
	}

	function getMarginPixels(preset) {
		const margins = {
			normal: 96,    // 1 inch
			narrow: 48,    // 0.5 inch
			moderate: 72,  // 0.75 inch
			wide: 192,     // 2 inches
			custom: 96,    // Default to normal
		};
		return margins[preset] || margins.normal;
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

			docxUri = message.docxUri;
			contentModified = false;
			updateStatus('Document loaded');
			console.log('[DOCX Webview] DOCX loaded successfully');

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
			console.log('[DOCX Webview] Page size changed to:', pageSizeSelect.value);
			if (tiptapEditor) {
				tiptapEditor.setPageSize(pageSizeSelect.value);
				trackModification();
			}
		});
	}

	// Margin preset selector
	if (marginPresetSelect) {
		marginPresetSelect.addEventListener('change', () => {
			console.log('[DOCX Webview] Margin preset changed to:', marginPresetSelect.value);
			if (tiptapEditor) {
				const margin = getMarginPixels(marginPresetSelect.value);
				tiptapEditor.setMargin(margin);
				trackModification();
			}
		});
	}

	// Save button
	if (saveBtn) {
		saveBtn.addEventListener('click', handleSaveRequest);
	}

	// Formatting buttons
	if (boldBtn) {
		boldBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleBold().run();
			}
		});
	}

	if (italicBtn) {
		italicBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleItalic().run();
			}
		});
	}

	if (underlineBtn) {
		underlineBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleUnderline().run();
			}
		});
	}

	if (heading1Btn) {
		heading1Btn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleHeading({ level: 1 }).run();
			}
		});
	}

	if (heading2Btn) {
		heading2Btn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().toggleHeading({ level: 2 }).run();
			}
		});
	}

	if (pageBreakBtn) {
		pageBreakBtn.addEventListener('click', () => {
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.chain().focus().setHardBreak().run();
			}
		});
	}

	// Keyboard shortcuts
	document.addEventListener('keydown', (e) => {
		// Ctrl+S / Cmd+S - Save
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			handleSaveRequest();
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

		// Check if all required globals are loaded
		const hasDocx = typeof window.docx !== 'undefined';
		const hasTiptapEditor = typeof window.TiptapDocxEditor !== 'undefined';
		const hasEditor = typeof window.Editor !== 'undefined' || typeof window.TiptapCore !== 'undefined';

		console.log('[DOCX Webview] Checking dependencies (attempt', waitAttempts + '):', {
			docx: hasDocx,
			TiptapDocxEditor: hasTiptapEditor,
			Editor: hasEditor
		});

		if (hasTiptapEditor && hasDocx) {
			console.log('[DOCX Webview] All dependencies loaded, initializing');
			initializeTiptapEditor();
			// Notify host that webview is ready
			vscode.postMessage({ type: 'ready' });
		} else if (waitAttempts < maxWaitAttempts) {
			setTimeout(waitForTiptap, 100);
		} else {
			console.error('[DOCX Webview] Timeout waiting for dependencies after', waitAttempts, 'attempts');
			console.error('[DOCX Webview] Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('tiptap') || k === 'Editor' || k === 'docx'));
			updateStatus('Error: Failed to load editor dependencies');
			// Still notify ready so user can see the error
			vscode.postMessage({ type: 'ready' });
		}
	}

	// Start waiting for dependencies
	waitForTiptap();

})();

