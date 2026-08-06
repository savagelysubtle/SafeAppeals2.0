/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { URI } from '../../../../../base/common/uri.js';
import { isInCompatAgentsFolder, isInSafeAppealsAgentsFolder } from './config/promptFileLocations.js';
import { ICustomAgent, PromptsStorage } from './service/promptsService.js';

/**
 * Compatibility agent folder path markers (must stay aligned with
 * {@link isInCompatAgentsFolder} in promptFileLocations).
 */
export const COMPAT_AGENT_PATH_MARKERS_FOR_SUBAGENT_INVOKE = [
	'/.github/agents/',
	'/.claude/agents/',
	'/.copilot/agents/',
] as const;

/**
 * SafeAppeals-owned agent folder path markers (must stay aligned with
 * {@link isInSafeAppealsAgentsFolder} in promptFileLocations).
 */
export const SAFE_APPEALS_AGENT_PATH_MARKERS_FOR_SUBAGENT_INVOKE = [
	'/.safeAppeals/agents/',
] as const;

/**
 * Returns true when the agent URI is under a compatibility agent folder
 * (`.github/agents`, `.claude/agents`, `~/.copilot/agents`, `~/.claude/agents`).
 * Shared by discovery UI badges and the runSubagent invoke gate.
 */
export function isCompatAgentUriForSubagentInvoke(uri: URI): boolean {
	return isInCompatAgentsFolder(uri);
}

/**
 * Returns true when the agent URI is under a SafeAppeals-owned agent folder.
 */
export function isSafeAppealsOwnedAgentUriForSubagentInvoke(uri: URI): boolean {
	return isInSafeAppealsAgentsFolder(uri);
}

/**
 * Invoke gate for runSubagent: extension/plugin/builtin and SafeAppeals-owned
 * file agents are allowed; compatibility folder agents and other file sources
 * are refused. Also used when listing agents for the model so names match what
 * runSubagent will accept.
 */
export function isAgentInvocableViaRunSubagent(agent: Pick<ICustomAgent, 'uri' | 'source' | 'enabled'>): boolean {
	if (!agent.enabled) {
		return false;
	}
	const storage = agent.source.storage;
	if (storage === PromptsStorage.extension || storage === PromptsStorage.plugin || storage === PromptsStorage.builtIn) {
		return true;
	}
	if (isCompatAgentUriForSubagentInvoke(agent.uri)) {
		return false;
	}
	return isSafeAppealsOwnedAgentUriForSubagentInvoke(agent.uri);
}
