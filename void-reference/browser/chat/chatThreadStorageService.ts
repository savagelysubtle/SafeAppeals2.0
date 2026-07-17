/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { IChatThreadStorageService } from '../../common/chat/chatThreadStorageService.js';

/**
 * Browser-side proxy service for chat thread storage
 * Calls the main process via IPC (same pattern as EmailService)
 *
 * IMPORTANT: This service MUST be in browser/ because IMainProcessService
 * is only available in the browser/renderer process.
 */
export class ChatThreadStorageService implements IChatThreadStorageService {
	readonly _serviceBrand: undefined;

	private readonly channel: IChannel;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService
	) {
		this.channel = mainProcessService.getChannel('void-channel-chat-threads');
		console.log('[ChatThreadStorageService] Browser proxy created, channel acquired');
	}

	async readAllThreads(workspaceId: string): Promise<Record<string, any>> {
		console.log(`[ChatThreadStorageService] CALLING readAllThreads for workspace: ${workspaceId}`);
		const result = await this.channel.call<Record<string, any>>('readAllThreads', { workspaceId });
		console.log(`[ChatThreadStorageService] readAllThreads RETURNED ${Object.keys(result || {}).length} threads`);
		return result;
	}

	async storeAllThreads(workspaceId: string, threads: Record<string, any>): Promise<void> {
		console.log(`[ChatThreadStorageService] CALLING storeAllThreads for workspace: ${workspaceId}, ${Object.keys(threads || {}).length} threads`);
		await this.channel.call('storeAllThreads', { workspaceId, threads });
		console.log(`[ChatThreadStorageService] storeAllThreads COMPLETED`);
	}

	async deleteThread(workspaceId: string, threadId: string): Promise<void> {
		console.log(`[ChatThreadStorageService] CALLING deleteThread for workspace: ${workspaceId}, thread: ${threadId}`);
		await this.channel.call('deleteThread', { workspaceId, threadId });
		console.log(`[ChatThreadStorageService] deleteThread COMPLETED`);
	}
}

registerSingleton(IChatThreadStorageService, ChatThreadStorageService, InstantiationType.Delayed);
