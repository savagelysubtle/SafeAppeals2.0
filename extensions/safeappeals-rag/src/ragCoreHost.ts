/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { hardDisableMessage } from './disableMessages';
import { syncRagModelEnv, type ModelEnvSyncResult } from './modelEnvSync';
import {
	acquireDek,
	createMementoDekDurabilityMarker,
	type DekUnavailableReason,
} from './shared/encryptedStore';
import { ensureDir, quarantineFile } from './shared/secureFs';
import {
	RAG_DEK_KEY,
	type HardDisableCode,
} from './types';

/** True when openWorkspace failed because the on-disk index is unreadable (wrong DEK / corrupt). */
function isUnreadableIndexError(message: string): boolean {
	return /SQLCipher|key rejected|not a database|plaintext|crypto unavailable|PRAGMA key/i.test(message);
}

/**
 * Move aside unreadable workspace index files so a fresh encrypted DB can be created.
 * Does not delete permanently — files become `*.corrupt-<timestamp>`.
 */
async function quarantineUnreadableIndex(rootDir: string, log?: (m: string) => void): Promise<void> {
	const names = [
		'chunks.db',
		'chunks.db-wal',
		'chunks.db-shm',
		'vectors.usearch',
		'.dek-sentinel',
	];
	for (const name of names) {
		const p = path.join(rootDir, name);
		const moved = await quarantineFile(p);
		if (moved) {
			log?.(`Quarantined unreadable Private Search file: ${moved}`);
		}
	}
	// Tantivy index is a directory — rename wholesale when present.
	const tantivy = path.join(rootDir, 'text.tantivy');
	try {
		const st = await fs.stat(tantivy);
		if (st.isDirectory()) {
			const stamp = new Date().toISOString().replace(/:/g, '-');
			const dest = `${tantivy}.corrupt-${stamp}`;
			await fs.rename(tantivy, dest);
			log?.(`Quarantined unreadable Private Search index dir: ${dest}`);
		}
	} catch {
		// absent
	}
}

/** Indexing role reported by rag-core when a workspace is open. */
export type IndexWriteRole = 'primary' | 'secondary';

/** Minimal native surface used by the host (mirrors `@safeappeals/rag-core`). */
export interface RagCapabilities {
	readonly hybrid: boolean;
	readonly rerank: boolean;
	readonly queryProcessor: boolean;
	readonly modelsPresent: boolean;
	readonly storageReady: boolean;
	readonly dims: number;
	readonly indexWriteRole?: IndexWriteRole;
	readonly indexWriteCapable: boolean;
}

export interface RagStats {
	readonly documents: number;
	readonly chunks: number;
	readonly vectors: number;
	readonly textDocs: number;
}

export interface RagOpResult {
	readonly ok: boolean;
	readonly error?: string | null;
	readonly count?: number | null;
}

export interface RagEnsureEmbedderResult {
	readonly ok: boolean;
	readonly error?: string | null;
	readonly loaded: boolean;
}

export interface RagSearchOptions {
	readonly finalK: number;
	readonly scope?: string | null;
}

export interface RagSearchResultItem {
	readonly chunkId: string;
	readonly docId: string;
	readonly text: string;
	readonly fusedScore: number;
	readonly bm25Rank?: number | null;
	readonly vectorRank?: number | null;
	readonly sourceUri?: string | null;
	readonly page?: number | null;
	readonly heading?: string | null;
	readonly charStart?: number | null;
	readonly charEnd?: number | null;
	readonly sectionTitle?: string | null;
	readonly breadcrumbPath?: string | null;
	readonly chunkType?: string | null;
	readonly scope: string;
}

export interface RagSearchResult {
	readonly ok: boolean;
	readonly error?: string | null;
	readonly results: RagSearchResultItem[];
}

export interface RagChunkDocumentInput {
	readonly docId: string;
	readonly text: string;
	readonly sourceUri: string;
	readonly page?: number | null;
}

