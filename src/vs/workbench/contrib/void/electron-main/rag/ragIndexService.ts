/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { Database } from '@vscode/sqlite3';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { URI } from '../../../../../base/common/uri.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IRAGPathService } from '../../common/rag/ragPathService.js';
import { ChunkRecord, DocumentRecord, ExtractedContent, RAGStats, RAGStorageScope, SearchResult } from '../../common/rag/ragServiceTypes.js';

export interface IndexDocumentParams {
	uri: URI;
	isPolicyManual: boolean;
	workspaceId: string; // REQUIRED - each workspace has its own isolated micro database
	content: string;
	metadata: ExtractedContent['metadata'];
}

// Document structure interfaces for hierarchical chunking
interface DocumentSection {
	id: string;
	number: string;      // e.g., "3.2.1"
	title: string;       // e.g., "Age Requirements"
	level: number;       // 1 = top-level, 2 = subsection, etc.
	startIndex: number;  // Character position in text
	endIndex: number;    // Character position in text
	parentId?: string;   // Parent section ID
	text: string;        // Section content
}

interface DocumentStructure {
	sections: DocumentSection[];
	breadcrumbs: Map<string, string[]>; // sectionId -> breadcrumb path
}

export class RAGIndexService {
	private db: Database | null = null;
	private static readonly CURRENT_SCHEMA_VERSION = 2; // Increment when schema changes
	private readonly workspaceId: string; // REQUIRED - no global database allowed

	constructor(
		@ILogService private readonly logService: ILogService,
		@IRAGPathService private readonly pathService: IRAGPathService,
		workspaceId: string // REQUIRED - each workspace must have its own micro database
	) {
		// Validate workspaceId - NO global fallback allowed
		if (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null' || workspaceId.trim() === '') {
			throw new Error('RAGIndexService: workspaceId is REQUIRED. Each workspace must have its own isolated micro database. No global database is allowed.');
		}
		this.workspaceId = workspaceId;
	}

	async initialize(): Promise<void> {
		if (this.db) return;

		try {
			// ALWAYS use workspace-specific path - NO global database
			const dbPath = this.pathService.getWorkspaceSqlitePath(this.workspaceId);
			this.logService.info(`RAG: Initializing SQLite micro database for workspace: ${this.workspaceId}`);
			this.logService.info(`RAG: Database path: ${dbPath}`);

			// Ensure parent directory exists
			const fs = await import('fs');
			const path = await import('path');
			const parentDir = path.dirname(dbPath);

			if (!fs.existsSync(parentDir)) {
				this.logService.info(`RAG: Creating workspace database directory: ${parentDir}`);
				fs.mkdirSync(parentDir, { recursive: true });
			}

			// Use createRequire() for reliable native module loading (recommended pattern)
			// See: https://nodejs.org/api/module.html#modulecreaterequirefilename
			const require = createRequire(import.meta.url);
			const sqlite3 = require('@vscode/sqlite3');

			this.db = new sqlite3.Database(dbPath);
			this.logService.info(`RAG: Micro database initialized for workspace ${this.workspaceId}`);

		await this.createTables();
		this.logService.info('RAG index service initialized');
		} catch (error) {
			this.logService.error('RAG: Failed to initialize SQLite database:', error);
			throw error;
		}
	}

	private async createTables(): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const createDocumentsTable = `
			CREATE TABLE IF NOT EXISTS documents (
				id TEXT PRIMARY KEY,
				filename TEXT NOT NULL,
				filepath TEXT NOT NULL,
				filetype TEXT NOT NULL,
				filesize INTEGER NOT NULL,
				uploaded_at TEXT NOT NULL,
				last_indexed TEXT NOT NULL,
				checksum TEXT,
				metadata TEXT,
				is_policy_manual BOOLEAN NOT NULL DEFAULT 0,
				workspace_id TEXT
			)
		`;

		const createChunksTable = `
			CREATE TABLE IF NOT EXISTS chunks (
				chunk_id TEXT PRIMARY KEY,
				doc_id TEXT NOT NULL,
				text TEXT NOT NULL,
				chunk_index INTEGER NOT NULL,
				tokens INTEGER,
			section_id TEXT,
			parent_section TEXT,
			section_number TEXT,
			section_title TEXT,
			breadcrumb_path TEXT,
			chunk_type TEXT CHECK(chunk_type IN ('child', 'parent')),
			parent_chunk_id TEXT,
			FOREIGN KEY (doc_id) REFERENCES documents (id) ON DELETE CASCADE,
			FOREIGN KEY (parent_chunk_id) REFERENCES chunks (chunk_id) ON DELETE SET NULL
			)
		`;

		const createIndexes = `
			CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
			CREATE INDEX IF NOT EXISTS idx_documents_policy ON documents(is_policy_manual);
			CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);
		CREATE INDEX IF NOT EXISTS idx_chunks_section ON chunks(section_id);
		CREATE INDEX IF NOT EXISTS idx_chunks_type ON chunks(chunk_type);
		CREATE INDEX IF NOT EXISTS idx_chunks_parent ON chunks(parent_chunk_id);
	`;

		// FTS5 virtual table for keyword search
		const createFTSTable = `
			CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
				chunk_id UNINDEXED,
				text,
				content='chunks',
				content_rowid='rowid'
			)
		`;

