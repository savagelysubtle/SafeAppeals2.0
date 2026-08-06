/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

const CONVERTER_EXTENSION_ID = 'safeappeals.safeappeals-converter';

/** Minimal slice of safeappeals-converter activate() exports. */
export interface SafeAppealsConverterApi {
	getConverterService(): IConverterPdfPagesClient | undefined;
}

/** Side of ConverterService used for born-digital PDF page extract. */
export interface IConverterPdfPagesClient {
	readonly isSidecarAvailable: boolean;
	extractPdfPages(sourcePath: string): Promise<{
		readonly success: boolean;
		readonly pages?: ReadonlyArray<{ readonly page: number; readonly text: string }>;
		readonly error?: string;
	}>;
}

/**
 * Resolve the converter extension for sidecar-owned digital PDF extract.
 * Fail closed when the extension or sidecar binary is unavailable.
 */
export async function resolveConverterPdfPagesClient(
	log?: (message: string) => void,
): Promise<IConverterPdfPagesClient | undefined> {
	const ext = vscode.extensions.getExtension<SafeAppealsConverterApi>(CONVERTER_EXTENSION_ID);
	if (!ext) {
		log?.(`safeappeals-converter extension not found (${CONVERTER_EXTENSION_ID})`);
		return undefined;
	}
	const api = ext.isActive ? ext.exports : await ext.activate();
	const service = api?.getConverterService?.();
	if (!service) {
		log?.('safeappeals-converter activate() did not export ConverterService');
		return undefined;
	}
	return service;
}
