/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { MAX_AGENT_ITERATIONS, nextAgentLoopDecision } from '../chat/agentLoopHelpers';
import { isBlockedVscodeCommand, isSafeVscodeCommand } from '../chat/commandAllowlist';
import { applyHunkToText, parseSimplePatch } from '../chat/patchHelpers';
import {
	CORE_AGENT_TOOL_NAMES,
	ENSURED_AGENT_TOOL_DESCRIPTORS,
	ENSURED_AGENT_TOOL_NAMES,
	filterAgentTools,
	isAgentToolAllowed,
	isPathInsideWorkspaceRoot,
	MVP_AGENT_TOOL_NAMES,
	resolveAgentToolName,
	resolveAllowedInvokeToolName,
	SAFEAPPEALS_APPLY_PATCH_TOOL,
	SAFEAPPEALS_CREATE_DIRECTORY_TOOL,
	SAFEAPPEALS_CREATE_FILE_TOOL,
	SAFEAPPEALS_EDIT_FILE_TOOL,
	SAFEAPPEALS_FETCH_WEB_PAGE_TOOL,
	SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL,
	SAFEAPPEALS_FIND_FILES_TOOL,
	SAFEAPPEALS_FIND_TEXT_IN_FILES_TOOL,
	SAFEAPPEALS_GET_CHANGED_FILES_TOOL,
	SAFEAPPEALS_GET_ERRORS_TOOL,
	SAFEAPPEALS_LIST_DIR_TOOL,
	SAFEAPPEALS_MULTI_REPLACE_STRING_TOOL,
	SAFEAPPEALS_READ_FILE_TOOL,
	SAFEAPPEALS_REPLACE_STRING_TOOL,
	SAFEAPPEALS_RUN_VSCODE_COMMAND_TOOL,
	SAFEAPPEALS_SEARCH_CODEBASE_TOOL,
	SAFEAPPEALS_SEARCH_WORKSPACE_SYMBOLS_TOOL,
	SAFEAPPEALS_SWITCH_MODE_TOOL,
	SAFEAPPEALS_WEB_SEARCH_TOOL,
	selectAgentTools,
	VSCODE_EDIT_FILE_TOOL,
	VSCODE_EDIT_FILE_TOOL_ALIAS,
	VSCODE_FETCH_WEB_PAGE_TOOL,
} from '../chat/toolAllowlist';
import { buildModeReminderMessage, resolveModeId } from '../chat/switchModeHelpers';

suite('nextAgentLoopDecision', () => {
	test('continues when tools remain under the cap', () => {
		assert.deepStrictEqual(
			nextAgentLoopDecision({
				iteration: 1,
				maxIterations: MAX_AGENT_ITERATIONS,
				toolCallCount: 2,
				cancelled: false,
			}),
			{ kind: 'continue' },
		);
	});

	test('stops for done, maxIterations, and cancelled', () => {
		assert.deepStrictEqual(
			nextAgentLoopDecision({
				iteration: 3,
				maxIterations: MAX_AGENT_ITERATIONS,
				toolCallCount: 0,
				cancelled: false,
			}),
			{ kind: 'stop', reason: 'done' },
		);
		assert.deepStrictEqual(
			nextAgentLoopDecision({
				iteration: MAX_AGENT_ITERATIONS,
				maxIterations: MAX_AGENT_ITERATIONS,
				toolCallCount: 1,
				cancelled: false,
			}),
			{ kind: 'stop', reason: 'maxIterations' },
		);
		assert.deepStrictEqual(
			nextAgentLoopDecision({
				iteration: 1,
				maxIterations: MAX_AGENT_ITERATIONS,
				toolCallCount: 1,
				cancelled: true,
			}),
			{ kind: 'stop', reason: 'cancelled' },
		);
	});
});

