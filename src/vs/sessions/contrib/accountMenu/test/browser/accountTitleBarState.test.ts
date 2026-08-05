/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ChatEntitlement } from '../../../../../workbench/services/chat/common/chatEntitlementService.js';
import { SAFEAPPEALS_CLOUD_VENDOR_ID } from '../../../../../workbench/contrib/chat/common/languageModels.js';
import { IDefaultAccountService } from '../../../../../platform/defaultAccount/common/defaultAccount.js';
import { IAuthenticationService } from '../../../../../workbench/services/authentication/common/authentication.js';
import { getAccountProfileImageUrl, getAccountTitleBarBadgeKey, getAccountTitleBarState, IAccountTitleBarStateContext, resolveAccountInfo } from '../../../../browser/accountTitleBarState.js';

suite('Sessions - Account Title Bar State', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function createState(overrides: Partial<IAccountTitleBarStateContext> = {}): IAccountTitleBarStateContext {
		return {
			isAccountLoading: false,
			accountName: 'lee@example.com',
			accountProviderLabel: 'GitHub',
			entitlement: ChatEntitlement.Pro,
			sentiment: {},
			quotas: {},
			...overrides,
		};
	}

	test('shows low token badge for Copilot Free users', () => {
		const state = getAccountTitleBarState(createState({
			entitlement: ChatEntitlement.Free,
			quotas: { chat: { percentRemaining: 10, unlimited: false } },
		}));

		assert.deepStrictEqual({
			source: state.source,
			label: state.label,
			badge: state.badge,
			dotBadge: state.dotBadge,
			kind: state.kind,
		}, {
			source: 'copilot',
			label: 'Tokens Remaining',
			badge: '10%',
			dotBadge: 'error',
			kind: 'warning',
		});

		assert.strictEqual(getAccountTitleBarBadgeKey(state), 'copilot:error:10%');
	});

	test('shows warning dot badge for low but non-critical tokens', () => {
		const state = getAccountTitleBarState(createState({
			entitlement: ChatEntitlement.Free,
			quotas: { chat: { percentRemaining: 20, unlimited: false } },
		}));

		assert.deepStrictEqual({
			source: state.source,
			label: state.label,
			badge: state.badge,
			dotBadge: state.dotBadge,
			kind: state.kind,
		}, {
			source: 'copilot',
			label: 'Tokens Remaining',
			badge: '20%',
			dotBadge: 'warning',
			kind: 'accent',
		});
	});

	test('shows quota reached warning when free quota is exhausted', () => {
		const state = getAccountTitleBarState(createState({
			entitlement: ChatEntitlement.Free,
			quotas: { completions: { percentRemaining: 0, unlimited: false } },
		}));

		assert.deepStrictEqual({
			source: state.source,
			label: state.label,
			dotBadge: state.dotBadge,
			kind: state.kind,
		}, {
			source: 'copilot',
			label: 'Quota Reached',
			dotBadge: 'error',
			kind: 'warning',
		});

		assert.strictEqual(getAccountTitleBarBadgeKey(state), 'copilot:error:');
	});

	test('falls back to signed-in account label when no higher-priority state exists', () => {
		const state = getAccountTitleBarState(createState());

		assert.deepStrictEqual({
			source: state.source,
			label: state.label,
			kind: state.kind,
			revealLabelOnHover: state.revealLabelOnHover,
		}, {
			source: 'account',
			label: 'lee@example.com',
			kind: 'default',
			revealLabelOnHover: true,
		});
	});

	test('reveals loading account label only on hover', () => {
		const state = getAccountTitleBarState(createState({
			isAccountLoading: true,
			accountName: undefined,
			accountProviderLabel: undefined,
			entitlement: ChatEntitlement.Unknown,
		}));

		assert.deepStrictEqual({
			source: state.source,
			label: state.label,
			kind: state.kind,
			revealLabelOnHover: state.revealLabelOnHover,
		}, {
			source: 'account',
			label: 'Loading Account...',
			kind: 'default',
			revealLabelOnHover: true,
		});
	});

	test('shows sign in state when no account is available', () => {
		const state = getAccountTitleBarState(createState({
			accountName: undefined,
			accountProviderLabel: undefined,
			entitlement: ChatEntitlement.Unknown,
		}));

		assert.deepStrictEqual({
			source: state.source,
			label: state.label,
			kind: state.kind,
		}, {
			source: 'copilot',
			label: 'Agents Signed Out',
			kind: 'prominent',
		});
	});

	test('does not show Agents Signed Out when accountName is present with Unknown entitlement', () => {
		const state = getAccountTitleBarState(createState({
			accountName: 'user@example.com',
			accountProviderLabel: 'SafeAppeals Cloud',
			entitlement: ChatEntitlement.Unknown,
		}));

		assert.deepStrictEqual({
			source: state.source,
			label: state.label,
			kind: state.kind,
		}, {
			source: 'account',
			label: 'user@example.com',
			kind: 'default',
		});
	});

	test('resolveAccountInfo falls back to safeappeals-cloud session', async () => {
		const defaultAccountService = {
			getDefaultAccount: async () => null,
		} as unknown as IDefaultAccountService;

		const authenticationService = {
			getSessions: async (providerId: string) => {
				if (providerId === 'github') {
					return [];
				}
				if (providerId === SAFEAPPEALS_CLOUD_VENDOR_ID) {
					return [{ account: { label: 'user@example.com' }, id: 'session1', scopes: [] }];
				}
				return [];
			},
			getProvider: (providerId: string) => ({
				id: providerId,
				label: 'SafeAppeals Cloud',
			}),
		} as unknown as IAuthenticationService;

		const info = await resolveAccountInfo(defaultAccountService, authenticationService);
		assert.deepStrictEqual(info, {
			accountName: 'user@example.com',
			accountProviderId: SAFEAPPEALS_CLOUD_VENDOR_ID,
			accountProviderLabel: 'SafeAppeals Cloud',
		});
	});

	test('returns a GitHub profile image URL for GitHub accounts', () => {
		assert.strictEqual(
			getAccountProfileImageUrl('github', 'mona lisa'),
			'https://github.com/mona%20lisa.png?size=64'
		);
	});

	test('falls back to the codicon when no GitHub profile image URL is available', () => {
		assert.strictEqual(getAccountProfileImageUrl(undefined, 'octocat'), undefined);
		assert.strictEqual(getAccountProfileImageUrl('github-enterprise', 'octocat'), undefined);
		assert.strictEqual(getAccountProfileImageUrl('github', undefined), undefined);
	});
});
