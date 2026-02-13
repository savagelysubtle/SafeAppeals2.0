// Bundled Tiptap DOCX Editor for Webview
// This bundles the TiptapDocxEditor class with necessary dependencies

(function () {
	'use strict';

	// Check for required dependencies
	function checkDependencies() {
		const missing = [];
		if (typeof window.docx === 'undefined') missing.push('docx-preview');
		// Don't require Tiptap pagination - it's optional

		if (missing.length > 0) {
			console.error('[TiptapDocxEditor] Missing dependencies:', missing);
			return false;
		}
		return true;
	}

	class TiptapDocxEditor {
		constructor(container, options = {}) {
			if (!checkDependencies()) {
				console.error('[TiptapDocxEditor] Required libraries not loaded. Check console for details.');
				console.log('[TiptapDocxEditor] window.Editor:', typeof window.Editor);
				console.log('[TiptapDocxEditor] window.TiptapCore:', typeof window.TiptapCore);
				console.log('[TiptapDocxEditor] window.StarterKit:', typeof window.StarterKit);
				console.log('[TiptapDocxEditor] window.TiptapStarterKit:', typeof window.TiptapStarterKit);
				console.log('[TiptapDocxEditor] window.docx:', typeof window.docx);
				throw new Error('Required Tiptap libraries not loaded. Check CSP and script loading.');
			}

			this.container = container;
			this.options = {
				pageSize: options.pageSize || 'letter',
				orientation: options.orientation || 'portrait',
				margin: options.margin || 96,
				enableAutoPageBreaks: options.enableAutoPageBreaks !== false,
				onContentChange: options.onContentChange || (() => { }),
			};

			this.pageDimensions = this.getPageDimensions(this.options.pageSize);
			this.initialize();
		}

		getPageDimensions(pageSize) {
			const dimensions = {
				letter: { width: 816, height: 1056 },
				legal: { width: 816, height: 1344 },
				tabloid: { width: 1056, height: 1632 },
				a4: { width: 794, height: 1123 },
				a3: { width: 1123, height: 1587 },
			};
			return dimensions[pageSize] || dimensions.letter;
		}

		initialize() {
			console.log('[TiptapDocxEditor] Initializing - Version 2.1 (Inline Image Support)');
			console.log('[TiptapDocxEditor] Available globals:', Object.keys(window).filter(k =>
				k.toLowerCase().includes('tiptap') || k === 'Editor' || k === 'StarterKit'
			));

			// Get Editor from our bundled global
			const Editor = window.TiptapEditor || window.Tiptap?.Editor || window.Editor;
			if (!Editor) {
				console.error('[TiptapDocxEditor] Could not find Tiptap Editor class');
				console.error('[TiptapDocxEditor] window.TiptapEditor:', window.TiptapEditor);
				console.error('[TiptapDocxEditor] window.Tiptap:', window.Tiptap);
				throw new Error('Tiptap Editor class not found');
			}

			console.log('[TiptapDocxEditor] Found Editor at:', Editor);

			try {
				this.editor = new Editor({
					element: this.container,
					extensions: this.getExtensions(),
					content: '<p>Loading...</p>',
					editable: true, // Explicitly enable editing
					editorProps: {
						attributes: {
							class: 'tiptap-editor prose focus:outline-none',
							spellcheck: 'true',
							contenteditable: 'true', // Ensure contenteditable is set
						},
					},
					onUpdate: () => {
						this.options.onContentChange();
					},
				});

				console.log('[TiptapDocxEditor] Initialized successfully');
				console.log('[TiptapDocxEditor] Editor is editable:', this.editor.isEditable);

				// DEFENSIVE: Remove any page-extension-styles that might have been injected
				// The extension injects CSS with a 100ms delay in onCreate
				// We check multiple times to ensure it's removed
				const removeInjectedStyles = () => {
					const existingStyles = document.getElementById('page-extension-styles');
					if (existingStyles) {
						console.log('[TiptapDocxEditor] Removing page-extension-styles');
						existingStyles.remove();
					}
				};
				// Check at multiple intervals to catch the delayed injection
				setTimeout(removeInjectedStyles, 50);
				setTimeout(removeInjectedStyles, 150);
				setTimeout(removeInjectedStyles, 300);
				setTimeout(removeInjectedStyles, 500);

			} catch (error) {
				console.error('[TiptapDocxEditor] Failed to initialize:', error);
				throw error;
			}
		}

		getExtensions() {
			// Use Tiptap extensions - try different global names
			const extensions = [];

			// Check if @adalat-ai/page-extension is available
			const PageExtension = window.TiptapPageExtension;
			const PageDocument = window.TiptapPageDocument;
			const Extension = window.TiptapExtension || window.Tiptap?.Extension || window.Extension; // Get base Extension class

			// Try to get StarterKit from bundled global
			const StarterKit = window.TiptapStarterKit || window.Tiptap?.StarterKit || window.StarterKit;

			if (StarterKit) {
				console.log('[TiptapDocxEditor] Adding StarterKit extension');
				// IMPORTANT: Disable document when using PageDocument from @adalat-ai/page-extension
				extensions.push(StarterKit.configure({
					document: PageDocument ? false : undefined, // Disable if PageDocument is available
				}));
			} else {
				console.warn('[TiptapDocxEditor] StarterKit not found, editor may have limited functionality');
				console.warn('[TiptapDocxEditor] window.TiptapStarterKit:', window.TiptapStarterKit);
			}

			// Add Underline extension if available from bundle
			const Underline = window.TiptapUnderline;
			if (Underline) {
				extensions.push(Underline);
				console.log('[TiptapDocxEditor] ✅ Underline extension added');
			}

			// Add TextAlign extension if available
			const TextAlign = window.TiptapTextAlign;
			if (TextAlign) {
				extensions.push(TextAlign.configure({
					types: ['heading', 'paragraph'],
				}));
				console.log('[TiptapDocxEditor] ✅ TextAlign extension added');
			}

			// Add Link extension if available
			const Link = window.TiptapLink;
			if (Link) {
				extensions.push(Link.configure({
					openOnClick: false,
					HTMLAttributes: {
						class: 'docx-link',
					},
				}));
				console.log('[TiptapDocxEditor] ✅ Link extension added');
			}

			// Add TextStyle extension (required for FontFamily and Color)
			const TextStyle = window.TiptapTextStyle;
			if (TextStyle) {
				console.log('[TiptapDocxEditor] ✅ TextStyle extension added');
				extensions.push(TextStyle);
			} else {
				console.warn('[TiptapDocxEditor] ❌ TextStyle extension MISSING - Fonts will not work');
			}

			// Add FontFamily extension
			const FontFamily = window.TiptapFontFamily;
			if (FontFamily) {
				console.log('[TiptapDocxEditor] ✅ FontFamily extension added');
				extensions.push(FontFamily);
			} else {
				console.warn('[TiptapDocxEditor] ❌ FontFamily extension MISSING');
			}

			// Add Color extension
			const Color = window.TiptapColor;
			if (Color) {
				console.log('[TiptapDocxEditor] ✅ Color extension added');
				extensions.push(Color);
			} else {
				console.warn('[TiptapDocxEditor] ❌ Color extension MISSING');
			}

			// ============================================
			// IMAGE PROCESSING UTILITIES
			// ============================================

			/**
			 * Extract image dimensions from binary header WITHOUT full decoding
			 * Performance: < 0.05ms (vs 10-100ms for new Image().onload)
			 * Supports: PNG, JPEG, GIF
			 * From Perplexity research on OOXML image handling
			 */
			this.getImageDimensionsFromBinary = (data) => {
				if (!(data instanceof Uint8Array)) {
					console.warn('[TiptapDocxEditor] getImageDimensionsFromBinary: Expected Uint8Array');
					return null;
				}
				if (data.length < 24) return null; // Need at least 24 bytes for headers

				const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

				// PNG: Signature (8 bytes) + IHDR Chunk
				// Signature: 89 50 4E 47 0D 0A 1A 0A
				if (view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) {
					return {
						type: 'png',
						width: view.getUint32(16, false), // Big-endian
						height: view.getUint32(20, false),
					};
				}

				// GIF: Signature (3 bytes "GIF") + Version (3 bytes "89a")
				if ((view.getUint32(0, false) >>> 8) === 0x474946) {
					return {
						type: 'gif',
						width: view.getUint16(6, true), // Little-endian
						height: view.getUint16(8, true),
					};
				}

				// JPEG: Start of Image (FF D8)
				if (view.getUint16(0, false) === 0xffd8) {
					let offset = 2;
					while (offset < view.byteLength - 8) {
						if (view.getUint8(offset) !== 0xff) {
							offset++;
							continue;
						}
						const marker = view.getUint8(offset + 1);
						// SOF0-SOF15, except C4 (DHT), C8 (JPG), CC (DAC)
						if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
							const height = view.getUint16(offset + 5, false);
							const width = view.getUint16(offset + 7, false);
							return { type: 'jpg', width, height };
						}
						offset += 2;
						if (offset + 2 > view.byteLength) break;
						const length = view.getUint16(offset, false);
						offset += length;
					}
				}

				return null; // Unknown format
			};

			/**
			 * Extract dimensions from a Base64 data URL without full image decode
			 * Handles data:image/* and data:application/octet-stream (used by docx-preview)
			 */
			this.getImageDimensionsFromBase64 = (dataUrl) => {
				if (!dataUrl || !dataUrl.startsWith('data:')) return null;
				try {
					const base64 = dataUrl.split(',')[1];
					if (!base64) return null;
					const binaryString = atob(base64);
					// Only need first ~1KB for header parsing
					const len = Math.min(binaryString.length, 1024);
					const bytes = new Uint8Array(len);
					for (let i = 0; i < len; i++) {
						bytes[i] = binaryString.charCodeAt(i);
					}
					return this.getImageDimensionsFromBinary(bytes);
				} catch (e) {
					console.warn('[TiptapDocxEditor] Failed to parse image dimensions:', e);
					return null;
				}
			};

			// Memory-efficient image resizing with strict limits
			// Returns base64 data URL for persistence
			// CRITICAL: Size limits to prevent memory explosion
			const MAX_IMAGE_WIDTH = 800;  // Max width in pixels
			const MAX_IMAGE_HEIGHT = 1000; // Max height in pixels
			const MAX_FILE_SIZE_MB = 10;   // Max file size (reject larger)
			const SMALL_IMAGE_THRESHOLD = 100 * 1024; // 100KB - small images don't need resize

			const resizeAndConvertToBase64 = async (file) => {
				return new Promise(async (resolve, reject) => {
					try {
						console.log('[TiptapDocxEditor] Processing image:', file.name, Math.round(file.size / 1024), 'KB');

						// CRITICAL: Reject very large files to prevent memory explosion
						if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
							console.error('[TiptapDocxEditor] ❌ Image too large, rejecting:', Math.round(file.size / 1024 / 1024), 'MB', '(max:', MAX_FILE_SIZE_MB, 'MB)');
							reject(new Error(`Image too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`));
							return;
						}

						// For small images, just convert directly
						if (file.size < SMALL_IMAGE_THRESHOLD) {
							const reader = new FileReader();
							reader.onloadend = () => resolve(reader.result);
							reader.onerror = reject;
							reader.readAsDataURL(file);
							return;
						}

						// For larger images, resize to prevent memory issues
						const img = new Image();
						const objectUrl = URL.createObjectURL(file);

						img.onload = () => {
							try {
								let width = img.width;
								let height = img.height;

								console.log('[TiptapDocxEditor] Original dimensions:', width, 'x', height);

								// Calculate target dimensions
								if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
									const ratio = Math.min(MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height);
									width = Math.round(width * ratio);
									height = Math.round(height * ratio);
									console.log('[TiptapDocxEditor] Resizing to:', width, 'x', height);
								}

								// Create canvas with target size only (not source size!)
								const canvas = document.createElement('canvas');
								canvas.width = width;
								canvas.height = height;

								const ctx = canvas.getContext('2d');
								// Use better quality settings
								ctx.imageSmoothingEnabled = true;
								ctx.imageSmoothingQuality = 'high';
								ctx.drawImage(img, 0, 0, width, height);

								// Convert to JPEG for photos (much smaller), PNG for transparency
								const isPNG = file.type === 'image/png';
								const mimeType = isPNG ? 'image/png' : 'image/jpeg';
								const quality = isPNG ? undefined : 0.85;

								const base64 = canvas.toDataURL(mimeType, quality);

								// CRITICAL: Cleanup immediately to free memory
								URL.revokeObjectURL(objectUrl);
								canvas.width = 0;
								canvas.height = 0;

								console.log('[TiptapDocxEditor] ✅ Image processed, base64 size:', Math.round(base64.length / 1024), 'KB');
								resolve(base64);
							} catch (e) {
								URL.revokeObjectURL(objectUrl);
								reject(e);
							}
						};

						img.onerror = () => {
							URL.revokeObjectURL(objectUrl);
							reject(new Error('Failed to load image'));
						};

						img.src = objectUrl;
					} catch (e) {
						reject(e);
					}
				});
			};

			// Add FileHandler for Drag & Drop and Paste using editorProps
			// NOTE: ProseMirror Plugin class is not available in our bundle, so we use
			// Tiptap's editorProps which gets passed directly to ProseMirror
			const FileHandler = Extension.create({
				name: 'fileHandler',

				addOptions() {
					return {
						allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
					};
				},

				// Use editorProps instead of addProseMirrorPlugins
				// This works without needing the Plugin class
				addKeyboardShortcuts() {
					return {};
				},

				onCreate() {
					// Set up paste handler via DOM event
					const editor = this.editor;
					const element = editor.view.dom;

					const handlePaste = async (event) => {
						const items = Array.from(event.clipboardData?.items || []);
						const imageItems = items.filter(item => item.type.indexOf('image') === 0);

						if (imageItems.length === 0) return;

						event.preventDefault();
						event.stopPropagation();

						for (const item of imageItems) {
							const file = item.getAsFile();
							if (!file) continue;

							try {
								const base64 = await resizeAndConvertToBase64(file);
								editor.chain().focus().setImage({ src: base64 }).run();
							} catch (e) {
								console.error('[TiptapDocxEditor] Paste image failed:', e);
							}
						}
					};

					const handleDrop = async (event) => {
						if (!event.dataTransfer?.files?.length) return;

						const files = Array.from(event.dataTransfer.files);
						const imageFiles = files.filter(f => f.type.indexOf('image') === 0);

						if (imageFiles.length === 0) return;

						event.preventDefault();
						event.stopPropagation();

						for (const file of imageFiles) {
							try {
								const base64 = await resizeAndConvertToBase64(file);

								// Get drop position
								const coordinates = editor.view.posAtCoords({
									left: event.clientX,
									top: event.clientY
								});

								if (coordinates) {
									editor.chain()
										.focus()
										.setTextSelection(coordinates.pos)
										.setImage({ src: base64 })
										.run();
								} else {
									editor.chain().focus().setImage({ src: base64 }).run();
								}
							} catch (e) {
								console.error('[TiptapDocxEditor] Drop image failed:', e);
							}
						}
					};

					// Attach handlers
					element.addEventListener('paste', handlePaste, true);
					element.addEventListener('drop', handleDrop, true);

					// Store for cleanup
					this.storage.pasteHandler = handlePaste;
					this.storage.dropHandler = handleDrop;

					console.log('[TiptapDocxEditor] ✅ FileHandler DOM events attached');
				},

				onDestroy() {
					const element = this.editor.view.dom;
					if (this.storage.pasteHandler) {
						element.removeEventListener('paste', this.storage.pasteHandler, true);
					}
					if (this.storage.dropHandler) {
						element.removeEventListener('drop', this.storage.dropHandler, true);
					}
				},

				addStorage() {
					return {
						pasteHandler: null,
						dropHandler: null,
					};
				},
			});
			extensions.push(FileHandler);
			console.log('[TiptapDocxEditor] ✅ FileHandler extension added (DOM-based paste/drop)');

			// NOTE: HorizontalRule is already included in StarterKit, don't add separately

			// Add Table extensions
			const Table = window.TiptapTable;
			const TableRow = window.TiptapTableRow;
			const TableCell = window.TiptapTableCell;
			const TableHeader = window.TiptapTableHeader;
			if (Table && TableRow && TableCell && TableHeader) {
				extensions.push(Table.configure({
					resizable: true,
					HTMLAttributes: {
						class: 'docx-table',
					},
				}));
				extensions.push(TableRow);
				extensions.push(TableCell);
				extensions.push(TableHeader);
				console.log('[TiptapDocxEditor] ✅ Table extensions added');
			} else {
				console.warn('[TiptapDocxEditor] ❌ Table extensions MISSING');
			}

			// Add lightweight Image extension with manual resize handles
			// This is MUCH more memory efficient than tiptap-extension-resize-image
			// CRITICAL: Image is a Node, not an Extension - must use Node.create()
			const TiptapNode = window.TiptapNode;
			if (TiptapNode) {
				const LightweightImage = TiptapNode.create({
					name: 'image',
					// Change to inline to support images inside paragraphs (common in docx-preview output)
					inline: true,
					group: 'inline',
					atom: true,  // Image is an atomic node (not editable content inside)
					draggable: false,  // DISABLED - dragging large base64 images causes memory issues
					selectable: true,

					addAttributes() {
						return {
							src: {
								default: null,
								parseHTML: element => element.getAttribute('src'),
							},
							alt: {
								default: null,
								parseHTML: element => element.getAttribute('alt'),
							},
							title: {
								default: null,
								parseHTML: element => element.getAttribute('title'),
							},
							width: {
								default: null,
								parseHTML: element => {
									const widthAttr = element.getAttribute('width');
									if (widthAttr) return parseInt(widthAttr, 10);
									const style = element.getAttribute('style') || '';
									const widthMatch = style.match(/width:\s*(\d+)px/);
									if (widthMatch) return parseInt(widthMatch[1], 10);
									if (element.offsetWidth) return element.offsetWidth;
									return null;
								},
							},
							height: {
								default: null,
								parseHTML: element => {
									const heightAttr = element.getAttribute('height');
									if (heightAttr) return parseInt(heightAttr, 10);
									const style = element.getAttribute('style') || '';
									const heightMatch = style.match(/height:\s*(\d+)px/);
									if (heightMatch) return parseInt(heightMatch[1], 10);
									if (element.offsetHeight) return element.offsetHeight;
									return null;
								},
							},
							// Floating Image Attributes
							wrapType: {
								default: 'inline', // inline, square, tight, front, behind
								parseHTML: element => element.dataset.wrapType || 'inline',
								renderHTML: attributes => ({ 'data-wrap-type': attributes.wrapType }),
							},
							floatSide: {
								default: null, // left, right, center
								parseHTML: element => element.dataset.floatSide,
								renderHTML: attributes => ({ 'data-float-side': attributes.floatSide }),
							},
							behindDoc: {
								default: false,
								parseHTML: element => element.dataset.behind === 'true',
								renderHTML: attributes => ({ 'data-behind': attributes.behindDoc }),
							},
							margin: {
								default: 0,
								parseHTML: element => parseInt(element.dataset.margin || '0', 10),
								renderHTML: attributes => ({ 'data-margin': attributes.margin }),
							}
						};
					},

					parseHTML() {
						return [{
							tag: 'img[src]',
						}];
					},

					renderHTML({ HTMLAttributes }) {
						const style = [];
						if (HTMLAttributes.width) {
							style.push(`width: ${HTMLAttributes.width}px`);
						}
						if (HTMLAttributes.height) {
							style.push(`height: ${HTMLAttributes.height}px`);
						}
						if (style.length === 0) {
							style.push('max-width: 100%');
						}

						return ['img', {
							...HTMLAttributes,
							class: 'docx-image',
							style: style.join('; '),
						}];
					},

					addCommands() {
						return {
							setImage: (options) => ({ commands }) => {
								return commands.insertContent({
									type: this.name,
									attrs: options,
								});
							},
							// Command to update image size and other attributes
							updateImageAttrs: (attrs) => ({ tr, state, dispatch }) => {
								const { selection } = state;
								const node = state.doc.nodeAt(selection.from);
								if (node && node.type.name === 'image') {
									if (dispatch) {
										tr.setNodeMarkup(selection.from, undefined, {
											...node.attrs,
											...attrs,
										});
										dispatch(tr);
									}
									return true;
								}
								return false;
							},
							setWrapType: (type) => ({ chain }) => {
								return chain().updateImageAttrs({ wrapType: type }).run();
							},
							setFloatSide: (side) => ({ chain }) => {
								return chain().updateImageAttrs({ floatSide: side }).run();
							},
							setImageMargin: (margin) => ({ chain }) => {
								return chain().updateImageAttrs({ margin: margin }).run();
							},
							setBehindDoc: (behind) => ({ chain }) => {
								return chain().updateImageAttrs({ behindDoc: behind }).run();
							},
						};
					},

					// Custom NodeView with resize handles
					addNodeView() {
						return ({ node: initialNode, getPos, editor }) => {
							// Keep track of current node (updated when ProseMirror updates us)
							let currentNode = initialNode;

							// Create wrapper container
							const container = document.createElement('div');
							container.className = 'docx-image-container';
							container.style.cssText = 'position: relative; display: inline-block; line-height: 0;';

							// Create image element
							const img = document.createElement('img');
							img.src = currentNode.attrs.src || '';
							img.alt = currentNode.attrs.alt || '';
							img.className = 'docx-image';
							if (currentNode.attrs.width) {
								img.style.width = `${currentNode.attrs.width}px`;
							}
							if (currentNode.attrs.height) {
								img.style.height = `${currentNode.attrs.height}px`;
							}
							if (!currentNode.attrs.width && !currentNode.attrs.height) {
								img.style.maxWidth = '100%';
							}

							console.log('[Image NodeView] Created with attrs:', JSON.stringify({
								width: currentNode.attrs.width,
								height: currentNode.attrs.height,
								srcLength: currentNode.attrs.src?.length
							}));

							container.appendChild(img);

							// Create resize handle (bottom-right corner)
							const resizeHandle = document.createElement('div');
							resizeHandle.className = 'docx-image-resize-handle';
							resizeHandle.style.cssText = `
								position: absolute;
								bottom: 0;
								right: 0;
								width: 12px;
								height: 12px;
								background: var(--vscode-focusBorder, #007acc);
								cursor: nwse-resize;
								opacity: 0;
								transition: opacity 0.15s;
								border-radius: 2px;
							`;
							container.appendChild(resizeHandle);

							// Show/hide resize handle on hover
							container.addEventListener('mouseenter', () => {
								resizeHandle.style.opacity = '1';
							});
							container.addEventListener('mouseleave', () => {
								if (!container.classList.contains('resizing')) {
									resizeHandle.style.opacity = '0';
								}
							});

							// Resize functionality
							let startX, startY, startWidth, startHeight;
							let aspectRatio = 1;

							const onMouseDown = (e) => {
								e.preventDefault();
								e.stopPropagation();

								startX = e.clientX;
								startY = e.clientY;
								startWidth = img.offsetWidth;
								startHeight = img.offsetHeight;
								aspectRatio = startWidth / startHeight;

								container.classList.add('resizing');
								resizeHandle.style.opacity = '1';

								document.addEventListener('mousemove', onMouseMove);
								document.addEventListener('mouseup', onMouseUp);
							};

							const onMouseMove = (e) => {
								const dx = e.clientX - startX;
								// Keep aspect ratio
								const newWidth = Math.max(50, startWidth + dx);
								const newHeight = Math.round(newWidth / aspectRatio);

								img.style.width = `${newWidth}px`;
								img.style.height = `${newHeight}px`;
							};

							const onMouseUp = () => {
								document.removeEventListener('mousemove', onMouseMove);
								document.removeEventListener('mouseup', onMouseUp);

								container.classList.remove('resizing');
								resizeHandle.style.opacity = '0';

								// Update node attributes with new size
								const newWidth = Math.round(img.offsetWidth);
								const newHeight = Math.round(img.offsetHeight);

								console.log('[Image NodeView] Resize complete:', {
									newWidth,
									newHeight,
									currentAttrs: { width: currentNode.attrs.width, height: currentNode.attrs.height }
								});

								if (typeof getPos === 'function') {
									const pos = getPos();
									if (pos !== undefined) {
										// Use currentNode.attrs to preserve current src
										const newAttrs = {
											...currentNode.attrs,
											width: newWidth,
											height: newHeight,
										};
										console.log('[Image NodeView] Setting new attrs:', JSON.stringify({
											width: newAttrs.width,
											height: newAttrs.height,
											srcLength: newAttrs.src?.length
										}));

										editor.chain().focus().command(({ tr }) => {
											tr.setNodeMarkup(pos, undefined, newAttrs);
											return true;
										}).run();

										// Verify the update by checking the document
										setTimeout(() => {
											const json = editor.getJSON();
											const findImages = (node) => {
												const results = [];
												if (node.type === 'image') {
													results.push({ width: node.attrs?.width, height: node.attrs?.height, srcLen: node.attrs?.src?.length });
												}
												if (node.content) {
													node.content.forEach(child => results.push(...findImages(child)));
												}
												return results;
											};
											console.log('[Image NodeView] Images in doc after resize:', JSON.stringify(findImages(json)));
										}, 100);
									}
								}
							};

							resizeHandle.addEventListener('mousedown', onMouseDown);

							return {
								dom: container,
								update: (updatedNode) => {
									if (updatedNode.type.name !== 'image') {
										return false;
									}
									// Update our reference to the current node
									currentNode = updatedNode;

									console.log('[Image NodeView] Update received:', JSON.stringify({
										width: updatedNode.attrs.width,
										height: updatedNode.attrs.height,
										srcLength: updatedNode.attrs.src?.length
									}));

									img.src = updatedNode.attrs.src || '';
									img.alt = updatedNode.attrs.alt || '';
									if (updatedNode.attrs.width) {
										img.style.width = `${updatedNode.attrs.width}px`;
									}
									if (updatedNode.attrs.height) {
										img.style.height = `${updatedNode.attrs.height}px`;
									}
									return true;
								},
								destroy: () => {
									resizeHandle.removeEventListener('mousedown', onMouseDown);
								},
							};
						};
					},
				});

				extensions.push(LightweightImage);
				console.log('[TiptapDocxEditor] ✅ Lightweight Image extension added (with resize handles)');
			} else {
				console.warn('[TiptapDocxEditor] ❌ TiptapNode not available for Image - images will not work!');
			}

			// Signature Line (draggable + resizable with editable fields)
			if (TiptapNode) {
				const SignatureLine = TiptapNode.create({
					name: 'signatureLine',
					group: 'block',
					atom: true,
					draggable: false,
					selectable: true,

					addAttributes() {
						return {
							nameText: {
								default: '',
								parseHTML: element => element.getAttribute('data-name-text') || '',
							},
							dateText: {
								default: '',
								parseHTML: element => element.getAttribute('data-date-text') || '',
							},
							showDate: {
								default: true,
								parseHTML: element => {
									const showDateAttr = element.getAttribute('data-show-date');
									if (showDateAttr === null) return true;
									return showDateAttr !== 'false';
								},
							},
							width: {
								default: 260,
								parseHTML: element => {
									const widthAttr = element.getAttribute('data-width');
									const style = element.getAttribute('style') || '';
									const widthMatch = style.match(/width:\s*(\d+)px/);
									if (widthAttr) return parseInt(widthAttr, 10);
									if (widthMatch) return parseInt(widthMatch[1], 10);
									return 260;
								},
							},
							offsetX: {
								default: 0,
								parseHTML: element => parseInt(element.getAttribute('data-offset-x') || '0', 10),
							},
							offsetY: {
								default: 0,
								parseHTML: element => parseInt(element.getAttribute('data-offset-y') || '0', 10),
							},
						};
					},

					parseHTML() {
						return [{
							tag: 'div[data-signature-line]',
						}];
					},

					renderHTML({ HTMLAttributes }) {
						const width = HTMLAttributes.width || 260;
						const nameText = HTMLAttributes.nameText || '';
						const dateText = HTMLAttributes.dateText || '';
						const showDate = HTMLAttributes.showDate !== false;
						const offsetX = HTMLAttributes.offsetX || 0;
						const offsetY = HTMLAttributes.offsetY || 0;
						const signatureRow = ['div', { class: 'docx-signature-line-row' },
							['span', { class: 'docx-signature-line-label' }, 'Signature'],
							['span', { class: 'docx-signature-line-text' }, nameText],
						];
						const dateRow = ['div', { class: 'docx-signature-line-row' },
							['span', { class: 'docx-signature-line-label' }, 'Date'],
							['span', { class: 'docx-signature-line-text' }, dateText],
						];
						return ['div', {
							'data-signature-line': 'true',
							'data-name-text': nameText,
							'data-date-text': dateText,
							'data-show-date': showDate ? 'true' : 'false',
							'data-width': width,
							'data-offset-x': offsetX,
							'data-offset-y': offsetY,
							class: 'docx-signature-line',
							style: `width: ${width}px; transform: translate(${offsetX}px, ${offsetY}px);`,
						},
						signatureRow,
						...(showDate ? [dateRow] : []),
						];
					},

					addCommands() {
						return {
							insertSignatureLine: (options) => ({ commands }) => {
								const attrs = {
									nameText: options?.nameText || '',
									dateText: options?.dateText || '',
									showDate: typeof options?.showDate === 'boolean' ? options.showDate : true,
									width: options?.width || 260,
									offsetX: options?.offsetX || 0,
									offsetY: options?.offsetY || 0,
								};
								return commands.insertContent({
									type: this.name,
									attrs: attrs,
								});
							},
							setSignatureLineShowDate: (showDate) => ({ tr, state, dispatch }) => {
								let updated = false;
								state.doc.descendants((node, pos) => {
									if (node.type.name === 'signatureLine' && node.attrs.showDate !== showDate) {
										tr.setNodeMarkup(pos, undefined, {
											...node.attrs,
											showDate: showDate,
										});
										updated = true;
									}
								});
								if (updated && dispatch) {
									dispatch(tr);
								}
								return updated;
							},
							updateSignatureLineAttrs: (attrs) => ({ tr, state, dispatch }) => {
								const { selection } = state;
								const node = state.doc.nodeAt(selection.from);
								if (node && node.type.name === 'signatureLine') {
									if (dispatch) {
										tr.setNodeMarkup(selection.from, undefined, {
											...node.attrs,
											...attrs,
										});
										dispatch(tr);
									}
									return true;
								}
								return false;
							},
						};
					},

					addNodeView() {
						return ({ node: initialNode, getPos, editor }) => {
							let currentNode = initialNode;

							const container = document.createElement('div');
							container.className = 'docx-signature-line';
							container.style.width = `${currentNode.attrs.width || 260}px`;
							container.style.transform = `translate(${currentNode.attrs.offsetX || 0}px, ${currentNode.attrs.offsetY || 0}px)`;
							container.setAttribute('data-signature-line', 'true');
							container.setAttribute('data-width', currentNode.attrs.width || 260);
							container.setAttribute('data-offset-x', currentNode.attrs.offsetX || 0);
							container.setAttribute('data-offset-y', currentNode.attrs.offsetY || 0);
							container.setAttribute('data-show-date', currentNode.attrs.showDate !== false ? 'true' : 'false');
							container.setAttribute('draggable', 'false');
							container.setAttribute('contenteditable', 'false');

							const dragHandle = document.createElement('div');
							dragHandle.className = 'docx-signature-line-drag-handle';
							dragHandle.setAttribute('data-drag-handle', 'true');
							dragHandle.setAttribute('contenteditable', 'false');
							dragHandle.setAttribute('draggable', 'false');
							dragHandle.title = 'Drag signature line';
							container.appendChild(dragHandle);

							const signatureRow = document.createElement('div');
							signatureRow.className = 'docx-signature-line-row';
							const signatureLabel = document.createElement('span');
							signatureLabel.className = 'docx-signature-line-label';
							signatureLabel.textContent = 'Signature';
							const signatureValue = document.createElement('span');
							signatureValue.className = 'docx-signature-line-text';
							signatureValue.textContent = currentNode.attrs.nameText || '';
							const signatureInput = document.createElement('input');
							signatureInput.className = 'docx-signature-line-input';
							signatureInput.type = 'text';
							signatureInput.placeholder = 'Name';
							signatureInput.value = currentNode.attrs.nameText || '';
							signatureRow.appendChild(signatureLabel);
							signatureRow.appendChild(signatureValue);
							signatureRow.appendChild(signatureInput);

							const dateRow = document.createElement('div');
							dateRow.className = 'docx-signature-line-row';
							const dateLabel = document.createElement('span');
							dateLabel.className = 'docx-signature-line-label';
							dateLabel.textContent = 'Date';
							const dateValue = document.createElement('span');
							dateValue.className = 'docx-signature-line-text';
							dateValue.textContent = currentNode.attrs.dateText || '';
							const dateInput = document.createElement('input');
							dateInput.className = 'docx-signature-line-input';
							dateInput.type = 'text';
							dateInput.placeholder = 'MM/DD/YYYY';
							dateInput.value = currentNode.attrs.dateText || '';
							dateRow.appendChild(dateLabel);
							dateRow.appendChild(dateValue);
							dateRow.appendChild(dateInput);
							dateRow.style.display = currentNode.attrs.showDate === false ? 'none' : '';

							container.appendChild(signatureRow);
							container.appendChild(dateRow);

							const resizeHandle = document.createElement('div');
							resizeHandle.className = 'docx-signature-line-resize-handle';
							resizeHandle.setAttribute('draggable', 'false');
							resizeHandle.setAttribute('contenteditable', 'false');
							container.appendChild(resizeHandle);

							let startX;
							let startWidth;
							let isResizing = false;
							let pendingWidth = null;
							let resizeFrame = null;
							const onResizeMouseDown = (e) => {
								if (e.button !== 0) {
									return;
								}
								e.preventDefault();
								e.stopPropagation();
								if (typeof e.stopImmediatePropagation === 'function') {
									e.stopImmediatePropagation();
								}
								startX = e.clientX;
								startWidth = container.offsetWidth;
								isResizing = true;
								container.classList.add('resizing');
								container.setAttribute('draggable', 'false');
								document.body.classList.add('docx-resize-active');
								document.addEventListener('mousemove', onResizeMouseMove);
								document.addEventListener('mouseup', onResizeMouseUp);
								document.addEventListener('dragstart', preventDragFromHandle, true);
							};

							const onResizeMouseMove = (e) => {
								if (!isResizing) {
									return;
								}
								const dx = e.clientX - startX;
								const newWidth = Math.max(120, startWidth + dx);
								container.style.width = `${newWidth}px`;
								pendingWidth = Math.round(newWidth);
								if (!resizeFrame && typeof getPos === 'function') {
									resizeFrame = requestAnimationFrame(() => {
										resizeFrame = null;
										if (pendingWidth === null) {
											return;
										}
										const pos = getPos();
										if (pos !== undefined) {
											const newAttrs = {
												...currentNode.attrs,
												width: pendingWidth,
											};
											editor.chain().command(({ tr }) => {
												tr.setNodeMarkup(pos, undefined, newAttrs);
												return true;
											}).run();
										}
									});
								}
							};

							const onResizeMouseUp = () => {
								if (!isResizing) {
									return;
								}
								isResizing = false;
								document.removeEventListener('mousemove', onResizeMouseMove);
								document.removeEventListener('mouseup', onResizeMouseUp);
								document.removeEventListener('dragstart', preventDragFromHandle, true);
								container.classList.remove('resizing');
								container.setAttribute('draggable', 'false');
								document.body.classList.remove('docx-resize-active');

								const newWidth = Math.round(container.offsetWidth);
								if (typeof getPos === 'function') {
									const pos = getPos();
									if (pos !== undefined) {
										const newAttrs = {
											...currentNode.attrs,
											width: newWidth,
										};
										editor.chain().focus().command(({ tr }) => {
											tr.setNodeMarkup(pos, undefined, newAttrs);
											return true;
										}).run();
									}
								}
							};

							const updateFromInputs = () => {
								if (typeof getPos === 'function') {
									const pos = getPos();
									if (pos !== undefined) {
										const newAttrs = {
											...currentNode.attrs,
											nameText: signatureInput.value || '',
											dateText: dateInput.value || '',
										};
										editor.chain().focus().command(({ tr }) => {
											tr.setNodeMarkup(pos, undefined, newAttrs);
											return true;
										}).run();
									}
								}
							};
							const syncDisplayFromInputs = () => {
								signatureValue.textContent = signatureInput.value || '';
								dateValue.textContent = dateInput.value || '';
							};

							let dragStartX;
							let dragStartY;
							let startOffsetX;
							let startOffsetY;
							let isDragging = false;
							let pendingOffset = null;
							let dragFrame = null;
							const onDragHandleMouseDown = (e) => {
								if (e.button !== 0) {
									return;
								}
								e.preventDefault();
								e.stopPropagation();
								dragStartX = e.clientX;
								dragStartY = e.clientY;
								startOffsetX = currentNode.attrs.offsetX || 0;
								startOffsetY = currentNode.attrs.offsetY || 0;
								isDragging = true;
								document.addEventListener('mousemove', onDragHandleMouseMove);
								document.addEventListener('mouseup', onDragHandleMouseUp);
							};

							const onDragHandleMouseMove = (e) => {
								if (!isDragging) {
									return;
								}
								const nextOffsetX = startOffsetX + (e.clientX - dragStartX);
								const nextOffsetY = startOffsetY + (e.clientY - dragStartY);
								container.style.transform = `translate(${nextOffsetX}px, ${nextOffsetY}px)`;
								container.setAttribute('data-offset-x', nextOffsetX);
								container.setAttribute('data-offset-y', nextOffsetY);
								pendingOffset = { x: Math.round(nextOffsetX), y: Math.round(nextOffsetY) };
								if (!dragFrame && typeof getPos === 'function') {
									dragFrame = requestAnimationFrame(() => {
										dragFrame = null;
										if (!pendingOffset) {
											return;
										}
										const pos = getPos();
										if (pos !== undefined) {
											const newAttrs = {
												...currentNode.attrs,
												offsetX: pendingOffset.x,
												offsetY: pendingOffset.y,
											};
											editor.chain().command(({ tr }) => {
												tr.setNodeMarkup(pos, undefined, newAttrs);
												return true;
											}).run();
										}
									});
								}
							};

							const onDragHandleMouseUp = () => {
								if (!isDragging) {
									return;
								}
								isDragging = false;
								document.removeEventListener('mousemove', onDragHandleMouseMove);
								document.removeEventListener('mouseup', onDragHandleMouseUp);
								const nextOffsetX = parseInt(container.getAttribute('data-offset-x') || '0', 10);
								const nextOffsetY = parseInt(container.getAttribute('data-offset-y') || '0', 10);
								if (typeof getPos === 'function') {
									const pos = getPos();
									if (pos !== undefined) {
										const newAttrs = {
											...currentNode.attrs,
											offsetX: nextOffsetX,
											offsetY: nextOffsetY,
										};
										editor.chain().focus().command(({ tr }) => {
											tr.setNodeMarkup(pos, undefined, newAttrs);
											return true;
										}).run();
									}
								}
							};

							const stopDragFromInput = (e) => {
								e.stopPropagation();
							};

							const preventDragFromHandle = (e) => {
								e.preventDefault();
								e.stopPropagation();
							};

							signatureInput.addEventListener('blur', updateFromInputs);
							dateInput.addEventListener('blur', updateFromInputs);
							signatureInput.addEventListener('input', syncDisplayFromInputs);
							dateInput.addEventListener('input', syncDisplayFromInputs);
							signatureInput.addEventListener('dragstart', stopDragFromInput);
							dateInput.addEventListener('dragstart', stopDragFromInput);
							resizeHandle.addEventListener('dragstart', preventDragFromHandle);
							dragHandle.addEventListener('mousedown', onDragHandleMouseDown);

							resizeHandle.addEventListener('mousedown', onResizeMouseDown);

							return {
								dom: container,
								stopEvent: (event) => {
									const target = event.target;
									if (target === signatureInput || target === dateInput) {
										return true;
									}
									if (target === resizeHandle || target === dragHandle) {
										return true;
									}
									return false;
								},
								ignoreMutation: (mutation) => {
									const target = mutation.target;
									if (target === signatureInput || target === dateInput) {
										return true;
									}
									return false;
								},
								update: (updatedNode) => {
									if (updatedNode.type.name !== 'signatureLine') {
										return false;
									}
									currentNode = updatedNode;
									const nextWidth = updatedNode.attrs.width || 260;
									container.style.width = `${nextWidth}px`;
									container.setAttribute('data-width', nextWidth);
									const nextOffsetX = updatedNode.attrs.offsetX || 0;
									const nextOffsetY = updatedNode.attrs.offsetY || 0;
									container.style.transform = `translate(${nextOffsetX}px, ${nextOffsetY}px)`;
									container.setAttribute('data-offset-x', nextOffsetX);
									container.setAttribute('data-offset-y', nextOffsetY);
									container.setAttribute('data-show-date', updatedNode.attrs.showDate !== false ? 'true' : 'false');
									signatureInput.value = updatedNode.attrs.nameText || '';
									dateInput.value = updatedNode.attrs.dateText || '';
									signatureValue.textContent = updatedNode.attrs.nameText || '';
									dateValue.textContent = updatedNode.attrs.dateText || '';
									dateRow.style.display = updatedNode.attrs.showDate === false ? 'none' : '';
									return true;
								},
								destroy: () => {
									resizeHandle.removeEventListener('mousedown', onResizeMouseDown);
									signatureInput.removeEventListener('blur', updateFromInputs);
									dateInput.removeEventListener('blur', updateFromInputs);
									signatureInput.removeEventListener('input', syncDisplayFromInputs);
									dateInput.removeEventListener('input', syncDisplayFromInputs);
									signatureInput.removeEventListener('dragstart', stopDragFromInput);
									dateInput.removeEventListener('dragstart', stopDragFromInput);
									resizeHandle.removeEventListener('dragstart', preventDragFromHandle);
									dragHandle.removeEventListener('mousedown', onDragHandleMouseDown);
									document.removeEventListener('mousemove', onResizeMouseMove);
									document.removeEventListener('mouseup', onResizeMouseUp);
									document.removeEventListener('dragstart', preventDragFromHandle, true);
									document.removeEventListener('mousemove', onDragHandleMouseMove);
									document.removeEventListener('mouseup', onDragHandleMouseUp);
								},
							};
						};
					},
				});

				extensions.push(SignatureLine);
				console.log('[TiptapDocxEditor] ✅ Signature Line extension added');
			}

			// Add @adalat-ai/page-extension - CRITICAL FOR PAGE BREAKS
			// NOTE: The extension uses ReactNodeViewRenderer which requires a React context.
			// Since we use vanilla Editor (not useEditor + EditorContent), we must create
			// a custom extension that provides the pagination logic with a vanilla JS node view.
			if (PageExtension && PageDocument) {
				console.log('[TiptapDocxEditor] ✅ Configuring @adalat-ai/page-extension');

				// Add PageDocument extension (required - replaces the default doc node)
				extensions.push(PageDocument);
				console.log('[TiptapDocxEditor] ✅ PageDocument added');

				// Get page dimensions based on page size
				const pageDimensions = this.getPageDimensions(this.options.pageSize);

				// Calculate margins in pixels (96 DPI)
				const marginPx = this.options.margin; // Already in pixels
				const marginInches = marginPx / 96;

				// Store config for use in node view
				const pageConfig = {
					bodyHeight: pageDimensions.height,
					bodyWidth: pageDimensions.width,
					marginPx: marginPx,
					marginInches: marginInches,
				};

				console.log('[TiptapDocxEditor] Page config:', pageConfig);

				try {
					// Get the Page node from the extension
					const Page = window.TiptapPage;

					// APPROACH: Use the original PageExtension (keeps pagination logic intact)
					// Then add a custom Page node view override that uses vanilla JS instead of React
					// The extension will inject CSS, but we'll remove it after initialization

					// First, add the original PageExtension - this includes the pagination plugin
					const pageExtension = PageExtension.configure({
						bodyHeight: pageConfig.bodyHeight,
						bodyWidth: pageConfig.bodyWidth,
						pageLayout: {
							margins: {
								top: { unit: 'INCHES', value: pageConfig.marginInches },
								right: { unit: 'INCHES', value: pageConfig.marginInches },
								bottom: { unit: 'INCHES', value: pageConfig.marginInches },
								left: { unit: 'INCHES', value: pageConfig.marginInches },
							},
						},
						pageNumber: {
							show: false,
						},
					});

					// DEBUG: Override the pagePlugin to force pagination
					const originalPagePlugin = pageExtension.addProseMirrorPlugins?.()[0];
					if (originalPagePlugin) {
						const debugPagePlugin = {
							...originalPagePlugin,
							view: () => {
								const detector = originalPagePlugin.view();
								// Override isOverflown to force pagination for testing
								const originalIsOverflown = detector.isOverflown.bind(detector);
								detector.isOverflown = (pageBody) => {
									const result = originalIsOverflown(pageBody);
									const expectedBodyHeight = pageConfig.bodyHeight - (pageConfig.marginInches * 96 * 2);
									console.log('[DEBUG] isOverflown check:', {
										pageBody: pageBody,
										scrollHeight: pageBody.scrollHeight,
										clientHeight: pageBody.clientHeight,
										expectedBodyHeight: expectedBodyHeight,
										originalResult: result,
										forcedResult: true,
										shouldOverflow: pageBody.scrollHeight > expectedBodyHeight
									});
									return true; // Force pagination for testing
								};
								return detector;
							},
							// Override appendTransaction to add debug logging
							appendTransaction: (transactions, oldState, newState) => {
								console.log('[DEBUG] appendTransaction called with transactions:', transactions.map(t => ({
									meta: t.meta,
									steps: t.steps?.length
								})));

								// Call original appendTransaction
								const originalResult = originalPagePlugin.appendTransaction?.(transactions, oldState, newState);
								console.log('[DEBUG] appendTransaction result:', originalResult);
								return originalResult;
							}
						};
						pageExtension.addProseMirrorPlugins = () => [debugPagePlugin];
						console.log('[TiptapDocxEditor] ✅ PageExtension with debug pagination override added');
					} else {
						console.log('[TiptapDocxEditor] ✅ PageExtension added (no debug override)');
					}

					extensions.push(pageExtension);

					// Now add our CustomPageNode to override the Page node's rendering
					// In Tiptap, when two nodes have the same name, the later one's methods take precedence
					if (Page) {
						const CustomPageNode = Page.extend({
							// Override the node view to use vanilla JS instead of React
							addNodeView() {
								// Return a vanilla JS node view factory
								return ({ node }) => {
									// Create the page wrapper (equivalent to NodeViewWrapper)
									const dom = document.createElement('div');
									dom.className = 'Page';
									dom.setAttribute('data-node-view-wrapper', '');
									if (node.attrs.id) {
										dom.id = node.attrs.id;
									}

									// Calculate padding from margins (matching extension's calculations)
									const topPad = pageConfig.marginInches * 96;
									const bottomPad = pageConfig.marginInches * 96;
									const leftPad = pageConfig.marginInches * 96;
									const rightPad = pageConfig.marginInches * 96;

									// Calculate content area dimensions (matching extension's getBodyWidth/getBodyHeight)
									const contentHeight = pageConfig.bodyHeight - topPad - bottomPad; // 1056 - 192 = 864px
									const contentWidth = pageConfig.bodyWidth - leftPad - rightPad;   // 816 - 192 = 624px

									// Apply styles with 'important' priority to override extension's injected CSS
									dom.style.setProperty('height', `${pageConfig.bodyHeight}px`, 'important');
									dom.style.setProperty('width', `${pageConfig.bodyWidth}px`, 'important');
									dom.style.setProperty('padding-top', `${topPad}px`, 'important');
									dom.style.setProperty('padding-bottom', `${bottomPad}px`, 'important');
									dom.style.setProperty('padding-left', `${leftPad}px`, 'important');
									dom.style.setProperty('padding-right', `${rightPad}px`, 'important');
									dom.style.setProperty('box-sizing', 'border-box', 'important');
									dom.style.setProperty('background', 'white', 'important');
									dom.style.setProperty('position', 'relative', 'important');
									dom.style.setProperty('transform', 'none', 'important'); // Override scale(0.9)
									dom.style.setProperty('min-height', 'auto', 'important'); // Override min-height

									// Create the content wrapper (equivalent to NodeViewContent)
									const contentDOM = document.createElement('div');
									contentDOM.className = 'PageContent';
									// Set min-height to match extension's iframe calculations, but allow overflow
									contentDOM.style.setProperty('min-height', `${contentHeight}px`, 'important');
									contentDOM.style.setProperty('width', `${contentWidth}px`, 'important');
									contentDOM.style.setProperty('overflow', 'visible', 'important'); // Allow content to overflow
									contentDOM.style.setProperty('box-sizing', 'border-box', 'important');

									dom.appendChild(contentDOM);

									console.log('[TiptapDocxEditor] Page rendered:', {
										pageSize: `${pageConfig.bodyWidth}px x ${pageConfig.bodyHeight}px`,
										padding: `${topPad}px`,
										contentSize: `${contentWidth}px x ${contentHeight}px`,
										marginInches: pageConfig.marginInches
									});

									return {
										dom,
										contentDOM,
										update: (updatedNode) => {
											if (updatedNode.type.name !== 'page') return false;
											if (updatedNode.attrs.id !== node.attrs.id) {
												dom.id = updatedNode.attrs.id || '';
											}
											return true;
										},
									};
								};
							},
						});

						// Add CustomPageNode AFTER PageExtension so its addNodeView overrides
						extensions.push(CustomPageNode.configure({
							bodyHeight: pageConfig.bodyHeight,
							bodyWidth: pageConfig.bodyWidth,
							pageLayout: {
								margins: {
									top: { unit: 'INCHES', value: pageConfig.marginInches },
									right: { unit: 'INCHES', value: pageConfig.marginInches },
									bottom: { unit: 'INCHES', value: pageConfig.marginInches },
									left: { unit: 'INCHES', value: pageConfig.marginInches },
								},
							},
						}));
						console.log('[TiptapDocxEditor] ✅ CustomPageNode added (vanilla JS node view)');
					}

				} catch (error) {
					console.error('[TiptapDocxEditor] ❌ Failed to configure PageExtension:', error);
					console.error(error.stack);
				}
			} else {
				console.error('[TiptapDocxEditor] ❌ @adalat-ai/page-extension not available!');
				console.error('[TiptapDocxEditor] PageExtension:', PageExtension);
				console.error('[TiptapDocxEditor] PageDocument:', PageDocument);
				console.error('[TiptapDocxEditor] Available globals:', Object.keys(window).filter(k =>
					k.includes('Tiptap') || k.includes('Page')
				));
			}

			console.log('[TiptapDocxEditor] Loaded', extensions.length, 'extensions');
			return extensions;
		}

		async loadFromDocx(arrayBuffer) {
			console.log('[TiptapDocxEditor] Loading DOCX');

			try {
				// Use docx-preview to convert to HTML
				// CRITICAL: useBase64URL: true ensures images are Base64 data URLs that persist
				// (Blob URLs are ephemeral and break on save/reload - this was causing the image loss bug)
				const tempDiv = document.createElement('div');
				await window.docx.renderAsync(arrayBuffer, tempDiv, undefined, {
					className: 'docx',
					inWrapper: true,
					ignoreWidth: false,
					ignoreHeight: false,
					breakPages: false,
					useBase64URL: true, // CRITICAL: Use Base64 for persistence (not Blob URLs)
				});

				// Log images found (DO NOT convert to Blob URLs - that was causing the bug!)
				// Base64 data URLs from docx-preview are persistent and work correctly
				const images = tempDiv.querySelectorAll('img');
				console.log('[TiptapDocxEditor] Found', images.length, 'images in DOCX HTML (kept as Base64 for persistence)');

				// Extract dimensions from parent div and apply to images for persistence
				// docx-preview puts dimensions on the wrapper div (e.g., style="width: 72pt; height: 153.75pt;")
				images.forEach((img, i) => {
					const src = img.getAttribute('src');
					if (src) {
						const isDataUrl = src.startsWith('data:');
						const sizeKB = Math.round(src.length / 1024);
						console.log(`[TiptapDocxEditor] Image ${i}: ${isDataUrl ? 'Data URL' : 'URL'}, size: ${sizeKB}KB`);

						// Try to extract dimensions from parent div's style
						const parent = img.parentElement;
						if (parent) {
							const style = parent.getAttribute('style') || '';
							// Parse width: XXpt or width: XXpx
							const widthMatch = style.match(/width:\s*([\d.]+)(pt|px)/);
							const heightMatch = style.match(/height:\s*([\d.]+)(pt|px)/);

							if (widthMatch && heightMatch) {
								let width = parseFloat(widthMatch[1]);
								let height = parseFloat(heightMatch[1]);
								const widthUnit = widthMatch[2];
								const heightUnit = heightMatch[2];

								// Convert pt to px (1pt = 1.333px)
								if (widthUnit === 'pt') width = Math.round(width * 1.333);
								if (heightUnit === 'pt') height = Math.round(height * 1.333);

								// Set as attributes on the img for Tiptap to pick up
								img.setAttribute('width', width);
								img.setAttribute('height', height);
								console.log(`[TiptapDocxEditor] Image ${i}: Extracted dimensions ${width}x${height}px from parent style`);
							}
						}
					}
				});

				// FLATTEN HTML: Extract strictly valid content to avoid wrapper-induced drops
				// docx-preview wraps content in nested divs/sections which Tiptap's schema might reject,
				// causing it to drop everything inside (including images).
				// We will extract Paragraphs, Tables, and Images and construct a flat sequence.

				console.log('[TiptapDocxEditor] Flattening HTML structure for Tiptap ingestion');
				const contentAccumulator = document.createElement('div');

				// Recursive function to extract content
				const extractContent = (element) => {
					// If it's a valid block type, clone it and append
					const tagName = element.tagName;

					// Headings & Paragraphs
					if (/^H[1-6]$/.test(tagName) || tagName === 'P') {
						// Ensure images inside are preserved (they should be since we clone)
						if (element.querySelector('img')) {
							console.log('[TiptapDocxEditor] Preserving block with image:', tagName);
						}
						contentAccumulator.appendChild(element.cloneNode(true));
						return;
					}

					// Tables
					if (tagName === 'TABLE') {
						contentAccumulator.appendChild(element.cloneNode(true));
						return;
					}

					// Lists
					if (tagName === 'UL' || tagName === 'OL') {
						contentAccumulator.appendChild(element.cloneNode(true));
						return;
					}

					// Orphan Images (wrap in P)
					if (tagName === 'IMG') {
						console.log('[TiptapDocxEditor] Wrapping orphan image in paragraph');
						const p = document.createElement('p');
						p.appendChild(element.cloneNode(true));
						contentAccumulator.appendChild(p);
						return;
					}

					// For containers (DIV, SECTION, ARTICLE, etc.), traverse children
					if (element.children.length > 0) {
						Array.from(element.children).forEach(extractContent);
					} else {
						// Text nodes?
						// If it's a leaf node but not one of the above, check for text
						// (Usually text is inside P, but just in case)
					}
				};

				// Start extraction from the root wrapper generated by docx-preview
				if (tempDiv.children.length > 0) {
					Array.from(tempDiv.children).forEach(extractContent);
				} else {
					// Fallback if no children (maybe just text?)
					contentAccumulator.innerHTML = tempDiv.innerHTML;
				}

				const html = contentAccumulator.innerHTML;
				console.log(`[TiptapDocxEditor] Flattened content length: ${html.length}`);

				// Debug: Check if images exist in the HTML string before loading
				const imgCount = (html.match(/<img/g) || []).length;
				console.log(`[TiptapDocxEditor] HTML string to load contains ${imgCount} <img> tags`);
				if (imgCount > 0) {
					// Log first image tag full details
					const imgTagMatch = html.match(/<img[^>]*>/);
					if (imgTagMatch) {
						console.log('[TiptapDocxEditor] First image tag:', imgTagMatch[0]);
						// Find the parent tag of the first image in the string
						const imgIndex = html.indexOf(imgTagMatch[0]);
						const htmlBefore = html.substring(Math.max(0, imgIndex - 100), imgIndex);
						console.log('[TiptapDocxEditor] Context before first image:', htmlBefore);
					}
				}

				this.loadFromHTML(html);

				// Verify images in model immediately after load
				setTimeout(() => {
					if (this.editor) {
						const json = this.editor.getJSON();
						let imageCount = 0;
						const countImages = (node) => {
							if (node.type === 'image') imageCount++;
							if (node.content) node.content.forEach(countImages);
						};
						countImages(json);
						console.log(`[TiptapDocxEditor] Post-load verification: Found ${imageCount} image nodes in Tiptap model`);
						if (imageCount === 0 && images.length > 0) {
							console.error('[TiptapDocxEditor] CRITICAL: Images were found in HTML but dropped by Tiptap schema validation!');
							console.log('[TiptapDocxEditor] First dropped image src:', images[0]?.getAttribute('src'));
						}
					}
				}, 500);

				console.log('[TiptapDocxEditor] DOCX loaded');

			} catch (error) {
				console.error('[TiptapDocxEditor] Failed to load DOCX:', error);
				throw error;
			}
		}

		loadFromHTML(html) {
			if (!this.editor) return;
			console.log('[TiptapDocxEditor] loadFromHTML called with content length:', html.length);
			console.log('[TiptapDocxEditor] HTML content preview:', html.substring(0, 200) + '...');

			// Count existing pages before loading
			const existingPages = this.container.querySelectorAll('.Page, [data-page], page');
			console.log('[TiptapDocxEditor] Existing pages before load:', existingPages.length);

			// Check document structure before loading
			console.log('[TiptapDocxEditor] Document structure before load:', this.editor.state.doc.toString());
			console.log('[TiptapDocxEditor] Document content:', this.editor.state.doc.content.toJSON());

			this.editor.commands.setContent(html);

			// Check document structure after loading
			setTimeout(() => {
				console.log('[TiptapDocxEditor] Document structure after load:', this.editor.state.doc.toString());
				console.log('[TiptapDocxEditor] Document content after load:', this.editor.state.doc.content.toJSON());

				// Check if we have PageDocument structure
				const hasPageStructure = this.editor.state.doc.type.name === 'doc' &&
					this.editor.state.doc.content.content.some(node => node.type.name === 'page');
				console.log('[TiptapDocxEditor] Has PageDocument structure:', hasPageStructure);

				// If no PageDocument structure, manually wrap content in a page
				if (!hasPageStructure) {
					console.log('[TiptapDocxEditor] No PageDocument structure found, wrapping content manually');
					const pageNode = this.editor.state.schema.nodes.page.create(null, this.editor.state.doc.content.content);
					const newDoc = this.editor.state.schema.nodes.doc.create(null, [pageNode]);
					this.editor.view.dispatch(this.editor.state.tr.replaceWith(0, this.editor.state.doc.content.size, newDoc.content.content));
				}
			}, 50);

			// Force pagination to re-evaluate after content is loaded
			// The @adalat-ai/page-extension needs a transaction to trigger page splitting
			setTimeout(() => {
				if (this.editor) {
					console.log('[TiptapDocxEditor] Checking for pagination commands...');
					console.log('[TiptapDocxEditor] Available commands:', Object.keys(this.editor.commands));

					// First try direct splitPage dispatch (immediate)
					console.log('[TiptapDocxEditor] Dispatching immediate splitPage transaction');
					this.editor.view.dispatch(
						this.editor.state.tr.setMeta('splitPage', true)
					);

					// Also try the recompute command (delayed like extension does)
					if (this.editor.commands.recomputeComputedHtml) {
						console.log('[TiptapDocxEditor] Triggering pagination recompute via recomputeComputedHtml');
						this.editor.commands.recomputeComputedHtml();
					}

					// Check how many pages we have after recompute
					setTimeout(() => {
						const pageElements = this.container.querySelectorAll('.Page, [data-page], page');
						console.log('[TiptapDocxEditor] Page elements after recompute:', pageElements.length);
						pageElements.forEach((page, i) => {
							console.log(`[TiptapDocxEditor] Page ${i + 1}:`, page.className, page.style.width, page.style.height);
						});
					}, 100);
				}
			}, 200);
		}

		getHTML() {
			return this.editor ? this.editor.getHTML() : '';
		}

		getJSON() {
			return this.editor ? this.editor.getJSON() : null;
		}

		/**
		 * Get JSON with all Blob URLs converted back to Base64 for persistence
		 * Uses SEQUENTIAL processing to avoid memory spikes with many images
		 */
		async getHydratedJSON() {
			if (!this.editor) return null;
			const json = this.editor.getJSON();

			// Track statistics
			let blobCount = 0;
			let convertedCount = 0;
			let failedCount = 0;

			// Helper to process nodes recursively - SEQUENTIAL to avoid memory spikes
			const processNode = async (node) => {
				if (node.type === 'image' || node.type === 'imageResize') {
					const src = node.attrs?.src;
					if (src && src.startsWith('blob:')) {
						blobCount++;
						try {
							const response = await fetch(src);
							if (!response.ok) {
								throw new Error(`Blob fetch failed: ${response.status}`);
							}
							const blob = await response.blob();

							// Check blob size to prevent memory explosion
							if (blob.size > 10 * 1024 * 1024) { // > 10MB
								console.warn('[TiptapDocxEditor] Blob too large, skipping:', Math.round(blob.size / 1024 / 1024), 'MB');
								failedCount++;
								// Set a placeholder to indicate missing image
								node.attrs.src = '';
								node.attrs.alt = '[Image too large]';
								return;
							}

							const reader = new FileReader();
							const base64 = await new Promise((resolve, reject) => {
								reader.onloadend = () => resolve(reader.result);
								reader.onerror = reject;
								reader.readAsDataURL(blob);
							});
							node.attrs.src = base64;
							// Remove our internal flags if any
							delete node.attrs['data-original-src'];
							convertedCount++;
							console.log('[TiptapDocxEditor] Hydrated blob to base64, size:', Math.round(base64.length / 1024), 'KB');
						} catch (e) {
							console.warn('[TiptapDocxEditor] Failed to hydrate image (blob may be invalid):', src.substring(0, 50), e.message);
							failedCount++;
							// Clear invalid blob URL to prevent save errors
							node.attrs.src = '';
							node.attrs.alt = '[Image lost - blob expired]';
						}
					}
				}

				// SEQUENTIAL processing to avoid memory spikes
				if (node.content) {
					for (const child of node.content) {
						await processNode(child);
					}
				}
			};

			await processNode(json);

			console.log('[TiptapDocxEditor] Hydration complete:', { blobCount, convertedCount, failedCount });
			return json;
		}

		/**
		 * Load JSON content - keep Base64 images as-is (no more Blob URL conversion!)
		 * CRITICAL FIX: Converting Base64 to Blob URLs was causing memory explosion and image loss
		 * because Blob URLs are ephemeral and get invalidated on reload/save.
		 */
		async loadFromJSON(json) {
			if (!this.editor) return;

			console.log('[TiptapDocxEditor] Loading from JSON (keeping Base64 images as-is)');

			// Clone json to avoid mutating the input
			const jsonClone = JSON.parse(JSON.stringify(json));

			// Count images for diagnostics
			let imageCount = 0;
			const countImages = (node) => {
				if (node.type === 'image' || node.type === 'imageResize') {
					imageCount++;
					const src = node.attrs?.src;
					if (src) {
						console.log('[TiptapDocxEditor] Image found:', src.startsWith('data:') ? 'Data URL' : src.startsWith('blob:') ? 'Blob' : 'URL', 'length:', src.length);
					}
				}
				if (node.content) {
					node.content.forEach(countImages);
				}
			};
			countImages(jsonClone);
			console.log('[TiptapDocxEditor] Total images in JSON:', imageCount);

			// CRITICAL: Do NOT convert Base64 to Blob URLs!
			// Base64 data URLs persist correctly and don't cause memory issues on reload.
			// The old code was converting to Blob URLs which:
			// 1. Get invalidated when the webview reloads
			// 2. Cause memory explosion during save when trying to re-fetch invalid blobs
			// 3. Lead to images being lost

			this.editor.commands.setContent(jsonClone);

			// Trigger pagination check
			setTimeout(() => {
				if (this.editor) {
					this.editor.view.dispatch(this.editor.state.tr.setMeta('splitPage', true));
				}
			}, 200);
		}

		async saveToDocx() {
			if (!this.editor) {
				throw new Error('Editor not initialized');
			}

			console.log('[TiptapDocxEditor] Converting content to DOCX');

			if (!window.DocxLib) {
				throw new Error('docx library not loaded. Make sure tiptapDocxBundle.js is loaded.');
			}

			try {
				const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ExternalHyperlink } = window.DocxLib;

				// CRITICAL: Ensure we have the latest JSON state
				// Depending on how Tiptap updates, we might need to force a sync or just getJSON
				const json = this.editor.getJSON();

				// Debug: Log the full JSON structure to see all node types
				console.log('[TiptapDocxEditor] Full JSON content length:', JSON.stringify(json).length);

				// Debug: Find all unique node types in the content
				const findNodeTypes = (node, types = new Set()) => {
					if (node.type) types.add(node.type);
					if (node.content) node.content.forEach(child => findNodeTypes(child, types));
					return types;
				};
				const nodeTypes = [...findNodeTypes(json)];
				console.log('[TiptapDocxEditor] Node types found:', nodeTypes);

				// Validate image nodes specifically
				const imageNodes = [];
				const findImages = (node) => {
					if (node.type === 'image') imageNodes.push(node);
					if (node.content) node.content.forEach(child => findImages(child));
				};
				findImages(json);
				console.log(`[TiptapDocxEditor] Found ${imageNodes.length} image nodes in JSON state`);
				imageNodes.forEach((img, i) => {
					console.log(`[TiptapDocxEditor] Image ${i}: src starts with ${img.attrs?.src?.substring(0, 30)}...`);
				});

				const docxContent = await this.convertTiptapToDocx(json, { Paragraph, TextRun, HeadingLevel, AlignmentType, ExternalHyperlink });

				// Create DOCX document
				const doc = new Document({
					sections: [{
						properties: {
							page: {
								size: {
									width: this.pageDimensions.width * 15,
									height: this.pageDimensions.height * 15,
								},
								margin: {
									top: this.options.margin * 15,
									right: this.options.margin * 15,
									bottom: this.options.margin * 15,
									left: this.options.margin * 15,
								},
							},
						},
						children: docxContent,
					}],
				});

				// Generate blob
				const blob = await Packer.toBlob(doc);
				console.log('[TiptapDocxEditor] DOCX generated successfully, size:', blob.size);
				return blob;

			} catch (error) {
				console.error('[TiptapDocxEditor] Failed to save DOCX:', error);
				throw error;
			}
		}

		/**
		 * Convert Tiptap JSON to DOCX paragraphs
		 */
		async convertTiptapToDocx(json, docxClasses) {
			const paragraphs = [];

			if (!json.content) {
				return paragraphs;
			}

			const { Paragraph, PageBreak } = window.DocxLib;

			// Check if we are using PageDocument structure (top-level pages)
			const isPageStructure = json.content.some(n => n.type === 'page');

			for (let i = 0; i < json.content.length; i++) {
				const node = json.content[i];

				// Handle Page Breaks for PageDocument structure
				if (isPageStructure && i > 0 && node.type === 'page') {
					console.log('[TiptapDocxEditor] Inserting Page Break between pages');
					if (PageBreak) {
						paragraphs.push(new Paragraph({
							children: [new PageBreak()],
						}));
					}
				}

				const converted = await this.convertNodeToDocx(node, docxClasses, 0);
				if (converted) {
					paragraphs.push(...converted);
				}
			}

			return paragraphs;
		}

		/**
		 * Process an image node to create an ImageRun
		 * CRITICAL: Includes size limits to prevent memory explosion
		 */
		async processImageNode(node) {
			const MAX_IMAGE_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB max per image

			try {
				let src = node.attrs?.src;
				console.log('[TiptapDocxEditor] Processing image node:', node.type, 'src type:', src ? src.substring(0, 30) : 'null');

				// Check if this is any kind of data URL (image/* or application/octet-stream)
				const isDataUrl = src && src.startsWith('data:');
				const isBlobUrl = src && src.startsWith('blob:');

				// Early check for data URL size (base64 is ~33% larger than binary)
				if (isDataUrl && src.length > MAX_IMAGE_BUFFER_SIZE * 1.4) {
					console.warn('[TiptapDocxEditor] Image data URL too large, skipping:', Math.round(src.length / 1024 / 1024), 'MB');
					return null;
				}

				let imageBuffer;
				let mimeType;

				if (isBlobUrl) {
					// Fetch blob and convert to array buffer
					try {
						console.log('[TiptapDocxEditor] Fetching Blob URL');
						const response = await fetch(src);
						if (!response.ok) {
							throw new Error(`Blob fetch failed: ${response.status}`);
						}
						const blob = await response.blob();

						// Size check before loading into memory
						if (blob.size > MAX_IMAGE_BUFFER_SIZE) {
							console.warn('[TiptapDocxEditor] Blob too large, skipping:', Math.round(blob.size / 1024 / 1024), 'MB');
							return null;
						}

						const arrayBuffer = await blob.arrayBuffer();
						imageBuffer = new Uint8Array(arrayBuffer);
						mimeType = blob.type || 'image/png';
						console.log('[TiptapDocxEditor] Blob fetched, size:', imageBuffer.length, 'type:', mimeType);
					} catch (e) {
						console.error('[TiptapDocxEditor] Failed to fetch blob (may be expired):', e.message);
						return null; // Don't let expired blob URLs crash the save
					}
				} else if (isDataUrl) {
					// Extract base64 image data from ANY data URL type
					// Handles: data:image/png;base64,... AND data:application/octet-stream;base64,...
					const base64Data = src.split(',')[1];
					if (!base64Data) {
						console.warn('[TiptapDocxEditor] Data URL has no base64 content');
						return null;
					}

					// Try to extract MIME type from data URL, fall back to detecting from binary
					const mimeMatch = src.match(/^data:([^;,]+)/);
					const declaredMime = mimeMatch ? mimeMatch[1] : null;

					// Check base64 size (binary will be ~75% of base64 length)
					const estimatedSize = base64Data.length * 0.75;
					if (estimatedSize > MAX_IMAGE_BUFFER_SIZE) {
						console.warn('[TiptapDocxEditor] Base64 image too large, skipping:', Math.round(estimatedSize / 1024 / 1024), 'MB');
						return null;
					}

					imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

					// Detect actual image type from binary header (more reliable than MIME declaration)
					if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
						mimeType = 'image/png';
					} else if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) {
						mimeType = 'image/jpeg';
					} else if (imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49) {
						mimeType = 'image/gif';
					} else if (imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49) {
						mimeType = 'image/webp';
					} else if (declaredMime && declaredMime.startsWith('image/')) {
						mimeType = declaredMime;
					} else {
						// Default to PNG for unknown binary
						mimeType = 'image/png';
					}

					console.log('[TiptapDocxEditor] Base64 decoded, size:', imageBuffer.length, 'detected type:', mimeType);
				}

				if (imageBuffer) {
					// Get image dimensions from attributes OR extract from binary header
					let width = node.attrs?.width ? parseInt(node.attrs.width) : null;
					let height = node.attrs?.height ? parseInt(node.attrs.height) : null;

					// If dimensions missing, extract from image binary header (fast, no decode needed)
					if (!width || !height) {
						const dims = this.getImageDimensionsFromBinary(imageBuffer);
						if (dims) {
							console.log('[TiptapDocxEditor] Extracted dimensions from header:', dims.width, 'x', dims.height);
							width = width || dims.width;
							height = height || dims.height;
						}
					}

					// Final fallback if still no dimensions
					width = width || 400;
					height = height || Math.round(width * 0.75);

					// Import ImageRun from docx library
					const {
						ImageRun,
						TextWrappingType,
						TextWrappingSide,
						HorizontalPositionRelativeFrom,
						VerticalPositionRelativeFrom,
						HorizontalPositionAlign,
						VerticalPositionAlign
					} = window.DocxLib;

					if (!ImageRun) {
						console.error('[TiptapDocxEditor] ImageRun not available in DocxLib');
						return null;
					}

					// Determine image type for docx
					let imageType;
					if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
						imageType = 'jpg';
					} else if (mimeType.includes('png')) {
						imageType = 'png';
					} else if (mimeType.includes('gif')) {
						imageType = 'gif';
					} else if (mimeType.includes('bmp')) {
						imageType = 'bmp';
					} else {
						imageType = 'png'; // default
					}

					console.log('[TiptapDocxEditor] Image type detected:', imageType, 'mime:', mimeType);

					// Configure Floating Options
					let floating = undefined;
					const wrapType = node.attrs?.wrapType || 'inline';

					if (wrapType !== 'inline') {
						const floatSide = node.attrs?.floatSide || 'left';
						const margin = node.attrs?.margin || 0;
						const behindDoc = node.attrs?.behindDoc || false;

						// Map wrap types
						let docxWrapType = TextWrappingType.SQUARE;
						if (wrapType === 'tight') docxWrapType = TextWrappingType.TIGHT;
						if (wrapType === 'through') docxWrapType = TextWrappingType.THROUGH;
						if (wrapType === 'topAndBottom') docxWrapType = TextWrappingType.TOP_AND_BOTTOM;
						if (wrapType === 'none' || wrapType === 'behind' || wrapType === 'front') docxWrapType = TextWrappingType.NONE;

						// Map align
						let align = HorizontalPositionAlign.LEFT;
						if (floatSide === 'right') align = HorizontalPositionAlign.RIGHT;
						if (floatSide === 'center') align = HorizontalPositionAlign.CENTER;

						floating = {
							horizontalPosition: {
								relative: HorizontalPositionRelativeFrom.COLUMN,
								align: align
							},
							verticalPosition: {
								relative: VerticalPositionRelativeFrom.PARAGRAPH,
								align: VerticalPositionAlign.TOP
							},
							wrap: {
								type: docxWrapType,
								side: TextWrappingSide.BOTH // Default to both sides
							},
							margins: {
								top: margin,
								bottom: margin,
								left: margin,
								right: margin
							},
							behindDocument: behindDoc
						};
						console.log('[TiptapDocxEditor] Configuring floating image:', floating);
					}

					// Create image run
					const imageRun = new ImageRun({
						data: imageBuffer,
						type: imageType,
						transformation: {
							width: width,
							height: height,
						},
						floating: floating // will be undefined if inline
					});

					console.log('[TiptapDocxEditor] ✅ ImageRun created:', { width, height, type: imageType, bufferSize: imageBuffer.length, floating: !!floating });
					return imageRun;
				} else {
					console.warn('[TiptapDocxEditor] Image skipped - not blob/base64 or no src. Src:', src ? src.substring(0, 50) : 'undefined');
					return null;
				}
			} catch (error) {
				console.error('[TiptapDocxEditor] Failed to convert image:', error);
				return null;
			}
		}

		/**
		 * Convert a single Tiptap node to DOCX
		 */
		async convertNodeToDocx(node, docxClasses, depth = 0) {
			const { Paragraph, TextRun, HeadingLevel, AlignmentType, ExternalHyperlink } = docxClasses;
			const paragraphs = [];

			// Debug logging for all nodes
			console.log('[TiptapDocxEditor] Converting node:', ' '.repeat(depth * 2) + node.type, node.attrs ? 'hasAttrs' : '');

			switch (node.type) {
				case 'paragraph': {
					// Handle inline content (text AND images)
					const children = [];
					if (node.content) {
						for (const child of node.content) {
							if (child.type === 'text') {
								// Extract text run logic inline to avoid helper limitation
								const marks = child.marks || [];
								const linkMark = marks.find(m => m.type === 'link');

								// Create the TextRun with formatting
								const textRun = new TextRun({
									text: child.text || '',
									bold: marks.some(m => m.type === 'bold'),
									italics: marks.some(m => m.type === 'italic'),
									// Links should be underlined and blue by default
									underline: (marks.some(m => m.type === 'underline') || linkMark) ? {} : undefined,
									strike: marks.some(m => m.type === 'strike'),
									// Add blue color for links
									color: linkMark ? '0066CC' : undefined,
								});

								// If this text has a link mark, wrap it in ExternalHyperlink
								if (linkMark && linkMark.attrs?.href && ExternalHyperlink) {
									console.log('[TiptapDocxEditor] Creating hyperlink:', linkMark.attrs.href);
									children.push(new ExternalHyperlink({
										children: [textRun],
										link: linkMark.attrs.href,
									}));
								} else {
									children.push(textRun);
								}
							} else if (child.type === 'image' || child.type === 'imageResize') {
								const imageRun = await this.processImageNode(child);
								if (imageRun) {
									children.push(imageRun);
								}
							} else if (child.type === 'hardBreak') {
								// Handle Hard Break (Shift+Enter)
								children.push(new TextRun({ text: "", break: 1 }));
							}
						}
					}

					// Default empty text run if no children
					if (children.length === 0) {
						children.push(new TextRun({ text: '' }));
					}

					// Check for alignment
					let alignment = undefined;
					if (node.attrs && node.attrs.textAlign) {
						if (node.attrs.textAlign === 'center') alignment = AlignmentType.CENTER;
						else if (node.attrs.textAlign === 'right') alignment = AlignmentType.RIGHT;
						else if (node.attrs.textAlign === 'justify') alignment = AlignmentType.JUSTIFIED;
					}

					paragraphs.push(new Paragraph({
						children: children,
						alignment: alignment
					}));
					break;
				}
				case 'signatureLine': {
					const width = node.attrs?.width || 260;
					const lineLength = Math.max(12, Math.round(width / 10));
					const lineText = '_'.repeat(lineLength);
					const nameText = (node.attrs?.nameText || '').trim();
					const dateText = (node.attrs?.dateText || '').trim();
					const showDate = node.attrs?.showDate !== false;

					paragraphs.push(new Paragraph({
						children: [
							new TextRun({ text: 'Signature: ' }),
							new TextRun({ text: nameText || lineText, underline: {} }),
						],
					}));
					if (showDate) {
						paragraphs.push(new Paragraph({
							children: [
								new TextRun({ text: 'Date: ' }),
								new TextRun({ text: dateText || lineText, underline: {} }),
							],
						}));
					}
					break;
				}

				case 'heading': {
					// Headings usually just contain text, but could contain inline images
					const children = [];
					if (node.content) {
						for (const child of node.content) {
							if (child.type === 'text') {
								const marks = child.marks || [];
								const linkMark = marks.find(m => m.type === 'link');

								const textRun = new TextRun({
									text: child.text || '',
									bold: marks.some(m => m.type === 'bold'),
									italics: marks.some(m => m.type === 'italic'),
									underline: (marks.some(m => m.type === 'underline') || linkMark) ? {} : undefined,
									strike: marks.some(m => m.type === 'strike'),
									color: linkMark ? '0066CC' : undefined,
								});

								if (linkMark && linkMark.attrs?.href && ExternalHyperlink) {
									children.push(new ExternalHyperlink({
										children: [textRun],
										link: linkMark.attrs.href,
									}));
								} else {
									children.push(textRun);
								}
							}
						}
					}
					// If empty heading
					if (children.length === 0) {
						children.push(new TextRun({ text: '' }));
					}

					const level = node.attrs?.level || 1;
					const headingLevels = [
						HeadingLevel.HEADING_1,
						HeadingLevel.HEADING_2,
						HeadingLevel.HEADING_3,
						HeadingLevel.HEADING_4,
						HeadingLevel.HEADING_5,
						HeadingLevel.HEADING_6,
					];
					paragraphs.push(new Paragraph({
						children: children,
						heading: headingLevels[level - 1] || HeadingLevel.HEADING_1,
					}));
					break;
				}


				case 'bulletList':
				case 'orderedList': {
					if (node.content) {
						for (const item of node.content) {
							if (item.type === 'listItem' && item.content) {
								for (const childNode of item.content) {
									const converted = await this.convertNodeToDocx(childNode, docxClasses, depth + 1);
									if (converted) {
										paragraphs.push(...converted);
									}
								}
							}
						}
					}
					break;
				}

				case 'image':
				case 'imageResize': {
					// Handle BLOCK level images (if any remain)
					const imageRun = await this.processImageNode(node);
					if (imageRun) {
						// Wrap block image in a paragraph
						const { Paragraph } = window.DocxLib;
						paragraphs.push(new Paragraph({
							children: [imageRun],
						}));
						console.log('[TiptapDocxEditor] ✅ Block Image added to DOCX');
					}
					break;
				}

				default:
					if (node.content) {
						for (const childNode of node.content) {
							const converted = await this.convertNodeToDocx(childNode, docxClasses, depth + 1);
							if (converted) {
								paragraphs.push(...converted);
							}
						}
					}
			}

			return paragraphs.length > 0 ? paragraphs : null;
		}

		/**
		 * Extract text runs with formatting from a node
		 * @param {Object} node - The Tiptap node
		 * @param {Function} TextRun - The TextRun class from docx library
		 * @param {Function} ExternalHyperlink - The ExternalHyperlink class from docx library (optional)
		 */
		extractTextRuns(node, TextRun, ExternalHyperlink = null) {
			const runs = [];

			if (!node.content) {
				return [new TextRun({ text: '' })];
			}

			for (const inline of node.content) {
				if (inline.type === 'text') {
					const marks = inline.marks || [];
					const isBold = marks.some(m => m.type === 'bold');
					const isItalic = marks.some(m => m.type === 'italic');
					const isStrike = marks.some(m => m.type === 'strike');
					const linkMark = marks.find(m => m.type === 'link');
					const isUnderline = marks.some(m => m.type === 'underline') || !!linkMark;

					const textRun = new TextRun({
						text: inline.text || '',
						bold: isBold,
						italics: isItalic,
						underline: isUnderline ? {} : undefined,
						strike: isStrike,
						color: linkMark ? '0066CC' : undefined,
					});

					// Wrap in hyperlink if link mark exists and ExternalHyperlink is available
					if (linkMark && linkMark.attrs?.href && ExternalHyperlink) {
						runs.push(new ExternalHyperlink({
							children: [textRun],
							link: linkMark.attrs.href,
						}));
					} else {
						runs.push(textRun);
					}
				}
			}

			return runs.length > 0 ? runs : [new TextRun({ text: '' })];
		}

		getText() {
			return this.editor ? this.editor.getText() : '';
		}

		setPageSize(pageSize) {
			this.options.pageSize = pageSize;
			this.pageDimensions = this.getPageDimensions(pageSize);

			// Reinitialize with new dimensions
			const content = this.getJSON();
			this.destroy();
			this.initialize();
			if (content) {
				this.editor.commands.setContent(content);
			}
		}

		setMargin(margin) {
			this.options.margin = margin;

			// Reinitialize with new margin
			const content = this.getJSON();
			this.destroy();
			this.initialize();
			if (content) {
				this.editor.commands.setContent(content);
			}
		}

		focus() {
			if (this.editor) {
				this.editor.commands.focus();
			}
		}

		// Debug method to test pagination with known overflowing content
		testPagination() {
			console.log('[TiptapDocxEditor] Testing pagination with overflowing content');
			const testHTML = `
				<p>This is the first paragraph on the first page.</p>
				<p>This is another paragraph to fill some space.</p>
				<p>More content here to start filling the page.</p>
				<p>Continuing to add content to see if pagination works.</p>
				<p>This should be enough content to exceed one page height.</p>
				<p>Adding more paragraphs to definitely overflow the page.</p>
				<p>Page 2 content should start here after pagination.</p>
				<p>This is paragraph number 8.</p>
				<p>This is paragraph number 9.</p>
				<p>This is paragraph number 10.</p>
				<p>This is paragraph number 11.</p>
				<p>This is paragraph number 12.</p>
				<p>This is paragraph number 13.</p>
				<p>This is paragraph number 14.</p>
				<p>This is paragraph number 15.</p>
				<p>This is paragraph number 16.</p>
				<p>This is paragraph number 17.</p>
				<p>This is paragraph number 18.</p>
				<p>This is paragraph number 19.</p>
				<p>This is paragraph number 20.</p>
			`;
			this.loadFromHTML(testHTML);
		}

		destroy() {
			if (this.editor) {
				this.editor.destroy();
				this.editor = null;
			}
		}
	}

	// Expose globally for webview
	window.TiptapDocxEditor = TiptapDocxEditor;

	// Also expose a global test function
	window.testPagination = function () {
		if (window.tiptapEditor && window.tiptapEditor.testPagination) {
			window.tiptapEditor.testPagination();
		} else {
			console.error('tiptapEditor not available or testPagination method not found');
		}
	};

})();

