/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ChatMessageRole, IChatMessage } from './languageModels.js';

/** SafeAppeals: max prior user/assistant turns included in Cloud Ask LM requests. */
export const SAFEAPPEALS_CLOUD_LM_HISTORY_TURN_CAP = 20;

/**
 * SafeAppeals: pick a cloud model id for direct Ask/Edit LM requests.
 * Prefers `preferredModelId` when it is in the cloud vendor list; otherwise first cloud id.
 */
export function pickSafeAppealsCloudModelId(preferredModelId: string | undefined, cloudModelIds: readonly string[]): string | undefined {
	if (preferredModelId && cloudModelIds.includes(preferredModelId)) {
		return preferredModelId;
	}
	return cloudModelIds[0];
}

/**
 * SafeAppeals: readiness timeout copy. Cloud setup must not mention GitHub / Copilot Chat.
 */
export function resolveChatSetupTimeoutWarning(options: {
	usesSafeAppealsCloud: boolean;
	anonymous: boolean;
	providerName: string;
	chatExtensionId: string;
}): string {
	if (options.usesSafeAppealsCloud) {
		return localize('chatTookLongWarningSafeAppealsCloud', "Chat took too long to get ready. Please ensure you are signed in to SafeAppeals Cloud and that a cloud model is available. Click restart to try again if this issue persists.");
	}
	if (options.anonymous) {
		return localize('chatTookLongWarningAnonymous', "Chat took too long to get ready. Please ensure that the extension `{0}` is installed and enabled. Click restart to try again if this issue persists.", options.chatExtensionId);
	}
	return localize('chatTookLongWarning', "Chat took too long to get ready. Please ensure you are signed in to {0} and that the extension `{1}` is installed and enabled. Click restart to try again if this issue persists.", options.providerName, options.chatExtensionId);
}

/**
 * SafeAppeals: build LM chat messages for Cloud Ask from prior turns + current user text.
 * Skips empty turns; caps history to the most recent {@link SAFEAPPEALS_CLOUD_LM_HISTORY_TURN_CAP} pairs.
 */
export function buildSafeAppealsCloudChatMessages(options: {
	systemPrompt: string;
	history: readonly { userText: string; assistantText: string }[];
	userText: string;
	maxHistoryTurns?: number;
}): IChatMessage[] {
	const maxTurns = options.maxHistoryTurns ?? SAFEAPPEALS_CLOUD_LM_HISTORY_TURN_CAP;
	const messages: IChatMessage[] = [
		{ role: ChatMessageRole.System, content: [{ type: 'text', value: options.systemPrompt }] },
	];
	for (const turn of options.history.slice(-maxTurns)) {
		const user = turn.userText.trim();
		if (user) {
			messages.push({ role: ChatMessageRole.User, content: [{ type: 'text', value: user }] });
		}
		const assistant = turn.assistantText.trim();
		if (assistant) {
			messages.push({ role: ChatMessageRole.Assistant, content: [{ type: 'text', value: assistant }] });
		}
	}
	messages.push({ role: ChatMessageRole.User, content: [{ type: 'text', value: options.userText }] });
	return messages;
}
