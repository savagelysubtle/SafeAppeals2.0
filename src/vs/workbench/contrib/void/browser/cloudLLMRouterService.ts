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
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILLMMessageService } from '../common/sendLLMMessageService.js';
import { ServiceSendLLMMessageParams } from '../common/sendLLMMessageTypes.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { ProviderName } from '../common/voidSettingsTypes.js';
import { IVoidCloudService } from './voidCloudService.js';

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
		const { modelSelection, messages, onText, onFinalMessage, onError, messagesType } = params;

		if (!modelSelection) {
			onError({ message: 'No model selected', fullError: null });
			return null;
		}

		// Only support chat messages for now
		if (messagesType !== 'chatMessages') {
			console.log('[CloudLLMRouter] Non-chat message type, falling back to provider:', messagesType);
			return this.llmMessageService.sendLLMMessage(params);
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
			apiUrl: this.settingsService.state.globalSettings.voidCloudApiUrl,
		});

		// Convert messages to cloud format
		const cloudMessages = this._convertMessages(messages as any[]);
		console.log('[CloudLLMRouter] Sending request now...');

		// Send via cloud service
		this.cloudService.sendCloudRequest({
			model: cloudModel,
			messages: cloudMessages,
			stream: false, // TODO: Implement streaming
			onText: onText ? (text) => onText({ fullText: text, fullReasoning: '' }) : undefined,
		}).then((response) => {
			// Call final message callback
			onFinalMessage({
				fullText: response.content,
				fullReasoning: '',
				anthropicReasoning: null,
			});

			console.log('[CloudLLMRouter] Cloud request completed:', {
				creditsUsed: response.creditsUsed,
				creditsRemaining: response.creditsRemaining,
				tokensUsed: response.usage.totalTokens,
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

