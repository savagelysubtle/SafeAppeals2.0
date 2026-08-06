/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	executeCreatePlan,
	resetCreatePlanSessionStateForTests,
	resolveExistingPlanUri,
} from '../chat/createPlanTool';
import { parsePlanMarkdown } from '../chat/planMd';
import { SAFEAPPEALS_PLANS_DIR } from '../chat/planPaths';
import {
	ENSURED_AGENT_TOOL_DESCRIPTORS,
	ENSURED_AGENT_TOOL_NAMES,
	SAFEAPPEALS_CREATE_PLAN_TOOL,
} from '../chat/toolAllowlist';

ensureVscodeUriHelpers();

suite('createPlanTool', () => {
	let workspaceRoot: string;
	let workspaceUri: vscode.Uri;

	suiteSetup(async () => {
		workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-create-plan-'));
		workspaceUri = vscode.Uri.file(workspaceRoot);
	});

	suiteTeardown(async () => {
		await fs.rm(workspaceRoot, { recursive: true, force: true });
	});

	setup(() => {
		resetCreatePlanSessionStateForTests();
	});

	test('exports tool id and descriptor; not force-ensured', () => {
		assert.deepStrictEqual(
			{
				id: SAFEAPPEALS_CREATE_PLAN_TOOL,
				descriptorName: ENSURED_AGENT_TOOL_DESCRIPTORS[SAFEAPPEALS_CREATE_PLAN_TOOL]?.name,
				ensured: ENSURED_AGENT_TOOL_NAMES.includes(SAFEAPPEALS_CREATE_PLAN_TOOL),
			},
			{
				id: 'safeappeals_createPlan',
				descriptorName: 'safeappeals_createPlan',
				ensured: false,
			},
		);
	});

	test('errors when no workspace folder is open', async () => {
		const message = await executeCreatePlan(
			{ name: 'X', overview: 'Y', plan: '# Body' },
			{ workspaceFolder: undefined, sessionKey: 's1' },
		);
		assert.ok(message.includes('open workspace folder'));
	});

	test('creates a plan under .safeAppeals/plans with frontmatter and sticky session', async () => {
		const message = await executeCreatePlan(
			{
				name: 'Wire Create Plan',
				overview: 'Persist a Cursor-style plan file.',
				plan: '# Steps\n\n1. Register the tool\n',
				todos: [{ id: 'register', content: 'Register LM tool', status: 'pending' }],
				isProject: false,
			},
			{ workspaceFolder: workspaceUri, sessionKey: 'session-a' },
		);

		assert.ok(message.startsWith('Created plan "Wire Create Plan"'));
		assert.ok(message.includes('call reviewPlan'));
		assert.ok(!message.toLowerCase().includes('invoking reviewplan'));

		const plansDir = path.join(workspaceRoot, SAFEAPPEALS_PLANS_DIR);
		const entries = await fs.readdir(plansDir);
		assert.strictEqual(entries.length, 1);
		assert.ok(/^wire_create_plan_[0-9a-f]{8}\.plan\.md$/.test(entries[0]!));

		const filePath = path.join(plansDir, entries[0]!);
		const text = await fs.readFile(filePath, 'utf8');
		const parsed = parsePlanMarkdown(text);
		assert.deepStrictEqual(
			{
				name: parsed.frontmatter.name,
				overview: parsed.frontmatter.overview,
				isProject: parsed.frontmatter.isProject,
				todos: parsed.frontmatter.todos,
				bodyStarts: parsed.body.startsWith('# Steps'),
			},
			{
				name: 'Wire Create Plan',
				overview: 'Persist a Cursor-style plan file.',
				isProject: false,
				todos: [{ id: 'register', content: 'Register LM tool', status: 'pending' }],
				bodyStarts: true,
			},
		);

		if (process.platform !== 'win32') {
			const dirStat = await fs.stat(plansDir);
			const fileStat = await fs.stat(filePath);
			assert.strictEqual(dirStat.mode & 0o777, 0o700);
			assert.strictEqual(fileStat.mode & 0o777, 0o600);
		}

		const updateMessage = await executeCreatePlan(
			{ oldStr: 'Register the tool', newStr: 'Register and test the tool' },
			{ workspaceFolder: workspaceUri, sessionKey: 'session-a' },
		);
		assert.ok(updateMessage.startsWith('Updated plan "Wire Create Plan"'));
		const updated = await fs.readFile(filePath, 'utf8');
		assert.ok(updated.includes('Register and test the tool'));
		assert.ok(!updated.includes('Register the tool\n'));
	});

	test('sticky session full-body revision updates same path (no orphan)', async () => {
		const createMessage = await executeCreatePlan(
			{
				name: 'Sticky Revise',
				overview: 'First draft overview',
				plan: '# Draft\n\nOriginal body\n',
			},
			{ workspaceFolder: workspaceUri, sessionKey: 'session-sticky' },
		);
		assert.ok(createMessage.startsWith('Created plan "Sticky Revise"'));
		const createdFsPath = createMessage.match(/\(([^)]+\.plan\.md)\)/)?.[1];
		assert.ok(createdFsPath);

		const updateMessage = await executeCreatePlan(
			{
				name: 'Sticky Revise',
				overview: 'Revised overview',
				plan: '# Revised\n\nUpdated body\n',
				todos: [{ id: 'rev', content: 'Apply sticky update', status: 'in_progress' }],
			},
			{ workspaceFolder: workspaceUri, sessionKey: 'session-sticky' },
		);
		assert.ok(updateMessage.startsWith('Updated plan "Sticky Revise"'));
		const updatedFsPath = updateMessage.match(/\(([^)]+\.plan\.md)\)/)?.[1];
		assert.strictEqual(updatedFsPath, createdFsPath);

		const plansDir = path.join(workspaceRoot, SAFEAPPEALS_PLANS_DIR);
		const stickyFiles = (await fs.readdir(plansDir)).filter(name =>
			name.startsWith('sticky_revise_'),
		);
		assert.strictEqual(stickyFiles.length, 1);

		const parsed = parsePlanMarkdown(await fs.readFile(createdFsPath!, 'utf8'));
		assert.deepStrictEqual(
			{
				overview: parsed.frontmatter.overview,
				todos: parsed.frontmatter.todos,
				body: parsed.body.trim(),
			},
			{
				overview: 'Revised overview',
				todos: [{ id: 'rev', content: 'Apply sticky update', status: 'in_progress' }],
				body: '# Revised\n\nUpdated body',
			},
		);

		// Without sticky (new session), the same create fields write a distinct file.
		const secondCreate = await executeCreatePlan(
			{
				name: 'Sticky Revise',
				overview: 'Another draft',
				plan: '# Other\n',
			},
			{ workspaceFolder: workspaceUri, sessionKey: 'session-fresh' },
		);
		assert.ok(secondCreate.startsWith('Created plan "Sticky Revise"'));
		const secondPath = secondCreate.match(/\(([^)]+\.plan\.md)\)/)?.[1];
		assert.ok(secondPath);
		assert.notStrictEqual(secondPath, createdFsPath);
	});

	test('update via planPath replaces full body and optional frontmatter', async () => {
		const createMessage = await executeCreatePlan(
			{
				name: 'Path Update',
				overview: 'Original overview',
				plan: '# Original\n',
			},
			{ workspaceFolder: workspaceUri, sessionKey: 'session-b' },
		);
		const uriMatch = createMessage.match(/at (file:[^\s]+) \(/);
		assert.ok(uriMatch?.[1]);
		const planPath = uriMatch![1]!;

		const updateMessage = await executeCreatePlan(
			{
				planPath,
				name: 'Path Update Renamed',
				overview: 'Revised overview',
				plan: '# Revised\n\nDone.\n',
				todos: [{ id: 't1', content: 'Finish slice B', status: 'completed' }],
				isProject: true,
			},
			{ workspaceFolder: workspaceUri, sessionKey: 'other-session' },
		);
		assert.ok(updateMessage.startsWith('Updated plan "Path Update Renamed"'));

		const fsPathMatch = createMessage.match(/\(([^)]+\.plan\.md)\)/);
		assert.ok(fsPathMatch?.[1]);
		const parsed = parsePlanMarkdown(await fs.readFile(fsPathMatch![1]!, 'utf8'));
		assert.deepStrictEqual(
			{
				name: parsed.frontmatter.name,
				overview: parsed.frontmatter.overview,
				isProject: parsed.frontmatter.isProject,
				todos: parsed.frontmatter.todos,
				body: parsed.body.trim(),
			},
			{
				name: 'Path Update Renamed',
				overview: 'Revised overview',
				isProject: true,
				todos: [{ id: 't1', content: 'Finish slice B', status: 'completed' }],
				body: '# Revised\n\nDone.',
			},
		);
	});

	test('resolveExistingPlanUri rejects paths outside .safeAppeals/plans', () => {
		const inside = resolveExistingPlanUri(
			path.join(SAFEAPPEALS_PLANS_DIR, 'demo_aabbccdd.plan.md'),
			workspaceUri,
		);
		assert.ok(inside);
		assert.ok(inside!.fsPath.includes(SAFEAPPEALS_PLANS_DIR));

		assert.strictEqual(
			resolveExistingPlanUri('../secrets.txt', workspaceUri),
			undefined,
		);
		assert.strictEqual(
			resolveExistingPlanUri(path.join(SAFEAPPEALS_PLANS_DIR, 'not-a-plan.md'), workspaceUri),
			undefined,
		);
	});

	test('update without planPath or sticky session fails clearly', async () => {
		const message = await executeCreatePlan(
			{ plan: '# Orphan update\n' },
			{ workspaceFolder: workspaceUri, sessionKey: 'no-sticky' },
		);
		assert.ok(message.includes('planPath') || message.includes('prior plan'));
	});
});

