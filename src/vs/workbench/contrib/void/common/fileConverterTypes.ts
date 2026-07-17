/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Common types for file converter functionality
 */

export interface ConversionResult {
	success: boolean;
	output_path?: string;
	duration?: number;
	error?: string;
	error_type?: string;
}

export interface BatchResult {
	success: boolean;
	results: ConversionResult[];
	total_duration?: number;
}

export interface MergeResult {
	success: boolean;
	output_path?: string;
	duration?: number;
	error?: string;
}

export interface ConversionMap {
	[conversionType: string]: {
		source_formats: string[];
		target_formats: string[];
		description: string;
	};
}

export interface FileConverterConfig {
	pythonPath?: string;  // Custom Python executable path (empty = use system Python)
}

export interface IFileConverterMainService {
	configure(config: FileConverterConfig): Promise<void>;
	convert(input: string, output: string, type: string, options?: any): Promise<ConversionResult>;
	batchConvert(files: string[], outputDir: string, type: string): Promise<BatchResult>;
	mergePDFs(files: string[], output: string): Promise<MergeResult>;
	getAvailableConversions(): Promise<ConversionMap>;
}
