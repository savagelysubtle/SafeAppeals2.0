/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/** Machine-scoped flag: Local AI Setup finished or skipped. */
export const LOCAL_AI_SETUP_COMPLETED_SETTING = 'safeappeals.rag.localAiSetup.completed';

/** Command that opens the Local AI Setup panel. */
export const SETUP_LOCAL_SEARCH_COMMAND = 'safeappeals-rag.setupLocalSearch';

/**
 * Getting Started walkthrough category + Private Search step.
 * Passed to `workbench.action.openWalkthrough` after Local AI Setup finish.
 */
export const GETTING_STARTED_PRIVATE_SEARCH_WALKTHROUGH = {
	category: 'safeappeals.safeappeals-timeline#safeappealsTimelineSetup',
	step: 'privateSearch',
} as const;

/**
 * Whether this machine has finished or skipped Local AI Setup.
 */
export function isLocalAiSetupCompleted(): boolean {
	return vscode.workspace.getConfiguration().get<boolean>(LOCAL_AI_SETUP_COMPLETED_SETTING, false) === true;
}

/**
 * Persist completion (finish or skip) to user/machine settings.
 * Property is contributed with `"scope": "machine"` so Settings Sync will not upload it.
 */
export async function markLocalAiSetupCompleted(): Promise<void> {
	await vscode.workspace.getConfiguration().update(
		LOCAL_AI_SETUP_COMPLETED_SETTING,
		true,
		vscode.ConfigurationTarget.Global,
	);
}
