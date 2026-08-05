/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { buildSafeAppealsAskCloudSystemPrompt, buildSafeAppealsCloudChatMessages, buildSafeAppealsSwitchModeLmTool, hasLiveSafeAppealsCloudModel, hasUsableNonCoreDefaultAgent, isSafeAppealsCloudAgentActivated, isSuccessfulSwitchModeResultText, openSafeAppealsCreditsCheckout, pickSafeAppealsCloudModelId, resolveChatSetupTimeoutWarning, resolveCloudAgentModeUnavailableMessage, SAFEAPPEALS_AGENT_PARTICIPANT_ID, SAFEAPPEALS_CLOUD_LM_HISTORY_TURN_CAP, SAFEAPPEALS_OPEN_CHECKOUT_COMMAND, SAFEAPPEALS_SWITCH_MODE_TOOL_ID, shouldFailFastCloudAgentMode, shouldSkipAuthExtensionEnableForCloudAgent, shouldSkipToolsModelWaitForCloudAgent, shouldTreatLiveCloudModelAsLanguageModelReady, shouldUseCloudAgentReadinessPath, usesSafeAppealsCloudSetup } from '../../common/chatSetupCloudHelpers.js';
import { ChatModeKind } from '../../common/constants.js';
import { ChatMessageRole, SAFEAPPEALS_CLOUD_VENDOR_ID } from '../../common/languageModels.js';

