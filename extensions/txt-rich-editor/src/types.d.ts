/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'html-to-docx' {
	interface HtmlToDocxOptions {
		table?: {
			row?: {
				cantSplit?: boolean;
			};
		};
		footer?: boolean;
		header?: boolean;
		font?: string;
		fontSize?: number;
		complexScriptFont?: string;
		rightToLeft?: boolean;
	}

	function htmlToDocx(html: string, header?: string, options?: HtmlToDocxOptions): Promise<Buffer>;
	export = htmlToDocx;
}

declare module 'mammoth' {
	interface ConversionResult {
		value: string;
		messages: any[];
	}

	function convertToHtml(options: { buffer: Uint8Array }): Promise<ConversionResult>;

	export { convertToHtml };
}
