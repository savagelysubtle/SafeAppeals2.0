/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import { isEnvelope, open } from '../shared/encryptedStore';
import { SealedMarkdownStore } from '../sealedMarkdown';
import { RAG_DEK_KEY } from '../types';

class FakeSecretStorage implements vscode.SecretStorage {
	private readonly map = new Map<string, string>();

	async keys(): Promise<string[]> {
		return [...this.map.keys()];
	}

	async get(key: string): Promise<string | undefined> {
		return this.map.get(key);
	}

	async store(key: string, value: string): Promise<void> {
		this.map.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.map.delete(key);
	}

	readonly onDidChange: vscode.Event<vscode.SecretStorageChangeEvent> = () => ({ dispose() { } });
}

class FakeMemento implements vscode.Memento {
	private readonly map = new Map<string, unknown>();

	keys(): readonly string[] {
		return [...this.map.keys()];
	}

	get<T>(key: string, defaultValue?: T): T | undefined {
		if (this.map.has(key)) {
			return this.map.get(key) as T;
		}
		return defaultValue;
	}

	async update(key: string, value: unknown): Promise<void> {
		if (value === undefined) {
			this.map.delete(key);
		} else {
			this.map.set(key, value);
		}
	}

	setKeysForSync(): void { }
}

function fakeContext(globalStoragePath: string, secrets: FakeSecretStorage): vscode.ExtensionContext {
	const globalState = new FakeMemento();
	return {
		secrets,
		globalState,
		globalStorageUri: { fsPath: globalStoragePath } as vscode.Uri,
	} as unknown as vscode.ExtensionContext;
}

suite('SealedMarkdownStore', () => {
	let tempDir: string;

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-rag-sealed-'));
	});

	suiteTeardown(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	test('create encrypts under rag/<workspaceId>/sealed_md and round-trips put/get', async () => {
		const storageRoot = path.join(tempDir, 'store-encrypt');
		await fs.mkdir(storageRoot, { recursive: true });
		const secrets = new FakeSecretStorage();
		const context = fakeContext(storageRoot, secrets);
		const workspaceId = 'abcd1234efgh5678';

		const created = await SealedMarkdownStore.create(context, workspaceId);
		assert.strictEqual(created.memoryOnly, false);

		const rootDir = created.store.getRootDir();
		assert.ok(rootDir);
		assert.ok(rootDir.endsWith(path.join('rag', workspaceId, 'sealed_md')));

		const sourceUri = 'file:///case/brief.pdf';
		const markdown = '# Page 1\nBorn digital text';
		await created.store.put({
			sourceUri,
			markdown,
			fidelity: 'digital',
			anchors: [{ sourceUri, page: 1 }],
			pageCount: 1,
		});

		const docHash = SealedMarkdownStore.docHash(sourceUri);
		const filePath = path.join(rootDir, `${docHash}.json`);
		const raw = await fs.readFile(filePath);
		const dekB64 = await secrets.get(RAG_DEK_KEY);
		assert.ok(dekB64);
		const dek = Buffer.from(dekB64, 'base64');

		assert.deepStrictEqual({
			isEnvelope: isEnvelope(raw),
			containsPlainMarkdown: raw.includes(Buffer.from('Born digital text', 'utf8')),
			openedMarkdown: JSON.parse(open(raw, dek).toString('utf8')).markdown,
		}, {
			isEnvelope: true,
			containsPlainMarkdown: false,
			openedMarkdown: markdown,
		});

		// Fresh store instance (empty memory) must load from encrypted disk.
		const reopened = SealedMarkdownStore.createEncryptedForTesting(rootDir, dek);
		const loaded = await reopened.get(sourceUri);
		assert.deepStrictEqual(
			{ markdown: loaded?.markdown, fidelity: loaded?.fidelity, pageCount: loaded?.pageCount },
			{ markdown, fidelity: 'digital', pageCount: 1 },
		);
	});

	test('DEK unavailable stays memory-only and never writes plaintext to disk', async () => {
		const storageRoot = path.join(tempDir, 'store-memory');
		await fs.mkdir(storageRoot, { recursive: true });
		const secrets = new FakeSecretStorage();
		secrets.store = async () => {
			throw new Error('SecretStorage.store failed');
		};
		const context = fakeContext(storageRoot, secrets);

		const created = await SealedMarkdownStore.create(context, 'ws-memory');
		assert.strictEqual(created.memoryOnly, true);
		assert.strictEqual(created.store.getRootDir(), undefined);

		const sourceUri = 'file:///case/notes.md';
		const markdown = 'must-not-land-on-disk';
		await created.store.put({
			sourceUri,
			markdown,
			fidelity: 'native-text',
			anchors: [{ sourceUri }],
		});

		const roundTrip = await created.store.get(sourceUri);
		assert.strictEqual(roundTrip?.markdown, markdown);

		const entries = await fs.readdir(storageRoot);
		assert.deepStrictEqual(entries, []);
	});

	test('clear purges memory map and sealed_md directory', async () => {
		const rootDir = path.join(tempDir, 'store-purge', 'rag', 'ws1', 'sealed_md');
		await fs.mkdir(rootDir, { recursive: true });
		const dek = randomBytes(32);
		const store = SealedMarkdownStore.createEncryptedForTesting(rootDir, dek);

		const sourceUri = 'file:///case/purge.pdf';
		await store.put({
			sourceUri,
			markdown: '# purge me',
			fidelity: 'digital',
			anchors: [{ sourceUri }],
		});
		const filePath = path.join(rootDir, `${SealedMarkdownStore.docHash(sourceUri)}.json`);
		await fs.access(filePath);

		await store.clear();
		await assert.rejects(fs.access(rootDir));
		assert.strictEqual(await store.get(sourceUri), undefined);
	});
});
