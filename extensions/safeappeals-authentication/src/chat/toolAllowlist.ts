/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';

export const SAFEAPPEALS_READ_FILE_TOOL = 'safeappeals_readFile';
export const SAFEAPPEALS_LIST_DIR_TOOL = 'safeappeals_listDir';

/** Registered core edit tool id (extension API may also surface the legacy alias). */
export const VSCODE_EDIT_FILE_TOOL = 'vscode_editFile_internal';

/** Legacy / extension-facing edit id — invoke remaps to {@link VSCODE_EDIT_FILE_TOOL}. */
export const VSCODE_EDIT_FILE_TOOL_ALIAS = 'vscode_editFile';

/** Plain tool shape for `sendRequest` (avoids spreading LanguageModelToolInformation class instances). */
export interface AgentChatToolDescriptor {
	readonly name: string;
	readonly description: string;
	readonly inputSchema?: object;
}

/** MVP allowlist of host tools (present when core/extension registered them). */
export const CORE_AGENT_TOOL_NAMES: readonly string[] = [
	VSCODE_EDIT_FILE_TOOL,
	'run_in_terminal',
	'manage_todo_list',
];

/**
 * Tools force-added unless the picker explicitly disabled them (or a mapped Copilot alias).
 * Terminal / todo / edit are never force-added — picker opt-out wins.
 */
export const ENSURED_AGENT_TOOL_NAMES: readonly string[] = [
	SAFEAPPEALS_READ_FILE_TOOL,
	SAFEAPPEALS_LIST_DIR_TOOL,
];

/**
 * Hardcoded descriptors matching `package.json` languageModelTools (used when absent from `lm.tools`).
 */
export const ENSURED_AGENT_TOOL_DESCRIPTORS: Readonly<Record<string, AgentChatToolDescriptor>> = {
	[SAFEAPPEALS_READ_FILE_TOOL]: {
		name: SAFEAPPEALS_READ_FILE_TOOL,
		description: 'Read the contents of a file in the workspace. Prefer this when you need file text before editing.',
		inputSchema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Workspace-relative or absolute path to the file to read.',
				},
			},
			required: ['path'],
		},
	},
	[SAFEAPPEALS_LIST_DIR_TOOL]: {
		name: SAFEAPPEALS_LIST_DIR_TOOL,
		description: 'List files and folders in a workspace directory.',
		inputSchema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Workspace-relative or absolute directory path. Defaults to the workspace root.',
				},
			},
		},
	},
};

/**
 * Allowlisted host tools used when the picker is absent or yields no enabled tools after mapping.
 */
export const MVP_AGENT_TOOL_NAMES: readonly string[] = [
	SAFEAPPEALS_READ_FILE_TOOL,
	SAFEAPPEALS_LIST_DIR_TOOL,
	'run_in_terminal',
	'manage_todo_list',
	VSCODE_EDIT_FILE_TOOL,
];

/**
 * UI / Copilot picker names → SafeAppeals or host tool ids.
 * Raw `copilot_*` tools are never allowed through; only these substitutions apply.
 */
export const AGENT_TOOL_NAME_SUBSTITUTIONS: Readonly<Record<string, string>> = {
	copilot_readFile: SAFEAPPEALS_READ_FILE_TOOL,
	copilot_listDirectory: SAFEAPPEALS_LIST_DIR_TOOL,
	copilot_insertEdit: VSCODE_EDIT_FILE_TOOL,
	[VSCODE_EDIT_FILE_TOOL_ALIAS]: VSCODE_EDIT_FILE_TOOL,
};

const CORE_AGENT_TOOL_NAME_SET = new Set(CORE_AGENT_TOOL_NAMES);

interface NamedToolSource {
	readonly name: string;
	readonly description?: string;
	readonly inputSchema?: object;
}

/**
 * Maps a picker/model tool name to the host tool id to send/invoke, or `undefined` if blocked.
 */
export function resolveAgentToolName(name: string): string | undefined {
	const substituted = AGENT_TOOL_NAME_SUBSTITUTIONS[name];
	if (substituted !== undefined) {
		return substituted;
	}
	if (isAgentToolAllowed(name)) {
		return name;
	}
	return undefined;
}

/**
 * Resolve a model tool-call name to an invoke id allowed for this turn.
 * Returns `undefined` when the name is unmapped, not allowlisted, or not in the selected tool set.
 */
export function resolveAllowedInvokeToolName(
	callName: string,
	selectedToolNames: ReadonlySet<string>,
): string | undefined {
	const resolved = resolveAgentToolName(callName);
	if (resolved === undefined || !selectedToolNames.has(resolved)) {
		return undefined;
	}
	return resolved;
}

