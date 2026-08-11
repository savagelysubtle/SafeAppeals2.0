/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/chatSetup.css';
import { $ } from '../../../../../base/browser/dom.js';
import { IButton } from '../../../../../base/browser/ui/button/button.js';
import { Dialog, DialogContentsAlignment } from '../../../../../base/browser/ui/dialog/dialog.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { isCancellationError } from '../../../../../base/common/errors.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { toErrorMessage } from '../../../../../base/common/errorMessage.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Lazy } from '../../../../../base/common/lazy.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { IMarkdownRendererService } from '../../../../../platform/markdown/browser/markdownRenderer.js';
import { localize } from '../../../../../nls.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { createWorkbenchDialogOptions } from '../../../../browser/parts/dialogs/dialog.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { ILayoutService } from '../../../../../platform/layout/browser/layoutService.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import product from '../../../../../platform/product/common/product.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService } from '../../../../../platform/workspace/common/workspaceTrust.js';
import { IAuthenticationService } from '../../../../services/authentication/common/authentication.js';
import { IExtensionsWorkbenchService } from '../../../extensions/common/extensions.js';
import { IWorkbenchLayoutService } from '../../../../services/layout/browser/layoutService.js';
import { ChatEntitlement, ChatEntitlementContext, ChatEntitlementService, IChatEntitlementService, isProUser } from '../../../../services/chat/common/chatEntitlementService.js';
import { usesSafeAppealsCloudSetup } from '../../common/chatSetupCloudHelpers.js';
import { ILanguageModelsService, SAFEAPPEALS_CLOUD_VENDOR_ID } from '../../common/languageModels.js';
import { IChatWidgetService } from '../chat.js';
import { ChatSetupController } from './chatSetupController.js';
import { IChatSetupResult, ChatSetupAnonymous, InstallChatEvent, InstallChatClassification, ChatSetupStrategy, ChatSetupResultValue, maybeEnableAuthExtension } from './chatSetup.js';
import { IDefaultAccountService } from '../../../../../platform/defaultAccount/common/defaultAccount.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { ActivationKind, IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { raceTimeout } from '../../../../../base/common/async.js';

const defaultChat = {
	chatExtensionId: product.defaultChatAgent?.chatExtensionId ?? '',
	publicCodeMatchesUrl: product.defaultChatAgent?.publicCodeMatchesUrl ?? '',
	provider: product.defaultChatAgent?.provider ?? { default: { id: '', name: '' }, enterprise: { id: '', name: '' }, microsoft: { id: '', name: '' }, google: { id: '', name: '' } },
	chatRefreshTokenCommand: product.defaultChatAgent?.chatRefreshTokenCommand ?? '',
	termsStatementUrl: product.defaultChatAgent?.termsStatementUrl ?? '',
	privacyStatementUrl: product.defaultChatAgent?.privacyStatementUrl ?? ''
};

export interface ISafeAppealsCloudSetupOperations {
	readonly enableAuthExtension: () => Promise<void>;
	readonly activateAuthProvider: () => Promise<void>;
	readonly getSessionCount: () => Promise<number>;
	/** Optional identity scopes, e.g. `provider:google` / `provider:microsoft`. */
	readonly createSession: (scopes?: readonly string[]) => Promise<void>;
}

export async function runSafeAppealsCloudSetup(
	operations: ISafeAppealsCloudSetupOperations,
	identityScopes: readonly string[] = [],
): Promise<void> {
	await operations.enableAuthExtension();
	await operations.activateAuthProvider();
	if (await operations.getSessionCount() === 0) {
		await operations.createSession(identityScopes);
	}
}

export class ChatSetup {

	private static instance: ChatSetup | undefined = undefined;
	static getInstance(instantiationService: IInstantiationService, context: ChatEntitlementContext, controller: Lazy<ChatSetupController>): ChatSetup {
		let instance = ChatSetup.instance;
		if (!instance) {
			instance = ChatSetup.instance = instantiationService.createInstance(ChatSetup, context, controller);
		}

		return instance;
	}

