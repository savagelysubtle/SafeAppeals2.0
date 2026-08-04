/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import '../../chat/browser/voiceClient/micCaptureService.js';

import { mainWindow } from '../../../../base/browser/window.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import * as nls from '../../../../nls.js';
import { IActionViewItemService } from '../../../../platform/actions/browser/actionViewItemService.js';
import { Action2, MenuId, MenuItemAction, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { Extensions as ConfigurationExtensions, ConfigurationScope, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { ChatContextKeys } from '../../chat/common/actions/chatContextKeys.js';
import { ChatAgentLocation } from '../../chat/common/constants.js';
import { IChatWidgetService } from '../../chat/browser/chat.js';
import { insertDictationIntoChat } from './dictationInsert.js';
import { DictationHoldActionViewItem } from './dictationHoldActionViewItem.js';
import { IDictationSession, SAFEAPPEALS_DICTATION_ACTIVE } from './dictationSession.js';

// --- Settings ---

const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	id: 'safeappealsDictation',
	title: nls.localize('safeappealsDictationConfigurationTitle', "Dictation"),
	type: 'object',
	properties: {
		'safeappeals.dictation.enabled': {
			type: 'boolean',
			description: nls.localize('safeappeals.dictation.enabled', "Enable local Whisper dictation in chat (insert without sending)."),
			default: true,
			scope: ConfigurationScope.APPLICATION,
		},
	}
});

// --- Insert command (setInput append only — never acceptInput) ---

CommandsRegistry.registerCommand('_chat.dictation.insertText', (accessor, text: string) => {
	const widget = accessor.get(IChatWidgetService).lastFocusedWidget;
	if (!widget || !text) {
		return;
	}
	insertDictationIntoChat(widget, text);
});

// --- Context: hide while Agents Voice is listening (key registered there) ---

const agentsVoiceListeningNegated = ContextKeyExpr.not('agentsVoiceListening');

const dictationEnabled = ContextKeyExpr.equals('config.safeappeals.dictation.enabled', true);

// Menu when-clause intentionally omits `!safeappealsDictationActive`: the mic
// ActionViewItem must stay mounted through pointerup/leave/blur while holding.
// Hiding on active would dispose the control before release and strand PTT.
// Re-entry is guarded in DictationSession.start(); keybinding still uses
// SAFEAPPEALS_DICTATION_ACTIVE.negate() so Escape/cancel can own the chord.
const holdToDictateWhen = ContextKeyExpr.and(
	dictationEnabled,
	ChatContextKeys.location.isEqualTo(ChatAgentLocation.Chat),
	ChatContextKeys.currentlyEditing.negate(),
	agentsVoiceListeningNegated,
);

export const HOLD_TO_DICTATE_ACTION_ID = 'safeappeals.dictation.holdToDictate';

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: HOLD_TO_DICTATE_ACTION_ID,
			title: nls.localize2('safeappeals.dictation.holdToDictate', "Hold to Dictate"),
			icon: Codicon.mic,
			precondition: dictationEnabled,
			menu: {
				id: MenuId.ChatExecute,
				when: holdToDictateWhen,
				group: 'navigation',
				order: -8,
			},
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Space,
				when: ContextKeyExpr.and(
					dictationEnabled,
					ChatContextKeys.inChatInput,
					SAFEAPPEALS_DICTATION_ACTIVE.negate(),
					agentsVoiceListeningNegated,
				),
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const dictation = accessor.get(IDictationSession);
		const keybindingService = accessor.get(IKeybindingService);

		// Toolbar pointer holds are owned by DictationHoldActionViewItem (onClick is a
		// no-op). Only the keybinding path enables hold mode.
		const holdMode = keybindingService.enableKeybindingHoldMode(HOLD_TO_DICTATE_ACTION_ID);
		if (!holdMode) {
			return;
		}

		dictation.prepare(mainWindow);
		await dictation.start();
		await holdMode;
		await dictation.stop();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'safeappeals.dictation.cancel',
			title: nls.localize2('safeappeals.dictation.cancel', "Cancel Dictation"),
			precondition: SAFEAPPEALS_DICTATION_ACTIVE,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib + 100,
				primary: KeyCode.Escape,
				when: ContextKeyExpr.and(
					dictationEnabled,
					SAFEAPPEALS_DICTATION_ACTIVE,
				),
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		accessor.get(IDictationSession).cancel();
	}
});

// --- Hold ActionViewItem factory ---

class SafeAppealsDictationHoldRendering extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.safeappealsDictationHoldRendering';

	constructor(
		@IActionViewItemService actionViewItemService: IActionViewItemService,
	) {
		super();
		this._register(actionViewItemService.register(MenuId.ChatExecute, HOLD_TO_DICTATE_ACTION_ID, (action, options, instantiationService) => {
			if (!(action instanceof MenuItemAction)) {
				return undefined;
			}
			return instantiationService.createInstance(DictationHoldActionViewItem, action, options);
		}));
	}
}

registerWorkbenchContribution2(SafeAppealsDictationHoldRendering.ID, SafeAppealsDictationHoldRendering, WorkbenchPhase.AfterRestored);
