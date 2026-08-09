/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type {
	AvailableConversions,
	BatchConvertParams,
	BatchConvertResult,
	ConvertParams,
	ConvertResult,
	ExtractPdfPagesResult,
	MergePdfsParams,
	MergePdfsByPageParams,
} from './types';
import { parseAvailableConversions, unavailableConversionMessage } from './protocol';
import { assertPathInWorkspace, assertPathsInWorkspace, getWorkspaceRootPaths } from './pathGuard';
import { SidecarHost, type SidecarProgressEvent } from './sidecarHost';
import { normalizePageSelection, PageRangeError } from './pageRanges';

export class ConverterService implements vscode.Disposable {
	private readonly sidecar: SidecarHost;
	private cachedConversions: AvailableConversions = { conversions: {}, aliases: {} };
	private configuredRoots: string[] = [];

	private readonly onSidecarProgress = (event: SidecarProgressEvent) => {
		this._onProgress.fire(event);
	};

	constructor(
		extensionPath: string,
		private readonly log: (message: string) => void,
	) {
		this.sidecar = new SidecarHost({ extensionPath, log });
		this.sidecar.on('progress', this.onSidecarProgress);
	}

	private readonly _onProgress = new vscode.EventEmitter<SidecarProgressEvent>();
	readonly onProgress = this._onProgress.event;

	private readonly _onConversionsChanged = new vscode.EventEmitter<AvailableConversions>();
	readonly onConversionsChanged = this._onConversionsChanged.event;

	get isSidecarAvailable(): boolean {
		return this.sidecar.isBinaryAvailable;
	}

	get sidecarBinaryPath(): string | undefined {
		return this.sidecar.binaryResolvedPath;
	}

	async initialize(): Promise<void> {
		if (!this.sidecar.isBinaryAvailable) {
			this.log('sa-converter binary not found — converter features disabled until installed');
			return;
		}
		await this.sidecar.start();
		await this.configureFromWorkspace();
		await this.refreshAvailableConversions();
	}

	async configureFromWorkspace(): Promise<void> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		this.configuredRoots = getWorkspaceRootPaths(folders);
		if (this.configuredRoots.length === 0) {
			return;
		}
		if (!this.sidecar.isBinaryAvailable) {
			return;
		}
		await this.sidecar.request('configure', { roots: this.configuredRoots });
		await this.refreshAvailableConversions();
	}

	async refreshAvailableConversions(): Promise<AvailableConversions> {
		if (!this.sidecar.isBinaryAvailable) {
			this.cachedConversions = { conversions: {}, aliases: {} };
			return this.cachedConversions;
		}
		const result = await this.sidecar.request('get_available_conversions');
		this.cachedConversions = parseAvailableConversions(result);
		this._onConversionsChanged.fire(this.cachedConversions);
		return this.cachedConversions;
	}

	getAvailableConversions(): AvailableConversions {
		return this.cachedConversions;
	}

	async convert(params: ConvertParams): Promise<ConvertResult> {
		const availabilityError = unavailableConversionMessage(params.type, this.cachedConversions);
		if (availabilityError) {
			return { success: false, error: availabilityError };
		}

		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length === 0) {
			return { success: false, error: 'Open a workspace folder before converting files.' };
		}

		try {
			const input = await assertPathInWorkspace(params.input, folders);
			const output = await assertPathInWorkspace(params.output, folders);
			const result = await this.sidecar.request('convert', {
				input,
				output,
				type: params.type,
				options: params.options,
			});
			return mapConvertResult(result);
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	async batchConvert(params: BatchConvertParams): Promise<BatchConvertResult> {
		const availabilityError = unavailableConversionMessage(params.type, this.cachedConversions);
		if (availabilityError) {
			return { success: false, results: [], error: availabilityError };
		}

		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length === 0) {
			return { success: false, results: [], error: 'Open a workspace folder before batch converting.' };
		}

		try {
			const inputs = await assertPathsInWorkspace(params.inputs, folders);
			const payload: Record<string, unknown> = {
				inputs,
				type: params.type,
				options: params.options,
			};
			if (params.output_dir) {
				payload.output_dir = await assertPathInWorkspace(params.output_dir, folders);
			}
			const result = await this.sidecar.request('batch_convert', payload);
			return mapBatchConvertResult(result);
		} catch (err) {
			return { success: false, results: [], error: err instanceof Error ? err.message : String(err) };
		}
	}

	async mergePdfs(params: MergePdfsParams): Promise<ConvertResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length === 0) {
			return { success: false, error: 'Open a workspace folder before merging PDFs.' };
		}

		const availabilityError = unavailableConversionMessage('merge_pdfs', this.cachedConversions);
		if (availabilityError) {
			return { success: false, error: availabilityError };
		}

		try {
			const inputs = await assertPathsInWorkspace(params.inputs, folders);
			const output = await assertPathInWorkspace(params.output, folders);
			const result = await this.sidecar.request('merge_pdfs', { inputs, output });
			return mapConvertResult(result);
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	async mergePdfsByPage(params: MergePdfsByPageParams): Promise<ConvertResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length === 0) {
			return { success: false, error: vscode.l10n.t('Open a workspace folder before merging PDFs by page.') };
		}
		if (params.inputs.length === 0) {
			return { success: false, error: vscode.l10n.t('At least one PDF must be selected.') };
		}
		if (params.inputs.some(item => item.pages.length === 0)) {
			return { success: false, error: vscode.l10n.t('At least one page must be specified for each PDF.') };
		}

		const availabilityError = unavailableConversionMessage('merge_pdfs_by_page', this.cachedConversions);
		if (availabilityError) {
			return { success: false, error: availabilityError };
		}

		try {
			const inputs = await Promise.all(params.inputs.map(async (item) => {
				const validatedPath = await assertPathInWorkspace(item.path, folders);
				const extracted = mapExtractPdfPagesResult(await this.sidecar.request('extract_pdf_pages', { source: validatedPath }));
				if (!extracted.success || extracted.page_count === undefined) {
					throw new Error(extracted.error ?? vscode.l10n.t('Could not determine the PDF page count.'));
				}
				return {
					path: validatedPath,
					pages: normalizePageSelection(item.pages, extracted.page_count),
				};
			}));
			const output = await assertPathInWorkspace(params.output, folders);
			const result = await this.sidecar.request('merge_pdfs_by_page', { inputs, output });
			return mapConvertResult(result);
		} catch (err) {
			return {
				success: false,
				error: err instanceof PageRangeError
					? localizedPageRangeErrorMessage(err)
					: err instanceof Error ? err.message : String(err),
			};
		}
	}

	/**
	 * Born-digital per-page PDF text extract (sidecar RPC — no docparse lease).
	 */
	async extractPdfPages(sourcePath: string): Promise<ExtractPdfPagesResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length === 0) {
			return { success: false, error: 'Open a workspace folder before extracting PDF text.' };
		}
		if (!this.sidecar.isBinaryAvailable) {
			return {
				success: false,
				error: 'sa-converter binary not found — digital PDF extract unavailable.',
			};
		}

		try {
			const source = await assertPathInWorkspace(sourcePath, folders);
			const result = await this.sidecar.request('extract_pdf_pages', { source });
			return mapExtractPdfPagesResult(result);
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	dispose(): void {
		this.sidecar.off('progress', this.onSidecarProgress);
		this._onProgress.dispose();
		this._onConversionsChanged.dispose();
		void this.sidecar.shutdown().finally(() => this.sidecar.dispose());
	}
}

