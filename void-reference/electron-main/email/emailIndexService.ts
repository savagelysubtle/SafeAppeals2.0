/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { Database } from '@vscode/sqlite3';
import { createHash } from 'crypto';
import { createRequire } from 'module';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IRAGPathService } from '../../common/rag/ragPathService.js';
import { Email, EmailAttachment, EmailCategory, EmailClassification, EmailPriority, EmailDraft, DraftStatus } from '../../common/emailService.js';

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
	is_starred: number;
	reminder_date: string | null;
	// Classification fields
	category: string | null;
	priority: string | null;
	extracted_deadline: string | null;
	classified_at: string | null;
	// Threading fields
	message_id: string | null;
	in_reply_to: string | null;
	references_json: string | null;
	thread_id: string | null;
	thread_status: string | null;
	created_at: string;
	updated_at: string;
}

export interface DraftRecord {
	id: string;
	email_id: string;
	content: string;
	version: number;
	status: DraftStatus;
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

		const createDraftsTable = `
			CREATE TABLE IF NOT EXISTS email_drafts (
				id TEXT PRIMARY KEY,
				email_id TEXT NOT NULL,
				content TEXT NOT NULL,
				version INTEGER NOT NULL,
				status TEXT NOT NULL CHECK(status IN ('draft', 'reviewed', 'ready', 'sent')) DEFAULT 'draft',
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE
			)
		`;