export interface RagChunkDocumentOutput {
	readonly chunkId: string;
	readonly docId: string;
	readonly text: string;
	readonly chunkIndex: number;
	readonly tokenCount: number;
	readonly parentChunkId?: string | null;
	readonly chunkType: string;
	readonly sectionId?: string | null;
	readonly sectionNumber?: string | null;
	readonly sectionTitle?: string | null;
	readonly breadcrumbPath?: string | null;
	readonly sourceUri: string;
	readonly page?: number | null;
	readonly heading?: string | null;
	readonly charStart?: number | null;
	readonly charEnd?: number | null;
}

export interface RagIndexDocumentInput {
	readonly id: string;
	readonly path: string;
	readonly filename: string;
	readonly filetype: string;
	readonly filesize: number;
	readonly checksum: string;
	readonly scope: string;
	readonly isCoreReference: boolean;
	readonly metadataJson?: string | null;
	readonly createdAt: string;
	readonly lastIndexedAt: string;
}

export interface RagIndexChunkInput {
	readonly chunkId: string;
	readonly text: string;
	readonly chunkIndex: number;
	readonly tokenCount?: number | null;
	readonly parentChunkId?: string | null;
	readonly chunkType?: string | null;
	readonly sectionId?: string | null;
	readonly sectionNumber?: string | null;
	readonly sectionTitle?: string | null;
	readonly breadcrumbPath?: string | null;
	readonly metadataJson?: string | null;
	readonly sourceUri?: string | null;
	readonly page?: number | null;
	readonly heading?: string | null;
	readonly charStart?: number | null;
	readonly charEnd?: number | null;
}

export interface RagCoreNativeApi {
	ping(): string;
	version(): string;
	capabilities(): RagCapabilities;
	openWorkspace(rootDir: string, dekBytes: Buffer | Uint8Array, preferSecondary?: boolean): RagOpResult;
	closeWorkspace(): RagOpResult;
	stats(): RagStats;
	getDocument(docId: string): RagIndexDocumentInput | null | undefined;
	chunkDocument(input: RagChunkDocumentInput): RagChunkDocumentOutput[];
	indexChunks(doc: RagIndexDocumentInput, chunks: RagIndexChunkInput[]): RagOpResult;
	removeDoc(docId: string): RagOpResult;
	search(query: string, opts: RagSearchOptions): RagSearchResult;
	ensureEmbedderLoaded?(): RagEnsureEmbedderResult;
	clearEmbedder?(): RagOpResult;
	clearReranker?(): RagOpResult;
}

export type RagCoreLoadResult =
	| { readonly ok: true; readonly native: RagCoreNativeApi; readonly bindingPath: string }
	| { readonly ok: false; readonly error: string; readonly expectedPath: string };

export type RagCoreLoader = (packageRoot?: string) => RagCoreLoadResult;

export interface RagCoreHostStatus {
	readonly available: boolean;
	readonly disableCode: HardDisableCode | undefined;
	readonly disableMessage: string | undefined;
	readonly reasons: readonly string[];
	readonly nativeVersion: string | undefined;
	readonly bindingPath: string | undefined;
	readonly expectedPath: string | undefined;
	readonly capabilities: RagCapabilities | undefined;
	readonly stats: RagStats | undefined;
	readonly workspaceRoot: string | undefined;
	readonly workspaceOpen: boolean;
	readonly indexWriteRole: IndexWriteRole | undefined;
	readonly modelEnv: ModelEnvSyncResult | undefined;
	readonly dekReason: DekUnavailableReason | undefined;
	/** Packaging note when electron-146 prebuild load failed; empty when native is loaded. */
	readonly electron146Note: string;
}

export interface RagCoreHostCreateOptions {
	readonly context: vscode.ExtensionContext;
	readonly workspaceId: string;
	readonly getArtifactDir: (modelId: string) => Promise<string | undefined>;
	readonly load?: RagCoreLoader;
	readonly packageRoot?: string;
	readonly log?: (message: string) => void;
	/** When true, skip modelsPresent gate (unit tests with fake native). */
	readonly skipModelsGate?: boolean;
	/** Soft hint only (e.g. Agents window). Flock decides primary vs secondary; not used for role election. */
	readonly preferSecondary?: boolean;
}