suite('SafeAppeals Cloud SetupAgent helpers', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suite('usesSafeAppealsCloudSetup', () => {

		test('true when cloud vendor is registered', () => {
			assert.strictEqual(usesSafeAppealsCloudSetup({
				getVendors: () => [{ vendor: SAFEAPPEALS_CLOUD_VENDOR_ID }],
				hasByokModels: false,
				isAuthenticationProviderRegistered: () => false,
			}), true);
		});

		test('true when hasByokModels and cloud auth provider are registered', () => {
			assert.strictEqual(usesSafeAppealsCloudSetup({
				getVendors: () => [{ vendor: 'other-vendor' }],
				hasByokModels: true,
				isAuthenticationProviderRegistered: (id) => id === SAFEAPPEALS_CLOUD_VENDOR_ID,
			}), true);
		});

		test('false when hasByokModels without cloud auth provider', () => {
			assert.strictEqual(usesSafeAppealsCloudSetup({
				getVendors: () => [{ vendor: 'other-vendor' }],
				hasByokModels: true,
				isAuthenticationProviderRegistered: () => false,
			}), false);
		});

		test('false when no cloud vendor and no BYOK path', () => {
			assert.strictEqual(usesSafeAppealsCloudSetup({
				getVendors: () => [],
				hasByokModels: false,
				isAuthenticationProviderRegistered: () => true,
			}), false);
		});
	});

	suite('openSafeAppealsCreditsCheckout', () => {

		const upgradePlanUrl = 'https://example.com/upgrade';

		test('falls back to upgradePlanUrl when checkout command is not registered', async () => {
			const openedUris: URI[] = [];
			await openSafeAppealsCreditsCheckout(
				{ executeCommand: () => Promise.resolve() },
				{ open: (uri: URI) => { openedUris.push(uri); return Promise.resolve(true); } },
				upgradePlanUrl,
			);
			assert.deepStrictEqual(openedUris, [URI.parse(upgradePlanUrl)]);
		});

		test('executes checkout command when registered and does not open fallback URL', async () => {
			const reg = CommandsRegistry.registerCommand(SAFEAPPEALS_OPEN_CHECKOUT_COMMAND, () => { });
			try {
				const openedUris: URI[] = [];
				let executed = false;
				await openSafeAppealsCreditsCheckout(
					{
						executeCommand: (id: string) => {
							executed = id === SAFEAPPEALS_OPEN_CHECKOUT_COMMAND;
							return Promise.resolve();
						},
					},
					{ open: (uri: URI) => { openedUris.push(uri); return Promise.resolve(true); } },
					upgradePlanUrl,
				);
				assert.strictEqual(executed, true);
				assert.deepStrictEqual(openedUris, []);
			} finally {
				reg.dispose();
			}
		});

		test('opens fallback URL when registered command execution fails', async () => {
			const reg = CommandsRegistry.registerCommand(SAFEAPPEALS_OPEN_CHECKOUT_COMMAND, () => { });
			try {
				const openedUris: URI[] = [];
				await openSafeAppealsCreditsCheckout(
					{ executeCommand: () => Promise.reject(new Error('checkout failed')) },
					{ open: (uri: URI) => { openedUris.push(uri); return Promise.resolve(true); } },
					upgradePlanUrl,
				);
				assert.deepStrictEqual(openedUris, [URI.parse(upgradePlanUrl)]);
			} finally {
				reg.dispose();
			}
		});
	});

	suite('hasUsableNonCoreDefaultAgent', () => {

		test('true for activated non-core default', () => {
			assert.strictEqual(hasUsableNonCoreDefaultAgent({
				activatedDefaultAgent: { isCore: false },
				contributedDefaultAgent: undefined,
				mode: ChatModeKind.Agent,
			}), true);
		});

		test('true for contributed non-core default covering mode before activation', () => {
			assert.strictEqual(hasUsableNonCoreDefaultAgent({
				activatedDefaultAgent: { isCore: true },
				contributedDefaultAgent: { isCore: false, modes: [ChatModeKind.Agent] },
				mode: ChatModeKind.Agent,
			}), true);
		});

		test('false when contributed non-core does not cover mode', () => {
			assert.strictEqual(hasUsableNonCoreDefaultAgent({
				activatedDefaultAgent: undefined,
				contributedDefaultAgent: { isCore: false, modes: [ChatModeKind.Ask] },
				mode: ChatModeKind.Agent,
			}), false);
		});

		test('false when only core agents exist', () => {
			assert.strictEqual(hasUsableNonCoreDefaultAgent({
				activatedDefaultAgent: { isCore: true },
				contributedDefaultAgent: { isCore: true, modes: [ChatModeKind.Agent] },
				mode: ChatModeKind.Agent,
			}), false);
		});
	});

	suite('shouldFailFastCloudAgentMode', () => {

		test('fails fast for Agent + Cloud session without non-core default agent', () => {
			assert.strictEqual(shouldFailFastCloudAgentMode({
				isAgentMode: true,
				hasSafeAppealsCloudSession: true,
				hasUsableNonCoreDefaultAgent: false,
			}), true);
		});

		test('does not fail fast when a non-core Agent exists', () => {
			assert.strictEqual(shouldFailFastCloudAgentMode({
				isAgentMode: true,
				hasSafeAppealsCloudSession: true,
				hasUsableNonCoreDefaultAgent: true,
			}), false);
		});

		test('does not fail fast for Ask/Edit or without Cloud session', () => {
			assert.deepStrictEqual([
				shouldFailFastCloudAgentMode({
					isAgentMode: false,
					hasSafeAppealsCloudSession: true,
					hasUsableNonCoreDefaultAgent: false,
				}),
				shouldFailFastCloudAgentMode({
					isAgentMode: true,
					hasSafeAppealsCloudSession: false,
					hasUsableNonCoreDefaultAgent: false,
				}),
			], [false, false]);
		});
	});

	suite('resolveCloudAgentModeUnavailableMessage', () => {

		test('brands SafeAppeals Cloud and points to Ask or Edit', () => {
			const message = resolveCloudAgentModeUnavailableMessage();
			assert.match(message, /SafeAppeals Cloud/);
			assert.match(message, /Ask/);
			assert.match(message, /Edit/);
			assert.doesNotMatch(message, /GitHub/);
			assert.doesNotMatch(message, /[Cc]opilot/);
		});
	});

	suite('shouldUseCloudAgentReadinessPath', () => {

		test('true only for Agent + Cloud setup + Cloud session', () => {
			assert.deepStrictEqual([
				shouldUseCloudAgentReadinessPath({
					isAgentMode: true,
					usesSafeAppealsCloudSetup: true,
					hasSafeAppealsCloudSession: true,
				}),
				shouldUseCloudAgentReadinessPath({
					isAgentMode: false,
					usesSafeAppealsCloudSetup: true,
					hasSafeAppealsCloudSession: true,
				}),
				shouldUseCloudAgentReadinessPath({
					isAgentMode: true,
					usesSafeAppealsCloudSetup: true,
					hasSafeAppealsCloudSession: false,
				}),
			], [true, false, false]);
		});
	});

	suite('Cloud Agent readiness predicates', () => {

		test('skips auth extension enable and copilot tools wait on Cloud Agent path', () => {
			assert.deepStrictEqual([
				shouldSkipAuthExtensionEnableForCloudAgent({ isCloudAgentReadinessPath: true }),
				shouldSkipAuthExtensionEnableForCloudAgent({ isCloudAgentReadinessPath: false }),
				shouldSkipToolsModelWaitForCloudAgent({ isCloudAgentReadinessPath: true }),
				shouldSkipToolsModelWaitForCloudAgent({ isCloudAgentReadinessPath: false }),
			], [true, false, true, false]);
		});

		test('detects activated safeappeals.agent', () => {
			assert.deepStrictEqual([
				isSafeAppealsCloudAgentActivated([SAFEAPPEALS_AGENT_PARTICIPANT_ID, 'setup.agent']),
				isSafeAppealsCloudAgentActivated(['setup.agent', 'github.copilot.editsAgent']),
			], [true, false]);
		});

		test('treats live Cloud models as LM-ready without isDefaultForLocation', () => {
			assert.deepStrictEqual([
				shouldTreatLiveCloudModelAsLanguageModelReady({
					usesSafeAppealsCloudSetup: true,
					hasSafeAppealsCloudSession: true,
					hasLiveCloudModel: true,
				}),
				shouldTreatLiveCloudModelAsLanguageModelReady({
					usesSafeAppealsCloudSetup: true,
					hasSafeAppealsCloudSession: true,
					hasLiveCloudModel: false,
				}),
				hasLiveSafeAppealsCloudModel([SAFEAPPEALS_CLOUD_VENDOR_ID, 'other']),
				hasLiveSafeAppealsCloudModel(['other', undefined]),
			], [true, false, true, false]);
		});
	});

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

	suite('Ask/Edit Cloud switchMode helpers', () => {

		test('buildSafeAppealsAskCloudSystemPrompt mentions switchMode Agent Plan NEVER ask', () => {
			const prompt = buildSafeAppealsAskCloudSystemPrompt('Ask');
			assert.deepStrictEqual({
				switchMode: prompt.includes(SAFEAPPEALS_SWITCH_MODE_TOOL_ID) || prompt.includes('safeappeals_switchMode'),
				agent: prompt.includes('Agent'),
				plan: prompt.includes('Plan'),
				neverAsk: /NEVER ask/i.test(prompt),
				mode: prompt.includes('Ask'),
			}, {
				switchMode: true,
				agent: true,
				plan: true,
				neverAsk: true,
				mode: true,
			});
		});

		test('isSuccessfulSwitchModeResultText matches success and rejects errors', () => {
			assert.deepStrictEqual([
				isSuccessfulSwitchModeResultText('Switched to Agent mode.'),
				isSuccessfulSwitchModeResultText('Error: mode must be "Plan" or "Agent".'),
			], [true, false]);
		});

		test('buildSafeAppealsSwitchModeLmTool shapes name description inputSchema', () => {
			const schema = { type: 'object', properties: { mode: { type: 'string' } } };
			assert.deepStrictEqual(
				buildSafeAppealsSwitchModeLmTool({
					id: SAFEAPPEALS_SWITCH_MODE_TOOL_ID,
					modelDescription: 'Switch modes',
					inputSchema: schema,
				}),
				{
					name: SAFEAPPEALS_SWITCH_MODE_TOOL_ID,
					description: 'Switch modes',
					inputSchema: schema,
				},
			);
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
