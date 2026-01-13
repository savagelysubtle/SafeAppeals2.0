/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Cloud LLM Router Service
 *
 * Routes LLM requests either through SafeAppeals Cloud (if enabled and configured)
 * or through the normal provider-specific implementations.
 *
 * This service is the recommended way to send LLM messages when cloud mode may be active.
 */

import { Disposable } from '../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { availableTools, InternalToolInfo } from '../common/prompt/prompts.js';
import { ILLMMessageService } from '../common/sendLLMMessageService.js';
import { OnFinalMessage, OnText, RawToolCallObj, RawToolParamsObj, ServiceSendLLMMessageParams, SingleToolCall } from '../common/sendLLMMessageTypes.js';
import { ToolName, ToolParamName } from '../common/tools/toolsServiceTypes.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { ChatMode, ProviderName } from '../common/voidSettingsTypes.js';
import { CloudTool, CloudToolCall, IVoidCloudService } from './voidCloudService.js';

// ============================================
// TOOL FORMAT CONVERSION
// ============================================

/**
 * Convert native cloud tool calls to internal RawToolCallObj format
 * This parses the JSON arguments and creates the format expected by chatThreadService
 */
function parseNativeToolCalls(
	cloudToolCalls: CloudToolCall[],
	toolOfToolName: { [name: string]: InternalToolInfo | undefined }
): RawToolCallObj | null {
	if (!cloudToolCalls || cloudToolCalls.length === 0) {
		return null;
	}

	const toolCalls: SingleToolCall[] = cloudToolCalls.map(tc => {
		const toolDef = toolOfToolName[tc.function.name];
		let parsedArgs: RawToolParamsObj = {};

		try {
			parsedArgs = JSON.parse(tc.function.arguments || '{}');
		} catch (e) {
			console.warn('[CloudToolParser] Failed to parse tool arguments:', tc.function.arguments);
		}

		const doneParams = toolDef
			? Object.keys(parsedArgs).filter(p => p in toolDef.params) as ToolParamName<ToolName>[]
			: Object.keys(parsedArgs) as ToolParamName<ToolName>[];

		return {
			id: tc.id,
			name: tc.function.name as ToolName,
			rawParams: parsedArgs,
			doneParams,
			isDone: true
		};
	});

	console.log('[CloudToolParser] ✅ Parsed', toolCalls.length, 'native tool calls:', toolCalls.map(t => t.name));

	// Return single or multiple format
	if (toolCalls.length === 1) {
		return toolCalls[0];
	}
	return { toolCalls, format: 'antml' };
}

/**
 * Convert internal tool definitions to OpenAI/LiteLLM compatible format
 * This enables native tool calling through the cloud API
 */
function convertToCloudTools(tools: InternalToolInfo[]): CloudTool[] {
	return tools.map(tool => {
		const properties: { [paramName: string]: { type: string; description: string } } = {};
		const required: string[] = [];

		for (const [paramName, paramInfo] of Object.entries(tool.params)) {
			properties[paramName] = {
				type: 'string',
				description: paramInfo.description
			};
			// Mark all params as required (matching non-cloud behavior)
			required.push(paramName);
		}

		return {
			type: 'function' as const,
			function: {
				name: tool.name,
				description: tool.description,
				parameters: {
					type: 'object' as const,
					properties,
					required
				}
			}
		};
	});
}

// ============================================
// BROWSER-SIDE XML TOOL PARSER FOR CLOUD RESPONSES
// ============================================

/**
 * Parse ANTML format tool calls from cloud response
 * Format: <function_calls><invoke name="X"><parameter name="Y">value</parameter></invoke></function_calls>
 */
