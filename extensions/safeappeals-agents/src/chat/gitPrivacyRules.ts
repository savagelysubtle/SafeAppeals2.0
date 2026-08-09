/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Git privacy rules injected into live SafeAppeals agent prompts.
 * Keep wording aligned with SAMPLE_README / SAMPLE_AGENTS_MD in the timeline sample case.
 */
export function buildSafeAppealsGitPrivacyRulesMessage(): string {
	return [
		'## Git privacy rules',
		'',
		'If this workspace is a legal matter, case folder, or contains legal/client documents: **never push** to GitHub or any git remote. Only commit locally when the user wants history. If they ask to push, warn that confidential documents would leave this computer and proceed only after explicit confirmation.',
		'',
		'If this is clearly a coding/software project (not a client matter) and the user asks to push, confirm once, then you may push.',
	].join('\n');
}
