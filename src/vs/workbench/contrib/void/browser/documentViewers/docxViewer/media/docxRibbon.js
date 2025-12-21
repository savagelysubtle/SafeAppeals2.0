// DOCX Viewer Ribbon Controller
// Version: 1.1.0 (Font Fix)
class DocxRibbon {
	constructor(callbacks) {
		console.log('[DocxRibbon] Initializing v1.1.0');
		this.callbacks = callbacks || {};
		this.editor = null;
		this.activeTab = 'home';

		// DOM Elements
		this.elements = {
			tabs: document.querySelectorAll('.ribbon-tab'),
			panels: document.querySelectorAll('.ribbon-panel'),

			// Home Tab
			saveBtn: document.getElementById('save-btn'),
			printBtn: document.getElementById('print-btn'),
			undoBtn: document.getElementById('undo-btn'),
			redoBtn: document.getElementById('redo-btn'),
			fontFamilySelect: document.getElementById('font-family-select'),
			fontSizeSelect: document.getElementById('font-size-select'),
			boldBtn: document.getElementById('bold-btn'),
			italicBtn: document.getElementById('italic-btn'),
			underlineBtn: document.getElementById('underline-btn'),
			strikethroughBtn: document.getElementById('strikethrough-btn'),
			fontColorPicker: document.getElementById('font-color-picker'),
			alignLeftBtn: document.getElementById('align-left-btn'),
			alignCenterBtn: document.getElementById('align-center-btn'),
			alignRightBtn: document.getElementById('align-right-btn'),
			bulletListBtn: document.getElementById('bullet-list-btn'),
			orderedListBtn: document.getElementById('ordered-list-btn'),
			textStyleSelect: document.getElementById('text-style-select'),

			// Insert Tab
			insertTableBtn: document.getElementById('insert-table-btn'),
			insertImageBtn: document.getElementById('insert-image-btn'),
			insertLinkBtn: document.getElementById('insert-link-btn'),
			pageBreakBtn: document.getElementById('page-break-btn'),
			insertHrBtn: document.getElementById('insert-hr-btn'),

			// Layout Tab
			pageSizeSelect: document.getElementById('page-size-select'),
			marginPresetSelect: document.getElementById('margin-preset-select'),
			orientationPortraitBtn: document.getElementById('orientation-portrait-btn'),
			orientationLandscapeBtn: document.getElementById('orientation-landscape-btn')
		};

		this.initialize();
	}

	setEditor(editor) {
		this.editor = editor;
		// Initial update
		this.updateState();
	}

	initialize() {
		this.initializeTabs();
		this.initializeHomeTab();
		this.initializeInsertTab();
		this.initializeLayoutTab();
	}

	initializeTabs() {
		this.elements.tabs.forEach(tab => {
			tab.addEventListener('click', () => {
				const tabId = tab.dataset.tab;
				this.switchTab(tabId);
			});
		});
	}

	switchTab(tabId) {
		this.activeTab = tabId;

		// Update tab active states
		this.elements.tabs.forEach(tab => {
			tab.classList.toggle('active', tab.dataset.tab === tabId);
		});

		// Update panel visibility
		this.elements.panels.forEach(panel => {
			panel.classList.toggle('active', panel.dataset.panel === tabId);
		});
	}

