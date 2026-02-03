/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { Database } from '@vscode/sqlite3';
import { createRequire } from 'module';
import { URI } from '../../../../../base/common/uri.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IRAGPathService } from '../../common/rag/ragPathService.js';

export interface ChatThreadData {
	id: string;
	data: string; // JSON serialized thread
	lastModified: string;
}

/**
 * Per-workspace SQLite storage for chat threads
 * Follows the same micro database pattern as RAG storage
 */
export class ChatThreadStorageService {
	private db: Database | null = null;
	private static readonly CURRENT_SCHEMA_VERSION = 1;
	private readonly workspaceId: string;

	constructor(
		private readonly logService: ILogService,
		private readonly pathService: IRAGPathService,
		workspaceId: string
	) {
		// Validate workspaceId - NO global fallback allowed
		if (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null' || workspaceId.trim() === '') {
			throw new Error('ChatThreadStorageService: workspaceId is REQUIRED. Each workspace must have its own isolated thread storage.');
		}
		this.workspaceId = workspaceId;
	}

	async initialize(): Promise<void> {
		if (this.db) return;

		try {
			const dbPath = this.pathService.getChatThreadsSqlitePath(this.workspaceId);
			console.log(`[ChatThreadStorageService] Initializing SQLite database`);
			console.log(`[ChatThreadStorageService] Workspace: ${this.workspaceId}`);
			console.log(`[ChatThreadStorageService] Database path: ${dbPath}`);
			this.logService.info(`ChatThreads: Initializing SQLite database for workspace: ${this.workspaceId}`);
			this.logService.info(`ChatThreads: Database path: ${dbPath}`);

			// Ensure parent directory exists
			const fs = await import('fs');
			const path = await import('path');
			const parentDir = path.dirname(dbPath);

			if (!fs.existsSync(parentDir)) {
				this.logService.info(`ChatThreads: Creating workspace database directory: ${parentDir}`);
				fs.mkdirSync(parentDir, { recursive: true });
			}

			// Use createRequire() for reliable native module loading
			const require = createRequire(import.meta.url);
			const sqlite3 = require('@vscode/sqlite3');

			this.db = new sqlite3.Database(dbPath);
			this.logService.info(`ChatThreads: Database initialized for workspace ${this.workspaceId}`);

			await this.createTables();
			this.logService.info('ChatThreads: Storage service initialized');
		} catch (error) {
			this.logService.error('ChatThreads: Failed to initialize SQLite database:', error);
			throw error;
		}
	}

	private async createTables(): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const createThreadsTable = `
			CREATE TABLE IF NOT EXISTS threads (
				id TEXT PRIMARY KEY,
				data TEXT NOT NULL,
				last_modified TEXT NOT NULL
			)
		`;

		const createSchemaVersionTable = `
			CREATE TABLE IF NOT EXISTS schema_version (
				version INTEGER PRIMARY KEY
			)
		`;

		await this.runAsync(createThreadsTable);
		await this.runAsync(createSchemaVersionTable);

		// Check and set schema version
		const versionRow = await this.getAsync<{ version: number }>(
			'SELECT version FROM schema_version LIMIT 1'
		);

