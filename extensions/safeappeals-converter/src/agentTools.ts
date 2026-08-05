/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ConverterService } from './converterService';
import { getConversionSpec, resolveConversionKey } from './protocol';
import type { AvailableConversions, ConversionSpec, ConvertResult } from './types';

export const CONVERTER_LIST_CONVERSIONS_TOOL = 'safeappeals_converter_listConversions';
export const CONVERTER_CONVERT_TOOL = 'safeappeals_converter_convert';
export const CONVERTER_BATCH_CONVERT_TOOL = 'safeappeals_converter_batchConvert';
export const CONVERTER_MERGE_PDFS_TOOL = 'safeappeals_converter_mergePdfs';

/** All contributed Safe Appeals Converter LM tool names. */
export const CONVERTER_TOOL_NAMES = [
	CONVERTER_LIST_CONVERSIONS_TOOL,
	CONVERTER_CONVERT_TOOL,
	CONVERTER_BATCH_CONVERT_TOOL,
	CONVERTER_MERGE_PDFS_TOOL,
] as const;

/** Court/filing exports — require confirm_filing; never silent preview-fast downgrade. */
export const FILING_TARGET_CONVERSION_TYPES = [
	'docx2pdf',
	'xlsx2pdf',
	'pptx2pdf',
	'html2pdf',
	'md2pdf',
] as const;

export type FilingTargetConversionType = typeof FILING_TARGET_CONVERSION_TYPES[number];

interface ListConversionsInput {
	available_only?: boolean;
}

interface ConvertInput {
	input: string;
	output: string;
	type: string;
	confirm_filing?: boolean;
	options?: Record<string, unknown>;
}

interface BatchConvertInput {
	inputs: string[];
	type: string;
	output_dir?: string;
	confirm_filing?: boolean;
	options?: Record<string, unknown>;
}

interface MergePdfsInput {
	inputs: string[];
	output: string;
}

export function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

export function isFilingTargetConversionType(type: string): type is FilingTargetConversionType {
	return (FILING_TARGET_CONVERSION_TYPES as readonly string[]).includes(type);
}

function getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] {
	return vscode.workspace.workspaceFolders ?? [];
}

function formatConversionSpec(spec: ConversionSpec): string {
	const parts = [
		`key: ${spec.key}`,
		`fidelity: ${spec.fidelity}`,
		`engine: ${spec.engine}`,
		`available: ${spec.available}`,
	];
	if (spec.install_hint) {
		parts.push(`install_hint: ${spec.install_hint}`);
	}
	return parts.join('\n');
}

