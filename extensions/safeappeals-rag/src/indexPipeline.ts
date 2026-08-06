/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { hardDisableMessage } from './disableMessages';
import type { IngestRouter } from './ingestRouter';
import { assertSourceUriInWorkspace, sourceUriToFsPath } from './pathGuard';
import type {
	RagCoreHost,
	RagIndexChunkInput,
	RagIndexDocumentInput,
} from './ragCoreHost';
import {
	CORE_REFERENCES_FOLDER,
	type HardDisableCode,
	type RagIndexScope,
} from './types';

const INDEXABLE_EXTENSIONS = new Set(['txt', 'text', 'md', 'markdown', 'pdf']);

export interface IndexPipelineDeps {
	readonly ingest: IngestRouter;
	readonly host: Pick<RagCoreHost, 'assertIndexingAllowed' | 'chunkDocument' | 'indexChunks' | 'getDocument'>;
	readonly getWorkspaceRoots: () => readonly string[];
	readonly readFile?: (fsPath: string) => Promise<Uint8Array>;
	/**
	 * Wrap `indexChunks` in MlResourceEngine `withLease('embedding')`.
	 * Required in production; unit tests may inject a passthrough mock.
	 */
	readonly withEmbeddingLease?: <T>(fn: () => Promise<T>) => Promise<T>;
	readonly log?: (message: string) => void;
	/** Fired when in-flight index count transitions (status-bar spinner). */
	readonly onIndexingChanged?: (indexing: boolean, inFlight: number) => void;
	/** Fired after each index attempt completes (batch idle / counters). */
	readonly onIndexResult?: (result: IndexPipelineResult) => void;
}

export interface IndexFileRequest {
	readonly sourceUri: string;
	/** When omitted, read from disk after PathGuard. */
	readonly bytes?: Uint8Array;
	readonly scope: RagIndexScope;
}

export type IndexPipelineResult =
	| {
		readonly kind: 'ok';
		readonly docId: string;
		readonly chunkCount: number;
		readonly scope: RagIndexScope;
	}
	| {
		readonly kind: 'hard-disable';
		readonly code: HardDisableCode;
		readonly message: string;
		readonly reasons: readonly string[];
	}
	| {
		readonly kind: 'skipped';
		readonly reason: string;
	};

