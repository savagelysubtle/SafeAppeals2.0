/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ConversionResult, BatchResult, MergeResult, ConversionMap } from '../../common/fileConverterTypes.js';
import { IVoidSettingsService } from '../../common/voidSettingsService.js';

export const IFileConverterService = createDecorator<IFileConverterService>('fileConverterService');

export interface IFileConverterService {
	readonly _serviceBrand: undefined;

	// Event emitters for progress updates
	onProgress: Event<{ percent: number; message: string; current_file?: string }>;
	onConversionComplete: Event<ConversionResult>;
	onBatchComplete: Event<BatchResult>;
	onMergeComplete: Event<MergeResult>;

	// Main conversion methods
	convert(input: string, output: string, type: string, options?: any): Promise<ConversionResult>;
	batchConvert(files: string[], outputDir: string, type: string): Promise<BatchResult>;
	mergePDFs(files: string[], output: string): Promise<MergeResult>;
	getAvailableConversions(): Promise<ConversionMap>;
}

export class FileConverterService extends Disposable implements IFileConverterService {
	declare readonly _serviceBrand: undefined;

	private readonly _onProgress = this._register(new Emitter<{ percent: number; message: string; current_file?: string }>());
	readonly onProgress = this._onProgress.event;

	private readonly _onConversionComplete = this._register(new Emitter<ConversionResult>());
	readonly onConversionComplete = this._onConversionComplete.event;

	private readonly _onBatchComplete = this._register(new Emitter<BatchResult>());
	readonly onBatchComplete = this._onBatchComplete.event;

	private readonly _onMergeComplete = this._register(new Emitter<MergeResult>());
	readonly onMergeComplete = this._onMergeComplete.event;

	private channel: any = null;
	private channelInitialized = false;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@ILogService private readonly logService: ILogService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService
	) {
		super();
		this.initializeChannel();
		this.setupSettingsListener();
	}

	private initializeChannel(): void {
		try {
			this.channel = this.mainProcessService.getChannel('void-channel-file-converter');
			this.channelInitialized = true;
			this.logService.info('[FileConverterService] Channel initialized successfully');

			// Configure Python path from settings
			this.configurePythonPath();
		} catch (error) {
			this.logService.error('[FileConverterService] Failed to initialize channel:', error);
			this.channelInitialized = false;
		}
	}

	private setupSettingsListener(): void {
		// Listen for settings changes and reconfigure Python path if needed
		this._register(this.voidSettingsService.onDidChangeState(() => {
			if (this.channelInitialized && this.channel) {
				this.configurePythonPath();
			}
		}));
	}

	private async configurePythonPath(): Promise<void> {
		if (!this.channel) return;

		const pythonPath = this.voidSettingsService.state.globalSettings.fileConverterPythonPath || '';

		try {
			await this.channel.call('configure', { pythonPath });
			this.logService.info('[FileConverterService] Python path configured:', pythonPath || '(system default)');
		} catch (error) {
			this.logService.error('[FileConverterService] Failed to configure Python path:', error);
		}
	}

	async convert(input: string, output: string, type: string, options?: any): Promise<ConversionResult> {
		if (!this.channelInitialized || !this.channel) {
			this.initializeChannel();
		}

		if (!this.channel) {
			const errorResult: ConversionResult = {
				success: false,
				error: 'Failed to connect to file converter service',
				error_type: 'connection'
			};
			this._onConversionComplete.fire(errorResult);
			return errorResult;
		}

		try {
			this.logService.info('[FileConverterService] Starting conversion:', { input, output, type, options });

			const result = await this.channel.call('convert', { input, output, type, options }) as ConversionResult;

			this.logService.info('[FileConverterService] Conversion completed:', result);
			this._onConversionComplete.fire(result);

			return result;
		} catch (error) {
			const errorResult: ConversionResult = {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown conversion error',
				error_type: 'conversion'
			};

			this.logService.error('[FileConverterService] Conversion failed:', error);
			this._onConversionComplete.fire(errorResult);

			return errorResult;
		}
	}

	async batchConvert(files: string[], outputDir: string, type: string): Promise<BatchResult> {
		if (!this.channelInitialized || !this.channel) {
			this.initializeChannel();
		}

		if (!this.channel) {
			const errorResult: BatchResult = {
				success: false,
				results: []
			};
			this._onBatchComplete.fire(errorResult);
			return errorResult;
		}

		try {
			this.logService.info('[FileConverterService] Starting batch conversion:', { files, outputDir, type });

			const result = await this.channel.call('batchConvert', { files, outputDir, batchType: type }) as BatchResult;

			this.logService.info('[FileConverterService] Batch conversion completed:', result);
			this._onBatchComplete.fire(result);

			return result;
		} catch (error) {
			const errorResult: BatchResult = {
				success: false,
				results: []
			};

			this.logService.error('[FileConverterService] Batch conversion failed:', error);
			this._onBatchComplete.fire(errorResult);

			return errorResult;
		}
	}

	async mergePDFs(files: string[], output: string): Promise<MergeResult> {
		if (!this.channelInitialized || !this.channel) {
			this.initializeChannel();
		}

		if (!this.channel) {
			const errorResult: MergeResult = {
				success: false,
				error: 'Failed to connect to file converter service'
			};
			this._onMergeComplete.fire(errorResult);
			return errorResult;
		}

		try {
			this.logService.info('[FileConverterService] Starting PDF merge:', { files, output });

			const result = await this.channel.call('mergePDFs', { pdfFiles: files, mergeOutput: output }) as MergeResult;

			this.logService.info('[FileConverterService] PDF merge completed:', result);
			this._onMergeComplete.fire(result);

			return result;
		} catch (error) {
			const errorResult: MergeResult = {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown merge error'
			};

			this.logService.error('[FileConverterService] PDF merge failed:', error);
			this._onMergeComplete.fire(errorResult);

			return errorResult;
		}
	}

	async getAvailableConversions(): Promise<ConversionMap> {
		if (!this.channelInitialized || !this.channel) {
			this.initializeChannel();
		}

		if (!this.channel) {
			this.logService.warn('[FileConverterService] No channel available, returning empty conversions');
			return {};
		}

		try {
			this.logService.info('[FileConverterService] Getting available conversions');

			const result = await this.channel.call('getAvailableConversions') as ConversionMap;

			this.logService.info('[FileConverterService] Got conversions:', Object.keys(result));

			return result;
		} catch (error) {
			this.logService.error('[FileConverterService] Failed to get conversions:', error);
			return {};
		}
	}
}

registerSingleton(IFileConverterService, FileConverterService, InstantiationType.Delayed);
