/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { hardDisableMessage } from './disableMessages';
import { isArtifactPinConfigured } from './artifactPin';
import {
	FakeDigitalPdfExtractor,
	StubDigitalPdfExtractor,
	pagesToMarkdown,
	type IDigitalPdfExtractor,
} from './digitalPdfExtract';
import {
	NotReadyDocParseBackend,
	type IDocParseBackend,
} from './docParseBackend';
import { detectScannedPdf } from './scannedDetect';
import type { ISealedMarkdownStore } from './sealedMarkdown';
import { extractNonPdf, isPdfUri } from './textExtractors';
import {
	UNLIMITED_OCR_MODEL_ID,
	type HardDisableCode,
	type IArtifactReadiness,
	type IHwProbe,
	type IModelCatalog,
	type IngestHardDisable,
	type IngestOk,
	type IngestResult,
} from './types';

export interface IngestRequest {
	readonly sourceUri: string;
	readonly bytes: Uint8Array;
}

export interface IngestRouterDeps {
	readonly catalog: IModelCatalog;
	readonly probe: IHwProbe;
	readonly artifacts: IArtifactReadiness;
	readonly digitalPdf?: IDigitalPdfExtractor;
	readonly docParse?: IDocParseBackend;
	/** When set, successful ingest persists sealed intermediate Markdown. */
	readonly sealedStore?: ISealedMarkdownStore;
	/**
	 * Wrap OCR parse in MlResourceEngine `withLease('docparse')`.
	 * When omitted, parse runs without a lease (unit tests).
	 */
	readonly withDocParseLease?: <T>(fn: () => Promise<T>) => Promise<T>;
	/**
	 * One-shot ensure before scanned ingest when artifacts are ready but sidecar is not.
	 * Shared with setup panel via safeappeals-ml bridge.
	 */
	readonly ensureDocParseReady?: () => Promise<{ readonly ready: boolean; readonly detail?: string }>;
	/** Refresh DocParse backend readiness cache after ensure succeeds. */
	readonly refreshDocParseReady?: () => Promise<boolean>;
	readonly log?: (message: string) => void;
}

function hardDisable(
	code: HardDisableCode,
	reasons: readonly string[],
	extra: Partial<Pick<IngestHardDisable, 'scanned' | 'charsPerPage' | 'pageCount'>> = {},
): IngestHardDisable {
	return {
		kind: 'hard-disable',
		code,
		message: hardDisableMessage(code, reasons),
		reasons: [...reasons],
		scanned: extra.scanned ?? true,
		charsPerPage: extra.charsPerPage,
		pageCount: extra.pageCount,
	};
}

/**
 * Format → text/Markdown ingest ladder.
 *
 * PDF: digital extract → scanned detect (chars/page < 50) → Unlimited-OCR via
 * catalog+artifacts+sidecar when ready; else HARD-DISABLE (no Tesseract).
 * Digital extract `unavailable` → hard-disable `extract-failed` (no scanned ladder).
 */
export class IngestRouter {
	private readonly catalog: IModelCatalog;
	private readonly probe: IHwProbe;
	private readonly artifacts: IArtifactReadiness;
	private readonly digitalPdf: IDigitalPdfExtractor;
	private readonly docParse: IDocParseBackend;
	private readonly sealedStore: ISealedMarkdownStore | undefined;
	private readonly withDocParseLease: <T>(fn: () => Promise<T>) => Promise<T>;
	private readonly ensureDocParseReady?: () => Promise<{ readonly ready: boolean; readonly detail?: string }>;
	private readonly refreshDocParseReady?: () => Promise<boolean>;
	private readonly log?: (message: string) => void;

	constructor(deps: IngestRouterDeps) {
		this.catalog = deps.catalog;
		this.probe = deps.probe;
		this.artifacts = deps.artifacts;
		this.digitalPdf = deps.digitalPdf ?? new StubDigitalPdfExtractor();
		this.docParse = deps.docParse ?? new NotReadyDocParseBackend();
		this.sealedStore = deps.sealedStore;
		this.withDocParseLease = deps.withDocParseLease ?? (async fn => fn());
		this.ensureDocParseReady = deps.ensureDocParseReady;
		this.refreshDocParseReady = deps.refreshDocParseReady;
		this.log = deps.log;
	}

	async ingest(request: IngestRequest): Promise<IngestResult> {
		const result = isPdfUri(request.sourceUri)
			? await this.ingestPdf(request)
			: this.ingestNonPdf(request);
		if (result.kind === 'ok') {
			await this.persistOk(request.sourceUri, result);
		}
		return result;
	}

