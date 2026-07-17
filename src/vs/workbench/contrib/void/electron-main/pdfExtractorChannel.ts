/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Event } from '../../../../base/common/event.js';
import { IRAGMainService } from '../common/rag/ragServiceTypes.js';
import { URI, UriComponents } from '../../../../base/common/uri.js';

export class PDFExtractorChannel implements IServerChannel {
	constructor(private service: IRAGMainService) { }

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	async call(ctx: any, command: string, args?: any): Promise<any> {
		switch (command) {
			case 'extractPDFContent':
				console.log('[PDFExtractorChannel] extractPDFContent called with args:', JSON.stringify(args));
				// Revive URI from serialized form
				if (args && args.uri) {
					const uri = typeof args.uri === 'string' ? URI.parse(args.uri) : URI.revive(args.uri as UriComponents);
					// Access the private fileService property
					const fileService = (this.service as any).fileService;
					if (!fileService) {
						throw new Error('fileService not available in RAGMainService');
					}

					// Debug: Check if file converter is set
					console.log('[PDFExtractorChannel] fileService.fileConverter set:', !!fileService.fileConverter);
					console.log('[PDFExtractorChannel] fileService.enableAutoOCR:', fileService.enableAutoOCR);

					if (args.allPages) {
						console.log('[PDFExtractorChannel] Extracting all pages...');
						const result = await fileService.extractContent(uri);
						console.log('[PDFExtractorChannel] Extraction result:', {
							textLength: result.text?.length,
							wasOCR: result.wasOCR,
							ocrLanguage: result.ocrLanguage,
							pageCount: result.metadata?.pageCount
						});
						return {
							text: result.text,
							pageCount: result.metadata?.pageCount,
							title: result.metadata?.title,
							author: result.metadata?.author,
							wasOCR: result.wasOCR ?? false,
							ocrLanguage: result.ocrLanguage
						};
					} else if (typeof args.startPage === 'number' && typeof args.endPage === 'number') {
						const result = await fileService.extractPDFPages(uri, args.startPage, args.endPage);
						return {
							text: result.text,
							pageCount: result.metadata?.pageCount,
							title: result.metadata?.title,
							author: result.metadata?.author,
							wasOCR: result.wasOCR ?? false,
							ocrLanguage: result.ocrLanguage
						};
					}
				}
				throw new Error('Invalid arguments for extractPDFContent');
			default:
				throw new Error(`Call not found: ${command}`);
		}
	}
}

