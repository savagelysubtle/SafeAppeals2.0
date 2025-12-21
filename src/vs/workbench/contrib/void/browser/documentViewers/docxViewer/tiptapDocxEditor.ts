/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Note: This file uses globals provided by bundled scripts (tiptapDocxBundle.js, tiptapBundle.js)
// The actual runtime implementation is in tiptapBundle.js which loads in the webview
// Direct npm package imports are not allowed in VSCode browser code - must use globals instead

// Type declarations for globals
declare global {
	interface Window {
		TiptapEditor: any; // Editor class from @tiptap/core
		TiptapExtension: any; // Extension class from @tiptap/core
		TiptapStarterKit: any; // StarterKit from @tiptap/starter-kit
		TiptapPageExtension?: any; // @adalat-ai/page-extension
		TiptapPageDocument?: any; // @adalat-ai/page-extension
		TiptapPage?: any; // @adalat-ai/page-extension Page Node
		TiptapPagination?: any; // Legacy hugs7
		TiptapPaginationBreaks?: any; // Legacy
		TiptapUnderline?: any; // Underline extension
		TiptapTextAlign?: any; // TextAlign extension
		TiptapLink?: any; // Link extension
		TiptapHorizontalRule?: any; // HorizontalRule extension
		DocxLib: {
			Document: any;
			Packer: any;
			Paragraph: any;
			TextRun: any;
			HeadingLevel: any;
			AlignmentType: any;
			PageBreak: any;
		};
		docx: any; // docx-preview library
	}
}

// Use globals instead of direct imports to avoid VSCode import restrictions
// Access globals at runtime (using any to avoid window warnings in this context)
const getGlobals = () => {
	const win = globalThis as any;
	return {
		Editor: win.TiptapEditor,
		Extension: win.TiptapExtension,
		StarterKit: win.TiptapStarterKit,
		TiptapPageExtension: win.TiptapPageExtension,
		TiptapPageDocument: win.TiptapPageDocument,
		TiptapPagination: win.TiptapPagination,
		TiptapPaginationBreaks: win.TiptapPaginationBreaks,
		Underline: win.TiptapUnderline,
		TextAlign: win.TiptapTextAlign,
		Link: win.TiptapLink,
		HorizontalRule: win.TiptapHorizontalRule,
		DocxLib: win.DocxLib,
		docx: win.docx,
	};
};

// Type aliases for types used in the code
type EditorType = any; // Editor instance type
type DocxParagraphType = any; // DocxParagraph instance type
type TextRunType = any; // TextRun instance type

export interface TiptapEditorOptions {
	pageSize?: 'letter' | 'legal' | 'a4' | 'tabloid' | 'a3';
	orientation?: 'portrait' | 'landscape';
	margin?: number; // in pixels (96 DPI = 1 inch)
	enableAutoPageBreaks?: boolean;
	onContentChange?: (content: { html: string; json: any }) => void;
}

interface PageDimensions {
	width: number;
	height: number;
}

export class TiptapDocxEditor {
	private editor: EditorType | null = null;
	private container: HTMLElement;
	private options: Required<TiptapEditorOptions>;
	private pageDimensions: PageDimensions;

	constructor(container: HTMLElement, options: TiptapEditorOptions = {}) {
		this.container = container;

		// Set default options
		this.options = {
			pageSize: options.pageSize ?? 'letter',
			orientation: options.orientation ?? 'portrait',
			margin: options.margin ?? 96, // Default 1 inch
			enableAutoPageBreaks: options.enableAutoPageBreaks ?? true,
			onContentChange: options.onContentChange ?? (() => { }),
		};

		this.pageDimensions = this.getPageDimensions(this.options.pageSize);
		this.initialize();
	}

	private getPageDimensions(pageSize: string): PageDimensions {
		// Dimensions in pixels at 96 DPI
		const dimensions: Record<string, PageDimensions> = {
			letter: { width: 816, height: 1056 },    // 8.5" × 11"
			legal: { width: 816, height: 1344 },     // 8.5" × 14"
			tabloid: { width: 1056, height: 1632 },  // 11" × 17"
			a4: { width: 794, height: 1123 },        // 210mm × 297mm
			a3: { width: 1123, height: 1587 },       // 297mm × 420mm
		};
		return dimensions[pageSize] || dimensions.letter;
	}

