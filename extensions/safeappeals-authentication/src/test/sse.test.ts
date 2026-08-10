/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { InsufficientCreditsError, parseInsufficientCreditsError } from '../llm/insufficientCredits';
import { extractJsonChatContent, extractJsonChatResult, OpenAiSseParser, SSE_MAX_BUFFER_CHARS } from '../llm/sse';

suite('OpenAiSseParser', () => {
	test('assembles chunked deltas and respects [DONE]', () => {
		const parser = new OpenAiSseParser();
		const first = parser.push('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n');
		const second = parser.push('data: {"choices":[{"delta":{"content":"lo"}}]}\n\nda');
		const third = parser.push('ta: [DONE]\n\n');
		assert.deepStrictEqual(
			{
				first: first.deltas,
				second: second.deltas,
				third: { deltas: third.deltas, done: third.done, toolCalls: third.toolCalls },
			},
			{
				first: ['Hel'],
				second: ['lo'],
				third: { deltas: [], done: true, toolCalls: [] },
			},
		);
	});

	test('skips malformed JSON and continues', () => {
		const parser = new OpenAiSseParser();
		const step = parser.push(
			'data: {not-json\n\n' +
			'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n' +
			'data: [DONE]\n\n',
		);
		assert.deepStrictEqual(
			{ deltas: step.deltas, done: step.done, error: step.error },
			{ deltas: ['ok'], done: true, error: undefined },
		);
	});

	test('accumulates streamed tool_calls and emits on DONE', () => {
		const parser = new OpenAiSseParser();
		const first = parser.push(
			'data: {"choices":[{"delta":{"content":"hi","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"read_file","arguments":""}}]}}]}\n\n',
		);
		const second = parser.push(
			'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"path\\":\\"x\\"}"}}]}}]}\n\n',
		);
		const third = parser.push('data: [DONE]\n\n');
		assert.deepStrictEqual(
			{
				first: { deltas: first.deltas, toolCalls: first.toolCalls },
				second: second.toolCalls,
				third: { deltas: third.deltas, done: third.done, toolCalls: third.toolCalls },
			},
			{
				first: { deltas: ['hi'], toolCalls: [] },
				second: [],
				third: {
					deltas: [],
					done: true,
					toolCalls: [{ id: 'call_1', name: 'read_file', input: { path: 'x' } }],
				},
			},
		);
	});

	test('finalizes tool_calls on finish_reason without double-emit on DONE', () => {
		const parser = new OpenAiSseParser();
		const mid = parser.push(
			'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c2","type":"function","function":{"name":"list_dir","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}\n\n',
		);
		const done = parser.push('data: [DONE]\n\n');
		assert.deepStrictEqual(
			{ mid: mid.toolCalls, done: done.toolCalls },
			{
				mid: [{ id: 'c2', name: 'list_dir', input: {} }],
				done: [],
			},
		);
	});

	test('flush finalizes tool_calls when stream ends without DONE or finish_reason', () => {
		const parser = new OpenAiSseParser();
		const mid = parser.push(
			'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c3","type":"function","function":{"name":"read_file","arguments":"{\\"p\\":1}"}}]}}]}\n\n',
		);
		const flushed = parser.flush();
		assert.deepStrictEqual(
			{ mid: mid.toolCalls, flushed: { deltas: flushed.deltas, done: flushed.done, toolCalls: flushed.toolCalls } },
			{
				mid: [],
				flushed: {
					deltas: [],
					done: true,
					toolCalls: [{ id: 'c3', name: 'read_file', input: { p: 1 } }],
				},
			},
		);
	});

	test('surfaces mid-stream insufficient credits without treating as 401', () => {
		const parser = new OpenAiSseParser();
		const step = parser.push(
			'data: {"error":{"code":"INSUFFICIENT_CREDITS","message":"Need credits","required":100,"available":0,"purchaseUrl":"https://safeappeals.com/credits"}}\n\n',
		);
		assert.ok(step.error instanceof InsufficientCreditsError);
		const err = step.error as InsufficientCreditsError;
		assert.deepStrictEqual(
			{
				done: step.done,
				required: err.required,
				available: err.available,
				purchaseUrl: err.purchaseUrl,
			},
			{
				done: true,
				required: 100,
				available: 0,
				purchaseUrl: 'https://safeappeals.com/credits',
			},
		);
	});

	test('parses CRLF-delimited events', () => {
		const parser = new OpenAiSseParser();
		const step = parser.push(
			'data: {"choices":[{"delta":{"content":"CR"}}]}\r\n\r\n' +
			'data: {"choices":[{"delta":{"content":"LF"}}]}\r\n\r\n' +
			'data: [DONE]\r\n\r\n',
		);
		assert.deepStrictEqual(
			{ deltas: step.deltas, done: step.done, error: step.error },
			{ deltas: ['CR', 'LF'], done: true, error: undefined },
		);
	});

	test('mid-stream 401 yields plain error not InsufficientCredits', () => {
		const parser = new OpenAiSseParser();
		const step = parser.push(
			'data: {"error":{"status":401,"message":"token expired"}}\n\n',
		);
		assert.deepStrictEqual(
			{
				done: step.done,
				errorName: step.error?.name,
				errorMessage: step.error?.message,
				isInsufficientCredits: step.error instanceof InsufficientCreditsError,
			},
			{
				done: true,
				errorName: 'Error',
				errorMessage: 'token expired',
				isInsufficientCredits: false,
			},
		);
	});

	test('bounds the unfinished buffer', () => {
		const parser = new OpenAiSseParser();
		const step = parser.push('x'.repeat(SSE_MAX_BUFFER_CHARS + 1));
		assert.deepStrictEqual(
			{ done: step.done, hasError: !!step.error },
			{ done: true, hasError: true },
		);
	});

	test('recognizes the SafeAppeals result-ready event without completing the parser early', () => {
		const parser = new OpenAiSseParser();
		const ready = parser.push(
			'event: safeappeals.run.result_ready\n'
			+ 'data: {"run_id":"01700000-0000-4000-8000-000000000020","state":"result_ready","requires_ack":true}\n\n',
		);
		const done = parser.push('data: [DONE]\n\n');
		assert.deepStrictEqual(
			{ ready: { done: ready.done, runId: ready.resultReadyRunId }, done: { done: done.done, runId: done.resultReadyRunId } },
			{
				ready: { done: false, runId: '01700000-0000-4000-8000-000000000020' },
				done: { done: true, runId: '01700000-0000-4000-8000-000000000020' },
			},
		);
	});

	test('rejects malformed and multiple SafeAppeals result-ready events', () => {
		const malformed = new OpenAiSseParser().push(
			'event: safeappeals.run.result_ready\ndata: not-json\n\ndata: [DONE]\n\n',
		);
		const multipleParser = new OpenAiSseParser();
		multipleParser.push(
			'event: safeappeals.run.result_ready\n'
			+ 'data: {"run_id":"01700000-0000-4000-8000-000000000020","state":"result_ready","requires_ack":true}\n\n',
		);
		const multiple = multipleParser.push(
			'event: safeappeals.run.result_ready\n'
			+ 'data: {"run_id":"01700000-0000-4000-8000-000000000020","state":"result_ready","requires_ack":true}\n\n',
		);
		assert.deepStrictEqual(
			{ malformed: malformed.error?.message, multiple: multiple.error?.message },
			{ malformed: 'Malformed result-ready event', multiple: 'Invalid result-ready run identity' },
		);
	});
});

