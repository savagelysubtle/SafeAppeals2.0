/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Extend globalThis to allow accessing VSCode-specific properties via index access
// This allows code to use globalThis._VSCODE_FILE_ROOT, etc. without type errors

// The proper way to add an index signature to globalThis in TypeScript is to
// augment it via interface merging. However, since globalThis is a value,
// we need to use a type assertion helper or extend via declaration merging.

// For strict TypeScript, we'll augment the global scope to allow index access
declare global {
	// Extend Window interface for browser environments
	interface Window {
		_VSCODE_FILE_ROOT?: string;
		_VSCODE_CSS_LOAD?: (url: string) => void;
		_VSCODE_PRODUCT_JSON?: Record<string, any>;
		_VSCODE_PACKAGE_JSON?: Record<string, any>;
		_VSCODE_NLS_MESSAGES?: string[];
		_VSCODE_NLS_LANGUAGE?: string | undefined;
		_VSCODE_WEB_PACKAGE_TTP?: any;
		workerttPolicy?: TrustedTypePolicy;
		MonacoBootstrapWindow?: any;
		require?: any;
		[key: string]: any;
	}
}

// Add index signature to globalThis by augmenting the global scope
// Note: This uses a workaround since TypeScript doesn't directly support
// adding index signatures to globalThis. The code will need to use
// (globalThis as any)[key] or we can create a helper.
// However, the simplest fix is to add type assertions in the code.

export {};