	private initialize(): void {
		console.log('[TiptapDocxEditor] Initializing editor - MS Word Style (@adalat-ai/page-extension)');

		const globals = getGlobals();
		if (!globals.Editor || !globals.StarterKit) {
			throw new Error('Tiptap libraries not loaded. Ensure tiptapDocxBundle.js is loaded.');
		}

		const extensions: any[] = [
			globals.StarterKit.configure({
				document: false, // Required for PageDocument to take over
			}),
		];

		// Add Underline extension if available
		if (globals.Underline) {
			extensions.push(globals.Underline);
		}

		// Add TextAlign extension if available
		if (globals.TextAlign) {
			extensions.push(globals.TextAlign.configure({
				types: ['heading', 'paragraph'],
			}));
		}

		// Add Link extension if available
		if (globals.Link) {
			extensions.push(globals.Link.configure({
				openOnClick: false,
				HTMLAttributes: {
					class: 'docx-link',
				},
			}));
		}

		// Add HorizontalRule extension if available
		if (globals.HorizontalRule) {
			extensions.push(globals.HorizontalRule);
		}

		// Configure @adalat-ai/page-extension
		// This extension uses React (ReactNodeViewRenderer) to render pages.
		// React is bundled in tiptapBundleEntry.js and exposed globally.
		if (globals.TiptapPageExtension && globals.TiptapPageDocument) {
			console.log('[TiptapDocxEditor] Configuring @adalat-ai/page-extension');

			// Add PageDocument extension (required - replaces the default doc node)
			extensions.push(globals.TiptapPageDocument);

			// Calculate margins in inches (96 DPI)
			const marginInches = this.options.margin / 96;

			// Configure PageExtension with our page dimensions and margins
			// The extension's React-based PageComponent will render each page
			extensions.push(globals.TiptapPageExtension.configure({
				// Page dimensions (pixels)
				// bodyHeight is the FULL page height including margins
				// The extension internally subtracts margins to get content height
				bodyHeight: this.pageDimensions.height,
				bodyWidth: this.pageDimensions.width,

				// Layout configuration with margins in inches
				pageLayout: {
					margins: {
						top: { unit: 'INCHES', value: marginInches },
						right: { unit: 'INCHES', value: marginInches },
						bottom: { unit: 'INCHES', value: marginInches },
						left: { unit: 'INCHES', value: marginInches },
					},
				},

				// Page numbering (can be enabled if needed)
				pageNumber: {
					show: false,
				},
			}));
			console.log('[TiptapDocxEditor] PageExtension configured with dimensions:', this.pageDimensions, 'margin:', marginInches, 'inches');

		} else if (globals.TiptapPagination) {
			// Fallback to legacy hugs7 if new one missing
			console.warn('[TiptapDocxEditor] @adalat-ai/page-extension missing, falling back to hugs7');
			const marginMm = (this.options.margin / 96) * 25.4;
			extensions.push(globals.TiptapPagination.configure({
				defaultPaperSize: this.options.pageSize === 'letter' ? 'Letter' : this.options.pageSize,
				defaultPaperColour: '#ffffff',
				defaultPaperOrientation: this.options.orientation,
				defaultMarginConfig: { top: marginMm, right: marginMm, bottom: marginMm, left: marginMm },
			}));
		} else {
			console.warn('[TiptapDocxEditor] No pagination extension found!');
		}

		// Create editor
		this.editor = new globals.Editor({
			element: this.container,
			extensions,
			content: '<p>Start typing...</p>',
			editorProps: {
				attributes: {
					class: 'tiptap-editor prose prose-sm focus:outline-none',
					spellcheck: 'true',
				},
			},
			onUpdate: ({ editor }: { editor: EditorType }) => {
				this.options.onContentChange({
					html: editor.getHTML(),
					json: editor.getJSON(),
				});
			},
			onCreate: ({ editor }: { editor: EditorType }) => {
				// Force pagination check after initialization
				setTimeout(() => {
					if (!editor.isDestroyed) {
						console.log('[TiptapDocxEditor] Forcing initial pagination check');
						editor.view.dispatch(editor.state.tr.setMeta('addToHistory', false));
					}
				}, 200);
			},
		});

		console.log('[TiptapDocxEditor] Editor initialized successfully');
	}

