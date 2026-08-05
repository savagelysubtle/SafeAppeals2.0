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
	MergePdfsParams,
} from './types';
import { parseAvailableConversions, unavailableConversionMessage } from './protocol';
import { assertPathInWorkspace, assertPathsInWorkspace, getWorkspaceRootPaths } from './pathGuard';
import { SidecarHost, type SidecarProgressEvent } from './sidecarHost';

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
