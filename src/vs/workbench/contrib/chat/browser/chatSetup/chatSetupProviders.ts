/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/chatSetup.css';
import { WorkbenchActionExecutedClassification, WorkbenchActionExecutedEvent } from '../../../../../base/common/actions.js';
import { raceTimeout, timeout } from '../../../../../base/common/async.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { isCancellationError } from '../../../../../base/common/errors.js';
import { toErrorMessage } from '../../../../../base/common/errorMessage.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Lazy } from '../../../../../base/common/lazy.js';
import { Disposable, DisposableStore, IDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../../nls.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import product from '../../../../../platform/product/common/product.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IWorkspaceTrustManagementService } from '../../../../../platform/workspace/common/workspaceTrust.js';
import { IAuthenticationService } from '../../../../services/authentication/common/authentication.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { nullExtensionDescription } from '../../../../services/extensions/common/extensions.js';
import { CountTokensCallback, ILanguageModelToolsService, IPreparedToolInvocation, IToolData, IToolImpl, IToolInvocation, IToolResult, ToolDataSource, ToolProgress } from '../../common/tools/languageModelToolsService.js';
import { IChatAgentHistoryEntry, IChatAgentImplementation, IChatAgentRequest, IChatAgentResult, IChatAgentService } from '../../common/participants/chatAgents.js';
import { ChatEntitlementContext, chatRequiresSetup, IChatEntitlementService } from '../../../../services/chat/common/chatEntitlementService.js';
import { ChatModel, ChatRequestModel, IChatRequestModel, IChatRequestVariableData } from '../../common/model/chatModel.js';
import { ChatMode } from '../../common/chatModes.js';
import { ChatRequestAgentPart, ChatRequestToolPart } from '../../common/requestParser/chatParserTypes.js';
import { IChatProgress, IChatService, ToolConfirmKind } from '../../common/chatService/chatService.js';
import { IChatRequestToolEntry } from '../../common/attachments/chatVariableEntries.js';
import { ChatAgentLocation, ChatConfiguration, ChatModeKind } from '../../common/constants.js';
import { ChatMessageRole, IChatMessage, IChatResponseToolUsePart, ILanguageModelChatRequestOptions, ILanguageModelsService, SAFEAPPEALS_CLOUD_VENDOR_ID } from '../../common/languageModels.js';
import { buildSafeAppealsAskCloudSystemPrompt, buildSafeAppealsAskCloudSystemPromptWithoutSwitchTool, buildSafeAppealsCloudChatMessages, buildSafeAppealsSwitchModeLmTool, hasLiveSafeAppealsCloudModel, hasUsableNonCoreDefaultAgent, isSafeAppealsCloudAgentActivated, isSuccessfulSwitchModeResultText, pickSafeAppealsCloudModelId, resolveChatSetupTimeoutWarning, resolveCloudAgentModeUnavailableMessage, SAFEAPPEALS_AGENT_PARTICIPANT_ID, SAFEAPPEALS_ASK_CLOUD_SWITCH_MODE_MAX_ROUNDS, SAFEAPPEALS_SWITCH_MODE_TOOL_ID, shouldFailFastCloudAgentMode, shouldSkipAuthExtensionEnableForCloudAgent, shouldSkipToolsModelWaitForCloudAgent, shouldTreatLiveCloudModelAsLanguageModelReady, shouldUseCloudAgentReadinessPath, toolResultContentToText, usesSafeAppealsCloudSetup } from '../../common/chatSetupCloudHelpers.js';
import { CHAT_OPEN_ACTION_ID, CHAT_SETUP_ACTION_ID } from '../actions/chatActions.js';
import { ChatViewId, IChatWidgetService } from '../chat.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { ChatViewPane } from '../widgetHosts/viewPane/chatViewPane.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { CodeAction, CodeActionList, Command, NewSymbolName, NewSymbolNameTriggerKind } from '../../../../../editor/common/languages.js';
import { ITextModel } from '../../../../../editor/common/model.js';
import { IRange, Range } from '../../../../../editor/common/core/range.js';
import { ISelection, Selection } from '../../../../../editor/common/core/selection.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { CodeActionKind } from '../../../../../editor/contrib/codeAction/common/types.js';
import { ACTION_START as INLINE_CHAT_START } from '../../../inlineChat/common/inlineChat.js';
import { IPosition } from '../../../../../editor/common/core/position.js';
import { IMarker, IMarkerService, MarkerSeverity } from '../../../../../platform/markers/common/markers.js';
import { ChatSetupController } from './chatSetupController.js';
import { ChatGlobalPerfMark, markChatGlobal } from '../../common/chatPerf.js';
import { ChatSetupAnonymous, ChatSetupStep, IChatSetupResult, maybeEnableAuthExtension, refreshTokens } from './chatSetup.js';
import { ChatSetup } from './chatSetupRunner.js';
import { chatViewsWelcomeRegistry } from '../viewsWelcome/chatViewsWelcome.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IDefaultAccountService } from '../../../../../platform/defaultAccount/common/defaultAccount.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { IOutputService } from '../../../../services/output/common/output.js';
import { IExtensionsWorkbenchService } from '../../../extensions/common/extensions.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';

const defaultChat = {
	extensionId: product.defaultChatAgent?.extensionId ?? '',
	chatExtensionId: product.defaultChatAgent?.chatExtensionId ?? '',
	provider: product.defaultChatAgent?.provider ?? { default: { id: '', name: '' }, enterprise: { id: '', name: '' }, apple: { id: '', name: '' }, google: { id: '', name: '' } },
	outputChannelId: product.defaultChatAgent?.chatExtensionOutputId ?? '',
	outputExtensionStateCommand: product.defaultChatAgent?.chatExtensionOutputExtensionStateCommand ?? '',
};

const ToolsAgentContextKey = ContextKeyExpr.and(
	ContextKeyExpr.equals(`config.${ChatConfiguration.AgentEnabled}`, true),
	ContextKeyExpr.not(`previewFeaturesDisabled`) // Set by extension
);

export class SetupAgent extends Disposable implements IChatAgentImplementation {

	static registerDefaultAgents(instantiationService: IInstantiationService, location: ChatAgentLocation, mode: ChatModeKind, context: ChatEntitlementContext, controller: Lazy<ChatSetupController>): { agent: SetupAgent; disposable: IDisposable } {
		return instantiationService.invokeFunction(accessor => {
			const chatAgentService = accessor.get(IChatAgentService);

			let description;
			if (mode === ChatModeKind.Ask) {
				description = ChatMode.Ask.description.get();
			} else if (mode === ChatModeKind.Edit) {
				description = ChatMode.Edit.description.get();
			} else {
				description = ChatMode.Agent.description.get();
			}

			let id: string;
			switch (location) {
				case ChatAgentLocation.Chat:
					if (mode === ChatModeKind.Ask) {
						id = 'setup.chat';
					} else if (mode === ChatModeKind.Edit) {
						id = 'setup.edits';
					} else {
						id = 'setup.agent';
					}
					break;
				case ChatAgentLocation.Terminal:
					id = 'setup.terminal';
					break;
				case ChatAgentLocation.EditorInline:
					id = 'setup.editor';
					break;
				case ChatAgentLocation.Notebook:
					id = 'setup.notebook';
					break;
			}

			// Setup agents are only default for Ask/Edit modes. For Agent mode, SafeAppeals agent should be default.
			const isDefault = mode !== ChatModeKind.Agent;

			return SetupAgent.doRegisterAgent(instantiationService, chatAgentService, id, `${defaultChat.provider.default.name} Copilot` /* Do NOT change, this hides the username altogether in Chat */, isDefault, description, location, mode, context, controller);
		});
	}

	static registerBuiltInAgents(instantiationService: IInstantiationService, context: ChatEntitlementContext, controller: Lazy<ChatSetupController>): IDisposable {
		return instantiationService.invokeFunction(accessor => {
			const chatAgentService = accessor.get(IChatAgentService);

			const disposables = new DisposableStore();

			// Register VSCode agent
			const { disposable: vscodeDisposable } = SetupAgent.doRegisterAgent(instantiationService, chatAgentService, 'setup.vscode', 'vscode', false, localize2('vscodeAgentDescription', "Ask questions about VS Code").value, ChatAgentLocation.Chat, ChatModeKind.Agent, context, controller);
			disposables.add(vscodeDisposable);

			// Register workspace agent
			const { disposable: workspaceDisposable } = SetupAgent.doRegisterAgent(instantiationService, chatAgentService, 'setup.workspace', 'workspace', false, localize2('workspaceAgentDescription', "Ask about your workspace").value, ChatAgentLocation.Chat, ChatModeKind.Agent, context, controller);
			disposables.add(workspaceDisposable);

			// Register terminal agent
			const { disposable: terminalDisposable } = SetupAgent.doRegisterAgent(instantiationService, chatAgentService, 'setup.terminal.agent', 'terminal', false, localize2('terminalAgentDescription', "Ask how to do something in the terminal").value, ChatAgentLocation.Chat, ChatModeKind.Agent, context, controller);
			disposables.add(terminalDisposable);

			// Register tools
			disposables.add(SetupTool.registerTool(instantiationService, {
				id: 'setup_tools_createNewWorkspace',
				source: ToolDataSource.Internal,
				icon: Codicon.newFolder,
				displayName: localize('setupToolDisplayName', "New Workspace"),
				modelDescription: 'Scaffold a new workspace in VS Code',
				userDescription: localize('setupToolsDescription', "Scaffold a new workspace in VS Code"),
				canBeReferencedInPrompt: true,
				toolReferenceName: 'new',
				when: ContextKeyExpr.true(),
			}));

			return disposables;
		});
	}

	private static doRegisterAgent(instantiationService: IInstantiationService, chatAgentService: IChatAgentService, id: string, name: string, isDefault: boolean, description: string, location: ChatAgentLocation, mode: ChatModeKind, context: ChatEntitlementContext, controller: Lazy<ChatSetupController>): { agent: SetupAgent; disposable: IDisposable } {
		const disposables = new DisposableStore();
		disposables.add(chatAgentService.registerAgent(id, {
			id,
			name,
			isDefault,
			isCore: true,
			modes: [mode],
			when: mode === ChatModeKind.Agent ? ToolsAgentContextKey?.serialize() : undefined,
			slashCommands: [],
			disambiguation: [],
			locations: [location],
			metadata: { helpTextPrefix: SetupAgent.SETUP_NEEDED_MESSAGE },
			description,
			extensionId: nullExtensionDescription.identifier,
			extensionVersion: undefined,
			extensionDisplayName: nullExtensionDescription.name,
			extensionPublisherId: nullExtensionDescription.publisher
		}));

		const agent = disposables.add(instantiationService.createInstance(SetupAgent, context, controller, location, mode));
		disposables.add(chatAgentService.registerAgentImplementation(id, agent));
		if (mode === ChatModeKind.Agent) {
			chatAgentService.updateAgent(id, { themeIcon: Codicon.tools });
		}

		return { agent, disposable: disposables };
	}

	// SafeAppeals: product fork — Chat cancel/setup copy points at SafeAppeals Cloud, not Copilot
	private static readonly SETUP_NEEDED_MESSAGE = new MarkdownString(localize('settingUpSafeAppealsCloudNeeded', "You need to sign in to SafeAppeals Cloud to use Chat."));
	private static readonly TRUST_NEEDED_MESSAGE = new MarkdownString(localize('trustNeeded', "You need to trust this workspace to use Chat."));

	private static readonly CHAT_RETRY_COMMAND_ID = 'workbench.action.chat.retrySetup';
	private static readonly CHAT_SHOW_OUTPUT_COMMAND_ID = 'workbench.action.chat.showOutput';

	/** SafeAppeals: warn once when Ask/Edit Cloud cannot find switchMode. */
	private static _warnedMissingSwitchModeTool = false;

	private readonly _onUnresolvableError = this._register(new Emitter<void>());
	readonly onUnresolvableError = this._onUnresolvableError.event;

	private readonly pendingForwardedRequests = new ResourceMap<Promise<void>>();

	constructor(
		private readonly context: ChatEntitlementContext,
		private readonly controller: Lazy<ChatSetupController>,
		private readonly location: ChatAgentLocation,
		private readonly mode: ChatModeKind,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IWorkspaceTrustManagementService private readonly workspaceTrustManagementService: IWorkspaceTrustManagementService,
		@IChatEntitlementService private readonly chatEntitlementService: IChatEntitlementService,
		@IAuthenticationService private readonly authenticationService: IAuthenticationService,
		@IChatAgentService private readonly chatAgentService: IChatAgentService,
		@IViewsService private readonly viewsService: IViewsService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IOutputService private readonly outputService: IOutputService,
		@IExtensionsWorkbenchService private readonly extensionsWorkbenchService: IExtensionsWorkbenchService,
		@ICommandService private readonly commandService: ICommandService,
		@IExtensionService private readonly extensionService: IExtensionService,
	) {
		super();

		this.registerCommands();
	}

	/** SafeAppeals: Ask (and Edit) can answer via Cloud LM vendor; Agent needs tools/Copilot. */
	private usesCloudLanguageModelPath(): boolean {
		return this.mode === ChatModeKind.Ask || this.mode === ChatModeKind.Edit;
	}

	private registerCommands(): void {

		// Retry chat command
		this._register(CommandsRegistry.registerCommand(SetupAgent.CHAT_RETRY_COMMAND_ID, async (accessor, sessionResource: URI) => {
			const hostService = accessor.get(IHostService);
			const chatWidgetService = accessor.get(IChatWidgetService);

			const widget = chatWidgetService.getWidgetBySessionResource(sessionResource);
			await widget?.clear();

			hostService.reload();
		}));

		// Show output command: execute extension state command if available, then show output channel
		this._register(CommandsRegistry.registerCommand(SetupAgent.CHAT_SHOW_OUTPUT_COMMAND_ID, async (accessor) => {
			const commandService = accessor.get(ICommandService);

			if (defaultChat.outputExtensionStateCommand) {
				// Command invocation may fail or is blocked by the extension activating
				// so we just don't wait and timeout after a certain time, logging the error if it fails or times out.
				raceTimeout(
					commandService.executeCommand(defaultChat.outputExtensionStateCommand),
					5000,
					() => this.logService.info('[chat setup] Timed out executing extension state command')
				).then(undefined, error => {
					this.logService.info('[chat setup] Failed to execute extension state command', error);
				});
			}

			if (defaultChat.outputChannelId) {
				await commandService.executeCommand(`workbench.action.output.show.${defaultChat.outputChannelId}`);
			}
		}));
	}

	async invoke(request: IChatAgentRequest, progress: (parts: IChatProgress[]) => void, history: IChatAgentHistoryEntry[], token: CancellationToken): Promise<IChatAgentResult> {
		return this.instantiationService.invokeFunction(async accessor /* using accessor for lazy loading */ => {
			const chatService = accessor.get(IChatService);
			const languageModelsService = accessor.get(ILanguageModelsService);
			const chatWidgetService = accessor.get(IChatWidgetService);
			const chatAgentService = accessor.get(IChatAgentService);
			const languageModelToolsService = accessor.get(ILanguageModelToolsService);
			const defaultAccountService = accessor.get(IDefaultAccountService);

			return this.doInvoke(request, part => progress([part]), chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService, defaultAccountService, history, token);
		});
	}

	private async doInvoke(request: IChatAgentRequest, progress: (part: IChatProgress) => void, chatService: IChatService, languageModelsService: ILanguageModelsService, chatWidgetService: IChatWidgetService, chatAgentService: IChatAgentService, languageModelToolsService: ILanguageModelToolsService, defaultAccountService: IDefaultAccountService, history: IChatAgentHistoryEntry[] = [], token: CancellationToken = CancellationToken.None): Promise<IChatAgentResult> {
		// SafeAppeals: Cloud shortcut must not bypass workspace trust — fall through to ChatSetup.run() trust gate
		const workspaceTrusted = !this.context.state.untrusted && this.workspaceTrustManagementService.isWorkspaceTrusted();
		if (workspaceTrusted && this.usesSafeAppealsCloudSetup(languageModelsService)) {
			if (await this.hasSafeAppealsCloudSession()) {
				// SafeAppeals: Ask/Edit answer via Cloud LM — do not wait for GitHub.copilot-chat
				if (this.usesCloudLanguageModelPath()) {
					return this.doInvokeWithCloudLanguageModel(request, progress, languageModelsService, chatWidgetService, languageModelToolsService, history, token);
				}
				// SafeAppeals: Agent + Cloud without a tools agent hangs on activateDefaultAgent — fail fast
				if (this.isCloudAgentModeUnavailable(chatAgentService, true)) {
					return this.replyCloudAgentModeUnavailable(progress);
				}
				return this.doInvokeWithoutSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService);
			}
			return this.doInvokeWithSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService, defaultAccountService, history, token);
		}

		if (chatRequiresSetup({
			completed: !!this.context.state.completed,
			disabled: !!this.context.state.disabled,
			untrusted: !!this.context.state.untrusted,
			entitlement: this.context.state.entitlement,
			anonymous: this.chatEntitlementService.anonymous,
			hasByokModels: this.chatEntitlementService.hasByokModels,
		})) {
			return this.doInvokeWithSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService, defaultAccountService, history, token);
		}

		return this.doInvokeWithoutSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService, languageModelToolsService);
	}

	/**
	 * SafeAppeals: answer Ask/Edit directly via the Cloud LM vendor.
	 * Cloud models advertise toolCalling:true — Ask/Edit may call safeappeals_switchMode; never wait for Copilot chat agent.
	 */
	private async doInvokeWithCloudLanguageModel(request: IChatAgentRequest, progress: (part: IChatProgress) => void, languageModelsService: ILanguageModelsService, chatWidgetService: IChatWidgetService, languageModelToolsService: ILanguageModelToolsService, history: IChatAgentHistoryEntry[], token: CancellationToken): Promise<IChatAgentResult> {
		const userText = request.message.trim();
		if (!userText) {
			return {};
		}

		try {
			const widget = chatWidgetService.getWidgetBySessionResource(request.sessionResource);
			const preferredModelId = request.userSelectedModelId
				?? widget?.getSelectedModelRequestOptions().userSelectedModelId
				?? widget?.viewModel?.model.getRequests().at(-1)?.modelId;

			let cloudModelIds = languageModelsService.getLanguageModelIds().filter(id => languageModelsService.lookupLanguageModel(id)?.vendor === SAFEAPPEALS_CLOUD_VENDOR_ID);
			if (cloudModelIds.length === 0) {
				cloudModelIds = await languageModelsService.selectLanguageModels({ vendor: SAFEAPPEALS_CLOUD_VENDOR_ID });
			}

			const modelId = pickSafeAppealsCloudModelId(preferredModelId, cloudModelIds);
			if (!modelId) {
				progress({
					kind: 'warning',
					content: new MarkdownString(localize('safeAppealsCloudNoModel', "No SafeAppeals Cloud model is available. Sign in to SafeAppeals Cloud and ensure a cloud model is selected, then try again."))
				});
				return {};
			}

			const modeLabel = this.mode === ChatModeKind.Edit ? 'Edit' : 'Ask';
			const switchModeTool = languageModelToolsService.getTool(SAFEAPPEALS_SWITCH_MODE_TOOL_ID);
			if (!switchModeTool && !SetupAgent._warnedMissingSwitchModeTool) {
				SetupAgent._warnedMissingSwitchModeTool = true;
				this.logService.warn('[chat setup] SafeAppeals switchMode tool not registered; Ask/Edit Cloud will run text-only');
			}

			const systemPrompt = switchModeTool
				? buildSafeAppealsAskCloudSystemPrompt(modeLabel)
				: buildSafeAppealsAskCloudSystemPromptWithoutSwitchTool(modeLabel);
			const messages: IChatMessage[] = buildSafeAppealsCloudChatMessages({
				systemPrompt,
				history: history.map(entry => ({
					userText: entry.request.message,
					assistantText: this.cloudHistoryResponseToText(entry),
				})),
				userText,
			});

			const requestOptions: ILanguageModelChatRequestOptions = switchModeTool
				? {
					tools: [buildSafeAppealsSwitchModeLmTool(switchModeTool)],
					toolMode: 1, // Auto
				}
				: {};

			for (let round = 0; round < SAFEAPPEALS_ASK_CLOUD_SWITCH_MODE_MAX_ROUNDS; round++) {
				if (token.isCancellationRequested) {
					return {};
				}

				const response = await languageModelsService.sendChatRequest(modelId, undefined, messages, requestOptions, token);
				const toolUseParts: IChatResponseToolUsePart[] = [];
				const assistantContent: IChatMessage['content'] = [];

				for await (const part of response.stream) {
					if (token.isCancellationRequested) {
						return {};
					}
					const streamParts = Array.isArray(part) ? part : [part];
					for (const p of streamParts) {
						if (p.type === 'text' && p.value) {
							assistantContent.push({ type: 'text', value: p.value });
							progress({
								kind: 'markdownContent',
								content: new MarkdownString(p.value, { supportThemeIcons: true })
							});
						} else if (p.type === 'tool_use') {
							toolUseParts.push(p);
							assistantContent.push(p);
						}
					}
				}

				await response.result;

				if (!switchModeTool || toolUseParts.length === 0) {
					return {};
				}

				const toolResultParts: IChatMessage['content'] = [];
				let switched = false;
				for (const toolUse of toolUseParts) {
					if (toolUse.name !== SAFEAPPEALS_SWITCH_MODE_TOOL_ID) {
						const skipped = `Error: tool "${toolUse.name}" is not allowed in Ask/Edit Cloud.`;
						toolResultParts.push({
							type: 'tool_result',
							toolCallId: toolUse.toolCallId,
							value: [{ type: 'text', value: skipped }],
							isError: true,
						});
						continue;
					}

					const toolResult = await languageModelToolsService.invokeTool(
						{
							callId: toolUse.toolCallId,
							toolId: SAFEAPPEALS_SWITCH_MODE_TOOL_ID,
							parameters: toolUse.parameters ?? {},
							context: { sessionResource: request.sessionResource, workingDirectory: request.workingDirectory },
							chatRequestId: request.requestId,
							chatStreamToolCallId: toolUse.toolCallId,
							preApproved: { type: ToolConfirmKind.ConfirmationNotNeeded, reason: 'SafeAppeals Ask mode switch' },
						},
						async () => 0,
						token,
					);
					const resultText = toolResultContentToText(toolResult.content);
					if (resultText) {
						progress({
							kind: 'markdownContent',
							content: new MarkdownString(resultText, { supportThemeIcons: true })
						});
					}
					toolResultParts.push({
						type: 'tool_result',
						toolCallId: toolUse.toolCallId,
						value: [{ type: 'text', value: resultText }],
						isError: resultText.startsWith('Error'),
					});
					if (isSuccessfulSwitchModeResultText(resultText)) {
						switched = true;
					}
				}

				if (switched) {
					return {};
				}

				messages.push({ role: ChatMessageRole.Assistant, content: assistantContent });
				messages.push({ role: ChatMessageRole.User, content: toolResultParts });
			}
		} catch (error) {
			if (isCancellationError(error) || token.isCancellationRequested) {
				return {};
			}
			this.logService.error('[chat setup] SafeAppeals Cloud language model request failed', error);
			const message = toErrorMessage(error);
			const creditsHint = /credit/i.test(message)
				? localize('safeAppealsCloudCreditsWarning', "Not enough SafeAppeals Cloud credits for this request. Add credits to continue.")
				: localize('safeAppealsCloudRequestFailed', "SafeAppeals Cloud failed to respond: {0}", message);
			progress({
				kind: 'warning',
				content: new MarkdownString(creditsHint)
			});
		}

		return {};
	}

	/** SafeAppeals: flatten prior assistant markdown parts to plain text for LM history. */
	private cloudHistoryResponseToText(entry: IChatAgentHistoryEntry): string {
		const parts: string[] = [];
		for (const part of entry.response) {
			if (part.kind === 'markdownContent') {
				parts.push(part.content.value);
			}
		}
		return parts.join('');
	}

	/** SafeAppeals: Agent on Cloud with only the core setup agent — do not wait/resend. */
	private isCloudAgentModeUnavailable(chatAgentService: IChatAgentService, hasSafeAppealsCloudSession: boolean): boolean {
		const defaultAgent = chatAgentService.getDefaultAgent(this.location, this.mode);
		// Prefer a contributed (possibly not-yet-activated) non-core default for this mode/location
		// so fail-fast does not race extension activation. Fall back to location-wide contributed default.
		const contributedForMode = chatAgentService.getAgents().find(a =>
			!!a.isDefault && !a.isCore && a.locations.includes(this.location) && a.modes.includes(this.mode));
		const contributedDefaultAgent = contributedForMode ?? chatAgentService.getContributedDefaultAgent(this.location);
		return shouldFailFastCloudAgentMode({
			isAgentMode: this.mode === ChatModeKind.Agent,
			hasSafeAppealsCloudSession,
			hasUsableNonCoreDefaultAgent: hasUsableNonCoreDefaultAgent({
				activatedDefaultAgent: defaultAgent,
				contributedDefaultAgent,
				mode: this.mode,
			}),
		});
	}

	private replyCloudAgentModeUnavailable(progress: (part: IChatProgress) => void): IChatAgentResult {
		progress({
			kind: 'markdownContent',
			content: new MarkdownString(resolveCloudAgentModeUnavailableMessage())
		});
		return {};
	}

	/** SafeAppeals: true when Cloud LM vendor is registered (or hasByokModels + cloud auth ready). */
	private usesSafeAppealsCloudSetup(languageModelsService: ILanguageModelsService): boolean {
		return usesSafeAppealsCloudSetup({
			getVendors: () => languageModelsService.getVendors(),
			hasByokModels: this.chatEntitlementService.hasByokModels,
			isAuthenticationProviderRegistered: (id) => this.authenticationService.isAuthenticationProviderRegistered(id),
		});
	}

	/** SafeAppeals: whether a SafeAppeals Cloud auth session already exists. */
	private async hasSafeAppealsCloudSession(): Promise<boolean> {
		try {
			if (!this.authenticationService.isAuthenticationProviderRegistered(SAFEAPPEALS_CLOUD_VENDOR_ID)) {
				return false;
			}
			const sessions = await this.authenticationService.getSessions(SAFEAPPEALS_CLOUD_VENDOR_ID, undefined, undefined, true);
			return sessions.length > 0;
		} catch {
			return false;
		}
	}

	private async doInvokeWithoutSetup(request: IChatAgentRequest, progress: (part: IChatProgress) => void, chatService: IChatService, languageModelsService: ILanguageModelsService, chatWidgetService: IChatWidgetService, chatAgentService: IChatAgentService, languageModelToolsService: ILanguageModelToolsService): Promise<IChatAgentResult> {
		const requestModel = chatWidgetService.getWidgetBySessionResource(request.sessionResource)?.viewModel?.model.getRequests().at(-1);
		if (!requestModel) {
			this.logService.error('[chat setup] Request model not found, cannot redispatch request.');
			return {}; // this should not happen
		}

		progress({
			kind: 'progressMessage',
			content: new MarkdownString(localize('waitingChat', "Getting chat ready")),
			shimmer: true,
		});

		await this.forwardRequestToChat(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService);

		return {};
	}

	private async forwardRequestToChat(requestModel: IChatRequestModel, progress: (part: IChatProgress) => void, chatService: IChatService, languageModelsService: ILanguageModelsService, chatAgentService: IChatAgentService, chatWidgetService: IChatWidgetService, languageModelToolsService: ILanguageModelToolsService): Promise<void> {
		try {
			await this.doForwardRequestToChat(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService);
		} catch (error) {
			this.logService.error('[chat setup] Failed to forward request to chat', error);

			progress({
				kind: 'warning',
				content: new MarkdownString(localize('copilotUnavailableWarning', "Failed to get a response. Please try again."))
			});
		}
	}

	private async doForwardRequestToChat(requestModel: IChatRequestModel, progress: (part: IChatProgress) => void, chatService: IChatService, languageModelsService: ILanguageModelsService, chatAgentService: IChatAgentService, chatWidgetService: IChatWidgetService, languageModelToolsService: ILanguageModelToolsService): Promise<void> {
		if (this.pendingForwardedRequests.has(requestModel.session.sessionResource)) {
			throw new Error('Request already in progress');
		}

		const forwardRequest = this.doForwardRequestToChatWhenReady(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService);
		this.pendingForwardedRequests.set(requestModel.session.sessionResource, forwardRequest);

		try {
			await forwardRequest;
		} finally {
			this.pendingForwardedRequests.delete(requestModel.session.sessionResource);
		}
	}

	private async doForwardRequestToChatWhenReady(requestModel: IChatRequestModel, progress: (part: IChatProgress) => void, chatService: IChatService, languageModelsService: ILanguageModelsService, chatAgentService: IChatAgentService, chatWidgetService: IChatWidgetService, languageModelToolsService: ILanguageModelToolsService): Promise<void> {

		const usesSafeAppealsCloud = this.usesSafeAppealsCloudSetup(languageModelsService);
		const hasSafeAppealsCloudSession = usesSafeAppealsCloud && await this.hasSafeAppealsCloudSession();

		// SafeAppeals: Cloud-only Agent never becomes ready — skip wait/resend loop
		if (
			usesSafeAppealsCloud
			&& hasSafeAppealsCloudSession
			&& this.isCloudAgentModeUnavailable(chatAgentService, true)
		) {
			this.replyCloudAgentModeUnavailable(progress);
			return;
		}

		const isCloudAgentReadinessPath = shouldUseCloudAgentReadinessPath({
			isAgentMode: this.mode === ChatModeKind.Agent,
			usesSafeAppealsCloudSetup: usesSafeAppealsCloud,
			hasSafeAppealsCloudSession,
		});

		// Ensure auth extension is enabled before waiting for chat readiness.
		// This must run before the readiness event listeners are set up because
		// updateRunningExtensions restarts all extension hosts.
		// SafeAppeals: Cloud Agent must not trigger GitHub auth extension-host restart.
		if (!shouldSkipAuthExtensionEnableForCloudAgent({ isCloudAgentReadinessPath })) {
			const authExtensionReEnabled = await maybeEnableAuthExtension(this.extensionsWorkbenchService, this.logService);
			if (authExtensionReEnabled) {
				refreshTokens(this.commandService);
			}
		}

		const widget = chatWidgetService.getWidgetBySessionResource(requestModel.session.sessionResource);
		const modeInfo = widget?.input.currentModeInfo;

		// We need a signal to know when we can resend the request to
		// Chat. Waiting for the registration of the agent is not
		// enough, we also need a language/tools model to be available.

		let agentActivated = false;
		let agentReady = false;
		let languageModelReady = false;
		let toolsModelReady = false;

		markChatGlobal(ChatGlobalPerfMark.WillWaitForActivation);

		// SafeAppeals: Cloud Agent activates/waits for `safeappeals.agent` — not Copilot default agent.
		let whenAgentActivated: Promise<void>;
		let whenAgentReady: Promise<boolean> | undefined;
		if (isCloudAgentReadinessPath) {
			whenAgentActivated = this.whenSafeAppealsCloudAgentActivated().then(() => { agentActivated = true; });
			whenAgentReady = this.whenSafeAppealsCloudAgentReady(chatAgentService)?.then(() => agentReady = true);
		} else {
			whenAgentActivated = this.whenAgentActivated(chatService).then(() => { agentActivated = true; });
			whenAgentReady = this.whenAgentReady(chatAgentService, modeInfo?.kind)?.then(() => agentReady = true);
			// SafeAppeals: Ask/Edit + Cloud session + live models — skip Copilot agent wait
			if (whenAgentReady && this.usesCloudLanguageModelPath() && usesSafeAppealsCloud && hasSafeAppealsCloudSession) {
				const hasLiveCloudModel = await this.resolveHasLiveCloudModel(languageModelsService);
				if (hasLiveCloudModel) {
					agentReady = true;
					whenAgentReady = undefined;
				}
			}
		}
		if (!whenAgentReady) {
			agentReady = true;
		}

		// SafeAppeals: Cloud models never set isDefaultForLocation — treat any live cloud model as LM-ready.
		let whenLanguageModelReady: Promise<boolean> | undefined;
		const hasLiveCloudModel = (usesSafeAppealsCloud && hasSafeAppealsCloudSession)
			? await this.resolveHasLiveCloudModel(languageModelsService)
			: false;
		if (shouldTreatLiveCloudModelAsLanguageModelReady({
			usesSafeAppealsCloudSetup: usesSafeAppealsCloud,
			hasSafeAppealsCloudSession,
			hasLiveCloudModel,
		})) {
			languageModelReady = true;
			whenLanguageModelReady = undefined;
		} else if (isCloudAgentReadinessPath) {
			whenLanguageModelReady = this.whenCloudLanguageModelReady(languageModelsService)?.then(() => languageModelReady = true);
		} else {
			whenLanguageModelReady = this.whenLanguageModelReady(languageModelsService, requestModel.modelId)?.then(() => languageModelReady = true);
		}
		if (!whenLanguageModelReady) {
			languageModelReady = true;
		}

		let whenToolsModelReady: Promise<boolean> | undefined;
		if (shouldSkipToolsModelWaitForCloudAgent({ isCloudAgentReadinessPath })) {
			toolsModelReady = true;
			whenToolsModelReady = undefined;
		} else {
			whenToolsModelReady = this.whenToolsModelReady(languageModelToolsService, requestModel)?.then(() => toolsModelReady = true);
		}
		if (!whenToolsModelReady) {
			toolsModelReady = true;
		}

		if (whenLanguageModelReady instanceof Promise || whenAgentReady instanceof Promise || whenToolsModelReady instanceof Promise) {
			const timeoutHandle = setTimeout(() => {
				progress({
					kind: 'progressMessage',
					content: new MarkdownString(localize('waitingChat2', "Chat is almost ready")),
					shimmer: true,
				});
			}, 10000);

			const disposables = new DisposableStore();
			disposables.add(toDisposable(() => clearTimeout(timeoutHandle)));
			try {
				const allReady = Promise.allSettled([
					whenAgentActivated,
					whenAgentReady,
					whenLanguageModelReady,
					whenToolsModelReady
				]);
				const ready = await Promise.race([
					timeout(this.environmentService.remoteAuthority ? 60000 /* increase for remote scenarios */ : 20000).then(() => 'timedout'),
					this.whenPanelAgentHasGuidance(disposables).then(() => 'panelGuidance'),
					allReady
				]);

				if (ready === 'panelGuidance') {
					const warningMessage = localize('chatTookLongWarningExtension', "Please try again.");

					progress({
						kind: 'markdownContent',
						content: new MarkdownString(warningMessage)
					});

					// This means Chat is unhealthy and we cannot retry the
					// request. Signal this to the outside via an event.
					this._onUnresolvableError.fire();
					return;
				}

				if (ready === 'timedout') {
					const warningMessage = resolveChatSetupTimeoutWarning({
						usesSafeAppealsCloud: this.usesSafeAppealsCloudSetup(languageModelsService),
						anonymous: this.chatEntitlementService.anonymous,
						providerName: defaultChat.provider.default.name,
						chatExtensionId: defaultChat.chatExtensionId,
					});

					const diagnosticInfo = this.computeDiagnosticInfo(agentActivated, agentReady, languageModelReady, toolsModelReady, requestModel, languageModelsService, chatAgentService, modeInfo);

					this.logService.warn(`[chat setup] ${warningMessage}`, diagnosticInfo);

					type ChatSetupTimeoutClassification = {
						owner: 'chrmarti';
						comment: 'Provides insight into chat setup timeouts.';
						agentActivated: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the agent was activated.' };
						agentReady: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the agent was ready.' };
						agentHasDefault: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether a default agent exists for the location and mode.' };
						agentDefaultIsCore: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the default agent is a core agent.' };
						agentHasContributedDefault: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether a contributed default agent exists for the location.' };
						agentContributedDefaultIsCore: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the contributed default agent is a core agent.' };
						agentActivatedCount: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; isMeasurement: true; comment: 'Number of activated agents at timeout.' };
						agentLocation: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The chat agent location.' };
						agentModeKind: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The chat mode kind.' };
						languageModelReady: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the language model was ready.' };
						languageModelCount: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; isMeasurement: true; comment: 'Number of registered language models at timeout.' };
						languageModelDefaultCount: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; isMeasurement: true; comment: 'Number of language models with isDefaultForLocation[Chat] set.' };
						languageModelHasRequestedModel: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether a specific model ID was requested.' };
						toolsModelReady: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the tools model was ready.' };
						isRemote: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether this is a remote scenario.' };
						isAnonymous: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether anonymous access is enabled.' };
						matchingWelcomeViewWhen: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The when clause of the matching extension welcome view, if any.' };
					};
					type ChatSetupTimeoutEvent = {
						agentActivated: boolean;
						agentReady: boolean;
						agentHasDefault: boolean;
						agentDefaultIsCore: boolean;
						agentHasContributedDefault: boolean;
						agentContributedDefaultIsCore: boolean;
						agentActivatedCount: number;
						agentLocation: string;
						agentModeKind: string;
						languageModelReady: boolean;
						languageModelCount: number;
						languageModelDefaultCount: number;
						languageModelHasRequestedModel: boolean;
						toolsModelReady: boolean;
						isRemote: boolean;
						isAnonymous: boolean;
						matchingWelcomeViewWhen: string;
					};

					this.telemetryService.publicLog2<ChatSetupTimeoutEvent, ChatSetupTimeoutClassification>('chatSetup.timeout', diagnosticInfo);

					progress({
						kind: 'warning',
						content: new MarkdownString(warningMessage)
					});

					if (defaultChat.outputChannelId && this.outputService.getChannelDescriptor(defaultChat.outputChannelId)) {
						progress({
							kind: 'command',
							command: {
								id: SetupAgent.CHAT_SHOW_OUTPUT_COMMAND_ID,
								title: localize('showCopilotChatDetails', "Show Details")
							}
						});
					} else {
						this.logService.warn(defaultChat.outputChannelId
							? `[chat setup] No output channel found for id '${defaultChat.outputChannelId}' to show details about chat setup timeout. Please ensure the ${defaultChat.chatExtensionId} extension is activated.`
							: '[chat setup] No output channel provided via product.json to show details about chat setup timeout.');
						progress({
							kind: 'command',
							command: {
								id: SetupAgent.CHAT_RETRY_COMMAND_ID,
								title: localize('retryChat', "Restart"),
								arguments: [requestModel.session.sessionResource]
							}
						});
					}

					// Wait for all readiness signals and log/send
					// telemetry about recovery after the timeout.
					await allReady;

					const recoveryDiagnosticInfo = this.computeDiagnosticInfo(agentActivated, agentReady, languageModelReady, toolsModelReady, requestModel, languageModelsService, chatAgentService, modeInfo);

					this.logService.info('[chat setup] Chat setup timeout recovered', recoveryDiagnosticInfo);

					type ChatSetupTimeoutRecoveryClassification = {
						owner: 'chrmarti';
						comment: 'Provides insight into chat setup timeout recovery.';
						agentActivated: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the agent was activated.' };
						agentReady: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the agent was ready.' };
						agentHasDefault: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether a default agent exists for the location and mode.' };
						agentDefaultIsCore: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the default agent is a core agent.' };
						agentHasContributedDefault: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether a contributed default agent exists for the location.' };
						agentContributedDefaultIsCore: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the contributed default agent is a core agent.' };
						agentActivatedCount: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; isMeasurement: true; comment: 'Number of activated agents at recovery time.' };
						agentLocation: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The chat agent location.' };
						agentModeKind: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The chat mode kind.' };
						languageModelReady: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the language model was ready.' };
						languageModelCount: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; isMeasurement: true; comment: 'Number of registered language models at recovery time.' };
						languageModelDefaultCount: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; isMeasurement: true; comment: 'Number of language models with isDefaultForLocation[Chat] set at recovery time.' };
						languageModelHasRequestedModel: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether a specific model ID was requested.' };
						toolsModelReady: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether the tools model was ready.' };
						isRemote: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether this is a remote scenario.' };
						isAnonymous: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Whether anonymous access is enabled.' };
						matchingWelcomeViewWhen: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The when clause of the matching extension welcome view, if any.' };
					};
					type ChatSetupTimeoutRecoveryEvent = {
						agentActivated: boolean;
						agentReady: boolean;
						agentHasDefault: boolean;
						agentDefaultIsCore: boolean;
						agentHasContributedDefault: boolean;
						agentContributedDefaultIsCore: boolean;
						agentActivatedCount: number;
						agentLocation: string;
						agentModeKind: string;
						languageModelReady: boolean;
						languageModelCount: number;
						languageModelDefaultCount: number;
						languageModelHasRequestedModel: boolean;
						toolsModelReady: boolean;
						isRemote: boolean;
						isAnonymous: boolean;
						matchingWelcomeViewWhen: string;
					};

					this.telemetryService.publicLog2<ChatSetupTimeoutRecoveryEvent, ChatSetupTimeoutRecoveryClassification>('chatSetup.timeoutRecovery', recoveryDiagnosticInfo);
				}
			} finally {
				disposables.dispose();
			}
		}

		markChatGlobal(ChatGlobalPerfMark.DidWaitForActivation);
		await chatService.resendRequest(requestModel, {
			...widget?.getModeRequestOptions(),
			modeInfo,
			...widget?.getSelectedModelRequestOptions()
		});
	}

	private async whenPanelAgentHasGuidance(disposables: DisposableStore): Promise<void> {
		const panelAgentHasGuidance = () => chatViewsWelcomeRegistry.get().some(descriptor => this.contextKeyService.contextMatchesRules(descriptor.when));

		if (panelAgentHasGuidance()) {
			return;
		}

		return new Promise<void>(resolve => {
			let descriptorKeys: Set<string> = new Set();
			const updateDescriptorKeys = () => {
				const descriptors = chatViewsWelcomeRegistry.get();
				descriptorKeys = new Set(descriptors.flatMap(d => d.when.keys()));
			};
			updateDescriptorKeys();

			const onDidChangeRegistry = Event.map(chatViewsWelcomeRegistry.onDidChange, () => 'registry' as const);
			const onDidChangeRelevantContext = Event.map(
				Event.filter(this.contextKeyService.onDidChangeContext, e => e.affectsSome(descriptorKeys)),
				() => 'context' as const
			);

			disposables.add(Event.any(
				onDidChangeRegistry,
				onDidChangeRelevantContext
			)(source => {
				if (source === 'registry') {
					updateDescriptorKeys();
				}
				if (panelAgentHasGuidance()) {
					resolve();
				}
			}));
		});
	}

	private whenLanguageModelReady(languageModelsService: ILanguageModelsService, modelId: string | undefined): Promise<unknown> | void {
		const hasModelForRequest = () => {
			if (modelId) {
				return !!languageModelsService.lookupLanguageModel(modelId);
			}

			for (const id of languageModelsService.getLanguageModelIds()) {
				const model = languageModelsService.lookupLanguageModel(id);
				if (model?.isDefaultForLocation[ChatAgentLocation.Chat]) {
					return true;
				}
			}

			return false;
		};

		if (hasModelForRequest()) {
			return;
		}

		return Event.toPromise(Event.filter(languageModelsService.onDidChangeLanguageModels, () => hasModelForRequest()));
	}

	/** SafeAppeals: resolve whether any live `safeappeals-cloud` model is registered. */
	private async resolveHasLiveCloudModel(languageModelsService: ILanguageModelsService): Promise<boolean> {
		const registeredVendors = languageModelsService.getLanguageModelIds().map(id => languageModelsService.lookupLanguageModel(id)?.vendor);
		if (hasLiveSafeAppealsCloudModel(registeredVendors)) {
			return true;
		}
		const selected = await languageModelsService.selectLanguageModels({ vendor: SAFEAPPEALS_CLOUD_VENDOR_ID });
		return selected.length > 0;
	}

	/** SafeAppeals: wait until any Cloud LM vendor model appears (no isDefaultForLocation required). */
	private whenCloudLanguageModelReady(languageModelsService: ILanguageModelsService): Promise<unknown> | void {
		const hasLiveCloudModel = () => hasLiveSafeAppealsCloudModel(
			languageModelsService.getLanguageModelIds().map(id => languageModelsService.lookupLanguageModel(id)?.vendor)
		);
		if (hasLiveCloudModel()) {
			this.logService.info('[chat setup] Cloud language model ready immediately');
			return;
		}
		this.logService.info('[chat setup] Waiting for cloud language model to become ready');
		return Event.toPromise(Event.filter(languageModelsService.onDidChangeLanguageModels, () => {
			const ready = hasLiveCloudModel();
			if (ready) {
				this.logService.info('[chat setup] Cloud language model now ready');
			}
			return ready;
		}));
	}

	private whenToolsModelReady(languageModelToolsService: ILanguageModelToolsService, requestModel: IChatRequestModel): Promise<unknown> | void {
		const needsToolsModel = requestModel.message.parts.some(part => part instanceof ChatRequestToolPart);
		if (!needsToolsModel) {
			this.logService.info('[chat setup] No tools needed in request, tools model ready immediately');
			return; // No tools in this request, no need to check
		}

		// check that tools other than setup. and internal tools are registered.
		for (const tool of languageModelToolsService.getAllToolsIncludingDisabled()) {
			if (tool.id.startsWith('copilot_') || tool.id.startsWith('safeappeals_')) {
				this.logService.info('[chat setup] Tools model ready immediately (found safeappeals_ or copilot_ tools)');
				return; // we have tools!
			}
		}

		this.logService.info('[chat setup] Waiting for tools model to become ready');
		return Event.toPromise(Event.filter(languageModelToolsService.onDidChangeTools, () => {
			for (const tool of languageModelToolsService.getAllToolsIncludingDisabled()) {
				if (tool.id.startsWith('copilot_') || tool.id.startsWith('safeappeals_')) {
					this.logService.info('[chat setup] Tools model now ready (found safeappeals_ or copilot_ tools)');
					return true; // we have tools!
				}
			}

			return false; // no external tools found
		}));
	}

	private whenAgentReady(chatAgentService: IChatAgentService, mode: ChatModeKind | undefined): Promise<unknown> | void {
		const defaultAgent = chatAgentService.getDefaultAgent(this.location, mode);
		if (defaultAgent && !defaultAgent.isCore) {
			return; // we have a default agent from an extension!
		}

		return Event.toPromise(Event.filter(chatAgentService.onDidChangeAgents, () => {
			const defaultAgent = chatAgentService.getDefaultAgent(this.location, mode);
			return Boolean(defaultAgent && !defaultAgent.isCore);
		}));
	}

	private async whenAgentActivated(chatService: IChatService): Promise<void> {
		try {
			await chatService.activateDefaultAgent(this.location);
		} catch (error) {
			this.logService.error(error);
		}
	}

	/**
	 * SafeAppeals: activate the configured chat extension for `safeappeals.agent` specifically.
	 * Do not use mode-agnostic getContributedDefaultAgent (may pick vendored Copilot).
	 * Wait for the agent to actually appear in activated agents.
	 */
	private async whenSafeAppealsCloudAgentActivated(): Promise<void> {
		try {
			this.logService.info('[chat setup] Activating SafeAppeals Cloud agent extension');
			await this.extensionService.whenInstalledExtensionsRegistered();
			const extensionId = new ExtensionIdentifier(defaultChat.chatExtensionId);
			await this.extensionService.activateById(extensionId, {
				activationEvent: `onChatParticipant:${SAFEAPPEALS_AGENT_PARTICIPANT_ID}`,
				extensionId,
				startup: false,
			});

			// Wait for the agent to actually appear in activated agents
			const isReady = () => isSafeAppealsCloudAgentActivated(
				this.chatAgentService.getActivatedAgents().map(agent => agent.id)
			);
			this.logService.info('[chat setup] Waiting for safeappeals.agent to appear in activated agents', {
				activatedAgents: this.chatAgentService.getActivatedAgents().map(agent => agent.id)
			});
			if (!isReady()) {
				await Event.toPromise(Event.filter(this.chatAgentService.onDidChangeAgents, () => {
					const ready = isReady();
					if (ready) {
						this.logService.info('[chat setup] safeappeals.agent now appears in activated agents');
					}
					return ready;
				}));
			}
			this.logService.info('[chat setup] SafeAppeals Cloud agent activation complete');
		} catch (error) {
			this.logService.error('[chat setup] Failed to activate SafeAppeals Cloud agent', error);
		}
	}

	/** SafeAppeals: wait until `safeappeals.agent` appears in activated agents OR is available as a contributed default agent. */
	private whenSafeAppealsCloudAgentReady(chatAgentService: IChatAgentService): Promise<unknown> | void {
		const isReady = () => {
			// Check activated agents first
			if (isSafeAppealsCloudAgentActivated(chatAgentService.getActivatedAgents().map(agent => agent.id))) {
				return true;
			}
			// Also check if it's available as a contributed default agent
			const contributed = chatAgentService.getContributedDefaultAgent(this.location);
			if (contributed && contributed.id === SAFEAPPEALS_AGENT_PARTICIPANT_ID) {
				return true;
			}
			return false;
		};
		if (isReady()) {
			return;
		}
		return Event.toPromise(Event.filter(chatAgentService.onDidChangeAgents, () => {
			const activated = isSafeAppealsCloudAgentActivated(chatAgentService.getActivatedAgents().map(agent => agent.id));
			if (activated) return true;
			const contributed = chatAgentService.getContributedDefaultAgent(this.location);
			return contributed?.id === SAFEAPPEALS_AGENT_PARTICIPANT_ID;
		}));
	}

	private computeDiagnosticInfo(agentActivated: boolean, agentReady: boolean, languageModelReady: boolean, toolsModelReady: boolean, requestModel: IChatRequestModel, languageModelsService: ILanguageModelsService, chatAgentService: IChatAgentService, modeInfo: { kind?: ChatModeKind } | undefined) {
		const languageModelIds = languageModelsService.getLanguageModelIds();
		let languageModelDefaultCount = 0;
		for (const id of languageModelIds) {
			const model = languageModelsService.lookupLanguageModel(id);
			if (model?.isDefaultForLocation[ChatAgentLocation.Chat]) {
				languageModelDefaultCount++;
			}
		}

		const defaultAgent = chatAgentService.getDefaultAgent(this.location, modeInfo?.kind);
		const contributedDefaultAgent = chatAgentService.getContributedDefaultAgent(this.location);
		const chatViewPane = this.viewsService.getActiveViewWithId(ChatViewId) as ChatViewPane | undefined;
		const matchingWelcomeView = chatViewPane?.getMatchingWelcomeView();

		return {
			agentActivated,
			agentReady,
			agentHasDefault: !!defaultAgent,
			agentDefaultIsCore: defaultAgent?.isCore ?? false,
			agentHasContributedDefault: !!contributedDefaultAgent,
			agentContributedDefaultIsCore: contributedDefaultAgent?.isCore ?? false,
			agentActivatedCount: chatAgentService.getActivatedAgents().length,
			agentLocation: this.location,
			agentModeKind: modeInfo?.kind ?? '',
			languageModelReady,
			languageModelCount: languageModelIds.length,
			languageModelDefaultCount,
			languageModelHasRequestedModel: !!requestModel.modelId,
			toolsModelReady,
			isRemote: !!this.environmentService.remoteAuthority,
			isAnonymous: this.chatEntitlementService.anonymous,
			matchingWelcomeViewWhen: matchingWelcomeView?.when.serialize() ?? (chatViewPane ? 'noWelcomeView' : 'noChatViewPane'),
		};
	}

	private async doInvokeWithSetup(request: IChatAgentRequest, progress: (part: IChatProgress) => void, chatService: IChatService, languageModelsService: ILanguageModelsService, chatWidgetService: IChatWidgetService, chatAgentService: IChatAgentService, languageModelToolsService: ILanguageModelToolsService, defaultAccountService: IDefaultAccountService, history: IChatAgentHistoryEntry[] = [], token: CancellationToken = CancellationToken.None): Promise<IChatAgentResult> {
		this.telemetryService.publicLog2<WorkbenchActionExecutedEvent, WorkbenchActionExecutedClassification>('workbenchActionExecuted', { id: CHAT_SETUP_ACTION_ID, from: 'chat' });

		const widget = chatWidgetService.getWidgetBySessionResource(request.sessionResource);
		const requestModel = widget?.viewModel?.model.getRequests().at(-1);

		// SafeAppeals: use the shared setup runner so a request cannot open a second
		// sign-in dialog while the setup action is already in progress.
		if (this.usesSafeAppealsCloudSetup(languageModelsService)
			&& !this.context.state.untrusted
			&& this.workspaceTrustManagementService.isWorkspaceTrusted()) {
			// Show Google / Outlook buttons (do not skip the dialog with a bare strategy).
			const setupResult = await ChatSetup.getInstance(this.instantiationService, this.context, this.controller).run({
				forceSignInDialog: true,
				disableChatViewReveal: true,
			});
			if (!setupResult.success) {
				progress({
					kind: 'markdownContent',
					content: SetupAgent.SETUP_NEEDED_MESSAGE
				});
				return {};
			}
			progress({
				kind: 'progressMessage',
				content: new MarkdownString(localize('setupSafeAppealsCloudSignIn', "Signing in to SafeAppeals Cloud")),
				shimmer: true,
			});
			try {
				void languageModelsService.selectLanguageModels({ vendor: SAFEAPPEALS_CLOUD_VENDOR_ID });
				// SafeAppeals: Ask/Edit go straight to Cloud LM; Agent still forwards when a tools agent is present
				if (this.usesCloudLanguageModelPath()) {
					return this.doInvokeWithCloudLanguageModel(request, progress, languageModelsService, chatWidgetService, languageModelToolsService, history, token);
				}
				if (this.isCloudAgentModeUnavailable(chatAgentService, true)) {
					return this.replyCloudAgentModeUnavailable(progress);
				}
				if (requestModel) {
					await this.forwardRequestToChat(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService);
				}
			} catch (error) {
				if (isCancellationError(error)) {
					// SafeAppeals: cancelled OAuth must not surface an error toast (mirror Accounts/Models)
					progress({
						kind: 'markdownContent',
						content: this.workspaceTrustManagementService.isWorkspaceTrusted() ? SetupAgent.SETUP_NEEDED_MESSAGE : SetupAgent.TRUST_NEEDED_MESSAGE
					});
					return {};
				}
				this.logService.error(`[chat setup] SafeAppeals Cloud sign-in failed: ${toErrorMessage(error)}`);
				progress({
					kind: 'warning',
					content: new MarkdownString(localize('chatSetupError', "Chat setup failed."))
				});
			}
			return {};
		}

		const setupListener = Event.runAndSubscribe(this.controller.value.onDidChange, (() => {
			switch (this.controller.value.step) {
				case ChatSetupStep.SigningIn:
					progress({
						kind: 'progressMessage',
						content: new MarkdownString(localize('setupChatSignIn2', "Signing in to {0}", defaultAccountService.getDefaultAccountAuthenticationProvider().name)),
						shimmer: true,
					});
					break;
				case ChatSetupStep.Installing:
					progress({
						kind: 'progressMessage',
						content: new MarkdownString(localize('installingChat', "Getting chat ready")),
						shimmer: true,
					});
					break;
			}
		}));

		let result: IChatSetupResult | undefined = undefined;
		try {
			result = await ChatSetup.getInstance(this.instantiationService, this.context, this.controller).run({
				disableChatViewReveal: true, 																				// we are already in a chat context
				forceAnonymous: this.chatEntitlementService.anonymous ? ChatSetupAnonymous.EnabledWithoutDialog : undefined	// only enable anonymous selectively
			});
		} catch (error) {
			this.logService.error(`[chat setup] Error during setup: ${toErrorMessage(error)}`);
		} finally {
			setupListener.dispose();
		}

		// User has agreed to run the setup
		if (typeof result?.success === 'boolean') {
			if (result.success) {
				if (result.dialogSkipped) {
					await widget?.clear(); // make room for the Chat welcome experience
				} else if (requestModel) {
					let newRequest = this.replaceAgentInRequestModel(requestModel, chatAgentService); 	// Replace agent part with the actual Chat agent...
					newRequest = this.replaceToolInRequestModel(newRequest); 							// ...then replace any tool parts with the actual Chat tools

					await this.forwardRequestToChat(newRequest, progress, chatService, languageModelsService, chatAgentService, chatWidgetService, languageModelToolsService);
				}
			} else {
				progress({
					kind: 'warning',
					content: new MarkdownString(localize('chatSetupError', "Chat setup failed."))
				});
			}
		}

		// User has cancelled the setup
		else {
			progress({
				kind: 'markdownContent',
				content: this.workspaceTrustManagementService.isWorkspaceTrusted() ? SetupAgent.SETUP_NEEDED_MESSAGE : SetupAgent.TRUST_NEEDED_MESSAGE
			});
		}

		return {};
	}

	private replaceAgentInRequestModel(requestModel: IChatRequestModel, chatAgentService: IChatAgentService): IChatRequestModel {
		const agentPart = requestModel.message.parts.find((r): r is ChatRequestAgentPart => r instanceof ChatRequestAgentPart);
		if (!agentPart) {
			return requestModel;
		}

		const agentId = agentPart.agent.id.replace(/setup\./, `${defaultChat.extensionId}.`.toLowerCase());
		const githubAgent = chatAgentService.getAgent(agentId);
		if (!githubAgent) {
			return requestModel;
		}

		const newAgentPart = new ChatRequestAgentPart(agentPart.range, agentPart.editorRange, githubAgent);

		return new ChatRequestModel({
			session: requestModel.session as ChatModel,
			message: {
				parts: requestModel.message.parts.map(part => {
					if (part instanceof ChatRequestAgentPart) {
						return newAgentPart;
					}
					return part;
				}),
				text: requestModel.message.text
			},
			variableData: requestModel.variableData,
			timestamp: Date.now(),
			attempt: requestModel.attempt,
			modeInfo: requestModel.modeInfo,
			confirmation: requestModel.confirmation,
			locationData: requestModel.locationData,
			attachedContext: requestModel.attachedContext,
			isCompleteAddedRequest: requestModel.isCompleteAddedRequest,
		});
	}

	private replaceToolInRequestModel(requestModel: IChatRequestModel): IChatRequestModel {
		const toolPart = requestModel.message.parts.find((r): r is ChatRequestToolPart => r instanceof ChatRequestToolPart);
		if (!toolPart) {
			return requestModel;
		}

		const toolId = toolPart.toolId.replace(/setup.tools\./, `copilot_`.toLowerCase());
		const newToolPart = new ChatRequestToolPart(
			toolPart.range,
			toolPart.editorRange,
			toolPart.toolName,
			toolId,
			toolPart.displayName,
			toolPart.icon
		);

		const chatRequestToolEntry: IChatRequestToolEntry = {
			id: toolId,
			name: 'new',
			range: toolPart.range,
			kind: 'tool',
			value: undefined
		};

		const variableData: IChatRequestVariableData = {
			variables: [chatRequestToolEntry]
		};

		return new ChatRequestModel({
			session: requestModel.session as ChatModel,
			message: {
				parts: requestModel.message.parts.map(part => {
					if (part instanceof ChatRequestToolPart) {
						return newToolPart;
					}
					return part;
				}),
				text: requestModel.message.text
			},
			variableData: variableData,
			timestamp: Date.now(),
			attempt: requestModel.attempt,
			modeInfo: requestModel.modeInfo,
			confirmation: requestModel.confirmation,
			locationData: requestModel.locationData,
			attachedContext: [chatRequestToolEntry],
			isCompleteAddedRequest: requestModel.isCompleteAddedRequest,
		});
	}
}

