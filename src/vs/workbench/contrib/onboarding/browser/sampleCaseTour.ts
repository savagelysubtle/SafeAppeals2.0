/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { DisposableStore, IDisposable, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IOnboardingScenario } from '../common/onboardingScenario.js';
import { markOnboardingTarget } from './spotlight/onboardingTarget.js';
import { ISpotlightPayload, SPOTLIGHT_PRESENTATION_KIND } from './spotlight/spotlightTypes.js';
import './media/sampleCaseTour.css';

/** Scenario id for the Safe Appeals sample-case spotlight tour. */
export const SAMPLE_CASE_TOUR_ID = 'safeappeals.sampleCaseTour';

/**
 * Core command that starts {@link SAMPLE_CASE_TOUR_ID}. The extension command
 * `safeappeals-timeline.takeTour` delegates here so the checklist completion event
 * stays on the extension id while the spotlight engine stays in workbench.
 */
export const SAMPLE_CASE_TOUR_COMMAND_ID = 'workbench.action.safeappeals.sampleCaseTour';

/** Onboarding target ids — must match `markOnboardingTarget` call sites. */
export const SAMPLE_CASE_TOUR_TARGETS = {
	caseFiles: 'safeappeals.sampleCase.caseFiles',
	chat: 'safeappeals.sampleCase.chat',
	approvalMock: 'safeappeals.sampleCase.approvalMock',
} as const;

/**
 * Tracks the live approval-mock DisposableStore so aborted tours dispose the
 * previous mock by reference — never by querying the document.
 */
const currentApprovalPromptMock = new MutableDisposable();

/**
 * Builds the sample-case spotlight scenario. Trigger is command-only (never automatic).
 * Step 3's target is a static mock injected by {@link showApprovalPromptMock} — the AI is never invoked.
 */
export function createSampleCaseTourScenario(
	commandService: ICommandService,
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
 * Injects a static, non-interactive approval-prompt mock into the main window
 * and marks it as a spotlight target. Dispose removes the DOM. Never talks to an agent.
 * Replaces any previously tracked mock so aborted tours cannot leave a host behind.
 */
export function showApprovalPromptMock(): IDisposable {
	const store = new DisposableStore();
	const host = append(mainWindow.document.body, $('div.safeappeals-approval-mock-host'));
	store.add(toDisposable(() => host.remove()));

	const card = append(host, $('div.safeappeals-approval-mock'));
	append(card, $('div.safeappeals-approval-mock-badge')).textContent = localize('safeappeals.sampleCaseTour.approval.badge', "Practice Preview — AI Not Running");
	append(card, $('div.safeappeals-approval-mock-title')).textContent = localize('safeappeals.sampleCaseTour.approval.mockTitle', "Approve edit to Personal_Notes/SAMPLE_practice_notes.md?");
	append(card, $('div.safeappeals-approval-mock-body')).textContent = localize('safeappeals.sampleCaseTour.approval.mockBody', "The assistant proposes adding an outline heading. This card is a static mock for the tour — no file will change.");

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