/** Proposed API: true in the Agents / sessions dedicated window. */
export function isAgentSessionsWindow(): boolean {
	return (vscode.workspace as { isAgentSessionsWorkspace?: boolean }).isAgentSessionsWorkspace === true;
}

/** Only shown when native load failed and expectedPath targets electron-146. */
function electron146PackagingNote(expectedPath: string | undefined): string {
	if (!expectedPath?.includes('electron-146')) {
		return '';
	}
	return 'linux-x64/electron-146 prebuild was not found for this runtime; rebuild rag-core prebuilds or use node-137 for tests.';
}

/**
 * Soft-load `@safeappeals/rag-core` without throwing when the `.node` is missing.
 */
export function defaultLoadRagCore(packageRoot?: string): RagCoreLoadResult {
	try {
		// Prefer nativeLoader so we do not rely on the package's eager side-effect load.
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require('@safeappeals/rag-core/nativeLoader') as {
			loadRagCore: (root?: string) => RagCoreLoadResult;
		};
		return mod.loadRagCore(packageRoot);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			error: `Failed to import @safeappeals/rag-core: ${message}`,
			expectedPath: packageRoot ?? '(unresolved)',
		};
	}
}

/**
 * Thin host over rag-core: soft-load, DEK, single-session workspace, capability gates.
 * Storage: `context.globalStorageUri/rag/<workspaceId>/` (single root + document scope field).
 */
export class RagCoreHost {
	private native: RagCoreNativeApi | undefined;
	private bindingPath: string | undefined;
	private expectedPath: string | undefined;
	private dek: Buffer | undefined;
	private dekReason: DekUnavailableReason | undefined;
	private workspaceRoot: string | undefined;
	private workspaceOpen = false;
	private indexWriteRole: IndexWriteRole | undefined;
	private disableCode: HardDisableCode | undefined;
	private reasons: string[] = [];
	private modelEnv: ModelEnvSyncResult | undefined;
	private capabilitiesCache: RagCapabilities | undefined;
	/** Set when `ensureEmbedderLoaded` fails; cleared on success. Idle unload does not set this. */
	private embedInitFailed = false;

