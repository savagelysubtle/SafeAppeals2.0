/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import { isEnvelope, open } from '../shared/encryptedStore';
import { NO_FOLDER_WORKSPACE_KEY, RecordingStore } from '../recordingStore';
import { CATALOG_FILENAME } from '../types';

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

suite('RecordingStore', () => {
	let tempDir: string;

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-audio-'));
	});

	suiteTeardown(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	test('seal/open round-trip leaves no plaintext catalog or audio on disk', async () => {
		const storageRoot = path.join(tempDir, 'store-roundtrip');
		await fs.mkdir(storageRoot, { recursive: true });
		const secrets = new FakeSecretStorage();
		const context = fakeContext(storageRoot, secrets);
		const workspaceUri = { toString: () => 'file:///tmp/case-a' } as vscode.Uri;

		const created = await RecordingStore.create(context, workspaceUri);
		assert.strictEqual(created.memoryOnly, false);

		const payload = Buffer.from('RIFF....WAVEfmt fake-audio-bytes', 'utf8');
		const recording = await created.store.addRecording({
			filename: 'hearing.wav',
			mimeType: 'audio/wav',
			duration: 1.5,
			audioBytes: payload,
			isImported: false,
		});

		const rootDir = created.store.getRootDir();
		assert.ok(rootDir);

		const catalogPath = path.join(rootDir, CATALOG_FILENAME);
		const blobPath = path.join(rootDir, recording.blobRelativePath);
		const catalogRaw = await fs.readFile(catalogPath);
		const blobRaw = await fs.readFile(blobPath);
		const dekB64 = await secrets.get('safeappeals-audio.dek');
		assert.ok(dekB64);
		const dek = Buffer.from(dekB64, 'base64');

		assert.deepStrictEqual({
			catalogIsEnvelope: isEnvelope(catalogRaw),
			blobIsEnvelope: isEnvelope(blobRaw),
			catalogContainsPlainFilename: catalogRaw.includes(Buffer.from('hearing.wav', 'utf8')),
			blobContainsPlainPayload: blobRaw.includes(payload),
			openedBlob: open(blobRaw, dek).equals(payload),
		}, {
			catalogIsEnvelope: true,
			blobIsEnvelope: true,
			catalogContainsPlainFilename: false,
			blobContainsPlainPayload: false,
			openedBlob: true,
		});

		const roundTrip = await created.store.openAudioBytes(recording.id);
		assert.deepStrictEqual(roundTrip?.equals(payload), true);

		await created.store.clearCache();
		await assert.rejects(fs.access(catalogPath));
		await assert.rejects(fs.access(blobPath));
		assert.deepStrictEqual(created.store.getRecordings(), []);

		created.store.dispose();
	});

	test('no workspace folder still encrypts under workspaces/_nofolder when DEK is available', async () => {
		const storageRoot = path.join(tempDir, 'store-nofolder');
		await fs.mkdir(storageRoot, { recursive: true });
		const secrets = new FakeSecretStorage();
		const context = fakeContext(storageRoot, secrets);

		const created = await RecordingStore.create(context, undefined);
		assert.strictEqual(created.memoryOnly, false);
		assert.notStrictEqual(created.dekReason, 'no-workspace');

		const rootDir = created.store.getRootDir();
		assert.ok(rootDir);
		assert.strictEqual(path.basename(rootDir), NO_FOLDER_WORKSPACE_KEY);
		assert.ok(rootDir.endsWith(path.join('workspaces', NO_FOLDER_WORKSPACE_KEY)));

		const payload = Buffer.from('nofolder-encrypted-bytes', 'utf8');
		const recording = await created.store.addRecording({
			filename: 'welcome.wav',
			mimeType: 'audio/wav',
			duration: 0.25,
			audioBytes: payload,
			isImported: false,
		});

		const blobPath = path.join(rootDir, recording.blobRelativePath);
		const blobRaw = await fs.readFile(blobPath);
		assert.strictEqual(isEnvelope(blobRaw), true);
		assert.strictEqual(blobRaw.includes(payload), false);

		const opened = await created.store.openAudioBytes(recording.id);
		assert.deepStrictEqual(opened?.equals(payload), true);

		created.store.dispose();
	});

	test('DEK unavailable stays memory-only and does not write disk artifacts', async () => {
		const storageRoot = path.join(tempDir, 'store-memory');
		await fs.mkdir(storageRoot, { recursive: true });
		const secrets = new FakeSecretStorage();
		// Break SecretStorage by making store throw
		secrets.store = async () => {
			throw new Error('SecretStorage.store failed');
		};
		const context = fakeContext(storageRoot, secrets);
		const workspaceUri = { toString: () => 'file:///tmp/case-b' } as vscode.Uri;

		const created = await RecordingStore.create(context, workspaceUri);
		assert.strictEqual(created.memoryOnly, true);

		const payload = Buffer.from('plaintext-must-not-land-on-disk', 'utf8');
		const recording = await created.store.addRecording({
			filename: 'note.webm',
			mimeType: 'audio/webm',
			duration: 0.5,
			audioBytes: payload,
			isImported: false,
		});

		assert.strictEqual(created.store.getRootDir(), undefined);
		const opened = await created.store.openAudioBytes(recording.id);
		assert.deepStrictEqual(opened?.equals(payload), true);

		const entries = await fs.readdir(storageRoot);
		assert.deepStrictEqual(entries, []);

		created.store.dispose();
	});
});
