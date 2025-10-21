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
