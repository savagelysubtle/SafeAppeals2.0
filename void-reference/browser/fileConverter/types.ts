/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Re-export common types for convenience
export type {
	ConversionResult,
	BatchResult,
	MergeResult,
	ConversionMap,
	IFileConverterMainService
} from '../../common/fileConverterTypes.js';

// Re-export service interface
export type { IFileConverterService } from './fileConverterService.js';
