/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
// @ts-ignore - Community extension may not have types
import PaginationBreaks from 'tiptap-pagination-breaks';
import { Document as DocxDocument, Packer, Paragraph as DocxParagraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import * as docxPreview from 'docx-preview';

export interface TiptapEditorOptions {
	pageSize?: 'letter' | 'legal' | 'a4' | 'tabloid' | 'a3';
	margin?: number; // in pixels (96 DPI = 1 inch)
	enableAutoPageBreaks?: boolean;
	onContentChange?: (content: { html: string; json: any }) => void;
}

interface PageDimensions {
	width: number;
	height: number;
}

export class TiptapDocxEditor {
	private editor: Editor | null = null;
	private container: HTMLElement;
	private options: Required<TiptapEditorOptions>;
	private pageDimensions: PageDimensions;

	constructor(container: HTMLElement, options: TiptapEditorOptions = {}) {
		this.container = container;

		// Set default options
		this.options = {
			pageSize: options.pageSize ?? 'letter',
			margin: options.margin ?? 96, // Default 1 inch
			enableAutoPageBreaks: options.enableAutoPageBreaks ?? true,
			onContentChange: options.onContentChange ?? (() => {}),
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
		console.log('[TiptapDocxEditor] Initializing editor');

		// Create editor with pagination
		this.editor = new Editor({
			element: this.container,
			extensions: [
				StarterKit.configure({
					document: false, // We'll use pagination extension's document
				}),
				PaginationBreaks.configure({
					pageHeight: this.pageDimensions.height,
					pageWidth: this.pageDimensions.width,
					margin: this.options.margin,
					autoBreak: this.options.enableAutoPageBreaks,
					pageSpacing: 20, // Space between pages
				}),
			],
			content: '<p>Start typing...</p>',
			editorProps: {
				attributes: {
					class: 'tiptap-editor prose prose-sm focus:outline-none',
					spellcheck: 'true',
				},
			},
			onUpdate: ({ editor }) => {
				this.options.onContentChange({
					html: editor.getHTML(),
					json: editor.getJSON(),
				});
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
			// Step 1: Use docx-preview to convert DOCX to HTML
			const tempDiv = document.createElement('div');
			await docxPreview.renderAsync(arrayBuffer, tempDiv, undefined, {
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
			const json = this.editor.getJSON();
			const docxContent = this.convertTiptapToDocx(json);

			// Create DOCX document
			const doc = new DocxDocument({
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
	private convertTiptapToDocx(json: any): DocxParagraph[] {
		const paragraphs: DocxParagraph[] = [];

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
	private convertNodeToDocx(node: any): DocxParagraph[] | null {
		const paragraphs: DocxParagraph[] = [];

		switch (node.type) {
			case 'paragraph': {
				const runs = this.extractTextRuns(node);
				paragraphs.push(new DocxParagraph({
					children: runs,
					alignment: this.getAlignment(node),
				}));
				break;
			}

			case 'heading': {
				const runs = this.extractTextRuns(node);
				const level = node.attrs?.level || 1;
				paragraphs.push(new DocxParagraph({
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
				paragraphs.push(new DocxParagraph({
					children: [new TextRun({ text, font: 'Courier New' })],
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
	private extractTextRuns(node: any): TextRun[] {
		const runs: TextRun[] = [];

		if (!node.content) {
			return [new TextRun({ text: '' })];
		}

		for (const inline of node.content) {
			if (inline.type === 'text') {
				const marks = inline.marks || [];
				const isBold = marks.some((m: any) => m.type === 'bold');
				const isItalic = marks.some((m: any) => m.type === 'italic');
				const isUnderline = marks.some((m: any) => m.type === 'underline');
				const isStrike = marks.some((m: any) => m.type === 'strike');

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
	private getAlignment(node: any): typeof AlignmentType[keyof typeof AlignmentType] | undefined {
		const align = node.attrs?.textAlign;
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
	private getHeadingLevel(level: number): typeof HeadingLevel[keyof typeof HeadingLevel] {
		const levels: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
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

