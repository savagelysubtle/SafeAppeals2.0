/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker - Storage Service
 *  Encrypted SQLite (SQLCipher via better-sqlite3-multiple-ciphers) for billing data
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type * as vscode from 'vscode';
import { acquireDek, createMementoDekDurabilityMarker, type DekDurabilityMarker } from './shared/encryptedStore';
import type { BillingRate, ExportOptions, Matter, TimeEntry, TimeEntryWithDetails } from './types';
import { logInfo } from './logger';
import { getLegacyTimeTrackerWorkspaceId, getTimeTrackerWorkspaceId } from './workspaceIdentity';
import { MigrationEngine } from './migrationEngine';
import { StorageMigrationAdapterSession, StorageMigrationPurge, type StorageMigrationNativeBinding } from './storageMigrationAdapter';

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

interface StorageContext {
	readonly globalStorageUri: { readonly fsPath: string };
	readonly secrets: vscode.SecretStorage;
	readonly globalState: vscode.Memento;
}

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
	logInfo(message);
}

function applyCipherPragmas(db: CipherDatabase): void {
	db.pragma('cipher=\'sqlcipher\'');
	db.pragma('legacy = 4');
}

export class StorageService {
	private db: CipherDatabase | null = null;
	private workspaceId: string;
	private dbPath: string;
	private readonly durable: boolean;

	constructor(
		private readonly context: StorageContext,
		private readonly environment: {
			readonly workspacePath?: string;
			readonly workspaceIdentity?: string;
			/** @deprecated Native storage always uses the fixed home-relative legacy family. */
			readonly legacyRootPath?: string;
			readonly showUnreadableDatabaseWarning?: (setAsidePath: string) => void;
			readonly showMemoryFallbackWarning?: () => void;
			readonly showMigrationBlockedWarning?: (reason: string) => void;
			readonly showLegacyCleanupFailureWarning?: (legacyPath: string) => void;
			readonly homePath?: string;
			readonly migrationNativeBinding?: StorageMigrationNativeBinding;
			readonly createMigrationSession?: typeof StorageMigrationAdapterSession.create;
		} = {}
	) {
		this.durable = Boolean(this.environment.workspaceIdentity ?? this.environment.workspacePath);
		this.workspaceId = this.durable ? this.generateWorkspaceId() : '';
		this.dbPath = this.durable ? this.getDbPath() : ':memory:';
	}

	private generateWorkspaceId(): string {
		return getTimeTrackerWorkspaceId(
			this.context.globalStorageUri.fsPath,
			this.environment.workspaceIdentity ?? this.environment.workspacePath
		);
	}

	private getDbPath(): string {
		return path.join(this.context.globalStorageUri.fsPath, 'workspaces', this.workspaceId, 'timetracker.db');
	}