export class SetupTool implements IToolImpl {

	static registerTool(instantiationService: IInstantiationService, toolData: IToolData): IDisposable {
		return instantiationService.invokeFunction(accessor => {
			const toolService = accessor.get(ILanguageModelToolsService);

			const tool = instantiationService.createInstance(SetupTool);
			return toolService.registerTool(toolData, tool);
		});
	}

	async invoke(invocation: IToolInvocation, countTokens: CountTokensCallback, progress: ToolProgress, token: CancellationToken): Promise<IToolResult> {
		const result: IToolResult = {
			content: [
				{
					kind: 'text',
					value: ''
				}
			]
		};

		return result;
	}

	async prepareToolInvocation?(parameters: unknown, token: CancellationToken): Promise<IPreparedToolInvocation | undefined> {
		return undefined;
	}
}

export class AINewSymbolNamesProvider {

	static registerProvider(instantiationService: IInstantiationService, context: ChatEntitlementContext, controller: Lazy<ChatSetupController>): IDisposable {
		return instantiationService.invokeFunction(accessor => {
			const languageFeaturesService = accessor.get(ILanguageFeaturesService);

			const provider = instantiationService.createInstance(AINewSymbolNamesProvider, context, controller);
			return languageFeaturesService.newSymbolNamesProvider.register('*', provider);
		});
	}

