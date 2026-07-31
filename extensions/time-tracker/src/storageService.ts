/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker - Storage Service
 *  Encrypted SQLite (SQLCipher via better-sqlite3-multiple-ciphers) for billing data
 *--------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { acquireDek, createMementoDekDurabilityMarker, type DekDurabilityMarker } from './shared/encryptedStore';
import { deleteFileIfExists, ensureDir, quarantineFile } from './shared/secureFs';
import type { BillingRate, ExportOptions, Matter, TimeEntry, TimeEntryWithDetails } from './types';

/**
 * Per-platform, dual-ABI better-sqlite3-multiple-ciphers native bindings:
 * - Desktop (Electron 42.x): NODE_MODULE_VERSION 146 → prebuilds/<platform>-<arch>/electron-146/
 * - Web / code-web / serve-web (plain Node 24): NODE_MODULE_VERSION 137 → prebuilds/<platform>-<arch>/node-137/
 * The repo is shared across OSes, so binaries are keyed by process.platform-process.arch
 * (e.g. win32-x64, linux-x64) in addition to runtime-ABI.
 * Extension-local .npmrc builds the Electron binary into node_modules for desktop dev.
 * When Electron or Node major (ABI) changes, regenerate both .npmrc target and prebuilds/.
 *
 * Databases live under context.globalStorageUri/workspaces/<workspaceId>/timetracker.db
 * and are encrypted at rest with a 32-byte DEK from SecretStorage (SQLCipher legacy=4).
 * See PREBUILDS.md for regenerating native binaries. Never ship a plain better-sqlite3
 * .node with the ciphers JS — cipher pragmas would be ignored and data would stay plaintext.
 */
let Database: typeof import('better-sqlite3') | undefined;
try {
	// JS package only — native .node is loaded via { nativeBinding } in initialize().
	Database = require('better-sqlite3-multiple-ciphers');
} catch {
	// Will be handled in initialize()
}

type CipherDatabase = import('better-sqlite3').Database & {
	key(k: Buffer): void;
	rekey(k: Buffer): void;
};

const DEK_KEY_ID = 'time-tracker.dek.database';
const SQLITE_PLAINTEXT_MAGIC = Buffer.from('SQLite format 3\0', 'utf8');

function resolveNativeBindingPath(): string | undefined {
	const abi = process.versions.modules;
	const runtime = process.versions.electron ? 'electron' : 'node';
	// Compiled output lives in out/; prebuilds/ sits at the extension root.
	const candidate = path.join(__dirname, '..', 'prebuilds', `${process.platform}-${process.arch}`, `${runtime}-${abi}`, 'better_sqlite3.node');
	return fs.existsSync(candidate) ? candidate : undefined;
}

function expectedNativeBindingPath(): string {
	const abi = process.versions.modules;
	const runtime = process.versions.electron ? 'electron' : 'node';
	return path.join(__dirname, '..', 'prebuilds', `${process.platform}-${process.arch}`, `${runtime}-${abi}`, 'better_sqlite3.node');
}

function log(message: string): void {
	console.log(`[time-tracker] ${message}`);
}

function applyCipherPragmas(db: CipherDatabase): void {
	db.pragma('cipher=\'sqlcipher\'');
	db.pragma('legacy = 4');
}

function countTableRows(db: CipherDatabase, table: string): number {
	const row = db.prepare(`SELECT count(*) AS c FROM ${table}`).get() as { c: number };
	return row.c;
}

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await fsPromises.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function removeEmptyDirBestEffort(dirPath: string): Promise<void> {
	try {
		await fsPromises.rmdir(dirPath);
		log(`Removed empty directory: ${dirPath}`);
	} catch {
		// ignore — not empty or already gone
	}
}

