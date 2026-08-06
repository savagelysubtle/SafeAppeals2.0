/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	resolveConverterPdfPagesClient,
	type IConverterPdfPagesClient,
} from './converterBridge';
import type {
	DigitalPdfExtractResult,
	IDigitalPdfExtractor,
} from './digitalPdfExtract';
import type { PageText } from './scannedDetect';

export interface ConverterDigitalPdfExtractDeps {
	readonly getClient?: () => Promise<IConverterPdfPagesClient | undefined>;
	readonly log?: (message: string) => void;
}

/**
 * Born-digital PDF extract via sa-converter sidecar (`extract_pdf_pages` RPC).
 * Does not use docparse lease or EH-native PDF libraries.
 */
export class ConverterDigitalPdfExtract implements IDigitalPdfExtractor {
	private readonly getClient: () => Promise<IConverterPdfPagesClient | undefined>;
	private readonly log?: (message: string) => void;

	constructor(deps: ConverterDigitalPdfExtractDeps = {}) {
		this.getClient = deps.getClient ?? (() => resolveConverterPdfPagesClient(deps.log));
		this.log = deps.log;
	}

	async extract(sourceUri: string, _bytes: Uint8Array): Promise<DigitalPdfExtractResult> {
		const client = await this.getClient();
		if (!client) {
			return {
				kind: 'unavailable',
				reason:
					'safeappeals-converter extension unavailable — born-digital PDF extract requires the converter sidecar.',
			};
		}
		if (!client.isSidecarAvailable) {
			return {
				kind: 'unavailable',
				reason:
					'sa-converter binary not found — born-digital PDF extract unavailable until the converter sidecar is installed.',
			};
		}

		const fsPath = vscode.Uri.parse(sourceUri).fsPath;
		const result = await client.extractPdfPages(fsPath);
		if (!result.success) {
			const reason = result.error ?? 'Converter PDF page extract failed.';
			this.log?.(reason);
			return { kind: 'unavailable', reason };
		}

		const pages: PageText[] = (result.pages ?? []).map(page => ({
			text: page.text ?? '',
		}));
		if (pages.length === 0) {
			return {
				kind: 'unavailable',
				reason: 'Converter returned no PDF pages (empty or unreadable document).',
			};
		}
		return { kind: 'ok', pages };
	}
}