	constructor(
		private readonly context: ChatEntitlementContext,
		private readonly controller: Lazy<ChatSetupController>,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IChatEntitlementService private readonly chatEntitlementService: IChatEntitlementService,
	) {
	}

	async provideNewSymbolNames(model: ITextModel, range: IRange, triggerKind: NewSymbolNameTriggerKind, token: CancellationToken): Promise<NewSymbolName[] | undefined> {
		await this.instantiationService.invokeFunction(accessor => {
			return ChatSetup.getInstance(this.instantiationService, this.context, this.controller).run({
				forceAnonymous: this.chatEntitlementService.anonymous ? ChatSetupAnonymous.EnabledWithDialog : undefined
			});
		});

		return [];
	}
}

export class ChatCodeActionsProvider {

	static registerProvider(instantiationService: IInstantiationService): IDisposable {
		return instantiationService.invokeFunction(accessor => {
			const languageFeaturesService = accessor.get(ILanguageFeaturesService);

			const provider = instantiationService.createInstance(ChatCodeActionsProvider);
			return languageFeaturesService.codeActionProvider.register('*', provider);
		});
	}

	constructor(
		@IMarkerService private readonly markerService: IMarkerService,
	) {
	}

	async provideCodeActions(model: ITextModel, range: Range | Selection): Promise<CodeActionList | undefined> {
		const actions: CodeAction[] = [];

		// "Generate" if the line is whitespace only
		// "Modify" if there is a selection
		let generateOrModifyTitle: string | undefined;
		let generateOrModifyCommand: Command | undefined;
		if (range.isEmpty()) {
			const textAtLine = model.getLineContent(range.startLineNumber);
			if (/^\s*$/.test(textAtLine)) {
				generateOrModifyTitle = localize('generate', "Generate");
				generateOrModifyCommand = AICodeActionsHelper.generate(range);
			}
		} else {
			const textInSelection = model.getValueInRange(range);
			if (!/^\s*$/.test(textInSelection)) {
				generateOrModifyTitle = localize('modify', "Modify");
				generateOrModifyCommand = AICodeActionsHelper.modify(range);
			}
		}

		if (generateOrModifyTitle && generateOrModifyCommand) {
			actions.push({
				kind: CodeActionKind.RefactorRewrite.append('copilot').value,
				isAI: true,
				title: generateOrModifyTitle,
				command: generateOrModifyCommand,
			});
		}

		const markers = AICodeActionsHelper.warningOrErrorMarkersAtRange(this.markerService, model.uri, range);
		if (markers.length > 0) {

			// "Fix" if there are diagnostics in the range
			actions.push({
				kind: CodeActionKind.QuickFix.append('copilot').value,
				isAI: true,
				diagnostics: markers,
				title: localize('fix', "Fix"),
				command: AICodeActionsHelper.fixMarkers(markers, range)
			});

			// "Explain" if there are diagnostics in the range
			actions.push({
				kind: CodeActionKind.QuickFix.append('explain').append('copilot').value,
				isAI: true,
				diagnostics: markers,
				title: localize('explain', "Explain"),
				command: AICodeActionsHelper.explainMarkers(markers)
			});
		}

		return {
			actions,
			dispose() { }
		};
	}
}

