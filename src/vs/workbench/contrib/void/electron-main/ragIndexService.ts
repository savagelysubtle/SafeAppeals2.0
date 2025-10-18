/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import type { Database } from '@vscode/sqlite3';
import { IRAGPathService } from '../common/ragPathService.js';
import { DocumentRecord, ChunkRecord, SearchResult, RAGStats, ExtractedContent } from '../common/ragServiceTypes.js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

export interface IndexDocumentParams {
	uri: URI;
	isPolicyManual: boolean;
	workspaceId?: string;
	content: string;
	metadata: ExtractedContent['metadata'];
}

export class RAGIndexService {
	private db: Database | null = null;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IRAGPathService private readonly pathService: IRAGPathService
	) { }

	async initialize(): Promise<void> {
		if (this.db) return;

		const dbPath = this.pathService.getGlobalSqlitePath();
		const sqlite3 = await import('@vscode/sqlite3');
		this.db = new sqlite3.default.Database(dbPath);

		await this.createTables();
		this.logService.info('RAG index service initialized');
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
				FOREIGN KEY (doc_id) REFERENCES documents (id) ON DELETE CASCADE
			)
		`;

		const createIndexes = `
			CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
			CREATE INDEX IF NOT EXISTS idx_documents_policy ON documents(is_policy_manual);
			CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);
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
		return createHash('sha256').update(uri.fsPath).digest('hex').substring(0, 16);
	}

	private calculateChecksum(uri: URI): string {
		try {
			const content = readFileSync(uri.fsPath);
			return createHash('sha256').update(content).digest('hex');
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
		await new Promise<void>((resolve, reject) => {
			this.db!.run('DELETE FROM chunks', [], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		// Then clear documents
		await new Promise<void>((resolve, reject) => {
			this.db!.run('DELETE FROM documents', [], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		this.logService.info('Cleared all documents and chunks from SQLite');
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

		const stmt = this.db.prepare(
			'INSERT INTO chunks (chunk_id, doc_id, text, chunk_index, tokens) VALUES (?, ?, ?, ?, ?)'
		);

		for (const chunk of chunks) {
			await new Promise<void>((resolve, reject) => {
				stmt.run([chunk.chunkId, chunk.docId, chunk.text, chunk.chunkIndex, chunk.tokens], (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
		}

		stmt.finalize();
	}

	private chunkText(text: string, docId: string, chunkSize: number = 1000, overlap: number = 100): ChunkRecord[] {
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

		// Final fallback to sentence-based chunking
		this.logService.info(`Using sentence-based chunking fallback`);
		return this.chunkBySentences(text, docId, chunkSize, overlap);
	}

	private chunkByHeadings(text: string, docId: string, chunkSize: number): ChunkRecord[] {
		const chunks: ChunkRecord[] = [];

		// Split by common heading patterns
		const headingPatterns = [
			/\n\s*#{1,6}\s+.+/g,  // Markdown headers (# ## ###)
			/\n\s*\d+\.\s+.+/g,   // Numbered sections (1. 2. 3.)
			/\n\s*[A-Z][A-Z\s]+$/gm, // ALL CAPS headings
			/\n\s*Chapter\s+\d+/gi,  // Chapter headings
			/\n\s*Section\s+\d+/gi,  // Section headings
			/\n\s*Part\s+[IVX\d]+/gi, // Part headings
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
					reject(err);
					return;
				}

				const results: SearchResult[] = rows.map(row => ({
					docId: row.docId,
					chunkId: row.chunkId,
					score: 0.8, // Placeholder score - would be calculated by vector search
					snippet: this.highlightQuery(row.text, query),
					source: {
						filename: row.filename,
						filetype: row.filetype,
						chunkIndex: row.chunkIndex,
						isPolicyManual: row.isPolicyManual === 1
					}
				}));

				resolve(results);
			});
		});
	}

	private highlightQuery(text: string, query: string): string {
		// Simple highlighting - can be improved
		const regex = new RegExp(`(${query})`, 'gi');
		return text.replace(regex, '**$1**');
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
		if (!this.db) return null;

		return new Promise((resolve, reject) => {
			this.db!.get(
				'SELECT * FROM documents WHERE id = ?',
				[docId],
				(err, row) => {
					if (err) reject(err);
					else resolve(row as DocumentRecord || null);
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
}
