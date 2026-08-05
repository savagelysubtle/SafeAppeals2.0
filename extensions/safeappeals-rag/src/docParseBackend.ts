/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { CitationAnchor } from './types';

export interface DocParseRequest {
	readonly sourceUri: string;
	readonly bytes: Uint8Array;
}

export interface DocParseOk {
	readonly kind: 'ok';
	readonly markdown: string;
	readonly anchors: readonly CitationAnchor[];
	readonly pageCount: number;
}

export type DocParseErrorCode =
	| 'path-outside-workspace'
	| 'not-ready'
	| 'sidecar-error';

export interface DocParseError {
	readonly kind: 'error';
	readonly message: string;
	readonly code?: DocParseErrorCode;
}

export type DocParseResult = DocParseOk | DocParseError;

/**
 * OCR / Unlimited-OCR sidecar client. Production impl: {@link UnlimitedOCRBackend}.
 */
export interface IDocParseBackend {
	/** True when artifacts + sidecar health cache say ready. */
	isReady(): boolean;
	parsePdf(request: DocParseRequest): Promise<DocParseResult>;
}

/**
 * Hard stub when ML bridge / sidecar cannot be constructed.
 * Never implies Tesseract availability.
 */
export class NotReadyDocParseBackend implements IDocParseBackend {
	isReady(): boolean {
		return false;
	}

	async parsePdf(_request: DocParseRequest): Promise<DocParseResult> {
		return {
			kind: 'error',
			message: 'DocParse backend is not ready (Unlimited-OCR sidecar unavailable).',
		};
	}
}