function extensionOf(fsPath: string): string {
	const base = path.basename(fsPath);
	const dot = base.lastIndexOf('.');
	return dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** Stable doc id for a source URI (used by index + removeDoc). */
export function docIdForSourceUri(sourceUri: string): string {
	return createHash('sha256').update(sourceUri).digest('hex').slice(0, 32);
}

function checksumOf(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Infer index scope from a workspace path.
 * Paths under the physical `core_references/` folder → `core_reference`.
 * Everything else under the workspace → `case_index` scope (not a folder name).
 */
export function scopeFromSourcePath(fsPath: string, workspaceRoots: readonly string[]): RagIndexScope {
	const resolved = path.resolve(fsPath);
	const marker = `${path.sep}${CORE_REFERENCES_FOLDER}${path.sep}`;
	const markerEnd = `${path.sep}${CORE_REFERENCES_FOLDER}`;
	for (const root of workspaceRoots) {
		const resolvedRoot = path.resolve(root);
		if (resolved === resolvedRoot || !resolved.startsWith(resolvedRoot + path.sep)) {
			continue;
		}
		const relative = resolved.slice(resolvedRoot.length);
		if (relative.startsWith(marker) || relative === markerEnd) {
			return 'core_reference';
		}
	}
	if (resolved.includes(marker) || resolved.endsWith(markerEnd)) {
		return 'core_reference';
	}
	return 'case_index';
}

/** True when the file extension is supported by the index pipeline (txt/md/pdf). */
export function isIndexableSourcePath(fsPath: string): boolean {
	return INDEXABLE_EXTENSIONS.has(extensionOf(fsPath));
}

/** @deprecated Use {@link isIndexableSourcePath}. */
export function isIndexableTextPath(fsPath: string): boolean {
	return isIndexableSourcePath(fsPath);
}

/**
 * PathGuard → ingest → `chunkDocument` → `indexChunks` (txt/md/pdf).
 */
export class IndexPipeline {
	private readonly ingest: IngestRouter;
	private readonly host: IndexPipelineDeps['host'];
	private readonly getWorkspaceRoots: () => readonly string[];
	private readonly readFile: (fsPath: string) => Promise<Uint8Array>;
	private readonly withEmbeddingLease?: <T>(fn: () => Promise<T>) => Promise<T>;
	private readonly log?: (message: string) => void;
	private readonly onIndexingChanged?: (indexing: boolean, inFlight: number) => void;
	private readonly onIndexResult?: (result: IndexPipelineResult) => void;
	private inFlight = 0;

	constructor(deps: IndexPipelineDeps) {
		this.ingest = deps.ingest;
		this.host = deps.host;
		this.getWorkspaceRoots = deps.getWorkspaceRoots;
		this.readFile = deps.readFile ?? (async (fsPath: string) => {
			const buf = await fs.readFile(fsPath);
			return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
		});
		this.withEmbeddingLease = deps.withEmbeddingLease;
		this.log = deps.log;
		this.onIndexingChanged = deps.onIndexingChanged;
		this.onIndexResult = deps.onIndexResult;
	}

	/** True while at least one `indexFile` / `indexPath` call is in flight. */
	isIndexing(): boolean {
		return this.inFlight > 0;
	}

	/** Current in-flight index operations (status bar / tests). */
	getInFlightCount(): number {
		return this.inFlight;
	}

	async indexFile(request: IndexFileRequest): Promise<IndexPipelineResult> {
		const result = await this.indexFileInner(request);
		this.onIndexResult?.(result);
		return result;
	}

	private beginIndexing(): void {
		this.inFlight += 1;
		this.onIndexingChanged?.(true, this.inFlight);
	}

	private endIndexing(): void {
		this.inFlight = Math.max(0, this.inFlight - 1);
		this.onIndexingChanged?.(this.inFlight > 0, this.inFlight);
	}

	private async indexFileInner(request: IndexFileRequest): Promise<IndexPipelineResult> {
		const gate = this.host.assertIndexingAllowed();
		if (!gate.ok) {
			return {
				kind: 'hard-disable',
				code: gate.code,
				message: gate.message,
				reasons: [gate.message],
			};
		}

		const roots = this.getWorkspaceRoots();
		let fsPath: string;
		try {
			fsPath = assertSourceUriInWorkspace(request.sourceUri, roots);
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err);
			return {
				kind: 'hard-disable',
				code: 'path-outside-workspace',
				message: hardDisableMessage('path-outside-workspace', [reason]),
				reasons: [reason],
			};
		}

		if (!isIndexableSourcePath(fsPath) && request.bytes === undefined) {
			// Still allow explicit bytes for tests; disk path must be indexable for auto-index.
			const ext = extensionOf(fsPath);
			if (!INDEXABLE_EXTENSIONS.has(ext)) {
				return {
					kind: 'skipped',
					reason: `Extension .${ext || '(none)'} is not in the indexable source set (txt, md, pdf)`,
				};
			}
		}

		let bytes = request.bytes;
		if (!bytes) {
			try {
				bytes = await this.readFile(fsPath);
			} catch (err) {
				const reason = err instanceof Error ? err.message : String(err);
				return {
					kind: 'hard-disable',
					code: 'extract-failed',
					message: hardDisableMessage('extract-failed', [reason]),
					reasons: [reason],
				};
			}
		}

		const checksum = checksumOf(bytes);
		const docId = docIdForSourceUri(request.sourceUri);
		const existing = this.host.getDocument(docId);
		if (existing?.checksum === checksum) {
			return {
				kind: 'skipped',
				reason: 'Document already indexed (unchanged)',
			};
		}

		this.beginIndexing();
		try {
			return await this.indexFileIngest({
				request,
				fsPath,
				bytes,
				checksum,
				docId,
			});
		} finally {
			this.endIndexing();
		}
	}

	private async indexFileIngest(input: {
		readonly request: IndexFileRequest;
		readonly fsPath: string;
		readonly bytes: Uint8Array;
		readonly checksum: string;
		readonly docId: string;
	}): Promise<IndexPipelineResult> {
		const { request, fsPath, bytes, checksum, docId } = input;

		const ingestResult = await this.ingest.ingest({
			sourceUri: request.sourceUri,
			bytes,
		});
		if (ingestResult.kind === 'hard-disable') {
			return {
				kind: 'hard-disable',
				code: ingestResult.code,
				message: ingestResult.message,
				reasons: ingestResult.reasons,
			};
		}

		const chunks = this.host.chunkDocument({
			docId,
			text: ingestResult.markdown,
			sourceUri: request.sourceUri,
		});

		const now = new Date().toISOString();
		const filename = path.basename(fsPath);
		const filetype = extensionOf(fsPath) || 'txt';
		const doc: RagIndexDocumentInput = {
			id: docId,
			path: fsPath,
			filename,
			filetype,
			filesize: bytes.byteLength,
			checksum,
			scope: request.scope,
			isCoreReference: request.scope === 'core_reference',
			createdAt: now,
			lastIndexedAt: now,
		};

		const indexChunks: RagIndexChunkInput[] = chunks.map(chunk => ({
			chunkId: chunk.chunkId,
			text: chunk.text,
			chunkIndex: chunk.chunkIndex,
			tokenCount: chunk.tokenCount,
			parentChunkId: chunk.parentChunkId,
			chunkType: chunk.chunkType,
			sectionId: chunk.sectionId,
			sectionNumber: chunk.sectionNumber,
			sectionTitle: chunk.sectionTitle,
			breadcrumbPath: chunk.breadcrumbPath,
			sourceUri: chunk.sourceUri,
			page: chunk.page,
			heading: chunk.heading,
			charStart: chunk.charStart,
			charEnd: chunk.charEnd,
		}));

		if (!this.withEmbeddingLease) {
			const reason = 'MlResourceEngine embedding lease unavailable.';
			return {
				kind: 'hard-disable',
				code: 'models-missing',
				message: hardDisableMessage('models-missing', [reason]),
				reasons: [reason],
			};
		}

		const indexed = await this.withEmbeddingLease(() =>
			Promise.resolve(this.host.indexChunks(doc, indexChunks)),
		);
		if (!indexed.ok) {
			const reason = indexed.error ?? 'indexChunks failed';
			const code: HardDisableCode =
				/LockBusy/i.test(reason)
					? 'index-lock-busy'
					: /model/i.test(reason)
						? 'models-missing'
						: 'extract-failed';
			this.log?.(
				`Index failed for ${filename}: ${reason}`,
			);
			return {
				kind: 'hard-disable',
				code,
				message: hardDisableMessage(code, [reason]),
				reasons: [reason],
			};
		}

		// Per-file success is intentionally silent (status bar + batch summaries only).
		return {
			kind: 'ok',
			docId,
			chunkCount: chunks.length,
			scope: request.scope,
		};
	}

	/**
	 * Index a workspace file with scope inferred from path (`core_references/` vs case).
	 */
	async indexPath(fsPathOrUri: string): Promise<IndexPipelineResult> {
		const roots = this.getWorkspaceRoots();
		let sourceUri: string;
		let fsPath: string;
		if (fsPathOrUri.startsWith('file:')) {
			sourceUri = fsPathOrUri;
			fsPath = sourceUriToFsPath(sourceUri);
		} else {
			fsPath = path.resolve(fsPathOrUri);
			sourceUri = pathToFileUri(fsPath);
		}
		const scope = scopeFromSourcePath(fsPath, roots);
		return this.indexFile({ sourceUri, scope });
	}
}

function pathToFileUri(fsPath: string): string {
	const normalized = fsPath.replace(/\\/g, '/');
	if (/^[A-Za-z]:\//.test(normalized)) {
		return `file:///${normalized}`;
	}
	return `file://${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}
