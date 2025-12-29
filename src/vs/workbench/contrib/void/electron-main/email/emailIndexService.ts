/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { Database } from '@vscode/sqlite3';
import { createHash } from 'crypto';
import { createRequire } from 'module';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IRAGPathService } from '../../common/rag/ragPathService.js';
import { Email, EmailAttachment } from '../../common/emailService.js';

export interface EmailRecord {
	id: string;
	from_email: string;
	to_email: string;
	cc: string | null;
	bcc: string | null;
	subject: string;
	body_text: string;
	body_html: string | null;
	date: string;
	case_folder_path: string;
	file_path: string;
	file_type: 'eml' | 'pdf';
	attachments_json: string;
	is_draft: number;
	reply_to_id: string | null;
	created_at: string;
	updated_at: string;
}

export class EmailIndexService {
	private db: Database | null = null;
	private readonly workspaceId: string;

	constructor(
		private readonly logService: ILogService,
		private readonly pathService: IRAGPathService,
		workspaceId: string
	) {
		this.workspaceId = workspaceId;
	}

	async initialize(): Promise<void> {
		if (this.db) return;

		try {
			const dbPath = this.pathService.getEmailSqlitePath(this.workspaceId);
			this.logService.info(`Email: Initializing SQLite database at: ${dbPath} (workspace: ${this.workspaceId})`);

			// Ensure parent directory exists
			const fs = await import('fs');
			const path = await import('path');
			const parentDir = path.dirname(dbPath);

			if (!fs.existsSync(parentDir)) {
				this.logService.info(`Email: Creating parent directory: ${parentDir}`);
				fs.mkdirSync(parentDir, { recursive: true });
			}

			// Use createRequire() for reliable native module loading
			const require = createRequire(import.meta.url);
			const sqlite3 = require('@vscode/sqlite3');

			this.db = new sqlite3.Database(dbPath);
			this.logService.info('Email: SQLite database initialized successfully');

			await this.createTables();
			this.logService.info('Email index service initialized');
		} catch (error) {
			this.logService.error('Email: Failed to initialize SQLite database:', error);
			throw error;
		}
	}

	private async createTables(): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const createEmailsTable = `
			CREATE TABLE IF NOT EXISTS emails (
				id TEXT PRIMARY KEY,
				from_email TEXT NOT NULL,
				to_email TEXT NOT NULL,
				cc TEXT,
				bcc TEXT,
				subject TEXT NOT NULL,
				body_text TEXT NOT NULL,
				body_html TEXT,
				date TEXT NOT NULL,
				case_folder_path TEXT NOT NULL,
				file_path TEXT NOT NULL,
				file_type TEXT NOT NULL CHECK(file_type IN ('eml', 'pdf')),
				attachments_json TEXT,
				is_draft INTEGER NOT NULL DEFAULT 0,
				reply_to_id TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY (reply_to_id) REFERENCES emails (id) ON DELETE SET NULL
			)
		`;

		const createIndexes = `
			CREATE INDEX IF NOT EXISTS idx_emails_case_folder ON emails(case_folder_path);
			CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date);
			CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(from_email);
			CREATE INDEX IF NOT EXISTS idx_emails_is_draft ON emails(is_draft);
			CREATE INDEX IF NOT EXISTS idx_emails_reply_to ON emails(reply_to_id);
		`;

		// FTS5 virtual table for full-text search on emails
		const createFTSTable = `
			CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(
				id UNINDEXED,
				subject,
				body_text,
				from_email,
				content='emails',
				content_rowid='rowid'
			)
		`;

		// Triggers to keep FTS index in sync
		const createFTSTriggers = `
			CREATE TRIGGER IF NOT EXISTS emails_ai AFTER INSERT ON emails BEGIN
				INSERT INTO emails_fts(rowid, id, subject, body_text, from_email)
				VALUES (new.rowid, new.id, new.subject, new.body_text, new.from_email);
			END;

			CREATE TRIGGER IF NOT EXISTS emails_ad AFTER DELETE ON emails BEGIN
				DELETE FROM emails_fts WHERE rowid = old.rowid;
			END;

			CREATE TRIGGER IF NOT EXISTS emails_au AFTER UPDATE ON emails BEGIN
				UPDATE emails_fts SET subject = new.subject, body_text = new.body_text, from_email = new.from_email WHERE rowid = old.rowid;
			END;
		`;

