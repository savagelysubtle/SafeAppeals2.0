/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { InsufficientCreditsError, parseInsufficientCreditsError } from '../llm/insufficientCredits';
import { extractJsonChatContent, OpenAiSseParser, SSE_MAX_BUFFER_CHARS } from '../llm/sse';

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
				third: { deltas: third.deltas, done: third.done },
			},
			{
				first: ['Hel'],
				second: ['lo'],
				third: { deltas: [], done: true },
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

	test('drops tool_calls while keeping text content', () => {
		const parser = new OpenAiSseParser();
		const step = parser.push(
			'data: {"choices":[{"delta":{"content":"hi","tool_calls":[{"index":0}]}}]}\n\n' +
			'data: {"choices":[{"delta":{"tool_calls":[{"id":"x"}]}}]}\n\n' +
			'data: [DONE]\n\n',
		);
		assert.deepStrictEqual(step.deltas, ['hi']);
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
