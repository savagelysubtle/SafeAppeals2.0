/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { URI, UriComponents } from '../../../../../base/common/uri.js';
import { IChannel, IServerChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { ContextPack, IRAGMainService, RAGIndexParams, RAGSearchParams, RAGStats } from '../../common/rag/ragServiceTypes.js';

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
				// Pass workspaceId if provided
				return this.service.getStats(args?.workspaceId);
			case 'deleteDocument':
				// Handle both old format (string) and new format (object with docId and workspaceId)
				if (typeof args === 'string') {
					return this.service.deleteDocument(args);
				}
				return this.service.deleteDocument(args?.docId, args?.workspaceId);
			case 'isDocumentIndexed':
				if (args && args.uri) {
					args.uri = URI.revive(args.uri as UriComponents);
				}
				return this.service.isDocumentIndexed(args.uri, args?.workspaceId);
			case 'getDocumentsByType':
				// Handle both old format (boolean) and new format (object)
				if (typeof args === 'boolean') {
					return this.service.getDocumentsByType(args);
				}
				return this.service.getDocumentsByType(args?.isPolicyManual, args?.workspaceId);
			case 'initialize':
				// Pass the openAIApiKey from browser to main process
				return this.service.initialize(args?.openAIApiKey);
			case 'switchWorkspace':
				return this.service.switchWorkspace(args?.workspaceId);
			case 'clearAllEmbeddings':
				// Pass workspaceId if provided
				return this.service.clearAllEmbeddings(args?.workspaceId);
			case 'testDoclingExtraction':
				// Revive URI from serialized form
				if (args && args.uri) {
					args.uri = URI.revive(args.uri as UriComponents);
				}
				return this.service.testDoclingExtraction(args.uri);
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

	async getStats(workspaceId?: string): Promise<RAGStats> {
		return this.channel.call('getStats', { workspaceId });
	}

	async deleteDocument(docId: string, workspaceId?: string): Promise<void> {
		return this.channel.call('deleteDocument', { docId, workspaceId });
	}

	async isDocumentIndexed(uri: URI, workspaceId?: string): Promise<boolean> {
		return this.channel.call('isDocumentIndexed', { uri: uri.toJSON(), workspaceId });
	}

	async getDocumentsByType(isPolicyManual: boolean, workspaceId?: string): Promise<any[]> {
		return this.channel.call('getDocumentsByType', { isPolicyManual, workspaceId });
	}

	async initialize(): Promise<void> {
		return this.channel.call('initialize');
	}

	async switchWorkspace(workspaceId: string): Promise<void> {
		return this.channel.call('switchWorkspace', { workspaceId });
	}

	async clearAllEmbeddings(workspaceId?: string): Promise<{ success: boolean; message: string }> {
		return this.channel.call('clearAllEmbeddings', { workspaceId });
	}
}