		// Triggers to keep FTS index in sync with chunks table
		const createFTSTriggers = `
			CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
				INSERT INTO chunks_fts(rowid, chunk_id, text)
				VALUES (new.rowid, new.chunk_id, new.text);
			END;

			CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
				DELETE FROM chunks_fts WHERE rowid = old.rowid;
			END;

			CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
				UPDATE chunks_fts SET text = new.text WHERE rowid = old.rowid;
			END;
		`;

		await new Promise<void>((resolve, reject) => {
			this.db!.exec(createDocumentsTable, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		await new Promise<void>((resolve, reject) => {
			this.db!.exec(createChunksTable, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		await new Promise<void>((resolve, reject) => {
			this.db!.exec(createIndexes, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		// Create FTS5 table
		await new Promise<void>((resolve, reject) => {
			this.db!.exec(createFTSTable, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		// Create FTS5 triggers
		await new Promise<void>((resolve, reject) => {
			this.db!.exec(createFTSTriggers, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

	this.logService.info('Created FTS5 virtual table and triggers for keyword search');

		// Check current schema version and migrate if needed
		const currentVersion = await this.getSchemaVersion();
		this.logService.info(`Current schema version: ${currentVersion}`);

		if (currentVersion < RAGIndexService.CURRENT_SCHEMA_VERSION) {
			this.logService.info(`Migrating schema from v${currentVersion} to v${RAGIndexService.CURRENT_SCHEMA_VERSION}`);
			await this.migrateSchema(currentVersion);
		}
}

/**
 * Get current schema version from database
 */
private async getSchemaVersion(): Promise<number> {
	if (!this.db) return 0;

	try {
		// Check if schema_version table exists
		const tableExists = await new Promise<boolean>((resolve) => {
			this.db!.get(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'",
				(err, row) => {
					resolve(!!row);
				}
			);
		});

		if (!tableExists) {
			// Create schema_version table
			await new Promise<void>((resolve, reject) => {
				this.db!.run(
					'CREATE TABLE schema_version (version INTEGER PRIMARY KEY)',
					(err) => {
						if (err) reject(err);
						else resolve();
					}
				);
			});

			// Insert current version (2) for new databases since we create tables with latest schema
			await new Promise<void>((resolve, reject) => {
				this.db!.run('INSERT INTO schema_version (version) VALUES (2)', (err) => {
					if (err) reject(err);
					else resolve();
				});
			});

			return 2;
		}

		// Get current version
		const version = await new Promise<number>((resolve, reject) => {
			this.db!.get('SELECT version FROM schema_version LIMIT 1', (err, row: any) => {
				if (err) reject(err);
				else resolve(row?.version || 1);
			});
		});

		return version;
	} catch (error) {
		this.logService.error('Failed to get schema version:', error);
		return 1; // Assume version 1 if error
	}
}

/**
 * Migrate database schema from old version to current
 */
private async migrateSchema(fromVersion: number): Promise<void> {
	if (!this.db) throw new Error('Database not initialized');

	this.logService.info(`Starting schema migration from version ${fromVersion}`);

	try {
		// Migration from v1 to v2: Add hierarchical chunking columns
		if (fromVersion < 2) {
			this.logService.info('Migrating to schema v2: Adding hierarchical chunking columns');

			// Check if columns already exist
			const hasNewColumns = await this.checkColumnExists('chunks', 'section_id');

			if (!hasNewColumns) {
				// Add new columns to chunks table
				const alterStatements = [
					'ALTER TABLE chunks ADD COLUMN section_id TEXT',
					'ALTER TABLE chunks ADD COLUMN parent_section TEXT',
					'ALTER TABLE chunks ADD COLUMN section_number TEXT',
					'ALTER TABLE chunks ADD COLUMN section_title TEXT',
					'ALTER TABLE chunks ADD COLUMN breadcrumb_path TEXT',
					'ALTER TABLE chunks ADD COLUMN chunk_type TEXT CHECK(chunk_type IN (\'child\', \'parent\'))',
					'ALTER TABLE chunks ADD COLUMN parent_chunk_id TEXT',
				];

				for (const statement of alterStatements) {
					await new Promise<void>((resolve, reject) => {
						this.db!.run(statement, (err) => {
							if (err) reject(err);
							else resolve();
						});
					});
				}

				// Create new indexes
				const indexStatements = [
					'CREATE INDEX IF NOT EXISTS idx_chunks_section ON chunks(section_id)',
					'CREATE INDEX IF NOT EXISTS idx_chunks_type ON chunks(chunk_type)',
					'CREATE INDEX IF NOT EXISTS idx_chunks_parent ON chunks(parent_chunk_id)',
				];

				for (const statement of indexStatements) {
					await new Promise<void>((resolve, reject) => {
						this.db!.run(statement, (err) => {
							if (err) reject(err);
							else resolve();
						});
					});
				}

				this.logService.info('Successfully added hierarchical chunking columns');
			} else {
				this.logService.info('Hierarchical chunking columns already exist, skipping ALTER');
			}

			// Update schema version
			await new Promise<void>((resolve, reject) => {
				this.db!.run('UPDATE schema_version SET version = 2', (err) => {
					if (err) reject(err);
					else resolve();
				});
			});

			this.logService.info('Schema migration to v2 complete');
		}

		// Future migrations go here
		// if (fromVersion < 3) { ... }

	} catch (error) {
		this.logService.error('Schema migration failed:', error);
		throw error;
	}
}

/**
 * Check if a column exists in a table
 */
private async checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
	if (!this.db) return false;

	return new Promise((resolve) => {
		this.db!.all(`PRAGMA table_info(${tableName})`, (err, rows: any[]) => {
			if (err || !rows) {
				resolve(false);
				return;
			}

			const columnExists = rows.some(row => row.name === columnName);
			resolve(columnExists);
			});
		});
	}

	async indexDocument(params: IndexDocumentParams): Promise<{ docId: string; chunks: ChunkRecord[] }> {
		if (!this.db) throw new Error('Database not initialized');

		const docId = this.generateDocumentId(params.uri);
		const checksum = this.calculateChecksum(params.uri);
		const now = new Date().toISOString();

		// Get filepath safely
		const filepath = params.uri.fsPath || params.uri.path || '';
		if (!filepath) {
			throw new Error('Invalid URI: no path available');
		}

		// Check if document already exists and if checksum changed
		const existingDoc = await this.getDocumentByPath(filepath);
		if (existingDoc && existingDoc.checksum === checksum) {
			this.logService.info(`Document ${filepath} already indexed with same checksum`);
			const chunks = await this.getChunksByDocId(existingDoc.id);
			return { docId: existingDoc.id, chunks };
		}

		// Delete existing chunks if document exists
		if (existingDoc) {
			await this.deleteDocument(existingDoc.id);
		}

		// Get filename safely
		const pathSegments = filepath.replace(/\\/g, '/').split('/');
		const filename = pathSegments[pathSegments.length - 1] || 'unknown';

		// Insert document
		const document: DocumentRecord = {
			id: docId,
			filename,
			filepath,
			filetype: this.getFileType(params.uri),
			filesize: params.content.length,
			uploadedAt: now,
			lastIndexed: now,
			checksum,
			metadata: JSON.stringify(params.metadata),
			isPolicyManual: params.isPolicyManual,
			workspaceId: params.workspaceId
		};

		await this.insertDocument(document);

		// Chunk the content
		this.logService.info(`Content length: ${params.content.length} characters`);
		const chunks = this.chunkText(params.content, docId);
		this.logService.info(`Generated ${chunks.length} chunks`);
		await this.insertChunks(chunks);

		this.logService.info(`Indexed document ${params.uri.fsPath} with ${chunks.length} chunks`);
		return { docId, chunks };
	}

	generateDocumentId(uri: URI): string {
		const path = uri.fsPath || uri.path;
		this.logService.info(`Generating document ID for: ${path}`);
		const docId = createHash('sha256').update(path).digest('hex').substring(0, 16);
		this.logService.info(`Generated document ID: ${docId}`);
		return docId;
	}

	private calculateChecksum(uri: URI): string {
		try {
			const content = readFileSync(uri.fsPath);
			return createHash('sha256').update(Uint8Array.from(content)).digest('hex');
		} catch (error) {
			this.logService.warn(`Could not calculate checksum for ${uri.fsPath}:`, error);
			return '';
		}
	}

	private getFileType(uri: URI): string {
		const filepath = uri.fsPath || uri.path || '';
		const ext = filepath.split('.').pop()?.toLowerCase() || '';
		return ext;
	}

	private async getDocumentByPath(filepath: string): Promise<DocumentRecord | null> {
		if (!this.db) return null;

		return new Promise((resolve, reject) => {
			this.db!.get(
				'SELECT * FROM documents WHERE filepath = ?',
				[filepath],
				(err, row) => {
					if (err) reject(err);
					else resolve(row as DocumentRecord || null);
				}
			);
		});
	}

	private async getChunksByDocId(docId: string): Promise<ChunkRecord[]> {
		if (!this.db) return [];

		return new Promise((resolve, reject) => {
			this.db!.all(
				'SELECT * FROM chunks WHERE doc_id = ? ORDER BY chunk_index',
				[docId],
				(err, rows) => {
					if (err) reject(err);
					else resolve(rows as ChunkRecord[]);
				}
			);
		});
	}

	async deleteDocument(docId: string): Promise<void> {
		if (!this.db) return;

		return new Promise((resolve, reject) => {
			this.db!.run('DELETE FROM documents WHERE id = ?', [docId], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async clearAll(): Promise<void> {
		if (!this.db) return;

		// Clear chunks first (foreign key constraint)
		// FTS5 table will be automatically cleared by DELETE trigger
		await new Promise<void>((resolve, reject) => {
			this.db!.run('DELETE FROM chunks', [], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		// Clear documents
		await new Promise<void>((resolve, reject) => {
			this.db!.run('DELETE FROM documents', [], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		// Explicitly clear FTS5 table (should already be empty due to trigger, but be safe)
		await new Promise<void>((resolve, reject) => {
			this.db!.run('DELETE FROM chunks_fts', [], (err) => {
				if (err) {
					// If FTS5 table doesn't exist yet, that's okay
					this.logService.warn('Could not clear FTS5 table (may not exist yet):', err);
					resolve();
				} else {
					resolve();
				}
			});
		});

		this.logService.info('Cleared all documents, chunks, and FTS5 index from SQLite');
	}

	private async insertDocument(document: DocumentRecord): Promise<void> {
		if (!this.db) return;

		return new Promise((resolve, reject) => {
			this.db!.run(
				`INSERT INTO documents (id, filename, filepath, filetype, filesize, uploaded_at, last_indexed, checksum, metadata, is_policy_manual, workspace_id)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					document.id,
					document.filename,
					document.filepath,
					document.filetype,
					document.filesize,
					document.uploadedAt,
					document.lastIndexed,
					document.checksum,
					document.metadata,
					document.isPolicyManual ? 1 : 0,
					document.workspaceId
				],
				(err) => {
					if (err) reject(err);
					else resolve();
				}
			);
		});
	}

	private async insertChunks(chunks: ChunkRecord[]): Promise<void> {
		if (!this.db || chunks.length === 0) return;

		const stmt = this.db.prepare(`
			INSERT INTO chunks (
				chunk_id, doc_id, text, chunk_index, tokens,
				section_id, parent_section, section_number, section_title,
				breadcrumb_path, chunk_type, parent_chunk_id
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);

		for (const chunk of chunks) {
			await new Promise<void>((resolve, reject) => {
				stmt.run([
					chunk.chunkId,
					chunk.docId,
					chunk.text,
					chunk.chunkIndex,
					chunk.tokens || null,
					chunk.sectionId || null,
					chunk.parentSection || null,
					chunk.sectionNumber || null,
					chunk.sectionTitle || null,
					chunk.breadcrumbPath ? JSON.stringify(chunk.breadcrumbPath) : null,
					chunk.chunkType || null,
					chunk.parentChunkId || null
				], (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
		}

		stmt.finalize();
	}

	private chunkText(text: string, docId: string, chunkSize: number = 1200, overlap: number = 200): ChunkRecord[] {
		// NEW: Hierarchical, token-based chunking for medical/legal documents
		// Research-backed parameters: 300 tokens (child), 800 tokens (parent), 15% overlap

		this.logService.info(`Starting hierarchical chunking for document ${docId}`);

		// Step 1: Parse document structure
		const structure = this.parseDocumentStructure(text, docId);

		if (structure.sections.length > 0) {
			this.logService.info(`Parsed ${structure.sections.length} sections from document`);

			// Step 2: Create hierarchical chunks (child + parent)
			const chunks = this.createHierarchicalChunks(text, docId, structure);
			this.logService.info(`Created ${chunks.length} hierarchical chunks (child + parent)`);
			return chunks;
		}

		// Fallback to legacy chunking if structure parsing fails
		this.logService.warn(`Structure parsing failed, falling back to legacy chunking`);
		return this.chunkTextLegacy(text, docId, chunkSize, overlap);
	}

	/**
	 * Parse document structure to identify sections, subsections, and hierarchy
	 * Detects medical/legal document patterns (Articles, Sections, Rules, etc.)
	 */
	private parseDocumentStructure(text: string, docId: string): DocumentStructure {
		const sections: DocumentSection[] = [];
		const breadcrumbs = new Map<string, string[]>();

		// Patterns for medical/legal document structure (from research)
		const sectionPatterns = [
			{ pattern: /^((?:\d+\.?)+)\s+([A-Z][^\n]+)/gm, type: 'numbered' },      // "3.2.1 Section Title"
			{ pattern: /^([A-Z]\.)\s+([A-Z][^\n]+)/gm, type: 'lettered' },          // "A. Title"
			{ pattern: /^\s*Chapter\s+(\d+)[:\s]+([^\n]+)/gim, type: 'chapter' },   // "Chapter 3: Title"
			{ pattern: /^\s*Section\s+([\d.]+)[:\s]+([^\n]+)/gim, type: 'section' }, // "Section 4.2: Title"
			{ pattern: /^\s*Article\s+([IVX\d]+)[:\s]+([^\n]+)/gim, type: 'article' }, // "Article IV: Title"
			{ pattern: /^\s*Rule\s+(\d+)[:\s]+([^\n]+)/gim, type: 'rule' },         // "Rule 12: Title"
			{ pattern: /^\s*Appendix\s+([A-Z\d]+)[:\s]*([^\n]*)/gim, type: 'appendix' }, // "Appendix B: Title"
		];

		// Find all section matches
		for (const { pattern, type } of sectionPatterns) {
			let match;
			while ((match = pattern.exec(text)) !== null) {
				const sectionNumber = match[1].trim();
				const sectionTitle = (match[2] || 'Untitled').trim();
				const startIndex = match.index;

				// Calculate section level based on number depth (e.g., "3.2.1" = level 3)
				const level = type === 'numbered'
					? sectionNumber.split('.').filter(n => n.length > 0).length
					: 1;

				const sectionId = `${docId}_${type}_${sectionNumber.replace(/\./g, '_')}`;

				sections.push({
					id: sectionId,
					number: sectionNumber,
					title: sectionTitle,
					level,
					startIndex,
					endIndex: -1, // Will be set later
					text: '', // Will be extracted later
				});
			}
		}

		// Sort sections by start index
		sections.sort((a, b) => a.startIndex - b.startIndex);

		// Set end indices and extract text
		for (let i = 0; i < sections.length; i++) {
			const section = sections[i];
			const nextSection = sections[i + 1];

			section.endIndex = nextSection ? nextSection.startIndex : text.length;
			section.text = text.slice(section.startIndex, section.endIndex).trim();

			// Determine parent section (find previous section with lower level)
			for (let j = i - 1; j >= 0; j--) {
				if (sections[j].level < section.level) {
					section.parentId = sections[j].id;
					break;
				}
			}
		}

		// Build breadcrumb paths
		for (const section of sections) {
			const path: string[] = [];
			let currentSection: DocumentSection | undefined = section;

			while (currentSection) {
				path.unshift(currentSection.title);
				currentSection = sections.find(s => s.id === currentSection!.parentId);
			}

			breadcrumbs.set(section.id, path);
		}

		this.logService.info(`Parsed ${sections.length} sections with hierarchy`);

		return { sections, breadcrumbs };
	}

	/**
	 * Create hierarchical chunks (child + parent) with metadata enrichment
	 * Child chunks: 300 tokens, Parent chunks: 800 tokens, 15% overlap
	 */
	private createHierarchicalChunks(text: string, docId: string, structure: DocumentStructure): ChunkRecord[] {
		const allChunks: ChunkRecord[] = [];
		const childTokens = 300;
		const parentTokens = 800;
		const overlapPercent = 15;

		// Global counter for unique chunk IDs
		let globalChunkCounter = 0;

		// Process each section
		for (const section of structure.sections) {
			// Create child chunks for this section
			const childChunks = this.createChildChunks(
				section.text,
				docId,
				section,
				structure.breadcrumbs.get(section.id) || [section.title],
				childTokens,
				overlapPercent,
				globalChunkCounter
			);

			globalChunkCounter += childChunks.length;

			// Create parent chunk for this section (if text is long enough)
			const parentChunk = this.createParentChunk(
				section.text,
				docId,
				section,
				structure.breadcrumbs.get(section.id) || [section.title],
				parentTokens,
				globalChunkCounter
			);

			if (parentChunk) {
				allChunks.push(parentChunk);
				globalChunkCounter++;

				// Link child chunks to parent
				for (const child of childChunks) {
					child.parentChunkId = parentChunk.chunkId;
				}
			}

			allChunks.push(...childChunks);
		}

		// Renumber all chunks sequentially
		for (let i = 0; i < allChunks.length; i++) {
			allChunks[i].chunkIndex = i;
		}

		return allChunks;
	}

	/**
	 * Create child chunks (300 tokens) for precise retrieval
	 */
	private createChildChunks(
		text: string,
		docId: string,
		section: DocumentSection,
		breadcrumbPath: string[],
		targetTokens: number,
		overlapPercent: number,
		startingIndex: number
	): ChunkRecord[] {
		const chunks: ChunkRecord[] = [];
		const targetChars = targetTokens * 4; // ~4 chars per token
		const overlapChars = Math.floor(targetChars * (overlapPercent / 100));

		// Split into sentences to respect boundaries
		const sentences = this.splitIntoSentences(text);

		let currentChunk = '';
		let chunkIndex = 0;

		for (let i = 0; i < sentences.length; i++) {
			const sentence = sentences[i];

			// Check if adding this sentence exceeds target
			if (currentChunk.length + sentence.length > targetChars && currentChunk.length > 0) {
				// Create chunk with globally unique ID
				chunks.push({
					chunkId: `${docId}_chunk_${startingIndex + chunkIndex}`,
					docId,
					text: currentChunk.trim(),
					chunkIndex: 0, // Will be renumbered later
					tokens: this.estimateTokens(currentChunk),
					sectionId: section.id,
					parentSection: section.parentId,
					sectionNumber: section.number,
					sectionTitle: section.title,
					breadcrumbPath,
					chunkType: 'child',
				});
				chunkIndex++;

				// Start new chunk with overlap
				currentChunk = this.getOverlapText(currentChunk, overlapChars) + ' ' + sentence;
			} else {
				currentChunk += (currentChunk ? ' ' : '') + sentence;
			}
		}

		// Add remaining content
		if (currentChunk.trim().length > 0) {
			chunks.push({
				chunkId: `${docId}_chunk_${startingIndex + chunkIndex}`,
				docId,
				text: currentChunk.trim(),
				chunkIndex: 0, // Will be renumbered later
				tokens: this.estimateTokens(currentChunk),
				sectionId: section.id,
				parentSection: section.parentId,
				sectionNumber: section.number,
				sectionTitle: section.title,
				breadcrumbPath,
				chunkType: 'child',
			});
		}

		return chunks;
	}

	/**
	 * Create parent chunk (800 tokens) for contextual understanding
	 */
	private createParentChunk(
		text: string,
		docId: string,
		section: DocumentSection,
		breadcrumbPath: string[],
		targetTokens: number,
		globalIndex: number
	): ChunkRecord | null {
		const targetChars = targetTokens * 4;

		// Only create parent if section is large enough
		if (text.length < targetChars / 2) {
			return null;
		}

		// Truncate if too long
		const chunkText = text.length > targetChars
			? text.slice(0, targetChars) + '...'
			: text;

		return {
			chunkId: `${docId}_chunk_${globalIndex}`,
			docId,
			text: chunkText.trim(),
			chunkIndex: 0, // Will be renumbered later
			tokens: this.estimateTokens(chunkText),
			sectionId: section.id,
			parentSection: section.parentId,
			sectionNumber: section.number,
			sectionTitle: section.title,
			breadcrumbPath,
			chunkType: 'parent',
		};
	}

	/**
	 * Legacy chunking method (fallback)
	 */
	private chunkTextLegacy(text: string, docId: string, chunkSize: number = 1200, overlap: number = 200): ChunkRecord[] {
		// IMPROVEMENT: Larger chunks (1200 vs 1000) and more overlap (200 vs 100)
		// Better for medical/legal documents where context is critical

		// Try heading-based chunking first
		const headingChunks = this.chunkByHeadings(text, docId, chunkSize);
		if (headingChunks.length > 0) {
			this.logService.info(`Using heading-based chunking: ${headingChunks.length} chunks`);
			return headingChunks;
		}

		// Fallback to paragraph-based chunking
		const paragraphChunks = this.chunkByParagraphs(text, docId, chunkSize);
		if (paragraphChunks.length > 0) {
			this.logService.info(`Using paragraph-based chunking: ${paragraphChunks.length} chunks`);
			return paragraphChunks;
		}

		// Final fallback to sentence-based chunking with overlap
		this.logService.info(`Using sentence-based chunking fallback with ${overlap} char overlap`);
		return this.chunkBySentences(text, docId, chunkSize, overlap);
	}

	private chunkByHeadings(text: string, docId: string, chunkSize: number): ChunkRecord[] {
		const chunks: ChunkRecord[] = [];

		// IMPROVEMENT: Added more medical/policy document patterns
		const headingPatterns = [
			/\n\s*#{1,6}\s+.+/g,  // Markdown headers (# ## ###)
			/\n\s*\d+\.\s+.+/g,   // Numbered sections (1. 2. 3.)
			/\n\s*\d+\.\d+\s+.+/g, // Subsections (1.1, 1.2, etc.)
			/\n\s*[A-Z][A-Z\s]+$/gm, // ALL CAPS headings
			/\n\s*Chapter\s+\d+/gi,  // Chapter headings
			/\n\s*Section\s+\d+/gi,  // Section headings
			/\n\s*Part\s+[IVX\d]+/gi, // Part headings
			/\n\s*Article\s+[IVX\d]+/gi, // Article headings (legal docs)
			/\n\s*Rule\s+\d+/gi,     // Rule headings (policy manuals)
			/\n\s*Appendix\s+[A-Z\d]+/gi, // Appendix sections
		];

		let sections: string[] = [text];

		// Split by each heading pattern
		for (const pattern of headingPatterns) {
			const newSections: string[] = [];
			for (const section of sections) {
				const parts = section.split(pattern);
				newSections.push(...parts);
			}
			sections = newSections;
		}

		// Filter out empty sections and create chunks
		let chunkIndex = 0;
		for (const section of sections) {
			const trimmedSection = section.trim();
			if (trimmedSection.length === 0) continue;

			// If section is too large, split it further
			if (trimmedSection.length > chunkSize) {
				const subChunks = this.chunkByParagraphs(trimmedSection, docId, chunkSize);
				for (const subChunk of subChunks) {
					chunks.push({
						...subChunk,
						chunkId: `${docId}_heading_chunk_${chunkIndex}`,
						chunkIndex: chunkIndex++
					});
				}
			} else {
				chunks.push({
					chunkId: `${docId}_heading_chunk_${chunkIndex}`,
					docId,
					text: trimmedSection,
					chunkIndex: chunkIndex++,
					tokens: this.estimateTokens(trimmedSection)
				});
			}
		}

		return chunks;
	}

	private chunkByParagraphs(text: string, docId: string, chunkSize: number): ChunkRecord[] {
		const chunks: ChunkRecord[] = [];
		const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

		let currentChunk = '';
		let chunkIndex = 0;

		for (const paragraph of paragraphs) {
			const trimmedPara = paragraph.trim();

			// If adding this paragraph would exceed chunk size, create a chunk
			if (currentChunk.length + trimmedPara.length > chunkSize && currentChunk.length > 0) {
				chunks.push({
					chunkId: `${docId}_para_chunk_${chunkIndex}`,
					docId,
					text: currentChunk.trim(),
					chunkIndex: chunkIndex++,
					tokens: this.estimateTokens(currentChunk)
				});
				currentChunk = trimmedPara;
			} else {
				currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
			}
		}

		// Add remaining content as final chunk
		if (currentChunk.trim().length > 0) {
			chunks.push({
				chunkId: `${docId}_para_chunk_${chunkIndex}`,
				docId,
				text: currentChunk.trim(),
				chunkIndex: chunkIndex++,
				tokens: this.estimateTokens(currentChunk)
			});
		}

		return chunks;
	}

	private chunkBySentences(text: string, docId: string, chunkSize: number, overlap: number): ChunkRecord[] {
		const chunks: ChunkRecord[] = [];
		const sentences = this.splitIntoSentences(text);

		let currentChunk = '';
		let chunkIndex = 0;
		let sentenceIndex = 0;

		while (sentenceIndex < sentences.length) {
			const sentence = sentences[sentenceIndex];

			// If adding this sentence would exceed chunk size, create a chunk
			if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
				chunks.push({
					chunkId: `${docId}_sent_chunk_${chunkIndex}`,
					docId,
					text: currentChunk.trim(),
					chunkIndex: chunkIndex++,
					tokens: this.estimateTokens(currentChunk)
				});

				// Start new chunk with overlap
				const overlapText = this.getOverlapText(currentChunk, overlap);
				currentChunk = overlapText + sentence;
			} else {
				currentChunk += (currentChunk ? ' ' : '') + sentence;
			}

			sentenceIndex++;
		}

		// Add remaining content as final chunk
		if (currentChunk.trim().length > 0) {
			chunks.push({
				chunkId: `${docId}_sent_chunk_${chunkIndex}`,
				docId,
				text: currentChunk.trim(),
				chunkIndex: chunkIndex++,
				tokens: this.estimateTokens(currentChunk)
			});
		}

		return chunks;
	}

	private splitIntoSentences(text: string): string[] {
		// Simple sentence splitting - can be improved with more sophisticated NLP
		return text
			.split(/[.!?]+/)
			.map(s => s.trim())
			.filter(s => s.length > 0);
	}

	private getOverlapText(text: string, overlapSize: number): string {
		if (text.length <= overlapSize) return text;
		return text.slice(-overlapSize);
	}

	private estimateTokens(text: string): number {
		// Rough estimation: ~4 characters per token
		return Math.ceil(text.length / 4);
	}

	async searchChunks(chunkIds: string[], query: string): Promise<SearchResult[]> {
		if (!this.db || chunkIds.length === 0) return [];

		this.logService.info(`searchChunks: Looking for ${chunkIds.length} chunks in SQLite`);
		this.logService.info(`Sample chunk IDs to search: ${chunkIds.slice(0, 3).join(', ')}`);

		const placeholders = chunkIds.map(() => '?').join(',');
		const sql = `
			SELECT
				c.chunk_id as chunkId,
				c.doc_id as docId,
				c.text,
				c.chunk_index as chunkIndex,
				d.filename,
				d.filetype,
				d.is_policy_manual as isPolicyManual
			FROM chunks c
			JOIN documents d ON c.doc_id = d.id
			WHERE c.chunk_id IN (${placeholders})
			ORDER BY c.chunk_index
		`;

		return new Promise((resolve, reject) => {
			this.db!.all(sql, chunkIds, (err, rows: any[]) => {
				if (err) {
					this.logService.error('searchChunks SQL error:', err);
					reject(err);
					return;
				}

				this.logService.info(`searchChunks SQL returned ${rows.length} rows`);

				// DEBUG: If no rows, check if chunks exist at all
				if (rows.length === 0) {
					this.db!.get('SELECT COUNT(*) as count FROM chunks', (err2, row: any) => {
						if (!err2) {
							this.logService.info(`Total chunks in database: ${row.count}`);
						}
					});
					this.db!.all('SELECT chunk_id FROM chunks LIMIT 5', (err3, sampleRows: any[]) => {
						if (!err3) {
							this.logService.info(`Sample chunk IDs in database: ${sampleRows.map(r => r.chunk_id).join(', ')}`);
						}
					});
				}

				const results: SearchResult[] = rows.map(row => {
					// Ensure text is a string (defensive check)
					const text = String(row.text || '');
					return {
					docId: row.docId,
					chunkId: row.chunkId,
					score: 0.8, // Placeholder score - would be calculated by vector search
						snippet: this.highlightQuery(text, query),
					source: {
						filename: row.filename,
						filetype: row.filetype,
						chunkIndex: row.chunkIndex,
						isPolicyManual: row.isPolicyManual === 1
					}
					};
				});

				resolve(results);
			});
		});
	}

	private highlightQuery(text: string, query: string): string {
		// Ensure we have valid strings
		if (!text || typeof text !== 'string') return '';
		if (!query || typeof query !== 'string') return text;

		// Simple highlighting - can be improved
		try {
		const regex = new RegExp(`(${query})`, 'gi');
		return text.replace(regex, '**$1**');
		} catch (err) {
			// If regex fails (e.g., invalid regex chars), return text as-is
			return text;
		}
	}

	async getStats(): Promise<RAGStats> {
		if (!this.db) {
			return {
				documents: [],
				chunks: { totalChunks: 0, avgTokens: 0 },
				totalDocuments: 0,
				totalSize: 0
			};
		}

		// Get document stats by type
		const docStats = await new Promise<any[]>((resolve, reject) => {
			this.db!.all(
				`SELECT filetype, COUNT(*) as typeCount, SUM(filesize) as totalSize
				 FROM documents
				 GROUP BY filetype`,
				(err, rows) => {
					if (err) reject(err);
					else resolve(rows);
				}
			);
		});

		// Get chunk stats
		const chunkStats = await new Promise<any>((resolve, reject) => {
			this.db!.get(
				`SELECT COUNT(*) as totalChunks, AVG(tokens) as avgTokens
				 FROM chunks`,
				(err, row) => {
					if (err) reject(err);
					else resolve(row);
				}
			);
		});

		// Get total stats
		const totalStats = await new Promise<any>((resolve, reject) => {
			this.db!.get(
				`SELECT COUNT(*) as totalDocuments, SUM(filesize) as totalSize
				 FROM documents`,
				(err, row) => {
					if (err) reject(err);
					else resolve(row);
				}
			);
		});

		return {
			documents: docStats.map(stat => ({
				filetype: stat.filetype,
				typeCount: stat.typeCount,
				totalSize: stat.totalSize || 0
			})),
			chunks: {
				totalChunks: chunkStats.totalChunks || 0,
				avgTokens: Math.round(chunkStats.avgTokens || 0)
			},
			totalDocuments: totalStats.totalDocuments || 0,
			totalSize: totalStats.totalSize || 0
		};
	}

	async getDocumentById(docId: string): Promise<DocumentRecord | null> {
		if (!this.db) {
			this.logService.warn('Database not initialized when checking document');
			return null;
		}

		return new Promise((resolve, reject) => {
			this.logService.info(`Querying database for document ID: ${docId}`);
			this.db!.get(
				'SELECT * FROM documents WHERE id = ?',
				[docId],
				(err, row) => {
					if (err) {
						this.logService.error(`Error querying document: ${err}`);
						reject(err);
					} else {
						const found = row as DocumentRecord || null;
						this.logService.info(`Document query result: ${found ? 'FOUND' : 'NOT FOUND'}`);
						if (found) {
							this.logService.info(`Found document: ${found.filename} (uploaded: ${found.uploadedAt})`);
						}
						resolve(found);
					}
				}
			);
		});
	}

	async getDocumentsByType(isPolicyManual: boolean): Promise<DocumentRecord[]> {
		if (!this.db) return [];

		return new Promise((resolve, reject) => {
			this.db!.all(
				'SELECT * FROM documents WHERE is_policy_manual = ?',
				[isPolicyManual ? 1 : 0],
				(err, rows) => {
					if (err) reject(err);
					else resolve(rows as DocumentRecord[]);
				}
			);
		});
	}

	/**
	 * Keyword search using SQLite FTS5 with BM25 ranking
	 * @param query Search query
	 * @param n Number of results to return
	 * @param scope Search scope (policy_manual, workspace_docs, or both)
	 * @param k1 BM25 k1 parameter (term frequency saturation, default: 0.8 for medical/legal)
	 * @param b BM25 b parameter (document length normalization, default: 0.5 for medical/legal)
	 * @returns Array of chunk IDs and scores sorted by relevance
	 */
	async keywordSearch(
		query: string,
		n: number,
		scope: RAGStorageScope,
		k1: number = 0.8,
		b: number = 0.5
	): Promise<Array<{ id: string; score: number }>> {
		if (!this.db) return [];

		// Build scope filter
		const scopeFilter = this.getScopeFilter(scope);

		// Convert query to FTS5 format: use OR to match any term
		// Split on whitespace, escape special chars, and join with OR
		const terms = query
			.split(/\s+/)
			.filter(t => t.length > 0)
			.map(term => {
				// Escape FTS5 special characters
				const escaped = term.replace(/(["\-\*\^\(\)~])/g, '\\$1');
				// Quote individual terms to handle hyphens and special chars
				return `"${escaped}"`;
			});

		// Join with OR for broad matching
		const ftsQuery = terms.join(' OR ');

		this.logService.info(`FTS5 query: ${ftsQuery}`);

		// FTS5 bm25() returns negative scores where more negative = more relevant
		// We negate to get positive scores for easier handling
		const sql = `
			SELECT
				c.chunk_id as id,
				-1 * bm25(chunks_fts, ?, ?) as score
			FROM chunks_fts
			JOIN chunks c ON chunks_fts.chunk_id = c.chunk_id
			JOIN documents d ON c.doc_id = d.id
			WHERE chunks_fts MATCH ? ${scopeFilter}
			ORDER BY bm25(chunks_fts, ?, ?)
			LIMIT ?
		`;

		return new Promise((resolve, reject) => {
			this.db!.all(
				sql,
				[k1, b, ftsQuery, k1, b, n],
				(err, rows: any[]) => {
					if (err) {
						this.logService.error('Keyword search failed:', err);
						reject(err);
						return;
					}

					const results = rows.map(row => ({
						id: row.id,
						score: row.score
					}));

					this.logService.info(`Keyword search for "${query}" returned ${results.length} results`);
					resolve(results);
				}
			);
		});
	}

	/**
	 * Build SQL filter for scope
	 * Handles both old and new scope names for backwards compatibility
	 */
	private getScopeFilter(scope: RAGStorageScope): string {
		switch (scope) {
			case 'policy_manual':
				return 'AND d.is_policy_manual = 1';
			case 'case_index':
			case 'workspace_docs': // Legacy support
				return 'AND d.is_policy_manual = 0';
			case 'workspace_all':
			case 'both': // Legacy support
			default:
				return '';
		}
	}
}
