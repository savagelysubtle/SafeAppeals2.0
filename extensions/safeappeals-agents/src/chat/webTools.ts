/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import * as vscode from 'vscode';
import { isBlockedVscodeCommand, isSafeVscodeCommand } from './commandAllowlist';
import {
	SAFEAPPEALS_FETCH_WEB_PAGE_TOOL,
	SAFEAPPEALS_RUN_VSCODE_COMMAND_TOOL,
	VSCODE_FETCH_WEB_PAGE_TOOL,
} from './toolAllowlist';

export { isBlockedVscodeCommand, isSafeVscodeCommand } from './commandAllowlist';

const FETCH_BYTE_CAP = 500_000;
const FETCH_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_LENGTH = 100_000;
const MIN_MAX_LENGTH = 1_000;
const MAX_MAX_LENGTH = 200_000;

interface RunVscodeCommandInput {
	commandId: string;
	name: string;
	args?: unknown[];
}

interface FetchWebPageInput {
	urls: string[];
	query?: string;
	/** Max characters of extracted text per page (clamped 1k–200k). */
	maxLength?: number;
}

function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

function hostHasFetchTool(): boolean {
	try {
		return vscode.lm.tools.some(tool => tool.name === VSCODE_FETCH_WEB_PAGE_TOOL);
	} catch {
		return false;
	}
}

/**
 * Clamps optional maxLength for extracted page text (1k–200k).
 */
export function sanitizeFetchMaxLength(maxLength: unknown): number {
	if (typeof maxLength !== 'number' || !Number.isFinite(maxLength)) {
		return DEFAULT_MAX_LENGTH;
	}
	const n = Math.trunc(maxLength);
	return Math.max(MIN_MAX_LENGTH, Math.min(MAX_MAX_LENGTH, n));
}

function fetchUrlHttps(urlString: string): Promise<string> {
	return new Promise((resolve, reject) => {
		let parsed: URL;
		try {
			parsed = new URL(urlString);
		} catch {
			reject(new Error(`Invalid URL: ${urlString}`));
			return;
		}
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
			reject(new Error(`Unsupported protocol: ${parsed.protocol}`));
			return;
		}

		const lib = parsed.protocol === 'https:' ? https : http;
		const req = lib.get(parsed, { timeout: FETCH_TIMEOUT_MS }, res => {
			const status = res.statusCode ?? 0;
			if (status >= 300 && status < 400 && res.headers.location) {
				res.resume();
				const next = new URL(res.headers.location, parsed).toString();
				fetchUrlHttps(next).then(resolve, reject);
				return;
			}
			if (status < 200 || status >= 300) {
				res.resume();
				reject(new Error(`HTTP ${status} for ${urlString}`));
				return;
			}

			const chunks: Buffer[] = [];
			let total = 0;
			let truncated = false;
			res.on('data', (chunk: Buffer) => {
				if (truncated) {
					return;
				}
				total += chunk.length;
				if (total > FETCH_BYTE_CAP) {
					const remain = FETCH_BYTE_CAP - (total - chunk.length);
					if (remain > 0) {
						chunks.push(chunk.subarray(0, remain));
					}
					truncated = true;
					res.destroy();
					return;
				}
				chunks.push(chunk);
			});
			res.on('end', () => {
				const text = Buffer.concat(chunks).toString('utf8');
				resolve(truncated ? `${text}\n…(truncated at ${FETCH_BYTE_CAP} bytes)` : text);
			});
			res.on('error', reject);
		});
		req.on('timeout', () => {
			req.destroy(new Error(`Timed out fetching ${urlString}`));
		});
		req.on('error', reject);
	});
}

