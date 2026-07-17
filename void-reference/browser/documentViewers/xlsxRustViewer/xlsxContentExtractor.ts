/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../../base/common/uri.js';
import { IChannel } from '../../../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../../../platform/ipc/common/mainProcessService.js';
import { DocumentContentExtractor } from '../../../common/documentViewerService.js';

/**
 * Extracts XLSX text content using electron-main via IPC
 */
export class XLSXContentExtractor implements DocumentContentExtractor {
	private readonly channel: IChannel;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService
	) {
		// Get the channel for electron-main communication
		this.channel = this.mainProcessService.getChannel('void-channel-xlsx-extractor');
	}

	async extractContent(uri: URI): Promise<string> {
		try {
			const result = await this.channel.call('extractXLSXContent', {
				uri: uri.toJSON(),
				allSheets: true
			}) as { text: string };
			return result.text || '';
		} catch (error) {
			console.error('Failed to extract XLSX content:', error);
			return '';
		}
	}
}
