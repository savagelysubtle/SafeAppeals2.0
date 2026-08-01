/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ChatMessageRole, IChatMessage, SAFEAPPEALS_CLOUD_VENDOR_ID } from './languageModels.js';

/** SafeAppeals: max prior user/assistant turns included in Cloud Ask LM requests. */
export const SAFEAPPEALS_CLOUD_LM_HISTORY_TURN_CAP = 20;

/** SafeAppeals: chat participant id for Cloud Agent mode (extension `safeappeals-authentication`). */
export const SAFEAPPEALS_AGENT_PARTICIPANT_ID = 'safeappeals.agent';

/** SafeAppeals: extension that registers {@link SAFEAPPEALS_AGENT_PARTICIPANT_ID}. */
export const SAFEAPPEALS_AUTH_EXTENSION_ID = 'safeappeals.safeappeals-authentication';

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
 * SafeAppeals: true when an activated or contributed non-core default agent covers `mode`.
 * Contributed (not yet activated) agents count so fail-fast does not race extension activation.
 */
export function hasUsableNonCoreDefaultAgent(options: {
	activatedDefaultAgent: { isCore?: boolean } | undefined;
	contributedDefaultAgent: { isCore?: boolean; modes: readonly string[] } | undefined;
	mode: string;
}): boolean {
	if (options.activatedDefaultAgent && !options.activatedDefaultAgent.isCore) {
		return true;
	}
	const contributed = options.contributedDefaultAgent;
	return !!contributed && !contributed.isCore && contributed.modes.includes(options.mode);
}

/**
 * SafeAppeals: Agent mode needs a non-core (tools) agent. Cloud Ask/Edit work without one;
 * waiting for a default Agent registration hangs with only the core setup agent.
 */
export function shouldFailFastCloudAgentMode(options: {
	isAgentMode: boolean;
	hasSafeAppealsCloudSession: boolean;
	hasUsableNonCoreDefaultAgent: boolean;
}): boolean {
	return options.isAgentMode
		&& options.hasSafeAppealsCloudSession
		&& !options.hasUsableNonCoreDefaultAgent;
}

/**
 * SafeAppeals: user-facing copy when Agent mode is requested on Cloud-only setup.
 */
export function resolveCloudAgentModeUnavailableMessage(): string {
	return localize('safeAppealsCloudAgentUnavailable', "Agent mode is not available with SafeAppeals Cloud yet. Use Ask or Edit instead.");
}

/**
 * SafeAppeals: Agent + Cloud session should wait for `safeappeals.agent`, not Copilot readiness.
 */
export function shouldUseCloudAgentReadinessPath(options: {
	isAgentMode: boolean;
	usesSafeAppealsCloudSetup: boolean;
	hasSafeAppealsCloudSession: boolean;
}): boolean {
	return options.isAgentMode
		&& options.usesSafeAppealsCloudSetup
		&& options.hasSafeAppealsCloudSession;
}

/**
 * SafeAppeals: skip GitHub auth-extension re-enable (extension-host restart) for Cloud Agent.
 */
export function shouldSkipAuthExtensionEnableForCloudAgent(options: {
	isCloudAgentReadinessPath: boolean;
}): boolean {
	return options.isCloudAgentReadinessPath;
}

/**
 * SafeAppeals: true when `safeappeals.agent` is among activated chat agents.
 */
export function isSafeAppealsCloudAgentActivated(
	activatedAgentIds: readonly string[],
	agentId: string = SAFEAPPEALS_AGENT_PARTICIPANT_ID,
): boolean {
	return activatedAgentIds.includes(agentId);
}

/**
 * SafeAppeals: Cloud models are ready when any live `safeappeals-cloud` vendor model exists
 * (they do not set `isDefaultForLocation`).
 */
export function shouldTreatLiveCloudModelAsLanguageModelReady(options: {
	usesSafeAppealsCloudSetup: boolean;
	hasSafeAppealsCloudSession: boolean;
	hasLiveCloudModel: boolean;
}): boolean {
	return options.usesSafeAppealsCloudSetup
		&& options.hasSafeAppealsCloudSession
		&& options.hasLiveCloudModel;
}

/**
 * SafeAppeals: true when any model vendor id is the Cloud LM vendor.
 */
export function hasLiveSafeAppealsCloudModel(modelVendors: readonly (string | undefined)[]): boolean {
	return modelVendors.some(vendor => vendor === SAFEAPPEALS_CLOUD_VENDOR_ID);
}

/**
 * SafeAppeals: Cloud Agent tools are `safeappeals_*` / built-in — do not wait for `copilot_*`.
 */
export function shouldSkipToolsModelWaitForCloudAgent(options: {
	isCloudAgentReadinessPath: boolean;
}): boolean {
	return options.isCloudAgentReadinessPath;
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
