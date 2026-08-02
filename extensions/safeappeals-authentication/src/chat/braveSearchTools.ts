/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CloudApiClient, CloudAuthError, InsufficientCreditsError } from '../api';
import {
	formatMultiWebSearchToolBody,
	formatWebSearchToolBody,
	sanitizeMultiWebSearchInput,
	sanitizeWebSearchInput,
	WEB_SEARCH_CREDIT_COST,
	type SanitizedWebSearchInput,
} from './braveSearchHelpers';
import {
	SAFEAPPEALS_MULTI_WEB_SEARCH_TOOL,
	SAFEAPPEALS_WEB_SEARCH_TOOL,
} from './toolAllowlist';
import { fetchUrlsAsPlainText } from './webTools';

export {
	formatCreditsFooter,
	formatMultiWebSearchResults,
	formatMultiWebSearchToolBody,
	formatWebSearchResults,
	formatWebSearchToolBody,
	sanitizeMultiWebSearchInput,
	sanitizeWebSearchInput,
	WEB_SEARCH_CREDIT_COST,
} from './braveSearchHelpers';

export interface WebSearchToolInput {
	query: string;
	count?: number;
	offset?: number;
	safesearch?: 'off' | 'moderate' | 'strict';
	freshness?: string;
	country?: string;
	search_lang?: string;
	ui_lang?: string;
	site?: string;
	/** After search, fetch raw page text for the top N result URLs (1–5). No AI summary. */
	autoFetch?: number;
}

export interface MultiWebSearchToolInput {
	queries: string[];
	count?: number;
	safesearch?: 'off' | 'moderate' | 'strict';
	freshness?: string;
	country?: string;
	search_lang?: string;
	ui_lang?: string;
	site?: string;
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

function cloudSearchBody(sanitized: SanitizedWebSearchInput): {
	query: string;
	count: number;
	offset: number;
	safesearch: 'off' | 'moderate' | 'strict';
	freshness?: string;
	country?: string;
	search_lang?: string;
	ui_lang?: string;
	site?: string;
} {
	return {
		query: sanitized.query,
		count: sanitized.count,
		offset: sanitized.offset,
		safesearch: sanitized.safesearch,
		...(sanitized.freshness ? { freshness: sanitized.freshness } : {}),
		...(sanitized.country ? { country: sanitized.country } : {}),
		...(sanitized.search_lang ? { search_lang: sanitized.search_lang } : {}),
		...(sanitized.ui_lang ? { ui_lang: sanitized.ui_lang } : {}),
		...(sanitized.site ? { site: sanitized.site } : {}),
	};
}

async function appendAutoFetchSections(
	results: readonly { readonly url: string }[],
	autoFetch: number,
	options: vscode.LanguageModelToolInvocationOptions<WebSearchToolInput>,
	token: vscode.CancellationToken,
): Promise<string> {
	const urls = results
		.map(r => r.url)
		.filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u))
		.slice(0, autoFetch);
	if (urls.length === 0) {
		return '';
	}
	const sections: string[] = ['', '---', '', '## Full page text (raw, for agent reading — not an AI summary)', ''];
	for (const url of urls) {
		const text = await fetchUrlsAsPlainText([url], {
			toolInvocationToken: options.toolInvocationToken,
			cancellationToken: token,
		});
		sections.push(`### Full page text: ${url}`, '', text, '');
	}
	return sections.join('\n');
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
		const autoNote = sanitized.autoFetch
			? `\n\nAlso fetch raw page text for the top **${sanitized.autoFetch}** result URL(s) (no AI summary).`
			: '';
		return {
			invocationMessage: `Searching the web for "${preview}"`,
			confirmationMessages: {
				title: 'Web Search',
				message: new vscode.MarkdownString(
					`Search SafeAppeals Cloud for \`${preview.replace(/`/g, "'")}\`?\n\n` +
					`Each search costs about **${WEB_SEARCH_CREDIT_COST} credits**. The Brave API key stays on the server.` +
					autoNote,
				),
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<WebSearchToolInput>,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const sanitized = sanitizeWebSearchInput(options.input ?? {});
		if ('error' in sanitized) {
			return textResult(`Error: ${sanitized.error}`);
		}
		try {
			const response = await this.apiClient.webSearch(cloudSearchBody(sanitized));
			const raw = response as unknown as Record<string, unknown>;
			const creditsUsed = response.creditsUsed ?? raw['credits_used'];
			const creditsRemaining = response.creditsRemaining ?? raw['credits_remaining'];
			let extra = '';
			if (sanitized.autoFetch) {
				extra = await appendAutoFetchSections(
					response.results ?? [],
					sanitized.autoFetch,
					options,
					token,
				);
			}
			// Credits footer is always last — including after autoFetch page text.
			return textResult(
				formatWebSearchToolBody(response.results, creditsUsed, creditsRemaining, extra),
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
				safesearch: sanitized.safesearch,
				...(sanitized.freshness ? { freshness: sanitized.freshness } : {}),
				...(sanitized.country ? { country: sanitized.country } : {}),
				...(sanitized.search_lang ? { search_lang: sanitized.search_lang } : {}),
				...(sanitized.ui_lang ? { ui_lang: sanitized.ui_lang } : {}),
				...(sanitized.site ? { site: sanitized.site } : {}),
			});
			const raw = response as unknown as Record<string, unknown>;
			const totalCreditsUsed = response.totalCreditsUsed ?? raw['total_credits_used'];
			const creditsRemaining = response.creditsRemaining ?? raw['credits_remaining'];
			return textResult(
				formatMultiWebSearchToolBody(response.searchResults, totalCreditsUsed, creditsRemaining),
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
