/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { buildAgentLoopPrefixMessages } from '../chat/agentLoop';
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
	isPlanEditDeniedTool,
	isPlanModeName,
	MVP_AGENT_TOOL_NAMES,
	PLAN_MODE_EDIT_DENYLIST,
	resolveAgentToolName,
	resolveAllowedInvokeToolName,
	SAFEAPPEALS_APPLY_PATCH_TOOL,
	SAFEAPPEALS_CREATE_DIRECTORY_TOOL,
	SAFEAPPEALS_CREATE_FILE_TOOL,
	SAFEAPPEALS_CREATE_PLAN_TOOL,
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
	SAFEAPPEALS_RAG_GET_STATS_TOOL,
	SAFEAPPEALS_RAG_SEARCH_REFERENCE_TOOL,
	SAFEAPPEALS_RAG_SEARCH_WORKSPACE_TOOL,
	SAFEAPPEALS_RAG_SEARCH_ALL_TOOL,
	SAFEAPPEALS_RAG_INDEX_DOCUMENT_TOOL,
	requestToolsMapFromEnablement,
	selectAgentTools,
	stripPlanEditTools,
	VSCODE_EDIT_FILE_TOOL,
	VSCODE_EDIT_FILE_TOOL_ALIAS,
	VSCODE_FETCH_WEB_PAGE_TOOL,
} from '../chat/toolAllowlist';
import { buildPrivateSearchAgentProtocolMessage } from '../chat/privateSearchAgentProtocol';
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
				runSubagent: isAgentToolAllowed('runSubagent'),
				runSubagentInCore: CORE_AGENT_TOOL_NAMES.includes('runSubagent'),
				runSubagentInEnsured: ENSURED_AGENT_TOOL_NAMES.includes('runSubagent'),
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
				runSubagent: true,
				runSubagentInCore: true,
				runSubagentInEnsured: false,
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
				ragIndex: resolveAgentToolName('rag_index_document'),
				ragSearchRef: resolveAgentToolName('rag_search_reference'),
				ragSearchWs: resolveAgentToolName('rag_search_workspace'),
				ragSearchAll: resolveAgentToolName('rag_search_all'),
				ragStats: resolveAgentToolName('rag_get_stats'),
				ragPassThrough: isAgentToolAllowed('safeappeals_rag_search_all'),
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
				ragIndex: 'safeappeals_rag_index_document',
				ragSearchRef: 'safeappeals_rag_search_reference',
				ragSearchWs: 'safeappeals_rag_search_workspace',
				ragSearchAll: 'safeappeals_rag_search_all',
				ragStats: 'safeappeals_rag_get_stats',
				ragPassThrough: true,
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
			{ name: 'rag_get_stats', description: 'rgs' },
			{ name: 'rag_search_reference', description: 'rsr' },
			{ name: 'rag_search_workspace', description: 'rsw' },
			{ name: 'rag_search_all', description: 'rsa' },
			{ name: 'rag_index_document', description: 'rid' },
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

	test('ensured descriptors include replace, fetch, web search, RAG, and switch mode tools', () => {
		assert.deepStrictEqual(
			{
				hasReplace: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_REPLACE_STRING_TOOL),
				hasFetch: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_FETCH_WEB_PAGE_TOOL),
				hasWebSearch: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_WEB_SEARCH_TOOL),
				hasMultiWebSearch: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL),
				hasRagStats: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_RAG_GET_STATS_TOOL),
				hasRagSearchRef: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_RAG_SEARCH_REFERENCE_TOOL),
				hasRagSearchWs: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_RAG_SEARCH_WORKSPACE_TOOL),
				hasRagSearchAll: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_RAG_SEARCH_ALL_TOOL),
				hasRagIndex: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_RAG_INDEX_DOCUMENT_TOOL),
				hasSwitchMode: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_SWITCH_MODE_TOOL),
				replaceDesc: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_REPLACE_STRING_TOOL]?.name,
				fetchDesc: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_FETCH_WEB_PAGE_TOOL]?.name,
				webSearchDesc: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_WEB_SEARCH_TOOL]?.name,
				multiWebSearchDesc: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL]?.name,
				ragStatsDesc: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_RAG_GET_STATS_TOOL]?.name,
				ragSearchRefDesc: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_RAG_SEARCH_REFERENCE_TOOL]?.description.includes('core reference'),
				switchModeDesc: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_SWITCH_MODE_TOOL]?.name,
			},
			{
				hasReplace: true,
				hasFetch: true,
				hasWebSearch: true,
				hasMultiWebSearch: true,
				hasRagStats: true,
				hasRagSearchRef: true,
				hasRagSearchWs: true,
				hasRagSearchAll: true,
				hasRagIndex: true,
				hasSwitchMode: true,
				replaceDesc: SAFEAPPEALS_REPLACE_STRING_TOOL,
				fetchDesc: SAFEAPPEALS_FETCH_WEB_PAGE_TOOL,
				webSearchDesc: SAFEAPPEALS_WEB_SEARCH_TOOL,
				multiWebSearchDesc: SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL,
				ragStatsDesc: SAFEAPPEALS_RAG_GET_STATS_TOOL,
				ragSearchRefDesc: true,
				switchModeDesc: SAFEAPPEALS_SWITCH_MODE_TOOL,
			},
		);
	});

	test('createPlan is never force-ensured for Agent', () => {
		assert.deepStrictEqual(
			{
				inEnsured: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_CREATE_PLAN_TOOL),
				hasDescriptor: SAFEAPPEALS_CREATE_PLAN_TOOL in ENSURED_AGENT_TOOL_DESCRIPTORS,
			},
			{
				inEnsured: false,
				hasDescriptor: true,
			},
		);
	});

	test('Agent mode selection still includes ENSURED edit tools', () => {
		const selected = selectAgentTools({ pool: [], modeName: 'Agent' }).map(t => t.name);
		assert.deepStrictEqual(
			{
				edit: selected.includes(SAFEAPPEALS_EDIT_FILE_TOOL),
				createFile: selected.includes(SAFEAPPEALS_CREATE_FILE_TOOL),
				createDir: selected.includes(SAFEAPPEALS_CREATE_DIRECTORY_TOOL),
				replace: selected.includes(SAFEAPPEALS_REPLACE_STRING_TOOL),
				multiReplace: selected.includes(SAFEAPPEALS_MULTI_REPLACE_STRING_TOOL),
				applyPatch: selected.includes(SAFEAPPEALS_APPLY_PATCH_TOOL),
				createPlan: selected.includes(SAFEAPPEALS_CREATE_PLAN_TOOL),
			},
			{
				edit: true,
				createFile: true,
				createDir: true,
				replace: true,
				multiReplace: true,
				applyPatch: true,
				createPlan: false,
			},
		);
	});

	test('Plan mode selection strips all edit denylist tools', () => {
		const requestTools = new Map([
			[pool[2], true], // copilot_insertEdit → safeappeals_editFile
			[pool[6], true], // vscode_editFile_internal
			[pool[10], true], // copilot_createFile
			[pool[11], true], // copilot_createDirectory
		]);
		const selected = selectAgentTools({ pool, requestTools, modeName: 'Plan' }).map(t => t.name);
		assert.deepStrictEqual(
			{
				isPlan: isPlanModeName('Plan'),
				isPlanLower: isPlanModeName(' plan '),
				deniedEdit: isPlanEditDeniedTool(SAFEAPPEALS_EDIT_FILE_TOOL),
				deniedInternal: isPlanEditDeniedTool(VSCODE_EDIT_FILE_TOOL),
				anyDenied: selected.some(isPlanEditDeniedTool),
				stripped: stripPlanEditTools(PLAN_MODE_EDIT_DENYLIST.map(name => ({ name }))).length,
				hasRead: selected.includes(SAFEAPPEALS_READ_FILE_TOOL),
				hasSwitch: selected.includes(SAFEAPPEALS_SWITCH_MODE_TOOL),
				hasCreatePlan: selected.includes(SAFEAPPEALS_CREATE_PLAN_TOOL),
			},
			{
				isPlan: true,
				isPlanLower: true,
				deniedEdit: true,
				deniedInternal: true,
				anyDenied: false,
				stripped: 0,
				hasRead: true,
				hasSwitch: true,
				hasCreatePlan: false,
			},
		);
	});

	test('runSubagent is CORE∩pool when picker absent; explicit false keeps it out (never ENSURED)', () => {
		const runSubagent = { name: 'runSubagent', description: 'Run Subagent' };
		const poolWithRunSubagent = [
			{ name: SAFEAPPEALS_READ_FILE_TOOL, description: 'read' },
			runSubagent,
		];

		const whenAbsentPicker = selectAgentTools({ pool: poolWithRunSubagent }).map(t => t.name);
		const whenEmptyPicker = selectAgentTools({
			pool: poolWithRunSubagent,
			requestTools: new Map(),
		}).map(t => t.name);
		const whenNestingDisabled = selectAgentTools({
			pool: poolWithRunSubagent,
			requestTools: new Map([
				[poolWithRunSubagent[0], true],
				[runSubagent, false],
			]),
		}).map(t => t.name);

		assert.deepStrictEqual(
			{
				inEnsured: ENSURED_AGENT_TOOL_NAMES.includes('runSubagent'),
				absentPicker: whenAbsentPicker.includes('runSubagent'),
				emptyPicker: whenEmptyPicker.includes('runSubagent'),
				nestingDisabled: whenNestingDisabled.includes('runSubagent'),
				nestingStillHasRead: whenNestingDisabled.includes(SAFEAPPEALS_READ_FILE_TOOL),
			},
			{
				inEnsured: false,
				absentPicker: true,
				emptyPicker: true,
				nestingDisabled: false,
				nestingStillHasRead: true,
			},
		);
	});

	test('subagent default-deny enablement map does not leak mutators via selectAgentTools', () => {
		// Contract with core `createDefaultDenySubagentTools` / `SUBAGENT_DEFAULT_*_TOOL_IDS`
		// in runSubagentTool.ts: seed-enable read/search; explicit-false mutators.
		const seedEnabled = [
			SAFEAPPEALS_READ_FILE_TOOL,
			SAFEAPPEALS_LIST_DIR_TOOL,
			SAFEAPPEALS_FIND_FILES_TOOL,
			SAFEAPPEALS_FIND_TEXT_IN_FILES_TOOL,
			SAFEAPPEALS_SEARCH_WORKSPACE_SYMBOLS_TOOL,
			SAFEAPPEALS_GET_ERRORS_TOOL,
			SAFEAPPEALS_GET_CHANGED_FILES_TOOL,
			SAFEAPPEALS_SEARCH_CODEBASE_TOOL,
			SAFEAPPEALS_RAG_GET_STATS_TOOL,
			SAFEAPPEALS_RAG_SEARCH_REFERENCE_TOOL,
			SAFEAPPEALS_RAG_SEARCH_WORKSPACE_TOOL,
			SAFEAPPEALS_RAG_SEARCH_ALL_TOOL,
			'timeline_get_events',
			'timeline_get_deadlines',
		] as const;
		const mustStayDisabled = [
			SAFEAPPEALS_EDIT_FILE_TOOL,
			SAFEAPPEALS_CREATE_FILE_TOOL,
			SAFEAPPEALS_CREATE_DIRECTORY_TOOL,
			SAFEAPPEALS_REPLACE_STRING_TOOL,
			SAFEAPPEALS_MULTI_REPLACE_STRING_TOOL,
			SAFEAPPEALS_APPLY_PATCH_TOOL,
			SAFEAPPEALS_RUN_VSCODE_COMMAND_TOOL,
			SAFEAPPEALS_FETCH_WEB_PAGE_TOOL,
			SAFEAPPEALS_WEB_SEARCH_TOOL,
			SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL,
			SAFEAPPEALS_SWITCH_MODE_TOOL,
			SAFEAPPEALS_CREATE_PLAN_TOOL,
			SAFEAPPEALS_RAG_INDEX_DOCUMENT_TOOL,
			VSCODE_EDIT_FILE_TOOL,
			VSCODE_FETCH_WEB_PAGE_TOOL,
			'run_in_terminal',
			'kill_terminal',
			// Nesting disable: CORE-allowed but must not reappear via ENSURED if mistakenly added later.
			'runSubagent',
			'browserTool',
			'open_browser_page',
			'click_element',
			'screenshot_page',
			'navigate_page',
			'read_page',
			'hover_element',
			'drag_element',
			'type_in_page',
			'handle_dialog',
			'run_playwright_code',
			'timeline_add_event',
			'timeline_update_event',
			'timeline_delete_event',
			'timeline_link_document',
		] as const;

		const enablement: Record<string, boolean> = {};
		for (const id of seedEnabled) {
			enablement[id] = true;
		}
		for (const id of mustStayDisabled) {
			enablement[id] = false;
		}

		const pool = [
			...new Set([...ENSURED_AGENT_TOOL_NAMES, ...CORE_AGENT_TOOL_NAMES, ...mustStayDisabled, ...seedEnabled]),
		].map(name => ({ name, description: name }));

		const selected = selectAgentTools({
			pool,
			requestTools: requestToolsMapFromEnablement(enablement, pool),
		}).map(t => t.name);

		assert.deepStrictEqual(
			{
				hasRead: selected.includes(SAFEAPPEALS_READ_FILE_TOOL),
				hasList: selected.includes(SAFEAPPEALS_LIST_DIR_TOOL),
				hasRagSearch: selected.includes(SAFEAPPEALS_RAG_SEARCH_REFERENCE_TOOL),
				leaked: mustStayDisabled.filter(id => selected.includes(id)),
				// Empty selection would MVP-fallback and re-add ENSURED edits — must not happen.
				nonEmpty: selected.length > 0,
			},
			{
				hasRead: true,
				hasList: true,
				hasRagSearch: true,
				leaked: [],
				nonEmpty: true,
			},
		);
	});

	test('all-false enablement map without seed-enable still leaks ENSURED mutators (documents the hazard)', () => {
		// Guardrail: proves why RunSubagentTool must seed at least one `true` read tool.
		const enablement: Record<string, boolean> = {
			[SAFEAPPEALS_EDIT_FILE_TOOL]: false,
			[SAFEAPPEALS_CREATE_FILE_TOOL]: false,
		};
		const pool = ENSURED_AGENT_TOOL_NAMES.map(name => ({ name, description: name }));
		const selected = selectAgentTools({
			pool,
			requestTools: requestToolsMapFromEnablement(enablement, pool),
		}).map(t => t.name);
		assert.deepStrictEqual(
			{
				// Only two tools explicitly false → selection empty → ENSURED re-adds the rest including edits.
				hasEdit: selected.includes(SAFEAPPEALS_EDIT_FILE_TOOL),
				hasReplace: selected.includes(SAFEAPPEALS_REPLACE_STRING_TOOL),
				hasSwitch: selected.includes(SAFEAPPEALS_SWITCH_MODE_TOOL),
			},
			{
				hasEdit: false, // explicitly disabled — ENSURED respects false
				hasReplace: true, // NOT in the false map → ENSURED force-adds (the leak)
				hasSwitch: true,
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

	test('private search protocol includes RAG-first cite and scope rules', () => {
		const protocol = buildPrivateSearchAgentProtocolMessage();
		assert.deepStrictEqual(
			{
				hasHeader: protocol.includes('Private Search protocol'),
				ragFirst: protocol.includes('before** web search'),
				getStats: protocol.includes('safeappeals_rag_get_stats'),
				searchReference: protocol.includes('safeappeals_rag_search_reference'),
				searchWorkspace: protocol.includes('safeappeals_rag_search_workspace'),
				searchAll: protocol.includes('safeappeals_rag_search_all'),
				citeHeaders: protocol.includes('[n]'),
				noInvent: protocol.includes('never invent'),
				webSupplement: protocol.includes('supplement'),
				indexPrimary: protocol.includes('primary workbench'),
				indexDocument: protocol.includes('safeappeals_rag_index_document'),
				pdfIndexBeforeSearch: protocol.includes('before** relying on search alone'),
				bornDigitalPdf: protocol.includes('Born-digital PDFs index via sa-converter'),
				scannedHardDisable: protocol.includes('scanned-ocr-ineligible'),
				scannedUnpinned: protocol.includes('scanned-ocr-unpinned'),
				scannedNotInstalled: protocol.includes('scanned-ocr-not-installed'),
				scannedSidecar: protocol.includes('scanned-ocr-sidecar-not-ready'),
				noInventPdf: protocol.includes('never invent PDF text'),
			},
			{
				hasHeader: true,
				ragFirst: true,
				getStats: true,
				searchReference: true,
				searchWorkspace: true,
				searchAll: true,
				citeHeaders: true,
				noInvent: true,
				webSupplement: true,
				indexPrimary: true,
				indexDocument: true,
				pdfIndexBeforeSearch: true,
				bornDigitalPdf: true,
				scannedHardDisable: true,
				scannedUnpinned: true,
				scannedNotInstalled: true,
				scannedSidecar: true,
				noInventPdf: true,
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

suite('WP5 nesting + Private Search composition', () => {
	const packageJson = JSON.parse(
		fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'),
	) as {
		contributes: {
			chatParticipants: Array<{ id: string; isDefault?: boolean }>;
			configurationDefaults?: Record<string, unknown>;
		};
	};

	test('default agent identity is safeappeals.agent (isDefault) → runAgentLoop participant', () => {
		const participant = packageJson.contributes.chatParticipants.find(p => p.id === 'safeappeals.agent');
		assert.deepStrictEqual(
			{
				contribId: participant?.id,
				isDefault: participant?.isDefault === true,
				// Nested invoke uses getDefaultAgent → this participant → runAgentLoop.
				runSubagentNotEnsured: ENSURED_AGENT_TOOL_NAMES.includes('runSubagent'),
			},
			{
				contribId: 'safeappeals.agent',
				isDefault: true,
				runSubagentNotEnsured: false,
			},
		);
	});

	test('nesting default is false (product + auth configurationDefaults)', () => {
		assert.deepStrictEqual(
			{
				authDefault: packageJson.contributes.configurationDefaults?.['chat.subagents.allowInvocationsFromSubagents'],
				// Explicit false from nested child enablement is honored (not ENSURED).
				selectKeepsOut: selectAgentTools({
					pool: [
						{ name: SAFEAPPEALS_READ_FILE_TOOL, description: 'read' },
						{ name: 'runSubagent', description: 'nest' },
					],
					requestTools: requestToolsMapFromEnablement(
						{ [SAFEAPPEALS_READ_FILE_TOOL]: true, runSubagent: false },
						[
							{ name: SAFEAPPEALS_READ_FILE_TOOL, description: 'read' },
							{ name: 'runSubagent', description: 'nest' },
						],
					),
				}).map(t => t.name).includes('runSubagent'),
			},
			{
				authDefault: false,
				selectKeepsOut: false,
			},
		);
	});

	test('child seeded deny map: runSubagent out; Private Search RAG search tools in', () => {
		const seedEnabled = [
			SAFEAPPEALS_READ_FILE_TOOL,
			SAFEAPPEALS_LIST_DIR_TOOL,
			SAFEAPPEALS_RAG_GET_STATS_TOOL,
			SAFEAPPEALS_RAG_SEARCH_REFERENCE_TOOL,
			SAFEAPPEALS_RAG_SEARCH_WORKSPACE_TOOL,
			SAFEAPPEALS_RAG_SEARCH_ALL_TOOL,
		] as const;
		const enablement: Record<string, boolean> = { runSubagent: false };
		for (const id of seedEnabled) {
			enablement[id] = true;
		}
		for (const id of ENSURED_AGENT_TOOL_NAMES) {
			if (!(id in enablement)) {
				enablement[id] = false;
			}
		}

		const pool = [
			...new Set([...ENSURED_AGENT_TOOL_NAMES, ...CORE_AGENT_TOOL_NAMES, 'runSubagent', ...seedEnabled]),
		].map(name => ({ name, description: name }));

		const selected = selectAgentTools({
			pool,
			requestTools: requestToolsMapFromEnablement(enablement, pool),
			modeName: 'Agent',
		}).map(t => t.name);

		assert.deepStrictEqual(
			{
				runSubagent: selected.includes('runSubagent'),
				ragStats: selected.includes(SAFEAPPEALS_RAG_GET_STATS_TOOL),
				ragRef: selected.includes(SAFEAPPEALS_RAG_SEARCH_REFERENCE_TOOL),
				ragWs: selected.includes(SAFEAPPEALS_RAG_SEARCH_WORKSPACE_TOOL),
				ragAll: selected.includes(SAFEAPPEALS_RAG_SEARCH_ALL_TOOL),
				ragIndex: selected.includes(SAFEAPPEALS_RAG_INDEX_DOCUMENT_TOOL),
				editLeaked: selected.includes(SAFEAPPEALS_EDIT_FILE_TOOL),
			},
			{
				runSubagent: false,
				ragStats: true,
				ragRef: true,
				ragWs: true,
				ragAll: true,
				ragIndex: false,
				editLeaked: false,
			},
		);
	});

	test('parent empty picker: runSubagent available when in pool (never ENSURED)', () => {
		const selected = selectAgentTools({
			pool: [
				{ name: SAFEAPPEALS_READ_FILE_TOOL, description: 'read' },
				{ name: 'runSubagent', description: 'Run Subagent' },
			],
			requestTools: new Map(),
		}).map(t => t.name);
		assert.deepStrictEqual(
			{
				runSubagent: selected.includes('runSubagent'),
				inEnsured: ENSURED_AGENT_TOOL_NAMES.includes('runSubagent'),
			},
			{
				runSubagent: true,
				inEnsured: false,
			},
		);
	});

	test('nested-shaped Agent turn still injects Private Search protocol prefix', () => {
		const prefix = buildAgentLoopPrefixMessages({
			modeName: 'Agent',
			modeContent: 'Nested research subagent.',
		});
		const joined = prefix.join('\n');
		assert.deepStrictEqual(
			{
				messageCount: prefix.length,
				hasPrivateSearch: joined.includes('Private Search protocol'),
				hasRagSearchRef: joined.includes('safeappeals_rag_search_reference'),
				hasModeReminder: joined.includes('currently running in "Agent" mode'),
				// Same builder the loop uses — nested re-entry has no alternate path.
				matchesStandalone: prefix.includes(buildPrivateSearchAgentProtocolMessage()),
			},
			{
				messageCount: 3,
				hasPrivateSearch: true,
				hasRagSearchRef: true,
				hasModeReminder: true,
				matchesStandalone: true,
			},
		);
	});

	test('Copilot *_subagent tools stay denied on SafeAppeals allowlist', () => {
		assert.deepStrictEqual(
			{
				explore: isAgentToolAllowed('explore_subagent'),
				execution: isAgentToolAllowed('execution_subagent'),
				search: isAgentToolAllowed('search_subagent'),
				runSubagent: isAgentToolAllowed('runSubagent'),
			},
			{
				explore: false,
				execution: false,
				search: false,
				runSubagent: true,
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