export class StorageService {
	private db: CipherDatabase | null = null;
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
		return path.join(this.context.globalStorageUri.fsPath, 'workspaces', this.workspaceId, 'timetracker.db');
	}

	private getLegacyDbPath(): string {
		const homeDir = process.env.HOME || process.env.USERPROFILE || os.homedir();
		return path.join(homeDir, '.safe-appeals-navigator', 'databases', 'workspaces', this.workspaceId, 'timetracker.db');
	}

	private openDatabase(dbPath: string, options?: { readonly?: boolean; nativeBinding?: string }): CipherDatabase {
		if (!Database) {
			throw new Error(
				`better-sqlite3-multiple-ciphers is not available. Prebuilds may need regenerating for this platform/ABI. Expected binding: ${expectedNativeBindingPath()}`
			);
		}
		const openOptions: { readonly?: boolean; nativeBinding?: string } = {};
		if (options?.readonly) {
			openOptions.readonly = true;
		}
		if (options?.nativeBinding) {
			openOptions.nativeBinding = options.nativeBinding;
		}
		return new Database(dbPath, openOptions) as CipherDatabase;
	}

	private assertEncryptedOnDisk(dbPath: string): void {
		const fd = fs.openSync(dbPath, 'r');
		try {
			const header = Buffer.alloc(16);
			const bytesRead = fs.readSync(fd, header, 0, 16, 0);
			if (bytesRead >= 16 && header.equals(SQLITE_PLAINTEXT_MAGIC)) {
				throw new Error(
					'Time tracker database is plaintext on disk; encryption is not active. Refusing to use an unencrypted database.'
				);
			}
		} finally {
			fs.closeSync(fd);
		}
	}

	private async migrateLegacyPlaintextDb(dek: Buffer, nativeBinding: string | undefined): Promise<void> {
		const legacyPath = this.getLegacyDbPath();
		const newExists = await pathExists(this.dbPath);
		const legacyExists = await pathExists(legacyPath);

		if (newExists || !legacyExists) {
			return;
		}

		log(`Migrating legacy plaintext DB from ${legacyPath} to ${this.dbPath}`);

		let legacyCounts: { matters: number; billing_rates: number; time_entries: number };
		try {
			const legacyDb = this.openDatabase(legacyPath, { readonly: true, nativeBinding });
			try {
				legacyCounts = {
					matters: countTableRows(legacyDb, 'matters'),
					billing_rates: countTableRows(legacyDb, 'billing_rates'),
					time_entries: countTableRows(legacyDb, 'time_entries'),
				};
				log(`Legacy row counts: ${JSON.stringify(legacyCounts)}`);
			} finally {
				legacyDb.close();
			}
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			log(`Legacy DB unreadable (${reason}); quarantining and starting fresh`);
			const quarantinePath = await quarantineFile(legacyPath);
			const setAside = quarantinePath ?? `${legacyPath}.corrupt-*`;
			void vscode.window.showWarningMessage(
				`Time Tracker: the previous time-tracking database could not be read and has been set aside at ${setAside}. A new empty encrypted database will be created.`
			);
			return;
		}

		await ensureDir(path.dirname(this.dbPath));
		await fsPromises.copyFile(legacyPath, this.dbPath);
		log(`Copied legacy DB to ${this.dbPath}`);

		let migratedDb: CipherDatabase | undefined;
		try {
			migratedDb = this.openDatabase(this.dbPath, { nativeBinding });
			applyCipherPragmas(migratedDb);
			migratedDb.rekey(dek);
			const migratedCounts = {
				matters: countTableRows(migratedDb, 'matters'),
				billing_rates: countTableRows(migratedDb, 'billing_rates'),
				time_entries: countTableRows(migratedDb, 'time_entries'),
			};
			log(`Migrated (encrypted) row counts: ${JSON.stringify(migratedCounts)}`);
			if (
				migratedCounts.matters !== legacyCounts.matters
				|| migratedCounts.billing_rates !== legacyCounts.billing_rates
				|| migratedCounts.time_entries !== legacyCounts.time_entries
			) {
				throw new Error(
					`Migration row-count mismatch: legacy=${JSON.stringify(legacyCounts)} migrated=${JSON.stringify(migratedCounts)}`
				);
			}
			migratedDb.close();
			migratedDb = undefined;
		} catch (error) {
			if (migratedDb) {
				try {
					migratedDb.close();
				} catch {
					// ignore
				}
			}
			try {
				await fsPromises.unlink(this.dbPath);
			} catch {
				// ignore
			}
			log(`Migration failed; left legacy DB untouched at ${legacyPath}`);
			throw error;
		}

		try {
			await fsPromises.unlink(legacyPath);
			log(`Deleted legacy DB: ${legacyPath}`);
		} catch (error) {
			log(`Failed to delete legacy DB (non-fatal): ${error instanceof Error ? error.message : String(error)}`);
		}

		const legacyWorkspaceDir = path.dirname(legacyPath);
		const legacyWorkspacesDir = path.dirname(legacyWorkspaceDir);
		const legacyDatabasesDir = path.dirname(legacyWorkspacesDir);
		const legacyRootDir = path.dirname(legacyDatabasesDir);
		await removeEmptyDirBestEffort(legacyWorkspaceDir);
		await removeEmptyDirBestEffort(legacyWorkspacesDir);
		await removeEmptyDirBestEffort(legacyDatabasesDir);
		await removeEmptyDirBestEffort(legacyRootDir);
	}

	/**
	 * Delete this workspace's encrypted DB (+ WAL/SHM).
	 * Safe to call when initialize() failed — does not require an open connection.
	 *
	 * The DEK is shared by every workspace's database, so it is only dropped once
	 * the last database is gone. Deleting it while another workspace still has a
	 * database would leave that workspace permanently undecryptable — the exact
	 * failure this command exists to recover from.
	 */
	async clearLocalDatabase(): Promise<void> {
		this.close();
		for (const suffix of ['', '-wal', '-shm']) {
			const filePath = `${this.dbPath}${suffix}`;
			const deleted = await deleteFileIfExists(filePath);
			if (deleted) {
				log(`Deleted ${filePath}`);
			}
		}
		await removeEmptyDirBestEffort(path.dirname(this.dbPath));

		const remaining = await this.otherWorkspaceDbPaths();
		if (remaining.length > 0) {
			log(`Keeping DEK ${DEK_KEY_ID}: ${remaining.length} other workspace database(s) still use it`);
			return;
		}
		try {
			await this.context.secrets.delete(DEK_KEY_ID);
			log(`Deleted SecretStorage key ${DEK_KEY_ID}`);
		} catch (error) {
			log(`Failed to delete DEK ${DEK_KEY_ID}: ${error instanceof Error ? error.message : String(error)}`);
		}
		try {
			await this.durabilityMarker().setStored(false);
			log(`Cleared durability marker for ${DEK_KEY_ID}`);
		} catch (error) {
			log(`Failed to clear durability marker for ${DEK_KEY_ID}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private durabilityMarker(): DekDurabilityMarker {
		return createMementoDekDurabilityMarker(this.context.globalState, DEK_KEY_ID);
	}

	/**
	 * Databases belonging to other workspaces that share this extension's DEK.
	 */
	private async otherWorkspaceDbPaths(): Promise<string[]> {
		const workspacesDir = path.dirname(path.dirname(this.dbPath));
		let entries: string[];
		try {
			entries = await fsPromises.readdir(workspacesDir);
		} catch {
			return [];
		}

		const found: string[] = [];
		for (const entry of entries) {
			if (entry === this.workspaceId) {
				continue;
			}
			const candidate = path.join(workspacesDir, entry, 'timetracker.db');
			if (await pathExists(candidate)) {
				found.push(candidate);
			}
		}
		return found;
	}

	async initialize(): Promise<void> {
		if (!Database) {
			throw new Error(
				`better-sqlite3-multiple-ciphers is not available. Prebuilds may need regenerating for this platform/ABI. Expected binding: ${expectedNativeBindingPath()}`
			);
		}

		const nativeBinding = resolveNativeBindingPath();
		if (!nativeBinding) {
			log(
				`No committed prebuild at ${expectedNativeBindingPath()}; falling back to package default resolution (node_modules build/Release).`
			);
		}

		try {
			await ensureDir(path.dirname(this.dbPath));

			const dekResult = await acquireDek({
				secrets: this.context.secrets,
				keyId: DEK_KEY_ID,
				existingDataPaths: [this.dbPath],
				log,
				marker: this.durabilityMarker(),
			});
			if (dekResult.kind === 'unavailable') {
				if (dekResult.reason === 'secret-storage-unusable') {
					throw new Error(
						'Secure storage is unavailable, so time tracking is disabled. Enable OS keychain/SecretStorage and reload.'
					);
				}
				if (dekResult.reason === 'secret-storage-not-durable') {
					throw new Error(
						'The encryption key for time tracking did not survive a restart. This build cannot keep that key across reloads, so any existing time entries are unrecoverable. Time tracking is off until this is resolved.'
					);
				}
				throw new Error(
					'The encrypted time-tracker database cannot be decrypted because its key is missing from secure storage. Run "Time Tracker: Delete Local Time Tracking Database", then reload.'
				);
			}
			const dek = dekResult.dek;

			await this.migrateLegacyPlaintextDb(dek, nativeBinding);

			const db = this.openDatabase(this.dbPath, { nativeBinding });
			this.db = db;
			applyCipherPragmas(db);
			db.key(dek);
			try {
				db.prepare('SELECT count(*) FROM sqlite_master').get();
			} catch (error) {
				this.db = null;
				try {
					db.close();
				} catch {
					// ignore
				}
				throw new Error(
					`Failed to unlock time-tracker database (wrong or missing key): ${error instanceof Error ? error.message : String(error)}`
				);
			}

			this.createTables();

			try {
				this.assertEncryptedOnDisk(this.dbPath);
			} catch (error) {
				this.db = null;
				try {
					db.close();
				} catch {
					// ignore
				}
				throw error;
			}

			log(`Opened encrypted DB at ${this.dbPath}`);
		} catch (error) {
			if (error instanceof Error && (
				error.message.startsWith('Secure storage is unavailable')
				|| error.message.startsWith('The encryption key for time tracking did not survive')
				|| error.message.startsWith('The encrypted time-tracker database cannot be decrypted')
				|| error.message.startsWith('Time tracker database is plaintext')
				|| error.message.startsWith('Failed to unlock')
				|| error.message.startsWith('Migration row-count')
				|| error.message.startsWith('better-sqlite3-multiple-ciphers is not available')
			)) {
				throw error;
			}
			const hint = !nativeBinding
				? ` Prebuilds may need regenerating for this platform/ABI. Expected binding: ${expectedNativeBindingPath()}`
				: '';
			throw new Error(`Failed to initialize database: ${error instanceof Error ? error.message : String(error)}.${hint}`);
		}
	}

	private createTables(): void {
		if (!this.db) {
			return;
		}

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