function parseCloudToolCalls(
	text: string,
	chatMode: ChatMode | null
): { textBeforeTools: string; toolCall: RawToolCallObj | null } {
	// Get available tools for this chat mode
	const tools = availableTools(chatMode, undefined);
	if (!tools || tools.length === 0) {
		console.warn('[CloudXMLParser] No tools available for chatMode:', chatMode);
		return { textBeforeTools: text, toolCall: null };
	}

	// Build tool lookup map
	const toolOfToolName: { [name: string]: typeof tools[0] } = {};
	for (const t of tools) { toolOfToolName[t.name] = t; }

	// Find <function_calls> wrapper
	const functionCallsIdx = text.indexOf('<function_calls>');
	if (functionCallsIdx === -1) {
		return { textBeforeTools: text, toolCall: null };
	}

	const textBeforeTools = text.substring(0, functionCallsIdx);
	const xmlSubstring = text.substring(functionCallsIdx);

	console.log('[CloudXMLParser] Found <function_calls> at index:', functionCallsIdx);

	// Extract content between <function_calls> and </function_calls>
	const functionCallsMatch = xmlSubstring.match(/<function_calls>([\s\S]*?)<\/function_calls>/);
	if (!functionCallsMatch) {
		console.warn('[CloudXMLParser] No closing </function_calls> found');
		return { textBeforeTools, toolCall: null };
	}

	const innerContent = functionCallsMatch[1];
	const toolCalls: SingleToolCall[] = [];

	// Find all <invoke> blocks
	const invokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g;
	let match;

	while ((match = invokeRegex.exec(innerContent)) !== null) {
		const toolName = match[1] as ToolName;
		const invokeContent = match[2];

		console.log('[CloudXMLParser] Found invoke for tool:', toolName);

		const toolDef = toolOfToolName[toolName];
		if (!toolDef) {
			console.warn('[CloudXMLParser] Unknown tool:', toolName, '- skipping');
			continue;
		}

		// Extract parameters
		const paramsObj: RawToolParamsObj = {};
		const doneParams: ToolParamName<ToolName>[] = [];

		const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
		let paramMatch;

		while ((paramMatch = paramRegex.exec(invokeContent)) !== null) {
			const paramName = paramMatch[1] as ToolParamName<ToolName>;
			const paramValue = paramMatch[2].trim();

			if (paramName in toolDef.params) {
				paramsObj[paramName] = paramValue;
				doneParams.push(paramName);
			}
		}

		console.log('[CloudXMLParser] Extracted tool:', toolName, 'with params:', doneParams);

		toolCalls.push({
			name: toolName,
			rawParams: paramsObj,
			doneParams,
			id: generateUuid(),
			isDone: true
		});
	}

	if (toolCalls.length === 0) {
		console.warn('[CloudXMLParser] No valid tool calls found in <function_calls>');
		return { textBeforeTools, toolCall: null };
	}

	// Return single or multi tool call
	const toolCall: RawToolCallObj = toolCalls.length === 1
		? toolCalls[0]
		: { toolCalls, format: 'antml' };

	console.log('[CloudXMLParser] ✅ Parsed', toolCalls.length, 'tool calls successfully');
	return { textBeforeTools, toolCall };
}

/**
 * Wrap onText and onFinalMessage to apply XML tool parsing
 */
function wrapWithXMLParsing(
	onText: OnText | undefined,
	onFinalMessage: OnFinalMessage,
	chatMode: ChatMode | null
): { wrappedOnText: OnText | undefined; wrappedOnFinalMessage: OnFinalMessage } {
	let lastToolCall: RawToolCallObj | null = null;

	const wrappedOnText: OnText | undefined = onText ? (params) => {
		const { textBeforeTools, toolCall } = parseCloudToolCalls(params.fullText, chatMode);
		if (toolCall) {
			lastToolCall = toolCall;
		}
		onText({
			...params,
			fullText: textBeforeTools,
			toolCall: toolCall || undefined,
		});
	} : undefined;

	const wrappedOnFinalMessage: OnFinalMessage = (params) => {
		const { textBeforeTools, toolCall } = parseCloudToolCalls(params.fullText, chatMode);
		if (toolCall) {
			lastToolCall = toolCall;
		}
		onFinalMessage({
			...params,
			fullText: textBeforeTools,
			toolCall: toolCall || lastToolCall || undefined,
		});
	};

	return { wrappedOnText, wrappedOnFinalMessage };
}

// ============================================
// SERVICE INTERFACE
// ============================================

export interface ICloudLLMRouterService {
	readonly _serviceBrand: undefined;