suite('agent tool allowlist', () => {
	test('allows core host tools and safeappeals_*; blocks copilot_*', () => {
		assert.deepStrictEqual(
			{
				core: CORE_AGENT_TOOL_NAMES.every(isAgentToolAllowed),
				editInternal: isAgentToolAllowed(VSCODE_EDIT_FILE_TOOL),
				editAlias: isAgentToolAllowed(VSCODE_EDIT_FILE_TOOL_ALIAS),
				ensured: ENSURED_AGENT_TOOL_NAMES.every(isAgentToolAllowed),
				copilot: isAgentToolAllowed('copilot_readFile'),
				memory: isAgentToolAllowed('copilot_memory'),
				exploreSubagent: isAgentToolAllowed('explore_subagent'),
				skill: isAgentToolAllowed('skill'),
				executionSubagent: isAgentToolAllowed('execution_subagent'),
				searchSubagent: isAgentToolAllowed('search_subagent'),
				random: isAgentToolAllowed('random_tool'),
			},
			{
				core: true,
				editInternal: true,
				editAlias: false,
				ensured: true,
				copilot: false,
				memory: false,
				exploreSubagent: false,
				skill: false,
				executionSubagent: false,
				searchSubagent: false,
				random: false,
			},
		);
	});

	test('filterAgentTools keeps allowlisted names only', () => {
		assert.deepStrictEqual(
			filterAgentTools([
				{ name: 'run_in_terminal' },
				{ name: 'copilot_readFile' },
				{ name: SAFEAPPEALS_READ_FILE_TOOL },
				{ name: SAFEAPPEALS_EDIT_FILE_TOOL },
				{ name: VSCODE_EDIT_FILE_TOOL },
				{ name: VSCODE_EDIT_FILE_TOOL_ALIAS },
				{ name: 'other' },
			]).map(t => t.name),
			['run_in_terminal', SAFEAPPEALS_READ_FILE_TOOL, SAFEAPPEALS_EDIT_FILE_TOOL, VSCODE_EDIT_FILE_TOOL],
		);
	});

	test('maps copilot picker tools to safeappeals / internal edit ids', () => {
		assert.deepStrictEqual(
			{
				read: resolveAgentToolName('copilot_readFile'),
				list: resolveAgentToolName('copilot_listDirectory'),
				edit: resolveAgentToolName('copilot_insertEdit'),
				createFile: resolveAgentToolName('copilot_createFile'),
				createDirectory: resolveAgentToolName('copilot_createDirectory'),
				findFiles: resolveAgentToolName('copilot_findFiles'),
				findText: resolveAgentToolName('copilot_findTextInFiles'),
				symbols: resolveAgentToolName('copilot_searchWorkspaceSymbols'),
				errors: resolveAgentToolName('copilot_getErrors'),
				changes: resolveAgentToolName('copilot_getChangedFiles'),
				codebase: resolveAgentToolName('copilot_searchCodebase'),
				replace: resolveAgentToolName('copilot_replaceString'),
				multiReplace: resolveAgentToolName('copilot_multiReplaceString'),
				applyPatch: resolveAgentToolName('copilot_applyPatch'),
				runCommand: resolveAgentToolName('copilot_runVscodeCommand'),
				fetch: resolveAgentToolName('copilot_fetchWebPage'),
				switchMode: resolveAgentToolName('copilot_switchAgent'),
				webSearch: resolveAgentToolName('web_search'),
				multiWebSearch: resolveAgentToolName('multi_link_search'),
				legacyEdit: resolveAgentToolName(VSCODE_EDIT_FILE_TOOL_ALIAS),
				blocked: resolveAgentToolName('copilot_unknownTool'),
				passThrough: resolveAgentToolName(SAFEAPPEALS_READ_FILE_TOOL),
				fetchCore: isAgentToolAllowed(VSCODE_FETCH_WEB_PAGE_TOOL),
				browser: isAgentToolAllowed('open_browser_page'),
			},
			{
				read: SAFEAPPEALS_READ_FILE_TOOL,
				list: SAFEAPPEALS_LIST_DIR_TOOL,
				edit: SAFEAPPEALS_EDIT_FILE_TOOL,
				createFile: SAFEAPPEALS_CREATE_FILE_TOOL,
				createDirectory: SAFEAPPEALS_CREATE_DIRECTORY_TOOL,
				findFiles: SAFEAPPEALS_FIND_FILES_TOOL,
				findText: SAFEAPPEALS_FIND_TEXT_IN_FILES_TOOL,
				symbols: SAFEAPPEALS_SEARCH_WORKSPACE_SYMBOLS_TOOL,
				errors: SAFEAPPEALS_GET_ERRORS_TOOL,
				changes: SAFEAPPEALS_GET_CHANGED_FILES_TOOL,
				codebase: SAFEAPPEALS_SEARCH_CODEBASE_TOOL,
				replace: SAFEAPPEALS_REPLACE_STRING_TOOL,
				multiReplace: SAFEAPPEALS_MULTI_REPLACE_STRING_TOOL,
				applyPatch: SAFEAPPEALS_APPLY_PATCH_TOOL,
				runCommand: SAFEAPPEALS_RUN_VSCODE_COMMAND_TOOL,
				fetch: SAFEAPPEALS_FETCH_WEB_PAGE_TOOL,
				switchMode: SAFEAPPEALS_SWITCH_MODE_TOOL,
				webSearch: SAFEAPPEALS_WEB_SEARCH_TOOL,
				multiWebSearch: SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL,
				legacyEdit: VSCODE_EDIT_FILE_TOOL,
				blocked: undefined,
				passThrough: SAFEAPPEALS_READ_FILE_TOOL,
				fetchCore: true,
				browser: true,
			},
		);
	});

	test('resolveAllowedInvokeToolName gates unmapped and non-selected tools', () => {
		const selected = new Set([
			SAFEAPPEALS_READ_FILE_TOOL,
			SAFEAPPEALS_EDIT_FILE_TOOL,
			SAFEAPPEALS_SEARCH_CODEBASE_TOOL,
			VSCODE_EDIT_FILE_TOOL,
		]);
		assert.deepStrictEqual(
			{
				mappedRead: resolveAllowedInvokeToolName('copilot_readFile', selected),
				mappedEdit: resolveAllowedInvokeToolName('copilot_insertEdit', selected),
				mappedCodebase: resolveAllowedInvokeToolName('copilot_searchCodebase', selected),
				legacyEdit: resolveAllowedInvokeToolName(VSCODE_EDIT_FILE_TOOL_ALIAS, selected),
				unmappedCopilot: resolveAllowedInvokeToolName('copilot_unknownTool', selected),
				notSelected: resolveAllowedInvokeToolName('run_in_terminal', selected),
				selected: resolveAllowedInvokeToolName(SAFEAPPEALS_READ_FILE_TOOL, selected),
				syntheticSelected: resolveAllowedInvokeToolName(
					SAFEAPPEALS_READ_FILE_TOOL,
					new Set([SAFEAPPEALS_READ_FILE_TOOL]),
				),
			},
			{
				mappedRead: SAFEAPPEALS_READ_FILE_TOOL,
				mappedEdit: SAFEAPPEALS_EDIT_FILE_TOOL,
				mappedCodebase: SAFEAPPEALS_SEARCH_CODEBASE_TOOL,
				legacyEdit: VSCODE_EDIT_FILE_TOOL,
				unmappedCopilot: undefined,
				notSelected: undefined,
				selected: SAFEAPPEALS_READ_FILE_TOOL,
				syntheticSelected: SAFEAPPEALS_READ_FILE_TOOL,
			},
		);
	});
});

