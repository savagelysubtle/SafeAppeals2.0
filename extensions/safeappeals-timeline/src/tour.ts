/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Core command that runs the sample-case spotlight scenario. Registered in
 * `vs/workbench/contrib/onboarding` (workbench layer owns the registry).
 */
export const SAMPLE_CASE_TOUR_CORE_COMMAND = 'workbench.action.safeappeals.sampleCaseTour';

/** Passed to `workbench.action.openWalkthrough` when the extension fallback tour completes. */
export const EXPLORE_MORE_TUTORIALS_WALKTHROUGH = {
	category: 'safeappeals.safeappeals-timeline#safeappealsTimelineSetup',
	step: 'exploreMoreTutorials',
} as const;

/** Expected fallback tour step count (mirrors workbench spotlight scenario). */
export const SAMPLE_CASE_TOUR_FALLBACK_STEP_COUNT = 8;

/**
 * Best-effort close of the active editor before fallback dialogs. When the workbench
 * tour command is unavailable, we cannot reliably close all Getting Started tabs —
 * only the focused Welcome editor if `closeActiveEditor` succeeds.
 */
async function closeWelcomeEditorsBeforeFallback(): Promise<void> {
	try {
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
	} catch {
		// Core onboarding unavailable — Welcome may remain open behind fallback dialogs.
	}
}

/**
 * Starts the sample-case spotlight tour (case files → brief → references → Private Search →
 * timeline → browser → Chat → static approval mock).
 * Prefers the workbench spotlight engine; falls back to a short in-extension walkthrough
 * when the core command is unavailable.
 *
 * The approval step is always a static mock — this command never invokes the AI assistant.
 */
export async function takeTour(): Promise<void> {
	try {
		await vscode.commands.executeCommand(SAMPLE_CASE_TOUR_CORE_COMMAND);
		return;
	} catch {
		// Core command not registered (older build / host) — fall through.
	}

	await closeWelcomeEditorsBeforeFallback();
	await runExtensionFallbackTour();
}

/**
 * Lightweight substitute when the workbench spotlight scenario cannot run.
 * Uses sequential information messages only — no agent invocation.
 */
async function runExtensionFallbackTour(): Promise<void> {
	const steps: Array<{ title: string; detail: string }> = [
		{
			title: 'Your Case Files',
			detail: 'Your case folder list is on the left. Sample folders (Medical Reports, Correspondence, and the rest) mirror a real matter — every file is labeled SAMPLE / FICTIONAL.',
		},
		{
			title: 'The Case Brief',
			detail: 'AGENTS.md at the workspace root is your case brief — client facts, injury details, and how the assistant should work on this matter.',
		},
		{
			title: 'Core References',
			detail: 'The core_references/ folder holds shared statutes and policy excerpts. Case-specific working files stay in your other folders.',
		},
		{
			title: 'Private Search',
			detail: 'Private Search indexes files on this computer. Status lives in the status bar below — setup and model downloads only run when you choose them.',
		},
		{
			title: 'Case Timeline',
			detail: 'The Case Timeline tracks hearings, deadlines, and key dates. Open it from the Timeline sidebar whenever you need a chronological view.',
		},
		{
			title: 'Browser Stays in the App',
			detail: 'Research portals and tribunal pages open in the integrated browser — no switching to an external window.',
		},
		{
			title: 'Where Chat Opens',
			detail: 'Chat is where you ask the assistant about the open case. Opening Chat does not spend credits by itself; drafting and research only run after you buy credits.',
		},
		{
			title: 'Approval Before Any Change',
			detail: 'This is a static preview — the AI is not running. When the assistant wants to change a file, you will see an approval prompt first. Nothing is written until you approve.',
		},
	];

	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		const label = i === steps.length - 1 ? 'Done' : 'Next';
		const choice = await vscode.window.showInformationMessage(
			`Tour (${i + 1}/${steps.length}) — ${step.title}: ${step.detail}`,
			{ modal: false },
			label,
			'End Tour',
		);
		if (choice !== label) {
			return;
		}
	}

	await vscode.commands.executeCommand('workbench.action.openWalkthrough', EXPLORE_MORE_TUTORIALS_WALKTHROUGH);
}
