/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Core command that runs the sample-case spotlight scenario. Registered in
 * `vs/workbench/contrib/onboarding` (workbench layer owns the registry).
 */
export const SAMPLE_CASE_TOUR_CORE_COMMAND = 'workbench.action.safeappeals.sampleCaseTour';

/**
 * Starts the sample-case spotlight tour (case files → Chat → static approval mock).
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

	await runExtensionFallbackTour();
}

/**
 * Lightweight substitute when the workbench spotlight scenario cannot run.
 * Uses sequential information messages only — no agent invocation.
 */
async function runExtensionFallbackTour(): Promise<void> {
	const steps: Array<{ title: string; detail: string }> = [
		{
			title: 'Case Files',
			detail: 'Your case folder list is on the left. Sample folders (Medical Reports, Correspondence, and the rest) mirror a real matter — every file is labeled SAMPLE / FICTIONAL.',
		},
		{
			title: 'Where Chat Opens',
			detail: 'Chat is where you ask the assistant about the open case. Opening Chat does not spend credits by itself; drafting and research only run after you buy credits.',
		},
		{
			title: 'Approval Prompt (Practice Preview)',
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
}
