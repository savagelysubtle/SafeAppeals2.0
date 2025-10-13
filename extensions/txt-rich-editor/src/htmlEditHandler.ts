/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Handles HTML-aware editing that preserves rich text formatting
 */
export class HtmlEditHandler {

	/**
	 * Apply an edit to HTML content while preserving formatting
	 */
	public applyEditToHtml(
		originalHtml: string,
		editedPlainText: string,
		range: { start: number; end: number }
	): string {
		// This is a simplified implementation
		// In production, you'd want proper HTML parsing and manipulation

		// Extract the portion of HTML that corresponds to the range
		const plainText = this.htmlToPlainText(originalHtml);
		const beforeEdit = plainText.substring(0, range.start);
		const afterEdit = plainText.substring(range.end);

		// Create new plain text
		const newPlainText = beforeEdit + editedPlainText + afterEdit;

		// Try to preserve formatting by mapping changes
		return this.mergeHtmlWithPlainTextEdit(originalHtml, newPlainText, range);
	}

	/**
	 * Parse HTML to extract search-replace blocks from Void output
	 */
	public parseSearchReplaceFromVoidOutput(voidOutput: string): Array<{
		search: string;
		replace: string;
	}> {
		const blocks: Array<{ search: string; replace: string }> = [];

		// Parse Void's search/replace block format:
		// <<<<<<< ORIGINAL
		// original text
		// =======
		// replacement text
		// >>>>>>> UPDATED

		const regex = /<<<<<<< ORIGINAL\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> UPDATED/g;
		let match;

		while ((match = regex.exec(voidOutput)) !== null) {
			blocks.push({
				search: match[1].trim(),
				replace: match[2].trim()
			});
		}

		return blocks;
	}

	/**
	 * Apply search-replace blocks to HTML content
	 */
	public applySearchReplaceToHtml(html: string, blocks: Array<{ search: string; replace: string }>): string {
		let result = html;

		for (const block of blocks) {
			// Convert search/replace plain text to HTML-aware replacements
			const htmlSearch = this.plainTextToHtmlPattern(block.search);
			const htmlReplace = this.plainTextToHtmlPattern(block.replace);

			// Try to find and replace in HTML while preserving structure
			result = this.replaceInHtml(result, htmlSearch, htmlReplace);
		}

		return result;
	}

	/**
	 * Convert plain text to HTML pattern that can match HTML content
	 */
	private plainTextToHtmlPattern(text: string): string {
		// Escape HTML and create a pattern that matches with or without tags
		return text
			.split('\n')
			.map(line => line.trim())
			.join('\\s*');
	}

	/**
	 * Replace text in HTML while preserving formatting tags
	 */
	private replaceInHtml(html: string, searchPattern: string, _replaceText: string): string {
		// This is simplified - in production, use a proper HTML parser
		// For now, try to match the plain text and preserve surrounding tags

		const plainText = this.htmlToPlainText(html);

		if (plainText.includes(searchPattern)) {
			// Find position in plain text
			// const startPos = plainText.indexOf(searchPattern);
			// const endPos = startPos + searchPattern.length;

			// Map back to HTML and replace
			// This is a naive implementation - should use proper HTML parsing
			return html; // Return unchanged for now
		}

		return html;
	}

	/**
	 * Convert HTML to plain text for comparison
	 */
	private htmlToPlainText(html: string): string {
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
	 * Merge HTML with plain text edits, preserving formatting where possible
	 */
	private mergeHtmlWithPlainTextEdit(
		_originalHtml: string,
		newPlainText: string,
		_editRange: { start: number; end: number }
	): string {
		// Simplified implementation
		// In production, use a proper HTML diff algorithm

		// For now, wrap new text in paragraphs
		return newPlainText
			.split('\n')
			.filter(line => line.trim().length > 0)
			.map(line => `<p>${this.escapeHtml(line)}</p>`)
			.join('\n');
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
	 * Extract HTML range based on plain text position
	 */
	public extractHtmlRange(html: string, start: number, end: number): string {
		const plainText = this.htmlToPlainText(html);
		const selectedText = plainText.substring(start, end);

		// Find this text in HTML (simplified)
		// In production, maintain a proper mapping between plain text and HTML positions
		return selectedText;
	}
}

