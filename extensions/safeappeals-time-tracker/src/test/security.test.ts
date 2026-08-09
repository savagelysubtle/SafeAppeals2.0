/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import { randomBytes, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import Database = require('better-sqlite3-multiple-ciphers');
import type * as vscode from 'vscode';
import { acquireDek, readEncryptedJson, writeEncryptedJson } from '../shared/encryptedStore';
import { SensitiveStateStore } from '../sensitiveStateStore';
import { StorageService } from '../storageService';
import type { CustomUTBMSCodes, TimerState } from '../types';
import { getLegacyTimeTrackerWorkspaceId, getTimeTrackerWorkspaceId } from '../workspaceIdentity';

class MemorySecretStorage implements vscode.SecretStorage {
	private readonly values = new Map<string, string>();
	readonly onDidChange: vscode.Event<vscode.SecretStorageChangeEvent> = () => ({ dispose: () => undefined });

	constructor(private readonly failWrites = false) {}

	get(key: string): Thenable<string | undefined> { return Promise.resolve(this.values.get(key)); }
	keys(): Thenable<string[]> { return Promise.resolve([...this.values.keys()]); }
	store(key: string, value: string): Thenable<void> {
		if (this.failWrites) { return Promise.reject(new Error('injected keyring failure')); }
		this.values.set(key, value);
		return Promise.resolve();
	}
	delete(key: string): Thenable<void> { this.values.delete(key); return Promise.resolve(); }
}

class MemoryMemento implements vscode.Memento {
	private readonly values = new Map<string, unknown>();

	keys(): readonly string[] { return [...this.values.keys()]; }
	get<T>(key: string): T | undefined;
	get<T>(key: string, defaultValue: T): T;
	get<T>(key: string, defaultValue?: T): T | undefined {
		return this.values.has(key) ? this.values.get(key) as T : defaultValue;
	}
	update(key: string, value: unknown): Thenable<void> {
		if (value === undefined) { this.values.delete(key); } else { this.values.set(key, value); }
		return Promise.resolve();
	}
	setKeysForSync(_keys: readonly string[]): void {}
}

interface TestContext {
	readonly globalStorageUri: { readonly fsPath: string };
	readonly secrets: MemorySecretStorage;
	readonly globalState: MemoryMemento;
	readonly workspaceState: MemoryMemento;
}

function createContext(
	globalStoragePath: string,
	secrets = new MemorySecretStorage(),
	globalState = new MemoryMemento()
): TestContext {
	return {
		globalStorageUri: { fsPath: globalStoragePath },
		secrets,
		globalState,
		workspaceState: new MemoryMemento(),
	};
}

suite('time-tracker encrypted persistence', () => {
	test('retains the managed extension identity that owns existing SecretStorage keys', async () => {
		const manifestPath = path.join(__dirname, '..', '..', 'package.json');
		const manifest = JSON.parse(await fsPromises.readFile(manifestPath, 'utf8')) as { publisher: string; name: string };
		assert.deepStrictEqual({ extensionId: `${manifest.publisher}.${manifest.name}` }, { extensionId: 'safeappeals.time-tracker' });
	});

	test('reuses an existing database DEK and degrades when SecretStorage fails', async () => {
		const secrets = new MemorySecretStorage();
		const storedDek = randomBytes(32).toString('base64');
		await secrets.store('time-tracker.dek.database', storedDek);
		const reused = await acquireDek({ secrets, keyId: 'time-tracker.dek.database', existingDataPaths: [] });
		const unavailable = await acquireDek({
			secrets: new MemorySecretStorage(true),
			keyId: 'time-tracker.dek.database',
			existingDataPaths: [],
		});
		assert.deepStrictEqual({
			reused: reused.kind === 'ok' ? reused.dek.toString('base64') : reused.kind,
			unavailable,
		}, {
			reused: storedDek,
			unavailable: { kind: 'unavailable', reason: 'secret-storage-unusable' },
		});
	});
	test('writes authenticated ciphertext with restrictive permissions and round-trips', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-state-'));
		const filePath = path.join(directory, 'state.saenc');
		const dek = randomBytes(32);
		await writeEncryptedJson(filePath, { description: 'confidential timer text', taskCodes: { X01: 'Private task' } }, dek);
		const raw = await fsPromises.readFile(filePath);
		const loaded = await readEncryptedJson<{ description: string }>(filePath, dek);
		assert.deepStrictEqual({
			magic: raw.subarray(0, 6).toString('ascii'),
			containsDescription: raw.includes(Buffer.from('confidential timer text')),
			mode: process.platform === 'win32' ? 0o600 : (await fsPromises.stat(filePath)).mode & 0o777,
			loaded,
		}, {
			magic: 'SAENC1',
			containsDescription: false,
			mode: 0o600,
			loaded: { kind: 'encrypted', value: { description: 'confidential timer text', taskCodes: { X01: 'Private task' } } },
		});
	});

	test('imports legacy rows into an encrypted temporary database before atomic rename', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-migration-'));
		const legacyPath = path.join(directory, 'legacy.db');
		const temporaryPath = path.join(directory, 'managed.db.migrating');
		const destinationPath = path.join(directory, 'managed.db');
		const binding = path.join(__dirname, '..', '..', 'prebuilds', `${process.platform}-${process.arch}`, `node-${process.versions.modules}`, 'better_sqlite3.node');
		const legacy = new Database(legacyPath, { nativeBinding: binding });
		legacy.exec("CREATE TABLE time_entries(id INTEGER PRIMARY KEY, description TEXT); INSERT INTO time_entries VALUES (1, 'legacy confidential row')");
		const rows = legacy.prepare('SELECT * FROM time_entries').all() as { id: number; description: string }[];
		legacy.close();
		const encrypted = new Database(temporaryPath, { nativeBinding: binding });
		encrypted.pragma("cipher='sqlcipher'");
		encrypted.pragma('legacy = 4');
		encrypted.key(randomBytes(32));
		encrypted.exec('CREATE TABLE time_entries(id INTEGER PRIMARY KEY, description TEXT)');
		const insert = encrypted.prepare('INSERT INTO time_entries VALUES (@id, @description)');
		for (const row of rows) { insert.run(row); }
		encrypted.close();
		await fsPromises.chmod(temporaryPath, 0o600);
		await fsPromises.rename(temporaryPath, destinationPath);
		const bytes = fs.readFileSync(destinationPath);
		assert.deepStrictEqual({
			plaintextHeader: bytes.subarray(0, 16).equals(Buffer.from('SQLite format 3\0')),
			containsRow: bytes.includes(Buffer.from('legacy confidential row')),
			legacyStillPresent: fs.existsSync(legacyPath),
			temporaryPresent: fs.existsSync(temporaryPath),
			destinationMode: process.platform === 'win32' ? 0o600 : fs.statSync(destinationPath).mode & 0o777,
		}, { plaintextHeader: false, containsRow: false, legacyStillPresent: true, temporaryPresent: false, destinationMode: 0o600 });
	});

	test('confirmed database purge removes every managed and exact legacy sibling', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-purge-'));
		const managedRoot = path.join(directory, 'managed');
		await fsPromises.mkdir(managedRoot, { mode: 0o700 });
		const context = createContext(managedRoot);
		await context.secrets.store('time-tracker.dek.database', randomBytes(32).toString('base64'));
		const service = new StorageService(context, { workspacePath: '/test/purge', homePath: directory });
		const workspaceId = service.getWorkspaceId();
		const managedDb = path.join(managedRoot, 'workspaces', workspaceId, 'timetracker.db');
		const legacyDb = path.join(directory, '.safe-appeals-navigator', 'databases', 'workspaces', getLegacyTimeTrackerWorkspaceId('/test/purge'), 'timetracker.db');
		const targets = [
			managedDb, `${managedDb}-wal`, `${managedDb}-shm`,
			legacyDb, `${legacyDb}-wal`, `${legacyDb}-shm`,
		];
		for (const target of targets) {
			await fsPromises.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
			await fsPromises.chmod(path.dirname(target), 0o700);
			await fsPromises.writeFile(target, 'sensitive', { mode: 0o600 });
		}
		await service.clearLocalDatabase();
		assert.deepStrictEqual({
			remaining: await Promise.all(targets.map(async target => fs.existsSync(target))),
			key: await context.secrets.get('time-tracker.dek.database'),
		}, { remaining: targets.map(() => false), key: undefined });
	});

	test('preserves the shared database key until the last workspace database is purged', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-workspaces-'));
		const secrets = new MemorySecretStorage();
		const key = randomBytes(32).toString('base64');
		await secrets.store('time-tracker.dek.database', key);
		const first = new StorageService(createContext(directory, secrets), { workspacePath: '/test/first' });
		const second = new StorageService(createContext(directory, secrets), { workspacePath: '/test/second' });
		for (const service of [first, second]) {
			const dbPath = path.join(directory, 'workspaces', service.getWorkspaceId(), 'timetracker.db');
			await fsPromises.mkdir(path.dirname(dbPath), { recursive: true, mode: 0o700 });
			await fsPromises.chmod(path.dirname(dbPath), 0o700);
			await fsPromises.writeFile(dbPath, 'encrypted', { mode: 0o600 });
		}
		await first.clearLocalDatabase();
		const afterFirst = await secrets.get('time-tracker.dek.database');
		await second.clearLocalDatabase();
		assert.deepStrictEqual({ afterFirst, afterSecond: await secrets.get('time-tracker.dek.database') }, {
			afterFirst: key,
			afterSecond: undefined,
		});
	});

	test('current purge remains an escape hatch after the database key is lost', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-keyless-current-'));
		const managedRoot = path.join(directory, 'managed');
		await fsPromises.mkdir(managedRoot, { mode: 0o700 });
		const context = createContext(managedRoot);
		await context.globalState.update('encryptedStore.dekStored.time-tracker.dek.database', true);
		const service = new StorageService(context, { workspacePath: '/test/keyless-current', homePath: directory });
		const database = path.join(managedRoot, 'workspaces', service.getWorkspaceId(), 'timetracker.db');
		await fsPromises.mkdir(path.dirname(database), { recursive: true, mode: 0o700 });
		await fsPromises.chmod(path.dirname(database), 0o700);
		await fsPromises.writeFile(database, 'unreadable ciphertext', { mode: 0o600 });
		await service.clearLocalDatabase();
		assert.deepStrictEqual({ database: fs.existsSync(database), marker: context.globalState.get('encryptedStore.dekStored.time-tracker.dek.database') }, {
			database: false, marker: undefined
		});
	});

	test('all purge removes strict database namespaces after key loss', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-keyless-all-'));
		const managedRoot = path.join(directory, 'managed');
		await fsPromises.mkdir(managedRoot, { mode: 0o700 });
		const context = createContext(managedRoot);
		await context.globalState.update('encryptedStore.dekStored.time-tracker.dek.database', true);
		const service = new StorageService(context, { workspacePath: '/test/keyless-all', homePath: directory });
		const workspace = path.join(managedRoot, 'workspaces', 'a'.repeat(64));
		await fsPromises.mkdir(workspace, { recursive: true, mode: 0o700 });
		await fsPromises.chmod(workspace, 0o700);
		await fsPromises.writeFile(path.join(workspace, 'timetracker.db'), 'unreadable ciphertext', { mode: 0o600 });
		await service.clearAllLocalDatabases();
		assert.deepStrictEqual({ files: await fsPromises.readdir(workspace), marker: context.globalState.get('encryptedStore.dekStored.time-tracker.dek.database') }, {
			files: [], marker: undefined
		});
	});

	test('keyless purge blocks unknown transaction artifacts and retains the marker', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-keyless-blocked-'));
		const managedRoot = path.join(directory, 'managed');
		await fsPromises.mkdir(managedRoot, { mode: 0o700 });
		const context = createContext(managedRoot);
		await context.globalState.update('encryptedStore.dekStored.time-tracker.dek.database', true);
		const warnings: string[] = [];
		const service = new StorageService(context, {
			workspacePath: '/test/keyless-blocked', homePath: directory,
			showMigrationBlockedWarning: reason => warnings.push(reason)
		});
		const workspace = path.join(managedRoot, 'workspaces', service.getWorkspaceId());
		await fsPromises.mkdir(workspace, { recursive: true, mode: 0o700 });
		await fsPromises.chmod(workspace, 0o700);
		const unknown = path.join(workspace, '.safeappeals-tx-unauthenticated');
		await fsPromises.writeFile(unknown, 'uncertain', { mode: 0o600 });
		await assert.rejects(service.clearLocalDatabase(), /Secure local database purge was blocked/);
		assert.deepStrictEqual({ retained: fs.existsSync(unknown), marker: context.globalState.get('encryptedStore.dekStored.time-tracker.dek.database'), warnings: warnings.length }, {
			retained: true, marker: true, warnings: 1
		});
	});

	test('migrates legacy timer and custom codes, restores them, and purges encrypted state', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-sensitive-'));
		const workspacePath = path.join(directory, 'workspace');
		await fsPromises.mkdir(workspacePath, { mode: 0o700 });
		const context = createContext(path.join(directory, 'managed'));
		const timerState: TimerState = {
			isRunning: true, startTime: 123, currentMatterId: 4, currentRateId: 5,
			currentDescription: 'privileged advice', currentUtbmsTask: 'L110',
			currentUtbmsActivity: 'A101', isBillable: true,
		};
		const customCodes: CustomUTBMSCodes = {
			version: 1, taskCodes: { X01: 'Secret task' }, activityCodes: { Y01: 'Secret activity' },
		};
		await context.workspaceState.update('timerState', timerState);
		const legacyCodesPath = path.join(workspacePath, 'time-tracker-codes.json');
		await fsPromises.writeFile(legacyCodesPath, JSON.stringify(customCodes));
		const first = new SensitiveStateStore(context, { workspacePath });
		await first.initialize();
		await first.flush();
		const workspaceId = new StorageService(context, { workspacePath }).getWorkspaceId();
		const storePath = path.join(directory, 'managed', 'workspaces', workspaceId, 'sensitive-state.saenc');
		const ciphertext = await fsPromises.readFile(storePath);
		const restored = new SensitiveStateStore(context, { workspacePath });
		await restored.initialize();
		assert.deepStrictEqual({
			legacyCodesExists: fs.existsSync(legacyCodesPath),
			legacyTimer: context.workspaceState.get<TimerState>('timerState'),
			containsTimerText: ciphertext.includes(Buffer.from('privileged advice')),
			timer: restored.getTimerState(),
			codes: restored.getCustomCodes(),
		}, {
			legacyCodesExists: false, legacyTimer: undefined, containsTimerText: false,
			timer: timerState, codes: customCodes,
		});
		await restored.purge();
		assert.deepStrictEqual({
			storeExists: fs.existsSync(storePath),
			key: await context.secrets.get('time-tracker.dek.sensitive-state'),
			timer: restored.getTimerState(), codes: restored.getCustomCodes(),
		}, { storeExists: false, key: undefined, timer: undefined, codes: undefined });
	});

	test('isolates sensitive state by workspace and retains its DEK until the last purge', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-state-workspaces-'));
		const secrets = new MemorySecretStorage();
		const firstContext = createContext(directory, secrets);
		const secondContext = createContext(directory, secrets);
		const first = new SensitiveStateStore(firstContext, { workspacePath: '/test/state-first' });
		const second = new SensitiveStateStore(secondContext, { workspacePath: '/test/state-second' });
		await first.initialize();
		first.setTimerState({
			isRunning: true, startTime: 1, currentMatterId: null, currentRateId: null,
			currentDescription: 'first workspace', currentUtbmsTask: null,
			currentUtbmsActivity: null, isBillable: true,
		});
		await first.flush();
		await second.initialize();
		await second.setCustomCodes({ version: 1, taskCodes: { S02: 'Second' }, activityCodes: {} });
		const firstReloaded = new SensitiveStateStore(firstContext, { workspacePath: '/test/state-first' });
		const secondReloaded = new SensitiveStateStore(secondContext, { workspacePath: '/test/state-second' });
		await firstReloaded.initialize();
		await secondReloaded.initialize();
		const isolated = {
			firstDescription: firstReloaded.getTimerState()?.currentDescription,
			firstCodes: firstReloaded.getCustomCodes(),
			secondTimer: secondReloaded.getTimerState(),
			secondCodes: secondReloaded.getCustomCodes(),
		};
		await firstReloaded.purge();
		const keyAfterFirst = await secrets.get('time-tracker.dek.sensitive-state');
		await secondReloaded.purge();
		assert.deepStrictEqual({
			isolated,
			keyAfterFirst: typeof keyAfterFirst,
			keyAfterSecond: await secrets.get('time-tracker.dek.sensitive-state'),
		}, {
			isolated: {
				firstDescription: 'first workspace', firstCodes: undefined, secondTimer: undefined,
				secondCodes: { version: 1, taskCodes: { S02: 'Second' }, activityCodes: {} },
			},
			keyAfterFirst: 'string', keyAfterSecond: undefined,
		});
	});

	test('purges UUID sensitive-state crash temps and blocks malformed near-matches', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-state-temp-'));
		const context = createContext(directory);
		const identity = 'sensitive-current-temp';
		const store = new SensitiveStateStore(context, { workspaceIdentity: identity });
		await store.initialize();
		await store.setCustomCodes({ version: 1, taskCodes: { X: 'Private' }, activityCodes: {} });
		const workspaceDirectory = path.join(directory, 'workspaces', getTimeTrackerWorkspaceId(directory, identity));
		const validTemp = path.join(workspaceDirectory, `.safeappeals-tx-sensitive-state-${randomUUID()}`);
		await fsPromises.writeFile(validTemp, 'crash', { mode: 0o600 });
		await store.purge();
		assert.strictEqual(fs.existsSync(validTemp), false);

		const retry = new SensitiveStateStore(context, { workspaceIdentity: identity });
		await retry.initialize();
		await retry.setCustomCodes({ version: 1, taskCodes: { X: 'Private' }, activityCodes: {} });
		const malformed = path.join(workspaceDirectory, '.safeappeals-tx-sensitive-state-not-a-uuid');
		await fsPromises.writeFile(malformed, 'unknown', { mode: 0o600 });
		await assert.rejects(retry.purge(), /Unknown sensitive-state transaction artifact/);
		assert.deepStrictEqual({ malformed: fs.existsSync(malformed), store: fs.existsSync(path.join(workspaceDirectory, 'sensitive-state.saenc')) },
			{ malformed: true, store: true });
	});

	test('purgeAll removes UUID sensitive-state crash temps in every workspace', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-state-all-temp-'));
		const secrets = new MemorySecretStorage();
		const globalState = new MemoryMemento();
		const firstContext = createContext(directory, secrets, globalState);
		const secondContext = createContext(directory, secrets, globalState);
		for (const [context, identity] of [[firstContext, 'temp-first'], [secondContext, 'temp-second']] as const) {
			const store = new SensitiveStateStore(context, { workspaceIdentity: identity });
			await store.initialize();
			await store.setCustomCodes({ version: 1, taskCodes: { X: identity }, activityCodes: {} });
			const workspaceDirectory = path.join(directory, 'workspaces', getTimeTrackerWorkspaceId(directory, identity));
			await fsPromises.writeFile(path.join(workspaceDirectory, `.safeappeals-tx-sensitive-state-${randomUUID()}`), 'crash', { mode: 0o600 });
		}
		await new SensitiveStateStore(firstContext, { workspaceIdentity: 'temp-first' }).purgeAll();
		const remaining = await fsPromises.readdir(path.join(directory, 'workspaces'));
		assert.deepStrictEqual(await Promise.all(remaining.map(async workspace => fsPromises.readdir(path.join(directory, 'workspaces', workspace)))), [[], []]);
	});

	test('quarantines an unreadable legacy database together with exact WAL and SHM siblings', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-quarantine-'));
		const managedRoot = path.join(directory, 'managed');
		const legacyRoot = path.join(directory, 'legacy');
		const context = createContext(managedRoot);
		const service = new StorageService(context, { workspacePath: '/test/quarantine', homePath: legacyRoot });
		const legacyDb = path.join(legacyRoot, '.safe-appeals-navigator', 'databases', 'workspaces', getLegacyTimeTrackerWorkspaceId('/test/quarantine'), 'timetracker.db');
		await fsPromises.mkdir(path.dirname(legacyDb), { recursive: true, mode: 0o700 });
		await fsPromises.chmod(path.dirname(legacyDb), 0o700);
		for (const suffix of ['', '-wal', '-shm']) { await fsPromises.writeFile(`${legacyDb}${suffix}`, 'plaintext'); }
		await service.initialize();
		service.close();
		const names = (await fsPromises.readdir(path.dirname(legacyDb))).sort();
		assert.deepStrictEqual({
			originals: ['', '-wal', '-shm'].map(suffix => fs.existsSync(`${legacyDb}${suffix}`)),
			quarantines: names.map(name => name.replace(/\.corrupt-.+$/, '.corrupt-*')),
		}, {
			originals: [true, true, true],
			quarantines: ['timetracker.db', 'timetracker.db-shm', 'timetracker.db-wal'],
		});
	});

	test('removes exact plaintext WAL and SHM siblings after successful legacy migration', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-sidecar-migration-'));
		const managedRoot = path.join(directory, 'managed');
		const legacyRoot = path.join(directory, 'legacy');
		await fsPromises.mkdir(managedRoot, { mode: 0o700 });
		const context = createContext(managedRoot);
		const service = new StorageService(context, { workspacePath: '/test/migrate-sidecars', homePath: legacyRoot });
		const legacyDbPath = path.join(legacyRoot, '.safe-appeals-navigator', 'databases', 'workspaces', getLegacyTimeTrackerWorkspaceId('/test/migrate-sidecars'), 'timetracker.db');
		await fsPromises.mkdir(path.dirname(legacyDbPath), { recursive: true, mode: 0o700 });
		await fsPromises.chmod(path.dirname(legacyDbPath), 0o700);
		const legacyDb = new Database(legacyDbPath);
		legacyDb.exec(`
			CREATE TABLE matters(id INTEGER PRIMARY KEY, workspace_id TEXT, client_name TEXT, matter_name TEXT, matter_number TEXT, default_rate REAL, is_active INTEGER, created_at INTEGER);
			CREATE TABLE billing_rates(id INTEGER PRIMARY KEY, workspace_id TEXT, name TEXT, hourly_rate REAL, is_default INTEGER, created_at INTEGER);
			CREATE TABLE time_entries(id INTEGER PRIMARY KEY, workspace_id TEXT, matter_id INTEGER, rate_id INTEGER, start_time INTEGER, end_time INTEGER, duration_tenths REAL, utbms_task TEXT, utbms_activity TEXT, description TEXT, is_billable INTEGER, created_at INTEGER);
			INSERT INTO time_entries VALUES(1, '${service.getWorkspaceId()}', NULL, NULL, 1, 2, 0.1, NULL, NULL, 'legacy row', 1, 3);
		`);
		legacyDb.close();
		await service.initialize();
		const migratedDescriptions = service.getEntries().map(entry => entry.description);
		service.close();
		assert.deepStrictEqual({
			migratedDescriptions,
			legacyFamilyExists: ['', '-wal', '-shm'].map(suffix => fs.existsSync(`${legacyDbPath}${suffix}`)),
		}, { migratedDescriptions: ['legacy row'], legacyFamilyExists: [false, false, false] });
	});

	test('fails closed when any plaintext legacy migration sidecar cannot be deleted', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-cleanup-failure-'));
		const managedRoot = path.join(directory, 'managed');
		const legacyRoot = path.join(directory, 'legacy');
		const context = createContext(managedRoot);
		const warnings: string[] = [];
		const service = new StorageService(context, {
			workspacePath: '/test/cleanup-failure', homePath: legacyRoot,
			showLegacyCleanupFailureWarning: legacyPath => warnings.push(legacyPath),
		});
		const legacyDbPath = path.join(legacyRoot, '.safe-appeals-navigator', 'databases', 'workspaces', getLegacyTimeTrackerWorkspaceId('/test/cleanup-failure'), 'timetracker.db');
		await fsPromises.mkdir(path.dirname(legacyDbPath), { recursive: true, mode: 0o700 });
		await fsPromises.chmod(path.dirname(legacyDbPath), 0o700);
		const legacyDb = new Database(legacyDbPath);
		legacyDb.exec(`
			CREATE TABLE matters(id INTEGER PRIMARY KEY, workspace_id TEXT, client_name TEXT, matter_name TEXT, matter_number TEXT, default_rate REAL, is_active INTEGER, created_at INTEGER);
			CREATE TABLE billing_rates(id INTEGER PRIMARY KEY, workspace_id TEXT, name TEXT, hourly_rate REAL, is_default INTEGER, created_at INTEGER);
			CREATE TABLE time_entries(id INTEGER PRIMARY KEY, workspace_id TEXT, matter_id INTEGER, rate_id INTEGER, start_time INTEGER, end_time INTEGER, duration_tenths REAL, utbms_task TEXT, utbms_activity TEXT, description TEXT, is_billable INTEGER, created_at INTEGER);
		`);
		legacyDb.close();
		await fsPromises.writeFile(`${legacyDbPath}-wal`, 'plaintext wal');
		await service.initialize();
		const managedDbPath = path.join(managedRoot, 'workspaces', service.getWorkspaceId(), 'timetracker.db');
		assert.deepStrictEqual({
			legacyMainExists: fs.existsSync(legacyDbPath),
			failedSidecarExists: fs.existsSync(`${legacyDbPath}-wal`),
			managedActivated: fs.existsSync(managedDbPath),
			warnings,
		}, { legacyMainExists: true, failedSidecarExists: true, managedActivated: false, warnings: [] });
	});

	test('derives distinct stable identities from the full workspace context', () => {
		const multiRootA = getTimeTrackerWorkspaceId('/global', 'file:///shared\0file:///second-a');
		const multiRootB = getTimeTrackerWorkspaceId('/global', 'file:///shared\0file:///second-b');
		const emptyA = getTimeTrackerWorkspaceId('/global', 'empty:session-a');
		const emptyB = getTimeTrackerWorkspaceId('/global', 'empty:session-b');
		assert.deepStrictEqual({
			multiRootsDiffer: multiRootA !== multiRootB,
			emptyWindowsDiffer: emptyA !== emptyB,
			stable: multiRootA === getTimeTrackerWorkspaceId('/global', 'file:///shared\0file:///second-a'),
		}, {
			multiRootsDiffer: true,
			emptyWindowsDiffer: true,
			stable: true,
		});
	});

	test('applies an all-data purge generation when unopened legacy workspaces next activate', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-purge-generation-'));
		const secrets = new MemorySecretStorage();
		const globalState = new MemoryMemento();
		const firstContext = createContext(directory, secrets, globalState);
		const secondContext = createContext(directory, secrets, globalState);
		await firstContext.workspaceState.update('timerState', { currentDescription: 'first plaintext' });
		await secondContext.workspaceState.update('timerState', { currentDescription: 'second plaintext' });
		const first = new SensitiveStateStore(firstContext, { workspaceIdentity: 'first' });
		await first.initialize();
		await first.purgeAll();
		const second = new SensitiveStateStore(secondContext, { workspaceIdentity: 'second' });
		await second.initialize();
		assert.deepStrictEqual({
			firstLegacy: firstContext.workspaceState.get('timerState'),
			secondLegacy: secondContext.workspaceState.get('timerState'),
			secondRestored: second.getTimerState(),
		}, { firstLegacy: undefined, secondLegacy: undefined, secondRestored: undefined });
	});

	test('fails closed and retries when plaintext custom-code cleanup fails', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-code-cleanup-'));
		const workspacePath = path.join(directory, 'workspace');
		await fsPromises.mkdir(workspacePath, { mode: 0o700 });
		const context = createContext(path.join(directory, 'managed'));
		const legacyPath = path.join(workspacePath, 'time-tracker-codes.json');
		await fsPromises.writeFile(legacyPath, JSON.stringify({ version: 1, taskCodes: { X: 'Private' }, activityCodes: {} }));
		await fsPromises.chmod(workspacePath, 0o500);
		const warnings: string[] = [];
		const failing = new SensitiveStateStore(context, {
			workspacePath, showLegacyCleanupFailureWarning: filePath => warnings.push(filePath),
		});
		await assert.rejects(failing.initialize(), /Failed to securely clean up legacy custom codes/);
		await fsPromises.chmod(workspacePath, 0o700);
		const retry = new SensitiveStateStore(context, { workspacePath });
		await retry.initialize();
		assert.deepStrictEqual({
			warnings, legacyExists: fs.existsSync(legacyPath), codes: retry.getCustomCodes(),
		}, {
			warnings: [legacyPath], legacyExists: false,
			codes: { version: 1, taskCodes: { X: 'Private' }, activityCodes: {} },
		});
	});

	test('all-workspace purge removes every managed and legacy database family before deleting the DEK', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-purge-all-'));
		const managedRoot = path.join(directory, 'managed');
		await fsPromises.mkdir(managedRoot, { mode: 0o700 });
		const context = createContext(managedRoot);
		await context.secrets.store('time-tracker.dek.database', randomBytes(32).toString('base64'));
		const service = new StorageService(context, { workspacePath: '/test/current', homePath: directory });
		const targets: string[] = [];
		for (const root of [path.join(managedRoot, 'workspaces'), path.join(directory, '.safe-appeals-navigator', 'databases', 'workspaces')]) {
			for (const workspaceName of root.startsWith(managedRoot) ? ['a'.repeat(64), 'b'.repeat(64)] : ['a'.repeat(16), 'b'.repeat(16)]) {
				const basePath = path.join(root, workspaceName, 'timetracker.db');
				for (const suffix of ['', '-wal', '-shm']) {
					targets.push(`${basePath}${suffix}`);
					await fsPromises.mkdir(path.dirname(basePath), { recursive: true, mode: 0o700 });
					await fsPromises.chmod(path.dirname(basePath), 0o700);
					await fsPromises.writeFile(`${basePath}${suffix}`, 'sensitive', { mode: 0o600 });
				}
			}
		}
		await service.clearAllLocalDatabases();
		assert.deepStrictEqual({
			remaining: targets.filter(target => fs.existsSync(target)),
			key: await context.secrets.get('time-tracker.dek.database'),
		}, { remaining: [], key: undefined });
	});

	test('uses an actual nonpersistent in-memory StorageService when SecretStorage fails', async () => {
		const directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'time-tracker-memory-'));
		const environment = { workspacePath: '/test/memory' };
		const first = new StorageService(createContext(directory, new MemorySecretStorage(true)), environment);
		await first.initialize();
		first.createEntry(100, 200, 0.1, 'session only');
		assert.strictEqual(first.getEntries().length, 1);
		first.close();
		const second = new StorageService(createContext(directory, new MemorySecretStorage(true)), environment);
		await second.initialize();
		assert.deepStrictEqual({ entries: second.getEntries(), files: await fsPromises.readdir(directory) }, {
			entries: [], files: [],
		});
		second.close();
	});
});
