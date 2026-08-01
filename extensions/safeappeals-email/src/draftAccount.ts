/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface AccountRef {
	id: string;
	email?: string;
	label?: string;
}

/**
 * Resolve which account to use for a draft.
 */
export function resolveDraftAccountId(
	requested: string | undefined,
	accounts: readonly AccountRef[],
): { accountId: string } | { error: string } {
	const accountId = requested?.trim() || '';
	if (!accountId) {
		if (accounts.length === 1) {
			return { accountId: accounts[0].id };
		}
		if (accounts.length === 0) {
			return {
				error: 'Error: no email accounts configured. Add an account before creating drafts.',
			};
		}
		return {
			error:
				`Error: accountId is required when multiple accounts exist. Available: ${accounts.map(a => `${a.id} (${a.email || a.label})`).join(', ')}`,
		};
	}
	if (!accounts.some(a => a.id === accountId)) {
		return { error: `Error: unknown accountId "${accountId}".` };
	}
	return { accountId };
}
