/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
export const IRAGService = createDecorator('ragService');
export class RAGService {
    mainProcessService;
    settingsService;
    _serviceBrand;
    channel;
    constructor(mainProcessService, settingsService) {
        this.mainProcessService = mainProcessService;
        this.settingsService = settingsService;
        this.channel = this.mainProcessService.getChannel('void-channel-rag');
    }
    async indexDocument(params) {
        // Serialize URI to JSON for IPC
        return this.channel.call('indexDocument', { ...params, uri: params.uri.toJSON() });
    }
    async search(params) {
        return this.channel.call('search', params);
    }
    async getStats() {
        return this.channel.call('getStats');
    }
    async deleteDocument(uriOrDocId) {
        let docId;
        if (typeof uriOrDocId === 'string') {
            docId = uriOrDocId;
        }
        else {
            // Generate document ID from URI
            const crypto = await import('crypto');
            docId = crypto.createHash('sha256').update(uriOrDocId.fsPath).digest('hex').substring(0, 16);
        }
        return this.channel.call('deleteDocument', { docId });
    }
    async isDocumentIndexed(uri) {
        return this.channel.call('isDocumentIndexed', { uri: uri.toJSON() });
    }
    async getDocumentsByType(isPolicyManual) {
        return this.channel.call('getDocumentsByType', { isPolicyManual });
    }
    async initialize() {
        // Pass OpenAI API key from settings to main process
        const apiKey = this.settingsService.state.settingsOfProvider.openAI.apiKey || '';
        return this.channel.call('initialize', { openAIApiKey: apiKey });
    }
    async clearAllEmbeddings() {
        return this.channel.call('clearAllEmbeddings');
    }
}
registerSingleton(IRAGService, RAGService, 0 /* InstantiationType.Eager */);
