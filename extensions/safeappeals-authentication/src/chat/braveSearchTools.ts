/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CloudApiClient, CloudAuthError, InsufficientCreditsError } from '../api';
import {
	formatMultiWebSearchResults,
	formatWebSearchResults,
	sanitizeMultiWebSearchInput,
	sanitizeWebSearchInput,
	WEB_SEARCH_CREDIT_COST,
} from './braveSearchHelpers';
import {
	SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL,
	SAFEAPPEALS_WEB_SEARCH_TOOL,
} from './toolAllowlist';

export {
	formatMultiWebSearchResults,
	formatWebSearchResults,
	sanitizeMultiWebSearchInput,
	sanitizeWebSearchInput,
	WEB_SEARCH_CREDIT_COST,
} from './braveSearchHelpers';

export interface WebSearchToolInput {
	query: string;
	count?: number;
	offset?: number;
}

export interface MultiWebSearchToolInput {
	queries: string[];
	count?: number;
}

function creditsFooter(creditsUsed: number, creditsRemaining: number): string {
	return `\n\n---\nCredits used: ${creditsUsed}. Credits remaining: ${creditsRemaining}.`;
}

function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

function mapSearchError(error: unknown): string {
	if (error instanceof InsufficientCreditsError) {
		const detail = error.message?.trim() || 'Insufficient credits for web search.';
		return `Error: ${detail} Sign in to SafeAppeals Cloud and buy credits (Add Credits) to continue searching. Each search costs about ${WEB_SEARCH_CREDIT_COST} credits.`;
	}
	if (error instanceof CloudAuthError) {
		return 'Error: SafeAppeals Cloud sign-in is required for web search. Sign in, then try again. Searches use cloud credits (~250 per search); the Brave API key stays on the server.';
	}
	const message = error instanceof Error ? error.message : String(error);
	return `Error: web search failed: ${message}`;
}

class WebSearchTool implements vscode.LanguageModelTool<WebSearchToolInput> {
	constructor(private readonly apiClient: CloudApiClient) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<WebSearchToolInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const sanitized = sanitizeWebSearchInput(options.input ?? {});
		if ('error' in sanitized) {
			return { invocationMessage: 'Web search' };
		}
		const preview = sanitized.query.length > 80
			? `${sanitized.query.slice(0, 77)}...`
			: sanitized.query;
		return {
			invocationMessage: `Searching the web for "${preview}"`,
			confirmationMessages: {
				title: 'Web Search',
				message: new vscode.MarkdownString(
					`Search SafeAppeals Cloud for \`${preview.replace(/`/g, "'")}\`?\n\n` +
					`Each search costs about **${WEB_SEARCH_CREDIT_COST} credits**. The Brave API key stays on the server.`,
				),
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<WebSearchToolInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const sanitized = sanitizeWebSearchInput(options.input ?? {});
		if ('error' in sanitized) {
			return textResult(`Error: ${sanitized.error}`);
		}
		try {
			const response = await this.apiClient.webSearch({
				query: sanitized.query,
				count: sanitized.count,
				offset: sanitized.offset,
			});
			const body = formatWebSearchResults(response.results ?? []);
			return textResult(
				`${body}${creditsFooter(response.creditsUsed, response.creditsRemaining)}`,
			);
		} catch (error) {
			return textResult(mapSearchError(error));
		}
	}
}

class MultiWebSearchTool implements vscode.LanguageModelTool<MultiWebSearchToolInput> {
	constructor(private readonly apiClient: CloudApiClient) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<MultiWebSearchToolInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const sanitized = sanitizeMultiWebSearchInput(options.input ?? {});
		if ('error' in sanitized) {
			return { invocationMessage: 'Multi web search' };
		}
		const approxCredits = sanitized.queries.length * WEB_SEARCH_CREDIT_COST;
		return {
			invocationMessage: `Running ${sanitized.queries.length} web searches`,
			confirmationMessages: {
				title: 'Multi Web Search',
				message: new vscode.MarkdownString(
					`Run **${sanitized.queries.length}** web search(es) via SafeAppeals Cloud?\n\n` +
					`About **${WEB_SEARCH_CREDIT_COST} credits per search** (~${approxCredits} total). ` +
					`The Brave API key stays on the server.`,
				),
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<MultiWebSearchToolInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const sanitized = sanitizeMultiWebSearchInput(options.input ?? {});
		if ('error' in sanitized) {
			return textResult(`Error: ${sanitized.error}`);
		}
		try {
			const response = await this.apiClient.multiWebSearch({
				queries: sanitized.queries,
				count: sanitized.count,
			});
			const body = formatMultiWebSearchResults(response.searchResults ?? []);
			return textResult(
				`${body}${creditsFooter(response.totalCreditsUsed, response.creditsRemaining)}`,
			);
		} catch (error) {
			return textResult(mapSearchError(error));
		}
	}
}

/**
 * Registers Brave web search tools that call SafeAppeals Cloud (Bearer JWT).
 */
export function registerBraveSearchTools(apiClient: CloudApiClient): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.lm.registerTool<WebSearchToolInput>(
			SAFEAPPEALS_WEB_SEARCH_TOOL,
			new WebSearchTool(apiClient),
		),
		vscode.lm.registerTool<MultiWebSearchToolInput>(
			SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL,
			new MultiWebSearchTool(apiClient),
		),
	);
}
