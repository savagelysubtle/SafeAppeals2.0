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

			// Try different global names for Tiptap
			const Editor = window.Editor || window.TiptapCore?.Editor;
			if (!Editor) {
				throw new Error('Tiptap Editor class not found');
			}

			try {
				this.editor = new Editor({
					element: this.container,
					extensions: this.getExtensions(),
					content: '<p>Loading...</p>',
					editorProps: {
						attributes: {
							class: 'tiptap-editor prose focus:outline-none',
							spellcheck: 'true',
						},
					},
					onUpdate: () => {
						this.options.onContentChange();
					},
				});

				console.log('[TiptapDocxEditor] Initialized successfully');
			} catch (error) {
				console.error('[TiptapDocxEditor] Failed to initialize:', error);
				throw error;
			}
		}

		getExtensions() {
			// Use Tiptap extensions - try different global names
			const extensions = [];

			// Try to get StarterKit from different possible locations
			const StarterKit = window.StarterKit || window.TiptapStarterKit?.StarterKit || window.TiptapStarterKit;

			if (StarterKit) {
				console.log('[TiptapDocxEditor] Adding StarterKit extension');
				// Don't disable document since we're not using pagination extension
				extensions.push(StarterKit.configure());
			} else {
				console.warn('[TiptapDocxEditor] StarterKit not found, editor may have limited functionality');
			}

			// Add Underline mark (not in StarterKit by default)
			try {
				const Mark = window.Tiptap?.Mark || window.TiptapCore?.Mark;
				if (Mark) {
					const Underline = Mark.create({
						name: 'underline',
						parseHTML() {
							return [
								{ tag: 'u' },
								{ style: 'text-decoration=underline' }
							];
						},
						renderHTML() {
							return ['u', 0];
						},
						addCommands() {
							return {
								toggleUnderline: () => ({ commands }) => {
									return commands.toggleMark('underline');
								}
							};
						}
					});
					extensions.push(Underline);
					console.log('[TiptapDocxEditor] ✅ Underline mark added');
				}
			} catch (error) {
				console.warn('[TiptapDocxEditor] ⚠️ Could not add Underline mark:', error);
			}

			// Pagination extension is optional - we'll implement basic pagination with CSS
			if (window.TiptapPaginationBreaks) {
				console.log('[TiptapDocxEditor] Adding pagination extension');
				try {
					extensions.push(window.TiptapPaginationBreaks.configure({
						pageHeight: this.pageDimensions.height,
						pageWidth: this.pageDimensions.width,
						margin: this.options.margin,
						autoBreak: this.options.enableAutoPageBreaks,
						pageSpacing: 20,
					}));
				} catch (error) {
					console.warn('[TiptapDocxEditor] Failed to configure pagination:', error);
				}
			} else {
				console.log('[TiptapDocxEditor] Pagination extension not available, using CSS-based layout');
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
			this.editor.commands.setContent(html);
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

		destroy() {
			if (this.editor) {
				this.editor.destroy();
				this.editor = null;
			}
		}
	}

	// Expose globally for webview
	window.TiptapDocxEditor = TiptapDocxEditor;

})();

