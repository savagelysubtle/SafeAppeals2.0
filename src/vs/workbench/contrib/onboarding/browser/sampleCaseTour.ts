/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { URI } from '../../../../base/common/uri.js';
import { DisposableStore, IDisposable, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { EditorsOrder } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { GettingStartedInput } from '../../welcomeGettingStarted/browser/gettingStartedInput.js';
import { IOnboardingScenario, OnboardingOutcome } from '../common/onboardingScenario.js';
import { IOnboardingScenarioService } from '../common/onboardingScenarioService.js';
import { markOnboardingTarget } from './spotlight/onboardingTarget.js';
import { ISpotlightPayload, SPOTLIGHT_PRESENTATION_KIND } from './spotlight/spotlightTypes.js';
import { ensurePrivateSearchStatusBarMarked } from './sampleCaseTourTargets.js';
import './media/sampleCaseTour.css';

/** Scenario id for the Safe Appeals sample-case spotlight tour. */
export const SAMPLE_CASE_TOUR_ID = 'safeappeals.sampleCaseTour';

/**
 * Core command that starts {@link SAMPLE_CASE_TOUR_ID}. The extension command
 * `safeappeals-timeline.takeTour` delegates here so the checklist completion event
 * stays on the extension id while the spotlight engine stays in workbench.
 */
export const SAMPLE_CASE_TOUR_COMMAND_ID = 'workbench.action.safeappeals.sampleCaseTour';

/** Safe Appeals Tutorials walkthrough category (extension-contributed). */
export const SAFEAPPEALS_TUTORIALS_WALKTHROUGH_CATEGORY = 'safeappeals.safeappeals-timeline#safeappealsTimelineSetup';

/** Explore More step — links to feature walkthroughs after the sample-case tour. */
export const EXPLORE_MORE_TUTORIALS_STEP = 'exploreMoreTutorials';

/** Passed to `workbench.action.openWalkthrough` when the sample-case tour completes. */
export const EXPLORE_MORE_TUTORIALS_WALKTHROUGH = {
	category: SAFEAPPEALS_TUTORIALS_WALKTHROUGH_CATEGORY,
	step: EXPLORE_MORE_TUTORIALS_STEP,
} as const;

/** Onboarding target ids — must match `markOnboardingTarget` call sites. */
export const SAMPLE_CASE_TOUR_TARGETS = {
	caseFiles: 'safeappeals.sampleCase.caseFiles',
	privateSearch: 'safeappeals.sampleCase.privateSearch',
	timeline: 'safeappeals.sampleCase.timeline',
	browser: 'safeappeals.sampleCase.browser',
	chat: 'safeappeals.sampleCase.chat',
	approvalMock: 'safeappeals.sampleCase.approvalMock',
} as const;

/** Expected spotlight step count (used by unit tests). */
export const SAMPLE_CASE_TOUR_STEP_COUNT = 8;

/** Longer target resolve wait for the Private Search status bar step (extension-contributed). */
export const PRIVATE_SEARCH_TARGET_RESOLVE_TIMEOUT_MS = 5000;

/** Root case brief filename in the sample workspace. */
const AGENTS_MD = 'AGENTS.md';

/** Shared reference materials folder at workspace root. */
const CORE_REFERENCES_FOLDER = 'core_references';

/** Timeline extension view container command. */
const TIMELINE_VIEW_COMMAND = 'workbench.view.extension.safeappeals-timeline';

/** Integrated browser open command. */
const BROWSER_OPEN_COMMAND = 'workbench.action.browser.open';

/**
 * Tracks the live approval-mock DisposableStore so aborted tours dispose the
 * previous mock by reference — never by querying the document.
 */
const currentApprovalPromptMock = new MutableDisposable();

function getFirstWorkspaceFolderUri(contextService: IWorkspaceContextService): URI | undefined {
	return contextService.getWorkspace().folders[0]?.uri;
}

async function revealWorkspaceResource(
	commandService: ICommandService,
	contextService: IWorkspaceContextService,
	...pathSegments: string[]
): Promise<void> {
	const folderUri = getFirstWorkspaceFolderUri(contextService);
	if (!folderUri) {
		await commandService.executeCommand('workbench.view.explorer');
		return;
	}
	const resource = URI.joinPath(folderUri, ...pathSegments);
	await commandService.executeCommand('revealInExplorer', resource);
}

/**
 * Builds the sample-case spotlight scenario. Trigger is command-only (never automatic).
 * Steps 2–3 reuse the explorer tree target while {@link revealInExplorer} selects AGENTS.md
 * or `core_references/` so the spotlight stays on the file tree with the right row highlighted.
 * The approval step is a static mock — the AI is never invoked.
 */
export function createSampleCaseTourScenario(
	commandService: ICommandService,
	contextService: IWorkspaceContextService,
	mockHost: { show(): IDisposable },
): IOnboardingScenario<ISpotlightPayload> {
	const payload: ISpotlightPayload = {
		steps: [
			{
				id: 'caseFiles',
				targetId: SAMPLE_CASE_TOUR_TARGETS.caseFiles,
				title: localize('safeappeals.sampleCaseTour.caseFiles.title', "Your Case Files"),
				description: localize('safeappeals.sampleCaseTour.caseFiles.description', "This list is your case folder. Medical reports, correspondence, decisions, and notes live here — the same layout you will use for a real matter. Every file in the sample case is labeled SAMPLE or FICTIONAL."),
				placement: 'right',
				onBeforeShow: async () => {
					await commandService.executeCommand('workbench.view.explorer');
				},
			},
			{
				id: 'agentsMd',
				targetId: SAMPLE_CASE_TOUR_TARGETS.caseFiles,
				title: localize('safeappeals.sampleCaseTour.agentsMd.title', "The Case Brief"),
				description: localize('safeappeals.sampleCaseTour.agentsMd.description', "AGENTS.md at the workspace root is your case brief — who the client is, what happened, and how the assistant should work on this matter. Edit it freely; Safe Appeals does not overwrite it."),
				placement: 'right',
				onBeforeShow: async () => {
					await revealWorkspaceResource(commandService, contextService, AGENTS_MD);
				},
			},
			{
				id: 'coreReferences',
				targetId: SAMPLE_CASE_TOUR_TARGETS.caseFiles,
				title: localize('safeappeals.sampleCaseTour.coreReferences.title', "Core References"),
				description: localize('safeappeals.sampleCaseTour.coreReferences.description', "The core_references/ folder holds shared statutes, policy manuals, and other materials that apply across cases. Keep case-specific working files in your other folders."),
				placement: 'right',
				onBeforeShow: async () => {
					await revealWorkspaceResource(commandService, contextService, CORE_REFERENCES_FOLDER);
				},
			},
			{
				id: 'privateSearch',
				targetId: SAMPLE_CASE_TOUR_TARGETS.privateSearch,
				title: localize('safeappeals.sampleCaseTour.privateSearch.title', "Private Search"),
				description: localize('safeappeals.sampleCaseTour.privateSearch.description', "Private Search indexes case files on this computer so you can find passages without uploading whole documents. Status lives in the bar below — setup and model downloads are optional and only run when you choose them."),
				placement: 'above',
				targetResolveTimeoutMs: PRIVATE_SEARCH_TARGET_RESOLVE_TIMEOUT_MS,
				onBeforeShow: () => {
					ensurePrivateSearchStatusBarMarked();
				},
			},
			{
				id: 'timeline',
				targetId: SAMPLE_CASE_TOUR_TARGETS.timeline,
				title: localize('safeappeals.sampleCaseTour.timeline.title', "Case Timeline"),
				description: localize('safeappeals.sampleCaseTour.timeline.description', "The Case Timeline tracks hearings, deadlines, and key dates for the matter. Open it from the sidebar whenever you need a chronological view of the case."),
				placement: 'left',
				onBeforeShow: async () => {
					await commandService.executeCommand(TIMELINE_VIEW_COMMAND);
				},
			},
			{
				id: 'browser',
				targetId: SAMPLE_CASE_TOUR_TARGETS.browser,
				title: localize('safeappeals.sampleCaseTour.browser.title', "Browser Stays in the App"),
				description: localize('safeappeals.sampleCaseTour.browser.description', "Research portals, insurer sites, and tribunal pages open in the integrated browser — no switching to an external window. The assistant can read pages you share from here."),
				placement: 'below',
				onBeforeShow: async () => {
					await commandService.executeCommand(BROWSER_OPEN_COMMAND);
				},
			},
			{
				id: 'chat',
				targetId: SAMPLE_CASE_TOUR_TARGETS.chat,
				title: localize('safeappeals.sampleCaseTour.chat.title', "Where Chat Opens"),
				description: localize('safeappeals.sampleCaseTour.chat.description', "Chat is where you ask the assistant about the open case. Opening Chat by itself does not spend credits — drafting and research only run after you choose to buy a pack."),
				placement: 'left',
				onBeforeShow: async () => {
					await commandService.executeCommand('workbench.action.chat.open');
				},
			},
			{
				id: 'approvalMock',
				targetId: SAMPLE_CASE_TOUR_TARGETS.approvalMock,
				title: localize('safeappeals.sampleCaseTour.approval.title', "Approval Before Any Change"),
				description: localize('safeappeals.sampleCaseTour.approval.description', "This is a practice preview — the AI is not running. When the assistant wants to edit a file, you will see a prompt like this first. Nothing is written until you approve."),
				placement: 'below',
				onBeforeShow: () => {
					mockHost.show();
				},
			},
		],
	};

	return {
		id: SAMPLE_CASE_TOUR_ID,
		trigger: { kind: 'command', commandId: SAMPLE_CASE_TOUR_COMMAND_ID },
		priority: 50,
		repeatable: true,
		presentation: {
			kind: SPOTLIGHT_PRESENTATION_KIND,
			payload,
		},
	};
}

/**
 * Injects a static, non-interactive approval-prompt mock into the workbench
 * container (same stacking context as the spotlight overlay) and marks it as a
 * spotlight target. Dispose removes the DOM. Never talks to an agent.
 * Replaces any previously tracked mock so aborted tours cannot leave a host behind.
 */
export function showApprovalPromptMock(layoutService: IWorkbenchLayoutService): IDisposable {
	const store = new DisposableStore();
	const container = layoutService.getContainer(mainWindow);
	const host = append(container, $('div.safeappeals-approval-mock-host'));
	store.add(toDisposable(() => host.remove()));

	const card = append(host, $('div.safeappeals-approval-mock'));
	append(card, $('div.safeappeals-approval-mock-badge')).textContent = localize('safeappeals.sampleCaseTour.approval.badge', "Practice Preview — AI Not Running");
	append(card, $('div.safeappeals-approval-mock-title')).textContent = localize('safeappeals.sampleCaseTour.approval.mockTitle', "Approve edit to AGENTS.md?");
	append(card, $('div.safeappeals-approval-mock-body')).textContent = localize('safeappeals.sampleCaseTour.approval.mockBody', "The assistant proposes adding a hearing date note to the case brief. This card is a static mock for the tour — no file will change.");

	const actions = append(card, $('div.safeappeals-approval-mock-actions'));
	const keep = append(actions, $('button.safeappeals-approval-mock-btn.primary')) as HTMLButtonElement;
	keep.type = 'button';
	keep.textContent = localize('safeappeals.sampleCaseTour.approval.keep', "Keep");
	keep.disabled = true;
	const undo = append(actions, $('button.safeappeals-approval-mock-btn')) as HTMLButtonElement;
	undo.type = 'button';
	undo.textContent = localize('safeappeals.sampleCaseTour.approval.undo', "Undo");
	undo.disabled = true;

	store.add(markOnboardingTarget(card, SAMPLE_CASE_TOUR_TARGETS.approvalMock));
	// Assigning replaces (and disposes) any leftover mock from an aborted tour.
	currentApprovalPromptMock.value = store;
	return store;
}

/**
 * Disposes the tracked approval mock, if any (e.g. tour finished or aborted).
 */
export function clearApprovalPromptMocks(): void {
	currentApprovalPromptMock.clear();
}

export async function closeGettingStartedEditors(editorService: IEditorService): Promise<void> {
	const gettingStartedEditors = editorService.getEditors(EditorsOrder.SEQUENTIAL)
		.filter(({ editor }) => editor instanceof GettingStartedInput);
	if (gettingStartedEditors.length > 0) {
		await editorService.closeEditors(gettingStartedEditors);
	}
}

/**
 * Runs the sample-case tour command: closes Welcome editors, executes the scenario,
 * clears mocks, and opens Explore More when the user completes the tour.
 */
export async function runSampleCaseTourCommand(
	onboarding: IOnboardingScenarioService,
	editorService: IEditorService,
	commandService: ICommandService,
): Promise<void> {
	clearApprovalPromptMocks();
	await closeGettingStartedEditors(editorService);
	let outcome: OnboardingOutcome | undefined;
	try {
		outcome = await onboarding.runScenario(SAMPLE_CASE_TOUR_ID);
	} finally {
		clearApprovalPromptMocks();
	}
	if (outcome === OnboardingOutcome.Completed) {
		await commandService.executeCommand('workbench.action.openWalkthrough', EXPLORE_MORE_TUTORIALS_WALKTHROUGH);
	}
}
