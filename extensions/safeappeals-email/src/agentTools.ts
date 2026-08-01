/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { AccountStore } from './accountStore';
import { resolveDraftAccountId } from './draftAccount';
import type { EmailIndex } from './emailIndex';

export const SAFEAPPEALS_EMAIL_CREATE_DRAFT_TOOL = 'safeappeals_email_createDraft';
export { resolveDraftAccountId } from './draftAccount';

interface CreateDraftInput {
	to: string;
	subject: string;
	content: string;
	accountId?: string;
	cc?: string;
	bcc?: string;
	emailId?: string;
	draftId?: string;
}

function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

class EmailCreateDraftTool implements vscode.LanguageModelTool<CreateDraftInput> {
	constructor(
		private readonly getIndex: () => EmailIndex | undefined,
		private readonly getAccounts: () => AccountStore | undefined,
	) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<CreateDraftInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const to = options.input?.to ?? '(unknown)';
		const subject = options.input?.subject ?? '(no subject)';
		return {
			invocationMessage: `Saving email draft to ${to}`,
			confirmationMessages: {
				title: 'Create Email Draft',
				message: `Save a local draft (does not send):\nTo: ${to}\nSubject: ${subject}`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<CreateDraftInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const index = this.getIndex();
		const accounts = this.getAccounts();
		if (!index || !accounts) {
			return textResult('Error: Safe Appeals Email is not initialized.');
		}

		const input = options.input;
		const to = input?.to?.trim() ?? '';
		const subject = input?.subject?.trim() ?? '';
		const content = input?.content ?? '';
		if (!to) {
			return textResult('Error: "to" is required.');
		}
		if (!subject) {
			return textResult('Error: "subject" is required.');
		}

		const listed = accounts.listAccounts();
		const resolved = resolveDraftAccountId(input.accountId, listed);
		if ('error' in resolved) {
			return textResult(resolved.error);
		}
		const accountId = resolved.accountId;

		try {
			const draft = await index.saveDraft({
				accountId,
				emailId: input.emailId?.trim() || '',
				to,
				cc: input.cc?.trim() || undefined,
				bcc: input.bcc?.trim() || undefined,
				subject,
				content,
				draftId: input.draftId?.trim() || undefined,
			});
			return textResult(
				`Draft saved (not sent).\nid: ${draft.id}\naccountId: ${draft.accountId}\nto: ${draft.to}\nsubject: ${draft.subject}\nstatus: ${draft.status}\nversion: ${draft.version}`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error saving draft: ${message}`);
		}
	}
}

/**
 * Register LM tools for Safe Appeals Email (draft-only; no send).
 */
export function registerAgentTools(
	context: vscode.ExtensionContext,
	getIndex: () => EmailIndex | undefined,
	getAccounts: () => AccountStore | undefined,
): void {
	context.subscriptions.push(
		vscode.lm.registerTool(
			SAFEAPPEALS_EMAIL_CREATE_DRAFT_TOOL,
			new EmailCreateDraftTool(getIndex, getAccounts),
		),
	);
}