function formatResultLines(fields: Record<string, string | number | boolean | undefined>): string {
	return Object.entries(fields)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}: ${value}`)
		.join('\n');
}

function resolveSpec(type: string, available: AvailableConversions): ConversionSpec | undefined {
	const canonical = resolveConversionKey(type, available);
	return getConversionSpec(canonical, available) ?? getConversionSpec(type, available);
}

function requestedPreviewFast(options: Record<string, unknown> | undefined): boolean {
	if (!options) {
		return false;
	}
	const engine = options.engine;
	return engine === 'preview-fast' || engine === 'preview_fast';
}

/**
 * Validates filing-target rules before invoking the sidecar.
 * Returns an error message or undefined when the request may proceed.
 */
export function validateFilingTargetRequest(
	type: string,
	spec: ConversionSpec | undefined,
	confirmFiling: boolean | undefined,
	options: Record<string, unknown> | undefined,
): string | undefined {
	const canonical = spec?.key ?? resolveConversionKey(type, { conversions: {}, aliases: {} });
	if (!isFilingTargetConversionType(canonical) && !isFilingTargetConversionType(type)) {
		return undefined;
	}

	const filingType = isFilingTargetConversionType(canonical) ? canonical : type;

	if (requestedPreviewFast(options)) {
		return (
			`Error: Cannot use preview-fast for filing-target export "${filingType}". `
			+ 'Install the required dependencies for court-class fidelity or choose a non-filing conversion.'
		);
	}

	if (!spec) {
		return `Error: Unknown conversion type "${type}". Use safeappeals_converter_listConversions to see available keys.`;
	}

	if (!spec.available) {
		const hint = spec.install_hint ? ` ${spec.install_hint}` : '';
		return (
			`Error: Filing-target export "${filingType}" is not available `
			+ `(fidelity: ${spec.fidelity}, engine: ${spec.engine}).${hint} `
			+ 'Refused: cannot silently downgrade to preview-fast for filing-target exports.'
		);
	}

	if (confirmFiling !== true) {
		return (
			`Error: Filing-target export "${filingType}" requires confirm_filing: true. `
			+ `Court-class PDF export uses fidelity ${spec.fidelity} via ${spec.engine}.`
		);
	}

	return undefined;
}

function enrichConvertResult(result: ConvertResult, spec?: ConversionSpec): string {
	const lines = formatResultLines({
		success: result.success,
		output_path: result.output_path,
		fidelity: result.fidelity ?? spec?.fidelity,
		engine: result.engine ?? spec?.engine,
		duration_ms: result.duration_ms,
		error: result.error,
	});
	if (!lines.includes('fidelity:')) {
		return `${lines}\nfidelity: ${spec?.fidelity ?? 'unknown'}`;
	}
	return lines;
}

class ConverterListConversionsTool implements vscode.LanguageModelTool<ListConversionsInput> {
	constructor(private readonly getService: () => ConverterService | undefined) { }

	async invoke(
		_options: vscode.LanguageModelToolInvocationOptions<ListConversionsInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const service = this.getService();
		if (!service) {
			return textResult('Error: converter service is not available.');
		}
		if (getWorkspaceFolders().length === 0) {
			return textResult('Error: open a workspace folder to use converter tools.');
		}

		const availableOnly = _options.input?.available_only === true;
		const snapshot = service.getAvailableConversions();
		const entries = Object.entries(snapshot.conversions).filter(([, spec]) => !availableOnly || spec.available);

		if (entries.length === 0) {
			const sidecarReady = service.isSidecarAvailable;
			return textResult(
				sidecarReady
					? 'No conversions matched the filter.'
					: 'Error: sa-converter binary not found. Build rust/converter or set SAFEAPPEALS_CONVERTER_PATH.',
			);
		}

		const aliasLines = Object.entries(snapshot.aliases).map(([alias, canonical]) => `${alias} → ${canonical}`);
		const body = entries.map(([, spec]) => formatConversionSpec(spec)).join('\n\n');
		const aliases = aliasLines.length > 0 ? `\n\nAliases:\n${aliasLines.join('\n')}` : '';
		return textResult(`Conversions (${entries.length}):\n\n${body}${aliases}`);
	}
}

class ConverterConvertTool implements vscode.LanguageModelTool<ConvertInput> {
	constructor(private readonly getService: () => ConverterService | undefined) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<ConvertInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const type = options.input?.type ?? '(unknown)';
		const input = options.input?.input ?? '(unknown input)';
		const output = options.input?.output ?? '(unknown output)';
		const filing = isFilingTargetConversionType(type);
		return {
			invocationMessage: `Converting ${input} → ${output} (${type})`,
			confirmationMessages: filing
				? {
					title: 'Court-Class PDF Export',
					message: `Export ${type} for filing:\n${input}\n→ ${output}\n\nRequires court-class fidelity. Set confirm_filing: true to proceed.`,
				}
				: {
					title: 'Convert File',
					message: `Convert file:\n${input}\n→ ${output}\n(${type})`,
				},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ConvertInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const service = this.getService();
		if (!service) {
			return textResult('Error: converter service is not available.');
		}
		if (getWorkspaceFolders().length === 0) {
			return textResult('Error: open a workspace folder to use converter tools.');
		}

		const input = options.input;
		const inputPath = input?.input?.trim() ?? '';
		const outputPath = input?.output?.trim() ?? '';
		const type = input?.type?.trim() ?? '';

		if (!inputPath) {
			return textResult('Error: "input" is required (workspace-relative or absolute path).');
		}
		if (!outputPath) {
			return textResult('Error: "output" is required (workspace-relative or absolute path).');
		}
		if (!type) {
			return textResult('Error: "type" is required (conversion key, e.g. md2html).');
		}

		const available = service.getAvailableConversions();
		const spec = resolveSpec(type, available);
		const filingError = validateFilingTargetRequest(type, spec, input?.confirm_filing, input?.options);
		if (filingError) {
			return textResult(filingError);
		}
		if (!spec) {
			return textResult(`Error: Unknown conversion type "${type}". Use safeappeals_converter_listConversions.`);
		}
		if (!spec.available) {
			const hint = spec.install_hint ? ` ${spec.install_hint}` : '';
			return textResult(
				`Error: Conversion "${spec.key}" is not available (fidelity: ${spec.fidelity}, engine: ${spec.engine}).${hint}`,
			);
		}

		const result = await service.convert({
			input: inputPath,
			output: outputPath,
			type: spec.key,
			options: input?.options,
		});

		if (result.success) {
			return textResult(`Conversion succeeded.\n${enrichConvertResult(result, spec)}`);
		}
		return textResult(`Conversion failed.\n${enrichConvertResult(result, spec)}`);
	}
}

class ConverterBatchConvertTool implements vscode.LanguageModelTool<BatchConvertInput> {
	constructor(private readonly getService: () => ConverterService | undefined) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<BatchConvertInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const type = options.input?.type ?? '(unknown)';
		const count = options.input?.inputs?.length ?? 0;
		const filing = isFilingTargetConversionType(type);
		return {
			invocationMessage: `Batch converting ${count} file(s) (${type})`,
			confirmationMessages: filing
				? {
					title: 'Court-Class Batch PDF Export',
					message: `Batch export ${count} file(s) as ${type} for filing. Set confirm_filing: true to proceed.`,
				}
				: {
					title: 'Batch Convert Files',
					message: `Batch convert ${count} file(s) using ${type}.`,
				},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<BatchConvertInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const service = this.getService();
		if (!service) {
			return textResult('Error: converter service is not available.');
		}
		if (getWorkspaceFolders().length === 0) {
			return textResult('Error: open a workspace folder to use converter tools.');
		}

		const input = options.input;
		const inputs = input?.inputs ?? [];
		const type = input?.type?.trim() ?? '';

		if (!Array.isArray(inputs) || inputs.length === 0) {
			return textResult('Error: "inputs" is required (non-empty array of workspace paths).');
		}
		if (!type) {
			return textResult('Error: "type" is required (conversion key).');
		}

		const available = service.getAvailableConversions();
		const spec = resolveSpec(type, available);
		const filingError = validateFilingTargetRequest(type, spec, input?.confirm_filing, input?.options);
		if (filingError) {
			return textResult(filingError);
		}
		if (!spec) {
			return textResult(`Error: Unknown conversion type "${type}". Use safeappeals_converter_listConversions.`);
		}
		if (!spec.available) {
			const hint = spec.install_hint ? ` ${spec.install_hint}` : '';
			return textResult(
				`Error: Conversion "${spec.key}" is not available (fidelity: ${spec.fidelity}, engine: ${spec.engine}).${hint}`,
			);
		}

		const result = await service.batchConvert({
			inputs: inputs.map(p => String(p).trim()).filter(Boolean),
			type: spec.key,
			output_dir: input?.output_dir?.trim() || undefined,
			options: input?.options,
		});

		const header = formatResultLines({
			success: result.success,
			fidelity: result.fidelity ?? spec.fidelity,
			engine: result.engine ?? spec.engine,
			duration_ms: result.duration_ms,
			error: result.error,
		});
		const itemLines = result.results.map((entry, index) => {
			const prefix = `[${index + 1}] ${entry.input}`;
			if (entry.success) {
				return `${prefix}\nsuccess: true\noutput_path: ${entry.output_path ?? ''}`;
			}
			return `${prefix}\nsuccess: false\nerror: ${entry.error ?? 'unknown'}`;
		});
		const status = result.success ? 'Batch conversion succeeded.' : 'Batch conversion failed.';
		return textResult(`${status}\n${header}\n\n${itemLines.join('\n\n')}`);
	}
}

class ConverterMergePdfsTool implements vscode.LanguageModelTool<MergePdfsInput> {
	constructor(private readonly getService: () => ConverterService | undefined) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<MergePdfsInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const count = options.input?.inputs?.length ?? 0;
		const output = options.input?.output ?? '(unknown output)';
		return {
			invocationMessage: `Merging ${count} PDF(s) → ${output}`,
			confirmationMessages: {
				title: 'Merge PDFs',
				message: `Merge ${count} PDF file(s) into:\n${output}`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<MergePdfsInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const service = this.getService();
		if (!service) {
			return textResult('Error: converter service is not available.');
		}
		if (getWorkspaceFolders().length === 0) {
			return textResult('Error: open a workspace folder to use converter tools.');
		}

		const input = options.input;
		const inputs = input?.inputs ?? [];
		const outputPath = input?.output?.trim() ?? '';

		if (!Array.isArray(inputs) || inputs.length === 0) {
			return textResult('Error: "inputs" is required (non-empty array of PDF paths).');
		}
		if (!outputPath) {
			return textResult('Error: "output" is required (workspace-relative or absolute path).');
		}

		const available = service.getAvailableConversions();
		const spec = getConversionSpec('merge_pdfs', available);
		if (spec && !spec.available) {
			const hint = spec.install_hint ? ` ${spec.install_hint}` : '';
			return textResult(
				`Error: merge_pdfs is not available (fidelity: ${spec.fidelity}, engine: ${spec.engine}).${hint}`,
			);
		}

		const result = await service.mergePdfs({
			inputs: inputs.map(p => String(p).trim()).filter(Boolean),
			output: outputPath,
		});

		if (result.success) {
			return textResult(`PDF merge succeeded.\n${enrichConvertResult(result, spec)}`);
		}
		return textResult(`PDF merge failed.\n${enrichConvertResult(result, spec)}`);
	}
}

/**
 * Build converter LM tool instances (exported for unit tests).
 */
export function createConverterAgentTools(getService: () => ConverterService | undefined) {
	return {
		listConversions: new ConverterListConversionsTool(getService),
		convert: new ConverterConvertTool(getService),
		batchConvert: new ConverterBatchConvertTool(getService),
		mergePdfs: new ConverterMergePdfsTool(getService),
	};
}

/**
 * Register Safe Appeals Converter LM tools.
 */
export function registerAgentTools(
	context: vscode.ExtensionContext,
	getService: () => ConverterService | undefined,
): void {
	const tools = createConverterAgentTools(getService);
	context.subscriptions.push(
		vscode.lm.registerTool(CONVERTER_LIST_CONVERSIONS_TOOL, tools.listConversions),
		vscode.lm.registerTool(CONVERTER_CONVERT_TOOL, tools.convert),
		vscode.lm.registerTool(CONVERTER_BATCH_CONVERT_TOOL, tools.batchConvert),
		vscode.lm.registerTool(CONVERTER_MERGE_PDFS_TOOL, tools.mergePdfs),
	);
}
