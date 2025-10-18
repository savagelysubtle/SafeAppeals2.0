/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export interface DocumentRecord {
	id: string;
	filename: string;
	filepath: string;
	filetype: string;
	filesize: number;
	uploadedAt: string;
	lastIndexed: string;
	checksum?: string;
	metadata?: string; // JSON string of additional metadata
	isPolicyManual?: boolean;
	workspaceId?: string;
}

export interface ChunkRecord {
	chunkId: string;
	docId: string;
	text: string;
	chunkIndex: number;
	embedding?: Float32Array;
	tokens?: number;
}

export interface PolicySection {
	sectionId: string;
	title: string;
	level: number;
	parentId?: string;
	docId: string;
	pageNumber?: number;
	chunkIds: string[];
}

export interface WorkspaceConfig {
	id: string;
	name: string;
	rootPath: string;
	folderStructure: string; // JSON string of folder organization rules
	lastOrganized: string;
	totalDocuments: number;
	indexedDocuments: number;
}

export interface SearchResult {
	docId: string;
	chunkId: string;
	score: number;
	snippet: string;
	source: {
		filename: string;
		filetype: string;
		chunkIndex: number;
		isPolicyManual: boolean;
	};
}

export interface ContextPack {
	answerContext: string;
	attributions: Array<{
		docId: string;
		chunkId: string;
		filename: string;
		rangeHint: string;
		score: number;
	}>;
	totalResults: number;
	responseTime: number;
}

export interface ExtractedContent {
	text: string;
	metadata: {
		pageCount?: number;
		wordCount?: number;
		language?: string;
		author?: string;
		title?: string;
		createdDate?: Date;
		modifiedDate?: Date;
	};
}

export interface RAGSearchParams {
	query: string;
	scope: RAGStorageScope;
	limit: number;
	workspaceId?: string;
}

export interface RAGIndexParams {
	uri: URI;
	isPolicyManual: boolean;
	workspaceId?: string;
}

export interface RAGStats {
	documents: Array<{
		filetype: string;
		typeCount: number;
		totalSize: number;
	}>;
	chunks: {
		totalChunks: number;
		avgTokens: number;
	};
	totalDocuments: number;
	totalSize: number;
}

export type RAGStorageScope = 'policy_manual' | 'workspace_docs' | 'both';
export type RAGVectorBackend = 'chroma-http' | 'sqlite-vec';
export type RAGOpenAIModel = 'text-embedding-3-small' | 'text-embedding-3-large';

// Main service interface (implemented in electron-main)
export const IRAGMainService = createDecorator<IRAGMainService>('ragMainService');

export interface IRAGMainService {
	readonly _serviceBrand: undefined;

	indexDocument(params: RAGIndexParams): Promise<{ success: boolean; message: string }>;
	search(params: RAGSearchParams): Promise<ContextPack>;
	getStats(): Promise<RAGStats>;
	deleteDocument(docId: string): Promise<void>;
	isDocumentIndexed(uri: URI): Promise<boolean>;
	getDocumentsByType(isPolicyManual: boolean): Promise<any[]>;
	initialize(openAIApiKey?: string): Promise<void>;
	clearAllEmbeddings(): Promise<{ success: boolean; message: string }>;
}