	/**
	 * Load DOCX file into editor
	 * Uses docx-preview to convert .docx → HTML, then loads into Tiptap
	 */
	async loadFromDocx(arrayBuffer: ArrayBuffer): Promise<void> {
		if (!this.editor) {
			throw new Error('Editor not initialized');
		}

		console.log('[TiptapDocxEditor] Loading DOCX file');

		try {
			const globals = getGlobals();
			if (!globals.docx) {
				throw new Error('docx-preview library not loaded');
			}

			// Step 1: Use docx-preview to convert DOCX to HTML
			const tempDiv = document.createElement('div');
			await globals.docx.renderAsync(arrayBuffer, tempDiv, undefined, {
				className: 'docx',
				inWrapper: true,
				ignoreWidth: false,
				ignoreHeight: false,
				breakPages: false, // We'll handle pagination with Tiptap
				renderHeaders: true,
				renderFooters: true,
			});

			const html = tempDiv.innerHTML;
			console.log('[TiptapDocxEditor] Converted DOCX to HTML, length:', html.length);

			// Step 2: Load HTML into Tiptap
			this.loadFromHTML(html);

			console.log('[TiptapDocxEditor] DOCX loaded successfully');
		} catch (error) {
			console.error('[TiptapDocxEditor] Failed to load DOCX:', error);
			throw error;
		}
	}

	/**
	 * Load HTML content into editor
	 */
	loadFromHTML(html: string): void {
		if (!this.editor) {
			throw new Error('Editor not initialized');
		}

		console.log('[TiptapDocxEditor] Loading HTML content');
		this.editor.commands.setContent(html);

		// Force pagination check after content load with retries
		// The extension needs the DOM to be fully rendered to calculate splits
		const checkPagination = (attempt: number) => {
			if (!this.editor || this.editor.isDestroyed) return;

			// Dispatch a transaction to trigger extension updates
			console.log(`[TiptapDocxEditor] Forcing pagination check (attempt ${attempt})`);
			this.editor.view.dispatch(this.editor.state.tr.setMeta('addToHistory', false));

			// If we still have 1 page but lots of content, keep trying
			// This is a heuristic: if scrollHeight is huge but we have 1 page, something is wrong
			// Note: We can't easily access the page count from here without inspecting the DOM or state
			if (attempt < 5) {
				setTimeout(() => checkPagination(attempt + 1), 500 * attempt);
			}
		};

		setTimeout(() => checkPagination(1), 500);
	}

	/**
	 * Get current editor content as HTML
	 */
	getHTML(): string {
		if (!this.editor) {
			throw new Error('Editor not initialized');
		}
		return this.editor.getHTML();
	}

	/**
	 * Get current editor content as JSON
	 */
	getJSON(): any {
		if (!this.editor) {
			throw new Error('Editor not initialized');
		}
		return this.editor.getJSON();
	}

	/**
	 * Get plain text content
	 */
	getText(): string {
		if (!this.editor) {
			throw new Error('Editor not initialized');
		}
		return this.editor.getText();
	}

