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
			exportPdfBtn: document.getElementById('export-pdf-btn'),
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

	// Helper to find all node types in a JSON structure
	findNodeTypes(json, types = new Set()) {
		if (json && json.type) {
			types.add(json.type);
		}
		if (json && json.content && Array.isArray(json.content)) {
			json.content.forEach(child => this.findNodeTypes(child, types));
		}
		return Array.from(types);
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
		if (e.exportPdfBtn) e.exportPdfBtn.addEventListener('click', () => this.callbacks.onExportPDF?.());

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
			// Create a hidden file input for image selection
			const imageInput = document.createElement('input');
			imageInput.type = 'file';
			imageInput.accept = 'image/*';
			imageInput.style.display = 'none';
			document.body.appendChild(imageInput);

			// Helper to resize image and return BASE64 DATA URL for persistence
			// Previously returned blob URLs which don't persist across saves
			const resizeImageToBase64 = async (file, maxWidth, maxHeight) => {
				// Get pica from global (loaded via webpack bundle)
				const PicaLib = window.Pica;

				// Create image from file
				const img = new Image();
				const objectUrl = URL.createObjectURL(file);

				try {
					await new Promise((resolve, reject) => {
						img.onload = resolve;
						img.onerror = reject;
						img.src = objectUrl;
					});

					console.log('[DocxRibbon] Original image:', img.width, 'x', img.height, 'file:', Math.round(file.size/1024), 'KB');

					// Calculate target dimensions
					let width = img.width;
					let height = img.height;

					if (width > maxWidth || height > maxHeight) {
						const ratio = Math.min(maxWidth / width, maxHeight / height);
						width = Math.round(width * ratio);
						height = Math.round(height * ratio);
					}

					// Create source canvas
					const srcCanvas = document.createElement('canvas');
					srcCanvas.width = img.width;
					srcCanvas.height = img.height;
					srcCanvas.getContext('2d').drawImage(img, 0, 0);

					// Create destination canvas
					const destCanvas = document.createElement('canvas');
					destCanvas.width = width;
					destCanvas.height = height;

					let base64DataUrl;

					// Use pica if available for high-quality memory-efficient resize
					let usedPica = false;
					if (PicaLib) {
						try {
							const pica = new PicaLib();
							await pica.resize(srcCanvas, destCanvas, {
								unsharpAmount: 80,
								unsharpRadius: 0.6,
								unsharpThreshold: 2
							});

							// Convert to base64 DATA URL for persistence (not blob URL!)
							// Use JPEG for photos (smaller), PNG for images with transparency
							const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
							const quality = mimeType === 'image/jpeg' ? 0.85 : undefined;
							base64DataUrl = destCanvas.toDataURL(mimeType, quality);
							usedPica = true;

							console.log('[DocxRibbon] ✅ Pica resize complete:', width, 'x', height, 'base64 size:', Math.round(base64DataUrl.length/1024), 'KB');
						} catch (picaErr) {
							console.warn('[DocxRibbon] Pica resize failed:', picaErr);
						}
					}

					// Fallback to canvas resize if pica not available or failed
					if (!usedPica) {
						console.warn('[DocxRibbon] Using canvas fallback');
						destCanvas.getContext('2d').drawImage(srcCanvas, 0, 0, width, height);

						// Convert to base64 DATA URL for persistence
						const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
						const quality = mimeType === 'image/jpeg' ? 0.85 : undefined;
						base64DataUrl = destCanvas.toDataURL(mimeType, quality);
					}

					// Verify we have a proper base64 data URL
					if (!base64DataUrl || !base64DataUrl.startsWith('data:image')) {
						throw new Error('Failed to generate base64 image');
					}

					// CRITICAL: Cleanup to free memory
					URL.revokeObjectURL(objectUrl);
					srcCanvas.width = 0;
					srcCanvas.height = 0;
					destCanvas.width = 0;
					destCanvas.height = 0;

					return base64DataUrl;
				} catch (err) {
					URL.revokeObjectURL(objectUrl);
					throw err;
				}
			};

			imageInput.addEventListener('change', async (event) => {
				const file = event.target.files?.[0];
				if (!file) return;

				const MAX_FILE_SIZE_MB = 10; // Maximum file size to prevent memory issues

				console.log('[DocxRibbon] Image selected:', file.name, Math.round(file.size/1024), 'KB');

				// CRITICAL: Reject very large files to prevent memory explosion
				if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
					console.error('[DocxRibbon] ❌ Image too large:', Math.round(file.size / 1024 / 1024), 'MB');
					alert(`Image too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
					imageInput.value = '';
					return;
				}

				try {
					// Resize to fit within page (max 600px width, 800px height for letter page)
					const maxWidth = 600;
					const maxHeight = 800;
					const base64DataUrl = await resizeImageToBase64(file, maxWidth, maxHeight);

					if (base64DataUrl && this.editor?.editor) {
						// Check if setImage command exists
						const hasSetImage = !!this.editor.editor.commands.setImage;
						console.log('[DocxRibbon] setImage command available:', hasSetImage);

						// Insert image with base64 data URL (persists across saves)
						const result = this.editor.editor.chain().focus().setImage({ src: base64DataUrl }).run();
						console.log('[DocxRibbon] setImage chain result:', result);

						this.callbacks.onModification?.();
						console.log('[DocxRibbon] ✅ Image inserted successfully (base64 for persistence)');
					}
				} catch (err) {
					console.error('[DocxRibbon] Image processing failed:', err);
					alert('Failed to process image: ' + err.message);
				}

				// Reset input so same file can be selected again
				imageInput.value = '';
			});

			e.insertImageBtn.addEventListener('click', () => {
				console.log('[DocxRibbon] Image insertion requested');
				imageInput.click();
			});
		}

			if (e.insertLinkBtn) {
				e.insertLinkBtn.addEventListener('click', () => {
					console.log('[DocxRibbon] Insert Link button clicked');
					if (this.editor?.editor) {
						// Capture current selection
						const { from, to } = this.editor.editor.state.selection;
					const previousUrl = this.editor.editor.getAttributes('link').href;

					this.showInputModal('Insert Link', previousUrl || '', (url) => {
						// Focus back first
						this.editor.editor.commands.focus();

						// Restore selection if needed (focus usually restores it, but just in case)
						if (from !== to) {
							this.editor.editor.commands.setTextSelection({ from, to });
						}

						if (url) {
							try {
								// Ensure protocol
								if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url) && !url.startsWith('/')) {
									url = 'https://' + url;
								}

								console.log('[DocxRibbon] Setting link:', url, 'Selection:', from, to);
								const result = this.editor.editor.chain().setLink({ href: url }).run();
								console.log('[DocxRibbon] setLink result:', result);

								this.callbacks.onModification?.();
								this.updateState();
							} catch (err) {
								console.warn('[DocxRibbon] Link extension error:', err);
							}
						} else if (previousUrl) {
							this.editor.editor.chain().unsetLink().run();
							this.callbacks.onModification?.();
							this.updateState();
						}
					});
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

	// Simple modal for text input (replaces native prompt)
	showInputModal(title, initialValue, callback) {
		// Create modal elements
		const overlay = document.createElement('div');
		overlay.className = 'margins-dialog'; // Reuse existing styling

		const content = document.createElement('div');
		content.className = 'dialog-content';

		const titleEl = document.createElement('h3');
		titleEl.textContent = title;

		const inputGroup = document.createElement('div');
		inputGroup.style.marginBottom = '16px';

		const input = document.createElement('input');
		input.type = 'text';
		input.value = initialValue || '';
		input.style.width = '100%';
		input.style.padding = '8px';
		input.style.backgroundColor = 'var(--vscode-input-background)';
		input.style.color = 'var(--vscode-input-foreground)';
		input.style.border = '1px solid var(--vscode-input-border)';
		input.style.borderRadius = '4px';
		input.style.boxSizing = 'border-box';
		input.placeholder = 'https://example.com';

		inputGroup.appendChild(input);

		const btnGroup = document.createElement('div');
		btnGroup.style.display = 'flex';
		btnGroup.style.justifyContent = 'flex-end';
		btnGroup.style.gap = '8px';

		const cancelBtn = document.createElement('button');
		cancelBtn.textContent = 'Cancel';
		cancelBtn.id = 'cancel-input';
		// Reuse cancel style from CSS if available, or set inline
		cancelBtn.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
		cancelBtn.style.color = 'var(--vscode-button-secondaryForeground)';

		const okBtn = document.createElement('button');
		okBtn.textContent = 'OK';

		btnGroup.appendChild(cancelBtn);
		btnGroup.appendChild(okBtn);

		content.appendChild(titleEl);
		content.appendChild(inputGroup);
		content.appendChild(btnGroup);
		overlay.appendChild(content);
		document.body.appendChild(overlay);

		// Focus input
		setTimeout(() => input.focus(), 50);

		const close = () => {
			if (document.body.contains(overlay)) {
				document.body.removeChild(overlay);
			}
		};

		cancelBtn.onclick = close;

		const submit = () => {
			callback(input.value);
			close();
		};

		okBtn.onclick = submit;

		input.onkeydown = (e) => {
			if (e.key === 'Enter') {
				submit();
			} else if (e.key === 'Escape') {
				close();
			}
		};

		// Close on click outside
		overlay.onclick = (e) => {
			if (e.target === overlay) {
				close();
			}
		};
	}
}

// Expose to window
window.DocxRibbon = DocxRibbon;