	private pendingRun: Promise<IChatSetupResult> | undefined = undefined;

	private skipDialogOnce = false;

	constructor(
		private readonly context: ChatEntitlementContext,
		private readonly controller: Lazy<ChatSetupController>,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@ILayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IChatEntitlementService private readonly chatEntitlementService: ChatEntitlementService,
		@ILogService private readonly logService: ILogService,
		@IChatWidgetService private readonly widgetService: IChatWidgetService,
		@IWorkspaceTrustRequestService private readonly workspaceTrustRequestService: IWorkspaceTrustRequestService,
		@IMarkdownRendererService private readonly markdownRendererService: IMarkdownRendererService,
		@IDefaultAccountService private readonly defaultAccountService: IDefaultAccountService,
		@IHostService private readonly hostService: IHostService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IWorkspaceTrustManagementService private readonly workspaceTrustManagementService: IWorkspaceTrustManagementService,
		@IAuthenticationService private readonly authenticationService: IAuthenticationService,
		@ILanguageModelsService private readonly languageModelsService: ILanguageModelsService,
		@IExtensionsWorkbenchService private readonly extensionsWorkbenchService: IExtensionsWorkbenchService,
	) { }

	/** SafeAppeals: vendor registered, or hasByokModels + cloud auth provider (align with SetupAgent). */
	private usesSafeAppealsCloudSetup(): boolean {
		return usesSafeAppealsCloudSetup({
			getVendors: () => this.languageModelsService.getVendors(),
			hasByokModels: this.chatEntitlementService.hasByokModels,
			isAuthenticationProviderRegistered: (id) => this.authenticationService.isAuthenticationProviderRegistered(id),
		});
	}

	skipDialog(): void {
		this.skipDialogOnce = true;
	}

	async run(options?: { disableChatViewReveal?: boolean; forceSignInDialog?: boolean; additionalScopes?: readonly string[]; forceAnonymous?: ChatSetupAnonymous; dialogIcon?: ThemeIcon; dialogTitle?: string; setupStrategy?: ChatSetupStrategy; disableCloseButton?: boolean; onSignInStarted?: () => void }): Promise<IChatSetupResult> {
		if (this.pendingRun) {
			return this.pendingRun;
		}

		this.pendingRun = this.doRun(options);

		try {
			return await this.pendingRun;
		} finally {
			this.pendingRun = undefined;
		}
	}