function mapConvertResult(result: Record<string, unknown>): ConvertResult {
	return {
		success: Boolean(result.success),
		output_path: typeof result.output_path === 'string' ? result.output_path : undefined,
		duration_ms: typeof result.duration_ms === 'number' ? result.duration_ms : undefined,
		fidelity: typeof result.fidelity === 'string' ? result.fidelity as ConvertResult['fidelity'] : undefined,
		engine: typeof result.engine === 'string' ? result.engine : undefined,
		error: typeof result.error === 'string' ? result.error : undefined,
	};
}

function mapBatchConvertResult(result: Record<string, unknown>): BatchConvertResult {
	const rawResults = Array.isArray(result.results) ? result.results : [];
	const results = rawResults.map(item => {
		if (typeof item !== 'object' || item === null) {
			return { input: '', success: false, error: 'Invalid result entry' };
		}
		const entry = item as Record<string, unknown>;
		return {
			input: String(entry.input ?? ''),
			success: Boolean(entry.success),
			output_path: typeof entry.output_path === 'string' ? entry.output_path : undefined,
			error: typeof entry.error === 'string' ? entry.error : undefined,
		};
	});
	return {
		success: Boolean(result.success),
		results,
		duration_ms: typeof result.duration_ms === 'number' ? result.duration_ms : undefined,
		fidelity: typeof result.fidelity === 'string' ? result.fidelity as BatchConvertResult['fidelity'] : undefined,
		engine: typeof result.engine === 'string' ? result.engine : undefined,
		error: typeof result.error === 'string' ? result.error : undefined,
	};
}

function mapExtractPdfPagesResult(result: Record<string, unknown>): ExtractPdfPagesResult {
	const rawPages = Array.isArray(result.pages) ? result.pages : [];
	const pages = rawPages.map(item => {
		if (typeof item !== 'object' || item === null) {
			return { page: 0, text: '' };
		}
		const entry = item as Record<string, unknown>;
		return {
			page: typeof entry.page === 'number' ? entry.page : 0,
			text: typeof entry.text === 'string' ? entry.text : '',
		};
	});
	return {
		success: Boolean(result.success),
		pages,
		page_count: typeof result.page_count === 'number' ? result.page_count : pages.length,
		error: typeof result.error === 'string' ? result.error : undefined,
	};
}

function localizedPageRangeErrorMessage(error: PageRangeError): string {
	switch (error.code) {
		case 'empty': return vscode.l10n.t('At least one page must be specified.');
		case 'duplicate': return vscode.l10n.t('Page {0} is selected more than once.', error.value ?? '');
		case 'bounds': return vscode.l10n.t('Page {0} exceeds the PDF page count of {1}.', error.value ?? '', String(error.pageCount ?? ''));
		case 'format': return vscode.l10n.t('Invalid page or range: {0}', error.value ?? '');
		case 'order': return vscode.l10n.t('Page range must be in ascending order: {0}', error.value ?? '');
	}
}
