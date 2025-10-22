/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../../base/common/uri.js';
import { DocumentContentExtractor } from '../../../common/documentViewerService.js';
import { IChannel } from '../../../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../../../platform/ipc/common/mainProcessService.js';

/**
 * Extracts PDF text content using electron-main ragFileService via IPC
 */
export class PDFContentExtractor implements DocumentContentExtractor {
	private readonly channel: IChannel;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService
	) {
		// Get the channel for electron-main communication
		this.channel = this.mainProcessService.getChannel('void-channel-pdf-extractor');
	}

	async extractContent(uri: URI): Promise<string> {
		try {
			// For PDF files added via Ctrl+L, limit to first page to avoid context window issues
			// If user wants full PDF, they should use specific page range via extractContentRange
			const result = await this.channel.call<{ text: string }>('extractPDFContent', {
				uri: uri.toString(),
				startPage: 1,
				endPage: 1 // Only extract first page by default
			});
			return `[PDF Preview - Page 1 only. Use Ctrl+K with selection for specific content]\n\n${result.text}`;
		} catch (error) {
			console.error(`Failed to extract PDF content from ${uri.toString()}:`, error);
			throw error;
		}
	}

	async extractContentRange(uri: URI, startPage: number, endPage: number): Promise<string> {
		try {
			const result = await this.channel.call<{ text: string }>('extractPDFContent', {
				uri: uri.toString(),
				startPage,
				endPage
			});
			return result.text;
		} catch (error) {
			console.error(`Failed to extract PDF content range from ${uri.toString()}:`, error);
			throw error;
		}
	}
}

