/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { buildSafeAppealsCloudChatMessages, pickSafeAppealsCloudModelId, resolveChatSetupTimeoutWarning, SAFEAPPEALS_CLOUD_LM_HISTORY_TURN_CAP } from '../../common/chatSetupCloudHelpers.js';
import { ChatMessageRole, SAFEAPPEALS_CLOUD_VENDOR_ID } from '../../common/languageModels.js';

suite('SafeAppeals Cloud SetupAgent helpers', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suite('pickSafeAppealsCloudModelId', () => {

		test('prefers selected cloud model when present', () => {
			const preferred = `${SAFEAPPEALS_CLOUD_VENDOR_ID}/claude-opus-5`;
			const ids = [
				`${SAFEAPPEALS_CLOUD_VENDOR_ID}/claude-sonnet-4`,
				preferred,
			];
			assert.strictEqual(pickSafeAppealsCloudModelId(preferred, ids), preferred);
		});

		test('falls back to first cloud model when preferred is missing', () => {
			const ids = [`${SAFEAPPEALS_CLOUD_VENDOR_ID}/claude-sonnet-4`];
			assert.strictEqual(
				pickSafeAppealsCloudModelId(`${SAFEAPPEALS_CLOUD_VENDOR_ID}/missing`, ids),
				ids[0],
			);
		});

		test('returns undefined when no cloud models', () => {
			assert.strictEqual(pickSafeAppealsCloudModelId('anything', []), undefined);
		});
	});

	suite('resolveChatSetupTimeoutWarning', () => {

		test('Cloud path does not mention GitHub or Copilot Chat', () => {
			const message = resolveChatSetupTimeoutWarning({
				usesSafeAppealsCloud: true,
				anonymous: false,
				providerName: 'GitHub',
				chatExtensionId: 'GitHub.copilot-chat',
			});
			assert.match(message, /SafeAppeals Cloud/);
			assert.doesNotMatch(message, /GitHub/);
			assert.doesNotMatch(message, /copilot-chat/i);
		});

		test('anonymous Cloud path still uses SafeAppeals copy', () => {
			const message = resolveChatSetupTimeoutWarning({
				usesSafeAppealsCloud: true,
				anonymous: true,
				providerName: 'GitHub',
				chatExtensionId: 'GitHub.copilot-chat',
			});
			assert.match(message, /SafeAppeals Cloud/);
			assert.doesNotMatch(message, /GitHub\.copilot-chat/);
		});

		test('non-Cloud signed-in path keeps provider + extension guidance', () => {
			const message = resolveChatSetupTimeoutWarning({
				usesSafeAppealsCloud: false,
				anonymous: false,
				providerName: 'GitHub',
				chatExtensionId: 'GitHub.copilot-chat',
			});
			assert.match(message, /GitHub/);
			assert.match(message, /GitHub\.copilot-chat/);
		});
	});

	suite('buildSafeAppealsCloudChatMessages', () => {

		test('includes system, capped history, and current user message', () => {
			const history = Array.from({ length: SAFEAPPEALS_CLOUD_LM_HISTORY_TURN_CAP + 2 }, (_, i) => ({
				userText: `u${i}`,
				assistantText: `a${i}`,
			}));
			const messages = buildSafeAppealsCloudChatMessages({
				systemPrompt: 'sys',
				history,
				userText: 'hello',
			});
			assert.deepStrictEqual(messages.map(m => ({ role: m.role, text: m.content[0] && m.content[0].type === 'text' ? m.content[0].value : '' })), [
				{ role: ChatMessageRole.System, text: 'sys' },
				...history.slice(-SAFEAPPEALS_CLOUD_LM_HISTORY_TURN_CAP).flatMap(turn => ([
					{ role: ChatMessageRole.User, text: turn.userText },
					{ role: ChatMessageRole.Assistant, text: turn.assistantText },
				])),
				{ role: ChatMessageRole.User, text: 'hello' },
			]);
		});

		test('skips empty history turns', () => {
			const messages = buildSafeAppealsCloudChatMessages({
				systemPrompt: 'sys',
				history: [{ userText: '  ', assistantText: '' }, { userText: 'hi', assistantText: 'yo' }],
				userText: 'next',
			});
			assert.deepStrictEqual(messages.map(m => ({ role: m.role, text: m.content[0] && m.content[0].type === 'text' ? m.content[0].value : '' })), [
				{ role: ChatMessageRole.System, text: 'sys' },
				{ role: ChatMessageRole.User, text: 'hi' },
				{ role: ChatMessageRole.Assistant, text: 'yo' },
				{ role: ChatMessageRole.User, text: 'next' },
			]);
		});
	});
});
