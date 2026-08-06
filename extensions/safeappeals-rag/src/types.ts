/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * Citation contract for every chunk / contextPack (plan R10 / M8).
 *
 * Canonical definition lives here. `toolContracts.ts` re-exports this type
 * and maps rag-core `charStart`/`charEnd` → `charRange`. Do not duplicate.
 */
export interface CitationAnchor {
	readonly sourceUri: string;
	readonly page?: number;
	readonly heading?: string;
	readonly charRange?: {
		readonly start: number;
		readonly end: number;
	};
}

/** How intermediate Markdown was produced. */
export type IngestFidelity = 'digital' | 'ocr' | 'native-text';

/**
 * Hard-disable codes for scanned / OCR paths and host gates.
 * Never falls back to Tesseract for RAG ingest.
 */
export type HardDisableCode =
	| 'scanned-ocr-ineligible'
	| 'scanned-ocr-unpinned'
	| 'scanned-ocr-not-installed'
	| 'scanned-ocr-sidecar-not-ready'
	| 'path-outside-workspace'
	| 'unsupported-format'
	| 'extract-failed'
	| 'native-missing'
	| 'index-lock-busy'
	| 'read-only-session'
	| 'models-missing'
	| 'crypto-unavailable';

/** Document scope stored in rag-core (single workspace root + scope field). */
export type RagIndexScope = 'core_reference' | 'case_index';

/** Workspace folder name that auto-indexes as `core_reference` (only physical special folder). */
export const CORE_REFERENCES_FOLDER = 'core_references';

export interface IngestOk {
	readonly kind: 'ok';
	readonly markdown: string;
	readonly fidelity: IngestFidelity;
	readonly anchors: readonly CitationAnchor[];
	readonly pageCount?: number;
	readonly charsPerPage?: number;
	readonly scanned: boolean;
}

export interface IngestHardDisable {
	readonly kind: 'hard-disable';
	readonly code: HardDisableCode;
	readonly message: string;
	readonly reasons: readonly string[];
	readonly scanned: boolean;
	readonly charsPerPage?: number;
	readonly pageCount?: number;
}

export type IngestResult = IngestOk | IngestHardDisable;

/**
 * Hardware snapshot shape — mirrors safeappeals-ml `HwSnapshot`.
 * Duplicated so this extension compiles without importing sibling sources.
 */
export interface HwSnapshot {
	readonly platform: NodeJS.Platform;
	readonly arch: string;
	readonly osRelease: string;
	readonly cpuModel: string;
	readonly cpuCount: number;
	readonly totalRamMb: number;
	readonly freeRamMb: number;
	readonly diskFreeMb: number;
	readonly gpuVramMb: number | undefined;
	readonly gpuName: string | undefined;
	readonly probedAt: number;
}

export interface ModelEvaluateResult {
	readonly eligible: boolean;
	readonly reasons: string[];
}

/** Optional catalog size lookup used by Local AI Setup copy. */
export interface IModelSpecLite {
	readonly id: string;
	readonly diskMb: number;
	readonly version?: string;
	readonly sha256?: string;
	readonly downloadUrl?: string;
	readonly artifactFileName?: string;
	readonly files?: readonly {
		readonly relativePath: string;
		readonly downloadUrl: string;
		readonly sha256: string;
	}[];
}

/** Catalog surface used by the ingest ladder (safeappeals-ml ModelCatalog). */
export interface IModelCatalog {
	evaluate(modelId: string, snapshot: HwSnapshot): ModelEvaluateResult;
	get?(modelId: string): IModelSpecLite | undefined;
}

export interface IHwProbe {
	snapshot(): Promise<HwSnapshot>;
}

export interface IArtifactReadiness {
	isReady(modelId: string): Promise<boolean>;
	/**
	 * Absolute artifact directory for the catalog version when ready.
	 * Undefined when not installed, unknown model, or store API unavailable.
	 */
	artifactDir?(modelId: string): Promise<string | undefined>;
}

/** Unlimited-OCR model id in safeappeals-ml catalog. */
export const UNLIMITED_OCR_MODEL_ID = 'unlimited-ocr';

/** BGE-small embedding model id (Search pack). */
export const BGE_SMALL_MODEL_ID = 'bge-small-en-v1.5';

/** ms-marco MiniLM cross-encoder model id (Search pack). */
export const MS_MARCO_CE_MODEL_ID = 'ms-marco-minilm-l6-v2';

/**
 * Consent-install outcome — mirrors safeappeals-ml `ConsentInstallOutcome`.
 * Duplicated so this extension compiles without importing sibling sources.
 */
export type ConsentInstallOutcome =
	| { readonly kind: 'installed'; readonly modelId: string; readonly version: string }
	| { readonly kind: 'already-ready'; readonly modelId: string; readonly version: string }
	| { readonly kind: 'ineligible'; readonly modelId: string; readonly reasons: readonly string[] }
	| { readonly kind: 'consent-required'; readonly modelId: string }
	| { readonly kind: 'error'; readonly modelId: string; readonly message: string };

/** Void-like scanned threshold: average chars per page below this → scanned. */
export const SCANNED_CHARS_PER_PAGE_THRESHOLD = 50;

export const RAG_DEK_KEY = 'safeappeals.rag.dek';