suite('selectAgentTools', () => {
	const pool = [
		{ name: 'copilot_readFile', description: 'Copilot read' },
		{ name: 'copilot_listDirectory', description: 'Copilot list' },
		{ name: 'copilot_insertEdit', description: 'Copilot edit' },
		{ name: 'copilot_searchCodebase', description: 'Copilot search' },
		{ name: SAFEAPPEALS_READ_FILE_TOOL, description: 'SA read' },
		{ name: SAFEAPPEALS_LIST_DIR_TOOL, description: 'SA list' },
		{ name: VSCODE_EDIT_FILE_TOOL, description: 'Edit' },
		{ name: 'run_in_terminal', description: 'Terminal' },
		{ name: 'manage_todo_list', description: 'Todos' },
		{ name: 'other_tool', description: 'Other' },
		{ name: 'copilot_createFile', description: 'Copilot create file' },
		{ name: 'copilot_createDirectory', description: 'Copilot create directory' },
	];

	test('maps enabled request.tools to safeappeals / host tools; never passes raw copilot_*', () => {
		const requestTools = new Map([
			[pool[0], true], // copilot_readFile
			[pool[1], true], // copilot_listDirectory
			[pool[2], true], // copilot_insertEdit
			[pool[3], true], // copilot_searchCodebase → safeappeals_searchCodebase
			[pool[9], true], // other_tool — blocked
		]);
		const selected = selectAgentTools({ pool, requestTools }).map(t => t.name).sort();
		assert.deepStrictEqual(selected, [...ENSURED_AGENT_TOOL_NAMES].sort());
		assert.deepStrictEqual(selected.some(n => n.startsWith('copilot_')), false);
	});

	test('synthesizes safeappeals_readFile when pool only has copilot_readFile', () => {
		const copilotRead = {
			name: 'copilot_readFile',
			description: 'Read a file (copilot)',
			inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
		};
		const requestTools = new Map([[copilotRead, true]]);
		const selected = selectAgentTools({ pool: [copilotRead], requestTools });
		assert.deepStrictEqual(
			{
				names: selected.map(t => t.name).sort(),
				read: selected.find(t => t.name === SAFEAPPEALS_READ_FILE_TOOL),
				list: selected.find(t => t.name === SAFEAPPEALS_LIST_DIR_TOOL),
				hasCopilot: selected.some(t => t.name.startsWith('copilot_')),
			},
			{
				names: [...ENSURED_AGENT_TOOL_NAMES].sort(),
				read: {
					name: SAFEAPPEALS_READ_FILE_TOOL,
					description: 'Read a file (copilot)',
					inputSchema: copilotRead.inputSchema,
				},
				list: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_LIST_DIR_TOOL],
				hasCopilot: false,
			},
		);
	});

	test('empty pool with no requestTools still returns ensured synthetic read/list/edit/create tools', () => {
		const selected = selectAgentTools({ pool: [] });
		assert.deepStrictEqual(
			selected.map(t => t.name).sort(),
			[...ENSURED_AGENT_TOOL_NAMES].sort(),
		);
		assert.deepStrictEqual(
			selected.find(t => t.name === SAFEAPPEALS_READ_FILE_TOOL),
			ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_READ_FILE_TOOL],
		);
		assert.deepStrictEqual(
			selected.find(t => t.name === SAFEAPPEALS_EDIT_FILE_TOOL),
			ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_EDIT_FILE_TOOL],
		);
		assert.deepStrictEqual(
			selected.find(t => t.name === SAFEAPPEALS_CREATE_FILE_TOOL),
			ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_CREATE_FILE_TOOL],
		);
		assert.deepStrictEqual(
			selected.find(t => t.name === SAFEAPPEALS_CREATE_DIRECTORY_TOOL),
			ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_CREATE_DIRECTORY_TOOL],
		);
	});

	test('empty picker still gets production allowlist tools if registered in pool', () => {
		const requestTools = new Map<typeof pool[number], boolean>();
		const selected = selectAgentTools({ pool, requestTools }).map(t => t.name).sort();
		assert.deepStrictEqual(selected, [...MVP_AGENT_TOOL_NAMES].sort());
	});

	test('absent request tools falls back to allowlisted pool plus ensured', () => {
		const selected = selectAgentTools({ pool }).map(t => t.name).sort();
		assert.deepStrictEqual(selected, [...MVP_AGENT_TOOL_NAMES].sort());
		assert.deepStrictEqual(selected.includes('copilot_readFile'), false);
		assert.deepStrictEqual(selected.includes(VSCODE_EDIT_FILE_TOOL_ALIAS), false);
	});

	test('honors picker false for terminal and todo; still ensures safeappeals when not disabled', () => {
		const requestTools = new Map([
			[pool[6], true], // vscode_editFile_internal
			[pool[7], false], // run_in_terminal
			[pool[8], false], // manage_todo_list
		]);
		const selected = selectAgentTools({ pool, requestTools }).map(t => t.name).sort();
		assert.deepStrictEqual(selected, [
			...ENSURED_AGENT_TOOL_NAMES,
			VSCODE_EDIT_FILE_TOOL,
		].sort());
		assert.deepStrictEqual(selected.includes('run_in_terminal'), false);
		assert.deepStrictEqual(selected.includes('manage_todo_list'), false);
	});

	test('does not force-add safeappeals when picker explicitly disables mapped aliases', () => {
		const disabledAliases = [
			{ name: 'copilot_readFile', description: 'r' },
			{ name: 'copilot_listDirectory', description: 'l' },
			{ name: 'copilot_insertEdit', description: 'e' },
			{ name: 'copilot_createFile', description: 'cf' },
			{ name: 'copilot_createDirectory', description: 'cd' },
			{ name: 'copilot_findFiles', description: 'ff' },
			{ name: 'copilot_findTextInFiles', description: 'ft' },
			{ name: 'copilot_searchWorkspaceSymbols', description: 'sy' },
			{ name: 'copilot_getErrors', description: 'ge' },
			{ name: 'copilot_getChangedFiles', description: 'gc' },
			{ name: 'copilot_searchCodebase', description: 'sc' },
			{ name: 'copilot_replaceString', description: 'rs' },
			{ name: 'copilot_multiReplaceString', description: 'mrs' },
			{ name: 'copilot_applyPatch', description: 'ap' },
			{ name: 'copilot_runVscodeCommand', description: 'rvc' },
			{ name: 'copilot_fetchWebPage', description: 'fwp' },
			{ name: 'copilot_switchAgent', description: 'sa' },
			{ name: 'web_search', description: 'ws' },
			{ name: 'multi_link_search', description: 'mls' },
			{ name: VSCODE_EDIT_FILE_TOOL, description: 'Edit' },
		];
		const enabled = disabledAliases[disabledAliases.length - 1];
		const requestTools = new Map<typeof disabledAliases[number], boolean>([
			...disabledAliases.slice(0, -1).map(tool => [tool, false] as const),
			[enabled, true],
		]);
		assert.deepStrictEqual(
			selectAgentTools({ pool: disabledAliases, requestTools }).map(t => t.name),
			[VSCODE_EDIT_FILE_TOOL],
		);
	});

	test('uses vscode_editFile_internal not vscode_editFile alias in selection', () => {
		const poolWithAlias = [
			{ name: VSCODE_EDIT_FILE_TOOL_ALIAS, description: 'Legacy edit' },
			{ name: VSCODE_EDIT_FILE_TOOL, description: 'Internal edit' },
			{ name: SAFEAPPEALS_READ_FILE_TOOL, description: 'SA read' },
		];
		const requestTools = new Map([
			[poolWithAlias[0], true],
		]);
		assert.deepStrictEqual(
			selectAgentTools({ pool: poolWithAlias, requestTools }).map(t => t.name).sort(),
			[...ENSURED_AGENT_TOOL_NAMES, VSCODE_EDIT_FILE_TOOL].sort(),
		);
	});

	test('ensured descriptors include replace, fetch, web search, and switch mode tools', () => {
		assert.deepStrictEqual(
			{
				hasReplace: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_REPLACE_STRING_TOOL),
				hasFetch: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_FETCH_WEB_PAGE_TOOL),
				hasWebSearch: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_WEB_SEARCH_TOOL),
				hasMultiWebSearch: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL),
				hasSwitchMode: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_SWITCH_MODE_TOOL),
				replaceDesc: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_REPLACE_STRING_TOOL]?.name,
				fetchDesc: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_FETCH_WEB_PAGE_TOOL]?.name,
				webSearchDesc: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_WEB_SEARCH_TOOL]?.name,
				multiWebSearchDesc: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL]?.name,
				switchModeDesc: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_SWITCH_MODE_TOOL]?.name,
			},
			{
				hasReplace: true,
				hasFetch: true,
				hasWebSearch: true,
				hasMultiWebSearch: true,
				hasSwitchMode: true,
				replaceDesc: SAFEAPPEALS_REPLACE_STRING_TOOL,
				fetchDesc: SAFEAPPEALS_FETCH_WEB_PAGE_TOOL,
				webSearchDesc: SAFEAPPEALS_WEB_SEARCH_TOOL,
				multiWebSearchDesc: SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL,
				switchModeDesc: SAFEAPPEALS_SWITCH_MODE_TOOL,
			},
		);
	});

	test('switchMode maps Plan and Agent to toggleAgentMode ids', () => {
		assert.deepStrictEqual(
			{
				plan: resolveModeId('Plan'),
				agent: resolveModeId('Agent'),
				invalid: resolveModeId('Ask'),
			},
			{
				plan: 'Plan',
				agent: 'agent',
				invalid: undefined,
			},
		);
	});

	test('mode reminder states current mode and forbids asking the user', () => {
		const reminder = buildModeReminderMessage({
			modeName: 'Agent',
			modeContent: 'Do the work carefully.',
		});
		assert.deepStrictEqual(
			{
				hasMode: reminder.includes('currently running in "Agent" mode'),
				neverAsk: reminder.includes('NEVER ask the user which mode'),
				askLeave: reminder.includes('while you are in Ask'),
				hasContent: reminder.includes('Do the work carefully.'),
				defaultName: buildModeReminderMessage({}).includes('currently running in "Agent" mode'),
			},
			{
				hasMode: true,
				neverAsk: true,
				askLeave: true,
				hasContent: true,
				defaultName: true,
			},
		);
	});
});