function stripHtmlToText(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, maxLength)}\n…(truncated)`;
}

/**
 * Fetches URLs as plain extracted text (prefer host fetch tool; HTTPS fallback).
 * Returns raw page text only — no AI summary.
 */
export async function fetchUrlsAsPlainText(
	urls: readonly string[],
	options: {
		readonly maxLength?: number;
		readonly query?: string;
		readonly toolInvocationToken?: vscode.ChatParticipantToolToken;
		readonly cancellationToken?: vscode.CancellationToken;
	} = {},
): Promise<string> {
	const maxLength = sanitizeFetchMaxLength(options.maxLength);
	const query = typeof options.query === 'string' ? options.query.trim() : '';

	if (hostHasFetchTool() && options.toolInvocationToken !== undefined) {
		try {
			const result = await vscode.lm.invokeTool(
				VSCODE_FETCH_WEB_PAGE_TOOL,
				{
					input: { urls: [...urls] },
					toolInvocationToken: options.toolInvocationToken,
				},
				options.cancellationToken,
			);
			const parts: string[] = [];
			if (query) {
				parts.push(`Query focus: ${query}`);
			}
			for (const part of result.content) {
				if (part instanceof vscode.LanguageModelTextPart) {
					parts.push(truncateText(part.value, maxLength));
				}
			}
			if (parts.length > 0) {
				return parts.join('\n\n');
			}
		} catch {
			// Fall through to HTTPS fetch.
		}
	}

	const parts: string[] = [];
	if (query) {
		parts.push(`Query focus: ${query}`);
	}
	for (const url of urls) {
		if (typeof url !== 'string' || !url.trim()) {
			parts.push('Error: empty URL.');
			continue;
		}
		try {
			const raw = await fetchUrlHttps(url.trim());
			const text = stripHtmlToText(raw);
			const capped = truncateText(text || '(empty content)', maxLength);
			parts.push(`URL: ${url}\n${capped}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			parts.push(`URL: ${url}\nError: ${message}`);
		}
	}
	return parts.join('\n\n');
}

class RunVscodeCommandTool implements vscode.LanguageModelTool<RunVscodeCommandInput> {
	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<RunVscodeCommandInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const commandId = options.input?.commandId?.trim() ?? '';
		const displayName = options.input?.name?.trim() || commandId;
		if (!commandId) {
			return {
				invocationMessage: 'Run VS Code command',
			};
		}
		if (isBlockedVscodeCommand(commandId)) {
			return {
				invocationMessage: `Blocked command: ${commandId}`,
			};
		}
		if (isSafeVscodeCommand(commandId)) {
			return {
				invocationMessage: `Running ${displayName}`,
			};
		}
		return {
			invocationMessage: `Running ${displayName}`,
			confirmationMessages: {
				title: 'Run VS Code Command',
				message: `Allow the agent to run \`${commandId}\` (${displayName})?`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<RunVscodeCommandInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const commandId = options.input?.commandId?.trim() ?? '';
		if (!commandId) {
			return textResult('Error: commandId is required.');
		}
		if (isBlockedVscodeCommand(commandId)) {
			return textResult(`Error: command "${commandId}" is blocked.`);
		}
		try {
			const args = Array.isArray(options.input?.args) ? options.input.args : [];
			const result = await vscode.commands.executeCommand(commandId, ...args);
			if (result === undefined) {
				return textResult(`Executed ${commandId}.`);
			}
			try {
				return textResult(`Executed ${commandId}. Result: ${JSON.stringify(result)}`);
			} catch {
				return textResult(`Executed ${commandId}. Result: ${String(result)}`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error executing ${commandId}: ${message}`);
		}
	}
}

class FetchWebPageTool implements vscode.LanguageModelTool<FetchWebPageInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<FetchWebPageInput>,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const urls = options.input?.urls;
		if (!Array.isArray(urls) || urls.length === 0) {
			return textResult('Error: urls must be a non-empty array.');
		}
		const body = await fetchUrlsAsPlainText(urls, {
			maxLength: options.input?.maxLength,
			query: options.input?.query,
			toolInvocationToken: options.toolInvocationToken,
			cancellationToken: token,
		});
		return textResult(body);
	}
}

/**
 * Registers fetch / run-command agent tools.
 */
export function registerWebAgentTools(): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.lm.registerTool<RunVscodeCommandInput>(SAFEAPPEALS_RUN_VSCODE_COMMAND_TOOL, new RunVscodeCommandTool()),
		vscode.lm.registerTool<FetchWebPageInput>(SAFEAPPEALS_FETCH_WEB_PAGE_TOOL, new FetchWebPageTool()),
	);
}
