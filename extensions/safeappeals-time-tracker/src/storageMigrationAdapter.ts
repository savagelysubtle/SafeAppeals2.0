/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Database = require('better-sqlite3-multiple-ciphers');
import { open, seal } from './shared/encryptedStore';
import { sensitiveStateDeleteNamePattern, sensitiveStateTemporaryNamePattern } from './storageArtifactNames';
import type {
	FileIdentity, ManifestStore, MigrationCandidateAdapter, MigrationDirectoryLock,
	MigrationEngineDependencies, MigrationManifest, MigrationNames, MigrationReporter,
	MigrationSourceAdapter, SourceDescription
} from './migrationEngine';

const manifestName = '.timetracker-migration-v1.saenc';
const databaseName = 'timetracker.db';
const tables = ['matters', 'billing_rates', 'time_entries'] as const;
type TableName = typeof tables[number];
type Row = Record<string, string | number | null>;

interface NativeFile {
	readonly identity: FileIdentity;
	readonly descriptorPath: string;
	fsync(): void;
	close(): void;
}

interface NativeLock {
	readonly directoryPath: string;
	createStagedFile(name: string): NativeFile;
	validateStagedFile(name: string, expected: NativeFile): FileIdentity;
	writeEncryptedManifest(temporaryName: string, bytes: Buffer, expected?: FileIdentity): FileIdentity;
	quarantineCurrent(source: string, staging: string, expected: NativeFile): NativeFile;
	deleteQuarantine(staging: string, expected: NativeFile): void;
	activateStagedNoReplace(staging: string, expected: NativeFile, destination: string): void;
	fsyncDirectory(): void;
	close(): void;
}

interface NativeDirectory {
	openRegularFile(name: string, writable: boolean): NativeFile;
	acquireExclusiveLock(): NativeLock;
	enumerateChildren(limit: number): readonly NativeChildEntry[];
	openPrivateChild(name: string): NativeDirectory;
	close(): void;
}

interface NativeChildEntry extends FileIdentity { readonly name: string; readonly mode: number; readonly uid: number }
interface NativeLegacyWorkspaces {
	enumerateWorkspaceIds(limit: number): readonly string[];
	openWorkspace(workspaceId: string): NativeDirectory;
	close(): void;
}

export interface StorageMigrationNativeBinding {
	readonly SecureDirectory: new (trustedRoot: string, relativePath: string) => NativeDirectory;
	bootstrapPrivateDirectory(anchorPath: string, components: string[]): NativeDirectory;
	openLegacyWorkspace(homePath: string, workspaceId: string): NativeDirectory;
	openLegacyWorkspaces(homePath: string): NativeLegacyWorkspaces | undefined;
}

export interface StorageMigrationAdapterFaults {
	readonly checkpoint?: (database: Database.Database) => readonly { readonly busy: number; readonly log: number; readonly checkpointed: number }[];
}

export type StoragePurgeResult =
	| { readonly kind: 'complete'; readonly purgedFiles: number; readonly scannedWorkspaces: number }
	| { readonly kind: 'blocked'; readonly reason: string; readonly purgedFiles: number; readonly scannedWorkspaces: number };

type CipherDatabase = Database.Database & { key(key: Buffer): void };

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
	return left.device === right.device && left.inode === right.inode
		&& left.kind === right.kind && left.linkCount === right.linkCount;
}

function errorCode(error: object): string | undefined {
	return 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}

function openDatabase(directoryPath: string, name: string, nativeBinding: string, readonly = false): CipherDatabase {
	return new Database(path.join(directoryPath, name), { nativeBinding, readonly }) as CipherDatabase;
}

function applyCipher(database: CipherDatabase, dek: Buffer): void {
	database.pragma('cipher=\'sqlcipher\'');
	database.pragma('legacy=4');
	database.key(dek);
}

