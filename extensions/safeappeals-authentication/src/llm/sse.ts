/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isInsufficientCreditsPayload, parseInsufficientCreditsError } from './insufficientCredits';

/** Hard cap on the unfinished SSE buffer to resist hostile / oversized streams. */
export const SSE_MAX_BUFFER_CHARS = 256 * 1024;

/**
 * A completed tool call assembled from streamed `delta.tool_calls` fragments.
 */
export interface SseToolCall {
	readonly id: string;
	readonly name: string;
	readonly input: object;
}

/**
 * One incremental parse step from an OpenAI-compatible chat completion SSE stream.
 */
export interface SseParseStep {
	readonly deltas: readonly string[];
	/** Newly finalized tool calls (emitted on finish / [DONE] / flush). */
	readonly toolCalls: readonly SseToolCall[];
	readonly done: boolean;
	/** Run whose complete result is ready for acknowledgement after all parts are consumed. */
	readonly resultReadyRunId?: string;
	/** True only after the protocol's explicit `[DONE]` marker, never an EOF flush. */
	readonly sawDoneMarker?: boolean;
	/** Set when the stream reports an error; caller must not retry a partial stream. */
	readonly error: Error | undefined;
}

interface AccumulatedToolCall {
	id: string;
	name: string;
	arguments: string;
}

/**
 * Incremental OpenAI chat-completions SSE parser (vscode-free).
 *
 * - Skips malformed events / JSON
 * - Treats `data: [DONE]` as completion
 * - Accumulates `delta.tool_calls` by index and finalizes on finish / [DONE]
 * - Bounds the unfinished buffer
 * - Surfaces 402 / insufficient-credit error payloads without treating them as 401
 */
export class OpenAiSseParser {
	private _buffer = '';
	private _done = false;
	private _toolCallsEmitted = false;
	private _resultReadyRunId: string | undefined;
	private _resultReadyCount = 0;
	private _sawDoneMarker = false;
	private readonly _toolCalls = new Map<number, AccumulatedToolCall>();

