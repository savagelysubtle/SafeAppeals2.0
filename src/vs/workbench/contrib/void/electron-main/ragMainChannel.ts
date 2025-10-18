/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IServerChannel, IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Event } from '../../../../base/common/event.js';
import { IRAGMainService, RAGIndexParams, RAGSearchParams, ContextPack, RAGStats } from '../common/ragServiceTypes.js';
import { URI, UriComponents } from '../../../../base/common/uri.js';

export class RAGMainChannel implements IServerChannel {
	constructor(private service: IRAGMainService) { }

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	call(ctx: any, command: string, args?: any): Promise<any> {
		switch (command) {
			case 'indexDocument':
				// Revive URI from serialized form
				if (args && args.uri) {
					args.uri = URI.revive(args.uri as UriComponents);
				}
				return this.service.indexDocument(args);
			case 'search':
				return this.service.search(args);
			case 'getStats':
				return this.service.getStats();
			case 'deleteDocument':
				return this.service.deleteDocument(args);
			case 'isDocumentIndexed':
				if (args && args.uri) {
					args.uri = URI.revive(args.uri as UriComponents);
				}
				return this.service.isDocumentIndexed(args);
			case 'getDocumentsByType':
				return this.service.getDocumentsByType(args);
			case 'initialize':
				// Pass the openAIApiKey from browser to main process
				return this.service.initialize(args?.openAIApiKey);
			case 'clearAllEmbeddings':
				return this.service.clearAllEmbeddings();
			default:
				throw new Error(`Call not found: ${command}`);
		}
	}
}

export class RAGMainChannelClient {
	constructor(private readonly channel: IChannel) { }

	async indexDocument(params: RAGIndexParams): Promise<{ success: boolean; message: string }> {
		return this.channel.call('indexDocument', params);
	}

	async search(params: RAGSearchParams): Promise<ContextPack> {
		return this.channel.call('search', params);
	}

	async getStats(): Promise<RAGStats> {
		return this.channel.call('getStats');
	}

	async deleteDocument(docId: string): Promise<void> {
		return this.channel.call('deleteDocument', { docId });
	}

	async isDocumentIndexed(uri: URI): Promise<boolean> {
		return this.channel.call('isDocumentIndexed', { uri: uri.toString() });
	}

	async getDocumentsByType(isPolicyManual: boolean): Promise<any[]> {
		return this.channel.call('getDocumentsByType', { isPolicyManual });
	}

	async initialize(): Promise<void> {
		return this.channel.call('initialize');
	}
}
