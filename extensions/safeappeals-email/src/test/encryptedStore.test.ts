/*--- Encrypted store + secure FS unit tests ---*/

import 'mocha';
import * as assert from 'assert';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import {
	acquireDek,
	loadJson,
	open,
	seal,
	writeEncryptedJson,
} from '../shared/encryptedStore';
import { ensureDir, writeFileAtomic } from '../shared/secureFs';

interface FakeSecretStorageOptions {
	readonly throwOnStore?: boolean;
	readonly dropWrites?: boolean;
}

class FakeSecretStorage implements vscode.SecretStorage {
	private readonly map = new Map<string, string>();

	constructor(private readonly options: FakeSecretStorageOptions = {}) { }

	async keys(): Promise<string[]> {
		return [...this.map.keys()];
	}

	async get(key: string): Promise<string | undefined> {
		return this.map.get(key);
	}

	async store(key: string, value: string): Promise<void> {
		if (this.options.throwOnStore) {
			throw new Error('SecretStorage.store failed');
		}
		if (!this.options.dropWrites) {
			this.map.set(key, value);
		}
	}

	async delete(key: string): Promise<void> {
		this.map.delete(key);
	}

	readonly onDidChange: vscode.Event<vscode.SecretStorageChangeEvent> = () => ({ dispose() { } });

	/** Test helper: inspect stored secrets without going through SecretStorage API. */
	snapshot(): ReadonlyMap<string, string> {
		return new Map(this.map);
	}
}

suite('encryptedStore', () => {
	let tempDir: string;

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-enc-'));
	});

	suiteTeardown(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	test('round-trip seal/open preserves payload and envelope header', () => {
		const dek = randomBytes(32);
		const payload = Buffer.from('{"hello":"world"}', 'utf8');
		const envelope = seal(payload, dek);
		assert.deepStrictEqual({
			plaintext: open(envelope, dek).toString('utf8'),
			magic: envelope.subarray(0, 6).toString('ascii'),
			version: envelope[6],
		}, {
			plaintext: '{"hello":"world"}',
			magic: 'SAENC1',
			version: 1,
		});
	});

	test('tampered ciphertext, tag, or version each cause open to throw', () => {
		const dek = randomBytes(32);
		const envelope = seal(Buffer.from('secret', 'utf8'), dek);

		const flip = (index: number): boolean => {
			const bad = Buffer.from(envelope);
			bad[index] = (bad[index]! ^ 0xff) & 0xff;
			try {
				open(bad, dek);
				return false;
			} catch {
				return true;
			}
		};

		// ciphertext starts at byte 35; tag at 19..34; version at byte 6
		assert.deepStrictEqual([flip(35), flip(20), flip(6)], [true, true, true]);
	});

	test('plaintext migration rewrites file and second load is not migrated', async () => {
		const dek = randomBytes(32);
		const filePath = path.join(tempDir, 'migrate.json');
		const value = { threads: [1, 2, 3] };
		await fs.writeFile(filePath, JSON.stringify(value), 'utf8');

		const first = await loadJson<typeof value>(filePath, dek);
		const onDisk = await fs.readFile(filePath);
		const second = await loadJson<typeof value>(filePath, dek);

		assert.deepStrictEqual({
			first: { value: first.value, migrated: first.migrated, quarantined: first.quarantined },
			magic: onDisk.subarray(0, 6).toString('ascii'),
			second: { value: second.value, migrated: second.migrated, quarantined: second.quarantined },
		}, {
			first: { value, migrated: true, quarantined: false },
			magic: 'SAENC1',
			second: { value, migrated: false, quarantined: false },
		});
	});

	test('wrong DEK quarantines file and leaves corrupt sibling', async () => {
		const dekA = randomBytes(32);
		const dekB = randomBytes(32);
		const filePath = path.join(tempDir, 'corrupt-me.json');
		await writeEncryptedJson(filePath, { n: 1 }, dekA);

		const result = await loadJson<{ n: number }>(filePath, dekB);
		const entries = await fs.readdir(tempDir);
		const corruptSibling = entries.find(name => name.startsWith('corrupt-me.json.corrupt-'));
		let originalExists = true;
		try {
			await fs.access(filePath);
		} catch {
			originalExists = false;
		}

		assert.deepStrictEqual({
			load: { value: result.value, migrated: result.migrated, quarantined: result.quarantined },
			hasCorruptSibling: !!corruptSibling,
			originalExists,
		}, {
			load: { value: undefined, migrated: false, quarantined: true },
			hasCorruptSibling: true,
			originalExists: false,
		});
	});

	test('probe throwOnStore yields secret-storage-unusable without throwing', async () => {
		const secrets = new FakeSecretStorage({ throwOnStore: true });
		const result = await acquireDek({
			secrets,
			keyId: 'safeappeals-email.dek.test',
			existingDataPaths: [],
		});
		assert.deepStrictEqual(result, { kind: 'unavailable', reason: 'secret-storage-unusable' });
	});

	test('missing DEK with existing sealed data is key-lost-with-data', async () => {
		const secrets = new FakeSecretStorage();
		const filePath = path.join(tempDir, 'sealed-orphan.json');
		await writeEncryptedJson(filePath, { orphan: true }, randomBytes(32));

		const before = secrets.snapshot().size;
		const result = await acquireDek({
			secrets,
			keyId: 'safeappeals-email.dek.orphan',
			existingDataPaths: [filePath],
		});
		const afterKeys = [...secrets.snapshot().keys()].filter(k => !k.endsWith('.probe'));

		assert.deepStrictEqual({
			result,
			secretsBefore: before,
			dekKeysAfter: afterKeys,
		}, {
			result: { kind: 'unavailable', reason: 'key-lost-with-data' },
			secretsBefore: 0,
			dekKeysAfter: [],
		});
	});

	test('minted DEK is reused across acquireDek calls', async () => {
		const secrets = new FakeSecretStorage();
		const keyId = 'safeappeals-email.dek.reuse';
		const first = await acquireDek({ secrets, keyId, existingDataPaths: [] });
		const second = await acquireDek({ secrets, keyId, existingDataPaths: [] });

		assert.deepStrictEqual({
			kinds: [first.kind, second.kind],
			sameKey: first.kind === 'ok' && second.kind === 'ok' && first.dek.equals(second.dek),
			length: first.kind === 'ok' ? first.dek.length : -1,
		}, {
			kinds: ['ok', 'ok'],
			sameKey: true,
			length: 32,
		});
	});

	test('file hygiene uses 0600 files and 0700 dirs on POSIX', async function () {
		if (process.platform === 'win32') {
			this.skip();
		}
		const dirPath = path.join(tempDir, 'hygiene-dir');
		const filePath = path.join(dirPath, 'secret.bin');
		await ensureDir(dirPath);
		await writeFileAtomic(filePath, Buffer.from('x'));
		const dirMode = (await fs.stat(dirPath)).mode & 0o777;
		const fileMode = (await fs.stat(filePath)).mode & 0o777;
		assert.deepStrictEqual({ dirMode, fileMode }, { dirMode: 0o700, fileMode: 0o600 });
	});
});
