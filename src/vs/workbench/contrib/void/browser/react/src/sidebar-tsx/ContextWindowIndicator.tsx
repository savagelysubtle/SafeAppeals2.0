/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useMemo } from 'react';
import { ChatMessage } from '../../../../common/chatThreadServiceTypes.js';
import { ContextUsageLevel, CONTEXT_THRESHOLDS, CHARS_PER_TOKEN } from '../../../../common/contextTrackingService.js';
import { getModelCapabilities } from '../../../../common/modelCapabilities.js';
import { ProviderName, OverridesOfModel } from '../../../../common/voidSettingsTypes.js';

interface ContextWindowIndicatorProps {
	messages: ChatMessage[];
	providerName: ProviderName | null;
	modelName: string | null;
	overridesOfModel: OverridesOfModel;
	onSummarizeClick?: () => void;
	className?: string;
}

/**
 * Estimate token count for a string using character-based approximation
 */
const estimateTokenCount = (text: string): number => {
	if (!text) return 0;
	return Math.ceil(text.length / CHARS_PER_TOKEN);
};

/**
 * Get content from a chat message for token counting
 */
const getMessageContent = (message: ChatMessage): string => {
	if (message.role === 'user') {
		return message.content || '';
	}
	if (message.role === 'assistant') {
		let content = message.displayContent || '';
		if (message.reasoning) {
			content += message.reasoning;
		}
		return content;
	}
	if (message.role === 'tool') {
		return message.content || '';
	}
	return '';
};

/**
 * Get usage level based on percentage
 */
const getUsageLevel = (usagePercent: number): ContextUsageLevel => {
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
};

/**
 * Get color classes based on usage level
 */
const getColorClasses = (level: ContextUsageLevel): { bg: string; text: string; border: string } => {
	switch (level) {
		case 'green':
			return {
				bg: 'bg-emerald-500/20',
				text: 'text-emerald-400',
				border: 'border-emerald-500/40',
			};
		case 'yellow':
			return {
				bg: 'bg-amber-500/20',
				text: 'text-amber-400',
				border: 'border-amber-500/40',
			};
		case 'orange':
			return {
				bg: 'bg-orange-500/20',
				text: 'text-orange-400',
				border: 'border-orange-500/40',
			};
		case 'red':
			return {
				bg: 'bg-red-500/20',
				text: 'text-red-400',
				border: 'border-red-500/40',
			};
	}
};

/**
 * Format token number for display (e.g., 45234 -> "45.2k")
 */
const formatTokens = (tokens: number): string => {
	if (tokens >= 1000000) {
		return `${(tokens / 1000000).toFixed(1)}M`;
	}
	if (tokens >= 1000) {
		return `${(tokens / 1000).toFixed(1)}k`;
	}
	return tokens.toString();
};

/**
 * Context Window Indicator Component
 *
 * Shows a progress bar and token count indicating how much of the
 * model's context window is being used by the current conversation.
 */
