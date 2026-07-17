/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { IServerChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IRAGPathService } from '../../common/rag/ragPathService.js';
import { ChatThreadStorageService } from './chatThreadStorageService.js';

/**
 * IPC Channel for chat thread storage
 * Manages per-workspace SQLite databases for chat threads
 * Follows the same pattern as EmailMainChannel
 */
export class ChatThreadStorageChannel implements IServerChannel {
	private instanceOfWorkspaceId: Map<string, ChatThreadStorageService> = new Map();

	constructor(
		private readonly logService: ILogService,
		private readonly pathService: IRAGPathService
	) {
		this.logService.info('[ChatThreadStorageChannel] Channel created');
	}

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`ChatThreadStorageChannel: Event not supported: ${event}`);
	}

	async call(_: unknown, command: string, arg?: any): Promise<any> {
		console.log(`[ChatThreadStorageChannel] MAIN PROCESS: Command=${command}, workspace=${arg?.workspaceId}`);
		this.logService.info(`[ChatThreadStorageChannel] Command: ${command}, workspace: ${arg?.workspaceId}`);

		switch (command) {
			case 'readAllThreads': {
				const { workspaceId } = arg;
				console.log(`[ChatThreadStorageChannel] readAllThreads for workspace: ${workspaceId}`);
				const instance = await this.getOrCreateInstance(workspaceId);
				const result = await instance.readAllThreads();
				console.log(`[ChatThreadStorageChannel] readAllThreads returning ${Object.keys(result).length} threads`);
				return result;
			}

			case 'storeAllThreads': {
				const { workspaceId, threads } = arg;
				console.log(`[ChatThreadStorageChannel] storeAllThreads for workspace: ${workspaceId}, threads: ${Object.keys(threads || {}).length}`);
				const instance = await this.getOrCreateInstance(workspaceId);
				await instance.storeAllThreads(threads);
				console.log(`[ChatThreadStorageChannel] storeAllThreads completed`);
				return;
			}

			case 'deleteThread': {
				const { workspaceId, threadId } = arg;
				const instance = await this.getOrCreateInstance(workspaceId);
				return instance.deleteThread(threadId);
			}

			default:
				throw new Error(`ChatThreadStorageChannel: Unknown command: ${command}`);
		}
	}

	/**
	 * Get or create a workspace-specific storage instance
	 */
	private async getOrCreateInstance(workspaceId: string): Promise<ChatThreadStorageService> {
		if (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null') {
			throw new Error('ChatThreadStorageChannel: workspaceId is REQUIRED');
		}

		let instance = this.instanceOfWorkspaceId.get(workspaceId);
		if (!instance) {
			this.logService.info(`[ChatThreadStorageChannel] Creating storage for workspace: ${workspaceId}`);
			instance = new ChatThreadStorageService(this.logService, this.pathService, workspaceId);
			await instance.initialize();
			this.instanceOfWorkspaceId.set(workspaceId, instance);
			this.logService.info(`[ChatThreadStorageChannel] Storage ready for workspace: ${workspaceId}`);
		}

		return instance;
	}
}
