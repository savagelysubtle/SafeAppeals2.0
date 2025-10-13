/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Monaco-based rich text editor for desktop environments
 * Displays plain text in Monaco but tracks HTML formatting in document metadata
 */
export class MonacoRichTextEditor {
	private static readonly viewType = 'txtRichEditor.monacoEditor';
	private htmlStateMap = new Map<string, string>(); // uri -> HTML state

	constructor(_context: vscode.ExtensionContext) {
		// Context reserved for future use
	}

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new MonacoRichTextEditor(context);
		const disposable = vscode.workspace.registerTextDocumentContentProvider(
			MonacoRichTextEditor.viewType,
			provider as any
		);
		return disposable;
	}

	/**
	 * Opens a rich text file using Monaco editor
	 */
	public async openFile(uri: vscode.Uri): Promise<void> {
		// Read the file content
		const document = await vscode.workspace.openTextDocument(uri);
		const plainText = document.getText();

		// Initialize HTML state if not exists
		if (!this.htmlStateMap.has(uri.toString())) {
			this.htmlStateMap.set(uri.toString(), this.plainTextToHtml(plainText));
		}

		// Open in Monaco editor (standard text editor)
		await vscode.window.showTextDocument(document, {
			preview: false,
			preserveFocus: false
		});

		// Apply decorations to show rich text styling
		this.applyRichTextDecorations(vscode.window.activeTextEditor!);
	}

	/**
	 * Get HTML state for a given URI
	 */
	public getHtmlState(uri: vscode.Uri): string | undefined {
		return this.htmlStateMap.get(uri.toString());
	}

	/**
	 * Set HTML state for a given URI
	 */
	public setHtmlState(uri: vscode.Uri, html: string): void {
		this.htmlStateMap.set(uri.toString(), html);
	}

	/**
	 * Get plain text from a document
	 */
	public getPlainText(document: vscode.TextDocument): string {
		return document.getText();
	}

	/**
	 * Convert plain text to HTML (basic conversion)
	 */
	private plainTextToHtml(text: string): string {
		return text
			.split('\n')
			.map(line => `<p>${this.escapeHtml(line)}</p>`)
			.join('\n');
	}

	/**
	 * Convert HTML to plain text
	 */
	public htmlToPlainText(html: string): string {
		return html
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<\/p>/gi, '\n')
			.replace(/<[^>]+>/g, '')
			.replace(/&nbsp;/g, ' ')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&amp;/g, '&')
			.trim();
	}

	/**
	 * Escape HTML special characters
	 */
	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	/**
	 * Apply decorations to show rich text styling in Monaco
	 */
	private applyRichTextDecorations(editor: vscode.TextEditor): void {
		if (!editor) return;

		const uri = editor.document.uri;
		const html = this.htmlStateMap.get(uri.toString());
		if (!html) return;

		// Parse HTML and apply decorations
		const decorations = this.parseHtmlForDecorations(html, editor.document);

		// Apply bold decorations
		if (decorations.bold.length > 0) {
			editor.setDecorations(
				vscode.window.createTextEditorDecorationType({
					fontWeight: 'bold'
				}),
				decorations.bold
			);
		}

		// Apply italic decorations
		if (decorations.italic.length > 0) {
			editor.setDecorations(
				vscode.window.createTextEditorDecorationType({
					fontStyle: 'italic'
				}),
				decorations.italic
			);
		}

		// Apply heading decorations
		if (decorations.heading.length > 0) {
			editor.setDecorations(
				vscode.window.createTextEditorDecorationType({
					fontWeight: 'bold'
					// Note: fontSize not supported in DecorationRenderOptions
				}),
				decorations.heading
			);
		}
	}

	/**
	 * Parse HTML and extract decoration ranges
	 */
	private parseHtmlForDecorations(_html: string, _document: vscode.TextDocument): {
		bold: vscode.Range[];
		italic: vscode.Range[];
		underline: vscode.Range[];
		heading: vscode.Range[];
	} {
		const decorations = {
			bold: [] as vscode.Range[],
			italic: [] as vscode.Range[],
			underline: [] as vscode.Range[],
			heading: [] as vscode.Range[]
		};

		// Simple regex-based parsing (could be improved with proper HTML parser)
		// const boldRegex = /<b>(.*?)<\/b>/g;
		// const italicRegex = /<i>(.*?)<\/i>/g;
		// const underlineRegex = /<u>(.*?)<\/u>/g;
		// const headingRegex = /<h[1-3]>(.*?)<\/h[1-3]>/g;

		// This is a simplified implementation
		// In production, you'd want to properly map HTML positions to document positions
		// For now, return empty decorations

		return decorations;
	}

	/**
	 * Update HTML state based on plain text changes
	 */
	public async updateHtmlFromPlainText(document: vscode.TextDocument, _changes: readonly vscode.TextDocumentContentChangeEvent[]): Promise<void> {
		const uri = document.uri;
		const currentHtml = this.htmlStateMap.get(uri.toString());

		if (!currentHtml) {
			// Initialize HTML state
			this.htmlStateMap.set(uri.toString(), this.plainTextToHtml(document.getText()));
			return;
		}

		// For now, we'll keep the HTML state separate
		// In a full implementation, you'd intelligently merge changes
	}
}