	/**
	 * Send an LLM message, automatically routing through cloud if enabled for the provider.
	 * This is the recommended method for sending LLM messages.
	 */
	sendLLMMessage(params: ServiceSendLLMMessageParams): string | null;

	/**
	 * Check if cloud mode is enabled for a specific provider.
	 */
	isCloudEnabledForProvider(providerName: ProviderName): boolean;

	/**
	 * Check if we can use cloud (signed in + has credits).
	 */
	canUseCloud(): boolean;

	/**
	 * Abort an ongoing request.
	 */
	abort(requestId: string): void;
}

export const ICloudLLMRouterService = createDecorator<ICloudLLMRouterService>('cloudLLMRouterService');

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

class CloudLLMRouterService extends Disposable implements ICloudLLMRouterService {
	readonly _serviceBrand: undefined;

	// Map app model names to LiteLLM model_name (from config.yaml)
	// 1:1 mapping - app names match LiteLLM model_name values
	private readonly cloudModelMapping: Record<string, string> = {
		// Anthropic (matches litellm/config.yaml model_name)
		'claude-opus-4.5': 'claude-opus-4.5',
		'claude-sonnet-4.5': 'claude-sonnet-4.5',
		'claude-opus-4.1': 'claude-opus-4.1',
		'claude-sonnet-4': 'claude-sonnet-4',
		'claude-haiku-4.5': 'claude-haiku-4.5',
		// OpenAI (matches litellm/config.yaml model_name)
		'gpt-5.2': 'gpt-5.2',
		'gpt-5': 'gpt-5',
		'gpt-5-mini': 'gpt-5-mini',
		'gpt-5-nano': 'gpt-5-nano',
		// Gemini (matches litellm/config.yaml model_name)
		'gemini-3-pro': 'gemini-3-pro',
		'gemini-2.5-pro': 'gemini-2.5-pro',
		'gemini-2.5-flash': 'gemini-2.5-flash',
	};

	constructor(
		@ILLMMessageService private readonly llmMessageService: ILLMMessageService,
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService,
		@IVoidCloudService private readonly cloudService: IVoidCloudService,
	) {
		super();
	}

	// ============================================
	// PUBLIC METHODS
	// ============================================

	sendLLMMessage(params: ServiceSendLLMMessageParams): string | null {
		const { modelSelection } = params;

		// Check if we should route through cloud
		if (modelSelection && this.shouldUseCloud(modelSelection.providerName)) {
			return this._sendViaCloud(params);
		}

		// Otherwise, use normal provider routing
		return this.llmMessageService.sendLLMMessage(params);
	}

	isCloudEnabledForProvider(providerName: ProviderName): boolean {
		const { globalSettings } = this.settingsService.state;

		// Check master toggle
		if (!globalSettings.voidCloudEnabled) {
			return false;
		}

		// Check per-provider toggle
		return globalSettings.voidCloudModeOfProvider[providerName] === true;
	}

	canUseCloud(): boolean {
		return this.cloudService.isSignedIn() && this.cloudService.hasCredits(1);
	}

	abort(requestId: string): void {
		// For now, just pass through to the underlying service
		// Cloud requests use a different abort mechanism (AbortController)
		this.llmMessageService.abort(requestId);
	}

	// ============================================
	// PRIVATE METHODS
	// ============================================

	private shouldUseCloud(providerName: ProviderName): boolean {
		// If user explicitly enabled cloud mode for this provider, use cloud
		if (this.isCloudEnabledForProvider(providerName) && this.canUseCloud()) {
			return true;
		}

		// Smart fallback: If user is signed in with credits but has NO API key for this provider,
		// automatically use cloud (better UX than showing "no API key" error)
		if (this.canUseCloud() && !this._hasApiKeyForProvider(providerName)) {
			console.log('[CloudLLMRouter] No API key for provider, auto-routing through cloud:', providerName);
			return true;
		}

		return false;
	}

	private _hasApiKeyForProvider(providerName: ProviderName): boolean {
		const providerSettings = this.settingsService.state.settingsOfProvider[providerName];
		return !!providerSettings?.apiKey && providerSettings.apiKey.trim() !== '';
	}

