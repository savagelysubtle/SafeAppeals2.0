/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatThreadService } from '../common/chatThreadService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { VOID_VIEW_CONTAINER_ID } from './sidebarPane.js';

/**
 * Command for extensions to add content to Void chat
 * Usage: vscode.commands.executeCommand('void.addContentToChat', { text, uri, language, range })
 */
registerAction2(class VoidAddContentToChatAction extends Action2 {
	constructor() {
		super({
			id: 'void.addContentToChat',
			title: 'Add Content to Void Chat',
			f1: false // Don't show in command palette
		});
	}

	async run(accessor: ServicesAccessor, options?: {
		text?: string;
		uri?: string;
		language?: string;
		range?: [number, number] | null;
		type?: 'text' | 'selection' | 'file';
	}): Promise<void> {
		if (!options) {
			return;
		}

		const chatThreadService = accessor.get(IChatThreadService);
		const viewsService = accessor.get(IViewsService);
		const commandService = accessor.get(ICommandService);

		// Open Void sidebar if not already open
		const wasAlreadyOpen = viewsService.isViewContainerVisible(VOID_VIEW_CONTAINER_ID);
		if (!wasAlreadyOpen) {
			await commandService.executeCommand('void.openSidebar');
		}

		// Convert string URI to URI object
		const documentUri = options.uri ? URI.parse(options.uri) : URI.file('untitled');
		const language = options.language || 'plaintext';

		// Add to chat based on type
		if (options.range && options.range[0] !== options.range[1]) {
			// Add as code selection
			chatThreadService.addNewStagingSelection({
				type: 'CodeSelection',
				uri: documentUri,
				language: language,
				range: options.range,
				state: { wasAddedAsCurrentFile: false },
			});
		} else {
			// Add as file
			chatThreadService.addNewStagingSelection({
				type: 'File',
				uri: documentUri,
				language: language,
				state: { wasAddedAsCurrentFile: false },
			});
		}

		// Focus the chat
		await chatThreadService.focusCurrentChat();
	}
});

/**
 * Command for extensions to get content from Void chat
 * This allows bidirectional communication
 */
registerAction2(class VoidGetChatContextAction extends Action2 {
	constructor() {
		super({
			id: 'void.getChatContext',
			title: 'Get Void Chat Context',
			f1: false
		});
	}

	async run(accessor: ServicesAccessor): Promise<any> {
		const chatThreadService = accessor.get(IChatThreadService);

		// Get current thread state
		const currentThread = chatThreadService.getCurrentThreadState();

		return {
			stagingSelections: currentThread?.stagingSelections || [],
			messages: currentThread?.messages || []
		};
	}
});
