/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

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
	workspaceId: string; // REQUIRED - each document belongs to exactly one workspace's micro database
}

export interface ChunkRecord {
	chunkId: string;
	docId: string;
	text: string;
	chunkIndex: number;
	embedding?: Float32Array;
	tokens?: number;
	// Hierarchical chunking metadata
	sectionId?: string;        // e.g., "policy.eligibility.3.2.1"
	parentSection?: string;    // e.g., "policy.eligibility"
	sectionNumber?: string;    // e.g., "3.2.1"
	sectionTitle?: string;     // e.g., "Age Requirements"
	breadcrumbPath?: string[]; // e.g., ["Policy Manual", "Eligibility", "Age Requirements"]
	chunkType?: 'child' | 'parent'; // Child (300 tokens) or parent (800 tokens)
	parentChunkId?: string;    // Reference to parent chunk for context
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
	workspaceId: string; // REQUIRED - each workspace has its own isolated database
}

export interface RAGIndexParams {
	uri: URI;
	isPolicyManual: boolean;
	workspaceId: string; // REQUIRED - each workspace has its own isolated database
	indexScope?: 'policy_manual' | 'case_index'; // Explicit index target
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

// Storage scope types (all scoped to current workspace)
// Includes legacy values for backwards compatibility
export type RAGStorageScope =
	| 'policy_manual'   // Only policy manuals for THIS workspace
	| 'case_index'      // Only case files for THIS workspace (renamed from workspace_docs)
	| 'workspace_all'   // Both policy + case for THIS workspace (renamed from 'both')
	| 'workspace_docs'  // Legacy alias for 'case_index'
	| 'both';           // Legacy alias for 'workspace_all'
export type RAGVectorBackend = 'chroma-http' | 'sqlite-vec';
export type RAGOpenAIModel = 'text-embedding-3-small' | 'text-embedding-3-large';

// ========== MICRO DATABASE ARCHITECTURE ==========
// Each workspace has its own isolated "micro database" consisting of:
//   1. SQLite database (workspace.db) - document metadata and chunks
//   2. Vector database (chroma/embeddings.db) - embeddings for semantic search
//   3. Email database (emails.db) - email metadata and content
//
// This architecture ensures:
//   - Complete data isolation between cases (no cross-contamination)
//   - HIPAA/legal confidentiality compliance
//   - Each case can be independently backed up, migrated, or deleted
//   - NO global database exists - workspaceId is REQUIRED for ALL operations
// ================================================

// Main service interface (implemented in electron-main)
export const IRAGMainService = createDecorator<IRAGMainService>('ragMainService');

export interface IRAGMainService {
	readonly _serviceBrand: undefined;

	// ALL methods require workspaceId - each workspace has its own isolated MICRO DATABASE
	// NO global database exists - workspaceId is REQUIRED for all operations
	// This prevents documents from one case leaking into another case
	indexDocument(params: RAGIndexParams): Promise<{ success: boolean; message: string }>;
	search(params: RAGSearchParams): Promise<ContextPack>;
	getStats(workspaceId: string): Promise<RAGStats>;
	deleteDocument(docId: string, workspaceId: string): Promise<void>;
	isDocumentIndexed(uri: URI, workspaceId: string): Promise<boolean>;
	getDocumentsByType(isPolicyManual: boolean, workspaceId: string): Promise<any[]>;
	initialize(openAIApiKey?: string): Promise<void>;
	switchWorkspace(workspaceId: string): Promise<void>;
	clearAllEmbeddings(workspaceId: string): Promise<{ success: boolean; message: string }>;
	testDoclingExtraction(uri: URI): Promise<{ standard: any; docling: any; doclingError?: any }>;

	// Document creation methods (delegated to fileService)
	createEmptyDOCX(uri: URI): Promise<void>;
	createEmptyXLSX(uri: URI): Promise<void>;

	// Document editing methods (delegated to fileService)
	editDOCX(uri: URI, operations: Array<{
		type: 'insert_text' | 'replace_text';
		position?: number;
		text?: string;
		search?: string;
		replace?: string;
		all?: boolean;
	}>): Promise<{ success: boolean; message: string }>;

	editXLSX(uri: URI, operations: Array<{
		type: 'set_cell_value' | 'set_cell_formula';
		sheet: string | number;
		cell: string;
		value?: any;
		formula?: string;
	}>): Promise<{ success: boolean; message: string }>;
}
