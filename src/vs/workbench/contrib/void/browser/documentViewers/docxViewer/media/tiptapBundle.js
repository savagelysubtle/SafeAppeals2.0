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
			console.log('[TiptapDocxEditor] Initializing');
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
				}));
				console.log('[TiptapDocxEditor] ✅ Link extension added');
			}

			// NOTE: HorizontalRule is already included in StarterKit, don't add separately

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
				const tempDiv = document.createElement('div');
				await window.docx.renderAsync(arrayBuffer, tempDiv, undefined, {
					className: 'docx',
					inWrapper: true,
					ignoreWidth: false,
					ignoreHeight: false,
					breakPages: false,
				});

				const html = tempDiv.innerHTML;
				this.loadFromHTML(html);
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

		async saveToDocx() {
			if (!this.editor) {
				throw new Error('Editor not initialized');
			}

			console.log('[TiptapDocxEditor] Converting content to DOCX');

			if (!window.DocxLib) {
				throw new Error('docx library not loaded. Make sure tiptapDocxBundle.js is loaded.');
			}

			try {
				const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = window.DocxLib;
				const json = this.editor.getJSON();
				const docxContent = this.convertTiptapToDocx(json, { Paragraph, TextRun, HeadingLevel, AlignmentType });

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
		convertTiptapToDocx(json, docxClasses) {
			const paragraphs = [];

			if (!json.content) {
				return paragraphs;
			}

			for (const node of json.content) {
				const converted = this.convertNodeToDocx(node, docxClasses);
				if (converted) {
					paragraphs.push(...converted);
				}
			}

			return paragraphs;
		}

		/**
		 * Convert a single Tiptap node to DOCX
		 */
		convertNodeToDocx(node, docxClasses) {
			const { Paragraph, TextRun, HeadingLevel, AlignmentType } = docxClasses;
			const paragraphs = [];

			switch (node.type) {
				case 'paragraph': {
					const runs = this.extractTextRuns(node, TextRun);
					paragraphs.push(new Paragraph({
						children: runs,
					}));
					break;
				}

				case 'heading': {
					const runs = this.extractTextRuns(node, TextRun);
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
						children: runs,
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
									const converted = this.convertNodeToDocx(childNode, docxClasses);
									if (converted) {
										paragraphs.push(...converted);
									}
								}
							}
						}
					}
					break;
				}

				default:
					if (node.content) {
						for (const childNode of node.content) {
							const converted = this.convertNodeToDocx(childNode, docxClasses);
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
		 */
		extractTextRuns(node, TextRun) {
			const runs = [];

			if (!node.content) {
				return [new TextRun({ text: '' })];
			}

			for (const inline of node.content) {
				if (inline.type === 'text') {
					const marks = inline.marks || [];
					const isBold = marks.some(m => m.type === 'bold');
					const isItalic = marks.some(m => m.type === 'italic');
					const isUnderline = marks.some(m => m.type === 'underline');
					const isStrike = marks.some(m => m.type === 'strike');

					runs.push(new TextRun({
						text: inline.text || '',
						bold: isBold,
						italics: isItalic,
						underline: isUnderline ? {} : undefined,
						strike: isStrike,
					}));
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