	private _sendViaCloud(params: ServiceSendLLMMessageParams): string | null {
		const { modelSelection, messages, separateSystemMessage, onText, onFinalMessage, onError, messagesType, chatMode } = params;

		if (!modelSelection) {
			onError({ message: 'No model selected', fullError: null });
			return null;
		}

		// Only support chat messages for now
		if (messagesType !== 'chatMessages') {
			console.log('[CloudLLMRouter] Non-chat message type, falling back to provider:', messagesType);
			return this.llmMessageService.sendLLMMessage(params);
		}

		// Log if system message is missing (critical for tool definitions!)
		if (!separateSystemMessage) {
			console.warn('[CloudLLMRouter] ⚠️ No separateSystemMessage provided - tool definitions may be missing!');
		}

		// Check if cloud is available (online + signed in)
		if (!this.cloudService.isOnline()) {
			console.warn('[CloudLLMRouter] Cloud unavailable (offline), attempting fallback to provider');
			return this._fallbackToProvider(params, 'Network offline. Falling back to direct provider connection.');
		}

		// Generate request ID
		const requestId = `cloud-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		// Map model name to cloud model
		const cloudModel = this._mapToCloudModel(modelSelection.modelName);

		console.log('[CloudLLMRouter] Routing through SafeAppeals Cloud:', {
			provider: modelSelection.providerName,
			originalModel: modelSelection.modelName,
			cloudModel,
			messageCount: (messages as any[])?.length ?? 0,
			hasSystemMessage: !!separateSystemMessage,
			systemMessageLength: separateSystemMessage?.length ?? 0,
			apiUrl: this.settingsService.state.globalSettings.voidCloudApiUrl,
			chatMode,
		});

		// Convert messages to cloud format, prepending system message
		const conversationMessages = this._convertMessages(messages as any[]);

		// CRITICAL: Include system message with tool definitions at the start
		const cloudMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
		if (separateSystemMessage) {
			cloudMessages.push({ role: 'system', content: separateSystemMessage });
		}
		cloudMessages.push(...conversationMessages);

		// Get available tools for this chat mode and convert to cloud format
		const internalTools = availableTools(chatMode ?? null, undefined);
		const cloudTools = internalTools && internalTools.length > 0
			? convertToCloudTools(internalTools)
			: undefined;

		console.log('[CloudLLMRouter] Sending request now...', {
			totalMessages: cloudMessages.length,
			hasSystemMessage: cloudMessages[0]?.role === 'system',
			systemMessagePreview: cloudMessages[0]?.role === 'system' ? cloudMessages[0].content.substring(0, 200) + '...' : 'NONE',
			toolCount: cloudTools?.length ?? 0,
			toolNames: cloudTools?.slice(0, 5).map(t => t.function.name) ?? []
		});

		// Wrap callbacks with XML tool parsing for chat modes that support tools
		// This handles both native tool responses AND XML fallback for compatibility
		const { wrappedOnText, wrappedOnFinalMessage } = wrapWithXMLParsing(onText, onFinalMessage, chatMode ?? null);

		// Determine temperature based on model
		// When extended thinking is enabled (globally in LiteLLM), temperature MUST be 1
		// See: https://docs.claude.com/en/docs/build-with-claude/extended-thinking
		// Since thinking is enabled for all Claude models in our cloud config, use temp=1 for all Claude
		const modelLower = cloudModel.toLowerCase();
		const isClaudeModel = modelLower.includes('claude') || modelLower.includes('opus') || modelLower.includes('sonnet') || modelLower.includes('haiku');
		// Claude with thinking enabled requires temperature=1
		// Other models (GPT, Gemini) can use 0.2 for better tool calling
		const temperature = isClaudeModel ? 1 : 0.2;

		console.log('[CloudLLMRouter] Temperature:', { cloudModel, isClaudeModel, temperature });

		// Send via cloud service
		this.cloudService.sendCloudRequest({
			model: cloudModel,
			messages: cloudMessages,
			temperature,
			tools: cloudTools,
			toolChoice: cloudTools ? 'auto' : undefined, // Let model decide when to use tools
			stream: false, // TODO: Implement streaming
			onText: wrappedOnText ? (text) => wrappedOnText({ fullText: text, fullReasoning: '' }) : undefined,
		}).then((response) => {
			// Build tool lookup for parsing
			const toolOfToolName: { [name: string]: InternalToolInfo | undefined } = {};
			if (internalTools) {
				for (const t of internalTools) { toolOfToolName[t.name] = t; }
			}

			// Check for native tool calls FIRST (from API response)
			let nativeToolCall: RawToolCallObj | null = null;
			if (response.toolCalls && response.toolCalls.length > 0) {
				console.log('[CloudLLMRouter] 🔧 Native tool calls received from API:', response.toolCalls.length);
				nativeToolCall = parseNativeToolCalls(response.toolCalls, toolOfToolName);
			}

			if (nativeToolCall) {
				// Use native tool calls - bypass XML parsing
				console.log('[CloudLLMRouter] ✅ Using native tool calls');
				onFinalMessage({
					fullText: response.content,
					fullReasoning: '',
					anthropicReasoning: null,
					toolCall: nativeToolCall,
				});
			} else {
				// Fall back to XML parsing (for compatibility or if no native tools)
				wrappedOnFinalMessage({
					fullText: response.content,
					fullReasoning: '',
					anthropicReasoning: null,
				});
			}

			console.log('[CloudLLMRouter] Cloud request completed:', {
				creditsUsed: response.creditsUsed,
				creditsRemaining: response.creditsRemaining,
				tokensUsed: response.usage.totalTokens,
				hasNativeToolCalls: !!nativeToolCall,
			});
		}).catch((error) => {
			const message = error instanceof Error ? error.message : 'Cloud request failed';

			// Attempt graceful degradation - try direct provider if user has API key
			if (this._canFallbackToProvider(modelSelection.providerName)) {
				console.warn('[CloudLLMRouter] Cloud request failed, falling back to provider:', message);
				this._fallbackToProvider(params, `Cloud unavailable: ${message}. Using direct API connection.`);
			} else {
				onError({ message, fullError: error });
			}
		});

		return requestId;
	}

	// Check if we can fall back to direct provider (user has API key configured)
	private _canFallbackToProvider(providerName: ProviderName): boolean {
		const providerSettings = this.settingsService.state.settingsOfProvider[providerName];
		// Check if the provider has an API key set (not just cloud-enabled)
		return !!providerSettings?.apiKey;
	}

	// Fall back to direct provider connection
	private _fallbackToProvider(params: ServiceSendLLMMessageParams, warningMessage: string): string | null {
		// Log the fallback
		console.warn('[CloudLLMRouter] Graceful degradation:', warningMessage);

		// Send via direct provider
		return this.llmMessageService.sendLLMMessage(params);
	}

	private _mapToCloudModel(modelName: string): string {
		// Try exact match first
		if (this.cloudModelMapping[modelName]) {
			return this.cloudModelMapping[modelName];
		}

		// Try partial match (model name contains)
		for (const [key, value] of Object.entries(this.cloudModelMapping)) {
			if (modelName.toLowerCase().includes(key.toLowerCase())) {
				return value;
			}
		}

		// Default to claude-3-5-haiku as it's cheapest
		console.warn('[CloudLLMRouter] Unknown model, defaulting to claude-3-5-haiku:', modelName);
		return 'claude-3-5-haiku-20241022';
	}

	private _convertMessages(messages: any[]): { role: 'system' | 'user' | 'assistant'; content: string }[] {
		if (!messages || !Array.isArray(messages)) {
			return [];
		}

		return messages.map((msg) => {
			// Handle different message formats
			let role: 'system' | 'user' | 'assistant' = 'user';
			let content = '';

			if (typeof msg === 'string') {
				content = msg;
			} else if (msg.role && msg.content) {
				role = msg.role as 'system' | 'user' | 'assistant';
				content = typeof msg.content === 'string'
					? msg.content
					: JSON.stringify(msg.content);
			} else if (msg.content) {
				content = typeof msg.content === 'string'
					? msg.content
					: JSON.stringify(msg.content);
			}

			return { role, content };
		});
	}
}

// Register the service
registerSingleton(ICloudLLMRouterService, CloudLLMRouterService, InstantiationType.Delayed);

