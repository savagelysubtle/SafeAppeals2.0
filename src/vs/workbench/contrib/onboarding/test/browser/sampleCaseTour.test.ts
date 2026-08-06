/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { $ } from '../../../../../base/browser/dom.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IWorkbenchLayoutService } from '../../../../services/layout/browser/layoutService.js';
import { OnboardingOutcome } from '../../common/onboardingScenario.js';
import { IOnboardingScenarioService } from '../../common/onboardingScenarioService.js';
import {
	createSampleCaseTourScenario,
	EXPLORE_MORE_TUTORIALS_WALKTHROUGH,
	PRIVATE_SEARCH_TARGET_RESOLVE_TIMEOUT_MS,
	runSampleCaseTourCommand,
	SAMPLE_CASE_TOUR_STEP_COUNT,
	showApprovalPromptMock,
} from '../../browser/sampleCaseTour.js';
import { PRIVATE_SEARCH_STATUS_BAR_DOM_ID } from '../../browser/sampleCaseTourTargets.js';

class FakeLayoutService implements Pick<IWorkbenchLayoutService, '_serviceBrand' | 'getContainer'> {
	declare readonly _serviceBrand: undefined;
	constructor(private readonly container: HTMLElement) { }
	getContainer(_targetWindow: Window): HTMLElement {
		return this.container;
	}
}

suite('SampleCaseTour', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('createSampleCaseTourScenario defines eight spotlight steps', () => {
		const commandService = {
			executeCommand: async () => { },
		} as unknown as ICommandService;
		const contextService = {
			getWorkspace: () => ({ folders: [] }),
		} as unknown as IWorkspaceContextService;
		const scenario = createSampleCaseTourScenario(commandService, contextService, {
			show: () => ({ dispose: () => { } }),
		});
		const payload = scenario.presentation.payload as { steps: readonly { id: string; targetResolveTimeoutMs?: number }[] };
		assert.strictEqual(payload.steps.length, SAMPLE_CASE_TOUR_STEP_COUNT);
		const privateSearchStep = payload.steps.find(step => step.id === 'privateSearch');
		assert.ok(privateSearchStep);
		assert.strictEqual(privateSearchStep!.targetResolveTimeoutMs, PRIVATE_SEARCH_TARGET_RESOLVE_TIMEOUT_MS);
	});

	test('Private Search status bar DOM id matches safeappeals-rag pinned item id', () => {
		assert.strictEqual(PRIVATE_SEARCH_STATUS_BAR_DOM_ID, 'safeappeals.safeappeals-rag.privateSearch');
	});

	test('showApprovalPromptMock mounts under layout container, not document.body', () => {
		const workbenchContainer = $('div.test-workbench-container');
		mainWindow.document.body.appendChild(workbenchContainer);
		disposables.add({ dispose: () => workbenchContainer.remove() });

		const layoutService = new FakeLayoutService(workbenchContainer) as IWorkbenchLayoutService;
		disposables.add(showApprovalPromptMock(layoutService));

		const host = workbenchContainer.querySelector('.safeappeals-approval-mock-host');
		assert.ok(host);
		assert.strictEqual(host.parentElement, workbenchContainer);
		assert.ok(!Array.from(mainWindow.document.body.children).some(
			child => child.classList.contains('safeappeals-approval-mock-host'),
		));
	});

	test('runSampleCaseTourCommand opens Explore More only when Completed', async () => {
		const walkthroughCalls: unknown[] = [];
		const commandService = {
			executeCommand: async (id: string, arg?: unknown) => {
				if (id === 'workbench.action.openWalkthrough') {
					walkthroughCalls.push(arg);
				}
			},
		} as unknown as ICommandService;
		const editorService = {
			getEditors: () => [],
			closeEditors: async () => { },
		} as unknown as IEditorService;

		for (const { outcome, expectedCalls } of [
			{ outcome: OnboardingOutcome.Completed, expectedCalls: 1 },
			{ outcome: OnboardingOutcome.Skipped, expectedCalls: 0 },
			{ outcome: OnboardingOutcome.Aborted, expectedCalls: 0 },
		]) {
			walkthroughCalls.length = 0;
			const onboarding = {
				runScenario: async () => outcome,
			} as unknown as IOnboardingScenarioService;

			await runSampleCaseTourCommand(onboarding, editorService, commandService);

			assert.strictEqual(walkthroughCalls.length, expectedCalls, outcome);
			if (expectedCalls > 0) {
				assert.deepStrictEqual(walkthroughCalls[0], EXPLORE_MORE_TUTORIALS_WALKTHROUGH);
			}
		}
	});

	test('runSampleCaseTourCommand does not open Explore More when runScenario throws', async () => {
		const walkthroughCalls: unknown[] = [];
		const commandService = {
			executeCommand: async (id: string, arg?: unknown) => {
				if (id === 'workbench.action.openWalkthrough') {
					walkthroughCalls.push(arg);
				}
			},
		} as unknown as ICommandService;
		const editorService = {
			getEditors: () => [],
			closeEditors: async () => { },
		} as unknown as IEditorService;
		const onboarding = {
			runScenario: async () => {
				throw new Error('runScenario failed');
			},
		} as unknown as IOnboardingScenarioService;

		await assert.rejects(
			() => runSampleCaseTourCommand(onboarding, editorService, commandService),
			/runScenario failed/,
		);
		assert.deepStrictEqual(walkthroughCalls, []);
	});
});
