/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { RAGIndexParams, RAGSearchParams, RAGStats, ContextPack } from './ragServiceTypes.js';
import { IVoidSettingsService } from './voidSettingsService.js';

export interface IRAGService {
	readonly _serviceBrand: undefined;

	indexDocument(params: RAGIndexParams): Promise<{ success: boolean; message: string }>;
	search(params: RAGSearchParams): Promise<ContextPack>;
	getStats(): Promise<RAGStats>;
	deleteDocument(uriOrDocId: URI | string): Promise<void>;
	isDocumentIndexed(uri: URI): Promise<boolean>;
	getDocumentsByType(isPolicyManual: boolean): Promise<any[]>;
	initialize(): Promise<void>;
	clearAllEmbeddings(): Promise<{ success: boolean; message: string }>;
}

export const IRAGService = createDecorator<IRAGService>('ragService');

export class RAGService implements IRAGService {
	readonly _serviceBrand: undefined;

	private readonly channel: IChannel;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService
	) {
		this.channel = this.mainProcessService.getChannel('void-channel-rag');
	}

	async indexDocument(params: RAGIndexParams): Promise<{ success: boolean; message: string }> {
		// Serialize URI to JSON for IPC
		return this.channel.call('indexDocument', { ...params, uri: params.uri.toJSON() });
	}

	async search(params: RAGSearchParams): Promise<ContextPack> {
		return this.channel.call('search', params);
	}

	async getStats(): Promise<RAGStats> {
		return this.channel.call('getStats');
	}

	async deleteDocument(uriOrDocId: URI | string): Promise<void> {
		let docId: string;
		if (typeof uriOrDocId === 'string') {
			docId = uriOrDocId;
		} else {
			// Generate document ID from URI
			const crypto = await import('crypto');
			docId = crypto.createHash('sha256').update(uriOrDocId.fsPath).digest('hex').substring(0, 16);
		}
		return this.channel.call('deleteDocument', { docId });
	}

	async isDocumentIndexed(uri: URI): Promise<boolean> {
		return this.channel.call('isDocumentIndexed', { uri: uri.toJSON() });
	}

	async getDocumentsByType(isPolicyManual: boolean): Promise<any[]> {
		return this.channel.call('getDocumentsByType', { isPolicyManual });
	}

	async initialize(): Promise<void> {
		// Pass OpenAI API key from settings to main process
		const apiKey = this.settingsService.state.settingsOfProvider.openAI.apiKey || '';
		return this.channel.call('initialize', { openAIApiKey: apiKey });
	}

	async clearAllEmbeddings(): Promise<{ success: boolean; message: string }> {
		return this.channel.call('clearAllEmbeddings');
	}
}

registerSingleton(IRAGService, RAGService, InstantiationType.Eager);