/**
 * The auth extension's mocha vscode mock is minimal; ensure Uri.file/joinPath/parse exist.
 */
function ensureVscodeUriHelpers(): void {
	const uriApi = vscode.Uri as {
		file?: (fsPath: string) => vscode.Uri;
		joinPath?: (base: vscode.Uri, ...pathSegments: string[]) => vscode.Uri;
		parse?: (value: string) => vscode.Uri;
	};

	if (typeof uriApi.file !== 'function') {
		uriApi.file = (fsPath: string): vscode.Uri =>
			({
				scheme: 'file',
				fsPath,
				path: fsPath,
				toString: () => `file://${fsPath}`,
			}) as vscode.Uri;
	}

	if (typeof uriApi.joinPath !== 'function') {
		uriApi.joinPath = (base: vscode.Uri, ...pathSegments: string[]): vscode.Uri => {
			const fsPath = path.resolve(base.fsPath, ...pathSegments);
			return uriApi.file!(fsPath);
		};
	}

	// Always override the minimal preload parse stub (it returns only toString).
	uriApi.parse = (value: string): vscode.Uri => {
		if (value.startsWith('file://')) {
			const fsPath = decodeURIComponent(value.slice('file://'.length));
			return uriApi.file!(fsPath);
		}
		return {
			scheme: 'unknown',
			fsPath: value,
			path: value,
			toString: () => value,
		} as vscode.Uri;
	};
}