	private loadMigrationNativeBinding(): StorageMigrationNativeBinding {
		if (this.environment.migrationNativeBinding) {
			return this.environment.migrationNativeBinding;
		}
		const runtime = process.versions.electron ? 'electron' : 'node';
		const bindingPath = path.join(__dirname, '..', 'prebuilds', `${process.platform}-${process.arch}`, `${runtime}-${process.versions.modules}`, 'safeappeals_secure_fs.node');
		return require(bindingPath) as StorageMigrationNativeBinding;
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
	async clearLocalDatabase(): Promise<void> {
		await this.purgeDatabases(false);
	}

	async clearAllLocalDatabases(): Promise<void> {
		await this.purgeDatabases(true);
	}

	private async purgeDatabases(all: boolean): Promise<void> {
		this.close();
		if (!this.durable || process.platform !== 'linux' || process.arch !== 'x64') {
			throw new Error('Secure local database purge is unavailable on this platform');
		}
		const encodedDek = await this.context.secrets.get(DEK_KEY_ID);
		const decodedDek = encodedDek ? Buffer.from(encodedDek, 'base64') : undefined;
		const dek = decodedDek?.length === 32 ? decodedDek : undefined;
		const native = this.loadMigrationNativeBinding();
		const common = {
			globalStoragePath: this.context.globalStorageUri.fsPath,
			homePath: this.environment.homePath ?? os.homedir(), dek, native
		};
		const result = all
			? await StorageMigrationPurge.all(common)
			: await StorageMigrationPurge.current({
				...common, managedId: this.workspaceId,
				legacyId: getLegacyTimeTrackerWorkspaceId(
					this.environment.workspacePath ?? this.environment.workspaceIdentity!
				)
			});
		if (result.kind === 'blocked') {
			this.environment.showMigrationBlockedWarning?.(result.reason);
			throw new Error(`Secure local database purge was blocked: ${result.reason}`);
		}
		if (!all && await this.hasRemainingDatabaseArtifacts(native)) {
			log(`Keeping DEK ${DEK_KEY_ID}: other database artifacts still use it`);
			return;
		}
		await this.context.secrets.delete(DEK_KEY_ID);
		await this.durabilityMarker().setStored(false);
	}

	private async hasRemainingDatabaseArtifacts(native: StorageMigrationNativeBinding): Promise<boolean> {
		const owned = (name: string) => name === 'timetracker.db' || name === 'timetracker.db-wal'
			|| name === 'timetracker.db-shm' || name === '.timetracker-migration-v1.saenc'
			|| name.startsWith('.safeappeals-tx-') || /^timetracker\.db(?:-wal|-shm)?\.corrupt-/.test(name);
		const managedRoot = native.bootstrapPrivateDirectory(this.context.globalStorageUri.fsPath, ['workspaces']);
		try {
			for (const entry of managedRoot.enumerateChildren(4096)) {
				if (!/^[a-f0-9]{64}$/.test(entry.name)) { continue; }
				const workspace = managedRoot.openPrivateChild(entry.name);
				try { if (workspace.enumerateChildren(4096).some(child => owned(child.name))) { return true; } }
				finally { workspace.close(); }
			}
		} finally { managedRoot.close(); }
		const legacyRoot = native.openLegacyWorkspaces(this.environment.homePath ?? os.homedir());
		if (!legacyRoot) { return false; }
		try {
			for (const id of legacyRoot.enumerateWorkspaceIds(4096)) {
				const workspace = legacyRoot.openWorkspace(id);
				try { if (workspace.enumerateChildren(4096).some(child => owned(child.name))) { return true; } }
				finally { workspace.close(); }
			}
			return false;
		} finally { legacyRoot.close(); }
	}


	private durabilityMarker(): DekDurabilityMarker {
		return createMementoDekDurabilityMarker(this.context.globalState, DEK_KEY_ID);
	}

	private async restrictDatabasePermissions(): Promise<void> {
		if (process.platform === 'win32' || this.dbPath === ':memory:') {
			return;
		}
		for (const suffix of ['', '-wal', '-shm']) {
			try {
				await fsPromises.chmod(`${this.dbPath}${suffix}`, 0o600);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
					throw error;
				}
			}
		}
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
			if (!this.durable || process.platform !== 'linux' || process.arch !== 'x64') {
				this.db = this.openDatabase(':memory:', { nativeBinding });
				this.createTables();
				this.environment.showMemoryFallbackWarning?.();
				return;
			}

			const dekResult = await acquireDek({
				secrets: this.context.secrets,
				keyId: DEK_KEY_ID,
				existingDataPaths: [this.dbPath],
				log,
				marker: this.durabilityMarker(),
			});
			if (dekResult.kind === 'unavailable') {
				this.db = this.openDatabase(':memory:', { nativeBinding });
				this.createTables();
				this.environment.showMemoryFallbackWarning?.();
				log(`Using non-persistent in-memory database because secure storage is unavailable (${dekResult.reason})`);
				return;
			}
			const dek = dekResult.dek;
			if (!nativeBinding) {
				this.openMemoryDatabase(undefined, 'the SQLCipher native binding is unavailable');
				return;
			}

			let session: StorageMigrationAdapterSession | undefined;
			let migrationAllowedPersistentOpen = false;
			let migrationFailure: object | undefined;
			try {
				session = await (this.environment.createMigrationSession ?? StorageMigrationAdapterSession.create)({
					globalStoragePath: this.context.globalStorageUri.fsPath,
					managedId: this.workspaceId,
					legacyId: getLegacyTimeTrackerWorkspaceId(
						this.environment.workspacePath ?? this.environment.workspaceIdentity!
					),
					homePath: this.environment.homePath ?? os.homedir(),
					dek,
					native: this.loadMigrationNativeBinding(),
					sqliteNativeBinding: nativeBinding,
					logger: { log, warn: log }
				});
				const result = await new MigrationEngine(session.dependencies).run();
				if (result.kind === 'blocked') {
					migrationFailure = new Error(result.reason);
					this.environment.showMigrationBlockedWarning?.(result.reason);
				} else {
					migrationAllowedPersistentOpen = true;
				}
			} catch (error) {
				migrationFailure = error;
				this.environment.showMigrationBlockedWarning?.(
					error instanceof Error ? error.message : String(error)
				);
			} finally {
				if (session) {
					try {
						await session.dispose();
					} catch (error) {
						migrationAllowedPersistentOpen = false;
						migrationFailure = migrationFailure
							? new AggregateError([migrationFailure, error], 'Migration and cleanup failed')
							: error;
					}
				}
			}
			if (!migrationAllowedPersistentOpen) {
				this.openMemoryDatabase(nativeBinding, migrationFailure instanceof Error ? migrationFailure.message : 'migration state is uncertain');
				return;
			}

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
			await this.restrictDatabasePermissions();

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

	private openMemoryDatabase(nativeBinding: string | undefined, reason: string): void {
		this.db = this.openDatabase(':memory:', { nativeBinding });
		this.createTables();
		this.environment.showMemoryFallbackWarning?.();
		log(`Using non-persistent in-memory database because ${reason}`);
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
