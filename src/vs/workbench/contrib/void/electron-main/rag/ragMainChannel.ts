/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { Event } from '../../../../../base/common/event.js';
import { URI, UriComponents } from '../../../../../base/common/uri.js';
import { IChannel, IServerChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { ContextPack, IRAGMainService, RAGIndexParams, RAGSearchParams, RAGStats } from '../../common/rag/ragServiceTypes.js';

// Debug file logging to verify main process receives IPC
const DEBUG_LOG_PATH = path.join(process.env.APPDATA || '', 'Safe Appeals Navigator', 'User', '.safe-appeals-navigator', 'rag-debug.log');

function debugLog(message: string): void {
	const timestamp = new Date().toISOString();
	const logLine = `[${timestamp}] ${message}\n`;
	console.log(`[RAG IPC] ${message}`);
	try {
		fs.appendFileSync(DEBUG_LOG_PATH, logLine);
	} catch (e) {
		// Ignore file write errors
	}
}

export class RAGMainChannel implements IServerChannel {
	constructor(private service: IRAGMainService) {
		debugLog('RAGMainChannel CONSTRUCTOR called - v2.0 MICRO DATABASE mode (no global DB)');
	}

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	call(ctx: any, command: string, args?: any): Promise<any> {
		// Log all incoming IPC calls with their workspaceId for debugging
		const workspaceId = args?.workspaceId;

		// MICRO DATABASE ARCHITECTURE - workspaceId is REQUIRED for most operations
		// Commands that require workspaceId to access per-workspace micro databases
		const requiresWorkspaceId = ['indexDocument', 'search', 'getStats', 'deleteDocument', 'isDocumentIndexed', 'getDocumentsByType', 'switchWorkspace', 'clearAllEmbeddings'];

		if (requiresWorkspaceId.includes(command) && (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null')) {
			const error = `IPC ERROR: ${command} requires workspaceId but received: "${workspaceId}". No global database is allowed.`;
			debugLog(error);
			return Promise.reject(new Error(error));
		}

		debugLog(`IPC CALL: ${command} | workspaceId: "${workspaceId || 'N/A'}" | micro-db: ${workspaceId ? 'workspace-specific' : 'init/test'}`);

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
				// workspaceId is REQUIRED
				return this.service.getStats(args?.workspaceId);
			case 'deleteDocument':
				// workspaceId is REQUIRED - no legacy format support
				return this.service.deleteDocument(args?.docId, args?.workspaceId);
			case 'isDocumentIndexed':
				if (args && args.uri) {
					args.uri = URI.revive(args.uri as UriComponents);
				}
				// workspaceId is REQUIRED
				console.log(`[RAG IPC] isDocumentIndexed - workspaceId: "${args?.workspaceId}", uri: "${args?.uri?.fsPath}"`);
				return this.service.isDocumentIndexed(args.uri, args?.workspaceId);
			case 'getDocumentsByType':
				// workspaceId is REQUIRED - no legacy format support
				return this.service.getDocumentsByType(args?.isPolicyManual, args?.workspaceId);
			case 'initialize':
				// Pass the openAIApiKey from browser to main process (legacy - not required anymore)
				console.log(`[RAG IPC] ========== initialize called (v2.0 per-workspace mode) ==========`);
				return this.service.initialize(args?.openAIApiKey);
			case 'switchWorkspace':
				console.log(`[RAG IPC] switchWorkspace received args:`, JSON.stringify(args));
				const wsId = args?.workspaceId;
				console.log(`[RAG IPC] switchWorkspace extracted workspaceId: "${wsId}" (type: ${typeof wsId})`);
				return this.service.switchWorkspace(wsId);
			case 'clearAllEmbeddings':
				// workspaceId is REQUIRED
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

	async getStats(workspaceId: string): Promise<RAGStats> {
		return this.channel.call('getStats', { workspaceId });
	}

	async deleteDocument(docId: string, workspaceId: string): Promise<void> {
		return this.channel.call('deleteDocument', { docId, workspaceId });
	}

	async isDocumentIndexed(uri: URI, workspaceId: string): Promise<boolean> {
		return this.channel.call('isDocumentIndexed', { uri: uri.toJSON(), workspaceId });
	}

	async getDocumentsByType(isPolicyManual: boolean, workspaceId: string): Promise<any[]> {
		return this.channel.call('getDocumentsByType', { isPolicyManual, workspaceId });
	}

	async initialize(): Promise<void> {
		return this.channel.call('initialize');
	}

	async switchWorkspace(workspaceId: string): Promise<void> {
		return this.channel.call('switchWorkspace', { workspaceId });
	}

	async clearAllEmbeddings(workspaceId: string): Promise<{ success: boolean; message: string }> {
		return this.channel.call('clearAllEmbeddings', { workspaceId });
	}
}
