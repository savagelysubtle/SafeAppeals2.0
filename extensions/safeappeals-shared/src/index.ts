/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

// Re-export shared utilities for other extensions to use
export {
	acquireDek,
	createMementoDekDurabilityMarker,
	loadJson,
	open,
	readEncryptedJson,
	seal,
	writeEncryptedJson,
	type DekDurabilityMarker,
} from './encryptedStore';
export { deleteFileIfExists, ensureDir, quarantineFile, readFileOrUndefined, writeFileAtomic } from './secureFs';
export {
	ICloudApiClient,
	WebSearchRequestBody,
	WebSearchResponse,
	WebSearchResult,
	MultiWebSearchRequestBody,
	MultiWebSearchResponse,
	MultiWebSearchResult,
	CloudAuthError,
	InsufficientCreditsError,
} from './cloudApiClient';

/**
 * Activates the SafeAppeals Shared extension.
 * This is a utility extension that provides shared functionality to other SafeAppeals extensions.
 */
export function activate(_context: vscode.ExtensionContext): void {
	// No-op - this extension only exports shared utilities
}

export function deactivate(): void {
	// No-op
}
