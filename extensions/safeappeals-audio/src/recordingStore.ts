/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	acquireDek,
	createMementoDekDurabilityMarker,
	isEnvelope,
	loadJson,
	open,
	seal,
	writeEncryptedJson,
} from './shared/encryptedStore';
import { deleteFileIfExists, ensureDir, writeFileAtomic } from './shared/secureFs';
import {
	AUDIO_DEK_KEY,
	CATALOG_FILENAME,
	RECORDINGS_DIRNAME,
	TMP_DIRNAME,
	type RecordingCatalog,
	type StoredRecording,
} from './types';

/** Managed root segment when no workspace folder is open. */
export const NO_FOLDER_WORKSPACE_KEY = '_nofolder';

export interface RecordingStoreCreateResult {
	readonly store: RecordingStore;
	readonly memoryOnly: boolean;
	readonly dekReason?: string;
}

export interface AddRecordingInput {
	readonly filename: string;
	readonly mimeType: string;
	readonly duration: number;
	readonly audioBytes: Buffer;
	readonly isImported: boolean;
	readonly originalFilename?: string;
}

/**
 * Encrypted recording catalog + sealed audio blobs under globalStorageUri/workspaces/<hash>/.
 * Fail-closed: when DEK is unavailable, operates memory-only (never plaintext on disk).
 * Without a workspace folder, data is stored under workspaces/_nofolder (still encrypted).
 */
export class RecordingStore {
	private catalog: RecordingCatalog = { version: 1, recordings: [] };
	private readonly memoryBlobs = new Map<string, Buffer>();
	private readonly onDidChangeEmitter = new vscode.EventEmitter<StoredRecording[]>();
	readonly onDidChange = this.onDidChangeEmitter.event;

	private constructor(
		private readonly rootDir: string | undefined,
		private readonly dek: Buffer | undefined,
		readonly memoryOnly: boolean,
	) { }

	static async create(
		context: vscode.ExtensionContext,
		workspaceFolderUri: vscode.Uri | undefined,
		log?: (message: string) => void,
	): Promise<RecordingStoreCreateResult> {
		const workspaceKey = workspaceFolderUri
			? createHash('sha256')
				.update(workspaceFolderUri.toString())
				.digest('hex')
				.slice(0, 16)
			: NO_FOLDER_WORKSPACE_KEY;
		const rootDir = path.join(context.globalStorageUri.fsPath, 'workspaces', workspaceKey);
		const catalogPath = path.join(rootDir, CATALOG_FILENAME);

		const dekResult = await acquireDek({
			secrets: context.secrets,
			keyId: AUDIO_DEK_KEY,
			existingDataPaths: [catalogPath],
			log,
			marker: createMementoDekDurabilityMarker(context.globalState, AUDIO_DEK_KEY),
		});

		if (dekResult.kind !== 'ok') {
			log?.(`Audio DEK unavailable (${dekResult.reason}); memory-only mode`);
			const store = new RecordingStore(undefined, undefined, true);
			return { store, memoryOnly: true, dekReason: dekResult.reason };
		}

		await ensureDir(rootDir);
		await ensureDir(path.join(rootDir, RECORDINGS_DIRNAME));
		await ensureDir(path.join(rootDir, TMP_DIRNAME));

		const store = new RecordingStore(rootDir, dekResult.dek, false);
		const loaded = await loadJson<RecordingCatalog>(catalogPath, dekResult.dek, log);
		if (loaded.value && loaded.value.version === 1 && Array.isArray(loaded.value.recordings)) {
			store.catalog = loaded.value;
		}
		if (!workspaceFolderUri) {
			log?.(`No workspace folder; using encrypted store at workspaces/${NO_FOLDER_WORKSPACE_KEY}`);
		}
		return { store, memoryOnly: false };
	}

