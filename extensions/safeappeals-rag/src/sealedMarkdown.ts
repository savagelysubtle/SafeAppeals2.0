/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import {
	acquireDek,
	createMementoDekDurabilityMarker,
	loadJson,
	writeEncryptedJson,
} from './shared/encryptedStore';
import { ensureDir } from './shared/secureFs';
import type { CitationAnchor, IngestFidelity } from './types';
import { RAG_DEK_KEY } from './types';

/**
 * Sealed intermediate Markdown payload (re-chunk without re-OCR).
 * Stored under `globalStorageUri/rag/<workspaceId>/sealed_md/<docHash>.json` as SAENC1.
 */
export interface SealedMarkdownRecord {
	readonly version: 1;
	readonly sourceUri: string;
	readonly markdown: string;
	readonly fidelity: IngestFidelity;
	readonly anchors: readonly CitationAnchor[];
	readonly sealedAt: number;
	readonly pageCount?: number;
}

export interface SealedMarkdownStoreCreateResult {
	readonly store: SealedMarkdownStore;
	readonly memoryOnly: boolean;
	readonly dekReason?: string;
}

/** Minimal put surface used by {@link IngestRouter}. */
export interface ISealedMarkdownStore {
	put(record: Omit<SealedMarkdownRecord, 'version' | 'sealedAt'> & {
		readonly sealedAt?: number;
	}): Promise<string>;
	clear(): Promise<void>;
}

/**
 * Encrypted intermediate Markdown cache for ingest.
 * Fail-closed: when DEK is unavailable, keeps records in memory only (never plaintext on disk).
 */
export class SealedMarkdownStore implements ISealedMarkdownStore {
	private readonly memory = new Map<string, SealedMarkdownRecord>();

	private constructor(
		private readonly rootDir: string | undefined,
		private readonly dek: Buffer | undefined,
		readonly memoryOnly: boolean,
	) { }

	/**
	 * Create under `context.globalStorageUri/rag/<workspaceId>/sealed_md/`.
	 */
	static async create(
		context: vscode.ExtensionContext,
		workspaceId: string,
		log?: (message: string) => void,
	): Promise<SealedMarkdownStoreCreateResult> {
		const rootDir = path.join(context.globalStorageUri.fsPath, 'rag', workspaceId, 'sealed_md');
		const sentinelPath = path.join(rootDir, '.dek-sentinel');

		const dekResult = await acquireDek({
			secrets: context.secrets,
			keyId: RAG_DEK_KEY,
			existingDataPaths: [sentinelPath],
			log,
			marker: createMementoDekDurabilityMarker(context.globalState, RAG_DEK_KEY),
		});

		if (dekResult.kind !== 'ok') {
			log?.(`RAG sealed-MD DEK unavailable (${dekResult.reason}); memory-only mode`);
			return {
				store: new SealedMarkdownStore(undefined, undefined, true),
				memoryOnly: true,
				dekReason: dekResult.reason,
			};
		}

		await ensureDir(rootDir);
		return {
			store: new SealedMarkdownStore(rootDir, dekResult.dek, false),
			memoryOnly: false,
		};
	}

	/** In-memory-only store for unit tests (never writes disk). */
	static createMemoryOnlyForTesting(): SealedMarkdownStore {
		return new SealedMarkdownStore(undefined, undefined, true);
	}

	/** Encrypted store rooted at `rootDir` for unit tests with a known DEK. */
	static createEncryptedForTesting(rootDir: string, dek: Buffer): SealedMarkdownStore {
		return new SealedMarkdownStore(rootDir, dek, false);
	}

	static docHash(sourceUri: string): string {
		return createHash('sha256').update(sourceUri).digest('hex').slice(0, 32);
	}

	getRootDir(): string | undefined {
		return this.rootDir;
	}

	private filePath(docHash: string): string | undefined {
		if (!this.rootDir) {
			return undefined;
		}
		return path.join(this.rootDir, `${docHash}.json`);
	}

	async put(record: Omit<SealedMarkdownRecord, 'version' | 'sealedAt'> & {
		readonly sealedAt?: number;
	}): Promise<string> {
		const docHash = SealedMarkdownStore.docHash(record.sourceUri);
		const full: SealedMarkdownRecord = {
			version: 1,
			sourceUri: record.sourceUri,
			markdown: record.markdown,
			fidelity: record.fidelity,
			anchors: record.anchors,
			sealedAt: record.sealedAt ?? Date.now(),
			pageCount: record.pageCount,
		};

		this.memory.set(docHash, full);

		const filePath = this.filePath(docHash);
		if (filePath && this.dek) {
			await writeEncryptedJson(filePath, full, this.dek);
		}
		return docHash;
	}

	async get(sourceUri: string): Promise<SealedMarkdownRecord | undefined> {
		const docHash = SealedMarkdownStore.docHash(sourceUri);
		const cached = this.memory.get(docHash);
		if (cached) {
			return cached;
		}
		const filePath = this.filePath(docHash);
		if (!filePath || !this.dek) {
			return undefined;
		}
		const loaded = await loadJson<SealedMarkdownRecord>(filePath, this.dek);
		if (loaded.value?.version === 1) {
			this.memory.set(docHash, loaded.value);
			return loaded.value;
		}
		return undefined;
	}

	/**
	 * Purge sealed intermediate Markdown: clear the memory map and delete the
	 * `sealed_md` directory on disk when present.
	 */
	async clear(): Promise<void> {
		this.memory.clear();
		if (!this.rootDir) {
			return;
		}
		await fs.rm(this.rootDir, { recursive: true, force: true });
	}
}