		if (!versionRow) {
			await this.runAsync(
				'INSERT INTO schema_version (version) VALUES (?)',
				[ChatThreadStorageService.CURRENT_SCHEMA_VERSION]
			);
			this.logService.info(`ChatThreads: Schema version set to ${ChatThreadStorageService.CURRENT_SCHEMA_VERSION}`);
		} else if (versionRow.version !== ChatThreadStorageService.CURRENT_SCHEMA_VERSION) {
			this.logService.info(`ChatThreads: Schema migration needed: ${versionRow.version} -> ${ChatThreadStorageService.CURRENT_SCHEMA_VERSION}`);
			// Future: Handle schema migrations here
		}
	}

	/**
	 * Reviver function to properly restore URI objects from JSON
	 */
	private uriReviver(_key: string, value: any): any {
		// $mid === 1 indicates a marshalled URI object
		if (value && typeof value === 'object' && value.$mid === 1) {
			return URI.from(value);
		}
		return value;
	}

	/**
	 * Read all threads for this workspace
	 */
	async readAllThreads(): Promise<Record<string, any>> {
		if (!this.db) await this.initialize();

		try {
			const rows = await this.allAsync<ChatThreadData>('SELECT * FROM threads');
			const threads: Record<string, any> = {};

			for (const row of rows) {
				try {
					// Use URI reviver to properly restore URI objects
					threads[row.id] = JSON.parse(row.data, this.uriReviver.bind(this));
				} catch (error) {
					this.logService.error(`ChatThreads: Failed to parse thread ${row.id}:`, error);
				}
			}

			this.logService.info(`ChatThreads: Read ${rows.length} threads from workspace ${this.workspaceId}`);
			return threads;
		} catch (error) {
			this.logService.error('ChatThreads: Failed to read threads:', error);
			return {};
		}
	}

	/**
	 * Store all threads for this workspace
	 * Uses INSERT OR REPLACE to handle concurrent saves safely
	 */
	async storeAllThreads(threads: Record<string, any>): Promise<void> {
		console.log(`[ChatThreadStorageService] storeAllThreads called with ${Object.keys(threads).length} threads`);
		if (!this.db) await this.initialize();

		try {
			// Use INSERT OR REPLACE for each thread - handles concurrent access safely
			for (const [id, thread] of Object.entries(threads)) {
				if (!thread) continue; // Skip undefined threads
				const lastModified = thread.lastModified || new Date().toISOString();
				console.log(`[ChatThreadStorageService] Saving thread: ${id}`);
				await this.runAsync(
					'INSERT OR REPLACE INTO threads (id, data, last_modified) VALUES (?, ?, ?)',
					[id, JSON.stringify(thread), lastModified]
				);
			}

			console.log(`[ChatThreadStorageService] ✓ All threads saved to ${this.workspaceId}`);
			this.logService.info(`ChatThreads: Stored ${Object.keys(threads).length} threads for workspace ${this.workspaceId}`);
		} catch (error) {
			console.error(`[ChatThreadStorageService] Failed to store threads:`, error);
			this.logService.error('ChatThreads: Failed to store threads:', error);
			throw error;
		}
	}

	/**
	 * Delete a specific thread
	 */
	async deleteThread(threadId: string): Promise<void> {
		if (!this.db) await this.initialize();

		try {
			await this.runAsync('DELETE FROM threads WHERE id = ?', [threadId]);
			this.logService.info(`ChatThreads: Deleted thread ${threadId} from workspace ${this.workspaceId}`);
		} catch (error) {
			this.logService.error(`ChatThreads: Failed to delete thread ${threadId}:`, error);
			throw error;
		}
	}

	/**
	 * Close the database connection
	 */
	async dispose(): Promise<void> {
		if (!this.db) return;

		return new Promise((resolve, reject) => {
			this.db!.close((err) => {
				if (err) {
					this.logService.error('ChatThreads: Error closing database:', err);
					reject(err);
				} else {
					this.logService.info(`ChatThreads: Database closed for workspace ${this.workspaceId}`);
					this.db = null;
					resolve();
				}
			});
		});
	}

	// ========== SQLite Helper Methods ==========

	private runAsync(sql: string, params: any[] = []): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db!.run(sql, params, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	private getAsync<T>(sql: string, params: any[] = []): Promise<T | undefined> {
		return new Promise((resolve, reject) => {
			this.db!.get(sql, params, (err, row) => {
				if (err) reject(err);
				else resolve(row as T | undefined);
			});
		});
	}

	private allAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
		return new Promise((resolve, reject) => {
			this.db!.all(sql, params, (err, rows) => {
				if (err) reject(err);
				else resolve(rows as T[]);
			});
		});
	}

}
