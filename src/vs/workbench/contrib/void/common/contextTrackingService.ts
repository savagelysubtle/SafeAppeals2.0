/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ChatMessage } from './chatThreadServiceTypes.js';
import { getModelCapabilities } from './modelCapabilities.js';
import { IVoidSettingsService } from './voidSettingsService.js';
import { ProviderName } from './voidSettingsTypes.js';

// Token counting constants
// Calibrated based on real-world usage with documents/PDFs
// Documents typically tokenize at ~8-12 chars per token
// Code tokenizes at ~3-4 chars per token
// Using 8 as a balanced estimate for mixed content
export const CHARS_PER_TOKEN = 8;

// Context usage thresholds
export const CONTEXT_THRESHOLDS = {
	GREEN: 0.60,    // 0-60% - safe zone
	YELLOW: 0.80,   // 60-80% - warning zone
	ORANGE: 0.90,   // 80-90% - approaching limit
	RED: 1.0,       // 90%+ - critical
} as const;

export type ContextUsageLevel = 'green' | 'yellow' | 'orange' | 'red';

export interface ContextUsageInfo {
	// Token counts
	totalTokens: number;
	contextWindow: number;
	reservedOutputTokens: number;
	availableInputTokens: number;

	// Usage calculations
	usagePercent: number;
	usageLevel: ContextUsageLevel;
	tokensRemaining: number;

	// Breakdown by message type
	breakdown: {
		systemTokens: number;
		userTokens: number;
		assistantTokens: number;
		toolTokens: number;
	};

	// Model info
	providerName: ProviderName | null;
	modelName: string | null;
}

export interface IContextTrackingService {
	readonly _serviceBrand: undefined;

	// Events
	onDidChangeContextUsage: Event<ContextUsageInfo>;
	onThresholdCrossed: Event<{ level: ContextUsageLevel; usagePercent: number }>;

	// Methods
	getContextUsageForThread(
		messages: ChatMessage[],
		providerName: ProviderName | null,
		modelName: string | null
	): ContextUsageInfo;

	estimateTokenCount(text: string): number;

	// Check if summarization is recommended
	shouldSummarize(messages: ChatMessage[], providerName: ProviderName | null, modelName: string | null, threshold?: number): boolean;

	// Get summary of what would be preserved after summarization
	getSummarizationPreview(messages: ChatMessage[], preserveCount: number): {
		messagesToSummarize: ChatMessage[];
		messagesToPreserve: ChatMessage[];
	};
}

export const IContextTrackingService = createDecorator<IContextTrackingService>('ContextTrackingService');

class ContextTrackingService extends Disposable implements IContextTrackingService {
	_serviceBrand: undefined;

	private readonly _onDidChangeContextUsage = new Emitter<ContextUsageInfo>();
	readonly onDidChangeContextUsage: Event<ContextUsageInfo> = this._onDidChangeContextUsage.event;

	private readonly _onThresholdCrossed = new Emitter<{ level: ContextUsageLevel; usagePercent: number }>();
	readonly onThresholdCrossed: Event<{ level: ContextUsageLevel; usagePercent: number }> = this._onThresholdCrossed.event;

	private _lastUsageLevel: ContextUsageLevel | null = null;

	constructor(
		@IVoidSettingsService private readonly _voidSettingsService: IVoidSettingsService,
	) {
		super();
	}

	/**
	 * Estimate token count for a string using character-based approximation.
	 * Uses conservative estimate of 4 chars per token.
	 */
	estimateTokenCount(text: string): number {
		if (!text) return 0;
		return Math.ceil(text.length / CHARS_PER_TOKEN);
	}

	/**
	 * Get the content string from a chat message for token counting
	 */
	private _getMessageContent(message: ChatMessage): string {
		if (message.role === 'user') {
			return message.content || '';
		}
		if (message.role === 'assistant') {
			// Include both display content and reasoning
			let content = message.displayContent || '';
			if (message.reasoning) {
				content += message.reasoning;
			}
			return content;
		}
		if (message.role === 'tool') {
			return message.content || '';
		}
		if (message.role === 'checkpoint') {
			// Checkpoints don't count toward token usage
			return '';
		}
		if (message.role === 'interrupted_streaming_tool') {
			return '';
		}
		return '';
	}

