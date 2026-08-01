/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { runAgentLoop } from './agentLoop';

/** Contribution / registration id for the SafeAppeals default agent participant. */
export const SAFEAPPEALS_AGENT_PARTICIPANT_ID = 'safeappeals.agent';

/**
 * Registers the SafeAppeals Agent chat participant (default for Agent mode).
 */
export function registerSafeAppealsAgentParticipant(): vscode.Disposable {
	const participant = vscode.chat.createChatParticipant(
		SAFEAPPEALS_AGENT_PARTICIPANT_ID,
		async (request, context, stream, token) => {
			try {
				return await runAgentLoop({ request, context, stream, token });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				stream.markdown(vscode.l10n.t('SafeAppeals Agent could not complete the request: {0}', message));
				return {};
			}
		},
	);

	participant.iconPath = new vscode.ThemeIcon('shield');
	return participant;
}
