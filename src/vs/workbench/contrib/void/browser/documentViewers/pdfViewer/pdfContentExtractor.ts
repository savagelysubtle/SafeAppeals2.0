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
			// Call electron-main extraction via IPC
			const result = await this.channel.call<{ text: string }>('extractPDFContent', {
				uri: uri.toString(),
				allPages: true
			});
			return result.text;
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

