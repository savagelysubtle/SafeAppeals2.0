/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import type * as vscode from 'vscode';
import { hardDisableMessage } from './disableMessages';
import { syncRagModelEnv, type ModelEnvSyncResult } from './modelEnvSync';
import {
	acquireDek,
	createMementoDekDurabilityMarker,
	type DekUnavailableReason,
} from './shared/encryptedStore';
import { ensureDir } from './shared/secureFs';
import {
	RAG_DEK_KEY,
	type HardDisableCode,
} from './types';

/** Minimal native surface used by the host (mirrors `@safeappeals/rag-core`). */
export interface RagCapabilities {
	readonly hybrid: boolean;
	readonly rerank: boolean;
	readonly queryProcessor: boolean;
	readonly modelsPresent: boolean;
	readonly storageReady: boolean;
	readonly dims: number;
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
	openWorkspace(rootDir: string, dekBytes: Buffer | Uint8Array): RagOpResult;
	closeWorkspace(): RagOpResult;
	stats(): RagStats;
	chunkDocument(input: RagChunkDocumentInput): RagChunkDocumentOutput[];
	indexChunks(doc: RagIndexDocumentInput, chunks: RagIndexChunkInput[]): RagOpResult;
	removeDoc(docId: string): RagOpResult;
	search(query: string, opts: RagSearchOptions): RagSearchResult;
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
	readonly modelEnv: ModelEnvSyncResult | undefined;
	readonly dekReason: DekUnavailableReason | undefined;
	/** Honest packaging gap: Electron ABI 146 prebuild still missing for desktop. */
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
}

const ELECTRON_146_NOTE =
	'linux-x64/electron-146 prebuild is not produced yet — packaged Electron desktop hard-disables until built; node-137 works for tests.';

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
	private disableCode: HardDisableCode | undefined;
	private reasons: string[] = [];
	private modelEnv: ModelEnvSyncResult | undefined;
	private capabilitiesCache: RagCapabilities | undefined;

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
		await host.initialize(options.load ?? defaultLoadRagCore, options.packageRoot);
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
	 * Clears only a `models-missing` gate when embed is ready or `modelsPresent`.
	 * Leaves `native-missing` / `crypto-unavailable` alone.
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

		const caps = this.capabilitiesCache;
		const embedOk =
			this.skipModelsGate ||
			this.modelEnv.embedReady === true ||
			caps?.modelsPresent === true;
		if (embedOk) {
			this.clearModelsMissingDisable();
		}
	}

	private async initialize(load: RagCoreLoader, packageRoot?: string): Promise<void> {
		this.modelEnv = await syncRagModelEnv({
			getArtifactDir: this.getArtifactDir,
			log: this.log,
		});

		const loaded = load(packageRoot);
		if (!loaded.ok) {
			this.expectedPath = loaded.expectedPath;
			this.setDisable('native-missing', [loaded.error, ELECTRON_146_NOTE]);
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
			this.setDisable('native-missing', [message, ELECTRON_146_NOTE]);
			return;
		}

		if (!caps.storageReady) {
			this.setDisable('native-missing', [
				'rag-core storageReady=false (SQLCipher build missing or failed).',
				ELECTRON_146_NOTE,
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
				'Search pack downloadUrl/sha still unpinned; set BYO SA_RAG_EMBED_MODEL_DIR or install Search Tools when pinned.',
			]);
			// Still open workspace so status/stats work; index/search remain gated via disableCode.
		}

		await ensureDir(rootDir);
		const open = loaded.native.openWorkspace(rootDir, this.dek);
		if (!open.ok) {
			this.setDisable('native-missing', [
				open.error ?? 'openWorkspace failed',
				ELECTRON_146_NOTE,
			]);
			return;
		}

		this.workspaceRoot = rootDir;
		this.workspaceOpen = true;
		try {
			this.capabilitiesCache = loaded.native.capabilities();
		} catch {
			// keep prior cache
		}

		// openWorkspace / try_load_default may flip modelsPresent after the pre-open gate.
		// Re-sync and clear sticky models-missing when embed env or native models are ready.
		await this.refreshModelGates();
		if (!this.skipModelsGate) {
			const after = this.capabilitiesCache;
			const embedOk =
				this.modelEnv?.embedReady === true || after?.modelsPresent === true;
			if (!embedOk && this.disableCode === undefined) {
				this.setDisable('models-missing', [
					'Embedding model not loaded (Search pack / BYO SA_RAG_EMBED_MODEL_DIR).',
				]);
			}
		}

		this.log?.(
			`rag-core ready: version=${loaded.native.version()} root=${rootDir}` +
			(this.disableCode ? ` (gated: ${this.disableCode})` : ''),
		);
	}

	get isAvailable(): boolean {
		return this.disableCode === undefined && this.workspaceOpen && this.native !== undefined;
	}

	getDisableCode(): HardDisableCode | undefined {
		return this.disableCode;
	}

	getNative(): RagCoreNativeApi | undefined {
		return this.native;
	}

	/** True when index/search may run (workspace open + no hard-disable). */
	assertIndexingAllowed(): { ok: true } | { ok: false; code: HardDisableCode; message: string } {
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

	search(query: string, opts: RagSearchOptions): RagSearchResult {
		const gate = this.assertIndexingAllowed();
		if (!gate.ok) {
			return { ok: false, error: gate.message, results: [] };
		}
		return this.native!.search(query, opts);
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
		return this.native!.indexChunks(doc, chunks);
	}

	removeDoc(docId: string): RagOpResult {
		const gate = this.assertIndexingAllowed();
		if (!gate.ok) {
			return { ok: false, error: gate.message };
		}
		return this.native!.removeDoc(docId);
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
			modelEnv: this.modelEnv,
			dekReason: this.dekReason,
			electron146Note: ELECTRON_146_NOTE,
		};
	}
}
