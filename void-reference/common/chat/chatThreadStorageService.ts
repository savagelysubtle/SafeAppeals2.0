/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

/**
 * Interface for per-workspace chat thread storage
 * Implementation lives in browser/ because it requires IMainProcessService
 */
export interface IChatThreadStorageService {
	readonly _serviceBrand: undefined;

	readAllThreads(workspaceId: string): Promise<Record<string, any>>;
	storeAllThreads(workspaceId: string, threads: Record<string, any>): Promise<void>;
	deleteThread(workspaceId: string, threadId: string): Promise<void>;
}

export const IChatThreadStorageService = createDecorator<IChatThreadStorageService>('chatThreadStorageService');