	/**
	 * Calculate context usage level based on percentage
	 */
	private _getUsageLevel(usagePercent: number): ContextUsageLevel {
		if (usagePercent >= CONTEXT_THRESHOLDS.ORANGE) {
			return 'red';
		}
		if (usagePercent >= CONTEXT_THRESHOLDS.YELLOW) {
			return 'orange';
		}
		if (usagePercent >= CONTEXT_THRESHOLDS.GREEN) {
			return 'yellow';
		}
		return 'green';
	}

	/**
	 * Get detailed context usage information for a thread
	 */
	getContextUsageForThread(
		messages: ChatMessage[],
		providerName: ProviderName | null,
		modelName: string | null
	): ContextUsageInfo {
		// Get model capabilities for context window
		let contextWindow = 4096; // default fallback
		let reservedOutputTokens = 4096;

		if (providerName && modelName) {
			const { overridesOfModel } = this._voidSettingsService.state;
			const capabilities = getModelCapabilities(providerName, modelName, overridesOfModel);
			contextWindow = capabilities.contextWindow || 4096;
			reservedOutputTokens = capabilities.reservedOutputTokenSpace || 4096;
		}

		const availableInputTokens = Math.max(contextWindow - reservedOutputTokens, 0);

		// Count tokens by message type
		const breakdown = {
			systemTokens: 0,
			userTokens: 0,
			assistantTokens: 0,
			toolTokens: 0,
		};

		for (const message of messages) {
			const content = this._getMessageContent(message);
			const tokens = this.estimateTokenCount(content);

			if (message.role === 'user') {
				breakdown.userTokens += tokens;
			} else if (message.role === 'assistant') {
				breakdown.assistantTokens += tokens;
			} else if (message.role === 'tool') {
				breakdown.toolTokens += tokens;
			}
		}

		// Add estimate for system message (base prompt + tools/rules + directory structure)
		// This is more realistic than 2000 for workspaces with MCP tools and .fileorg.json
		breakdown.systemTokens = 4000;

		const totalTokens = breakdown.systemTokens + breakdown.userTokens + breakdown.assistantTokens + breakdown.toolTokens;

		// Note: The actual LLM service trims content to fit context window.
		// This service reports raw usage, but usagePercent is capped at 1 (100%)
		// to reflect that content exceeding the limit will be trimmed.
		const usagePercent = availableInputTokens > 0 ? Math.min(totalTokens / availableInputTokens, 1) : 0;
		const usageLevel = this._getUsageLevel(usagePercent);
		const tokensRemaining = Math.max(availableInputTokens - totalTokens, 0);

		// Check if threshold was crossed
		if (this._lastUsageLevel !== null && usageLevel !== this._lastUsageLevel) {
			// Level changed - emit threshold crossed event
			this._onThresholdCrossed.fire({ level: usageLevel, usagePercent });
		}
		this._lastUsageLevel = usageLevel;

		const usageInfo: ContextUsageInfo = {
			totalTokens,
			contextWindow,
			reservedOutputTokens,
			availableInputTokens,
			usagePercent,
			usageLevel,
			tokensRemaining,
			breakdown,
			providerName,
			modelName,
		};

		this._onDidChangeContextUsage.fire(usageInfo);

		return usageInfo;
	}

	/**
	 * Check if summarization is recommended based on current context usage
	 */
	shouldSummarize(
		messages: ChatMessage[],
		providerName: ProviderName | null,
		modelName: string | null,
		threshold: number = 0.85
	): boolean {
		const usage = this.getContextUsageForThread(messages, providerName, modelName);
		return usage.usagePercent >= threshold;
	}

	/**
	 * Get preview of what summarization would preserve
	 */
	getSummarizationPreview(
		messages: ChatMessage[],
		preserveCount: number = 4
	): {
		messagesToSummarize: ChatMessage[];
		messagesToPreserve: ChatMessage[];
	} {
		// Filter out checkpoints and other non-content messages
		const contentMessages = messages.filter(m =>
			m.role === 'user' || m.role === 'assistant' || m.role === 'tool'
		);

		// Calculate split point
		const preserveStartIdx = Math.max(0, contentMessages.length - preserveCount);

		return {
			messagesToSummarize: contentMessages.slice(0, preserveStartIdx),
			messagesToPreserve: contentMessages.slice(preserveStartIdx),
		};
	}
}

registerSingleton(IContextTrackingService, ContextTrackingService, InstantiationType.Delayed);

