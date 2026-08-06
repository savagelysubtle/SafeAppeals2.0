/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
	EXPLORE_MORE_TUTORIALS_WALKTHROUGH,
	SAMPLE_CASE_TOUR_CORE_COMMAND,
	SAMPLE_CASE_TOUR_FALLBACK_STEP_COUNT,
	takeTour,
} from '../tour';

suite('tour', () => {
	test('walkthrough tour.md describes eight steps and excludes AI/credits/install', () => {
		const tourMdPath = path.join(__dirname, '..', '..', 'media', 'walkthrough', 'tour.md');
		const content = fs.readFileSync(tourMdPath, 'utf8');
		assert.ok(content.includes('eight parts'));
		assert.ok(content.includes('AGENTS.md'));
		assert.ok(content.includes('core_references'));
		assert.ok(content.includes('Private Search'));
		assert.ok(content.includes('does **not** run the AI, spend credits, or install Private Search models'));
	});

	test('takeTour does not open walkthrough when core command succeeds', async () => {
		const originalExecuteCommand = vscode.commands.executeCommand;
		let coreCount = 0;
		let walkthroughCount = 0;
		vscode.commands.executeCommand = (async (command: string) => {
			if (command === SAMPLE_CASE_TOUR_CORE_COMMAND) {
				coreCount += 1;
				return undefined;
			}
			if (command === 'workbench.action.openWalkthrough') {
				walkthroughCount += 1;
			}
			return undefined;
		}) as typeof vscode.commands.executeCommand;

		try {
			await takeTour();
			assert.deepStrictEqual({ coreCount, walkthroughCount }, { coreCount: 1, walkthroughCount: 0 });
		} finally {
			vscode.commands.executeCommand = originalExecuteCommand;
		}
	});

	test('takeTour fallback opens Explore More once when core command throws', async () => {
		const originalExecuteCommand = vscode.commands.executeCommand;
		const originalShowInformationMessage = vscode.window.showInformationMessage;
		let walkthroughCount = 0;
		let walkthroughArg: unknown;
		let messageCount = 0;
		let closeActiveEditorCount = 0;
		vscode.commands.executeCommand = (async (command: string, arg?: unknown) => {
			if (command === SAMPLE_CASE_TOUR_CORE_COMMAND) {
				throw new Error('core command unavailable');
			}
			if (command === 'workbench.action.closeActiveEditor') {
				closeActiveEditorCount += 1;
				return undefined;
			}
			if (command === 'workbench.action.openWalkthrough') {
				walkthroughCount += 1;
				walkthroughArg = arg;
			}
			return undefined;
		}) as typeof vscode.commands.executeCommand;
		vscode.window.showInformationMessage = (async (_message: string, ...rest: unknown[]) => {
			messageCount += 1;
			const labels = rest.filter((item): item is string => typeof item === 'string');
			return labels[0];
		}) as unknown as typeof vscode.window.showInformationMessage;

		try {
			await takeTour();
			assert.deepStrictEqual({
				closeActiveEditorCount,
				messageCount,
				walkthroughCount,
				walkthroughArg,
			}, {
				closeActiveEditorCount: 1,
				messageCount: SAMPLE_CASE_TOUR_FALLBACK_STEP_COUNT,
				walkthroughCount: 1,
				walkthroughArg: EXPLORE_MORE_TUTORIALS_WALKTHROUGH,
			});
		} finally {
			vscode.commands.executeCommand = originalExecuteCommand;
			vscode.window.showInformationMessage = originalShowInformationMessage;
		}
	});
});
