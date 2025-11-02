/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// AMD2ESM migration relevant

declare global {

	/**
	 * Holds the file root for resources.
	 */
	var _VSCODE_FILE_ROOT: string;

	/**
	 * CSS loader that's available during development time.
	 * DO NOT call directly, instead just import css modules, like `import 'some.css'`
	 */
	var _VSCODE_CSS_LOAD: (module: string) => void;

	/**
	 * @deprecated You MUST use `IProductService` whenever possible.
	 */
	var _VSCODE_PRODUCT_JSON: Record<string, any>;
	/**
	 * @deprecated You MUST use `IProductService` whenever possible.
	 */
	var _VSCODE_PACKAGE_JSON: Record<string, any>;

	// Extend globalThis to allow index access
	interface Window {
		_VSCODE_FILE_ROOT?: string;
		_VSCODE_CSS_LOAD?: (module: string) => void;
		_VSCODE_PRODUCT_JSON?: Record<string, any>;
		_VSCODE_PACKAGE_JSON?: Record<string, any>;
		_VSCODE_NLS_MESSAGES?: string[];
		_VSCODE_NLS_LANGUAGE?: string | undefined;
		_VSCODE_WEB_PACKAGE_TTP?: any;
		workerttPolicy?: TrustedTypePolicy;
		MonacoBootstrapWindow?: any;
		require?: any;
	}

}

// fake export to make global work
export { }