		const createIndexes = `
			CREATE INDEX IF NOT EXISTS idx_emails_case_folder ON emails(case_folder_path);
			CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date);
			CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(from_email);
			CREATE INDEX IF NOT EXISTS idx_emails_is_draft ON emails(is_draft);
			CREATE INDEX IF NOT EXISTS idx_emails_reply_to ON emails(reply_to_id);
			CREATE INDEX IF NOT EXISTS idx_email_drafts_email_id ON email_drafts(email_id);
			CREATE INDEX IF NOT EXISTS idx_email_drafts_version ON email_drafts(email_id, version);
			CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
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
			this.db!.exec(createDraftsTable, (err) => {
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

		// Run migrations for new columns
		await this.runMigrations();

		this.logService.info('Email: Created FTS5 virtual table and triggers for search');
		this.logService.info('Email: Created email_drafts table for draft versioning');
	}

	/**
	 * Run database migrations for new columns
	 */
	private async runMigrations(): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		// Get existing columns
		const existingColumns = await new Promise<Set<string>>((resolve, reject) => {
			this.db!.all("PRAGMA table_info(emails)", [], (err, rows: Array<{ name: string }>) => {
				if (err) reject(err);
				else resolve(new Set(rows.map(row => row.name)));
			});
		});

		// Migration: Add is_starred column
		if (!existingColumns.has('is_starred')) {
			await new Promise<void>((resolve, reject) => {
				this.db!.exec('ALTER TABLE emails ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0', (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			this.logService.info('Email: Added is_starred column to emails table');
		}

		// Migration: Add category column
		if (!existingColumns.has('category')) {
			await new Promise<void>((resolve, reject) => {
				this.db!.exec('ALTER TABLE emails ADD COLUMN category TEXT', (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			this.logService.info('Email: Added category column to emails table');
		}

		// Migration: Add priority column
		if (!existingColumns.has('priority')) {
			await new Promise<void>((resolve, reject) => {
				this.db!.exec("ALTER TABLE emails ADD COLUMN priority TEXT DEFAULT 'normal'", (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			this.logService.info('Email: Added priority column to emails table');
		}

		// Migration: Add extracted_deadline column
		if (!existingColumns.has('extracted_deadline')) {
			await new Promise<void>((resolve, reject) => {
				this.db!.exec('ALTER TABLE emails ADD COLUMN extracted_deadline TEXT', (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			this.logService.info('Email: Added extracted_deadline column to emails table');
		}

		// Migration: Add classified_at column
		if (!existingColumns.has('classified_at')) {
			await new Promise<void>((resolve, reject) => {
				this.db!.exec('ALTER TABLE emails ADD COLUMN classified_at TEXT', (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			this.logService.info('Email: Added classified_at column to emails table');
		}

		// Migration: Add reminder_date column
		if (!existingColumns.has('reminder_date')) {
			await new Promise<void>((resolve, reject) => {
				this.db!.exec('ALTER TABLE emails ADD COLUMN reminder_date TEXT', (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			this.logService.info('Email: Added reminder_date column to emails table');
		}

		// Migration: Add message_id column for threading
		if (!existingColumns.has('message_id')) {
			await new Promise<void>((resolve, reject) => {
				this.db!.exec('ALTER TABLE emails ADD COLUMN message_id TEXT', (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			this.logService.info('Email: Added message_id column to emails table');
		}

		// Migration: Add in_reply_to column for threading
		if (!existingColumns.has('in_reply_to')) {
			await new Promise<void>((resolve, reject) => {
				this.db!.exec('ALTER TABLE emails ADD COLUMN in_reply_to TEXT', (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			this.logService.info('Email: Added in_reply_to column to emails table');
		}

		// Migration: Add references_json column for threading
		if (!existingColumns.has('references_json')) {
			await new Promise<void>((resolve, reject) => {
				this.db!.exec('ALTER TABLE emails ADD COLUMN references_json TEXT', (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			this.logService.info('Email: Added references_json column to emails table');
		}

		// Migration: Add thread_id column for threading
		if (!existingColumns.has('thread_id')) {
			await new Promise<void>((resolve, reject) => {
				this.db!.exec('ALTER TABLE emails ADD COLUMN thread_id TEXT', (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			this.logService.info('Email: Added thread_id column to emails table');
		}

		// Migration: Add thread_status column for thread status tracking
		if (!existingColumns.has('thread_status')) {
			await new Promise<void>((resolve, reject) => {
				this.db!.exec("ALTER TABLE emails ADD COLUMN thread_status TEXT DEFAULT 'active'", (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
			this.logService.info('Email: Added thread_status column to emails table');
		}

		// Create indexes for classification columns (if not exists)
		await new Promise<void>((resolve, reject) => {
			this.db!.exec(`
				CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
				CREATE INDEX IF NOT EXISTS idx_emails_priority ON emails(priority);
				CREATE INDEX IF NOT EXISTS idx_emails_extracted_deadline ON emails(extracted_deadline);
				CREATE INDEX IF NOT EXISTS idx_emails_reminder_date ON emails(reminder_date);
				CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
				CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);
				CREATE INDEX IF NOT EXISTS idx_emails_thread_status ON emails(thread_status);
			`, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
		this.logService.info('Email: Ensured classification and threading indexes exist');
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
		const referencesJson = email.references ? JSON.stringify(email.references) : null;

		const sql = `
			INSERT OR REPLACE INTO emails (
				id, from_email, to_email, cc, bcc, subject, body_text, body_html,
				date, case_folder_path, file_path, file_type, attachments_json,
				is_draft, reply_to_id, message_id, in_reply_to, references_json, thread_id,
				created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
				email.messageId || null,
				email.inReplyTo || null,
				referencesJson,
				email.threadId || null,
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
	 * Toggle the starred state of an email
	 * Returns the new starred state
	 */
	async toggleStar(id: string): Promise<boolean> {
		if (!this.db) throw new Error('Database not initialized');

		// Get current state
		const email = await this.getEmailById(id);
		if (!email) {
			throw new Error(`Email not found: ${id}`);
		}

		const newStarredState = !email.isStarred;
		const now = new Date().toISOString();

		await new Promise<void>((resolve, reject) => {
			this.db!.run(
				'UPDATE emails SET is_starred = ?, updated_at = ? WHERE id = ?',
				[newStarredState ? 1 : 0, now, id],
				(err) => {
					if (err) reject(err);
					else resolve();
				}
			);
		});

		this.logService.info(`Email: Toggled star for email ${id} to ${newStarredState}`);
		return newStarredState;
	}

	/**
	 * Update email classification (category, priority, extracted deadline)
	 */
	async updateClassification(id: string, classification: EmailClassification): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const now = new Date().toISOString();

		await new Promise<void>((resolve, reject) => {
			this.db!.run(
				`UPDATE emails SET 
					category = ?, 
					priority = ?, 
					extracted_deadline = ?, 
					classified_at = ?,
					updated_at = ?
				WHERE id = ?`,
				[
					classification.category,
					classification.priority,
					classification.extractedDeadline?.toISOString() || null,
					now,
					now,
					id
				],
				(err) => {
					if (err) reject(err);
					else resolve();
				}
			);
		});

		this.logService.info(`Email: Updated classification for email ${id} - category: ${classification.category}, priority: ${classification.priority}`);
	}

	/**
	 * Get emails filtered by category
	 */
	async getEmailsByCategory(category: EmailCategory): Promise<Email[]> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise<Email[]>((resolve, reject) => {
			this.db!.all(
				'SELECT * FROM emails WHERE category = ? ORDER BY date DESC',
				[category],
				(err, rows: EmailRecord[]) => {
					if (err) {
						reject(err);
						return;
					}

					const emails = rows.map(row => this.recordToEmail(row));
					resolve(emails);
				}
			);
		});
	}

	/**
	 * Get emails filtered by priority
	 */
	async getEmailsByPriority(priority: EmailPriority): Promise<Email[]> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise<Email[]>((resolve, reject) => {
			this.db!.all(
				'SELECT * FROM emails WHERE priority = ? ORDER BY date DESC',
				[priority],
				(err, rows: EmailRecord[]) => {
					if (err) {
						reject(err);
						return;
					}

					const emails = rows.map(row => this.recordToEmail(row));
					resolve(emails);
				}
			);
		});
	}

	/**
	 * Set a reminder date for an email
	 * Pass null to clear the reminder
	 */
	async setReminder(id: string, reminderDate: Date | null): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const now = new Date().toISOString();

		await new Promise<void>((resolve, reject) => {
			this.db!.run(
				'UPDATE emails SET reminder_date = ?, updated_at = ? WHERE id = ?',
				[reminderDate?.toISOString() ?? null, now, id],
				(err) => {
					if (err) reject(err);
					else resolve();
				}
			);
		});

		this.logService.info(`Email: Set reminder for email ${id} to ${reminderDate?.toISOString() ?? 'null'}`);
	}

	/**
	 * Get emails that haven't been classified yet
	 * Used by background classifier to process missed emails
	 * Only returns emails where classified_at IS NULL (never attempted classification)
	 */
	async getUnclassifiedEmails(limit: number = 10): Promise<Email[]> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise<Email[]>((resolve, reject) => {
			this.db!.all(
				`SELECT * FROM emails
				 WHERE classified_at IS NULL
				 ORDER BY created_at DESC
				 LIMIT ?`,
				[limit],
				(err, rows: EmailRecord[]) => {
					if (err) {
						reject(err);
						return;
					}

					const emails = rows.map(row => this.recordToEmail(row));
					resolve(emails);
				}
			);
		});
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

		let references: string[] | undefined;
		if (row.references_json) {
			try {
				references = JSON.parse(row.references_json);
			} catch {
				// Invalid JSON, ignore
			}
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
			replyToId: row.reply_to_id || undefined,
			isStarred: row.is_starred === 1,
			reminderDate: row.reminder_date ? new Date(row.reminder_date) : undefined,
			// Classification fields
			category: row.category as EmailCategory | undefined,
			priority: (row.priority || 'normal') as EmailPriority,
			extractedDeadline: row.extracted_deadline ? new Date(row.extracted_deadline) : undefined,
			classifiedAt: row.classified_at ? new Date(row.classified_at) : undefined,
			// Threading fields
			messageId: row.message_id || undefined,
			inReplyTo: row.in_reply_to || undefined,
			references,
			threadId: row.thread_id || undefined
		};
	}

	/**
	 * Convert a database record to an EmailDraft object
	 */
	private recordToDraft(row: DraftRecord): EmailDraft {
		return {
			id: row.id,
			emailId: row.email_id,
			content: row.content,
			version: row.version,
			status: row.status,
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at)
		};
	}

	// ========== DRAFT MANAGEMENT METHODS ==========

	/**
	 * Save a draft for an email, creating a new version
	 * Automatically increments version number
	 */
	async saveDraft(emailId: string, content: string): Promise<EmailDraft> {
		if (!this.db) throw new Error('Database not initialized');

		// Get the highest version number for this email
		const maxVersion = await new Promise<number>((resolve, reject) => {
			this.db!.get(
				'SELECT MAX(version) as max_version FROM email_drafts WHERE email_id = ?',
				[emailId],
				(err, row: { max_version: number | null }) => {
					if (err) reject(err);
					else resolve(row?.max_version ?? 0);
				}
			);
		});

		const newVersion = maxVersion + 1;
		const now = new Date().toISOString();
		const draftId = createHash('sha256').update(`${emailId}-${newVersion}-${now}`).digest('hex').substring(0, 16);

		const draft: EmailDraft = {
			id: draftId,
			emailId,
			content,
			version: newVersion,
			status: 'draft',
			createdAt: new Date(now),
			updatedAt: new Date(now)
		};

		await new Promise<void>((resolve, reject) => {
			this.db!.run(
				`INSERT INTO email_drafts (id, email_id, content, version, status, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[draft.id, draft.emailId, draft.content, draft.version, draft.status, now, now],
				(err) => {
					if (err) reject(err);
					else resolve();
				}
			);
		});

		this.logService.info(`Email: Saved draft version ${newVersion} for email ${emailId}`);
		return draft;
	}

	/**
	 * Get the latest draft for an email
	 */
	async getDraft(emailId: string): Promise<EmailDraft | null> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise<EmailDraft | null>((resolve, reject) => {
			this.db!.get(
				`SELECT * FROM email_drafts 
				 WHERE email_id = ? 
				 ORDER BY version DESC 
				 LIMIT 1`,
				[emailId],
				(err, row: DraftRecord | undefined) => {
					if (err) {
						reject(err);
						return;
					}

					if (!row) {
						resolve(null);
						return;
					}

					resolve(this.recordToDraft(row));
				}
			);
		});
	}

	/**
	 * Get all versions of drafts for an email, ordered by version descending
	 */
	async getDraftVersions(emailId: string): Promise<EmailDraft[]> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise<EmailDraft[]>((resolve, reject) => {
			this.db!.all(
				`SELECT * FROM email_drafts 
				 WHERE email_id = ? 
				 ORDER BY version DESC`,
				[emailId],
				(err, rows: DraftRecord[]) => {
					if (err) {
						reject(err);
						return;
					}

					resolve(rows.map(row => this.recordToDraft(row)));
				}
			);
		});
	}

	/**
	 * Update the status of a draft
	 */
	async updateDraftStatus(draftId: string, status: DraftStatus): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const now = new Date().toISOString();

		await new Promise<void>((resolve, reject) => {
			this.db!.run(
				'UPDATE email_drafts SET status = ?, updated_at = ? WHERE id = ?',
				[status, now, draftId],
				(err) => {
					if (err) reject(err);
					else resolve();
				}
			);
		});

		this.logService.info(`Email: Updated draft ${draftId} status to ${status}`);
	}

	// ========== THREADING METHODS ==========

	/**
	 * Get all distinct thread IDs in the workspace
	 */
	async getDistinctThreadIds(): Promise<string[]> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise<string[]>((resolve, reject) => {
			this.db!.all(
				'SELECT DISTINCT thread_id FROM emails WHERE thread_id IS NOT NULL ORDER BY thread_id',
				[],
				(err, rows: { thread_id: string }[]) => {
					if (err) {
						reject(err);
						return;
					}
					resolve(rows.map(row => row.thread_id));
				}
			);
		});
	}

	/**
	 * Get all emails in a specific thread, sorted by date (oldest first)
	 */
	async getEmailsByThreadId(threadId: string): Promise<Email[]> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise<Email[]>((resolve, reject) => {
			this.db!.all(
				'SELECT * FROM emails WHERE thread_id = ? ORDER BY date ASC',
				[threadId],
				(err, rows: EmailRecord[]) => {
					if (err) {
						reject(err);
						return;
					}

					const emails = rows.map(row => this.recordToEmail(row));
					resolve(emails);
				}
			);
		});
	}

	/**
	 * Get thread status from database
	 */
	async getThreadStatus(threadId: string): Promise<string | null> {
		if (!this.db) throw new Error('Database not initialized');

		return new Promise<string | null>((resolve, reject) => {
			this.db!.get(
				`SELECT thread_status FROM emails WHERE thread_id = ? AND thread_status IS NOT NULL ORDER BY date DESC LIMIT 1`,
				[threadId],
				(err, row: { thread_status: string } | undefined) => {
					if (err) {
						reject(err);
					} else {
						resolve(row?.thread_status || null);
					}
				}
			);
		});
	}

	/**
	 * Update thread status for all emails in a thread
	 */
	async updateThreadStatus(threadId: string, status: string): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		const now = new Date().toISOString();
		return new Promise<void>((resolve, reject) => {
			this.db!.run(
				`UPDATE emails SET thread_status = ?, updated_at = ? WHERE thread_id = ?`,
				[status, now, threadId],
				(err) => {
					if (err) reject(err);
					else resolve();
				}
			);
		});
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