	private async persistOk(sourceUri: string, result: IngestOk): Promise<void> {
		if (!this.sealedStore) {
			return;
		}
		try {
			await this.sealedStore.put({
				sourceUri,
				markdown: result.markdown,
				fidelity: result.fidelity,
				anchors: result.anchors,
				pageCount: result.pageCount,
			});
		} catch (err) {
			this.log?.(
				`Failed to seal intermediate Markdown for ${sourceUri}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	private ingestNonPdf(request: IngestRequest): IngestResult {
		const extracted = extractNonPdf(request.sourceUri, request.bytes);
		if (extracted.kind === 'unsupported') {
			return hardDisable('unsupported-format', [extracted.reason], { scanned: false });
		}
		return {
			kind: 'ok',
			markdown: extracted.markdown,
			fidelity: extracted.fidelity,
			anchors: extracted.anchors,
			scanned: false,
		};
	}

	private async ingestPdf(request: IngestRequest): Promise<IngestResult> {
		const extract = await this.digitalPdf.extract(request.sourceUri, request.bytes);
		if (extract.kind === 'unavailable') {
			this.log?.(extract.reason);
			return hardDisable('extract-failed', [extract.reason], { scanned: false });
		}

		const detect = detectScannedPdf(extract.pages);
		if (!detect.scanned) {
			const { markdown, anchors } = pagesToMarkdown(request.sourceUri, extract.pages);
			return {
				kind: 'ok',
				markdown,
				fidelity: 'digital',
				anchors,
				pageCount: detect.pageCount,
				charsPerPage: detect.charsPerPage,
				scanned: false,
			};
		}

		return this.ingestScannedPdf(request, detect.charsPerPage, detect.pageCount);
	}

	private async ingestScannedPdf(
		request: IngestRequest,
		charsPerPage: number,
		pageCount: number,
	): Promise<IngestResult> {
		const snapshot = await this.probe.snapshot();
		const evaluation = this.catalog.evaluate(UNLIMITED_OCR_MODEL_ID, snapshot);

		if (!evaluation.eligible) {
			return hardDisable('scanned-ocr-ineligible', evaluation.reasons, {
				scanned: true,
				charsPerPage,
				pageCount,
			});
		}

		const ocrSpec = this.catalog.get?.(UNLIMITED_OCR_MODEL_ID);
		if (!isArtifactPinConfigured(ocrSpec)) {
			return hardDisable(
				'scanned-ocr-unpinned',
				[
					'Unlimited-OCR artifact downloadUrl/sha256 are not configured for this build',
				],
				{ scanned: true, charsPerPage, pageCount },
			);
		}

		const installed = await this.artifacts.isReady(UNLIMITED_OCR_MODEL_ID);
		if (!installed) {
			return hardDisable(
				'scanned-ocr-not-installed',
				['Unlimited-OCR artifacts are not installed (consent install required)'],
				{ scanned: true, charsPerPage, pageCount },
			);
		}

		if (!this.docParse.isReady()) {
			if (this.ensureDocParseReady) {
				const ensureResult = await this.ensureDocParseReady();
				if (ensureResult.ready) {
					await this.refreshDocParseReady?.();
				} else {
					this.log?.(
						`DocParse ensure before scanned ingest failed: ${ensureResult.detail ?? 'not ready'}`,
					);
				}
			}
		}

		if (!this.docParse.isReady()) {
			return hardDisable(
				'scanned-ocr-sidecar-not-ready',
				['DocParse sidecar is not ready'],
				{ scanned: true, charsPerPage, pageCount },
			);
		}

		const parsed = await this.withDocParseLease(() =>
			this.docParse.parsePdf({
				sourceUri: request.sourceUri,
				bytes: request.bytes,
			}),
		);
		if (parsed.kind === 'error') {
			const pathRejected =
				parsed.code === 'path-outside-workspace' ||
				/outside the workspace/i.test(parsed.message);
			return hardDisable(
				pathRejected ? 'path-outside-workspace' : 'scanned-ocr-sidecar-not-ready',
				[parsed.message],
				{ scanned: true, charsPerPage, pageCount },
			);
		}

		return {
			kind: 'ok',
			markdown: parsed.markdown,
			fidelity: 'ocr',
			anchors: parsed.anchors,
			pageCount: parsed.pageCount,
			charsPerPage,
			scanned: true,
		};
	}
}

export { FakeDigitalPdfExtractor, StubDigitalPdfExtractor };
