/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AUTH_PROVIDER_ID, CloudAuthProvider } from '../cloudAuthProvider';
import { CloudApiClient } from '../api';
import { InsufficientCreditsError } from './insufficientCredits';
import { isAllowedExternalHttpsUrl } from './externalUrl';
import { estimateMappedMessagesTokens, estimateTokens, mapChatMessages, mapToolChoice, mapTools } from './messageMapping';

/** Max completion tokens advertised for every cloud model (matches server estimate default). */
export const CLOUD_MAX_OUTPUT_TOKENS = 4096;

/**
 * LanguageModelChatProvider backed by SafeAppeals Cloud GET /llm/models + POST /llm/chat.
 *
 * Auth hard rule: the silent model-discovery path must never surprise-prompt.
 * Only the intentional non-silent path (model picker) may call getSession(createIfNone:true).
 */
export class CloudChatProvider implements vscode.LanguageModelChatProvider, vscode.Disposable {
	private readonly _onDidChangeEmitter = new vscode.EventEmitter<void>();
	private readonly _disposables: vscode.Disposable[] = [];
	private readonly _activeRequests = new Set<AbortController>();
	private _modelsCache: vscode.LanguageModelChatInformation[] | undefined;
	private _disposed = false;

	readonly onDidChangeLanguageModelChatInformation = this._onDidChangeEmitter.event;

	constructor(
		private readonly auth: CloudAuthProvider,
		private readonly api: CloudApiClient,
		private readonly output: vscode.OutputChannel,
	) {
		this._disposables.push(
			this._onDidChangeEmitter,
			this.auth.onDidChangeSessions(() => {
				this._modelsCache = undefined;
				this._onDidChangeEmitter.fire();
			}),
		);
	}

	dispose(): void {
		this._disposed = true;
		for (const controller of this._activeRequests) {
			controller.abort();
		}
		this._activeRequests.clear();
		for (const d of this._disposables) {
			d.dispose();
		}
		this._disposables.length = 0;
	}

	/**
	 * Lists cloud models when signed in.
	 *
	 * Prompting paths:
	 * - `options.silent === true`: never prompts (`createIfNone: false`); unsigned → [].
	 * - `options.silent === false` and unsigned: may prompt via getSession(createIfNone: true)
	 *   for SafeAppeals Cloud sign-in only (intentional model-picker path). Never Copilot.
	 */
	async provideLanguageModelChatInformation(
		options: vscode.PrepareLanguageModelChatModelOptions,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelChatInformation[]> {
		if (!this.auth.isSignedIn()) {
			if (options.silent) {
				return [];
			}
			// Intentional non-silent path — may open the SafeAppeals Cloud sign-in picker.
			try {
				await vscode.authentication.getSession(AUTH_PROVIDER_ID, [], { createIfNone: true });
			} catch {
				return [];
			}
			if (!this.auth.isSignedIn()) {
				return [];
			}
		} else {
			// Confirm session without prompting (silent forbids createIfNone).
			try {
				await vscode.authentication.getSession(AUTH_PROVIDER_ID, [], { silent: true });
			} catch {
				// ignore — isSignedIn() already true from provider state
			}
		}

		if (this._modelsCache) {
			return this._modelsCache;
		}

		try {
			const models = await this.api.listModels();
			this._modelsCache = models.map(model => ({
				id: model.id,
				name: model.name,
				family: model.provider,
				version: model.id,
				maxInputTokens: model.contextWindow,
				maxOutputTokens: CLOUD_MAX_OUTPUT_TOKENS,
				detail: model.tier,
				tooltip: vscode.l10n.t('{0} via SafeAppeals Cloud ({1})', model.name, model.provider),
				capabilities: {
					toolCalling: true,
					imageInput: false,
				},
			}));
			return this._modelsCache;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.output.appendLine(`[llm] listModels failed: ${message}`);
			return [];
		}
	}

	async provideLanguageModelChatResponse(
		model: vscode.LanguageModelChatInformation,
		messages: readonly vscode.LanguageModelChatRequestMessage[],
		options: vscode.ProvideLanguageModelChatResponseOptions,
		progress: vscode.Progress<vscode.LanguageModelResponsePart>,
		token: vscode.CancellationToken,
	): Promise<void> {
		const mapped = mapChatMessages(messages);
		const tools = options.tools?.length ? mapTools(options.tools) : undefined;
		const controller = new AbortController();
		if (this._disposed) {
			controller.abort();
		}
		this._activeRequests.add(controller);
		const cancelSub = token.onCancellationRequested(() => controller.abort());
		try {
			await this.api.streamChat(
				{
					model: model.id,
					messages: mapped,
					max_tokens: model.maxOutputTokens,
					...(tools ? { tools, tool_choice: mapToolChoice(options.toolMode) } : {}),
				},
				part => {
					if (part.kind === 'text') {
						progress.report(new vscode.LanguageModelTextPart(part.text));
						return;
					}
					progress.report(new vscode.LanguageModelToolCallPart(part.callId, part.name, part.input));
				},
				controller.signal,
			);
		} catch (error) {
			if (error instanceof InsufficientCreditsError) {
				void this.promptInsufficientCredits(error);
				throw vscode.LanguageModelError.Blocked(
					vscode.l10n.t('Not enough SafeAppeals Cloud credits for this request. Add credits to continue.'),
				);
			}
			if (error instanceof Error && error.name === 'AbortError') {
				return;
			}
			throw error;
		} finally {
			cancelSub.dispose();
			this._activeRequests.delete(controller);
		}
	}

	async provideTokenCount(
		_model: vscode.LanguageModelChatInformation,
		text: string | vscode.LanguageModelChatRequestMessage,
		_token: vscode.CancellationToken,
	): Promise<number> {
		if (typeof text === 'string') {
			return estimateTokens(text);
		}
		return estimateMappedMessagesTokens(mapChatMessages([text]));
	}

	/**
	 * Zero-credit UX: localized warning with View Pricing → openCheckout command.
	 * purchaseUrl is a validated https allow-list fallback only. Never Copilot sign-in.
	 */
	private async promptInsufficientCredits(error: InsufficientCreditsError): Promise<void> {
		const viewPricing = vscode.l10n.t('View Pricing');
		const choice = await vscode.window.showWarningMessage(
			vscode.l10n.t('Not enough SafeAppeals Cloud credits for this request.'),
			viewPricing,
		);
		if (choice !== viewPricing) {
			return;
		}
		try {
			await vscode.commands.executeCommand('safeappeals.cloud.openCheckout');
			return;
		} catch (commandError) {
			const message = commandError instanceof Error ? commandError.message : String(commandError);
			this.output.appendLine(`[llm] openCheckout command failed: ${message}`);
		}
		if (error.purchaseUrl && isAllowedExternalHttpsUrl(error.purchaseUrl)) {
			await vscode.env.openExternal(vscode.Uri.parse(error.purchaseUrl));
		}
	}
}