/**
 * Whether a tool name is allowed for the SafeAppeals agent MVP loop.
 * Names must not start with `copilot_` (vendor-reserved); use substitutions instead.
 */
export function isAgentToolAllowed(name: string): boolean {
	if (name.startsWith('copilot_')) {
		return false;
	}
	if (name.startsWith('safeappeals_')) {
		return true;
	}
	return CORE_AGENT_TOOL_NAME_SET.has(name);
}

/**
 * Filters a tool list to the MVP allowlist (no picker mapping).
 */
export function filterAgentTools<T extends { name: string }>(tools: readonly T[]): T[] {
	return tools.filter(tool => isAgentToolAllowed(tool.name));
}

function descriptorFromSource(name: string, source: NamedToolSource): AgentChatToolDescriptor {
	return {
		name,
		description: typeof source.description === 'string' && source.description.length > 0
			? source.description
			: name,
		...(source.inputSchema !== undefined ? { inputSchema: source.inputSchema } : {}),
	};
}

function descriptorForResolvedName(
	resolved: string,
	poolByName: ReadonlyMap<string, NamedToolSource>,
	source?: NamedToolSource,
): AgentChatToolDescriptor | undefined {
	const fromPool = poolByName.get(resolved);
	if (fromPool) {
		return descriptorFromSource(resolved, fromPool);
	}
	if (source) {
		return descriptorFromSource(resolved, source);
	}
	return ENSURED_AGENT_TOOL_DESCRIPTORS[resolved];
}

/**
 * Selects tools for `sendRequest` from the picker map and/or host pool.
 *
 * - Enabled picker entries are mapped via {@link resolveAgentToolName}; raw `copilot_*` names are never returned.
 * - When the resolved id is missing from `pool`, synthesizes a plain descriptor (from the picker source,
 *   or {@link ENSURED_AGENT_TOOL_DESCRIPTORS} for SafeAppeals read/list).
 * - Force-adds ensured tools when not explicitly disabled, even if absent from `pool`.
 * - Never force-adds terminal/todo/edit over a picker `false`.
 */
export function selectAgentTools(options: {
	readonly pool: readonly NamedToolSource[];
	readonly requestTools?: ReadonlyMap<NamedToolSource, boolean>;
}): AgentChatToolDescriptor[] {
	const { pool, requestTools } = options;
	const poolByName = new Map<string, NamedToolSource>();
	for (const tool of pool) {
		poolByName.set(tool.name, tool);
	}

	const selectedByName = new Map<string, AgentChatToolDescriptor>();
	const explicitlyDisabled = new Set<string>();

	const addSelected = (descriptor: AgentChatToolDescriptor): void => {
		if (!selectedByName.has(descriptor.name)) {
			selectedByName.set(descriptor.name, descriptor);
		}
	};

	if (requestTools && requestTools.size > 0) {
		for (const [tool, enabled] of requestTools) {
			const resolved = resolveAgentToolName(tool.name);
			if (!resolved) {
				continue;
			}
			if (!enabled) {
				explicitlyDisabled.add(resolved);
				continue;
			}
			const descriptor = descriptorForResolvedName(resolved, poolByName, tool);
			if (descriptor) {
				addSelected(descriptor);
			}
		}
	}

	if (selectedByName.size === 0) {
		for (const tool of filterAgentTools(pool)) {
			if (!explicitlyDisabled.has(tool.name)) {
				addSelected(descriptorFromSource(tool.name, tool));
			}
		}
	}

	for (const ensuredName of ENSURED_AGENT_TOOL_NAMES) {
		if (explicitlyDisabled.has(ensuredName) || selectedByName.has(ensuredName)) {
			continue;
		}
		const descriptor = descriptorForResolvedName(ensuredName, poolByName);
		if (descriptor) {
			addSelected(descriptor);
		}
	}

	return [...selectedByName.values()];
}

/**
 * Returns true when `candidateFsPath` resolves inside one of `rootFsPaths`.
 *
 * Collapses `..` via {@link path.resolve} before checking with {@link path.relative}.
 * MVP does not resolve symlinks — a symlink under the workspace may still point outside.
 */
export function isPathInsideWorkspaceRoot(candidateFsPath: string, rootFsPaths: readonly string[]): boolean {
	const candidate = path.resolve(candidateFsPath);
	for (const rootRaw of rootFsPaths) {
		const root = path.resolve(rootRaw);
		const relative = path.relative(root, candidate);
		if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
			return true;
		}
	}
	return false;
}
