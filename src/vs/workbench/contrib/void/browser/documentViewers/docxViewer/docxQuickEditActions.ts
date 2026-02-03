/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Glass Devtools, Inc. All rights reserved.
 *  Void Editor additions licensed under the AGPL 3.0 License.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
import { DOCXViewerEditor } from './docxViewerEditor.js';
import { KeyCode, KeyMod } from '../../../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { INotificationService } from '../../../../../../platform/notification/common/notification.js';
import { IChatThreadService } from '../../chatThreadService.js';
import { IMetricsService } from '../../../common/metricsService.js';
import { IViewsService } from '../../../../../services/views/common/viewsService.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { VOID_VIEW_CONTAINER_ID } from '../../sidebarPane.js';

const VOID_OPEN_SIDEBAR_ACTION_ID = 'void.sidebar.open';

// Note: Some imports are used only in DOCXAddToChatAction but TypeScript will not complain
// since they are referenced in the class below

/**
 * DOCX Quick Edit Action (Ctrl+K)
 * Adds selected DOCX text to chat with context for inline editing
 */
class DOCXQuickEditAction extends Action2 {
	constructor() {
		super({
			id: 'void.docx.quickEdit',
			title: localize('void.docx.quickEdit', 'DOCX Quick Edit'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyCode.KeyK,
				// Higher weight than VoidExtension (200) to ensure this runs first for DOCX
				weight: KeybindingWeight.ExternalExtension + 100
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);

		const activeEditor = editorService.activeEditorPane;

		// Check if active editor is DOCX viewer
		if (!(activeEditor instanceof DOCXViewerEditor)) {
			// Not a DOCX viewer, let the default Ctrl+K handler take over
			return;
		}

		// DOCX viewer handles Ctrl+K internally via webview
		// The webview shows its own inline edit popup
		// This action is registered to prevent the default code editor Ctrl+K from interfering
		console.log('[DOCX Quick Edit] Ctrl+K handled by webview');
	}
}

/**
 * DOCX Add to Chat Action (Ctrl+L)
 * Adds DOCX selection or entire file to chat
 */
class DOCXAddToChatAction extends Action2 {
	constructor() {
		super({
			id: 'void.docx.addToChat',
			title: localize('void.docx.addToChat', 'Add DOCX Selection to Chat'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyCode.KeyL,
				// Higher weight than VoidExtension (200) to ensure this runs first for DOCX
				weight: KeybindingWeight.ExternalExtension + 100
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const notificationService = accessor.get(INotificationService);
		const chatThreadService = accessor.get(IChatThreadService);
		const metricsService = accessor.get(IMetricsService);
		const viewsService = accessor.get(IViewsService);
		const commandService = accessor.get(ICommandService);

		const activeEditor = editorService.activeEditorPane;

		// Check if active editor is DOCX viewer
		if (!(activeEditor instanceof DOCXViewerEditor)) {
			// Not a DOCX viewer, let the default Ctrl+L handler take over
			return;
		}

		const input = activeEditor.getInput();
		if (!input) {
			return;
		}

		try {
			const hasSelection = !!(input.selection && input.selection.text);
			metricsService.capture('DOCX Ctrl+L', {
				hasSelection
			});

			// Open sidebar if not already open
			const wasAlreadyOpen = viewsService.isViewContainerVisible(VOID_VIEW_CONTAINER_ID);
			if (!wasAlreadyOpen) {
				await commandService.executeCommand(VOID_OPEN_SIDEBAR_ACTION_ID);
			}

			// Get the current thread or create a new one
			const currentThread = chatThreadService.getCurrentThread();
			if (!currentThread) {
				chatThreadService.openNewThread();
			}

			const fileName = input.resource.fsPath.split(/[\\/]/).pop() || 'document.docx';

			if (hasSelection && input.selection!.text) {
				// User has selected specific text - add it with context
				const selectedText = input.selection!.text;

				const formattedContext = `## DOCX Selection
**File:** ${fileName}

\`\`\`
${selectedText}
\`\`\``;

				chatThreadService.addNewStagingSelection({
					type: 'File',
					uri: input.resource,
					language: 'docx',
					state: {
						wasAddedAsCurrentFile: false,
						ragContext: formattedContext
					}
				});

				const preview = selectedText.length > 50
					? selectedText.substring(0, 50) + '...'
					: selectedText;
				notificationService.info(`DOCX selection added to chat: "${preview}"`);

			} else {
				// No selection - add the whole file reference
				chatThreadService.addNewStagingSelection({
					type: 'File',
					uri: input.resource,
					language: 'docx',
					state: {
						wasAddedAsCurrentFile: false
					}
				});

				notificationService.info(`DOCX file added to chat: ${fileName}`);
			}

			// Focus the chat
			await chatThreadService.focusCurrentChat();

		} catch (error) {
			console.error('[DOCX Add to Chat] Error:', error);
			notificationService.error('Failed to add DOCX to chat: ' + (error as Error).message);
		}
	}
}

// Register both actions
registerAction2(DOCXQuickEditAction);
registerAction2(DOCXAddToChatAction);
