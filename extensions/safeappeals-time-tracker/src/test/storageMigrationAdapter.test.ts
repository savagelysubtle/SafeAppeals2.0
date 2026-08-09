/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import { randomBytes, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Database = require('better-sqlite3-multiple-ciphers');
import { MigrationEngine } from '../migrationEngine';
import { StorageMigrationAdapterSession, StorageMigrationPurge, type StorageMigrationNativeBinding } from '../storageMigrationAdapter';
import { getLegacyTimeTrackerWorkspaceId, getTimeTrackerWorkspaceId, serializeTimeTrackerWorkspaceIdentity } from '../workspaceIdentity';

type CipherDatabase = Database.Database & { key(key: Buffer): void };

const workspacePath = '/test/storage-migration-adapter';
const legacyId = 'c1eabad98bf9caaa';
const managedId = getTimeTrackerWorkspaceId('/unused', serializeTimeTrackerWorkspaceIdentity(undefined, [workspacePath]));
const runtime = `node-${process.versions.modules}`;
const prebuilds = path.join(__dirname, '..', '..', 'prebuilds', `${process.platform}-${process.arch}`, runtime);
const sqliteNativeBinding = path.join(prebuilds, 'better_sqlite3.node');
const secureFsBinding = path.join(prebuilds, 'safeappeals_secure_fs.node');
const native = require(secureFsBinding) as StorageMigrationNativeBinding;

interface Fixture {
	readonly root: string;
	readonly homePath: string;
	readonly globalStoragePath: string;
	readonly legacyDirectory: string;
	readonly managedDirectory: string;
	readonly dek: Buffer;
}

function mode(filePath: string): number {
	return fs.statSync(filePath).mode & 0o777;
}

function createFixture(): Fixture {
	assert.strictEqual(getLegacyTimeTrackerWorkspaceId(workspacePath), legacyId);
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-migration-adapter-'));
	const homePath = path.join(root, 'home');
	const globalStoragePath = path.join(root, 'private');
	const legacyDirectory = path.join(homePath, '.safe-appeals-navigator', 'databases', 'workspaces', legacyId);
	const managedDirectory = path.join(globalStoragePath, 'workspaces', managedId);
	fs.mkdirSync(homePath, { mode: 0o755 });
	fs.mkdirSync(globalStoragePath, { mode: 0o700 });
	fs.mkdirSync(legacyDirectory, { recursive: true, mode: 0o700 });
	fs.chmodSync(path.join(homePath, '.safe-appeals-navigator'), 0o755);
	fs.chmodSync(path.join(homePath, '.safe-appeals-navigator', 'databases'), 0o755);
	fs.chmodSync(path.join(homePath, '.safe-appeals-navigator', 'databases', 'workspaces'), 0o755);
	fs.chmodSync(legacyDirectory, 0o700);
	return { root, homePath, globalStoragePath, legacyDirectory, managedDirectory, dek: randomBytes(32) };
}

function createLegacyDatabase(fixture: Fixture): CipherDatabase {
	const database = new Database(path.join(fixture.legacyDirectory, 'timetracker.db'), { nativeBinding: sqliteNativeBinding }) as CipherDatabase;
	database.pragma('journal_mode=WAL');
	database.pragma('wal_autocheckpoint=0');
	database.pragma('user_version=7');
	database.exec(`
		CREATE TABLE matters (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, client_name TEXT NOT NULL, matter_name TEXT NOT NULL, matter_number TEXT, default_rate REAL, is_active INTEGER DEFAULT 1, created_at INTEGER);
		CREATE TABLE billing_rates (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, name TEXT NOT NULL, hourly_rate REAL NOT NULL, is_default INTEGER DEFAULT 0, created_at INTEGER);
		CREATE TABLE time_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL, matter_id INTEGER REFERENCES matters(id), rate_id INTEGER REFERENCES billing_rates(id), start_time INTEGER NOT NULL, end_time INTEGER, duration_tenths REAL, utbms_task TEXT, utbms_activity TEXT, description TEXT NOT NULL, is_billable INTEGER DEFAULT 1, created_at INTEGER);
		INSERT INTO matters VALUES (41, '${legacyId}', 'Confidential Client', 'Appeal Matter', 'A-17', 325, 1, 1000);
		INSERT INTO billing_rates VALUES (52, '${legacyId}', 'Senior Counsel', 325, 1, 1001);
		INSERT INTO time_entries VALUES (63, '${legacyId}', 41, 52, 1100, 1460, 1.0, 'A101', 'A106', 'Confidential appeal research', 1, 1002);
	`);
	assert.deepStrictEqual({ wal: fs.existsSync(`${database.name}-wal`), shm: fs.existsSync(`${database.name}-shm`) }, { wal: true, shm: true });
	return database;
}

async function createSession(fixture: Fixture, nativeBinding: StorageMigrationNativeBinding = native): Promise<StorageMigrationAdapterSession> {
	return StorageMigrationAdapterSession.create({
		globalStoragePath: fixture.globalStoragePath, managedId, legacyId, homePath: fixture.homePath,
		dek: fixture.dek, native: nativeBinding, sqliteNativeBinding,
		logger: { log: () => undefined, warn: () => undefined }
	});
}

function openEncryptedDatabase(fixture: Fixture, name = 'timetracker.db'): CipherDatabase {
	const database = new Database(path.join(fixture.managedDirectory, name), { nativeBinding: sqliteNativeBinding }) as CipherDatabase;
	database.pragma('cipher=\'sqlcipher\'');
	database.pragma('legacy=4');
	database.key(fixture.dek);
	return database;
}

function directoryState(directory: string): readonly { readonly name: string; readonly bytes: Buffer }[] {
	return fs.readdirSync(directory).sort().map(name => ({ name, bytes: fs.readFileSync(path.join(directory, name)) }));
}

function nativeFailingOperation(operation: 'quarantineCurrent' | 'deleteQuarantine', message: string): StorageMigrationNativeBinding {
	return {
		...native,
		openLegacyWorkspace: (homePath, workspaceId) => {
			const directory = native.openLegacyWorkspace(homePath, workspaceId);
			return new Proxy(directory, {
				get(target, property) {
					if (property === 'acquireExclusiveLock') {
						return () => {
							const lock = target.acquireExclusiveLock();
							return new Proxy(lock, {
								get(lockTarget, lockProperty) {
									if (lockProperty === operation) { return () => { throw new Error(message); }; }
									const value = Reflect.get(lockTarget, lockProperty);
									return typeof value === 'function' ? value.bind(lockTarget) : value;
								}
							});
						};
					}
					const value = Reflect.get(target, property);
					return typeof value === 'function' ? value.bind(target) : value;
				}
			});
		}
	};
}

suite('StorageMigrationAdapterSession native integration', () => {
	const fixtures: Fixture[] = [];
	teardown(() => {
		for (const fixture of fixtures.splice(0)) { fs.rmSync(fixture.root, { recursive: true, force: true }); }
	});

	test('migrates a live WAL snapshot into a private encrypted managed database', async () => {
		const fixture = createFixture();
		fixtures.push(fixture);
		const legacy = createLegacyDatabase(fixture);
		const unrelated = path.join(fixture.legacyDirectory, 'timetracker.db-backup');
		fs.writeFileSync(unrelated, 'unrelated similarly-prefixed file', { mode: 0o600 });
		const session = await createSession(fixture);
		assert.deepStrictEqual(await new MigrationEngine(session.dependencies).run(), { kind: 'complete' });
		await session.dispose();
		legacy.close();

		const destination = openEncryptedDatabase(fixture);
		const rows = {
			matters: destination.prepare('SELECT id, workspace_id, client_name FROM matters').all(),
			rates: destination.prepare('SELECT id, workspace_id, name FROM billing_rates').all(),
			entries: destination.prepare('SELECT id, workspace_id, matter_id, rate_id, description FROM time_entries').all(),
			foreignKeys: destination.pragma('foreign_key_check')
		};
		destination.close();
		const raw = fs.readFileSync(path.join(fixture.managedDirectory, 'timetracker.db'));
		assert.deepStrictEqual({
			rows,
			containsPlaintext: raw.includes(Buffer.from('Confidential appeal research')) || raw.includes(Buffer.from('Confidential Client')),
			headerIsPlaintext: raw.subarray(0, 16).equals(Buffer.from('SQLite format 3\0')),
			managedModes: [mode(fixture.globalStoragePath), mode(path.join(fixture.globalStoragePath, 'workspaces')), mode(fixture.managedDirectory), mode(path.join(fixture.managedDirectory, 'timetracker.db'))],
			legacyArtifacts: fs.readdirSync(fixture.legacyDirectory).sort(),
			managedArtifacts: fs.readdirSync(fixture.managedDirectory).sort()
		}, {
			rows: {
				matters: [{ id: 41, workspace_id: managedId, client_name: 'Confidential Client' }],
				rates: [{ id: 52, workspace_id: managedId, name: 'Senior Counsel' }],
				entries: [{ id: 63, workspace_id: managedId, matter_id: 41, rate_id: 52, description: 'Confidential appeal research' }],
				foreignKeys: []
			},
			containsPlaintext: false, headerIsPlaintext: false,
			managedModes: [0o700, 0o700, 0o700, 0o600],
			legacyArtifacts: ['timetracker.db-backup'], managedArtifacts: ['timetracker.db']
		});
	});

	test('retains an encrypted manifest, verified candidate, and DEK after native cleanup failure', async () => {
		const fixture = createFixture();
		fixtures.push(fixture);
		const legacy = createLegacyDatabase(fixture);
		const failingNative = nativeFailingOperation('deleteQuarantine', 'injected native cleanup failure');
		const interrupted = await createSession(fixture, failingNative);
		const interruptedResult = await new MigrationEngine(interrupted.dependencies).run();
		const txid = interrupted.dependencies.names.txid;
		await interrupted.dispose();
		legacy.close();
		const candidate = openEncryptedDatabase(fixture, `.safeappeals-tx-db-${txid}`);
		const retainedRows = candidate.prepare('SELECT id, workspace_id FROM time_entries').all();
		candidate.close();
		assert.deepStrictEqual({
			kind: interruptedResult.kind,
			candidate: fs.existsSync(path.join(fixture.managedDirectory, `.safeappeals-tx-db-${txid}`)),
			manifest: fs.existsSync(path.join(fixture.managedDirectory, '.timetracker-migration-v1.saenc')),
			quarantine: fs.existsSync(path.join(fixture.legacyDirectory, `.safeappeals-tx-${txid}-timetracker.db`)),
			retainedRows,
			dekLength: fixture.dek.length
		}, {
			kind: 'blocked', candidate: true, manifest: true, quarantine: true,
			retainedRows: [{ id: 63, workspace_id: managedId }], dekLength: 32
		});
	});

	test('restarts from an existing encrypted manifest and verified candidate', async () => {
		const fixture = createFixture();
		fixtures.push(fixture);
		const legacy = createLegacyDatabase(fixture);
		const interrupted = await createSession(fixture,
			nativeFailingOperation('quarantineCurrent', 'pause after candidate verification'));
		assert.strictEqual((await new MigrationEngine(interrupted.dependencies).run()).kind, 'blocked');
		const txid = interrupted.dependencies.names.txid;
		await interrupted.dispose();

		const restarted = await createSession(fixture);
		assert.strictEqual(restarted.dependencies.names.txid, txid);
		assert.deepStrictEqual(await new MigrationEngine(restarted.dependencies).run(), { kind: 'complete' });
		await restarted.dispose();
		legacy.close();
		assert.deepStrictEqual({ managed: fs.readdirSync(fixture.managedDirectory), legacy: fs.readdirSync(fixture.legacyDirectory) }, {
			managed: ['timetracker.db'], legacy: []
		});
	});

	test('blocks a tampered encrypted manifest without filesystem mutation', async () => {
		const fixture = createFixture();
		fixtures.push(fixture);
		const legacy = createLegacyDatabase(fixture);
		const failingNative = nativeFailingOperation('deleteQuarantine', 'pause before purge');
		const interrupted = await createSession(fixture, failingNative);
		assert.strictEqual((await new MigrationEngine(interrupted.dependencies).run()).kind, 'blocked');
		await interrupted.dispose();
		legacy.close();
		const manifestPath = path.join(fixture.managedDirectory, '.timetracker-migration-v1.saenc');
		const manifest = fs.readFileSync(manifestPath);
		manifest[manifest.length - 1] ^= 0xff;
		fs.writeFileSync(manifestPath, manifest);
		const before = { managed: directoryState(fixture.managedDirectory), legacy: directoryState(fixture.legacyDirectory) };
		let rejection = '';
		try { await createSession(fixture); } catch (error) { rejection = error instanceof Error ? error.message : String(error); }
		assert.deepStrictEqual({ rejected: rejection.includes('authenticate'), unchanged: {
			managed: directoryState(fixture.managedDirectory), legacy: directoryState(fixture.legacyDirectory)
		} }, { rejected: true, unchanged: before });
	});

	test('rejects lock contention while a migration session owns both directories', async () => {
		const fixture = createFixture();
		fixtures.push(fixture);
		createLegacyDatabase(fixture).close();
		const owner = await createSession(fixture);
		await assert.rejects(createSession(fixture), error => error instanceof Error
			&& 'code' in error && error.code === 'SA_FS_LOCKED');
		await owner.dispose();
	});

	test('blocks before verification when the candidate checkpoint is busy', async () => {
		const fixture = createFixture();
		fixtures.push(fixture);
		const legacy = createLegacyDatabase(fixture);
		const session = await StorageMigrationAdapterSession.create({
			globalStoragePath: fixture.globalStoragePath, managedId, legacyId, homePath: fixture.homePath,
			dek: fixture.dek, native, sqliteNativeBinding, logger: { log: () => undefined, warn: () => undefined },
			faults: { checkpoint: () => [{ busy: 1, log: 1, checkpointed: 0 }] }
		});
		const result = await new MigrationEngine(session.dependencies).run();
		const artifacts = fs.readdirSync(fixture.managedDirectory).sort();
		await session.dispose();
		legacy.close();
		assert.deepStrictEqual({ kind: result.kind, destination: artifacts.includes('timetracker.db'),
			candidate: artifacts.some(name => name.startsWith('.safeappeals-tx-db-')), manifest: artifacts.includes('.timetracker-migration-v1.saenc') },
		{ kind: 'blocked', destination: false, candidate: true, manifest: true });
	});

	test('migrates a committed WAL after SQLite rebuilds a missing SHM', async () => {
		const fixture = createFixture();
		fixtures.push(fixture);
		const legacy = createLegacyDatabase(fixture);
		fs.unlinkSync(path.join(fixture.legacyDirectory, 'timetracker.db-shm'));
		const session = await createSession(fixture);
		assert.deepStrictEqual(await new MigrationEngine(session.dependencies).run(), { kind: 'complete' });
		await session.dispose();
		legacy.close();
		const destination = openEncryptedDatabase(fixture);
		const count = destination.prepare('SELECT count(*) AS count FROM time_entries').get() as { count: number };
		destination.close();
		assert.deepStrictEqual(count, { count: 1 });
	});

	test('rejects plaintext, wrong-schema, and foreign-key-invalid unmanaged destinations', async () => {
		const outcomes: string[] = [];
		for (const corruption of ['plaintext', 'schema', 'foreign-key'] as const) {
			const fixture = createFixture();
			fixtures.push(fixture);
			const legacy = createLegacyDatabase(fixture);
			const migration = await createSession(fixture);
			assert.deepStrictEqual(await new MigrationEngine(migration.dependencies).run(), { kind: 'complete' });
			await migration.dispose();
			legacy.close();
			const destinationPath = path.join(fixture.managedDirectory, 'timetracker.db');
			if (corruption === 'plaintext') {
				fs.unlinkSync(destinationPath);
				const plaintext = new Database(destinationPath, { nativeBinding: sqliteNativeBinding });
				plaintext.exec('CREATE TABLE matters (workspace_id TEXT)');
				plaintext.close();
			} else {
				const destination = openEncryptedDatabase(fixture);
				if (corruption === 'schema') { destination.exec('DROP INDEX idx_rates_workspace'); }
				else if (corruption === 'foreign-key') {
					destination.pragma('foreign_keys=OFF');
					destination.exec(`INSERT INTO time_entries VALUES (999, '${managedId}', 999, NULL, 1, NULL, NULL, NULL, NULL, 'invalid', 1, 1)`);
				}
				destination.close();
			}
			const verification = await createSession(fixture);
			outcomes.push((await new MigrationEngine(verification.dependencies).run()).kind);
			await verification.dispose();
		}
		assert.deepStrictEqual(outcomes, ['blocked', 'blocked', 'blocked']);
	});

	test('rejects an encrypted database copied from another workspace', async () => {
		const fixture = createFixture();
		fixtures.push(fixture);
		const legacy = createLegacyDatabase(fixture);
		const migration = await createSession(fixture);
		assert.strictEqual((await new MigrationEngine(migration.dependencies).run()).kind, 'complete');
		await migration.dispose();
		legacy.close();
		const destination = openEncryptedDatabase(fixture);
		destination.exec("UPDATE matters SET workspace_id = 'copied-from-another-workspace'");
		destination.close();
		const verification = await createSession(fixture);
		const result = await new MigrationEngine(verification.dependencies).run();
		await verification.dispose();
		assert.strictEqual(result.kind, 'blocked');
	});

	test('purges current exact database artifacts while preserving unrelated and sensitive state', async () => {
		const fixture = createFixture();
		fixtures.push(fixture);
		fs.mkdirSync(fixture.managedDirectory, { recursive: true, mode: 0o700 });
		fs.writeFileSync(path.join(fixture.managedDirectory, 'timetracker.db'), 'db', { mode: 0o600 });
		fs.writeFileSync(path.join(fixture.managedDirectory, 'timetracker.db-backup'), 'keep', { mode: 0o600 });
		fs.writeFileSync(path.join(fixture.managedDirectory, 'sensitive-state.saenc'), 'keep', { mode: 0o600 });
		fs.writeFileSync(path.join(fixture.legacyDirectory, 'timetracker.db-wal.corrupt-2025-01-01T00-00-00.000Z'), 'old', { mode: 0o600 });
		const result = await StorageMigrationPurge.current({
			globalStoragePath: fixture.globalStoragePath, managedId, legacyId,
			homePath: fixture.homePath, dek: fixture.dek, native
		});
		assert.deepStrictEqual({ result, managed: fs.readdirSync(fixture.managedDirectory).sort(), legacy: fs.readdirSync(fixture.legacyDirectory) }, {
			result: { kind: 'complete', purgedFiles: 2, scannedWorkspaces: 2 },
			managed: ['sensitive-state.saenc', 'timetracker.db-backup'], legacy: []
		});
	});

	test('blocks purge on an unknown migration artifact and retains owned files', async () => {
		const fixture = createFixture();
		fixtures.push(fixture);
		fs.mkdirSync(fixture.managedDirectory, { recursive: true, mode: 0o700 });
		fs.writeFileSync(path.join(fixture.managedDirectory, 'timetracker.db'), 'db', { mode: 0o600 });
		fs.writeFileSync(path.join(fixture.managedDirectory, '.safeappeals-tx-unknown'), 'unknown', { mode: 0o600 });
		const result = await StorageMigrationPurge.current({
			globalStoragePath: fixture.globalStoragePath, managedId, legacyId,
			homePath: fixture.homePath, dek: fixture.dek, native
		});
		assert.deepStrictEqual({ kind: result.kind, retained: fs.readdirSync(fixture.managedDirectory).sort() }, {
			kind: 'blocked', retained: ['.safeappeals-tx-unknown', 'timetracker.db']
		});
	});

	test('keyless purge removes only strict manifest, transaction, and crash-temp grammars', async () => {
		const fixture = createFixture();
		fixtures.push(fixture);
		fs.mkdirSync(fixture.managedDirectory, { recursive: true, mode: 0o700 });
		const txid = 'c'.repeat(32);
		for (const name of [
			'timetracker.db', '.timetracker-migration-v1.saenc', `.safeappeals-tx-db-${txid}`,
			`.safeappeals-tx-db-${txid}-wal`, `.safeappeals-tx-${txid}-timetracker.db`,
			'.safeappeals-tx-manifest-0123456789abcdef', `.safeappeals-tx-sensitive-state-${randomUUID()}`
		]) { fs.writeFileSync(path.join(fixture.managedDirectory, name), 'owned', { mode: 0o600 }); }
		fs.writeFileSync(path.join(fixture.managedDirectory, 'timetracker.db-backup'), 'keep', { mode: 0o600 });
		fs.writeFileSync(path.join(fixture.managedDirectory, 'sensitive-state.saenc'), 'keep', { mode: 0o600 });
		const result = await StorageMigrationPurge.current({
			globalStoragePath: fixture.globalStoragePath, managedId, legacyId, homePath: fixture.homePath, native
		});
		assert.deepStrictEqual({ result, remaining: fs.readdirSync(fixture.managedDirectory).sort() }, {
			result: { kind: 'complete', purgedFiles: 7, scannedWorkspaces: 2 },
			remaining: ['sensitive-state.saenc', 'timetracker.db-backup']
		});
	});

	test('purges all validated managed and legacy workspace IDs only', async () => {
		const fixture = createFixture();
		fixtures.push(fixture);
		const secondManaged = 'a'.repeat(64);
		const secondLegacy = 'b'.repeat(16);
		const managedRoot = path.join(fixture.globalStoragePath, 'workspaces');
		for (const id of [managedId, secondManaged]) {
			const directory = path.join(managedRoot, id);
			fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
			fs.writeFileSync(path.join(directory, 'timetracker.db'), 'db', { mode: 0o600 });
		}
		const invalidManaged = path.join(managedRoot, 'not-a-workspace');
		fs.mkdirSync(invalidManaged, { mode: 0o700 });
		fs.writeFileSync(path.join(invalidManaged, 'timetracker.db'), 'keep', { mode: 0o600 });
		const secondLegacyDirectory = path.join(fixture.homePath, '.safe-appeals-navigator', 'databases', 'workspaces', secondLegacy);
		fs.mkdirSync(secondLegacyDirectory, { mode: 0o700 });
		for (const directory of [fixture.legacyDirectory, secondLegacyDirectory]) {
			fs.writeFileSync(path.join(directory, 'timetracker.db'), 'db', { mode: 0o600 });
		}
		const result = await StorageMigrationPurge.all({
			globalStoragePath: fixture.globalStoragePath, homePath: fixture.homePath, native
		});
		assert.deepStrictEqual({ result, managed: [managedId, secondManaged].map(id => fs.readdirSync(path.join(managedRoot, id))),
			legacy: [fixture.legacyDirectory, secondLegacyDirectory].map(directory => fs.readdirSync(directory)),
			invalid: fs.readdirSync(invalidManaged) }, {
			result: { kind: 'complete', purgedFiles: 4, scannedWorkspaces: 4 },
			managed: [[], []], legacy: [[], []], invalid: ['timetracker.db']
		});
	});
});