	/**
	 * Save editor content to DOCX format
	 * Converts Tiptap content → DOCX
	 */
	async saveToDocx(): Promise<Blob> {
		if (!this.editor) {
			throw new Error('Editor not initialized');
		}

		console.log('[TiptapDocxEditor] Converting content to DOCX');

		try {
			const globals = getGlobals();
			if (!globals.DocxLib) {
				throw new Error('docx library not loaded. Ensure tiptapDocxBundle.js is loaded.');
			}

			const json = this.editor.getJSON();
			const docxContent = this.convertTiptapToDocx(json);

			// Create DOCX document
			const doc = new globals.DocxLib.Document({
				sections: [{
					properties: {
						page: {
							size: {
								width: this.pageDimensions.width * 15, // Convert to twips (1/20th of a point)
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
			const blob = await globals.DocxLib.Packer.toBlob(doc);
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
	private convertTiptapToDocx(json: any): DocxParagraphType[] {
		const paragraphs: DocxParagraphType[] = [];

		if (!json.content) {
			return paragraphs;
		}

		for (const node of json.content) {
			const converted = this.convertNodeToDocx(node);
			if (converted) {
				paragraphs.push(...converted);
			}
		}

		return paragraphs;
	}

	/**
	 * Convert a single Tiptap node to DOCX
	 */
	private convertNodeToDocx(node: any): DocxParagraphType[] | null {
		const globals = getGlobals();
		const paragraphs: DocxParagraphType[] = [];

		switch (node.type) {
			case 'paragraph': {
				const runs = this.extractTextRuns(node);
				paragraphs.push(new globals.DocxLib.Paragraph({
					children: runs,
					alignment: this.getAlignment(node),
				}));
				break;
			}

			case 'heading': {
				const runs = this.extractTextRuns(node);
				const level = node.attrs?.level || 1;
				paragraphs.push(new globals.DocxLib.Paragraph({
					children: runs,
					heading: this.getHeadingLevel(level),
				}));
				break;
			}

			case 'bulletList':
			case 'orderedList': {
				// Process list items
				if (node.content) {
					for (const item of node.content) {
						if (item.type === 'listItem' && item.content) {
							for (const childNode of item.content) {
								const converted = this.convertNodeToDocx(childNode);
								if (converted) {
									paragraphs.push(...converted);
								}
							}
						}
					}
				}
				break;
			}

			case 'codeBlock': {
				const text = this.extractPlainText(node);
				paragraphs.push(new globals.DocxLib.Paragraph({
					children: [new globals.DocxLib.TextRun({ text, font: 'Courier New' })],
				}));
				break;
			}

			default:
				// Handle unknown nodes by extracting text
				if (node.content) {
					for (const childNode of node.content) {
						const converted = this.convertNodeToDocx(childNode);
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
	private extractTextRuns(node: any): TextRunType[] {
		const globals = getGlobals();
		const runs: TextRunType[] = [];

		if (!node.content) {
			return [new globals.DocxLib.TextRun({ text: '' })];
		}

		for (const inline of node.content) {
			if (inline.type === 'text') {
				const marks = inline.marks || [];
				const isBold = marks.some((m: any) => m.type === 'bold');
				const isItalic = marks.some((m: any) => m.type === 'italic');
				const isUnderline = marks.some((m: any) => m.type === 'underline');
				const isStrike = marks.some((m: any) => m.type === 'strike');

				runs.push(new globals.DocxLib.TextRun({
					text: inline.text || '',
					bold: isBold,
					italics: isItalic,
					underline: isUnderline ? {} : undefined,
					strike: isStrike,
				}));
			}
		}

		return runs.length > 0 ? runs : [new globals.DocxLib.TextRun({ text: '' })];
	}

	/**
	 * Extract plain text from a node recursively
	 */
	private extractPlainText(node: any): string {
		if (node.type === 'text') {
			return node.text || '';
		}

		if (!node.content) {
			return '';
		}

		return node.content.map((n: any) => this.extractPlainText(n)).join('');
	}

	/**
	 * Get alignment from node attributes
	 */
	private getAlignment(node: any): any {
		const globals = getGlobals();
		const align = node.attrs?.textAlign;
		const AlignmentType = globals.DocxLib?.AlignmentType;
		if (!AlignmentType) return undefined;

		switch (align) {
			case 'left': return AlignmentType.LEFT;
			case 'center': return AlignmentType.CENTER;
			case 'right': return AlignmentType.RIGHT;
			case 'justify': return AlignmentType.JUSTIFIED;
			default: return undefined;
		}
	}

	/**
	 * Convert heading level number to DOCX HeadingLevel
	 */
	private getHeadingLevel(level: number): any {
		const globals = getGlobals();
		const HeadingLevel = globals.DocxLib?.HeadingLevel;
		if (!HeadingLevel) return undefined;

		const levels: Record<number, any> = {
			1: HeadingLevel.HEADING_1,
			2: HeadingLevel.HEADING_2,
			3: HeadingLevel.HEADING_3,
			4: HeadingLevel.HEADING_4,
			5: HeadingLevel.HEADING_5,
			6: HeadingLevel.HEADING_6,
		};
		return levels[level] || HeadingLevel.HEADING_1;
	}

	/**
	 * Update page size
	 */
	setPageSize(pageSize: 'letter' | 'legal' | 'a4' | 'tabloid' | 'a3'): void {
		this.options.pageSize = pageSize;
		this.pageDimensions = this.getPageDimensions(pageSize);

		// Reinitialize editor with new dimensions
		if (this.editor) {
			const currentContent = this.editor.getJSON();
			this.destroy();
			this.initialize();
			this.editor?.commands.setContent(currentContent);
		}
	}

	/**
	 * Update margins
	 */
	setMargin(margin: number): void {
		this.options.margin = margin;

		// Reinitialize editor with new margins
		if (this.editor) {
			const currentContent = this.editor.getJSON();
			this.destroy();
			this.initialize();
			this.editor?.commands.setContent(currentContent);
		}
	}

	/**
	 * Update page orientation
	 */
	setOrientation(orientation: 'portrait' | 'landscape'): void {
		this.options.orientation = orientation;

		// Reinitialize editor with new orientation
		if (this.editor) {
			const currentContent = this.editor.getJSON();
			this.destroy();
			this.initialize();
			this.editor?.commands.setContent(currentContent);
		}
	}

	/**
	 * Check if editor is ready
	 */
	isReady(): boolean {
		return this.editor !== null;
	}

	/**
	 * Focus the editor
	 */
	focus(): void {
		this.editor?.commands.focus();
	}

	/**
	 * Clean up and destroy editor
	 */
	destroy(): void {
		if (this.editor) {
			console.log('[TiptapDocxEditor] Destroying editor');
			this.editor.destroy();
			this.editor = null;
		}
	}
}

