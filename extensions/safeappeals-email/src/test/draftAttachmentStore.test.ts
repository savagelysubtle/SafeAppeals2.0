/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import {
	assertSafeStoreId,
	DRAFT_ATTACHMENTS_DIR,
	DraftAttachmentStore,
	MAX_ATTACHMENT_BYTES,
	MAX_ATTACHMENTS_PER_DRAFT,
	MAX_DRAFT_ATTACHMENT_BYTES,
	sanitizeAttachmentFilename,
} from '../draftAttachmentStore';
import { isPathInsideWorkspaceRoot, resolveWorkspaceFilePath } from '../pathResolve';
import { chooseSendAttachments } from '../sendAttachments';
import { isEnvelope } from '../shared/encryptedStore';

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

	get<T>(key: string, defaultValue?: T): T {
		if (this.map.has(key)) {
			return this.map.get(key) as T;
		}
		return defaultValue as T;
	}

	async update(key: string, value: unknown): Promise<void> {
		if (value === undefined) {
			this.map.delete(key);
		} else {
			this.map.set(key, value);
		}
	}
}

suite('draftAttachmentStore', () => {
	let tempDir: string;

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-draft-att-'));
	});

	suiteTeardown(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	async function createStore(): Promise<{ store: DraftAttachmentStore; root: string }> {
		const root = await fs.mkdtemp(path.join(tempDir, 'store-'));
		const store = new DraftAttachmentStore(
			{ fsPath: root } as vscode.Uri,
			new FakeSecretStorage(),
			new FakeMemento(),
		);
		await store.initialize();
		return { store, root };
	}

	test('sanitizeAttachmentFilename uses basename and caps length', () => {
		assert.deepStrictEqual(
			{
				base: sanitizeAttachmentFilename('/tmp/docs/brief.pdf'),
				long: sanitizeAttachmentFilename('a'.repeat(300) + '.pdf').length,
			},
			{
				base: 'brief.pdf',
				long: 255,
			},
		);
	});

	test('addFromFile seals to disk; readBytes round-trips; remove deletes sidecar', async () => {
		const { store, root } = await createStore();
		const draftId = randomUUID();
		const src = path.join(root, 'note.txt');
		await fs.writeFile(src, 'hello attachment', 'utf8');

		const meta = await store.addFromFile(draftId, [], src);
		const sidecar = path.join(root, DRAFT_ATTACHMENTS_DIR, draftId, meta.id);
		const envelope = await fs.readFile(sidecar);
		assert.strictEqual(isEnvelope(envelope), true);

		const bytes = await store.readBytes(draftId, meta.id);
		assert.deepStrictEqual(
			{
				filename: meta.filename,
				contentType: meta.contentType,
				size: meta.size,
				text: bytes?.toString('utf8'),
			},
			{
				filename: 'note.txt',
				contentType: 'text/plain',
				size: Buffer.byteLength('hello attachment'),
				text: 'hello attachment',
			},
		);

		await store.remove(draftId, meta.id);
		await assert.rejects(fs.access(sidecar));
		assert.strictEqual(await store.readBytes(draftId, meta.id), undefined);
	});

	test('enforces max file count, oversized files, and aggregate 20 MiB limit', async () => {
		const { store, root } = await createStore();
		const existing = Array.from({ length: MAX_ATTACHMENTS_PER_DRAFT }, (_, i) => ({
			id: randomUUID(),
			filename: `f${i}.txt`,
			contentType: 'text/plain',
			size: 1,
		}));
		const src = path.join(root, 'extra.txt');
		await fs.writeFile(src, 'x', 'utf8');
		await assert.rejects(
			() => store.addFromFile(randomUUID(), existing, src),
			/at most/,
		);

		const big = path.join(root, 'big.bin');
		await fs.writeFile(big, Buffer.alloc(MAX_ATTACHMENT_BYTES + 1, 1));
		await assert.rejects(
			() => store.addFromFile(randomUUID(), [], big),
			/exceeds/,
		);

		const nearLimit = [{
			id: randomUUID(),
			filename: 'a.bin',
			contentType: 'application/octet-stream',
			size: MAX_DRAFT_ATTACHMENT_BYTES - 10,
		}];
		const small = path.join(root, 'over-agg.bin');
		await fs.writeFile(small, Buffer.alloc(20, 2));
		await assert.rejects(
			() => store.addFromFile(randomUUID(), nearLimit, small),
			/aggregate/,
		);
	});

	test('purgeDraft and purgeAll remove sidecars', async () => {
		const { store, root } = await createStore();
		const d1 = randomUUID();
		const d2 = randomUUID();
		const src = path.join(root, 'a.txt');
		await fs.writeFile(src, 'one', 'utf8');
		const m1 = await store.addFromFile(d1, [], src);
		const m2 = await store.addFromFile(d2, [], src);
		await store.purgeDraft(d1);
		assert.strictEqual(await store.readBytes(d1, m1.id), undefined);
		assert.ok(await store.readBytes(d2, m2.id));
		await store.purgeAll();
		assert.strictEqual(await store.readBytes(d2, m2.id), undefined);
	});

	test('on-disk files are SAENC1 envelopes (not plaintext)', async () => {
		const { store, root } = await createStore();
		const draftId = randomUUID();
		const src = path.join(root, 'secret.txt');
		const plaintext = 'confidential-bytes';
		await fs.writeFile(src, plaintext, 'utf8');
		const meta = await store.addFromFile(draftId, [], src);
		const sidecar = path.join(root, DRAFT_ATTACHMENTS_DIR, draftId, meta.id);
		const onDisk = await fs.readFile(sidecar);
		assert.deepStrictEqual(
			{
				envelope: isEnvelope(onDisk),
				containsPlain: onDisk.includes(Buffer.from(plaintext, 'utf8')),
			},
			{
				envelope: true,
				containsPlain: false,
			},
		);
		const roundTrip = await store.readBytes(draftId, meta.id);
		assert.strictEqual(roundTrip?.toString('utf8'), plaintext);
	});

	test('malicious attachmentId / draftId cannot escape sidecar root', async () => {
		const { store, root } = await createStore();
		const draftId = randomUUID();
		const src = path.join(root, 'ok.txt');
		await fs.writeFile(src, 'ok', 'utf8');
		await store.addFromFile(draftId, [], src);

		const outsideBefore = await fs.readdir(root);
		const attacks = [
			'../escape',
			'..\\escape',
			'/etc/passwd',
			path.join(root, 'escape'),
			'not-a-uuid',
			`${randomUUID()}/../${randomUUID()}`,
			`.${randomUUID()}`,
		];

		for (const bad of attacks) {
			await assert.rejects(() => store.readBytes(draftId, bad), /Invalid/);
			await assert.rejects(() => store.remove(draftId, bad), /Invalid/);
			await assert.rejects(() => store.readBytes(bad, randomUUID()), /Invalid/);
			await assert.rejects(() => store.purgeDraft(bad), /Invalid/);
			assert.throws(() => assertSafeStoreId(bad, 'attachmentId'), /Invalid/);
		}

		// Nothing new created outside draft-attachments/
		const outsideAfter = await fs.readdir(root);
		assert.deepStrictEqual(outsideAfter.sort(), outsideBefore.sort());
	});

	test('resolveWorkspaceFilePath rejects symlink escapes outside workspace', async () => {
		const workspace = await fs.mkdtemp(path.join(tempDir, 'ws-'));
		const outside = await fs.mkdtemp(path.join(tempDir, 'out-'));
		const secret = path.join(outside, 'secret.txt');
		await fs.writeFile(secret, 'leaked', 'utf8');
		const link = path.join(workspace, 'link-out.txt');
		await fs.symlink(secret, link);

		const folders = [{
			uri: { scheme: 'file', fsPath: workspace, path: workspace } as vscode.Uri,
			name: 'ws',
			index: 0,
		}];

		const vscodeMod = require('vscode') as typeof import('vscode');
		const originalFolders = vscodeMod.workspace.workspaceFolders;
		Object.defineProperty(vscodeMod.workspace, 'workspaceFolders', {
			configurable: true,
			get: () => folders,
		});

		try {
			// Logical path is inside workspace, but realpath escapes
			const resolved = await resolveWorkspaceFilePath('link-out.txt', folders);
			assert.strictEqual(resolved, undefined);

			// Direct outside path also rejected
			assert.strictEqual(
				await resolveWorkspaceFilePath(secret, folders),
				undefined,
			);

			// Normal in-workspace file still works
			const okPath = path.join(workspace, 'ok.txt');
			await fs.writeFile(okPath, 'safe', 'utf8');
			const ok = await resolveWorkspaceFilePath('ok.txt', folders);
			assert.ok(ok);
			assert.strictEqual(await fs.readFile(ok!.fsPath, 'utf8'), 'safe');
			assert.strictEqual(isPathInsideWorkspaceRoot(ok!.fsPath, [workspace]), true);
		} finally {
			Object.defineProperty(vscodeMod.workspace, 'workspaceFolders', {
				configurable: true,
				get: () => originalFolders,
			});
		}
	});

	test('chooseSendAttachments ignores inbound payloads when draftId is set', () => {
		const inbound = [{
			filename: 'evil.bin',
			contentType: 'application/octet-stream',
			content: Buffer.from('web-supplied'),
		}];
		const loaded = [{
			filename: 'real.pdf',
			contentType: 'application/pdf',
			content: Buffer.from('%PDF'),
		}];
		assert.deepStrictEqual(
			{
				withDraft: chooseSendAttachments('draft-id', inbound, loaded)?.map(a => a.filename),
				withDraftEmptyStore: chooseSendAttachments('draft-id', inbound, undefined)?.map(a => a.filename),
				withoutDraft: chooseSendAttachments(undefined, inbound, loaded)?.map(a => a.filename),
			},
			{
				withDraft: ['real.pdf'],
				withDraftEmptyStore: [],
				withoutDraft: ['evil.bin'],
			},
		);
	});
});
