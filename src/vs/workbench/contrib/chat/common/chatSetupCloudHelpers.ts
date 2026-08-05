/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ChatMessageRole, IChatMessage, SAFEAPPEALS_CLOUD_VENDOR_ID } from './languageModels.js';

/** SafeAppeals: extension command to open the credits checkout flow. */
export const SAFEAPPEALS_OPEN_CHECKOUT_COMMAND = 'safeappeals.cloud.openCheckout';

export interface IUsesSafeAppealsCloudSetupOptions {
	getVendors: () => readonly { vendor: string }[];
	hasByokModels: boolean;
	isAuthenticationProviderRegistered: (providerId: string) => boolean;
}

/**
 * SafeAppeals: true when Cloud LM vendor is registered, or hasByokModels + cloud auth provider
 * (align with SetupAgent / chatSetupRunner).
 */
export function usesSafeAppealsCloudSetup(options: IUsesSafeAppealsCloudSetupOptions): boolean {
	if (options.getVendors().some(v => v.vendor === SAFEAPPEALS_CLOUD_VENDOR_ID)) {
		return true;
	}
	return options.hasByokModels
		&& options.isAuthenticationProviderRegistered(SAFEAPPEALS_CLOUD_VENDOR_ID);
}

/**
 * SafeAppeals: open credits checkout via extension command, falling back to product URL.
 */
export async function openSafeAppealsCreditsCheckout(
	commandService: { executeCommand(commandId: string, ...args: unknown[]): Promise<unknown> },
	openerService: { open(uri: URI): Promise<boolean> },
	upgradePlanUrl: string | undefined,
): Promise<void> {
	const openUpgradePlanUrl = async (): Promise<void> => {
		if (upgradePlanUrl) {
			await openerService.open(URI.parse(upgradePlanUrl));
		}
	};

	if (!CommandsRegistry.getCommand(SAFEAPPEALS_OPEN_CHECKOUT_COMMAND)) {
		await openUpgradePlanUrl();
		return;
	}

	try {
		await commandService.executeCommand(SAFEAPPEALS_OPEN_CHECKOUT_COMMAND);
	} catch {
		await openUpgradePlanUrl();
	}
}

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

/** SafeAppeals: language-model tool id for Ask/Edit → Agent/Plan mode switches. */
export const SAFEAPPEALS_SWITCH_MODE_TOOL_ID = 'safeappeals_switchMode';

/** SafeAppeals: max tool rounds for Ask/Edit Cloud switchMode before giving up. */
export const SAFEAPPEALS_ASK_CLOUD_SWITCH_MODE_MAX_ROUNDS = 3;

/**
 * SafeAppeals: system prompt for Ask/Edit Cloud when `safeappeals_switchMode` is available.
 */
export function buildSafeAppealsAskCloudSystemPrompt(modeLabel: string): string {
	return [
		`You are SafeAppeals Cloud assistant in ${modeLabel} mode.`,
		'Be concise and helpful for Q&A.',
		`When the user needs implementation, multi-file edits, research, architecture, or planning, call ${SAFEAPPEALS_SWITCH_MODE_TOOL_ID} yourself with mode "Agent" or "Plan" — NEVER ask which mode.`,
		'Do not narrate mode switches.',
	].join(' ');
}

/**
 * SafeAppeals: Ask/Edit Cloud system prompt when switchMode tool is not registered.
 */
export function buildSafeAppealsAskCloudSystemPromptWithoutSwitchTool(modeLabel: string): string {
	return [
		`You are SafeAppeals Cloud assistant in ${modeLabel} mode.`,
		'Be concise and helpful for Q&A.',
		'For implementation or planning work, ask the user to switch to Agent or Plan via the mode picker.',
	].join(' ');
}

/**
 * SafeAppeals: true when switchMode tool result indicates a successful mode change.
 */
export function isSuccessfulSwitchModeResultText(text: string): boolean {
	return text.includes('Switched to');
}

/**
 * SafeAppeals: flatten tool result content parts to plain text.
 * Accepts IToolResult content (text / promptTsx / data); only text parts contribute.
 */
export function toolResultContentToText(content: readonly { kind: string; value?: unknown }[]): string {
	const texts: string[] = [];
	for (const part of content) {
		if (part.kind === 'text' && typeof part.value === 'string') {
			texts.push(part.value);
		}
	}
	return texts.join('');
}

/**
 * SafeAppeals: map registered tool metadata to LM `sendChatRequest` tool options.
 */
export function buildSafeAppealsSwitchModeLmTool(tool: {
	id: string;
	modelDescription: string;
	inputSchema?: object;
}): { name: string; description: string; inputSchema?: object } {
	return {
		name: tool.id,
		description: tool.modelDescription,
		...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
	};
}