export class AICodeActionsHelper {

	static warningOrErrorMarkersAtRange(markerService: IMarkerService, resource: URI, range: Range | Selection): IMarker[] {
		return markerService
			.read({ resource, severities: MarkerSeverity.Error | MarkerSeverity.Warning })
			.filter(marker => range.startLineNumber <= marker.endLineNumber && range.endLineNumber >= marker.startLineNumber);
	}

	static modify(range: Range): Command {
		return {
			id: INLINE_CHAT_START,
			title: localize('modify', "Modify"),
			arguments: [
				{
					initialSelection: this.rangeToSelection(range),
					initialRange: range,
					position: range.getStartPosition()
				} satisfies { initialSelection: ISelection; initialRange: IRange; position: IPosition }
			]
		};
	}

	static generate(range: Range): Command {
		return {
			id: INLINE_CHAT_START,
			title: localize('generate', "Generate"),
			arguments: [
				{
					initialSelection: this.rangeToSelection(range),
					initialRange: range,
					position: range.getStartPosition()
				} satisfies { initialSelection: ISelection; initialRange: IRange; position: IPosition }
			]
		};
	}

	private static rangeToSelection(range: Range): ISelection {
		return new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
	}

	static explainMarkers(markers: IMarker[]): Command {
		return {
			id: CHAT_OPEN_ACTION_ID,
			title: localize('explain', "Explain"),
			arguments: [
				{
					query: `@workspace /explain ${markers.map(marker => marker.message).join(', ')}`,
					isPartialQuery: true
				} satisfies { query: string; isPartialQuery: boolean }
			]
		};
	}

	static fixMarkers(markers: IMarker[], range: Range): Command {
		return {
			id: INLINE_CHAT_START,
			title: localize('fix', "Fix"),
			arguments: [
				{
					message: `/fix ${markers.map(marker => marker.message).join(', ')}`,
					initialSelection: this.rangeToSelection(range),
					initialRange: range,
					position: range.getStartPosition()
				} satisfies { message: string; initialSelection: ISelection; initialRange: IRange; position: IPosition }
			]
		};
	}
}
