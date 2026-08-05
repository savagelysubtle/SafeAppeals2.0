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

const INDEXABLE_EXTENSIONS = new Set(['txt', 'text', 'md', 'markdown']);

export interface IndexPipelineDeps {
	readonly ingest: IngestRouter;
	readonly host: Pick<RagCoreHost, 'assertIndexingAllowed' | 'chunkDocument' | 'indexChunks'>;
	readonly getWorkspaceRoots: () => readonly string[];
	readonly readFile?: (fsPath: string) => Promise<Uint8Array>;
	/**
	 * Wrap `indexChunks` in MlResourceEngine `withLease('embedding')`.
	 * When omitted, index runs without a lease (unit tests).
	 */
	readonly withEmbeddingLease?: <T>(fn: () => Promise<T>) => Promise<T>;
	readonly log?: (message: string) => void;
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

export function isIndexableTextPath(fsPath: string): boolean {
	return INDEXABLE_EXTENSIONS.has(extensionOf(fsPath));
}

/**
 * PathGuard → ingest → `chunkDocument` → `indexChunks` (txt/md first).
 */
export class IndexPipeline {
	private readonly ingest: IngestRouter;
	private readonly host: IndexPipelineDeps['host'];
	private readonly getWorkspaceRoots: () => readonly string[];
	private readonly readFile: (fsPath: string) => Promise<Uint8Array>;
	private readonly withEmbeddingLease: <T>(fn: () => Promise<T>) => Promise<T>;
	private readonly log?: (message: string) => void;

	constructor(deps: IndexPipelineDeps) {
		this.ingest = deps.ingest;
		this.host = deps.host;
		this.getWorkspaceRoots = deps.getWorkspaceRoots;
		this.readFile = deps.readFile ?? (async (fsPath: string) => {
			const buf = await fs.readFile(fsPath);
			return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
		});
		this.withEmbeddingLease = deps.withEmbeddingLease ?? (async fn => fn());
		this.log = deps.log;
	}

	async indexFile(request: IndexFileRequest): Promise<IndexPipelineResult> {
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

		if (!isIndexableTextPath(fsPath) && request.bytes === undefined) {
			// Still allow explicit bytes for tests; disk path must be txt/md for auto-index.
			const ext = extensionOf(fsPath);
			if (!INDEXABLE_EXTENSIONS.has(ext)) {
				return {
					kind: 'skipped',
					reason: `Extension .${ext || '(none)'} is not in the M6 txt/md index set`,
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

		const docId = docIdForSourceUri(request.sourceUri);
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
			checksum: checksumOf(bytes),
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

		const indexed = await this.withEmbeddingLease(() =>
			Promise.resolve(this.host.indexChunks(doc, indexChunks)),
		);
		if (!indexed.ok) {
			const reason = indexed.error ?? 'indexChunks failed';
			const code: HardDisableCode =
				/model/i.test(reason) ? 'models-missing' : 'extract-failed';
			return {
				kind: 'hard-disable',
				code,
				message: hardDisableMessage(code, [reason]),
				reasons: [reason],
			};
		}

		this.log?.(
			`Indexed ${filename} → ${chunks.length} chunks (scope=${request.scope}, docId=${docId})`,
		);
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
