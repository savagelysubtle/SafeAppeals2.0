/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Glass Devtools, Inc. All rights reserved.
 *  Void Editor additions licensed under the AGPL 3.0 License.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../../base/common/uri.js';
import { IMainProcessService } from '../../../../../../platform/ipc/common/mainProcessService.js';
import { PDFContentExtractor } from './pdfContentExtractor.js';

export interface IPDFContext {
	selectedText: string;
	currentPageText: string;
	pageNumber: number;
	totalPages: number;
	documentTitle: string;
	surroundingPages?: string;
}

export class PDFContextGathering {

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService
	) { }

	async getPDFContext(
		uri: URI,
		selectedText: string,
		currentPage: number,
		totalPages: number,
		contextRange: number = 0 // ±N surrounding pages
	): Promise<IPDFContext> {

		const extractor = new PDFContentExtractor(this.mainProcessService);
		const documentTitle = uri.fsPath.split(/[\\/]/).pop() || 'Unknown Document';

		// Get current page text
		let currentPageText = '';
		try {
			const pageContent = await extractor.extractContentRange(uri, currentPage, currentPage);
			currentPageText = pageContent;
		} catch (error) {
			console.error('Failed to extract current page text:', error);
			currentPageText = '[Unable to extract page text]';
		}

		// Get surrounding pages if requested
		let surroundingPages: string | undefined;
		if (contextRange > 0) {
			try {
				const startPage = Math.max(1, currentPage - contextRange);
				const endPage = Math.min(totalPages, currentPage + contextRange);

				// Don't include current page in surrounding pages
				const beforePages = startPage < currentPage
					? await extractor.extractContentRange(uri, startPage, currentPage - 1)
					: '';
				const afterPages = endPage > currentPage
					? await extractor.extractContentRange(uri, currentPage + 1, endPage)
					: '';

				if (beforePages || afterPages) {
					surroundingPages = [
						beforePages && `Pages ${startPage}-${currentPage - 1}:\n${beforePages}`,
						afterPages && `Pages ${currentPage + 1}-${endPage}:\n${afterPages}`
					].filter(Boolean).join('\n\n');
				}
			} catch (error) {
				console.error('Failed to extract surrounding pages:', error);
			}
		}

		return {
			selectedText,
			currentPageText,
			pageNumber: currentPage,
			totalPages,
			documentTitle,
			surroundingPages
		};
	}

	/**
	 * Get PDF context with a sliding window of sentences around the selected text.
	 * More efficient than full pages for long documents.
	 */
	async getPDFContextWithSlidingWindow(
		uri: URI,
		selectedText: string,
		currentPage: number,
		totalPages: number,
		sentenceWindow: number = 2 // ±N sentences around selection (reduced for better focus)
	): Promise<IPDFContext> {
		const extractor = new PDFContentExtractor(this.mainProcessService);
		const documentTitle = uri.fsPath.split(/[\\/]/).pop() || 'Unknown Document';

		try {
			// Get expanded page range to ensure we capture the selected text (reduced range for efficiency)
			const pageRange = Math.max(1, currentPage);
			const endPage = Math.min(totalPages, currentPage);
			const pageText = await extractor.extractContentRange(uri, pageRange, endPage);

			// Try to find the selected text in the page range
			const selectionIndex = pageText.indexOf(selectedText.substring(0, 100)); // Use first 100 chars for matching

			if (selectionIndex === -1) {
				// Fallback to standard method if we can't find the selection
				console.log('[PDF Context] Selection not found in page range, using standard context');
				return this.getPDFContext(uri, selectedText, currentPage, totalPages, 1);
			}

			// Split into sentences
			const sentences = this.splitIntoSentences(pageText);
			const selectionSentenceIndex = this.findSentenceIndex(sentences, selectionIndex);

			// Extract sliding window
			const startIndex = Math.max(0, selectionSentenceIndex - sentenceWindow);
			const endIndex = Math.min(sentences.length, selectionSentenceIndex + sentenceWindow + 1);

			const contextWindow = sentences.slice(startIndex, endIndex).join(' ');

			console.log(`[PDF Context Sliding Window] Selected sentence ${selectionSentenceIndex} of ${sentences.length}, window: ${startIndex}-${endIndex}`);

			return {
				selectedText,
				currentPageText: contextWindow,
				pageNumber: currentPage,
				totalPages,
				documentTitle,
				surroundingPages: undefined // Sliding window replaces surrounding pages
			};
		} catch (error) {
			console.error('[PDF Context] Sliding window failed, falling back to standard context:', error);
			return this.getPDFContext(uri, selectedText, currentPage, totalPages, 1);
		}
	}

	private splitIntoSentences(text: string): string[] {
		// Split on sentence boundaries (. ! ? followed by space or newline)
		// Keep the punctuation with each sentence
		const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g);
		if (!sentences) {
			// If no sentence boundaries found, split on double newlines
			return text.split(/\n\n+/).filter(s => s.trim().length > 0);
		}
		return sentences.map(s => s.trim()).filter(s => s.length > 0);
	}

	private findSentenceIndex(sentences: string[], charIndex: number): number {
		let currentIndex = 0;
		for (let i = 0; i < sentences.length; i++) {
			const sentenceLength = sentences[i].length;
			if (currentIndex + sentenceLength >= charIndex) {
				return i;
			}
			currentIndex += sentenceLength + 1; // +1 for space between sentences
		}
		return Math.max(0, sentences.length - 1);
	}

	formatContextForAI(context: IPDFContext): string {
		let formatted = `Document: ${context.documentTitle}\n`;
		formatted += `Page ${context.pageNumber} of ${context.totalPages}\n\n`;

		if (context.selectedText) {
			formatted += `Selected Text:\n${context.selectedText}\n\n`;
		}

		formatted += `Current Page Context:\n${context.currentPageText}`;

		if (context.surroundingPages) {
			formatted += `\n\nSurrounding Pages:\n${context.surroundingPages}`;
		}

		return formatted;
	}
}
