/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../../base/common/uri.js';
import { IChannel } from '../../../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../../../platform/ipc/common/mainProcessService.js';
import { DocumentContentExtractor } from '../../../common/documentViewerService.js';

/**
 * Extracts DOCX text content using electron-main via IPC
 */
export class DOCXContentExtractor implements DocumentContentExtractor {
	private readonly channel: IChannel;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService
	) {
		// Get the channel for electron-main communication
		this.channel = this.mainProcessService.getChannel('void-channel-docx-extractor');
	}

	async extractContent(uri: URI): Promise<string> {
		try {
			const result = await this.channel.call('extractDOCXContent', {
				uri: uri.toJSON(),
				allPages: true
			}) as { text: string };
			return result.text || '';
		} catch (error) {
			console.error('Failed to extract DOCX content:', error);
			return '';
		}
	}
}