	private constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly workspaceId: string,
		private readonly getArtifactDir: (modelId: string) => Promise<string | undefined>,
		private readonly log?: (message: string) => void,
		private readonly skipModelsGate = false,
	) { }

	static async create(options: RagCoreHostCreateOptions): Promise<RagCoreHost> {
		const host = new RagCoreHost(
			options.context,
			options.workspaceId,
			options.getArtifactDir,
			options.log,
			options.skipModelsGate === true,
		);
		await host.initialize(
			options.load ?? defaultLoadRagCore,
			options.packageRoot,
			options.preferSecondary === true || isAgentSessionsWindow(),
		);
		return host;
	}

	/** Absolute managed root: `…/rag/<workspaceId>/`. */
	static storageRoot(globalStorageFsPath: string, workspaceId: string): string {
		return path.join(globalStorageFsPath, 'rag', workspaceId);
	}

	private setDisable(code: HardDisableCode, reasons: readonly string[]): void {
		this.disableCode = code;
		this.reasons = [...reasons];
		this.log?.(hardDisableMessage(code, reasons));
	}

	private clearModelsMissingDisable(): void {
		if (this.disableCode === 'models-missing') {
			this.disableCode = undefined;
			this.reasons = [];
			this.log?.('models-missing cleared after model env / capabilities refresh.');
		}
	}

	/**
	 * Re-sync BYO / ML artifact model dirs and re-read native capabilities.
	 *
	 * `models-missing` means Search pack artifacts are absent or `ensureEmbedderLoaded`
	 * failed — not "cold between MlResourceEngine leases" (idle unload keeps availability
	 * when artifacts remain on disk).
	 *
	 * Clears only a `models-missing` gate; leaves `native-missing` / `index-lock-busy` / `crypto-unavailable` alone.
	 */
	async refreshModelGates(): Promise<void> {
		this.modelEnv = await syncRagModelEnv({
			getArtifactDir: this.getArtifactDir,
			log: this.log,
		});

		if (!this.native) {
			return;
		}

		try {
			this.capabilitiesCache = this.native.capabilities();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.log?.(`capabilities() refresh failed: ${message}`);
			return;
		}

		if (this.disableCode !== undefined && this.disableCode !== 'models-missing') {
			return;
		}

		if (this.skipModelsGate) {
			this.clearModelsMissingDisable();
			return;
		}

		if (!this.modelEnv.embedReady) {
			this.setDisable('models-missing', [
				'Search pack models not installed; use Install Missing Models or set BYO SA_RAG_EMBED_MODEL_DIR.',
			]);
			return;
		}

		if (this.embedInitFailed) {
			this.setDisable('models-missing', [
				'Search pack files are present but the embedding model failed to load in rag-core. Rebuild rag-core with the fastembed feature, or check Private Search output.',
			]);
			return;
		}

		// Artifacts present; cold between leases (modelsPresent false) stays available.
		this.clearModelsMissingDisable();
	}

	private async initialize(
		load: RagCoreLoader,
		packageRoot: string | undefined,
		preferSecondary: boolean,
	): Promise<void> {
		this.modelEnv = await syncRagModelEnv({
			getArtifactDir: this.getArtifactDir,
			log: this.log,
		});

		const loaded = load(packageRoot);
		if (!loaded.ok) {
			this.expectedPath = loaded.expectedPath;
			const note = electron146PackagingNote(loaded.expectedPath);
			this.setDisable(
				'native-missing',
				note ? [loaded.error, note] : [loaded.error],
			);
			return;
		}

		this.native = loaded.native;
		this.bindingPath = loaded.bindingPath;
		this.expectedPath = undefined;

		let caps: RagCapabilities;
		try {
			caps = loaded.native.capabilities();
			this.capabilitiesCache = caps;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.setDisable('native-missing', [message]);
			return;
		}

		if (!caps.storageReady) {
			this.setDisable('native-missing', [
				'rag-core storageReady=false (SQLCipher build missing or failed).',
			]);
			return;
		}

		const rootDir = RagCoreHost.storageRoot(this.context.globalStorageUri.fsPath, this.workspaceId);
		const sentinelPath = path.join(rootDir, '.dek-sentinel');
		const dekResult = await acquireDek({
			secrets: this.context.secrets,
			keyId: RAG_DEK_KEY,
			existingDataPaths: [sentinelPath, path.join(rootDir, 'chunks.db')],
			log: this.log,
			marker: createMementoDekDurabilityMarker(this.context.globalState, RAG_DEK_KEY),
		});

		if (dekResult.kind !== 'ok') {
			this.dekReason = dekResult.reason;
			this.setDisable('crypto-unavailable', [dekResult.reason]);
			return;
		}
		this.dek = dekResult.dek;

		if (!this.skipModelsGate && !caps.modelsPresent && !this.modelEnv.embedReady) {
			this.setDisable('models-missing', [
				'Search pack models not installed; use Install Missing Models or set BYO SA_RAG_EMBED_MODEL_DIR.',
			]);
			// Still open workspace so status/stats work; index/search remain gated via disableCode.
		}

		await ensureDir(rootDir);
		let open = loaded.native.openWorkspace(rootDir, this.dek, preferSecondary);
		if (!open.ok) {
			const err = open.error ?? 'openWorkspace failed';
			// Wrong DEK / corrupt chunks.db is not an ABI problem — recover by quarantining
			// and creating a fresh encrypted index (primary only; secondaries stay read-only).
			if (!preferSecondary && isUnreadableIndexError(err)) {
				this.log?.(
					`Private Search index unreadable (${err}); quarantining workspace files and retrying open`,
				);
				await quarantineUnreadableIndex(rootDir, this.log);
				open = loaded.native.openWorkspace(rootDir, this.dek, preferSecondary);
				if (open.ok) {
					this.log?.('Private Search index reset successfully; re-index workspace documents if needed.');
				} else {
					const retryErr = open.error ?? err;
					this.setDisable(
						'crypto-unavailable',
						[
							retryErr,
							'Could not open or recreate the encrypted index. Try “Clear Local Data” for Private Search if available, or reload the window.',
						],
					);
					return;
				}
			} else if (isUnreadableIndexError(err)) {
				this.setDisable('crypto-unavailable', [err]);
				return;
			} else {
				this.setDisable('native-missing', [err]);
				return;
			}
		}

		this.workspaceRoot = rootDir;
		this.workspaceOpen = true;
		try {
			this.capabilitiesCache = loaded.native.capabilities();
			this.indexWriteRole = this.capabilitiesCache.indexWriteRole;
		} catch {
			this.indexWriteRole = 'primary';
		}

		await this.refreshModelGates();

		this.log?.(
			`rag-core ready: version=${loaded.native.version()} root=${rootDir}` +
			` role=${this.indexWriteRole ?? 'unknown'}` +
			(this.disableCode ? ` (gated: ${this.disableCode})` : ''),
		);
	}

	get isAvailable(): boolean {
		return this.assertSearchAllowed().ok;
	}

	getDisableCode(): HardDisableCode | undefined {
		return this.disableCode;
	}

	getNative(): RagCoreNativeApi | undefined {
		return this.native;
	}

	/**
	 * Load BGE into rag-core when MlResourceEngine holds an embedding lease.
	 * Returns `{ ok: false }` when native binding lacks the export (older prebuild).
	 */
	ensureEmbedderLoaded(): RagEnsureEmbedderResult {
		if (!this.native) {
			return { ok: false, error: 'rag-core native is not loaded', loaded: false };
		}
		if (typeof this.native.ensureEmbedderLoaded !== 'function') {
			return {
				ok: false,
				error: 'ensureEmbedderLoaded is not exported by this rag-core prebuild',
				loaded: false,
			};
		}
		try {
			const result = this.native.ensureEmbedderLoaded();
			if (!result.ok) {
				this.embedInitFailed = true;
				this.log?.(`ensureEmbedderLoaded failed: ${result.error ?? 'unknown error'}`);
			} else {
				this.embedInitFailed = false;
			}
			this.capabilitiesCache = this.native.capabilities();
			return result;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.embedInitFailed = true;
			this.log?.(`ensureEmbedderLoaded threw: ${message}`);
			return { ok: false, error: message, loaded: false };
		}
	}

	/**
	 * Drop native embedder (+ CE) when MlResourceEngine releases the embedding lease.
	 * Does not re-gate `models-missing` when Search pack artifacts remain (idle unload).
	 */
	clearEmbedder(): void {
		if (!this.native) {
			return;
		}
		if (typeof this.native.clearEmbedder !== 'function') {
			return;
		}
		try {
			const result = this.native.clearEmbedder();
			if (!result.ok) {
				this.log?.(`clearEmbedder failed: ${result.error ?? 'unknown error'}`);
			} else {
				this.log?.('Embedding model unloaded from rag-core.');
			}
			this.capabilitiesCache = this.native.capabilities();
			// Idle unload: artifacts may still be present — stay available for Private Search UX.
			if (this.modelEnv?.embedReady && !this.embedInitFailed) {
				this.clearModelsMissingDisable();
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.log?.(`clearEmbedder threw: ${message}`);
		}
	}

	/** True when search may run (workspace open + no hard-disable; read-only OK). */
	assertSearchAllowed(): { ok: true } | { ok: false; code: HardDisableCode; message: string } {
		if (this.disableCode) {
			return {
				ok: false,
				code: this.disableCode,
				message: hardDisableMessage(this.disableCode, this.reasons),
			};
		}
		if (!this.native || !this.workspaceOpen) {
			return {
				ok: false,
				code: 'native-missing',
				message: hardDisableMessage('native-missing', ['Workspace is not open.']),
			};
		}
		return { ok: true };
	}

	/** True when index/remove may run (requires write-capable session). */
	assertIndexingAllowed(): { ok: true } | { ok: false; code: HardDisableCode; message: string } {
		const searchGate = this.assertSearchAllowed();
		if (!searchGate.ok) {
			return searchGate;
		}
		if (
			this.indexWriteRole === 'secondary' ||
			this.capabilitiesCache?.indexWriteCapable === false
		) {
			return {
				ok: false,
				code: 'read-only-session',
				message: hardDisableMessage('read-only-session', [
					'Indexing is owned by the primary workbench window.',
				]),
			};
		}
		return { ok: true };
	}

	search(query: string, opts: RagSearchOptions): RagSearchResult {
		const gate = this.assertSearchAllowed();
		if (!gate.ok) {
			return { ok: false, error: gate.message, results: [] };
		}
		return this.native!.search(query, opts);
	}

	/** Document metadata from the open workspace index, or undefined when missing / unavailable. */
	getDocument(docId: string): RagIndexDocumentInput | undefined {
		if (!this.native || !this.workspaceOpen) {
			return undefined;
		}
		if (typeof this.native.getDocument !== 'function') {
			return undefined;
		}
		try {
			const doc = this.native.getDocument(docId);
			return doc ?? undefined;
		} catch {
			return undefined;
		}
	}

	chunkDocument(input: RagChunkDocumentInput): RagChunkDocumentOutput[] {
		if (!this.native) {
			throw new Error('rag-core native is not loaded');
		}
		return this.native.chunkDocument(input);
	}

	indexChunks(doc: RagIndexDocumentInput, chunks: RagIndexChunkInput[]): RagOpResult {
		const gate = this.assertIndexingAllowed();
		if (!gate.ok) {
			return { ok: false, error: gate.message };
		}
		const result = this.native!.indexChunks(doc, chunks);
		if (!result.ok && result.error?.includes('LockBusy')) {
			this.setDisable('index-lock-busy', [result.error]);
		}
		return result;
	}

	removeDoc(docId: string): RagOpResult {
		const gate = this.assertIndexingAllowed();
		if (!gate.ok) {
			return { ok: false, error: gate.message };
		}
		const result = this.native!.removeDoc(docId);
		if (!result.ok && result.error?.includes('LockBusy')) {
			this.setDisable('index-lock-busy', [result.error]);
		}
		return result;
	}

	closeWorkspace(): RagOpResult {
		if (!this.native || !this.workspaceOpen) {
			return { ok: true };
		}
		const result = this.native.closeWorkspace();
		this.workspaceOpen = false;
		return result;
	}

	getStatus(): RagCoreHostStatus {
		let stats: RagStats | undefined;
		if (this.native && this.workspaceOpen) {
			try {
				stats = this.native.stats();
			} catch {
				stats = undefined;
			}
		}
		const disableMessage = this.disableCode
			? hardDisableMessage(this.disableCode, this.reasons)
			: undefined;
		return {
			available: this.isAvailable,
			disableCode: this.disableCode,
			disableMessage,
			reasons: this.reasons,
			nativeVersion: this.native ? (() => {
				try {
					return this.native.version();
				} catch {
					return undefined;
				}
			})() : undefined,
			bindingPath: this.bindingPath,
			expectedPath: this.expectedPath,
			capabilities: this.capabilitiesCache,
			stats,
			workspaceRoot: this.workspaceRoot,
			workspaceOpen: this.workspaceOpen,
			indexWriteRole: this.indexWriteRole,
			modelEnv: this.modelEnv,
			dekReason: this.dekReason,
			electron146Note: electron146PackagingNote(this.expectedPath),
		};
	}
}
