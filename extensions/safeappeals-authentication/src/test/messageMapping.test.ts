/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	estimateMappedMessagesTokens,
	estimateTokens,
	mapChatMessages,
	mapToolChoice,
	mapTools,
} from '../llm/messageMapping';

suite('mapChatMessages', () => {
	test('maps text, tool_calls, and role:tool results; drops images', () => {
		const mapped = mapChatMessages([
			{
				role: 1,
				content: [
					{ value: 'Hello ' },
					{ value: 'world' },
					{ mimeType: 'image/png', data: new Uint8Array([1, 2, 3]) },
				],
			},
			{
				role: 2,
				content: [
					{ value: 'Sure.' },
					{ callId: 'c1', name: 'search', input: { q: 'x' } },
				],
			},
			{
				role: 1,
				content: [
					{
						callId: 'c1',
						content: [{ value: 'tool says hi' }],
					},
				],
			},
			{
				role: 1,
				content: [{ mimeType: 'image/jpeg', data: new Uint8Array([9]) }],
			},
		]);

		assert.deepStrictEqual(mapped, [
			{ role: 'user', content: 'Hello world' },
			{
				role: 'assistant',
				content: 'Sure.',
				tool_calls: [
					{
						id: 'c1',
						type: 'function',
						function: {
							name: 'search',
							arguments: JSON.stringify({ q: 'x' }),
						},
					},
				],
			},
			{
				role: 'tool',
				tool_call_id: 'c1',
				content: 'tool says hi',
			},
		]);
	});

	test('assistant-only tool_calls uses null content', () => {
		assert.deepStrictEqual(
			mapChatMessages([{
				role: 2,
				content: [{ callId: 'call_9', name: 'read_file', input: { path: 'a.ts' } }],
			}]),
			[{
				role: 'assistant',
				content: null,
				tool_calls: [{
					id: 'call_9',
					type: 'function',
					function: {
						name: 'read_file',
						arguments: JSON.stringify({ path: 'a.ts' }),
					},
				}],
			}],
		);
	});

	test('skips empty messages after filtering', () => {
		assert.deepStrictEqual(
			mapChatMessages([{ role: 1, content: [{ mimeType: 'image/png' }] }]),
			[],
		);
	});

	test('mixed tool results + text emits tool roles before user text', () => {
		assert.deepStrictEqual(
			mapChatMessages([{
				role: 1,
				content: [
					{ value: 'thanks' },
					{ callId: 'c1', content: [{ value: 'result-a' }] },
					{ callId: 'c2', content: [{ value: 'result-b' }] },
					{ value: ' continue' },
				],
			}]),
			[
				{ role: 'tool', tool_call_id: 'c1', content: 'result-a' },
				{ role: 'tool', tool_call_id: 'c2', content: 'result-b' },
				{ role: 'user', content: 'thanks continue' },
			],
		);
	});
});

suite('mapTools / mapToolChoice', () => {
	test('maps tools and toolMode', () => {
		assert.deepStrictEqual(
			{
				tools: mapTools([{
					name: 'read_file',
					description: 'Read a file',
					inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
				}]),
				auto: mapToolChoice(1),
				required: mapToolChoice(2),
			},
			{
				tools: [{
					type: 'function',
					function: {
						name: 'read_file',
						description: 'Read a file',
						parameters: { type: 'object', properties: { path: { type: 'string' } } },
					},
				}],
				auto: 'auto',
				required: 'required',
			},
		);
	});
});

suite('estimateTokens', () => {
	test('ceil(len/4) including empty', () => {
		assert.deepStrictEqual(
			{
				empty: estimateTokens(''),
				four: estimateTokens('abcd'),
				five: estimateTokens('abcde'),
			},
			{ empty: 0, four: 1, five: 2 },
		);
	});

	test('estimateMappedMessagesTokens includes tool payloads', () => {
		const tokens = estimateMappedMessagesTokens([{
			role: 'assistant',
			content: null,
			tool_calls: [{
				id: 'c1',
				type: 'function',
				function: { name: 'search', arguments: '{"q":"ab"}' },
			}],
		}]);
		assert.ok(tokens > 0);
	});
});
