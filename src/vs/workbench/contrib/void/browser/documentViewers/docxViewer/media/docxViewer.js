// DOCX Viewer Webview Script
(function () {
	// Communication with host
	const vscode = acquireVsCodeApi();

	// Get previous state if it exists
	const previousState = vscode.getState() || {};

	let docxRendered = false;
	let contentModified = false;
	let docxUri = null;

	// Get DOM elements
	const container = document.getElementById('docx-container');
	const saveBtn = document.getElementById('save-btn');
	const statusText = document.getElementById('status-text');

	// Ribbon buttons
	const boldBtn = document.getElementById('bold-btn');
	const italicBtn = document.getElementById('italic-btn');
	const underlineBtn = document.getElementById('underline-btn');
	const strikethroughBtn = document.getElementById('strikethrough-btn');
	const textColorInput = document.getElementById('text-color');
	const highlightColorInput = document.getElementById('highlight-color');

	const fontFamilySelect = document.getElementById('font-family');
	const fontSizeSelect = document.getElementById('font-size');

	const alignLeftBtn = document.getElementById('align-left-btn');
	const alignCenterBtn = document.getElementById('align-center-btn');
	const alignRightBtn = document.getElementById('align-right-btn');
	const justifyBtn = document.getElementById('justify-btn');
	const bulletsBtn = document.getElementById('bullets-btn');
	const numberingBtn = document.getElementById('numbering-btn');
	const indentBtn = document.getElementById('indent-btn');
	const outdentBtn = document.getElementById('outdent-btn');

	const headingStyleSelect = document.getElementById('heading-style');

	const insertTableBtn = document.getElementById('insert-table-btn');
	const insertImageBtn = document.getElementById('insert-image-btn');
	const pageBreakBtn = document.getElementById('page-break-btn');

	const marginsBtn = document.getElementById('margins-btn');

	// Track modification state
	function trackModification() {
		if (!contentModified) {
			contentModified = true;
			updateStatus('Modified');
			vscode.postMessage({ type: 'contentChanged' });
		}
	}

	// Execute formatting command
	function execFormatCommand(command, value = null) {
		document.execCommand(command, false, value);
		trackModification();
		updateActiveStates();
	}

	// Notify host that webview is ready
	vscode.postMessage({ type: 'ready' });

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
			case 'executeOperations':
				executeDocumentOperations(message.operations);
				break;
		}
	});

	async function handleLoadDOCX(message) {
		try {
			console.log('[DOCX Webview] Loading DOCX...');
			docxUri = message.docxUri;

			// Convert base64 to Blob
			const binaryString = atob(message.data);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

			// Clear container
			container.innerHTML = '';

			// Render using docx-preview library
			const options = {
				className: 'docx',
				inWrapper: true,
				ignoreWidth: false,
				ignoreHeight: false,
				ignoreFonts: false,
				breakPages: true,
				ignoreLastRenderedPageBreak: true,
				experimental: true,
				trimXmlDeclaration: true,
				renderHeaders: true,
				renderFooters: true,
				renderFootnotes: true,
				renderEndnotes: true,
				debug: false
			};

			await docx.renderAsync(blob, container, null, options);

			// Make the entire document editable
			// docx-preview creates: .docx-wrapper > section.docx > article
			const docxWrapper = container.querySelector('.docx-wrapper');
			if (docxWrapper) {
				// Make the wrapper contentEditable for easier editing
				docxWrapper.contentEditable = 'true';
				docxWrapper.style.outline = 'none'; // Remove the focus outline
				docxWrapper.classList.add('docx-editable');

				// Track any changes in the document
				docxWrapper.addEventListener('input', () => {
					if (!contentModified) {
						contentModified = true;
						updateStatus('Modified');
						vscode.postMessage({ type: 'contentChanged' });
					}
				});

				// Prevent editing of the wrapper background by focusing on content
				docxWrapper.addEventListener('click', (e) => {
					// If clicking on wrapper itself, focus on first editable content
					if (e.target === docxWrapper) {
						const firstParagraph = docxWrapper.querySelector('p, h1, h2, h3, h4, h5, h6');
						if (firstParagraph) {
							firstParagraph.focus();
						}
					}
				});
			}

			docxRendered = true;
			contentModified = false;
			updateStatus('Ready - Click to edit');

			console.log('[DOCX Webview] DOCX loaded and ready for editing');

		} catch (error) {
			console.error('[DOCX Webview] Failed to load DOCX:', error);
			container.innerHTML = `<div style="padding: 20px; color: var(--vscode-errorForeground);">
				Error loading document: ${error.message}
			</div>`;
		}
	}

	// ===== FORMATTING TOOLBAR EVENT HANDLERS =====

	// Basic text formatting
	boldBtn.addEventListener('click', () => execFormatCommand('bold'));
	italicBtn.addEventListener('click', () => execFormatCommand('italic'));
	underlineBtn.addEventListener('click', () => execFormatCommand('underline'));
	strikethroughBtn.addEventListener('click', () => execFormatCommand('strikeThrough'));

	// Font family and size
	fontFamilySelect.addEventListener('change', (e) => {
		execFormatCommand('fontName', e.target.value);
	});

	fontSizeSelect.addEventListener('change', (e) => {
		execFormatCommand('fontSize', '7'); // fontSize uses 1-7 scale
		// Use custom size for better control
		const selection = window.getSelection();
		if (selection.rangeCount > 0) {
			const range = selection.getRangeAt(0);
			const span = document.createElement('span');
			span.style.fontSize = e.target.value + 'px';
			range.surroundContents(span);
			trackModification();
		}
	});

	// Text color
	textColorInput.addEventListener('change', (e) => {
		execFormatCommand('foreColor', e.target.value);
	});

	// Highlight color
	highlightColorInput.addEventListener('change', (e) => {
		execFormatCommand('hiliteColor', e.target.value);
	});

	// Paragraph alignment
	alignLeftBtn.addEventListener('click', () => execFormatCommand('justifyLeft'));
	alignCenterBtn.addEventListener('click', () => execFormatCommand('justifyCenter'));
	alignRightBtn.addEventListener('click', () => execFormatCommand('justifyRight'));
	justifyBtn.addEventListener('click', () => execFormatCommand('justifyFull'));

	// Lists
	bulletsBtn.addEventListener('click', () => execFormatCommand('insertUnorderedList'));
	numberingBtn.addEventListener('click', () => execFormatCommand('insertOrderedList'));

	// Indent/Outdent
	indentBtn.addEventListener('click', () => execFormatCommand('indent'));
	outdentBtn.addEventListener('click', () => execFormatCommand('outdent'));

	// Heading styles
	headingStyleSelect.addEventListener('change', (e) => {
		const tag = e.target.value;
		if (tag) {
			execFormatCommand('formatBlock', tag);
		} else {
			execFormatCommand('formatBlock', 'p');
		}
	});

	// Insert page break
	pageBreakBtn.addEventListener('click', insertPageBreak);

	// Insert table
	insertTableBtn.addEventListener('click', insertTable);

	// Insert image
	insertImageBtn.addEventListener('click', insertImage);

	// Margins dialog
	marginsBtn.addEventListener('click', showMarginsDialog);

	// ===== FORMATTING FUNCTIONS =====

	function insertPageBreak() {
		const selection = window.getSelection();
		if (!selection.rangeCount) return;

		const range = selection.getRangeAt(0);
		const breakDiv = document.createElement('div');
		breakDiv.className = 'page-break';
		breakDiv.contentEditable = 'false';
		breakDiv.innerHTML = '<hr><span>Page Break</span>';

		range.deleteContents();
		range.insertNode(breakDiv);

		// Move cursor after page break
		range.setStartAfter(breakDiv);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);

		trackModification();
	}

	function insertTable() {
		const rows = prompt('Number of rows:', '3');
		const cols = prompt('Number of columns:', '3');

		if (!rows || !cols) return;

		let tableHTML = '<table border="1" style="border-collapse: collapse; width: 100%; margin: 12px 0;">';
		for (let i = 0; i < parseInt(rows); i++) {
			tableHTML += '<tr>';
			for (let j = 0; j < parseInt(cols); j++) {
				tableHTML += '<td style="border: 1px solid var(--vscode-panel-border); padding: 8px;">&nbsp;</td>';
			}
			tableHTML += '</tr>';
		}
		tableHTML += '</table>';

		execFormatCommand('insertHTML', tableHTML);
	}

	function insertImage() {
		const url = prompt('Enter image URL:');
		if (!url) return;

		const imgHTML = `<img src="${url}" style="max-width: 100%; height: auto; margin: 12px 0;" />`;
		execFormatCommand('insertHTML', imgHTML);
	}

	function showMarginsDialog() {
		const dialog = document.createElement('div');
		dialog.className = 'margins-dialog';
		dialog.innerHTML = `
			<div class="dialog-content">
				<h3>Page Margins</h3>
				<label>Top: <input type="number" id="margin-top" value="40" min="0" step="5"> px</label>
				<label>Right: <input type="number" id="margin-right" value="40" min="0" step="5"> px</label>
				<label>Bottom: <input type="number" id="margin-bottom" value="40" min="0" step="5"> px</label>
				<label>Left: <input type="number" id="margin-left" value="40" min="0" step="5"> px</label>
				<div>
					<button id="apply-margins">Apply</button>
					<button id="cancel-margins">Cancel</button>
				</div>
			</div>
		`;

		document.body.appendChild(dialog);

		// Get current margins
		const docxWrapper = container.querySelector('.docx-wrapper');
		if (docxWrapper) {
			const style = window.getComputedStyle(docxWrapper);
			const currentPadding = style.padding.split(' ');
			if (currentPadding.length >= 4) {
				document.getElementById('margin-top').value = parseInt(currentPadding[0]);
				document.getElementById('margin-right').value = parseInt(currentPadding[1]);
				document.getElementById('margin-bottom').value = parseInt(currentPadding[2]);
				document.getElementById('margin-left').value = parseInt(currentPadding[3]);
			}
		}

		// Apply button
		document.getElementById('apply-margins').addEventListener('click', () => {
			const top = document.getElementById('margin-top').value;
			const right = document.getElementById('margin-right').value;
			const bottom = document.getElementById('margin-bottom').value;
			const left = document.getElementById('margin-left').value;

			adjustMargins(top, right, bottom, left);
			document.body.removeChild(dialog);
		});

		// Cancel button
		document.getElementById('cancel-margins').addEventListener('click', () => {
			document.body.removeChild(dialog);
		});

		// Close on background click
		dialog.addEventListener('click', (e) => {
			if (e.target === dialog) {
				document.body.removeChild(dialog);
			}
		});
	}

	function adjustMargins(top, right, bottom, left) {
		const docxWrapper = container.querySelector('.docx-wrapper');
		if (docxWrapper) {
			docxWrapper.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
			trackModification();
		}
	}

	// Update active button states based on current selection
	function updateActiveStates() {
		try {
			// Update format buttons
			boldBtn.classList.toggle('active', document.queryCommandState('bold'));
			italicBtn.classList.toggle('active', document.queryCommandState('italic'));
			underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
			strikethroughBtn.classList.toggle('active', document.queryCommandState('strikeThrough'));

			alignLeftBtn.classList.toggle('active', document.queryCommandState('justifyLeft'));
			alignCenterBtn.classList.toggle('active', document.queryCommandState('justifyCenter'));
			alignRightBtn.classList.toggle('active', document.queryCommandState('justifyRight'));
			justifyBtn.classList.toggle('active', document.queryCommandState('justifyFull'));

			bulletsBtn.classList.toggle('active', document.queryCommandState('insertUnorderedList'));
			numberingBtn.classList.toggle('active', document.queryCommandState('insertOrderedList'));

			// Update font family
			const fontName = document.queryCommandValue('fontName');
			if (fontName) {
				fontFamilySelect.value = fontName.replace(/['"]/g, '');
			}

			// Update heading style based on current block
			const selection = window.getSelection();
			if (selection.anchorNode) {
				let parent = selection.anchorNode.parentElement;
				while (parent && parent !== container) {
					const tagName = parent.tagName.toLowerCase();
					if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
						headingStyleSelect.value = tagName;
						break;
					} else if (tagName === 'p') {
						headingStyleSelect.value = '';
						break;
					}
					parent = parent.parentElement;
				}
			}
		} catch (e) {
			// Ignore errors from queryCommandState
		}
	}

	// Update active states on selection change
	document.addEventListener('selectionchange', updateActiveStates);

	// Save button handler
	saveBtn.addEventListener('click', () => {
		if (!docxRendered || !contentModified) {
			return;
		}

		saveDocument();
	});

	// Keyboard shortcuts
	document.addEventListener('keydown', (e) => {
		// Ctrl+S or Cmd+S to save
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			saveDocument();
		}

		// Ctrl+B for bold
		if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
			e.preventDefault();
			execFormatCommand('bold');
		}

		// Ctrl+I for italic
		if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
			e.preventDefault();
			execFormatCommand('italic');
		}

		// Ctrl+U for underline
		if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
			e.preventDefault();
			execFormatCommand('underline');
		}

		// Ctrl+Shift+L for align left
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
			e.preventDefault();
			execFormatCommand('justifyLeft');
		}

		// Ctrl+Shift+E for align center
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
			e.preventDefault();
			execFormatCommand('justifyCenter');
		}

		// Ctrl+Shift+R for align right
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
			e.preventDefault();
			execFormatCommand('justifyRight');
		}

		// Ctrl+Shift+7 for numbered list
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '7') {
			e.preventDefault();
			execFormatCommand('insertOrderedList');
		}

		// Ctrl+Shift+8 for bullet list
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '8') {
			e.preventDefault();
			execFormatCommand('insertUnorderedList');
		}

		// Ctrl+Enter for page break
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			insertPageBreak();
		}

		// Ctrl+Z or Cmd+Z for undo (browser default)
		if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
			// Browser will handle undo
			if (contentModified) {
				updateStatus('Modified');
			}
		}

		// Ctrl+Y or Cmd+Shift+Z for redo (browser default)
		if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
			// Browser will handle redo
			if (contentModified) {
				updateStatus('Modified');
			}
		}
	});

	function saveDocument() {
		if (!docxRendered) {
			return;
		}

		updateStatus('Saving...');
		saveBtn.disabled = true;

		// Get the edited HTML content
		const docxWrapper = container.querySelector('.docx-wrapper');
		const html = docxWrapper ? docxWrapper.innerHTML : '';

		// Extract plain text for fallback
		const text = docxWrapper ? docxWrapper.innerText : '';

		// Get margins for preservation
		let margins = { top: 40, right: 40, bottom: 40, left: 40 };
		if (docxWrapper) {
			const style = window.getComputedStyle(docxWrapper);
			const padding = style.padding.split(' ');
			if (padding.length >= 4) {
				margins = {
					top: parseInt(padding[0]),
					right: parseInt(padding[1]),
					bottom: parseInt(padding[2]),
					left: parseInt(padding[3])
				};
			}
		}

		// Send to host for saving
		vscode.postMessage({
			type: 'saveRequested',
			html: html,
			text: text,
			margins: margins
		});
	}

	function handleSaveComplete(message) {
		saveBtn.disabled = false;

		if (message.success) {
			contentModified = false;
			updateStatus('Saved');
			setTimeout(() => {
				if (!contentModified) {
					updateStatus('Ready');
				}
			}, 2000);
		} else {
			updateStatus('Save failed: ' + (message.error || 'Unknown error'));
		}
	}

	function updateStatus(text) {
		statusText.textContent = text;
	}

	// Text selection handler for Ctrl+K
	document.addEventListener('selectionchange', () => {
		const selection = window.getSelection();
		if (selection && !selection.isCollapsed) {
			const selectedText = selection.toString().trim();
			if (selectedText) {
				// Get selected HTML for context
				const range = selection.getRangeAt(0);
				const clonedSelection = range.cloneContents();
				const div = document.createElement('div');
				div.appendChild(clonedSelection);
				const selectedHtml = div.innerHTML;

				vscode.postMessage({
					type: 'textSelected',
					selection: {
						text: selectedText,
						html: selectedHtml
					}
				});
			}
		} else {
			vscode.postMessage({ type: 'clearSelection' });
		}
	});

	// Initial status
	updateStatus('Ready');

	// ===== AGENT EDIT OPERATIONS =====

	/**
	 * Execute document operations from agent tool calls
	 */
	function executeDocumentOperations(operations) {
		if (!docxRendered || !Array.isArray(operations)) {
			console.warn('[DOCX Webview] Cannot execute operations: document not rendered or invalid operations');
			return;
		}

		console.log(`[DOCX Webview] Executing ${operations.length} operation(s)`);

		operations.forEach(op => {
			try {
				switch (op.type) {
					case 'format_text':
						applyTextFormatting(op);
						break;
					case 'insert_text':
						insertTextAtPosition(op);
						break;
					case 'insert_table':
						insertTable(op.rows, op.cols);
						break;
					case 'insert_page_break':
						insertPageBreak();
						break;
					case 'set_margins':
						if (op.margins) {
							adjustMargins(op.margins.top, op.margins.right, op.margins.bottom, op.margins.left);
						}
						break;
					case 'replace_text':
						replaceText(op.search, op.replace, op.all);
						break;
					default:
						console.warn(`[DOCX Webview] Unknown operation type: ${op.type}`);
				}
			} catch (error) {
				console.error(`[DOCX Webview] Error executing operation ${op.type}:`, error);
			}
		});

		// Mark as modified and notify host
		trackModification();
		updateStatus(`Applied ${operations.length} edit operation(s)`);
	}

	/**
	 * Apply text formatting to a range
	 */
	function applyTextFormatting(op) {
		const docxWrapper = container.querySelector('.docx-wrapper');
		if (!docxWrapper) return;

		// This is a simplified implementation
		// In a real implementation, you'd need to:
		// 1. Find the text range by character position
		// 2. Create a selection
		// 3. Apply the formatting commands

		const textContent = docxWrapper.innerText;
		const start = op.range?.start || 0;
		const end = op.range?.end || textContent.length;

		// For now, we'll apply formatting to current selection or entire document
		const selection = window.getSelection();

		if (op.format.bold !== undefined) {
			document.execCommand('bold', false, null);
		}
		if (op.format.italic !== undefined) {
			document.execCommand('italic', false, null);
		}
		if (op.format.underline !== undefined) {
			document.execCommand('underline', false, null);
		}
		if (op.format.fontSize) {
			document.execCommand('fontSize', false, '7');
			const span = document.createElement('span');
			span.style.fontSize = op.format.fontSize + 'px';
		}
		if (op.format.fontFamily) {
			document.execCommand('fontName', false, op.format.fontFamily);
		}
		if (op.format.color) {
			document.execCommand('foreColor', false, op.format.color);
		}

		console.log(`[DOCX Webview] Applied text formatting`);
	}

	/**
	 * Insert text at a position
	 */
	function insertTextAtPosition(op) {
		const docxWrapper = container.querySelector('.docx-wrapper');
		if (!docxWrapper) return;

		// Insert at the end for now (simplified)
		const p = document.createElement('p');
		p.textContent = op.text;
		docxWrapper.appendChild(p);

		console.log(`[DOCX Webview] Inserted text: "${op.text}"`);
	}

	/**
	 * Replace text in document
	 */
	function replaceText(search, replace, all = false) {
		const docxWrapper = container.querySelector('.docx-wrapper');
		if (!docxWrapper) return;

		let count = 0;
		const walk = document.createTreeWalker(docxWrapper, NodeFilter.SHOW_TEXT);
		const nodes = [];
		while (walk.nextNode()) {
			nodes.push(walk.currentNode);
		}

		nodes.forEach(node => {
			if (node.nodeValue) {
				if (all) {
					const newValue = node.nodeValue.split(search).join(replace);
					if (newValue !== node.nodeValue) {
						node.nodeValue = newValue;
						count++;
					}
				} else if (node.nodeValue.includes(search)) {
					node.nodeValue = node.nodeValue.replace(search, replace);
					count++;
				}
			}
		});

		console.log(`[DOCX Webview] Replaced ${count} occurrence(s) of "${search}" with "${replace}"`);
	}

})();