export const ContextWindowIndicator: React.FC<ContextWindowIndicatorProps> = ({
	messages,
	providerName,
	modelName,
	overridesOfModel,
	onSummarizeClick,
	className = '',
}) => {
	// Calculate context usage
	const usage = useMemo(() => {
		// Get model capabilities for context window
		let contextWindow = 4096;
		let reservedOutputTokens = 4096;

		if (providerName && modelName) {
			const capabilities = getModelCapabilities(providerName, modelName, overridesOfModel);
			contextWindow = capabilities.contextWindow || 4096;
			reservedOutputTokens = capabilities.reservedOutputTokenSpace || 4096;
		}

		const availableInputTokens = Math.max(contextWindow - reservedOutputTokens, 0);

		// Count tokens by message type
		const breakdown = {
			systemTokens: 2000, // Estimate for system message
			userTokens: 0,
			assistantTokens: 0,
			toolTokens: 0,
		};

		for (const message of messages) {
			const content = getMessageContent(message);
			const tokens = estimateTokenCount(content);

			if (message.role === 'user') {
				breakdown.userTokens += tokens;
			} else if (message.role === 'assistant') {
				breakdown.assistantTokens += tokens;
			} else if (message.role === 'tool') {
				breakdown.toolTokens += tokens;
			}
		}

		const totalTokens = breakdown.systemTokens + breakdown.userTokens + breakdown.assistantTokens + breakdown.toolTokens;
		const usagePercent = availableInputTokens > 0 ? Math.min(totalTokens / availableInputTokens, 1) : 0;
		const usageLevel = getUsageLevel(usagePercent);
		const tokensRemaining = Math.max(availableInputTokens - totalTokens, 0);

		return {
			totalTokens,
			contextWindow,
			availableInputTokens,
			usagePercent,
			usageLevel,
			tokensRemaining,
			breakdown,
		};
	}, [messages, providerName, modelName, overridesOfModel]);

	const colors = getColorClasses(usage.usageLevel);
	const percentDisplay = Math.round(usage.usagePercent * 100);

	// Don't show indicator if no messages
	if (messages.length === 0) {
		return null;
	}

	return (
		<div
			className={`flex items-center gap-2 px-2 py-1 rounded-md border ${colors.border} ${colors.bg} text-xs ${className}`}
			title={`Context Usage: ${formatTokens(usage.totalTokens)} / ${formatTokens(usage.availableInputTokens)} tokens
System: ${formatTokens(usage.breakdown.systemTokens)}
User: ${formatTokens(usage.breakdown.userTokens)}
Assistant: ${formatTokens(usage.breakdown.assistantTokens)}
Tools: ${formatTokens(usage.breakdown.toolTokens)}
Remaining: ${formatTokens(usage.tokensRemaining)}`}
		>
			{/* Progress bar */}
			<div className="flex-1 h-1.5 bg-zinc-700/50 rounded-full overflow-hidden min-w-[60px]">
				<div
					className={`h-full transition-all duration-300 ${
						usage.usageLevel === 'green' ? 'bg-emerald-500' :
						usage.usageLevel === 'yellow' ? 'bg-amber-500' :
						usage.usageLevel === 'orange' ? 'bg-orange-500' :
						'bg-red-500'
					}`}
					style={{ width: `${percentDisplay}%` }}
				/>
			</div>

			{/* Token count */}
			<span className={`${colors.text} font-mono whitespace-nowrap`}>
				{formatTokens(usage.totalTokens)} / {formatTokens(usage.availableInputTokens)}
			</span>

			{/* Percentage */}
			<span className={`${colors.text} font-medium`}>
				{percentDisplay}%
			</span>

			{/* Summarize button (only show when approaching limit) */}
			{usage.usagePercent >= CONTEXT_THRESHOLDS.YELLOW && onSummarizeClick && (
				<button
					onClick={onSummarizeClick}
					className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors
						${colors.text} hover:bg-white/10 border ${colors.border}`}
					title="Summarize conversation to free up context space"
				>
					Summarize
				</button>
			)}
		</div>
	);
};

/**
 * Compact version of the indicator for inline use
 */
export const ContextWindowIndicatorCompact: React.FC<ContextWindowIndicatorProps> = ({
	messages,
	providerName,
	modelName,
	overridesOfModel,
	className = '',
}) => {
	// Calculate context usage (same as full version)
	const usage = useMemo(() => {
		let contextWindow = 4096;
		let reservedOutputTokens = 4096;

		if (providerName && modelName) {
			const capabilities = getModelCapabilities(providerName, modelName, overridesOfModel);
			contextWindow = capabilities.contextWindow || 4096;
			reservedOutputTokens = capabilities.reservedOutputTokenSpace || 4096;
		}

		const availableInputTokens = Math.max(contextWindow - reservedOutputTokens, 0);

		let totalTokens = 2000; // system message estimate
		for (const message of messages) {
			totalTokens += estimateTokenCount(getMessageContent(message));
		}

		const usagePercent = availableInputTokens > 0 ? Math.min(totalTokens / availableInputTokens, 1) : 0;
		return { usagePercent, usageLevel: getUsageLevel(usagePercent) };
	}, [messages, providerName, modelName, overridesOfModel]);

	if (messages.length === 0) {
		return null;
	}

	const colors = getColorClasses(usage.usageLevel);
	const percentDisplay = Math.round(usage.usagePercent * 100);

	return (
		<span
			className={`inline-flex items-center gap-1 ${colors.text} text-xs ${className}`}
			title={`Context: ${percentDisplay}% used`}
		>
			<div className="w-8 h-1 bg-zinc-700/50 rounded-full overflow-hidden">
				<div
					className={`h-full ${
						usage.usageLevel === 'green' ? 'bg-emerald-500' :
						usage.usageLevel === 'yellow' ? 'bg-amber-500' :
						usage.usageLevel === 'orange' ? 'bg-orange-500' :
						'bg-red-500'
					}`}
					style={{ width: `${percentDisplay}%` }}
				/>
			</div>
			<span className="font-mono">{percentDisplay}%</span>
		</span>
	);
};

export default ContextWindowIndicator;

