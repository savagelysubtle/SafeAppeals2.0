/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

interface ExtensionManifest {
	activationEvents?: string[];
	enabledApiProposals?: string[];
	contributes?: { chatParticipants?: Array<{ id: string; isDefault?: boolean }> };
}

interface ProductConfiguration {
	extensionEnabledApiProposals?: Record<string, string[]>;
	defaultChatAgent?: {
		extensionId?: string;
		chatExtensionId?: string;
		providerExtensionId?: string;
	};
}

function readJson<T>(filePath: string): T {
	return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

suite('SafeAppeals default chat participant ownership', () => {
	const extensionRoot = path.resolve(__dirname, '../..');
	const repositoryRoot = path.resolve(extensionRoot, '../..');

	test('agents owns and activates the contributed default participant', () => {
		const agents = readJson<ExtensionManifest>(path.join(extensionRoot, 'package.json'));
		const authentication = readJson<ExtensionManifest>(path.join(repositoryRoot, 'extensions/safeappeals-authentication/package.json'));
		const participant = agents.contributes?.chatParticipants?.find(candidate => candidate.id === 'safeappeals.agent');

		assert.deepStrictEqual({
			participant,
			activation: agents.activationEvents?.includes('onChatParticipant:safeappeals.agent'),
			defaultProposal: agents.enabledApiProposals?.includes('defaultChatParticipant'),
			authenticationOwnsParticipant: authentication.contributes?.chatParticipants?.some(candidate => candidate.id === 'safeappeals.agent') ?? false,
		}, {
			participant: { id: 'safeappeals.agent', name: 'safeappeals', fullName: 'SafeAppeals', description: '%chat.agent.description%', isDefault: true, locations: ['panel'], modes: ['agent', 'ask'] },
			activation: true,
			defaultProposal: true,
			authenticationOwnsParticipant: false,
		});
	});

	test('registers implementation before authentication initialization', () => {
		const extensionSource = fs.readFileSync(path.join(extensionRoot, 'src/extension.ts'), 'utf8');
		const registration = extensionSource.indexOf('context.subscriptions.push(registerSafeAppealsAgentParticipant())');
		const authenticationInitialization = extensionSource.indexOf('await getCloudApiClient()');

		assert.ok(registration >= 0 && authenticationInitialization >= 0 && registration < authenticationInitialization);
	});

	test('product separates chat ownership from authentication provider', () => {
		const product = readJson<ProductConfiguration>(path.join(repositoryRoot, 'product.json'));

		assert.deepStrictEqual(product.defaultChatAgent && {
			extensionId: product.defaultChatAgent.extensionId,
			chatExtensionId: product.defaultChatAgent.chatExtensionId,
			providerExtensionId: product.defaultChatAgent.providerExtensionId,
		}, {
			extensionId: 'safeappeals.safeappeals-agents',
			chatExtensionId: 'safeappeals.safeappeals-agents',
			providerExtensionId: 'safeappeals.safeappeals-authentication',
		});
	});

	test('product grants participant proposals to the participant owner', () => {
		const product = readJson<ProductConfiguration>(path.join(repositoryRoot, 'product.json'));
		const grants = product.extensionEnabledApiProposals ?? {};

		assert.deepStrictEqual({
			agentsDefault: grants['safeappeals.safeappeals-agents']?.includes('defaultChatParticipant'),
			agentsAdditions: grants['safeappeals.safeappeals-agents']?.includes('chatParticipantAdditions'),
			authenticationDefault: grants['safeappeals.safeappeals-authentication']?.includes('defaultChatParticipant'),
			authenticationAdditions: grants['safeappeals.safeappeals-authentication']?.includes('chatParticipantAdditions'),
		}, {
			agentsDefault: true,
			agentsAdditions: true,
			authenticationDefault: false,
			authenticationAdditions: false,
		});
	});

	test('SafeAppeals setup activates the configured chat owner', () => {
		const setupSource = fs.readFileSync(path.join(repositoryRoot, 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupProviders.ts'), 'utf8');

		assert.ok(setupSource.includes('new ExtensionIdentifier(defaultChat.chatExtensionId)'));
		assert.ok(!setupSource.includes('new ExtensionIdentifier(SAFEAPPEALS_AUTH_EXTENSION_ID)'));
	});

	test('ordinary chat input defaults to Ask mode', () => {
		const inputSource = fs.readFileSync(path.join(repositoryRoot, 'src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts'), 'utf8');

		assert.deepStrictEqual({
			constructorFallback: inputSource.includes("this.options.defaultMode ?? ChatMode.Ask"),
			anonymousEmptyState: inputSource.includes('this.setChatMode(ChatModeKind.Ask, false);'),
			configuredModeRestoration: inputSource.includes('this.configurationService.getValue<string>(ChatConfiguration.DefaultNewSessionMode)'),
			modelStateRestoration: inputSource.includes('this.setChatMode(state.mode.id, false);'),
		}, {
			constructorFallback: true,
			anonymousEmptyState: true,
			configuredModeRestoration: true,
			modelStateRestoration: true,
		});
	});
});