		await new Promise<void>((resolve, reject) => {
			this.db!.exec(createEmailsTable, (err) => {
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

		await new Promise<void>((resolve, reject) => {
			this.db!.exec(createFTSTable, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		await new Promise<void>((resolve, reject) => {
			this.db!.exec(createFTSTriggers, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		this.logService.info('Email: Created FTS5 virtual table and triggers for search');
	}

	/**
	 * Generate a unique ID for an email based on its file path
	 */
	generateEmailId(filePath: string): string {
		return createHash('sha256').update(filePath).digest('hex').substring(0, 16);
	}

	/**
	 * Store an email in the database
	 */
	async storeEmail(email: Email): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const now = new Date().toISOString();
		const attachmentsJson = JSON.stringify(email.attachments);

		const sql = `
			INSERT OR REPLACE INTO emails (
				id, from_email, to_email, cc, bcc, subject, body_text, body_html,
				date, case_folder_path, file_path, file_type, attachments_json,
				is_draft, reply_to_id, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`;

		await new Promise<void>((resolve, reject) => {
			this.db!.run(sql, [
				email.id,
				email.from,
				email.to,
				email.cc || null,
				email.bcc || null,
				email.subject,
				email.bodyText,
				email.bodyHtml || null,
				email.date.toISOString(),
				email.caseFolderPath,
				email.filePath,
				email.fileType,
				attachmentsJson,
				email.isDraft ? 1 : 0,
				email.replyToId || null,
				now,
				now
			], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		this.logService.info(`Email: Stored email ${email.id} - "${email.subject}"`);
	}

	/**
	 * Get all emails, optionally filtered by case folder path
	 */
	async getEmails(caseFolderPath?: string): Promise<Email[]> {
		if (!this.db) throw new Error('Database not initialized');

		let sql = 'SELECT * FROM emails ORDER BY date DESC';
		const params: string[] = [];

		if (caseFolderPath) {
			sql = 'SELECT * FROM emails WHERE case_folder_path = ? OR case_folder_path LIKE ? ORDER BY date DESC';
			params.push(caseFolderPath, `${caseFolderPath}%`);
		}

		return new Promise<Email[]>((resolve, reject) => {
			this.db!.all(sql, params, (err, rows: EmailRecord[]) => {
				if (err) {
					reject(err);
					return;
				}

				const emails = rows.map(row => this.recordToEmail(row));
				resolve(emails);
			});
		});
	}

	/**
	 * Get a specific email by ID
	 */
	async getEmailById(id: string): Promise<Email | null> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise<Email | null>((resolve, reject) => {
			this.db!.get('SELECT * FROM emails WHERE id = ?', [id], (err, row: EmailRecord | undefined) => {
				if (err) {
					reject(err);
					return;
				}

				if (!row) {
					resolve(null);
					return;
				}

				resolve(this.recordToEmail(row));
			});
		});
	}

	/**
	 * Search emails using full-text search
	 */
	async searchEmails(query: string, caseFolderPath?: string): Promise<Email[]> {
		if (!this.db) throw new Error('Database not initialized');

		let sql = `
			SELECT e.* FROM emails e
			JOIN emails_fts fts ON e.id = fts.id
			WHERE emails_fts MATCH ?
		`;
		const params: string[] = [query];

		if (caseFolderPath) {
			sql += ' AND (e.case_folder_path = ? OR e.case_folder_path LIKE ?)';
			params.push(caseFolderPath, `${caseFolderPath}%`);
		}

		sql += ' ORDER BY e.date DESC LIMIT 50';

		return new Promise<Email[]>((resolve, reject) => {
			this.db!.all(sql, params, (err, rows: EmailRecord[]) => {
				if (err) {
					reject(err);
					return;
				}

				const emails = rows.map(row => this.recordToEmail(row));
				resolve(emails);
			});
		});
	}

	/**
	 * Delete an email by ID
	 */
	async deleteEmail(id: string): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		await new Promise<void>((resolve, reject) => {
			this.db!.run('DELETE FROM emails WHERE id = ?', [id], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		this.logService.info(`Email: Deleted email ${id}`);
	}

	/**
	 * Check if an email exists by file path
	 */
	async emailExistsByFilePath(filePath: string): Promise<boolean> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise<boolean>((resolve, reject) => {
			this.db!.get('SELECT id FROM emails WHERE file_path = ?', [filePath], (err, row) => {
				if (err) reject(err);
				else resolve(!!row);
			});
		});
	}

	/**
	 * Get email statistics
	 */
	async getStats(): Promise<{ totalEmails: number; draftCount: number; caseFolders: string[] }> {
		if (!this.db) throw new Error('Database not initialized');

		const totalEmails = await new Promise<number>((resolve, reject) => {
			this.db!.get('SELECT COUNT(*) as count FROM emails', [], (err, row: { count: number }) => {
				if (err) reject(err);
				else resolve(row?.count || 0);
			});
		});

		const draftCount = await new Promise<number>((resolve, reject) => {
			this.db!.get('SELECT COUNT(*) as count FROM emails WHERE is_draft = 1', [], (err, row: { count: number }) => {
				if (err) reject(err);
				else resolve(row?.count || 0);
			});
		});

		const caseFolders = await new Promise<string[]>((resolve, reject) => {
			this.db!.all('SELECT DISTINCT case_folder_path FROM emails', [], (err, rows: { case_folder_path: string }[]) => {
				if (err) reject(err);
				else resolve(rows.map(r => r.case_folder_path));
			});
		});

		return { totalEmails, draftCount, caseFolders };
	}

	/**
	 * Convert a database record to an Email object
	 */
	private recordToEmail(row: EmailRecord): Email {
		let attachments: EmailAttachment[] = [];
		try {
			attachments = JSON.parse(row.attachments_json || '[]');
		} catch {
			// Invalid JSON, use empty array
		}

		return {
			id: row.id,
			from: row.from_email,
			to: row.to_email,
			cc: row.cc || undefined,
			bcc: row.bcc || undefined,
			subject: row.subject,
			bodyText: row.body_text,
			bodyHtml: row.body_html || undefined,
			date: new Date(row.date),
			caseFolderPath: row.case_folder_path,
			filePath: row.file_path,
			fileType: row.file_type as 'eml' | 'pdf',
			attachments,
			isDraft: row.is_draft === 1,
			replyToId: row.reply_to_id || undefined
		};
	}

	/**
	 * Close the database connection
	 */
	async close(): Promise<void> {
		if (this.db) {
			await new Promise<void>((resolve, reject) => {
				this.db!.close((err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			this.db = null;
			this.logService.info('Email: Database connection closed');
		}
	}
}

