/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export class TiptapDocxEditor {
	private element: HTMLElement;
	private options: any;
	public editor: any; // Tiptap editor instance
	private pageDimensions: { width: number; height: number };

	constructor(element: HTMLElement, options: any = {}) {
		this.element = element;
		this.options = {
			pageSize: 'letter',
			orientation: 'portrait',
			margin: 96, // 1 inch in pixels (96 DPI)
			enableAutoPageBreaks: true,
			onContentChange: () => { },
			...options
		};
		this.editor = null;
		this.pageDimensions = this.getPageDimensions(this.options.pageSize, this.options.orientation);

		this.initialize();
	}

	private getPageDimensions(pageSize: string, orientation: string) {
		const sizes: Record<string, { width: number; height: number }> = {
			letter: { width: 816, height: 1056 }, // 8.5 x 11 in
			legal: { width: 816, height: 1344 },  // 8.5 x 14 in
			tabloid: { width: 1056, height: 1632 }, // 11 x 17 in
			a4: { width: 794, height: 1123 },     // 210 x 297 mm
			a3: { width: 1123, height: 1587 },    // 297 x 420 mm
		};

		const size = sizes[pageSize.toLowerCase()] || sizes.letter;

		if (orientation === 'landscape') {
			return { width: size.height, height: size.width };
		}

		return size;
	}

	private initialize() {
		const win = window as any;

		// Ensure Tiptap dependencies are available
		if (!win.TiptapEditor || !win.TiptapStarterKit) {
			console.error('[TiptapDocxEditor] Tiptap dependencies not found');
			return;
		}

		// Use the globals wrapper to access extensions
		const globals = {
			TiptapEditor: win.TiptapEditor,
			TiptapStarterKit: win.TiptapStarterKit,
			TiptapPageExtension: win.TiptapPageExtension,
			TiptapPageDocument: win.TiptapPageDocument,
			// Additional extensions
			Underline: win.TiptapUnderline,
			TextAlign: win.TiptapTextAlign,
			Link: win.TiptapLink,
			HorizontalRule: win.TiptapHorizontalRule,
			FontFamily: win.TiptapFontFamily,
			TextStyle: win.TiptapTextStyle,
			Color: win.TiptapColor,
			DocxLib: win.DocxLib,
		};

		// Log extension availability
		console.log('[TiptapDocxEditor] Initializing extensions:', {
			TextStyle: !!globals.TextStyle,
			FontFamily: !!globals.FontFamily,
			Color: !!globals.Color
		});

		const extensions = [
			globals.TiptapStarterKit.configure({
				history: {
					depth: 100,
					newGroupDelay: 500,
				},
				// Disable built-in extensions that we might override or configure differently
				horizontalRule: false,
			}),
		];

		// Add Underline extension if available
		if (globals.Underline) {
			extensions.push(globals.Underline);
		}

		// Add TextAlign extension if available
		if (globals.TextAlign) {
			extensions.push(globals.TextAlign.configure({
				types: ['heading', 'paragraph', 'bulletList', 'orderedList'],
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

		// Add TextStyle extension (required for FontFamily and Color)
		if (globals.TextStyle) {
			console.log('[TiptapDocxEditor] Adding TextStyle extension');
			extensions.push(globals.TextStyle);
		} else {
			console.warn('[TiptapDocxEditor] TextStyle extension MISSING - Fonts will not work');
		}

		// Add FontFamily extension
		if (globals.FontFamily) {
			console.log('[TiptapDocxEditor] Adding FontFamily extension');
			extensions.push(globals.FontFamily);
		} else {
			console.warn('[TiptapDocxEditor] FontFamily extension MISSING');
		}

		// Add Color extension
		if (globals.Color) {
			console.log('[TiptapDocxEditor] Adding Color extension');
			extensions.push(globals.Color);
		}

		// Add HorizontalRule extension if available
		if (globals.HorizontalRule) {
			extensions.push(globals.HorizontalRule);
		}

		// Configure Pagination Extension if available
		if (globals.TiptapPageExtension && globals.TiptapPageDocument) {
			console.log('[TiptapDocxEditor] Configuring @adalat-ai/page-extension');

			// We must include the Document replacement extension
			extensions.push(globals.TiptapPageDocument);

			// Configure the page extension with dimensions and margins
			const marginInches = this.options.margin / 96;

			extensions.push(globals.TiptapPageExtension.configure({
				bodyHeight: this.pageDimensions.height,
				bodyWidth: this.pageDimensions.width,
				pageLayout: {
					margins: {
						top: { unit: 'INCHES', value: marginInches },
						right: { unit: 'INCHES', value: marginInches },
						bottom: { unit: 'INCHES', value: marginInches },
						left: { unit: 'INCHES', value: marginInches },
					},
				},
				pageNumber: { show: false }, // We handle page numbers in our own UI
			}));

			console.log('[TiptapDocxEditor] PageExtension configured with dimensions:', this.pageDimensions, 'margin:', marginInches, 'inches');
		} else {
			console.warn('[TiptapDocxEditor] Page extension not found, falling back to standard view');
		}

		// Initialize Editor
		this.editor = new globals.TiptapEditor({
			element: this.element,
			extensions: extensions,
			content: '',
			editable: true,
			onCreate: () => {
				console.log('[TiptapDocxEditor] Editor created');
			},
			onUpdate: ({ editor }: any) => {
				this.options.onContentChange(editor);
			},
		});
	}

	public setPageSize(pageSize: string) {
		this.options.pageSize = pageSize;
		this.pageDimensions = this.getPageDimensions(pageSize, this.options.orientation);
		this.updatePageExtension();
	}

	public setMargin(margin: number) {
		this.options.margin = margin;
		this.updatePageExtension();
	}

	private updatePageExtension() {
		// Note: Most Tiptap extensions don't support dynamic reconfiguration easily.
		console.log('[TiptapDocxEditor] Layout updated. Ideally should reconfigure extension.');
	}

	public loadFromHTML(html: string) {
		if (!this.editor) {
			throw new Error('Editor not initialized');
		}

		console.log('[TiptapDocxEditor] Loading HTML content');
		this.editor.commands.setContent(html);

		// Force pagination check after content load with retries
		const checkPagination = (attempt: number) => {
			if (!this.editor || this.editor.isDestroyed) return;

			// Dispatch a transaction to trigger extension updates
			console.log(`[TiptapDocxEditor] Forcing pagination check (attempt ${attempt})`);
			this.editor.view.dispatch(this.editor.state.tr.setMeta('addToHistory', false));

			if (attempt < 5) {
				setTimeout(() => checkPagination(attempt + 1), 500 * attempt);
			}
		};

		setTimeout(() => checkPagination(1), 500);
	}

	public async loadFromDocx(arrayBuffer: ArrayBuffer) {
		const globals = {
			DocxLib: (window as any).DocxLib
		};

		if (!globals.DocxLib || !globals.DocxLib.renderAsync) {
			throw new Error('docx-preview library not loaded');
		}

		console.log('[TiptapDocxEditor] Converting DOCX to HTML');

		const tempContainer = document.createElement('div');

		try {
			// Convert DOCX to HTML using docx-preview
			await globals.DocxLib.renderAsync(arrayBuffer, tempContainer, null, {
				inWrapper: false,
				ignoreWidth: true,
				ignoreHeight: true,
				ignoreFonts: false, // Keep fonts!
				breakPages: true,
				ignoreLastRenderedPageBreak: false,
				experimental: true,
				useBase64URL: true, // Use base64 for images
			});

			const html = tempContainer.innerHTML;
			this.loadFromHTML(html);

			tempContainer.remove();
		} catch (error) {
			console.error('[TiptapDocxEditor] Error converting DOCX:', error);
			throw error;
		}
	}

	public getText(): string {
		return this.editor ? this.editor.getText() : '';
	}

	public getHTML(): string {
		return this.editor ? this.editor.getHTML() : '';
	}

	public async saveToDocx(): Promise<Blob> {
		if (!this.editor) {
			throw new Error('Editor not initialized');
		}

		const html = this.getHTML();
		const blob = new Blob([html], { type: 'text/html' });
		return blob;
	}
}

// Expose to window
(window as any).TiptapDocxEditor = TiptapDocxEditor;