suite('editTools patch helpers', () => {
	test('applyHunkToText replaces a single old/new block', () => {
		const original = 'line1\nfoo\nline3\n';
		assert.deepStrictEqual(
			applyHunkToText(original, [' line1', '-foo', '+bar', ' line3']),
			{ ok: true, text: 'line1\nbar\nline3\n' },
		);
	});

	test('parseSimplePatch reads update/add/delete ops', () => {
		const ops = parseSimplePatch([
			'*** Begin Patch',
			'*** Update File: /work/a.ts',
			'@@',
			' const x = 1',
			'-const y = 2',
			'+const y = 3',
			'*** Add File: /work/b.ts',
			'+hello',
			'*** Delete File: /work/c.ts',
			'*** End Patch',
		].join('\n'));
		assert.deepStrictEqual(
			ops.map(op => ({ action: op.action, path: op.path, hunks: op.hunks.length, add: op.addLines })),
			[
				{ action: 'update', path: '/work/a.ts', hunks: 1, add: [] },
				{ action: 'add', path: '/work/b.ts', hunks: 0, add: ['hello'] },
				{ action: 'delete', path: '/work/c.ts', hunks: 0, add: [] },
			],
		);
	});
});

suite('webTools command allowlist', () => {
	test('classifies safe, confirmation-needed, and blocked commands', () => {
		assert.deepStrictEqual(
			{
				safeEditor: isSafeVscodeCommand('editor.action.formatDocument'),
				safeSa: isSafeVscodeCommand('safeappeals.cloud.getBalance'),
				unsafeNeedsConfirm: isSafeVscodeCommand('workbench.action.debug.start'),
				blocked: isBlockedVscodeCommand('workbench.action.quit'),
				blockedNotSafe: isSafeVscodeCommand('workbench.action.quit'),
			},
			{
				safeEditor: true,
				safeSa: true,
				unsafeNeedsConfirm: false,
				blocked: true,
				blockedNotSafe: false,
			},
		);
	});
});

