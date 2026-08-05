/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type {
	DocParseRequest,
	DocParseResult,
	IDocParseBackend,
} from './docParseBackend';
import type { DocParseHost } from './docParseHost';
import { assertSourceUriInWorkspace } from './pathGuard';
import type { CitationAnchor, IArtifactReadiness } from './types';
import { UNLIMITED_OCR_MODEL_ID } from './types';

/** Soft page cap for Unlimited-OCR jobs (plan: ~40; warn + split larger). */
export const DEFAULT_OCR_PAGE_SOFT_CAP = 40;

export type PageCounter = (pdfBytes: Uint8Array) => number;

export interface UnlimitedOCRBackendOptions {
	readonly host: DocParseHost;
	readonly artifacts: IArtifactReadiness;
	readonly getWorkspaceRoots: () => readonly string[];
	readonly pageSoftCap?: number;
	readonly countPages?: PageCounter;
	readonly modelId?: string;
	readonly log?: (message: string) => void;
	/** Sidecar crash isolation: notify MlResourceEngine (`reportCrash('docparse')`). */
	readonly onSidecarCrash?: (message: string) => void;
}

/**
 * {@link IDocParseBackend} for Unlimited-OCR via localhost {@link DocParseHost}.
 * Not ready when artifacts missing or sidecar unhealthy. Never loads VLM in EH.
 */
export class UnlimitedOCRBackend implements IDocParseBackend {
	private readonly host: DocParseHost;
	private readonly artifacts: IArtifactReadiness;
	private readonly getWorkspaceRoots: () => readonly string[];
	private readonly pageSoftCap: number;
	private readonly countPages: PageCounter;
	private readonly modelId: string;
	private readonly log?: (message: string) => void;
	private readonly onSidecarCrash?: (message: string) => void;
	private artifactReadyCached = false;

	constructor(options: UnlimitedOCRBackendOptions) {
		this.host = options.host;
		this.artifacts = options.artifacts;
		this.getWorkspaceRoots = options.getWorkspaceRoots;
		this.pageSoftCap = options.pageSoftCap ?? DEFAULT_OCR_PAGE_SOFT_CAP;
		this.countPages = options.countPages ?? estimatePdfPageCount;
		this.modelId = options.modelId ?? UNLIMITED_OCR_MODEL_ID;
		this.log = options.log;
		this.onSidecarCrash = options.onSidecarCrash;
	}

	/**
	 * Sync readiness: artifact cache + last sidecar health probe.
	 * Call {@link refreshReady} after activate / before critical paths.
	 */
	isReady(): boolean {
		return this.artifactReadyCached && this.host.isHealthyCached;
	}

	/** Refresh artifact + sidecar health caches. */
	async refreshReady(): Promise<boolean> {
		this.artifactReadyCached = await this.artifacts.isReady(this.modelId);
		const health = await this.host.health();
		return this.isReady() && health.ok;
	}

	async parsePdf(request: DocParseRequest): Promise<DocParseResult> {
		try {
			assertSourceUriInWorkspace(request.sourceUri, this.getWorkspaceRoots());
		} catch (err) {
			return {
				kind: 'error',
				code: 'path-outside-workspace',
				message: err instanceof Error ? err.message : String(err),
			};
		}

		if (!(await this.refreshReady())) {
			return {
				kind: 'error',
				code: 'not-ready',
				message: this.artifactReadyCached
					? 'DocParse sidecar is not healthy'
					: 'Unlimited-OCR artifacts are not ready',
			};
		}

		const pageCount = Math.max(1, this.countPages(request.bytes));
		try {
			if (pageCount <= this.pageSoftCap) {
				const parsed = await this.host.parse({
					sourceUri: request.sourceUri,
					pdfBytes: request.bytes,
					pageFrom: 1,
					pageTo: pageCount,
				});
				return {
					kind: 'ok',
					markdown: parsed.markdown,
					anchors: parsed.anchors.length
						? parsed.anchors
						: defaultAnchors(request.sourceUri, pageCount),
					pageCount: parsed.pageCount || pageCount,
				};
			}

			this.log?.(
				`Unlimited-OCR soft cap: ${pageCount} pages exceeds ${this.pageSoftCap}; splitting into ranges.`,
			);

			const parts: string[] = [];
			const anchors: CitationAnchor[] = [];
			let ranges = 0;
			for (let from = 1; from <= pageCount; from += this.pageSoftCap) {
				const to = Math.min(from + this.pageSoftCap - 1, pageCount);
				ranges++;
				const parsed = await this.host.parse({
					sourceUri: request.sourceUri,
					pdfBytes: request.bytes,
					pageFrom: from,
					pageTo: to,
				});
				parts.push(parsed.markdown);
				if (parsed.anchors.length) {
					anchors.push(...parsed.anchors);
				} else {
					for (let page = from; page <= to; page++) {
						anchors.push({ sourceUri: request.sourceUri, page });
					}
				}
			}

			this.log?.(
				`Unlimited-OCR split complete: ${pageCount} pages in ${ranges} job(s) (soft cap ${this.pageSoftCap}).`,
			);

			return {
				kind: 'ok',
				markdown: parts.join('\n\n'),
				anchors,
				pageCount,
			};
		} catch (err) {
			this.host.markUnhealthy();
			const message = err instanceof Error ? err.message : String(err);
			this.onSidecarCrash?.(message);
			return {
				kind: 'error',
				code: 'sidecar-error',
				message,
			};
		}
	}
}

function defaultAnchors(sourceUri: string, pageCount: number): CitationAnchor[] {
	const anchors: CitationAnchor[] = [];
	for (let page = 1; page <= pageCount; page++) {
		anchors.push({ sourceUri, page });
	}
	return anchors;
}

/**
 * Best-effort PDF page count via `/Type /Page` markers (good enough for soft-cap split).
 * Sidecar remains authoritative for actual OCR page coverage.
 */
export function estimatePdfPageCount(pdfBytes: Uint8Array): number {
	const text = Buffer.from(pdfBytes).toString('latin1');
	const matches = text.match(/\/Type\s*\/Page\b/g);
	const count = matches?.length ?? 0;
	return count > 0 ? count : 1;
}