	// Update ribbon state based on editor selection
	updateState() {
		if (!this.editor || !this.editor.editor) return;
		const editor = this.editor.editor;

		const e = this.elements;

		// Marks
		if (e.boldBtn) e.boldBtn.classList.toggle('active', editor.isActive('bold'));
		if (e.italicBtn) e.italicBtn.classList.toggle('active', editor.isActive('italic'));
		if (e.underlineBtn) e.underlineBtn.classList.toggle('active', editor.isActive('underline'));
		if (e.strikethroughBtn) e.strikethroughBtn.classList.toggle('active', editor.isActive('strike'));

		// Alignment
		if (e.alignLeftBtn) e.alignLeftBtn.classList.toggle('active', editor.isActive({ textAlign: 'left' }));
		if (e.alignCenterBtn) e.alignCenterBtn.classList.toggle('active', editor.isActive({ textAlign: 'center' }));
		if (e.alignRightBtn) e.alignRightBtn.classList.toggle('active', editor.isActive({ textAlign: 'right' }));

		// Lists
		if (e.bulletListBtn) e.bulletListBtn.classList.toggle('active', editor.isActive('bulletList'));
		if (e.orderedListBtn) e.orderedListBtn.classList.toggle('active', editor.isActive('orderedList'));

		// Text Style (Headings/Paragraph)
		if (e.textStyleSelect) {
			if (editor.isActive('heading', { level: 1 })) e.textStyleSelect.value = 'heading1';
			else if (editor.isActive('heading', { level: 2 })) e.textStyleSelect.value = 'heading2';
			else if (editor.isActive('heading', { level: 3 })) e.textStyleSelect.value = 'heading3';
			else if (editor.isActive('heading', { level: 4 })) e.textStyleSelect.value = 'heading4';
			else e.textStyleSelect.value = 'paragraph';
		}

		// Font Family & Size (if attributes available)
		if (e.fontFamilySelect) {
			const fontFamily = editor.getAttributes('textStyle').fontFamily;
			if (fontFamily) {
				// Remove quotes if present for comparison
				const cleanFont = fontFamily.replace(/['"]/g, '');
				e.fontFamilySelect.value = cleanFont;
			}
		}

		// Color
		if (e.fontColorPicker) {
			const color = editor.getAttributes('textStyle').color;
			if (color) e.fontColorPicker.value = color;
		}
	}

	initializeHomeTab() {
		const e = this.elements;

		// File Operations
		if (e.saveBtn) e.saveBtn.addEventListener('click', () => this.callbacks.onSave?.());
		if (e.printBtn) e.printBtn.addEventListener('click', () => this.callbacks.onPrint?.());

		// Undo/Redo
		if (e.undoBtn) {
			e.undoBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					this.editor.editor.chain().focus().undo().run();
				}
			});
		}
		if (e.redoBtn) {
			e.redoBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					this.editor.editor.chain().focus().redo().run();
				}
			});
		}

		// Font Styling
		if (e.fontFamilySelect) {
			e.fontFamilySelect.addEventListener('change', () => {
				if (this.editor?.editor) {
					try {
						const fontValue = e.fontFamilySelect.value;
						console.log('[DocxRibbon] Setting font family to:', fontValue);

						// Debug selection state
						const { from, to, empty } = this.editor.editor.state.selection;
						console.log(`[DocxRibbon] Current selection: from ${from} to ${to}, empty: ${empty}`);

						// Check if command is available
						if (typeof this.editor.editor.chain().focus().setFontFamily === 'function') {
							// Use chain().focus() to ensure editor has focus
							const chain = this.editor.editor.chain().focus();

							// Add quotes if font name has spaces and isn't already quoted
							const fontToApply = fontValue.includes(' ') && !fontValue.startsWith("'") && !fontValue.startsWith('"')
								? `"${fontValue}"`
								: fontValue;

							const success = chain.setFontFamily(fontToApply).run();

							console.log('[DocxRibbon] setFontFamily result:', success);

							if (success) {
								this.callbacks.onModification?.();
							} else {
								console.warn('[DocxRibbon] setFontFamily command returned false - check if extension is loaded');
							}
						} else {
							console.error('[DocxRibbon] setFontFamily command not found! TiptapFontFamily extension missing?');
						}
					} catch (err) {
						console.error('[DocxRibbon] Font family error:', err);
					}
				} else {
					console.warn('[DocxRibbon] Editor not initialized');
				}
			});
		}

		if (e.fontSizeSelect) {
			e.fontSizeSelect.addEventListener('change', () => {
				if (this.editor?.editor) {
					try {
						// Note: Requires custom font size extension or implementation
						const fontSize = e.fontSizeSelect.value + 'pt';
						console.log('[DocxRibbon] Setting font size (simulated) to:', fontSize);
						this.callbacks.onModification?.();
					} catch (err) {
						console.warn('[DocxRibbon] Font size change failed');
					}
				}
			});
		}

		if (e.boldBtn) {
			e.boldBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					this.editor.editor.chain().focus().toggleBold().run();
					this.callbacks.onModification?.();
					this.updateState();
				}
			});
		}

		if (e.italicBtn) {
			e.italicBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					this.editor.editor.chain().focus().toggleItalic().run();
					this.callbacks.onModification?.();
					this.updateState();
				}
			});
		}

		if (e.underlineBtn) {
			e.underlineBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					this.editor.editor.chain().focus().toggleUnderline().run();
					this.callbacks.onModification?.();
					this.updateState();
				}
			});
		}

		if (e.strikethroughBtn) {
			e.strikethroughBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					this.editor.editor.chain().focus().toggleStrike().run();
					this.callbacks.onModification?.();
					this.updateState();
				}
			});
		}

		if (e.fontColorPicker) {
			e.fontColorPicker.addEventListener('input', () => {
				if (this.editor?.editor) {
					try {
						const color = e.fontColorPicker.value;
						console.log('[DocxRibbon] Setting color to:', color);
						this.editor.editor.chain().focus().setColor(color).run();
						this.callbacks.onModification?.();
					} catch (err) {
						console.warn('[DocxRibbon] Color extension not available');
					}
				}
			});
		}

		// Paragraph Styling
		if (e.alignLeftBtn) {
			e.alignLeftBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					this.editor.editor.chain().focus().setTextAlign('left').run();
					this.callbacks.onModification?.();
					this.updateState();
				}
			});
		}

		if (e.alignCenterBtn) {
			e.alignCenterBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					this.editor.editor.chain().focus().setTextAlign('center').run();
					this.callbacks.onModification?.();
					this.updateState();
				}
			});
		}

		if (e.alignRightBtn) {
			e.alignRightBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					this.editor.editor.chain().focus().setTextAlign('right').run();
					this.callbacks.onModification?.();
					this.updateState();
				}
			});
		}

		if (e.bulletListBtn) {
			e.bulletListBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					this.editor.editor.chain().focus().toggleBulletList().run();
					this.callbacks.onModification?.();
					this.updateState();
				}
			});
		}

		if (e.orderedListBtn) {
			e.orderedListBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					this.editor.editor.chain().focus().toggleOrderedList().run();
					this.callbacks.onModification?.();
					this.updateState();
				}
			});
		}

		// Text Styles
		if (e.textStyleSelect) {
			e.textStyleSelect.addEventListener('change', () => {
				if (this.editor?.editor) {
					const value = e.textStyleSelect.value;
					switch (value) {
						case 'paragraph':
							this.editor.editor.chain().focus().setParagraph().run();
							break;
						case 'heading1':
							this.editor.editor.chain().focus().toggleHeading({ level: 1 }).run();
							break;
						case 'heading2':
							this.editor.editor.chain().focus().toggleHeading({ level: 2 }).run();
							break;
						case 'heading3':
							this.editor.editor.chain().focus().toggleHeading({ level: 3 }).run();
							break;
						case 'heading4':
							this.editor.editor.chain().focus().toggleHeading({ level: 4 }).run();
							break;
					}
					this.callbacks.onModification?.();
					this.updateState();
				}
			});
		}
	}

	initializeInsertTab() {
		const e = this.elements;

		if (e.insertTableBtn) {
			e.insertTableBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					try {
						this.editor.editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run();
						this.callbacks.onModification?.();
					} catch (err) {
						console.warn('[DocxRibbon] Table extension not available');
						alert('Table insertion requires the Table extension');
					}
				}
			});
		}

		if (e.insertImageBtn) {
			e.insertImageBtn.addEventListener('click', () => {
				console.log('[DocxRibbon] Image insertion requested');
				alert('Image insertion coming soon');
			});
		}

		if (e.insertLinkBtn) {
			e.insertLinkBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					const url = prompt('Enter URL:');
					if (url) {
						try {
							this.editor.editor.chain().focus().setLink({ href: url }).run();
							this.callbacks.onModification?.();
							this.updateState();
						} catch (err) {
							console.warn('[DocxRibbon] Link extension not available');
						}
					}
				}
			});
		}

		if (e.pageBreakBtn) {
			e.pageBreakBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					this.editor.editor.chain().focus().setHardBreak().run();
					this.callbacks.onModification?.();
				}
			});
		}

		if (e.insertHrBtn) {
			e.insertHrBtn.addEventListener('click', () => {
				if (this.editor?.editor) {
					try {
						this.editor.editor.chain().focus().setHorizontalRule().run();
						this.callbacks.onModification?.();
					} catch (err) {
						console.warn('[DocxRibbon] HorizontalRule extension not available');
					}
				}
			});
		}
	}

	initializeLayoutTab() {
		const e = this.elements;

		if (e.pageSizeSelect) {
			e.pageSizeSelect.addEventListener('change', () => {
				const size = e.pageSizeSelect.value;
				this.callbacks.onPageSizeChange?.(size);
			});
		}

		if (e.marginPresetSelect) {
			e.marginPresetSelect.addEventListener('change', () => {
				const preset = e.marginPresetSelect.value;
				this.callbacks.onMarginChange?.(preset);
			});
		}

		if (e.orientationPortraitBtn) {
			e.orientationPortraitBtn.addEventListener('click', () => {
				this.callbacks.onOrientationChange?.('portrait');
			});
		}

		if (e.orientationLandscapeBtn) {
			e.orientationLandscapeBtn.addEventListener('click', () => {
				this.callbacks.onOrientationChange?.('landscape');
			});
		}
	}
}

// Expose to window
window.DocxRibbon = DocxRibbon;