suite('extractJsonChatContent', () => {
	test('reads choices[0].message.content', () => {
		assert.deepStrictEqual(
			extractJsonChatContent({
				choices: [{ message: { role: 'assistant', content: 'plain reply' } }],
			}),
			'plain reply',
		);
	});

	test('returns empty string for missing content', () => {
		assert.strictEqual(extractJsonChatContent({ choices: [{}] }), '');
		assert.strictEqual(extractJsonChatContent({}), '');
	});

	test('extractJsonChatResult reads message.tool_calls', () => {
		assert.deepStrictEqual(
			extractJsonChatResult({
				choices: [{
					message: {
						role: 'assistant',
						content: null,
						tool_calls: [{
							id: 'call_9',
							type: 'function',
							function: { name: 'read_file', arguments: '{"path":"a.ts"}' },
						}],
					},
				}],
			}),
			{
				content: '',
				toolCalls: [{ id: 'call_9', name: 'read_file', input: { path: 'a.ts' } }],
			},
		);
	});
});

suite('parseInsufficientCreditsError', () => {
	test('keeps allow-listed purchaseUrl and drops garbage', () => {
		const good = parseInsufficientCreditsError({
			error: {
				code: 'INSUFFICIENT_CREDITS',
				message: 'Not enough credits',
				required: 50,
				available: 1,
				purchaseUrl: 'https://safeappeals.com/credits',
			},
		});
		const bad = parseInsufficientCreditsError({
			error: {
				message: 'Nope',
				purchaseUrl: 'javascript:alert(1)',
			},
		});
		const evilHost = parseInsufficientCreditsError({
			error: {
				purchaseUrl: 'https://evil.example/phish',
			},
		});
		assert.deepStrictEqual(
			{
				good: {
					name: good.name,
					required: good.required,
					available: good.available,
					purchaseUrl: good.purchaseUrl,
					message: good.message,
				},
				badPurchaseUrl: bad.purchaseUrl,
				evilHost: evilHost.purchaseUrl,
			},
			{
				good: {
					name: 'InsufficientCreditsError',
					required: 50,
					available: 1,
					purchaseUrl: 'https://safeappeals.com/credits',
					message: 'Not enough credits',
				},
				badPurchaseUrl: undefined,
				evilHost: undefined,
			},
		);
	});
});