	getRecordings(): StoredRecording[] {
		return [...this.catalog.recordings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}

	getRecording(id: string): StoredRecording | undefined {
		return this.catalog.recordings.find(r => r.id === id);
	}

	async addRecording(input: AddRecordingInput): Promise<StoredRecording> {
		const id = randomUUID();
		const blobRelativePath = `${RECORDINGS_DIRNAME}/${id}.saenc`;
		const recording: StoredRecording = {
			id,
			filename: input.filename,
			blobRelativePath,
			createdAt: new Date().toISOString(),
			duration: input.duration,
			status: 'pending',
			mimeType: input.mimeType,
			isImported: input.isImported,
			originalFilename: input.originalFilename,
			fileSizeBytes: input.audioBytes.byteLength,
		};

		if (this.dek && this.rootDir) {
			const envelope = seal(input.audioBytes, this.dek);
			const blobPath = path.join(this.rootDir, blobRelativePath);
			await writeFileAtomic(blobPath, envelope);
			if (!isEnvelope(envelope)) {
				throw new Error('Sealed audio is missing SAENC1 envelope magic');
			}
		} else {
			this.memoryBlobs.set(id, Buffer.from(input.audioBytes));
		}

		this.catalog.recordings.push(recording);
		await this.persistCatalog();
		this.onDidChangeEmitter.fire(this.getRecordings());
		return recording;
	}

	async updateRecording(
		id: string,
		updates: Partial<Omit<StoredRecording, 'id' | 'blobRelativePath'>>,
	): Promise<StoredRecording | undefined> {
		const index = this.catalog.recordings.findIndex(r => r.id === id);
		if (index < 0) {
			return undefined;
		}
		const next = { ...this.catalog.recordings[index]!, ...updates, id };
		this.catalog.recordings[index] = next;
		await this.persistCatalog();
		this.onDidChangeEmitter.fire(this.getRecordings());
		return next;
	}

	async deleteRecording(id: string): Promise<boolean> {
		const recording = this.getRecording(id);
		if (!recording) {
			return false;
		}
		this.catalog.recordings = this.catalog.recordings.filter(r => r.id !== id);
		this.memoryBlobs.delete(id);
		if (this.rootDir) {
			await deleteFileIfExists(path.join(this.rootDir, recording.blobRelativePath));
		}
		await this.persistCatalog();
		this.onDidChangeEmitter.fire(this.getRecordings());
		return true;
	}

	async openAudioBytes(id: string): Promise<Buffer | undefined> {
		const recording = this.getRecording(id);
		if (!recording) {
			return undefined;
		}
		if (this.memoryOnly || !this.dek || !this.rootDir) {
			const mem = this.memoryBlobs.get(id);
			return mem ? Buffer.from(mem) : undefined;
		}
		const blobPath = path.join(this.rootDir, recording.blobRelativePath);
		const envelope = await fs.readFile(blobPath);
		if (!isEnvelope(envelope)) {
			throw new Error(`Audio blob is not a SAENC1 envelope: ${blobPath}`);
		}
		return open(envelope, this.dek);
	}

	/**
	 * Delete catalog, sealed blobs, and tmp for this workspace. Leaves DEK intact.
	 */
	async clearCache(): Promise<void> {
		this.catalog = { version: 1, recordings: [] };
		this.memoryBlobs.clear();
		if (this.rootDir) {
			await fs.rm(path.join(this.rootDir, RECORDINGS_DIRNAME), { recursive: true, force: true });
			await fs.rm(path.join(this.rootDir, TMP_DIRNAME), { recursive: true, force: true });
			await deleteFileIfExists(path.join(this.rootDir, CATALOG_FILENAME));
			await ensureDir(path.join(this.rootDir, RECORDINGS_DIRNAME));
			await ensureDir(path.join(this.rootDir, TMP_DIRNAME));
		}
		this.onDidChangeEmitter.fire(this.getRecordings());
	}

	getRootDir(): string | undefined {
		return this.rootDir;
	}

	dispose(): void {
		this.onDidChangeEmitter.dispose();
		this.memoryBlobs.clear();
	}

	private async persistCatalog(): Promise<void> {
		if (!this.dek || !this.rootDir) {
			return;
		}
		await writeEncryptedJson(path.join(this.rootDir, CATALOG_FILENAME), this.catalog, this.dek);
	}
}
