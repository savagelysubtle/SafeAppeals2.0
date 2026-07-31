/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isInsufficientCreditsPayload, parseInsufficientCreditsError } from './insufficientCredits';

/** Hard cap on the unfinished SSE buffer to resist hostile / oversized streams. */
export const SSE_MAX_BUFFER_CHARS = 256 * 1024;

/**
 * One incremental parse step from an OpenAI-compatible chat completion SSE stream.
 */
export interface SseParseStep {
	readonly deltas: readonly string[];
	readonly done: boolean;
	/** Set when the stream reports an error; caller must not retry a partial stream. */
	readonly error: Error | undefined;
}

/**
 * Incremental OpenAI chat-completions SSE parser (vscode-free).
 *
 * - Skips malformed events / JSON
 * - Treats `data: [DONE]` as completion
 * - Drops `tool_calls` / `delta.tool_calls` (Ask-mode has no native tool calling)
 * - Bounds the unfinished buffer
 * - Surfaces 402 / insufficient-credit error payloads without treating them as 401
 */
export class OpenAiSseParser {
	private _buffer = '';
	private _done = false;

	/**
	 * Feeds the next decoded text chunk and returns newly extracted text deltas.
	 */
	push(chunk: string): SseParseStep {
		if (this._done) {
			return { deltas: [], done: true, error: undefined };
		}
		this._buffer += chunk;
		if (this._buffer.length > SSE_MAX_BUFFER_CHARS) {
			this._done = true;
			return {
				deltas: [],
				done: true,
				error: new Error('SSE buffer exceeded maximum size'),
			};
		}
		return this._drain(false);
	}

	/**
	 * Flushes any remaining complete events after the readable stream ends.
	 */
	flush(): SseParseStep {
		if (this._done) {
			return { deltas: [], done: true, error: undefined };
		}
		return this._drain(true);
	}

	private _drain(flush: boolean): SseParseStep {
		this._normalizeCrlf(flush);
		const deltas: string[] = [];
		let error: Error | undefined;

		while (true) {
			const sep = this._buffer.indexOf('\n\n');
			if (sep < 0) {
				if (flush && this._buffer.trim().length > 0) {
					const step = this._handleEventBlock(this._buffer);
					this._buffer = '';
					deltas.push(...step.deltas);
					if (step.error) {
						error = step.error;
						this._done = true;
					}
					if (step.done) {
						this._done = true;
					}
				}
				break;
			}

			const block = this._buffer.slice(0, sep);
			this._buffer = this._buffer.slice(sep + 2);
			const step = this._handleEventBlock(block);
			deltas.push(...step.deltas);
			if (step.error) {
				error = step.error;
				this._done = true;
				break;
			}
			if (step.done) {
				this._done = true;
				break;
			}
		}

		return { deltas, done: this._done, error };
	}

	/**
	 * Normalize `\r\n` → `\n` before `\n\n` event scanning so CRLF-delimited
	 * LiteLLM/proxy streams are not silently dropped. Preserves a trailing `\r`
	 * across chunks in case the next byte completes `\r\n`.
	 */
	private _normalizeCrlf(flush: boolean): void {
		if (flush) {
			this._buffer = this._buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
			return;
		}
		if (this._buffer.endsWith('\r')) {
			const head = this._buffer.slice(0, -1).replace(/\r\n/g, '\n');
			this._buffer = head + '\r';
			return;
		}
		this._buffer = this._buffer.replace(/\r\n/g, '\n');
	}

	private _handleEventBlock(block: string): SseParseStep {
		const dataLines: string[] = [];
		for (const rawLine of block.split(/\r?\n/)) {
			const line = rawLine.trimEnd();
			if (!line || line.startsWith(':')) {
				continue;
			}
			if (line.startsWith('data:')) {
				dataLines.push(line.slice(5).trimStart());
			}
		}
		if (dataLines.length === 0) {
			return { deltas: [], done: false, error: undefined };
		}

		const data = dataLines.join('\n');
		if (data === '[DONE]') {
			return { deltas: [], done: true, error: undefined };
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(data);
		} catch {
			// Skip malformed JSON — hostile or truncated events must not abort the stream.
			return { deltas: [], done: false, error: undefined };
		}

		if (isInsufficientCreditsPayload(parsed)) {
			return {
				deltas: [],
				done: true,
				error: parseInsufficientCreditsError(parsed),
			};
		}

		const record = asRecord(parsed);
		if (record?.error) {
			const errObj = asRecord(record.error);
			const status = asFiniteNumber(errObj?.status) ?? asFiniteNumber(record.status);
			// Mid-stream auth-shaped errors must not trigger refresh/retry of a partial stream.
			if (status === 401) {
				return {
					deltas: [],
					done: true,
					error: new Error(typeof errObj?.message === 'string' ? errObj.message : 'Unauthorized'),
				};
			}
			const message = typeof errObj?.message === 'string'
				? errObj.message
				: 'Stream error';
			return { deltas: [], done: true, error: new Error(message) };
		}

		const text = extractDeltaText(parsed);
		return {
			deltas: text ? [text] : [],
			done: false,
			error: undefined,
		};
	}
}

/**
 * Extracts assistant text from a non-streaming OpenAI-style chat completion JSON body.
 */
export function extractJsonChatContent(body: unknown): string {
	const record = asRecord(body);
	const choices = record?.choices;
	if (!Array.isArray(choices) || choices.length === 0) {
		return '';
	}
	const first = asRecord(choices[0]);
	const message = asRecord(first?.message);
	if (typeof message?.content === 'string') {
		return message.content;
	}
	return '';
}

function extractDeltaText(parsed: unknown): string {
	const record = asRecord(parsed);
	const choices = record?.choices;
	if (!Array.isArray(choices) || choices.length === 0) {
		return '';
	}
	const first = asRecord(choices[0]);
	const delta = asRecord(first?.delta);
	if (!delta) {
		return '';
	}
	// Drop native tool_calls — Ask-mode advertises toolCalling:false.
	if (delta.tool_calls !== undefined) {
		return typeof delta.content === 'string' ? delta.content : '';
	}
	return typeof delta.content === 'string' ? delta.content : '';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