	/**
	 * Feeds the next decoded text chunk and returns newly extracted text deltas.
	 */
	push(chunk: string): SseParseStep {
		if (this._done) {
			return { deltas: [], toolCalls: [], done: true, error: undefined };
		}
		this._buffer += chunk;
		if (this._buffer.length > SSE_MAX_BUFFER_CHARS) {
			this._done = true;
			return {
				deltas: [],
				toolCalls: [],
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
			return { deltas: [], toolCalls: [], done: true, error: undefined };
		}
		const step = this._drain(true);
		if (!this._done) {
			this._done = true;
			const toolCalls = this._finalizeToolCalls();
			return {
				deltas: step.deltas,
				toolCalls: toolCalls.length > 0 ? toolCalls : step.toolCalls,
				done: true,
				error: step.error,
			};
		}
		return step;
	}

	private _drain(flush: boolean): SseParseStep {
		this._normalizeCrlf(flush);
		const deltas: string[] = [];
		let toolCalls: SseToolCall[] = [];
		let error: Error | undefined;

		while (true) {
			const sep = this._buffer.indexOf('\n\n');
			if (sep < 0) {
				if (flush && this._buffer.trim().length > 0) {
					const step = this._handleEventBlock(this._buffer);
					this._buffer = '';
					deltas.push(...step.deltas);
					toolCalls = toolCalls.concat(step.toolCalls);
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
			toolCalls = toolCalls.concat(step.toolCalls);
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

		return {
			deltas,
			toolCalls,
			done: this._done,
			...(this._resultReadyRunId ? { resultReadyRunId: this._resultReadyRunId } : {}),
			...(this._sawDoneMarker ? { sawDoneMarker: true } : {}),
			error,
		};
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
		let eventName: string | undefined;
		for (const rawLine of block.split(/\r?\n/)) {
			const line = rawLine.trimEnd();
			if (!line || line.startsWith(':')) {
				continue;
			}
			if (line.startsWith('data:')) {
				dataLines.push(line.slice(5).trimStart());
			} else if (line.startsWith('event:')) {
				eventName = line.slice(6).trim();
			}
		}
		if (dataLines.length === 0) {
			return { deltas: [], toolCalls: [], done: false, error: undefined };
		}

		const data = dataLines.join('\n');
		if (data === '[DONE]') {
			this._sawDoneMarker = true;
			return {
				deltas: [],
				toolCalls: this._finalizeToolCalls(),
				done: true,
				sawDoneMarker: true,
				error: undefined,
			};
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(data);
		} catch {
			if (eventName === 'safeappeals.run.result_ready') {
				return { deltas: [], toolCalls: [], done: true, error: new Error('Malformed result-ready event') };
			}
			// Skip malformed JSON — hostile or truncated events must not abort the stream.
			return { deltas: [], toolCalls: [], done: false, error: undefined };
		}

		if (isInsufficientCreditsPayload(parsed)) {
			return {
				deltas: [],
				toolCalls: [],
				done: true,
				error: parseInsufficientCreditsError(parsed),
			};
		}

		const record = asRecord(parsed);
		if (eventName === 'safeappeals.run.result_ready') {
			const runId = record?.state === 'result_ready'
				&& record.requires_ack === true
				&& typeof record.run_id === 'string'
				&& isUuid(record.run_id)
				? record.run_id
				: undefined;
			this._resultReadyCount++;
			if (!runId || this._resultReadyCount !== 1 || (this._resultReadyRunId && this._resultReadyRunId !== runId)) {
				return { deltas: [], toolCalls: [], done: true, error: new Error('Invalid result-ready run identity') };
			}
			this._resultReadyRunId = runId;
			return {
				deltas: [],
				toolCalls: [],
				done: false,
				resultReadyRunId: this._resultReadyRunId,
				error: undefined,
			};
		}
		if (record?.error) {
			const errObj = asRecord(record.error);
			const status = asFiniteNumber(errObj?.status) ?? asFiniteNumber(record.status);
			// Mid-stream auth-shaped errors must not trigger refresh/retry of a partial stream.
			if (status === 401) {
				return {
					deltas: [],
					toolCalls: [],
					done: true,
					error: new Error(typeof errObj?.message === 'string' ? errObj.message : 'Unauthorized'),
				};
			}
			const message = typeof errObj?.message === 'string'
				? errObj.message
				: 'Stream error';
			return { deltas: [], toolCalls: [], done: true, error: new Error(message) };
		}

		const { text, finishReason } = extractDelta(parsed);
		this._accumulateToolCalls(parsed);
		const shouldFinalize = finishReason === 'tool_calls'
			|| finishReason === 'stop'
			|| finishReason === 'length';
		const toolCalls = shouldFinalize ? this._finalizeToolCalls() : [];

		return {
			deltas: text ? [text] : [],
			toolCalls,
			done: false,
			error: undefined,
		};
	}

	private _accumulateToolCalls(parsed: unknown): void {
		const record = asRecord(parsed);
		const choices = record?.choices;
		if (!Array.isArray(choices) || choices.length === 0) {
			return;
		}
		const first = asRecord(choices[0]);
		const delta = asRecord(first?.delta);
		const message = asRecord(first?.message);
		const rawCalls = delta?.tool_calls ?? message?.tool_calls;
		if (!Array.isArray(rawCalls)) {
			return;
		}
		for (const raw of rawCalls) {
			const call = asRecord(raw);
			if (!call) {
				continue;
			}
			const index = asFiniteNumber(call.index) ?? this._toolCalls.size;
			const existing = this._toolCalls.get(index) ?? { id: '', name: '', arguments: '' };
			if (typeof call.id === 'string' && call.id.length > 0) {
				existing.id = call.id;
			}
			const fn = asRecord(call.function);
			if (fn) {
				if (typeof fn.name === 'string' && fn.name.length > 0) {
					existing.name = fn.name;
				}
				if (typeof fn.arguments === 'string') {
					existing.arguments += fn.arguments;
				}
			}
			this._toolCalls.set(index, existing);
		}
	}

	private _finalizeToolCalls(): SseToolCall[] {
		if (this._toolCallsEmitted || this._toolCalls.size === 0) {
			return [];
		}
		this._toolCallsEmitted = true;
		const indices = [...this._toolCalls.keys()].sort((a, b) => a - b);
		const result: SseToolCall[] = [];
		for (const index of indices) {
			const call = this._toolCalls.get(index);
			if (!call || !call.id || !call.name) {
				continue;
			}
			result.push({
				id: call.id,
				name: call.name,
				input: parseToolArguments(call.arguments),
			});
		}
		return result;
	}
}

function isUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Non-streaming chat completion extraction result.
 */
export interface JsonChatResult {
	readonly content: string;
	readonly toolCalls: readonly SseToolCall[];
}

/**
 * Extracts assistant text from a non-streaming OpenAI-style chat completion JSON body.
 */
export function extractJsonChatContent(body: unknown): string {
	return extractJsonChatResult(body).content;
}

/**
 * Extracts assistant text and tool_calls from a non-streaming completion body.
 */
export function extractJsonChatResult(body: unknown): JsonChatResult {
	const record = asRecord(body);
	const choices = record?.choices;
	if (!Array.isArray(choices) || choices.length === 0) {
		return { content: '', toolCalls: [] };
	}
	const first = asRecord(choices[0]);
	const message = asRecord(first?.message);
	const content = typeof message?.content === 'string' ? message.content : '';
	const toolCalls: SseToolCall[] = [];
	if (Array.isArray(message?.tool_calls)) {
		for (const raw of message.tool_calls) {
			const call = asRecord(raw);
			if (!call) {
				continue;
			}
			const fn = asRecord(call.function);
			const id = typeof call.id === 'string' ? call.id : '';
			const name = typeof fn?.name === 'string' ? fn.name : '';
			if (!id || !name) {
				continue;
			}
			toolCalls.push({
				id,
				name,
				input: parseToolArguments(typeof fn?.arguments === 'string' ? fn.arguments : '{}'),
			});
		}
	}
	return { content, toolCalls };
}

function extractDelta(parsed: unknown): { text: string; finishReason: string | undefined } {
	const record = asRecord(parsed);
	const choices = record?.choices;
	if (!Array.isArray(choices) || choices.length === 0) {
		return { text: '', finishReason: undefined };
	}
	const first = asRecord(choices[0]);
	const finishReason = typeof first?.finish_reason === 'string' ? first.finish_reason : undefined;
	const delta = asRecord(first?.delta);
	const text = typeof delta?.content === 'string' ? delta.content : '';
	return { text, finishReason };
}

function parseToolArguments(raw: string): object {
	const trimmed = raw.trim();
	if (!trimmed) {
		return {};
	}
	try {
		const parsed = JSON.parse(trimmed);
		if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as object;
		}
		return { value: parsed };
	} catch {
		return { raw: trimmed };
	}
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
