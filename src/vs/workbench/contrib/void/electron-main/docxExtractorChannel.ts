/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { URI, UriComponents } from '../../../../base/common/uri.js';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IRAGMainService } from '../common/rag/ragServiceTypes.js';

export class DOCXExtractorChannel implements IServerChannel {
	constructor(private service: IRAGMainService) { }

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	async call(ctx: any, command: string, args?: any): Promise<any> {
		switch (command) {
			case 'extractDOCXContent':
				// Revive URI from serialized form
				if (args && args.uri) {
					const uri = typeof args.uri === 'string' ? URI.parse(args.uri) : URI.revive(args.uri as UriComponents);
					// Access the private fileService property
					const fileService = (this.service as any).fileService;
					if (!fileService) {
						throw new Error('fileService not available in RAGMainService');
					}
					if (args.allPages) {
						const result = await fileService.extractContent(uri);
						return { text: result.text };
					}
				}
				throw new Error('Invalid arguments for extractDOCXContent');
			default:
				throw new Error(`Call not found: ${command}`);
		}
	}
}

