/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/** Fidelity profile advertised by the sidecar. */
export type ConversionFidelity =
	| 'office-fidelity'
	| 'browser-print'
	| 'semantic'
	| 'preview-fast'
	| 'pdf-ops'
	| 'ocr';

/** Static specification for a conversion or service method. */
export interface ConversionSpec {
	key: string;
	fidelity: ConversionFidelity;
	engine: string;
	available: boolean;
	install_hint?: string;
}

/** Parsed result of `get_available_conversions`. */
export interface AvailableConversions {
	conversions: Record<string, ConversionSpec>;
	aliases: Record<string, string>;
}

/** Sidecar NDJSON request envelope. */
export interface SidecarRequest {
	id: string;
	method: string;
	params?: Record<string, unknown>;
}

/** Sidecar success response envelope. */
export interface SidecarResponse {
	id: string;
	result: Record<string, unknown>;
}

/** Sidecar error response envelope. */
export interface SidecarErrorResponse {
	id: string;
	error: {
		code: string;
		message: string;
		data?: Record<string, unknown>;
	};
}

/** Progress notification from the sidecar. */
export interface SidecarProgressNotification {
	id?: string;
	method: 'progress';
	params: {
		job_id: string;
		progress: number;
		message: string;
		type: string;
	};
}

export interface ConvertParams {
	input: string;
	output: string;
	type: string;
	options?: Record<string, unknown>;
}

export interface BatchConvertParams {
	inputs: string[];
	type: string;
	output_dir?: string;
	options?: Record<string, unknown>;
}

export interface MergePdfsParams {
	inputs: string[];
	output: string;
}

export interface ConvertResult {
	success: boolean;
	output_path?: string;
	duration_ms?: number;
	fidelity?: ConversionFidelity;
	engine?: string;
	error?: string;
}

export interface BatchConvertResult {
	success: boolean;
	results: Array<{
		input: string;
		success: boolean;
		output_path?: string;
		error?: string;
	}>;
	duration_ms?: number;
	fidelity?: ConversionFidelity;
	engine?: string;
	error?: string;
}

/** Webview ↔ extension message types. */
export type WebviewToHostMessage =
	| { type: 'ready' }
	| { type: 'pickInput' }
	| { type: 'pickOutput' }
	| { type: 'pickBatchInputs' }
	| { type: 'pickMergeInputs' }
	| { type: 'pickMergeOutput' }
	| { type: 'convert'; conversionKey: string; input: string; output: string }
	| { type: 'batchConvert'; conversionKey: string; inputs: string[]; outputDir?: string }
	| { type: 'mergePdfs'; inputs: string[]; output: string };

export type HostToWebviewMessage =
	| { type: 'bootstrap'; conversions: AvailableConversions; sidecarReady: boolean; sidecarError?: string }
	| { type: 'paths'; input?: string; output?: string; batchInputs?: string[]; mergeInputs?: string[]; mergeOutput?: string }
	| { type: 'progress'; jobId: string; progress: number; message: string }
	| { type: 'result'; success: boolean; message: string; outputPath?: string }
	| { type: 'conversionsUpdated'; conversions: AvailableConversions };
