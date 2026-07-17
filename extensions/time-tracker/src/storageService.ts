/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker - Storage Service
 *  SQLite database operations for per-workspace time tracking data
 *--------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { BillingRate, ExportOptions, Matter, TimeEntry, TimeEntryWithDetails } from './types';

// Import better-sqlite3 dynamically to handle potential loading issues
let Database: typeof import('better-sqlite3');
try {
	Database = require('better-sqlite3');
} catch {
	// Will be handled in initialize()
}

type DatabaseType = import('better-sqlite3').Database;

export class StorageService {
	private db: DatabaseType | null = null;
	private workspaceId: string;
	private dbPath: string;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.workspaceId = this.generateWorkspaceId();
		this.dbPath = this.getDbPath();
	}

	private generateWorkspaceId(): string {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			// Use extension storage path as fallback
			return crypto.createHash('sha256')
				.update(this.context.globalStorageUri.fsPath)
				.digest('hex')
				.substring(0, 16);
		}

		// Hash the first workspace folder path for consistent ID
		const workspacePath = workspaceFolders[0].uri.fsPath;
		return crypto.createHash('sha256')
			.update(workspacePath)
			.digest('hex')
			.substring(0, 16);
	}

	private getDbPath(): string {
		// Follow RAG pattern: ~/.safe-appeals-navigator/databases/workspaces/{workspaceId}/timetracker.db
		const homeDir = process.env.HOME || process.env.USERPROFILE || '';
		const baseDir = path.join(homeDir, '.safe-appeals-navigator', 'databases', 'workspaces', this.workspaceId);

		// Ensure directory exists
		if (!fs.existsSync(baseDir)) {
			fs.mkdirSync(baseDir, { recursive: true });
		}

		return path.join(baseDir, 'timetracker.db');
	}

	async initialize(): Promise<void> {
		if (!Database) {
			throw new Error('better-sqlite3 is not available. Please ensure native dependencies are installed.');
		}

		try {
			this.db = new Database(this.dbPath);
			this.createTables();
		} catch (error) {
			throw new Error(`Failed to initialize database: ${error}`);
		}
	}

	private createTables(): void {
		if (!this.db) return;

		// Matters/Cases table
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS matters (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				workspace_id TEXT NOT NULL,
				client_name TEXT NOT NULL,
				matter_name TEXT NOT NULL,
				matter_number TEXT,
				default_rate REAL,
				is_active INTEGER DEFAULT 1,
				created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
			)
		`);

		// Billing rates table
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS billing_rates (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				workspace_id TEXT NOT NULL,
				name TEXT NOT NULL,
				hourly_rate REAL NOT NULL,
				is_default INTEGER DEFAULT 0,
				created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
			)
		`);

		// Time entries table
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS time_entries (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				workspace_id TEXT NOT NULL,
				matter_id INTEGER,
				rate_id INTEGER,
				start_time INTEGER NOT NULL,
				end_time INTEGER,
				duration_tenths REAL,
				utbms_task TEXT,
				utbms_activity TEXT,
				description TEXT NOT NULL,
				is_billable INTEGER DEFAULT 1,
				created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
				FOREIGN KEY (matter_id) REFERENCES matters(id),
				FOREIGN KEY (rate_id) REFERENCES billing_rates(id)
			)
		`);

		// Create indexes
		this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_entries_workspace ON time_entries(workspace_id, start_time);
			CREATE INDEX IF NOT EXISTS idx_entries_matter ON time_entries(matter_id);
			CREATE INDEX IF NOT EXISTS idx_matters_workspace ON matters(workspace_id);
			CREATE INDEX IF NOT EXISTS idx_rates_workspace ON billing_rates(workspace_id);
		`);
	}

	getWorkspaceId(): string {
		return this.workspaceId;
	}

	// ========== MATTERS ==========

	createMatter(clientName: string, matterName: string, matterNumber?: string, defaultRate?: number): Matter {
		if (!this.db) throw new Error('Database not initialized');

		const stmt = this.db.prepare(`
			INSERT INTO matters (workspace_id, client_name, matter_name, matter_number, default_rate)
			VALUES (?, ?, ?, ?, ?)
		`);

		const result = stmt.run(this.workspaceId, clientName, matterName, matterNumber || null, defaultRate || null);

		return this.getMatterById(Number(result.lastInsertRowid))!;
	}

	getMatterById(id: number): Matter | undefined {
		if (!this.db) return undefined;

		const stmt = this.db.prepare('SELECT * FROM matters WHERE id = ?');
		return stmt.get(id) as Matter | undefined;
	}

	getMatters(activeOnly: boolean = true): Matter[] {
		if (!this.db) return [];

		const query = activeOnly
			? 'SELECT * FROM matters WHERE workspace_id = ? AND is_active = 1 ORDER BY client_name, matter_name'
			: 'SELECT * FROM matters WHERE workspace_id = ? ORDER BY client_name, matter_name';

		const stmt = this.db.prepare(query);
		return stmt.all(this.workspaceId) as Matter[];
	}

	updateMatter(id: number, updates: Partial<Matter>): Matter | undefined {
		if (!this.db) return undefined;

		const allowedFields = ['client_name', 'matter_name', 'matter_number', 'default_rate', 'is_active'];
		const setClause: string[] = [];
		const values: (string | number | null)[] = [];

		for (const [key, value] of Object.entries(updates)) {
			if (allowedFields.includes(key)) {
				setClause.push(`${key} = ?`);
				values.push(value as string | number | null);
			}
		}

		if (setClause.length === 0) return this.getMatterById(id);

		values.push(id);
		const stmt = this.db.prepare(`UPDATE matters SET ${setClause.join(', ')} WHERE id = ?`);
		stmt.run(...values);

		return this.getMatterById(id);
	}

	deleteMatter(id: number): void {
		if (!this.db) return;

		// Soft delete - just mark as inactive
		const stmt = this.db.prepare('UPDATE matters SET is_active = 0 WHERE id = ?');
		stmt.run(id);
	}

	// ========== BILLING RATES ==========

	createRate(name: string, hourlyRate: number, isDefault: boolean = false): BillingRate {
		if (!this.db) throw new Error('Database not initialized');

		// If this is set as default, unset other defaults first
		if (isDefault) {
			const unsetStmt = this.db.prepare('UPDATE billing_rates SET is_default = 0 WHERE workspace_id = ?');
			unsetStmt.run(this.workspaceId);
		}

		const stmt = this.db.prepare(`
			INSERT INTO billing_rates (workspace_id, name, hourly_rate, is_default)
			VALUES (?, ?, ?, ?)
		`);

		const result = stmt.run(this.workspaceId, name, hourlyRate, isDefault ? 1 : 0);

		return this.getRateById(Number(result.lastInsertRowid))!;
	}

	getRateById(id: number): BillingRate | undefined {
		if (!this.db) return undefined;

		const stmt = this.db.prepare('SELECT * FROM billing_rates WHERE id = ?');
		return stmt.get(id) as BillingRate | undefined;
	}

	getRates(): BillingRate[] {
		if (!this.db) return [];

		const stmt = this.db.prepare('SELECT * FROM billing_rates WHERE workspace_id = ? ORDER BY name');
		return stmt.all(this.workspaceId) as BillingRate[];
	}

	getDefaultRate(): BillingRate | undefined {
		if (!this.db) return undefined;

		const stmt = this.db.prepare('SELECT * FROM billing_rates WHERE workspace_id = ? AND is_default = 1');
		return stmt.get(this.workspaceId) as BillingRate | undefined;
	}

	updateRate(id: number, updates: Partial<BillingRate>): BillingRate | undefined {
		if (!this.db) return undefined;

		// If setting as default, unset other defaults first
		if (updates.is_default) {
			const unsetStmt = this.db.prepare('UPDATE billing_rates SET is_default = 0 WHERE workspace_id = ?');
			unsetStmt.run(this.workspaceId);
		}

		const allowedFields = ['name', 'hourly_rate', 'is_default'];
		const setClause: string[] = [];
		const values: (string | number | null)[] = [];

		for (const [key, value] of Object.entries(updates)) {
			if (allowedFields.includes(key)) {
				setClause.push(`${key} = ?`);
				values.push(value as string | number | null);
			}
		}

		if (setClause.length === 0) return this.getRateById(id);

		values.push(id);
		const stmt = this.db.prepare(`UPDATE billing_rates SET ${setClause.join(', ')} WHERE id = ?`);
		stmt.run(...values);

		return this.getRateById(id);
	}

	deleteRate(id: number): void {
		if (!this.db) return;

		const stmt = this.db.prepare('DELETE FROM billing_rates WHERE id = ?');
		stmt.run(id);
	}

	// ========== TIME ENTRIES ==========

	createEntry(
		startTime: number,
		endTime: number | null,
		durationTenths: number | null,
		description: string,
		matterId?: number,
		rateId?: number,
		utbmsTask?: string,
		utbmsActivity?: string,
		isBillable: boolean = true
	): TimeEntry {
		if (!this.db) throw new Error('Database not initialized');

		const stmt = this.db.prepare(`
			INSERT INTO time_entries (
				workspace_id, matter_id, rate_id, start_time, end_time, duration_tenths,
				utbms_task, utbms_activity, description, is_billable
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);

		const result = stmt.run(
			this.workspaceId,
			matterId || null,
			rateId || null,
			startTime,
			endTime,
			durationTenths,
			utbmsTask || null,
			utbmsActivity || null,
			description,
			isBillable ? 1 : 0
		);

		return this.getEntryById(Number(result.lastInsertRowid))!;
	}

	getEntryById(id: number): TimeEntry | undefined {
		if (!this.db) return undefined;

		const stmt = this.db.prepare('SELECT * FROM time_entries WHERE id = ?');
		return stmt.get(id) as TimeEntry | undefined;
	}

	getEntries(options: ExportOptions = {}): TimeEntryWithDetails[] {
		if (!this.db) return [];

		let query = `
			SELECT
				te.*,
				m.matter_name,
				m.client_name,
				m.matter_number,
				br.name as rate_name,
				br.hourly_rate
			FROM time_entries te
			LEFT JOIN matters m ON te.matter_id = m.id
			LEFT JOIN billing_rates br ON te.rate_id = br.id
			WHERE te.workspace_id = ?
		`;

		const params: (string | number)[] = [this.workspaceId];

		if (options.startDate) {
			query += ' AND te.start_time >= ?';
			params.push(options.startDate);
		}

		if (options.endDate) {
			query += ' AND te.start_time <= ?';
			params.push(options.endDate);
		}

		if (options.matterId) {
			query += ' AND te.matter_id = ?';
			params.push(options.matterId);
		}

		if (options.billableOnly) {
			query += ' AND te.is_billable = 1';
		}

		query += ' ORDER BY te.start_time DESC';

		const stmt = this.db.prepare(query);
		return stmt.all(...params) as TimeEntryWithDetails[];
	}

	getRunningEntry(): TimeEntry | undefined {
		if (!this.db) return undefined;

		const stmt = this.db.prepare('SELECT * FROM time_entries WHERE workspace_id = ? AND end_time IS NULL LIMIT 1');
		return stmt.get(this.workspaceId) as TimeEntry | undefined;
	}

	updateEntry(id: number, updates: Partial<TimeEntry>): TimeEntry | undefined {
		if (!this.db) return undefined;

		const allowedFields = [
			'matter_id', 'rate_id', 'start_time', 'end_time', 'duration_tenths',
			'utbms_task', 'utbms_activity', 'description', 'is_billable'
		];
		const setClause: string[] = [];
		const values: (string | number | null)[] = [];

		for (const [key, value] of Object.entries(updates)) {
			if (allowedFields.includes(key)) {
				setClause.push(`${key} = ?`);
				values.push(value as string | number | null);
			}
		}

		if (setClause.length === 0) return this.getEntryById(id);

		values.push(id);
		const stmt = this.db.prepare(`UPDATE time_entries SET ${setClause.join(', ')} WHERE id = ?`);
		stmt.run(...values);

		return this.getEntryById(id);
	}

	deleteEntry(id: number): void {
		if (!this.db) return;

		const stmt = this.db.prepare('DELETE FROM time_entries WHERE id = ?');
		stmt.run(id);
	}

	getTodayEntries(): TimeEntryWithDetails[] {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const startOfDay = today.getTime();

		return this.getEntries({ startDate: startOfDay });
	}

	getTodayTotalHours(): number {
		const entries = this.getTodayEntries();
		return entries.reduce((total, entry) => total + (entry.duration_tenths || 0), 0);
	}

	close(): void {
		if (this.db) {
			this.db.close();
			this.db = null;
		}
	}
}
