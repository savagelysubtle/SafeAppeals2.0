// DOCX Viewer Webview Script - MS Word Style Edition
(function () {
	const vscode = acquireVsCodeApi();

	let tiptapEditor = null;
	let ribbon = null;
	let contentModified = false;
	let docxUri = null;
	let currentZoom = 100;
	let currentPage = 1;
	let totalPages = 1;

	// Model selection state (for inline edit popup)
	let availableModels = [];
	let modelSelectElement = null;

	// Signature setup dialog
	let signatureSetupDialog = null;
	let signatureSetupResolver = null;

	function ensureSignatureSetupDialog() {
		if (signatureSetupDialog) return signatureSetupDialog;

		const overlay = document.createElement('div');
		overlay.className = 'docx-signature-setup-overlay';

		const dialog = document.createElement('div');
		dialog.className = 'docx-signature-setup-dialog';

		dialog.innerHTML = `
			<div class="docx-signature-setup-title">Signature Setup</div>
			<label class="docx-signature-setup-label">
				Suggested signer (for example, John Doe):
				<input class="docx-signature-setup-input" data-field="name" type="text" />
			</label>
			<label class="docx-signature-setup-label">
				Suggested signer's title (for example, Manager):
				<input class="docx-signature-setup-input" data-field="title" type="text" />
			</label>
			<label class="docx-signature-setup-label">
				Suggested signer's e-mail address:
				<input class="docx-signature-setup-input" data-field="email" type="text" />
			</label>
			<label class="docx-signature-setup-label">
				Instructions to the signer:
				<textarea class="docx-signature-setup-textarea" data-field="instructions" rows="3"></textarea>
			</label>
			<label class="docx-signature-setup-checkbox">
				<input type="checkbox" data-field="allowComments" />
				Allow the signer to add comments in the Sign dialog
			</label>
			<label class="docx-signature-setup-checkbox">
				<input type="checkbox" data-field="showDate" checked />
				Show sign date in signature line
			</label>
			<div class="docx-signature-setup-actions">
				<button class="docx-signature-setup-btn" data-action="ok">OK</button>
				<button class="docx-signature-setup-btn" data-action="cancel">Cancel</button>
			</div>
		`;

		overlay.appendChild(dialog);
		document.body.appendChild(overlay);

		const getField = (selector) => dialog.querySelector(selector);
		const okButton = getField('[data-action="ok"]');
		const cancelButton = getField('[data-action="cancel"]');

		const closeDialog = (result) => {
			overlay.classList.remove('is-open');
			if (signatureSetupResolver) {
				signatureSetupResolver(result);
				signatureSetupResolver = null;
			}
		};

		okButton.addEventListener('click', () => {
			closeDialog({
				confirmed: true,
				name: getField('[data-field="name"]').value || '',
				title: getField('[data-field="title"]').value || '',
				email: getField('[data-field="email"]').value || '',
				instructions: getField('[data-field="instructions"]').value || '',
				allowComments: !!getField('[data-field="allowComments"]').checked,
				showDate: !!getField('[data-field="showDate"]').checked,
			});
		});

		cancelButton.addEventListener('click', () => {
			closeDialog({ confirmed: false });
		});

		overlay.addEventListener('click', (e) => {
			if (e.target === overlay) {
				closeDialog({ confirmed: false });
			}
		});

		signatureSetupDialog = {
			overlay,
			dialog,
			getField,
		};

		return signatureSetupDialog;
	}

	function openSignatureSetupDialog() {
		const dialog = ensureSignatureSetupDialog();
		dialog.getField('[data-field="name"]').value = '';
		dialog.getField('[data-field="title"]').value = '';
		dialog.getField('[data-field="email"]').value = '';
		dialog.getField('[data-field="instructions"]').value = '';
		dialog.getField('[data-field="allowComments"]').checked = false;
		dialog.getField('[data-field="showDate"]').checked = true;
		dialog.overlay.classList.add('is-open');

		return new Promise((resolve) => {
			signatureSetupResolver = resolve;
		});
	}

	// Store editor selection for inline edit (survives async LLM call)
	let pendingInlineEditSelection = null; // { from: number, to: number }

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

	const statusText = document.getElementById('status-text');
	const pageSizeSelect = document.getElementById('page-size-select');
	const marginPresetSelect = document.getElementById('margin-preset-select');
	const ruler = document.getElementById('docx-ruler');
	const pageCountDisplay = document.getElementById('page-count-display');
	const zoomDisplay = document.getElementById('zoom-display');
	const zoomSlider = document.getElementById('zoom-slider');

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

			// Get JSON content for round-trip image preservation
			// Use getHydratedJSON to ensure images are saved as Base64, not ephemeral Blob URLs
			let jsonContent = null;
			try {
				const json = await tiptapEditor.getHydratedJSON();
				jsonContent = JSON.stringify(json);
			} catch (e) {
				console.error('[DOCX Webview] Failed to hydrate JSON:', e);
				// Fallback to basic JSON (might contain blob urls which is bad, but better than crash)
				jsonContent = JSON.stringify(tiptapEditor.getJSON());
			}

			vscode.postMessage({
				type: 'contentChanged',
				docxData: base64,
				jsonContent: jsonContent, // JSON preserves images for round-trip
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
		// const unit = isMetric ? 'cm' : 'in';
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
	// INITIALIZATION
	// ============================================

	// Initialize Tiptap editor
	function initializeTiptapEditor() {
		console.log('[DOCX Webview] Initializing Tiptap editor');

		try {
			// Initialize Ribbon
			if (window.DocxRibbon) {
				ribbon = new window.DocxRibbon({
					onSave: handleSaveRequest,
					onPrint: handlePrint,
					onExportPDF: handleExportPDF,
					onInsertSignatureLine: handleInsertSignatureLine,
					onSendForSignature: handleSendForSignature,
					onModification: trackModification,
					onPageSizeChange: (pageSize) => {
						console.log('[DOCX Webview] Page size changed to:', pageSize);
						const marginPreset = marginPresetSelect ? marginPresetSelect.value : 'normal';

						if (tiptapEditor) {
							tiptapEditor.setPageSize(pageSize);
							trackModification();
						}
						// Update ruler
						renderRuler(pageSize, marginPreset);
						// Update page count
						updatePageCount();
					},
					onMarginChange: (marginPreset) => {
						console.log('[DOCX Webview] Margin preset changed to:', marginPreset);
						const pageSize = pageSizeSelect ? pageSizeSelect.value : 'letter';

						if (tiptapEditor) {
							const margin = getMarginPixels(marginPreset);
							tiptapEditor.setMargin(margin);
							trackModification();
							// Update CSS variable
							document.documentElement.style.setProperty('--docx-margin', `${margin}px`);
						}
						// Update ruler
						renderRuler(pageSize, marginPreset);
						// Update page count
						updatePageCount();
					},
					onOrientationChange: (orientation) => {
						console.log('[DOCX Webview] Orientation changed to:', orientation);
						// Placeholder for future implementation
					}
				});
				console.log('[DOCX Webview] Ribbon initialized');
			} else {
				console.error('[DOCX Webview] DocxRibbon class not found');
			}

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

			// Pass editor to ribbon
			if (ribbon) {
				ribbon.setEditor(tiptapEditor);
			}

			// Hook into editor transaction events to update ribbon state
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.on('transaction', () => {
					if (ribbon) {
						ribbon.updateState();
					}
					// Update word count on transaction (more responsive)
					updateWordCount();
				});

				tiptapEditor.editor.on('selectionUpdate', () => {
					if (ribbon) {
						ribbon.updateState();
					}
				});
			}

			// Set initial CSS variable for margin styling
			document.documentElement.style.setProperty('--docx-margin', `${margin}px`);
			console.log('[DOCX Webview] Set --docx-margin CSS variable to:', margin, 'px');

			// Ensure editor is editable immediately after creation
			if (tiptapEditor && tiptapEditor.editor) {
				tiptapEditor.editor.setEditable(true);
				console.log('[DOCX Webview] Tiptap editor initialized and set to editable:', tiptapEditor.editor.isEditable);
			}

			// Intercept link clicks and send to host (webview sandbox blocks popups)
			const editorContainer = document.getElementById('docx-container');
			if (editorContainer) {
				editorContainer.addEventListener('click', (e) => {
					// Check if clicked element is a link or inside a link
					const link = e.target.closest('a[href]');
					if (link) {
						const href = link.getAttribute('href');
						if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:'))) {
							e.preventDefault();
							e.stopPropagation();
							console.log('[DOCX Webview] Link clicked, sending to host:', href);
							vscode.postMessage({
								type: 'openLink',
								url: href
							});
						}
					}
				}, true); // Use capture phase to intercept before Tiptap's handler
				console.log('[DOCX Webview] Link click interceptor installed');
			}
			document.addEventListener('mouseup', (e) => {
				if (e.button !== 0) {
					return;
				}
				if (!tiptapEditor || !tiptapEditor.editor) {
					return;
				}
				const target = e.target;
				if (target && target.closest && target.closest('.docx-signature-line')) {
					return;
				}
				requestAnimationFrame(() => {
					const editor = tiptapEditor?.editor;
					if (!editor) {
						return;
					}
					const selection = editor.state.selection;
					if (selection && selection.node && selection.node.type && selection.node.type.name === 'signatureLine') {
						editor.commands.focus();
						editor.commands.setTextSelection(selection.from);
					}
				});
			}, true);

			// ============================================
			// SELECTION TRACKING FOR CTRL+L AND CTRL+K
			// ============================================

			// Create selection tooltip element
			const selectionTooltip = document.createElement('div');
			selectionTooltip.className = 'docx-selection-tooltip';
			selectionTooltip.innerHTML = `
			<button data-action="addToChat">Add to Chat <kbd>Ctrl+L</kbd></button>
			<button data-action="editInline">Edit Inline <kbd>Ctrl+K</kbd></button>
		`;
			selectionTooltip.style.display = 'none';
			document.body.appendChild(selectionTooltip);

			// Create inline edit popup (Ctrl+K style)
			const inlineEditPopup = document.createElement('div');
			inlineEditPopup.className = 'docx-inline-edit-popup';
			inlineEditPopup.innerHTML = `
			<div class="inline-edit-header">
				<span class="inline-edit-title">Quick Edit</span>
				<button class="inline-edit-close" title="Close (Esc)">×</button>
			</div>
			<div class="inline-edit-model-selector">
				<label for="inline-edit-model">Model:</label>
				<select id="inline-edit-model" class="inline-edit-model-select">
					<option value="">Loading models...</option>
				</select>
			</div>
			<div class="inline-edit-selection-preview"></div>
			<textarea class="inline-edit-input" placeholder="Enter instructions for editing this text..." rows="2"></textarea>
			<div class="inline-edit-footer">
				<span class="inline-edit-hint">Press Enter to submit, Esc to cancel</span>
				<button class="inline-edit-submit">Submit</button>
			</div>
		`;
			inlineEditPopup.style.display = 'none';
			document.body.appendChild(inlineEditPopup);

			// Store reference to model select element in top-level variable
			modelSelectElement = inlineEditPopup.querySelector('#inline-edit-model');

			// Inline edit state
			let inlineEditSelection = null;
			const inlineEditInput = inlineEditPopup.querySelector('.inline-edit-input');
			const inlineEditPreview = inlineEditPopup.querySelector('.inline-edit-selection-preview');
			const inlineEditCloseBtn = inlineEditPopup.querySelector('.inline-edit-close');
			const inlineEditSubmitBtn = inlineEditPopup.querySelector('.inline-edit-submit');

			function showInlineEditPopup(selection) {
				if (!selection || !selection.text) return;

				inlineEditSelection = selection;

				// Store the Tiptap editor selection immediately when popup is shown
				// This ensures we capture the selection before any DOM changes
				if (tiptapEditor && tiptapEditor.editor) {
					const { from, to } = tiptapEditor.editor.state.selection;
					pendingInlineEditSelection = { from, to };
					console.log('[DOCX Webview] Captured editor selection on popup show:', pendingInlineEditSelection);
				}

				// Show preview of selected text (truncated)
				const preview = selection.text.length > 100
					? selection.text.substring(0, 100) + '...'
					: selection.text;
				inlineEditPreview.textContent = `"${preview}"`;

				// Position the popup near the selection
				const windowSelection = window.getSelection();
				if (windowSelection && windowSelection.rangeCount > 0) {
					const range = windowSelection.getRangeAt(0);
					const rect = range.getBoundingClientRect();

					// Position below the selection
					let left = rect.left;
					let top = rect.bottom + 8;

					// Keep in viewport
					const popupWidth = 400;
					const popupHeight = 180;

					if (left + popupWidth > window.innerWidth - 20) {
						left = window.innerWidth - popupWidth - 20;
					}
					if (left < 10) left = 10;

					if (top + popupHeight > window.innerHeight - 20) {
						top = rect.top - popupHeight - 8;
					}
					if (top < 10) top = 10;

					inlineEditPopup.style.left = `${left}px`;
					inlineEditPopup.style.top = `${top}px`;
				}

				inlineEditPopup.style.display = 'flex';
				inlineEditInput.value = '';
				inlineEditInput.focus();

				// Hide the selection tooltip
				selectionTooltip.style.display = 'none';
			}

			function hideInlineEditPopup() {
				inlineEditPopup.style.display = 'none';
				inlineEditSelection = null;
				inlineEditInput.value = '';
			}

			function submitInlineEdit() {
				const instructions = inlineEditInput.value.trim();
				if (!instructions || !inlineEditSelection) return;

				// Store the Tiptap editor selection BEFORE the async call
				// This survives even if the DOM selection is cleared
				if (tiptapEditor && tiptapEditor.editor) {
					const { from, to } = tiptapEditor.editor.state.selection;
					pendingInlineEditSelection = { from, to };
					console.log('[DOCX Webview] Stored editor selection:', pendingInlineEditSelection);
				}

				// Get selected model
				const selectedModel = modelSelectElement && modelSelectElement.selectedIndex >= 0
					? availableModels[modelSelectElement.selectedIndex]
					: null;

				// Show loading state
				inlineEditSubmitBtn.disabled = true;
				inlineEditSubmitBtn.textContent = 'Processing...';
				inlineEditInput.disabled = true;
				if (modelSelectElement) modelSelectElement.disabled = true;

				// Send to host for processing
				vscode.postMessage({
					type: 'inlineEditRequest',
					selection: inlineEditSelection,
					instructions: instructions,
					modelSelection: selectedModel ? selectedModel.selection : null
				});

				// Hide popup after a short delay (the edit will be applied asynchronously)
				setTimeout(() => {
					hideInlineEditPopup();
					// Reset button state
					inlineEditSubmitBtn.disabled = false;
					inlineEditSubmitBtn.textContent = 'Submit';
					inlineEditInput.disabled = false;
					if (modelSelectElement) modelSelectElement.disabled = false;
				}, 300);
			}

			// Inline edit event handlers
			inlineEditCloseBtn.addEventListener('click', hideInlineEditPopup);
			inlineEditSubmitBtn.addEventListener('click', submitInlineEdit);

			inlineEditInput.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					submitInlineEdit();
				} else if (e.key === 'Escape') {
					e.preventDefault();
					hideInlineEditPopup();
				}
			});

			// Prevent clicks inside popup from closing it
			inlineEditPopup.addEventListener('mousedown', (e) => {
				e.stopPropagation();
			});

			// Listen for Ctrl+K keyboard shortcut event
			document.addEventListener('docx-show-inline-edit', (e) => {
				if (e.detail) {
					showInlineEditPopup(e.detail);
				}
			});

			// Position and show tooltip near selection (above the selection)
			function updateTooltipPosition(selection) {
				if (!selection || selection.rangeCount === 0) {
					selectionTooltip.style.display = 'none';
					return;
				}
				const range = selection.getRangeAt(0);
				const rect = range.getBoundingClientRect();

				// Measure the tooltip first
				selectionTooltip.style.visibility = 'hidden';
				selectionTooltip.style.display = 'flex';
				const tooltipRect = selectionTooltip.getBoundingClientRect();
				const tooltipWidth = tooltipRect.width || 280;
				const tooltipHeight = tooltipRect.height || 40;

				// Position above the selection, centered horizontally
				let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
				let top = rect.top - tooltipHeight - 8;

				// If tooltip would go above the viewport, position below the selection
				if (top < 10) {
					top = rect.bottom + 8;
				}

				// Keep tooltip in horizontal viewport bounds
				if (left < 10) {
					left = 10;
				}
				// Leave space on the right for the chat panel (estimate 400px)
				const maxRight = window.innerWidth - 420;
				if (left + tooltipWidth > maxRight) {
					left = maxRight - tooltipWidth;
				}

				selectionTooltip.style.left = `${left}px`;
				selectionTooltip.style.top = `${top}px`;
				selectionTooltip.style.visibility = 'visible';
			}

			// Handle tooltip button clicks
			selectionTooltip.addEventListener('click', (e) => {
				const action = e.target.dataset?.action || e.target.closest('button')?.dataset?.action;
				if (action === 'addToChat') {
					vscode.postMessage({ type: 'executeCommand', command: 'void.ctrlLAction' });
					selectionTooltip.style.display = 'none';
				} else if (action === 'editInline') {
					// Get current selection and show inline edit popup
					const selection = window.getSelection();
					if (selection && !selection.isCollapsed) {
						const selectedText = selection.toString().trim();
						if (selectedText.length >= 3) {
							const range = selection.getRangeAt(0);
							const clonedSelection = range.cloneContents();
							const div = document.createElement('div');
							div.appendChild(clonedSelection);
							showInlineEditPopup({ text: selectedText, html: div.innerHTML });
						}
					}
				}
			});

			// Selection tracking with debounce
			let selectionDebounceTimer = null;
			document.addEventListener('selectionchange', () => {
				if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer);
				selectionDebounceTimer = setTimeout(() => {
					const selection = window.getSelection();
					if (selection && !selection.isCollapsed) {
						const selectedText = selection.toString().trim();
						if (selectedText.length >= 3) {
							const range = selection.getRangeAt(0);
							const clonedSelection = range.cloneContents();
							const div = document.createElement('div');
							div.appendChild(clonedSelection);

							// Send selection to host
							vscode.postMessage({
								type: 'textSelected',
								selection: { text: selectedText, html: div.innerHTML }
							});

							// Show tooltip
							updateTooltipPosition(selection);
						} else {
							selectionTooltip.style.display = 'none';
						}
					} else {
						vscode.postMessage({ type: 'clearSelection' });
						selectionTooltip.style.display = 'none';
					}
				}, 150);
			});

			// Hide tooltip on scroll or click outside
			container.addEventListener('scroll', () => {
				selectionTooltip.style.display = 'none';
			});

			document.addEventListener('mousedown', (e) => {
				if (!selectionTooltip.contains(e.target)) {
					// Don't hide immediately - let the selection change event handle it
				}
			});

			console.log('[DOCX Webview] Selection tracking initialized');

			// Initialize ruler
			initializeRuler();

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
			// Check if we have JSON content (preserves images for round-trip)
			if (message.jsonContent) {
				console.log('[DOCX Webview] Loading from JSON content (preserves images)');
				const json = JSON.parse(message.jsonContent);
				if (tiptapEditor && tiptapEditor.editor) {
					// Use loadFromJSON to handle Base64 -> Blob conversion for memory optimization
					await tiptapEditor.loadFromJSON(json);
					tiptapEditor.editor.setEditable(true);
					console.log('[DOCX Webview] Loaded from JSON, editor editable:', tiptapEditor.editor.isEditable);
				}
			} else {
				// Decode base64 data and load from DOCX
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

			// Get JSON content for round-trip preservation
			// CRITICAL: Use getHydratedJSON() to ensure images are saved as Base64, not Blob URLs
			let jsonContent = null;
			try {
				const json = await tiptapEditor.getHydratedJSON();
				jsonContent = JSON.stringify(json);
				console.log('[DOCX Webview] Hydrated JSON for save, size:', Math.round(jsonContent.length / 1024), 'KB');
			} catch (e) {
				console.error('[DOCX Webview] Failed to hydrate JSON for save:', e);
			}

			// Send to host
			vscode.postMessage({
				type: 'saveRequested',
				docxData: base64,
				jsonContent: jsonContent, // JSON with Base64 images for round-trip preservation
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

	// Print function - exports HTML and prints
	async function handlePrint() {
		if (!tiptapEditor) {
			console.warn('[DOCX Webview] Editor not initialized for printing');
			return;
		}

		console.log('[DOCX Webview] Starting print process...');

		try {
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

			// Send to host to handle printing (bypass sandbox)
			vscode.postMessage({
				type: 'print',
				html: printHTML
			});
			console.log('[DOCX Webview] Sent print request to host');

		} catch (error) {
			console.error('[DOCX Webview] Print error:', error);
		}
	}

	async function handleExportPDF() {
		if (!tiptapEditor) {
			console.warn('[DOCX Webview] Editor not initialized for PDF export');
			return;
		}

		console.log('[DOCX Webview] Starting PDF export process...');

		try {
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

			// Build export HTML with proper styling
			const exportHTML = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="UTF-8">
					<title>Export Document</title>
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
					</style>
				</head>
				<body>
					<div class="ProseMirror">
						${htmlContent}
					</div>
				</body>
				</html>
			`;

			// Send to host to handle PDF export
			// Extract filename from docxUri if available
			let filename = 'document';
			if (docxUri) {
				try {
					const parts = docxUri.split('/');
					filename = parts[parts.length - 1] || 'document';
				} catch (e) {
					console.warn('[DOCX Webview] Could not extract filename from URI');
				}
			}

			vscode.postMessage({
				type: 'exportToPDF',
				html: exportHTML,
				title: filename
			});
			console.log('[DOCX Webview] Sent PDF export request to host');

		} catch (error) {
			console.error('[DOCX Webview] PDF export error:', error);
		}
	}

	async function handleInsertSignatureLine() {
		if (!tiptapEditor || !tiptapEditor.editor) {
			console.warn('[DOCX Webview] Editor not initialized for signature line');
			return;
		}

		try {
			const setup = await openSignatureSetupDialog();
			if (!setup || !setup.confirmed) {
				return;
			}
			const result = tiptapEditor.editor
				.chain()
				.focus()
				.insertSignatureLine({
					nameText: setup.name || '',
					dateText: '',
					showDate: setup.showDate,
				})
				.run();

			if (result) {
				trackModification();
			}
		} catch (error) {
			console.warn('[DOCX Webview] Signature line insertion failed:', error);
		}
	}

	// Send for Signature (DocuSign) - sends document to host for e-signature workflow
	async function handleSendForSignature() {
		if (!tiptapEditor) {
			console.warn('[DOCX Webview] Editor not initialized for signature');
			return;
		}

		console.log('[DOCX Webview] Starting Send for Signature process...');

		try {
			// Export to DOCX blob to get the current document state
			const blob = await tiptapEditor.saveToDocx();

			// Convert blob to base64
			const arrayBuffer = await blob.arrayBuffer();
			const uint8Array = new Uint8Array(arrayBuffer);
			let binaryString = '';
			for (let i = 0; i < uint8Array.length; i++) {
				binaryString += String.fromCharCode(uint8Array[i]);
			}
			const base64 = btoa(binaryString);

			// Extract filename from docxUri if available
			let filename = 'document';
			if (docxUri) {
				try {
					const parts = docxUri.split('/');
					filename = parts[parts.length - 1] || 'document';
				} catch (e) {
					console.warn('[DOCX Webview] Could not extract filename from URI');
				}
			}

			// Send to host to initiate DocuSign flow
			vscode.postMessage({
				type: 'sendForSignature',
				docxData: base64,
				docxUri: docxUri,
				filename: filename
			});

			console.log('[DOCX Webview] Sent signature request to host');

		} catch (error) {
			console.error('[DOCX Webview] Send for Signature error:', error);
		}
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

		// Ctrl+L / Cmd+L - Add to Chat
		if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
			e.preventDefault();
			vscode.postMessage({ type: 'executeCommand', command: 'void.ctrlLAction' });
		}

		// Ctrl+K / Cmd+K - Quick Edit (inline edit popup)
		if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
			e.preventDefault();
			const selection = window.getSelection();
			if (selection && !selection.isCollapsed) {
				const selectedText = selection.toString().trim();
				if (selectedText.length >= 3) {
					const range = selection.getRangeAt(0);
					const clonedSelection = range.cloneContents();
					const div = document.createElement('div');
					div.appendChild(clonedSelection);
					// Use the showInlineEditPopup function - it's defined inside initializeTiptapEditor
					// We need to trigger it via a custom event or direct call
					document.dispatchEvent(new CustomEvent('docx-show-inline-edit', {
						detail: { text: selectedText, html: div.innerHTML }
					}));
				}
			}
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

			case 'inlineEditStarted':
				// Show loading indicator
				updateStatus('Processing edit...');
				break;

			case 'inlineEditProgress':
				// Could show streaming progress if desired
				break;

			case 'applyInlineEdit':
				// Apply the edited text to replace the stored selection
				if (tiptapEditor && tiptapEditor.editor && message.editedText) {
					// Use the stored Tiptap selection (survives async call)
					if (pendingInlineEditSelection) {
						const { from, to } = pendingInlineEditSelection;
						console.log('[DOCX Webview] Applying inline edit at positions:', from, to);

						// Replace the text at the stored positions
						tiptapEditor.editor.chain()
							.focus()
							.setTextSelection({ from, to })
							.deleteSelection()
							.insertContent(message.editedText)
							.run();

						console.log('[DOCX Webview] Applied inline edit:', message.editedText.substring(0, 50) + '...');
						trackModification();
						updateStatus('Edit applied');

						// Clear the pending selection
						pendingInlineEditSelection = null;
					} else {
						console.warn('[DOCX Webview] No stored selection to apply edit to');
						updateStatus('Could not apply edit - no selection stored');
					}
				}
				break;

			case 'inlineEditError':
				updateStatus('Edit failed: ' + (message.message || 'Unknown error'));
				break;

			case 'updateModels':
				// Update available models for the inline edit dropdown
				if (message.models && Array.isArray(message.models)) {
					availableModels = message.models;
					const defaultIndex = message.defaultIndex || 0;

					// Clear and populate the dropdown
					if (modelSelectElement) {
						modelSelectElement.innerHTML = '';
						availableModels.forEach((model, index) => {
							const option = document.createElement('option');
							option.value = index;
							option.textContent = `${model.selection.modelName} (${model.selection.providerName})`;
							if (index === defaultIndex) {
								option.selected = true;
							}
							modelSelectElement.appendChild(option);
						});

						if (availableModels.length === 0) {
							const option = document.createElement('option');
							option.value = '';
							option.textContent = 'No models available';
							modelSelectElement.appendChild(option);
						}
					}

					console.log('[DOCX Webview] Updated models:', availableModels.length, 'default:', defaultIndex);
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
		const hasRibbon = typeof window.DocxRibbon !== 'undefined';

		// Debug loaded font extensions
		const hasTextStyle = typeof window.TiptapTextStyle !== 'undefined';
		const hasFontFamily = typeof window.TiptapFontFamily !== 'undefined';
		const hasColor = typeof window.TiptapColor !== 'undefined';

		console.log('[DOCX Webview] Checking dependencies (attempt', waitAttempts + '):', {
			docx: hasDocx,
			TiptapDocxEditor: hasTiptapEditor,
			TiptapEditor: hasEditor,
			TiptapStarterKit: hasStarterKit,
			TiptapPageExtension: hasPageExtension,
			DocxRibbon: hasRibbon,
			TiptapTextStyle: hasTextStyle,
			TiptapFontFamily: hasFontFamily,
			TiptapColor: hasColor
		});

		if (hasTiptapEditor && hasDocx && hasEditor && hasStarterKit && hasPageExtension && hasRibbon) {
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
				'TiptapPageExtension': !hasPageExtension,
				'DocxRibbon': !hasRibbon
			});
			updateStatus('Error: Failed to load editor dependencies');
			// Still notify ready so user can see the error
			vscode.postMessage({ type: 'ready' });
		}
	}

	// Start waiting for dependencies
	waitForTiptap();

})();