suite('isPathInsideWorkspaceRoot', () => {
	test('accepts paths under a workspace root and rejects escapes', () => {
		assert.deepStrictEqual(
			{
				exact: isPathInsideWorkspaceRoot('/work/project', ['/work/project']),
				child: isPathInsideWorkspaceRoot('/work/project/src/a.ts', ['/work/project']),
				escape: isPathInsideWorkspaceRoot('/etc/passwd', ['/work/project']),
				siblingPrefix: isPathInsideWorkspaceRoot('/work/project-evil/x', ['/work/project']),
			},
			{
				exact: true,
				child: true,
				escape: false,
				siblingPrefix: false,
			},
		);
	});

	test('rejects .. traversal that escapes the workspace after normalize', () => {
		assert.deepStrictEqual(
			{
				dotDotSecret: isPathInsideWorkspaceRoot('/work/project/../secret', ['/work/project']),
				dotDotPasswd: isPathInsideWorkspaceRoot('/work/project/../../etc/passwd', ['/work/project']),
				nestedEscape: isPathInsideWorkspaceRoot('/work/project/src/../../../etc/passwd', ['/work/project']),
				dotDotInside: isPathInsideWorkspaceRoot('/work/project/src/../README.md', ['/work/project']),
			},
			{
				dotDotSecret: false,
				dotDotPasswd: false,
				nestedEscape: false,
				dotDotInside: true,
			},
		);
	});
});
