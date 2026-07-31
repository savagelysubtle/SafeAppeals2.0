/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { estimateTokens, mapChatMessages } from '../llm/messageMapping';

suite('mapChatMessages', () => {
	test('maps roles, concatenates text, stringifies tool results, drops images', () => {
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
				content: 'Sure.' + JSON.stringify({
					toolCall: 'search',
					callId: 'c1',
					input: { q: 'x' },
				}),
			},
			{
				role: 'user',
				content: JSON.stringify({
					toolResult: 'c1',
					content: 'tool says hi',
				}),
			},
		]);
	});

	test('skips empty messages after filtering', () => {
		assert.deepStrictEqual(
			mapChatMessages([{ role: 1, content: [{ mimeType: 'image/png' }] }]),
			[],
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
});
