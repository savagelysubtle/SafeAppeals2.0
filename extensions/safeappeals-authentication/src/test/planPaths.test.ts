/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import {
	SAFEAPPEALS_PLANS_DIR,
	buildPlanFileName,
	resolvePlanFileUri,
	resolvePlansDirectory,
	slugifyPlanName,
} from '../chat/planPaths';

ensureVscodeUriHelpers();

suite('planPaths', () => {
	test('SAFEAPPEALS_PLANS_DIR is the workspace plans folder', () => {
		assert.strictEqual(SAFEAPPEALS_PLANS_DIR, '.safeAppeals/plans');
	});

	test('slugifyPlanName lowercases, replaces non-alnum, and collapses underscores', () => {
		assert.deepStrictEqual(
			{
				basic: slugifyPlanName('Cursor Plan Mode'),
				punct: slugifyPlanName('RAG / Agent Trust!'),
				collapse: slugifyPlanName('  Hello---World__  '),
				empty: slugifyPlanName('!!!'),
				trimEdges: slugifyPlanName('_Leading and Trailing_'),
			},
			{
				basic: 'cursor_plan_mode',
				punct: 'rag_agent_trust',
				collapse: 'hello_world',
				empty: 'plan',
				trimEdges: 'leading_and_trailing',
			},
		);
	});

	test('buildPlanFileName joins slug and hash with .plan.md', () => {
		assert.strictEqual(
			buildPlanFileName('Create Plan Helpers', 'a1b2c3d4'),
			'create_plan_helpers_a1b2c3d4.plan.md',
		);
	});

	test('resolvePlansDirectory joins workspace folder with SAFEAPPEALS_PLANS_DIR', () => {
		const workspace = vscode.Uri.file('/work/project');
		const dir = resolvePlansDirectory(workspace);
		assert.deepStrictEqual(
			{
				fsPath: dir.fsPath,
				expected: path.join('/work/project', SAFEAPPEALS_PLANS_DIR),
			},
			{
				fsPath: path.join('/work/project', SAFEAPPEALS_PLANS_DIR),
				expected: path.join('/work/project', SAFEAPPEALS_PLANS_DIR),
			},
		);
	});

	test('resolvePlanFileUri builds a confined plan path under the workspace', () => {
		const workspace = vscode.Uri.file('/work/project');
		const uri = resolvePlanFileUri(workspace, 'My Plan', 'deadbeef');
		assert.strictEqual(
			uri.fsPath,
			path.join('/work/project', SAFEAPPEALS_PLANS_DIR, 'my_plan_deadbeef.plan.md'),
		);
	});

	test('resolve helpers reject paths that escape the workspace root', () => {
		const workspace = {
			scheme: 'file',
			fsPath: '/work/project',
			path: '/work/project',
			toString: () => 'file:///work/project',
		} as vscode.Uri;

		const originalJoinPath = vscode.Uri.joinPath;
		(vscode.Uri as { joinPath: typeof vscode.Uri.joinPath }).joinPath = () =>
			vscode.Uri.file('/etc/passwd');

		try {
			assert.throws(
				() => resolvePlansDirectory(workspace),
				(error: unknown) =>
					error instanceof Error && error.message.includes('escapes workspace root'),
			);
			assert.throws(
				() => resolvePlanFileUri(workspace, 'x', '12345678'),
				(error: unknown) =>
					error instanceof Error && error.message.includes('escapes workspace root'),
			);
		} finally {
			(vscode.Uri as { joinPath: typeof vscode.Uri.joinPath }).joinPath = originalJoinPath;
		}
	});
});

/**
 * The auth extension's mocha vscode mock is minimal; ensure Uri.file/joinPath exist
 * so resolve* helpers can be unit-tested without the full VS Code runtime.
 */
function ensureVscodeUriHelpers(): void {
	const uriApi = vscode.Uri as {
		file?: (fsPath: string) => vscode.Uri;
		joinPath?: (base: vscode.Uri, ...pathSegments: string[]) => vscode.Uri;
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
}
