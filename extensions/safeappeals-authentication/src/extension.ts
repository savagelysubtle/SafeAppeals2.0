/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CloudAuthProvider, AUTH_PROVIDER_ID } from './cloudAuthProvider';
import type { CreditPack } from './api';
import { CloudChatProvider } from './llm/cloudChatProvider';
import { isAllowedExternalHttpsUrl } from './llm/externalUrl';

/** Known credit pack ids validated against a caller-supplied packId before skipping the quick pick. */
const KNOWN_CREDIT_PACK_IDS: readonly CreditPack['id'][] = ['starter', 'pro', 'power'];

function isKnownCreditPackId(value: unknown): value is CreditPack['id'] {
	return typeof value === 'string' && (KNOWN_CREDIT_PACK_IDS as readonly string[]).includes(value);
}

let output: vscode.OutputChannel;
let provider: CloudAuthProvider;

/**
 * Activates the SafeAppeals Cloud authentication extension.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
	output = vscode.window.createOutputChannel('SafeAppeals Cloud Auth', { log: true });
	context.subscriptions.push(output);

	provider = new CloudAuthProvider(context, output);
	context.subscriptions.push(provider);

	// Register chat provider before initialize so restored-session onDidChangeSessions
	// is observed (models resolve only when that event fires after reload).
	const chatProvider = new CloudChatProvider(provider, provider.getApiClient(), output);
	context.subscriptions.push(
		chatProvider,
		vscode.lm.registerLanguageModelChatProvider('safeappeals-cloud', chatProvider),
	);

	await provider.initialize();

	context.subscriptions.push(
		vscode.commands.registerCommand('safeappeals.cloud.getBalance', async () => {
			try {
				const balance = await provider.getBalance();
				void vscode.window.showInformationMessage(
					vscode.l10n.t('SafeAppeals Cloud balance: {0} {1}', String(balance.balance), balance.unit),
				);
				return balance;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				void vscode.window.showErrorMessage(message);
				throw error;
			}
		}),
		vscode.commands.registerCommand('safeappeals.cloud.getCreditPacks', async () => {
			return provider.getCreditPacks();
		}),
		vscode.commands.registerCommand('safeappeals.cloud.openCheckout', async (packId?: CreditPack['id']) => {
			try {
				if (!provider.isSignedIn()) {
					// Intentional command path — may prompt for SafeAppeals Cloud sign-in.
					await vscode.authentication.getSession(AUTH_PROVIDER_ID, [], { createIfNone: true });
				}
				const packs = await provider.getCreditPacks();

				let resolvedPackId: CreditPack['id'] | undefined;
				if (isKnownCreditPackId(packId) && packs.some(pack => pack.id === packId)) {
					resolvedPackId = packId;
				} else {
					const picked = await vscode.window.showQuickPick(
						packs.map(pack => ({
							label: pack.name,
							description: formatPackPrice(pack),
							detail: pack.description,
							packId: pack.id,
						})),
						{
							title: vscode.l10n.t('Add Credits'),
							placeHolder: vscode.l10n.t('Choose a credit pack'),
						},
					);
					if (!picked) {
						return;
					}
					resolvedPackId = picked.packId;
				}

				const checkoutUrl = await provider.createCheckoutSession(resolvedPackId);
				if (!isAllowedExternalHttpsUrl(checkoutUrl)) {
					throw new Error(vscode.l10n.t('Checkout URL from server failed safety validation.'));
				}
				await vscode.env.openExternal(vscode.Uri.parse(checkoutUrl));
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				void vscode.window.showErrorMessage(vscode.l10n.t('Could not open checkout: {0}', message));
				throw error;
			}
		}),
		vscode.commands.registerCommand('safeappeals.cloud.pasteAuthCode', async () => {
			const raw = await vscode.window.showInputBox({
				title: vscode.l10n.t('Paste Auth Code'),
				prompt: vscode.l10n.t('Paste the authorization code (or full callback URL) from your browser'),
				ignoreFocusOut: true,
			});
			if (!raw) {
				return;
			}
			try {
				const session = await provider.completeWithPastedCode(raw);
				void vscode.window.showInformationMessage(
					vscode.l10n.t('Signed in to SafeAppeals Cloud as {0}.', session.account.label),
				);
				return session;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				void vscode.window.showErrorMessage(vscode.l10n.t('Sign in failed: {0}', message));
				throw error;
			}
		}),
		vscode.commands.registerCommand('safeappeals.cloud.signOut', async () => {
			const sessions = await provider.getSessions();
			for (const session of sessions) {
				await provider.removeSession(session.id);
			}
			void vscode.window.showInformationMessage(vscode.l10n.t('Signed out of SafeAppeals Cloud.'));
		}),
	);

	output.appendLine('[extension] SafeAppeals Cloud authentication ready');
}

/**
 * Formats a credit pack for the checkout quick pick.
 */
function formatPackPrice(pack: CreditPack): string {
	return `$${pack.price.toFixed(2)} ${pack.currency}`;
}

export function deactivate(): void {
	// Disposables registered on context handle cleanup.
}