	private async doRun(options?: { disableChatViewReveal?: boolean; forceSignInDialog?: boolean; additionalScopes?: readonly string[]; forceAnonymous?: ChatSetupAnonymous; dialogIcon?: ThemeIcon; dialogTitle?: string; setupStrategy?: ChatSetupStrategy; disableCloseButton?: boolean; onSignInStarted?: () => void }): Promise<IChatSetupResult> {
		this.context.update({ later: false });

		const dialogSkipped = this.skipDialogOnce;
		this.skipDialogOnce = false;

		const wasTrusted = this.workspaceTrustManagementService.isWorkspaceTrusted();
		const trusted = await this.workspaceTrustRequestService.requestWorkspaceTrust({
			message: localize('chatWorkspaceTrust', "AI features are currently only supported in trusted workspaces.")
		});
		if (!trusted) {
			this.context.update({ later: true });
			this.telemetryService.publicLog2<InstallChatEvent, InstallChatClassification>('commandCenter.chatInstall', { installResult: 'failedNotTrusted', installDuration: 0, signUpErrorCode: undefined, provider: undefined });

			return { dialogSkipped, success: undefined /* canceled */ };
		}

		if (!wasTrusted) {
			// Trust was just granted: the chat extension is (re)activating, and the
			// entitlement only resolves once it is up. Wait for activation so the
			// dialog decision below isn't made from a stale "signed out" entitlement
			// (which would briefly show the sign-in dialog to an already-signed-in
			// user). Bounded, so a genuinely signed-out / slow case still proceeds.
			await this.whenChatExtensionActivated();
		}

		let setupStrategy: ChatSetupStrategy;
		if (options?.setupStrategy !== undefined) {
			setupStrategy = options.setupStrategy; // caller provided a specific strategy, skip dialog
		} else if (!options?.forceSignInDialog && (dialogSkipped || isProUser(this.chatEntitlementService.entitlement) || this.chatEntitlementService.entitlement === ChatEntitlement.Free)) {
			setupStrategy = ChatSetupStrategy.DefaultSetup; // existing pro/free users setup without a dialog
		} else if (options?.forceAnonymous === ChatSetupAnonymous.EnabledWithoutDialog) {
			setupStrategy = ChatSetupStrategy.DefaultSetup; // anonymous setup without a dialog
		} else {
			setupStrategy = await this.showDialog(options);
		}

		if (setupStrategy === ChatSetupStrategy.DefaultSetup && this.defaultAccountService.getDefaultAccountAuthenticationProvider().enterprise) {
			setupStrategy = ChatSetupStrategy.SetupWithEnterpriseProvider; // users with a configured provider go through provider setup
		}

		if (setupStrategy !== ChatSetupStrategy.Canceled) {
			options?.onSignInStarted?.();
		}

		if (setupStrategy !== ChatSetupStrategy.Canceled && !options?.disableChatViewReveal) {
			// Show the chat view now to better indicate progress
			// while installing the extension or returning from sign in
			this.widgetService.revealWidget();
		}

		let success: ChatSetupResultValue = undefined;
		try {
			switch (setupStrategy) {
				case ChatSetupStrategy.SetupWithEnterpriseProvider:
					success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: true, useSocialProvider: undefined, additionalScopes: options?.additionalScopes, forceAnonymous: options?.forceAnonymous });
					break;
				case ChatSetupStrategy.SetupWithoutEnterpriseProvider:
					success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: false, useSocialProvider: undefined, additionalScopes: options?.additionalScopes, forceAnonymous: options?.forceAnonymous });
					break;
				case ChatSetupStrategy.SetupWithAppleProvider:
					success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: false, useSocialProvider: 'apple', additionalScopes: options?.additionalScopes, forceAnonymous: options?.forceAnonymous });
					break;
				case ChatSetupStrategy.SetupWithGoogleProvider:
					success = await this.controller.value.setupWithProvider({ useEnterpriseProvider: false, useSocialProvider: 'google', additionalScopes: options?.additionalScopes, forceAnonymous: options?.forceAnonymous });
					break;
				case ChatSetupStrategy.SetupWithSafeAppealsCloud:
				case ChatSetupStrategy.SetupWithSafeAppealsCloudGoogle:
				case ChatSetupStrategy.SetupWithSafeAppealsCloudOutlook:
				case ChatSetupStrategy.SetupWithSafeAppealsCloudSlack:
					try {
						const identityScopes =
							setupStrategy === ChatSetupStrategy.SetupWithSafeAppealsCloudGoogle
								? ['provider:google']
								: setupStrategy === ChatSetupStrategy.SetupWithSafeAppealsCloudOutlook
									? ['provider:microsoft']
									: setupStrategy === ChatSetupStrategy.SetupWithSafeAppealsCloudSlack
										? ['provider:slack']
										: [];
						await runSafeAppealsCloudSetup({
							enableAuthExtension: async () => { await maybeEnableAuthExtension(this.extensionsWorkbenchService, this.logService, true); },
							activateAuthProvider: async () => { await this.extensionService.activateByEvent('onAuthenticationRequest:safeappeals-cloud', ActivationKind.Immediate); },
							getSessionCount: async () => (await this.authenticationService.getSessions(SAFEAPPEALS_CLOUD_VENDOR_ID)).length,
							createSession: async scopes => {
								await this.authenticationService.createSession(
									SAFEAPPEALS_CLOUD_VENDOR_ID,
									scopes ?? [],
									{ activateImmediate: true },
								);
							},
						}, identityScopes);
						success = true;
					} catch (error) {
						if (isCancellationError(error)) {
							success = undefined;
						} else {
							this.logService.error('[chat setup] SafeAppeals Cloud sign-in failed', error);
							throw error;
						}
					}
					break;
				case ChatSetupStrategy.DefaultSetup:
					success = await this.controller.value.setup({ ...options, forceAnonymous: options?.forceAnonymous });
					break;
				case ChatSetupStrategy.Canceled:
					this.context.update({ later: true });
					this.telemetryService.publicLog2<InstallChatEvent, InstallChatClassification>('commandCenter.chatInstall', { installResult: 'failedMaybeLater', installDuration: 0, signUpErrorCode: undefined, provider: undefined });
					break;
			}
		} catch (error) {
			this.logService.error(`[chat setup] Error during setup: ${toErrorMessage(error)}`);
			success = false;
		}

		if (success) {
			this.context.update({ completed: true });
		}

		return { success, dialogSkipped };
	}

	/**
	 * Whether the default chat extension has finished activating. `activationTimes`
	 * is only set once activation completes, so `undefined` means "not yet active".
	 */
	private isChatExtensionActivated(): boolean {
		const status = this.extensionService.getExtensionsStatus();
		for (const id of Object.keys(status)) {
			if (ExtensionIdentifier.equals(id, defaultChat.chatExtensionId)) {
				return status[id].activationTimes !== undefined;
			}
		}
		return false;
	}

	/**
	 * Resolves once the default chat extension has finished activating (bounded by
	 * a timeout). Detection relies only on the extension lifecycle, so it never
	 * touches the user's authentication session.
	 */
	private async whenChatExtensionActivated(timeoutMs = 10000): Promise<void> {
		if (!defaultChat.chatExtensionId || this.isChatExtensionActivated()) {
			return;
		}

		const store = new DisposableStore();
		try {
			await raceTimeout(new Promise<void>(resolve => {
				const check = () => {
					if (this.isChatExtensionActivated()) {
						resolve();
					}
				};
				store.add(this.extensionService.onDidChangeExtensionsStatus(check));
				this.extensionService.whenInstalledExtensionsRegistered().then(check);
			}), timeoutMs);
		} finally {
			store.dispose();
		}
	}

	private async showDialog(options?: { forceSignInDialog?: boolean; forceAnonymous?: ChatSetupAnonymous; dialogIcon?: ThemeIcon; dialogTitle?: string; disableCloseButton?: boolean; onSignInStarted?: () => void }): Promise<ChatSetupStrategy> {
		const disposables = new DisposableStore();

		const buttons = this.getButtons(options);
		// SafeAppeals: use SafeAppeals shield icon instead of Copilot/Account icons
		const dialogIcon = options?.dialogIcon
			?? (this.usesSafeAppealsCloudSetup() ? Codicon.shield : Codicon.shield);

		const dialog = disposables.add(new Dialog(
			this.layoutService.activeContainer,
			this.getDialogTitle(options),
			buttons.map(button => button[0]),
			createWorkbenchDialogOptions({
				type: 'none',
				extraClasses: ['chat-setup-dialog'],
				detail: ' ', // workaround allowing us to render the message in large
				icon: dialogIcon,
				alignment: DialogContentsAlignment.Vertical,
				cancelId: buttons.length,
				disableCloseButton: options?.disableCloseButton ?? false,
				renderFooter: footer => footer.appendChild(this.createDialogFooter(disposables, options)),
				buttonOptions: buttons.map(button => button[2])
			}, this.keybindingService, this.layoutService, this.hostService)
		));

		const { button } = await dialog.show();
		disposables.dispose();

		return buttons[button]?.[1] ?? ChatSetupStrategy.Canceled;
	}

	private getButtons(options?: { forceSignInDialog?: boolean; forceAnonymous?: ChatSetupAnonymous }): Array<[string, ChatSetupStrategy, { styleButton?: (button: IButton) => void } | undefined]> {
		type ContinueWithButton = [string, ChatSetupStrategy, { styleButton?: (button: IButton) => void } | undefined];
		const styleButton = (...classes: string[]) => ({ styleButton: (button: IButton) => button.element.classList.add(...classes) });

		let buttons: Array<ContinueWithButton>;
		// SafeAppeals always owns sign-in. Do not fall back to the upstream
		// provider link while the Cloud extension is still registering.
		if (!options?.forceAnonymous && (this.context.state.entitlement === ChatEntitlement.Unknown || options?.forceSignInDialog)) {
			// Dedicated provider buttons — scopes skip the CloudAuthProvider quick pick.
			buttons = [
				[localize('continueWithGoogle', "Continue with Google"), ChatSetupStrategy.SetupWithSafeAppealsCloudGoogle, styleButton('continue-button', 'google')],
				[localize('continueWithOutlook', "Continue with Outlook"), ChatSetupStrategy.SetupWithSafeAppealsCloudOutlook, styleButton('continue-button', 'outlook')],
				[localize('continueWithSlack', "Continue with Slack"), ChatSetupStrategy.SetupWithSafeAppealsCloudSlack, styleButton('continue-button', 'slack')],
			];
		} else {
			buttons = [[localize('setupAIButton', "Use AI Features"), ChatSetupStrategy.DefaultSetup, undefined]];
		}

		return buttons;
	}

	private getDialogTitle(options?: { forceSignInDialog?: boolean; forceAnonymous?: ChatSetupAnonymous; dialogTitle?: string }): string {
		if (options?.dialogTitle) {
			return options.dialogTitle;
		}

		if (this.chatEntitlementService.anonymous) {
			if (options?.forceAnonymous) {
				return localize('startUsing', "Start using AI Features");
			} else {
				return localize('enableMore', "Enable more AI features");
			}
		}

		if (this.context.state.entitlement === ChatEntitlement.Unknown || options?.forceSignInDialog) {
			// SafeAppeals: rebrand dialog title when Cloud path still reaches ChatSetup
			if (this.usesSafeAppealsCloudSetup()) {
				return localize('signInSafeAppealsCloud', "Sign in to SafeAppeals Cloud");
			}
			return localize('signIn', "Sign in to use SafeAppeals");
		}

		return localize('startUsing', "Start using AI Features");
	}

	private createDialogFooter(disposables: DisposableStore, options?: { forceAnonymous?: ChatSetupAnonymous }): HTMLElement {
		const element = $('.chat-setup-dialog-footer');


		let footer: string;
		if (this.usesSafeAppealsCloudSetup()) {
			footer = localize('safeAppealsCloudFooter', "Sign in with Google, Outlook, or Slack to use SafeAppeals Cloud Chat. Mailbox connect is separate under Email settings.");
		} else {
			footer = localize({ key: 'safeAppealsFooter', comment: ['{Locked="]({0})"}', '{Locked="]({1})"}'] }, "By continuing with SafeAppeals, you agree to [Terms]({0}) and [Privacy Statement]({1}).", defaultChat.termsStatementUrl, defaultChat.privacyStatementUrl);
		}
		element.appendChild($('p', undefined, disposables.add(this.markdownRendererService.render(new MarkdownString(footer, { isTrusted: true }))).element));

		return element;
	}
}

//#endregion

export function refreshTokens(commandService: ICommandService): void {
	// ugly, but we need to signal to the extension that entitlements changed
	commandService.executeCommand(defaultChat.chatRefreshTokenCommand);
}