function rowCounts(database: CipherDatabase): Record<TableName, number> {
	return Object.fromEntries(tables.map(table => [table,
		(database.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count
	])) as Record<TableName, number>;
}

function snapshotRows(database: CipherDatabase): Record<TableName, Row[]> {
	return Object.fromEntries(tables.map(table => [table,
		database.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Row[]
	])) as Record<TableName, Row[]>;
}

function digest(rows: Record<TableName, Row[]>): string {
	const canonical = Object.fromEntries(tables.map(table => [table, rows[table].map(row => ({ ...row, workspace_id: '<workspace>' }))]));
	return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

const productionSchema = `
	CREATE TABLE matters (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, client_name TEXT NOT NULL, matter_name TEXT NOT NULL, matter_number TEXT, default_rate REAL, is_active INTEGER DEFAULT 1, created_at INTEGER DEFAULT (strftime('%s','now') * 1000));
	CREATE TABLE billing_rates (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, name TEXT NOT NULL, hourly_rate REAL NOT NULL, is_default INTEGER DEFAULT 0, created_at INTEGER DEFAULT (strftime('%s','now') * 1000));
	CREATE TABLE time_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, matter_id INTEGER, rate_id INTEGER, start_time INTEGER NOT NULL, end_time INTEGER, duration_tenths REAL, utbms_task TEXT, utbms_activity TEXT, description TEXT NOT NULL, is_billable INTEGER DEFAULT 1, created_at INTEGER DEFAULT (strftime('%s','now') * 1000), FOREIGN KEY (matter_id) REFERENCES matters(id), FOREIGN KEY (rate_id) REFERENCES billing_rates(id));
	CREATE INDEX idx_entries_workspace ON time_entries(workspace_id, start_time);
	CREATE INDEX idx_entries_matter ON time_entries(matter_id);
	CREATE INDEX idx_matters_workspace ON matters(workspace_id);
	CREATE INDEX idx_rates_workspace ON billing_rates(workspace_id);`;

const expectedSchemaObjects = [
	'index:idx_entries_matter', 'index:idx_entries_workspace', 'index:idx_matters_workspace',
	'index:idx_rates_workspace', 'table:billing_rates', 'table:matters', 'table:time_entries'
];
const expectedColumns: Record<TableName, readonly string[]> = {
	matters: ['id', 'workspace_id', 'client_name', 'matter_name', 'matter_number', 'default_rate', 'is_active', 'created_at'],
	billing_rates: ['id', 'workspace_id', 'name', 'hourly_rate', 'is_default', 'created_at'],
	time_entries: ['id', 'workspace_id', 'matter_id', 'rate_id', 'start_time', 'end_time', 'duration_tenths', 'utbms_task', 'utbms_activity', 'description', 'is_billable', 'created_at']
};
const expectedIndexes: Readonly<Record<string, readonly string[]>> = {
	idx_entries_workspace: ['workspace_id', 'start_time'], idx_entries_matter: ['matter_id'],
	idx_matters_workspace: ['workspace_id'], idx_rates_workspace: ['workspace_id']
};

function schemaFingerprint(database: Database.Database): string {
	return JSON.stringify({
		tables: Object.fromEntries(tables.map(table => [table, database.pragma(`table_info(${table})`)])),
		foreignKeys: Object.fromEntries(tables.map(table => [table, database.pragma(`foreign_key_list(${table})`)])),
		indexes: Object.fromEntries(Object.keys(expectedIndexes).sort().map(name => [name, database.pragma(`index_info(${name})`)]))
	});
}

class NativeDirectoryAdapter implements MigrationDirectoryLock {
	private readonly handles = new Map<string, NativeFile>();

	constructor(private readonly directory: NativeDirectory, private readonly lock: NativeLock) {}

	private replaceHandle(name: string, handle: NativeFile): void {
		this.handles.get(name)?.close();
		this.handles.set(name, handle);
	}

	async observeExact(names: readonly string[]): Promise<ReadonlyMap<string, FileIdentity>> {
		const observed = new Map<string, FileIdentity>();
		for (const name of names) {
			try {
				const handle = this.directory.openRegularFile(name, false);
				this.replaceHandle(name, handle);
				observed.set(name, handle.identity);
			} catch (error) {
				if (!(error instanceof Error) || !['SA_FS_NOT_FOUND', 'ENOENT'].includes(errorCode(error) ?? '')) {
					throw error;
				}
				this.handles.get(name)?.close();
				this.handles.delete(name);
			}
		}
		return observed;
	}

	async quarantineCurrent(sourceName: string, quarantineName: string, expected: FileIdentity): Promise<FileIdentity> {
		const handle = this.requireHandle(sourceName, expected);
		const quarantined = this.lock.quarantineCurrent(sourceName, quarantineName, handle);
		this.handles.delete(sourceName);
		handle.close();
		this.replaceHandle(quarantineName, quarantined);
		return quarantined.identity;
	}

	async deleteQuarantine(quarantineName: string, expected: FileIdentity): Promise<void> {
		const handle = this.requireHandle(quarantineName, expected);
		this.lock.deleteQuarantine(quarantineName, handle);
		this.handles.delete(quarantineName);
		handle.close();
	}

	async activateCandidateNoReplace(candidateName: string, destinationName: string, expected: FileIdentity): Promise<FileIdentity> {
		const handle = this.requireHandle(candidateName, expected);
		this.lock.activateStagedNoReplace(candidateName, handle, destinationName);
		this.handles.delete(candidateName);
		this.handles.set(destinationName, handle);
		return handle.identity;
	}

	async fsyncDirectory(): Promise<void> { this.lock.fsyncDirectory(); }

	get directoryPath(): string { return this.lock.directoryPath; }

	create(name: string): NativeFile {
		const handle = this.lock.createStagedFile(name);
		this.replaceHandle(name, handle);
		return handle;
	}

	open(name: string, identity: FileIdentity, writable: boolean): NativeFile {
		const handle = this.directory.openRegularFile(name, writable);
		if (!sameIdentity(handle.identity, identity)) {
			handle.close();
			throw new Error(`Identity changed while opening ${name}`);
		}
		this.replaceHandle(name, handle);
		return handle;
	}

	validate(name: string, handle: NativeFile): FileIdentity { return this.lock.validateStagedFile(name, handle); }

	close(): void {
		const errors: object[] = [];
		for (const handle of this.handles.values()) { try { handle.close(); } catch (error) { errors.push(error); } }
		this.handles.clear();
		try { this.lock.close(); } catch (error) { errors.push(error); }
		try { this.directory.close(); } catch (error) { errors.push(error); }
		if (errors.length > 0) { throw new AggregateError(errors, 'Native migration directory cleanup failed'); }
	}

	private requireHandle(name: string, expected: FileIdentity): NativeFile {
		const handle = this.handles.get(name) ?? this.open(name, expected, true);
		if (!sameIdentity(handle.identity, expected)) { throw new Error(`Identity changed for ${name}`); }
		return handle;
	}
}

class MissingDirectoryAdapter implements MigrationDirectoryLock {
	async observeExact(): Promise<ReadonlyMap<string, FileIdentity>> { return new Map(); }
	async quarantineCurrent(): Promise<FileIdentity> { throw new Error('Legacy directory is absent'); }
	async deleteQuarantine(): Promise<void> { throw new Error('Legacy directory is absent'); }
	async activateCandidateNoReplace(): Promise<FileIdentity> { throw new Error('Legacy directory is absent'); }
	async fsyncDirectory(): Promise<void> {}
	close(): void {}
}

class EncryptedManifestStore implements ManifestStore {
	private identity: FileIdentity | undefined;
	private handle: NativeFile | undefined;

	constructor(
		private readonly directory: NativeDirectory,
		private readonly lock: NativeLock,
		private readonly dek: Buffer
	) {}

	async open(): Promise<MigrationManifest | undefined> {
		try {
			this.handle?.close();
			this.handle = this.directory.openRegularFile(manifestName, false);
			this.identity = this.handle.identity;
			return JSON.parse(open(fs.readFileSync(this.handle.descriptorPath), this.dek).toString('utf8')) as MigrationManifest;
		} catch (error) {
			if (error instanceof Error && ['SA_FS_NOT_FOUND', 'ENOENT'].includes(errorCode(error) ?? '')) { return undefined; }
			throw error;
		}
	}

	async store(manifest: MigrationManifest): Promise<void> {
		const temporary = `.safeappeals-tx-manifest-${randomBytes(8).toString('hex')}`;
		this.identity = this.lock.writeEncryptedManifest(
			temporary, seal(Buffer.from(JSON.stringify(manifest)), this.dek), this.identity);
		this.handle?.close();
		this.handle = this.directory.openRegularFile(manifestName, false);
		if (!sameIdentity(this.handle.identity, this.identity)) { throw new Error('Committed manifest identity changed'); }
	}

	async remove(): Promise<void> {
		if (!this.identity) { return; }
		this.handle ??= this.directory.openRegularFile(manifestName, false);
		const quarantine = `.safeappeals-tx-manifest-${randomBytes(8).toString('hex')}`;
		let held: NativeFile | undefined;
		try {
			held = this.lock.quarantineCurrent(manifestName, quarantine, this.handle);
			this.lock.fsyncDirectory();
			this.lock.deleteQuarantine(quarantine, held);
			this.lock.fsyncDirectory();
			this.identity = undefined;
		} finally {
			this.handle.close();
			this.handle = undefined;
			held?.close();
		}
	}

	close(): void { this.handle?.close(); }
}

class SqliteSourceAdapter implements MigrationSourceAdapter {
	private database: CipherDatabase | undefined;
	private rows: Record<TableName, Row[]> | undefined;
	private heldSchemaVersion: number | undefined;

	constructor(private readonly lock: NativeDirectoryAdapter | undefined, private readonly nativeBinding: string) {}

	async describeHeldSnapshot(): Promise<SourceDescription | undefined> {
		if (!this.lock) { return undefined; }
		const observed = await this.lock.observeExact([databaseName, `${databaseName}-wal`, `${databaseName}-shm`]);
		if (!observed.has(databaseName)) {
			if (observed.size > 0) { throw new Error('Orphan legacy SQLite sidecar found'); }
			return undefined;
		}
		if (observed.has(`${databaseName}-shm`) && !observed.has(`${databaseName}-wal`)) {
			throw new Error('Legacy SQLite SHM exists without its WAL');
		}
		this.database = openDatabase(this.lock.directoryPath, databaseName, this.nativeBinding);
		this.database.exec('BEGIN IMMEDIATE');
		const pinned = await this.lock.observeExact([databaseName, `${databaseName}-wal`, `${databaseName}-shm`]);
		if (!pinned.has(databaseName) || pinned.has(`${databaseName}-shm`) && !pinned.has(`${databaseName}-wal`)) {
			throw new Error('Legacy SQLite family changed while acquiring its snapshot');
		}
		this.rows = snapshotRows(this.database);
		this.heldSchemaVersion = this.database.pragma('user_version', { simple: true }) as number;
		return {
			members: [...pinned].map(([name, identity]) => ({ name, identity })),
			schemaVersion: this.heldSchemaVersion,
			rowCounts: rowCounts(this.database), semanticDigest: digest(this.rows)
		};
	}

	get snapshot(): Record<TableName, Row[]> {
		if (!this.rows) { throw new Error('Legacy snapshot is not held'); }
		return this.rows;
	}

	async ensureSnapshot(): Promise<Record<TableName, Row[]>> {
		if (!this.rows && !await this.describeHeldSnapshot()) { throw new Error('Legacy source disappeared before candidate recovery'); }
		return this.snapshot;
	}

	get schemaVersion(): number {
		if (this.heldSchemaVersion === undefined) { throw new Error('Legacy schema version is not held'); }
		return this.heldSchemaVersion;
	}

	close(): void {
		const database = this.database;
		this.database = undefined;
		if (!database) { return; }
		let rollbackError: object | undefined;
		try { if (database.inTransaction) { database.exec('ROLLBACK'); } } catch (error) { rollbackError = error; }
		try { database.close(); } catch (error) { throw new AggregateError([...(rollbackError ? [rollbackError] : []), error], 'Source close failed'); }
		if (rollbackError) { throw rollbackError; }
	}
}

class SqliteCandidateAdapter implements MigrationCandidateAdapter {
	private database: CipherDatabase | undefined;
	private handle: NativeFile | undefined;
	private name: string | undefined;

	constructor(
		private readonly lock: NativeDirectoryAdapter, private readonly source: SqliteSourceAdapter,
		private readonly managedId: string, private readonly dek: Buffer, private readonly nativeBinding: string,
		private readonly faults: StorageMigrationAdapterFaults = {}
	) {}

	async verifyExistingDestination(name: string, identity: FileIdentity): Promise<void> {
		await this.reopenAndVerify(name, identity, -1, {} as Record<TableName, number>, '');
	}

	async createNoReplace(name: string): Promise<FileIdentity> {
		this.handle = this.lock.create(name);
		this.name = name;
		this.database = openDatabase(this.lock.directoryPath, name, this.nativeBinding);
		applyCipher(this.database, this.dek);
		this.database.prepare('SELECT count(*) FROM sqlite_master').get();
		return this.lock.validate(name, this.handle);
	}

	async openExisting(name: string, expectedIdentity: FileIdentity): Promise<void> {
		this.handle = this.lock.open(name, expectedIdentity, true);
		this.name = name;
		this.database = openDatabase(this.lock.directoryPath, name, this.nativeBinding);
		applyCipher(this.database, this.dek);
		this.database.prepare('SELECT count(*) FROM sqlite_master').get();
	}

	async resetForImport(): Promise<void> {
		const database = this.requireDatabase();
		await this.source.ensureSnapshot();
		database.exec(`BEGIN IMMEDIATE;
			DROP TABLE IF EXISTS time_entries; DROP TABLE IF EXISTS billing_rates; DROP TABLE IF EXISTS matters;
			DROP INDEX IF EXISTS idx_entries_workspace; DROP INDEX IF EXISTS idx_entries_matter; DROP INDEX IF EXISTS idx_matters_workspace; DROP INDEX IF EXISTS idx_rates_workspace;
			${productionSchema}
			COMMIT;`);
		database.pragma(`user_version=${this.source.schemaVersion}`);
	}

	async importHeldSnapshot(): Promise<void> {
		const database = this.requireDatabase();
		const snapshot = await this.source.ensureSnapshot();
		const importing = database.transaction(() => {
			for (const table of tables) {
				for (const row of snapshot[table]) {
					const columns = Object.keys(row);
					database.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(column => `@${column}`).join(',')})`).run(row);
				}
			}
		});
		importing();
	}

	async rewriteWorkspaceId(): Promise<void> {
		const database = this.requireDatabase();
		const rewriting = database.transaction(() => {
			for (const table of tables) { database.prepare(`UPDATE ${table} SET workspace_id = ?`).run(this.managedId); }
		});
		rewriting();
	}

	async verify(schemaVersion: number, expectedCounts: Readonly<Record<string, number>>, semanticDigest: string): Promise<void> {
		const database = this.requireDatabase();
		const actualRows = snapshotRows(database);
		const actualCounts = rowCounts(database);
		if (schemaVersion >= 0 && (database.pragma('user_version', { simple: true }) as number) !== schemaVersion) { throw new Error('Schema version mismatch'); }
		if (tables.some(table => actualCounts[table] !== expectedCounts[table])) { throw new Error('Row count mismatch'); }
		if (semanticDigest && digest(actualRows) !== semanticDigest) { throw new Error('Semantic digest mismatch'); }
		this.verifyStructure(database);
		if ((database.pragma('integrity_check', { simple: true }) as string) !== 'ok') { throw new Error('SQLite integrity check failed'); }
		if ((database.pragma('foreign_key_check') as object[]).length > 0) { throw new Error('SQLite foreign key check failed'); }
		const cipher = database.pragma('cipher_integrity_check', { simple: true }) as string | undefined;
		if (cipher && cipher !== 'ok') { throw new Error('SQLCipher integrity check failed'); }
	}

	async close(): Promise<void> {
		const database = this.database;
		if (!database) { return; }
		let checkpointError: object | undefined;
		try {
			const checkpoint = this.faults.checkpoint?.(database)
				?? database.pragma('wal_checkpoint(TRUNCATE)') as { busy: number; log: number; checkpointed: number }[];
			if (checkpoint.length !== 1 || checkpoint[0]!.busy !== 0
				|| checkpoint[0]!.log !== checkpoint[0]!.checkpointed) { checkpointError = new Error('Candidate WAL checkpoint was incomplete'); }
		} catch (error) { checkpointError = error; }
		let closeError: object | undefined;
		try { database.close(); } catch (error) { closeError = error; }
		this.database = undefined;
		const sidecars = await this.lock.observeExact([`${this.name}-wal`, `${this.name}-shm`]);
		const errors = [...(checkpointError ? [checkpointError] : []), ...(closeError ? [closeError] : [])];
		if (sidecars.size > 0) { errors.push(new Error('Candidate SQLite sidecars remain after checkpoint and close')); }
		await this.lock.fsyncDirectory();
		if (errors.length > 0) { throw new AggregateError(errors, 'Candidate close or checkpoint failed'); }
	}

	async fsync(): Promise<void> {
		if (!this.handle || !this.name) { throw new Error('Candidate is not open'); }
		this.lock.validate(this.name, this.handle);
		this.handle.fsync();
	}

	async reopenAndVerify(name: string, expectedIdentity: FileIdentity, schemaVersion: number, counts: Readonly<Record<string, number>>, semanticDigest: string): Promise<void> {
		await this.close();
		let verificationError: object | undefined;
		try {
			await this.openExisting(name, expectedIdentity);
			const header = Buffer.alloc(16);
			const descriptor = fs.openSync(this.handle!.descriptorPath, 'r');
			try { fs.readSync(descriptor, header, 0, header.length, 0); } finally { fs.closeSync(descriptor); }
			if (header.equals(Buffer.from('SQLite format 3\0'))) { throw new Error('Candidate database is plaintext'); }
			if (schemaVersion >= 0) { await this.verify(schemaVersion, counts, semanticDigest); }
			else { this.verifyStructure(this.requireDatabase()); }
		} catch (error) { verificationError = error; }
		try { await this.close(); } catch (error) {
			throw new AggregateError([...(verificationError ? [verificationError] : []), error], 'Candidate verification and close failed');
		}
		if (verificationError) { throw verificationError; }
	}

	private verifyStructure(database: CipherDatabase): void {
		const objects = (database.prepare("SELECT type || ':' || name AS value FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY value").all() as { value: string }[]).map(row => row.value);
		if (JSON.stringify(objects) !== JSON.stringify(expectedSchemaObjects)) { throw new Error('Database schema or indexes do not match production'); }
		const reference = new Database(':memory:', { nativeBinding: this.nativeBinding });
		try {
			reference.exec(productionSchema);
			if (schemaFingerprint(database) !== schemaFingerprint(reference)) { throw new Error('Database schema metadata does not match production'); }
		} finally { reference.close(); }
		for (const table of tables) {
			const columns = (database.pragma(`table_info(${table})`) as { name: string }[]).map(column => column.name);
			if (JSON.stringify(columns) !== JSON.stringify(expectedColumns[table])) { throw new Error(`Column schema mismatch for ${table}`); }
			const invalidWorkspace = database.prepare(`SELECT 1 FROM ${table} WHERE typeof(workspace_id) != 'text' OR workspace_id != ? LIMIT 1`).get(this.managedId);
			if (invalidWorkspace) { throw new Error(`Workspace identity mismatch in ${table}`); }
		}
		for (const [name, expected] of Object.entries(expectedIndexes)) {
			const columns = (database.pragma(`index_info(${name})`) as { name: string }[]).map(column => column.name);
			if (JSON.stringify(columns) !== JSON.stringify(expected)) { throw new Error(`Index schema mismatch for ${name}`); }
		}
		const version = database.pragma('user_version', { simple: true }) as number;
		if (!Number.isSafeInteger(version) || version < 0 || version > 7) { throw new Error('Unsupported database schema version'); }
		const cipher = database.pragma('cipher_integrity_check', { simple: true }) as string | undefined;
		if (cipher && cipher !== 'ok') { throw new Error('SQLCipher integrity check failed'); }
		if ((database.pragma('integrity_check', { simple: true }) as string) !== 'ok'
			|| (database.pragma('foreign_key_check') as object[]).length > 0) { throw new Error('Database integrity verification failed'); }
	}

	private requireDatabase(): CipherDatabase {
		if (!this.database) { throw new Error('Candidate database is not open'); }
		return this.database;
	}
}

/** Owns all native locks, held file handles, SQLite connections, and migration adapters. */
export class StorageMigrationAdapterSession {
	readonly dependencies: MigrationEngineDependencies;

	private constructor(
		private readonly managed: NativeDirectoryAdapter, private readonly sourceLock: NativeDirectoryAdapter | MissingDirectoryAdapter,
		private readonly manifest: EncryptedManifestStore, private readonly source: SqliteSourceAdapter,
		private readonly candidate: SqliteCandidateAdapter, names: MigrationNames, reporter: MigrationReporter
	) {
		this.dependencies = { names, manifest, sourceLock, managedLock: managed, source, candidate, reporter };
	}

	static async create(options: {
		readonly globalStoragePath: string; readonly managedId: string; readonly legacyId: string;
		readonly homePath: string; readonly dek: Buffer; readonly native: StorageMigrationNativeBinding;
		readonly sqliteNativeBinding: string; readonly logger: MigrationReporter;
		readonly faults?: StorageMigrationAdapterFaults;
	}): Promise<StorageMigrationAdapterSession> {
		const managedDirectory = options.native.bootstrapPrivateDirectory(options.globalStoragePath, ['workspaces', options.managedId]);
		let legacyDirectory: NativeDirectory | undefined;
		let managedNativeLock: NativeLock | undefined;
		let legacyNativeLock: NativeLock | undefined;
		let manifest: EncryptedManifestStore | undefined;
		try {
			managedNativeLock = managedDirectory.acquireExclusiveLock();
			const managed = new NativeDirectoryAdapter(managedDirectory, managedNativeLock);
			let legacy: NativeDirectoryAdapter | MissingDirectoryAdapter;
			try {
				legacyDirectory = options.native.openLegacyWorkspace(options.homePath, options.legacyId);
				legacyNativeLock = legacyDirectory.acquireExclusiveLock();
				legacy = new NativeDirectoryAdapter(legacyDirectory, legacyNativeLock);
			} catch (error) {
				if (!(error instanceof Error) || !['SA_FS_NOT_FOUND', 'ENOENT'].includes(errorCode(error) ?? '')) { throw error; }
				legacy = new MissingDirectoryAdapter();
			}
			manifest = new EncryptedManifestStore(managedDirectory, managedNativeLock, options.dek);
			const existing = await manifest.open();
			const txid = existing?.txid ?? randomBytes(16).toString('hex');
			const names: MigrationNames = {
				txid, candidateName: `.safeappeals-tx-db-${txid}`, destinationName: databaseName,
				quarantineName: (transaction, sourceName) => `.safeappeals-tx-${transaction}-${sourceName}`
			};
			const source = new SqliteSourceAdapter(legacy instanceof NativeDirectoryAdapter ? legacy : undefined, options.sqliteNativeBinding);
			const candidate = new SqliteCandidateAdapter(managed, source, options.managedId, options.dek, options.sqliteNativeBinding, options.faults);
			return new StorageMigrationAdapterSession(managed, legacy, manifest, source, candidate, names, options.logger);
		} catch (error) {
			const cleanupErrors: object[] = [];
			for (const cleanup of [
				() => manifest?.close(), () => legacyNativeLock?.close(), () => managedNativeLock?.close(),
				() => legacyDirectory?.close(), () => managedDirectory.close()
			]) { try { cleanup(); } catch (cleanupError) { cleanupErrors.push(cleanupError); } }
			if (cleanupErrors.length > 0) { throw new AggregateError([error, ...cleanupErrors], 'Migration session creation and cleanup failed', { cause: error }); }
			throw error;
		}
	}

	async dispose(): Promise<void> {
		const errors: object[] = [];
		for (const cleanup of [
			async () => this.candidate.close(),
			async () => this.source.close(),
			async () => this.manifest.close(),
			async () => this.sourceLock.close(),
			async () => this.managed.close()
		]) {
			try { await cleanup(); } catch (error) { errors.push(error); }
		}
		if (errors.length > 0) { throw new AggregateError(errors, 'Migration adapter cleanup failed'); }
	}
}

const managedWorkspaceId = /^[a-f0-9]{64}$/;
const legacyWorkspaceId = /^[a-f0-9]{16}$/;
const transactionId = /^[a-f0-9]{16,128}$/;
const historicalCorrupt = /^timetracker\.db(?:-wal|-shm)?\.corrupt-\d{4}-\d{2}-\d{2}T[0-9A-Za-z.+-]+$/;
const candidateArtifact = /^\.safeappeals-tx-db-[a-f0-9]{16,128}(?:-wal|-shm)?$/;
const quarantineArtifact = /^\.safeappeals-tx-[a-f0-9]{16,128}-timetracker\.db(?:-wal|-shm)?$/;
const manifestTemporary = /^\.safeappeals-tx-manifest-[a-f0-9]{16}$/;
const purgeTemporary = /^\.safeappeals-tx-purge-[a-f0-9]{16}-(?:timetracker\.db(?:-wal|-shm)?(?:\.corrupt-[0-9A-Za-z.+-]+)?|\.timetracker-migration-v1\.saenc|\.safeappeals-tx-(?:db-[a-f0-9]{16,128}(?:-wal|-shm)?|[a-f0-9]{16,128}-timetracker\.db(?:-wal|-shm)?|manifest-[a-f0-9]{16}|sensitive-state-(?:delete-)?[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}))$/;

async function purgeWorkspaceDirectory(directory: NativeDirectory, dek?: Buffer): Promise<number> {
	const lock = directory.acquireExclusiveLock();
	const adapter = new NativeDirectoryAdapter(directory, lock);
	try {
		const entries = directory.enumerateChildren(4096);
		const entryNames = new Set(entries.map(entry => entry.name));
		let manifest: MigrationManifest | undefined;
		if (entryNames.has(manifestName)) {
			if (dek) {
				const held = directory.openRegularFile(manifestName, false);
				try { manifest = JSON.parse(open(fs.readFileSync(held.descriptorPath), dek).toString('utf8')) as MigrationManifest; }
				catch (error) { throw new Error(`Migration manifest could not be authenticated: ${error instanceof Error ? error.message : String(error)}`); }
				finally { held.close(); }
				if (!transactionId.test(manifest.txid)) { throw new Error('Migration manifest transaction is invalid'); }
			}
		}
		const allowedMigration = new Set<string>();
		if (manifest) {
			for (const suffix of ['', '-wal', '-shm']) {
				allowedMigration.add(`.safeappeals-tx-db-${manifest.txid}${suffix}`);
				allowedMigration.add(`.safeappeals-tx-${manifest.txid}-${databaseName}${suffix}`);
			}
		}
		const active = new Set([databaseName, `${databaseName}-wal`, `${databaseName}-shm`]);
		const targets: string[] = [];
		for (const entry of entries) {
			const strictCrashArtifact = manifestTemporary.test(entry.name) || sensitiveStateTemporaryNamePattern.test(entry.name)
				|| sensitiveStateDeleteNamePattern.test(entry.name)
				|| purgeTemporary.test(entry.name);
			const keylessTransactionArtifact = !dek && (candidateArtifact.test(entry.name) || quarantineArtifact.test(entry.name));
			const owned = active.has(entry.name) || historicalCorrupt.test(entry.name) || strictCrashArtifact
				|| allowedMigration.has(entry.name) || entry.name === manifestName || keylessTransactionArtifact;
			if ((entry.name.startsWith('.safeappeals-tx-') || entry.name === manifestName) && !owned) {
				throw new Error(`Unknown migration artifact blocks purge: ${entry.name}`);
			}
			if (!owned) { continue; }
			if (entry.kind !== 'file' || entry.linkCount !== 1 || entry.mode !== 0o600) {
				throw new Error(`Owned purge artifact is not a private regular file: ${entry.name}`);
			}
			targets.push(entry.name);
		}
		let purged = 0;
		for (const name of targets.sort((left, right) => left === manifestName ? 1 : right === manifestName ? -1 : left.localeCompare(right))) {
			const observed = await adapter.observeExact([name]);
			const identity = observed.get(name);
			if (!identity) { continue; }
			const quarantine = `.safeappeals-tx-purge-${randomBytes(8).toString('hex')}-${name.replace(/[^A-Za-z0-9._-]/g, '_')}`;
			const moved = await adapter.quarantineCurrent(name, quarantine, identity);
			await adapter.fsyncDirectory();
			await adapter.deleteQuarantine(quarantine, moved);
			await adapter.fsyncDirectory();
			purged++;
		}
		const remaining = directory.enumerateChildren(4096).map(entry => entry.name);
		if (remaining.some(name => active.has(name) || historicalCorrupt.test(name)
			|| name === manifestName || name.startsWith('.safeappeals-tx-'))) {
			throw new Error('Owned storage artifacts remain after purge');
		}
		return purged;
	} finally {
		adapter.close();
	}
}

/** Descriptor-relative database purge factories. They never delete encryption keys or markers. */
export class StorageMigrationPurge {
	static async current(options: {
		readonly globalStoragePath: string; readonly managedId: string; readonly legacyId: string;
		readonly homePath: string; readonly dek?: Buffer; readonly native: StorageMigrationNativeBinding;
	}): Promise<StoragePurgeResult> {
		if (!managedWorkspaceId.test(options.managedId) || !legacyWorkspaceId.test(options.legacyId)) {
			return { kind: 'blocked', reason: 'Workspace identifiers are invalid', purgedFiles: 0, scannedWorkspaces: 0 };
		}
		let purgedFiles = 0;
		let scannedWorkspaces = 0;
		try {
			const managed = options.native.bootstrapPrivateDirectory(options.globalStoragePath, ['workspaces', options.managedId]);
			purgedFiles += await purgeWorkspaceDirectory(managed, options.dek);
			scannedWorkspaces++;
			try {
				const legacy = options.native.openLegacyWorkspace(options.homePath, options.legacyId);
				purgedFiles += await purgeWorkspaceDirectory(legacy, options.dek);
				scannedWorkspaces++;
			} catch (error) {
				if (!(error instanceof Error) || !['SA_FS_NOT_FOUND', 'ENOENT'].includes(errorCode(error) ?? '')) { throw error; }
			}
			return { kind: 'complete', purgedFiles, scannedWorkspaces };
		} catch (error) {
			return { kind: 'blocked', reason: error instanceof Error ? error.message : String(error), purgedFiles, scannedWorkspaces };
		}
	}

	static async all(options: {
		readonly globalStoragePath: string; readonly homePath: string; readonly dek?: Buffer;
		readonly native: StorageMigrationNativeBinding;
	}): Promise<StoragePurgeResult> {
		let purgedFiles = 0;
		let scannedWorkspaces = 0;
		try {
			const managedRoot = options.native.bootstrapPrivateDirectory(options.globalStoragePath, ['workspaces']);
			try {
				for (const entry of managedRoot.enumerateChildren(4096)) {
					if (!managedWorkspaceId.test(entry.name)) { continue; }
					purgedFiles += await purgeWorkspaceDirectory(managedRoot.openPrivateChild(entry.name), options.dek);
					scannedWorkspaces++;
				}
			} finally { managedRoot.close(); }
			const legacyRoot = options.native.openLegacyWorkspaces(options.homePath);
			if (legacyRoot) {
				try {
					for (const id of legacyRoot.enumerateWorkspaceIds(4096)) {
						if (!legacyWorkspaceId.test(id)) { continue; }
						purgedFiles += await purgeWorkspaceDirectory(legacyRoot.openWorkspace(id), options.dek);
						scannedWorkspaces++;
					}
				} finally { legacyRoot.close(); }
			}
			return { kind: 'complete', purgedFiles, scannedWorkspaces };
		} catch (error) {
			return { kind: 'blocked', reason: error instanceof Error ? error.message : String(error), purgedFiles, scannedWorkspaces };
		}
	}
}
