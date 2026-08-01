/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { MAX_AGENT_ITERATIONS, nextAgentLoopDecision } from '../chat/agentLoopHelpers';
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
	SAFEAPPEALS_LIST_DIR_TOOL,
	SAFEAPPEALS_READ_FILE_TOOL,
	selectAgentTools,
	VSCODE_EDIT_FILE_TOOL,
	VSCODE_EDIT_FILE_TOOL_ALIAS,
} from '../chat/toolAllowlist';

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
				maxIterations: 25,
				toolCallCount: 0,
				cancelled: false,
			}),
			{ kind: 'stop', reason: 'done' },
		);
		assert.deepStrictEqual(
			nextAgentLoopDecision({
				iteration: 25,
				maxIterations: 25,
				toolCallCount: 1,
				cancelled: false,
			}),
			{ kind: 'stop', reason: 'maxIterations' },
		);
		assert.deepStrictEqual(
			nextAgentLoopDecision({
				iteration: 1,
				maxIterations: 25,
				toolCallCount: 1,
				cancelled: true,
			}),
			{ kind: 'stop', reason: 'cancelled' },
		);
	});
});

suite('agent tool allowlist', () => {
	test('allows core MVP tools and safeappeals_*; blocks copilot_*', () => {
		assert.deepStrictEqual(
			{
				core: CORE_AGENT_TOOL_NAMES.every(isAgentToolAllowed),
				editInternal: isAgentToolAllowed(VSCODE_EDIT_FILE_TOOL),
				editAlias: isAgentToolAllowed(VSCODE_EDIT_FILE_TOOL_ALIAS),
				read: isAgentToolAllowed(SAFEAPPEALS_READ_FILE_TOOL),
				list: isAgentToolAllowed(SAFEAPPEALS_LIST_DIR_TOOL),
				copilot: isAgentToolAllowed('copilot_readFile'),
				random: isAgentToolAllowed('random_tool'),
			},
			{
				core: true,
				editInternal: true,
				editAlias: false,
				read: true,
				list: true,
				copilot: false,
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
				{ name: VSCODE_EDIT_FILE_TOOL },
				{ name: VSCODE_EDIT_FILE_TOOL_ALIAS },
				{ name: 'other' },
			]).map(t => t.name),
			['run_in_terminal', SAFEAPPEALS_READ_FILE_TOOL, VSCODE_EDIT_FILE_TOOL],
		);
	});

	test('maps copilot picker tools to safeappeals / internal edit ids', () => {
		assert.deepStrictEqual(
			{
				read: resolveAgentToolName('copilot_readFile'),
				list: resolveAgentToolName('copilot_listDirectory'),
				edit: resolveAgentToolName('copilot_insertEdit'),
				legacyEdit: resolveAgentToolName(VSCODE_EDIT_FILE_TOOL_ALIAS),
				blocked: resolveAgentToolName('copilot_searchCodebase'),
				passThrough: resolveAgentToolName(SAFEAPPEALS_READ_FILE_TOOL),
			},
			{
				read: SAFEAPPEALS_READ_FILE_TOOL,
				list: SAFEAPPEALS_LIST_DIR_TOOL,
				edit: VSCODE_EDIT_FILE_TOOL,
				legacyEdit: VSCODE_EDIT_FILE_TOOL,
				blocked: undefined,
				passThrough: SAFEAPPEALS_READ_FILE_TOOL,
			},
		);
	});

	test('resolveAllowedInvokeToolName gates unmapped and non-selected tools', () => {
		const selected = new Set([SAFEAPPEALS_READ_FILE_TOOL, VSCODE_EDIT_FILE_TOOL]);
		assert.deepStrictEqual(
			{
				mappedRead: resolveAllowedInvokeToolName('copilot_readFile', selected),
				legacyEdit: resolveAllowedInvokeToolName(VSCODE_EDIT_FILE_TOOL_ALIAS, selected),
				unmappedCopilot: resolveAllowedInvokeToolName('copilot_searchCodebase', selected),
				notSelected: resolveAllowedInvokeToolName('run_in_terminal', selected),
				selected: resolveAllowedInvokeToolName(SAFEAPPEALS_READ_FILE_TOOL, selected),
				syntheticSelected: resolveAllowedInvokeToolName(
					SAFEAPPEALS_READ_FILE_TOOL,
					new Set([SAFEAPPEALS_READ_FILE_TOOL]),
				),
			},
			{
				mappedRead: SAFEAPPEALS_READ_FILE_TOOL,
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
	];

	test('maps enabled request.tools to safeappeals / host tools; never passes raw copilot_*', () => {
		const requestTools = new Map([
			[pool[0], true], // copilot_readFile
			[pool[1], true], // copilot_listDirectory
			[pool[2], true], // copilot_insertEdit
			[pool[3], true], // copilot_searchCodebase — blocked
			[pool[9], true], // other_tool — blocked
		]);
		const selected = selectAgentTools({ pool, requestTools }).map(t => t.name).sort();
		assert.deepStrictEqual(selected, [
			SAFEAPPEALS_LIST_DIR_TOOL,
			SAFEAPPEALS_READ_FILE_TOOL,
			VSCODE_EDIT_FILE_TOOL,
		].sort());
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
				names: [SAFEAPPEALS_LIST_DIR_TOOL, SAFEAPPEALS_READ_FILE_TOOL].sort(),
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

	test('empty pool with no requestTools still returns ensured synthetic read/list', () => {
		const selected = selectAgentTools({ pool: [] });
		assert.deepStrictEqual(
			selected.map(t => t.name).sort(),
			[...ENSURED_AGENT_TOOL_NAMES].sort(),
		);
		assert.deepStrictEqual(
			selected.find(t => t.name === SAFEAPPEALS_READ_FILE_TOOL),
			ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_READ_FILE_TOOL],
		);
	});

	test('empty picker still gets MVP tools if registered in pool', () => {
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
		const requestTools = new Map([
			[pool[0], false], // copilot_readFile → safeappeals_readFile
			[pool[1], false], // copilot_listDirectory → safeappeals_listDir
			[pool[6], true], // edit
		]);
		assert.deepStrictEqual(
			selectAgentTools({ pool, requestTools }).map(t => t.name),
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
			[SAFEAPPEALS_LIST_DIR_TOOL, SAFEAPPEALS_READ_FILE_TOOL, VSCODE_EDIT_FILE_TOOL].sort(),
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
