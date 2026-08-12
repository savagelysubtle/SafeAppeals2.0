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
	OPEN_BROWSER_PALETTE_FILTER,
	PRIVATE_SEARCH_TARGET_RESOLVE_TIMEOUT_MS,
	runSampleCaseTourCommand,
	SAMPLE_CASE_TOUR_STEP_COUNT,
	showApprovalPromptMock,
	showCommandPaletteMock,
} from '../../browser/sampleCaseTour.js';
import { PRIVATE_SEARCH_STATUS_BAR_DOM_ID } from '../../browser/sampleCaseTourTargets.js';

class FakeLayoutService implements Pick<IWorkbenchLayoutService, 'getContainer'> {
	constructor(private readonly container: HTMLElement) { }
	getContainer(_targetWindow: Window): HTMLElement {
		return this.container;
	}
}

function createFakeEditorService(overrides?: {
	getEditors?: () => unknown[];
	openEditor?: (...args: unknown[]) => Promise<unknown>;
}): IEditorService {
	return {
		getEditors: overrides?.getEditors ?? (() => []),
		closeEditors: async () => { },
		openEditor: overrides?.openEditor ?? (async (input: unknown) => ({ input })),
	} as unknown as IEditorService;
}

function createMockHost() {
	return {
		showApproval: () => ({ dispose: () => { } }),
		showCommandPalette: () => ({ dispose: () => { } }),
	};
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
		const scenario = createSampleCaseTourScenario(
			commandService,
			contextService,
			createMockHost(),
		);
		const payload = scenario.presentation.payload as {
			steps: readonly {
				id: string;
				targetResolveTimeoutMs?: number;
				onBeforeShow?: () => void | Promise<void>;
			}[];
		};
		assert.strictEqual(payload.steps.length, SAMPLE_CASE_TOUR_STEP_COUNT);
		const privateSearchStep = payload.steps.find(step => step.id === 'privateSearch');
		assert.ok(privateSearchStep);
		assert.strictEqual(privateSearchStep!.targetResolveTimeoutMs, PRIVATE_SEARCH_TARGET_RESOLVE_TIMEOUT_MS);
		const ids = payload.steps.map(step => step.id);
		assert.ok(!ids.includes('browser'), 'live browser step is deferred');
		assert.strictEqual(ids.indexOf('commandPalette'), 5, 'command palette is step 6 (0-based index 5)');
		assert.strictEqual(ids.indexOf('chat'), 6, 'chat is step 7 (0-based index 6)');
		assert.strictEqual(ids.indexOf('approvalMock'), 7, 'approval is step 8 (0-based index 7)');
	});

	test('command palette step shows the marketing mock', async () => {
		let showCount = 0;
		const commandService = {
			executeCommand: async () => { },
		} as unknown as ICommandService;
		const contextService = {
			getWorkspace: () => ({ folders: [] }),
		} as unknown as IWorkspaceContextService;
		const scenario = createSampleCaseTourScenario(
			commandService,
			contextService,
			{
				showApproval: () => ({ dispose: () => { } }),
				showCommandPalette: () => {
					showCount++;
					return { dispose: () => { } };
				},
			},
		);
		const payload = scenario.presentation.payload as {
			steps: readonly { id: string; onBeforeShow?: () => void | Promise<void> }[];
		};
		const step = payload.steps.find(s => s.id === 'commandPalette');
		assert.ok(step?.onBeforeShow);
		await step!.onBeforeShow!();
		assert.strictEqual(showCount, 1);
	});

	test('chat step does not open the browser', async () => {
		const executed: string[] = [];
		const commandService = {
			executeCommand: async (id: string) => {
				executed.push(id);
			},
		} as unknown as ICommandService;
		const contextService = {
			getWorkspace: () => ({ folders: [] }),
		} as unknown as IWorkspaceContextService;
		const scenario = createSampleCaseTourScenario(
			commandService,
			contextService,
			createMockHost(),
		);
		const payload = scenario.presentation.payload as {
			steps: readonly { id: string; onBeforeShow?: () => void | Promise<void> }[];
		};
		const chatStep = payload.steps.find(step => step.id === 'chat');
		assert.ok(chatStep?.onBeforeShow);
		await chatStep!.onBeforeShow!();
		assert.ok(executed.includes('workbench.action.chat.open'));
		assert.ok(!executed.some(id => id.includes('browser')));
	});

	test('Private Search status bar DOM id matches safeappeals-rag pinned item id', () => {
		assert.strictEqual(PRIVATE_SEARCH_STATUS_BAR_DOM_ID, 'safeappeals.safeappeals-rag.privateSearch');
	});

	test('showCommandPaletteMock mounts under layout container and shows Open Integrated Browser', () => {
		const workbenchContainer = $('div.test-workbench-container');
		mainWindow.document.body.appendChild(workbenchContainer);
		disposables.add({ dispose: () => workbenchContainer.remove() });

		const layoutService = new FakeLayoutService(workbenchContainer);
		disposables.add(showCommandPaletteMock(layoutService));

		const host = workbenchContainer.querySelector('.safeappeals-command-palette-mock-host');
		assert.ok(host);
		assert.strictEqual(host.parentElement, workbenchContainer);
		const filter = workbenchContainer.querySelector('.safeappeals-command-palette-mock-filter');
		assert.ok(filter);
		assert.strictEqual(filter.textContent, OPEN_BROWSER_PALETTE_FILTER);
		const row = workbenchContainer.querySelector('.safeappeals-command-palette-mock-row-label');
		assert.ok(row);
		assert.strictEqual(row.textContent, OPEN_BROWSER_PALETTE_FILTER);
	});

	test('showApprovalPromptMock mounts under layout container, not document.body', () => {
		const workbenchContainer = $('div.test-workbench-container');
		mainWindow.document.body.appendChild(workbenchContainer);
		disposables.add({ dispose: () => workbenchContainer.remove() });

		const layoutService = new FakeLayoutService(workbenchContainer);
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

		for (const { outcome, expectedCalls } of [
			{ outcome: OnboardingOutcome.Completed, expectedCalls: 1 },
			{ outcome: OnboardingOutcome.Skipped, expectedCalls: 0 },
			{ outcome: OnboardingOutcome.Aborted, expectedCalls: 0 },
		]) {
			walkthroughCalls.length = 0;
			const onboarding = {
				runScenario: async () => outcome,
			} as unknown as IOnboardingScenarioService;

			await runSampleCaseTourCommand(onboarding, createFakeEditorService(), commandService);

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
		const onboarding = {
			runScenario: async () => {
				throw new Error('runScenario failed');
			},
		} as unknown as IOnboardingScenarioService;

		await assert.rejects(
			() => runSampleCaseTourCommand(
				onboarding,
				createFakeEditorService(),
				commandService,
			),
			/runScenario failed/,
		);
		assert.deepStrictEqual(walkthroughCalls, []);
	});
});
