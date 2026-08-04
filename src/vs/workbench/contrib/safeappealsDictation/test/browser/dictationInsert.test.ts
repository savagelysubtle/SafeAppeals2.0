/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { appendDictationText, insertDictationIntoChat } from '../../browser/dictationInsert.js';

suite('appendDictationText', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('appends with spacer when existing input has no trailing whitespace', () => {
		assert.strictEqual(appendDictationText('hello', 'world'), 'hello world');
	});

	test('does not add spacer when existing input ends with whitespace', () => {
		assert.strictEqual(appendDictationText('hello ', 'world'), 'hello world');
		assert.strictEqual(appendDictationText('hello\n', 'world'), 'hello\nworld');
	});

	test('appends without spacer when existing input is empty', () => {
		assert.strictEqual(appendDictationText('', 'hello'), 'hello');
	});

	test('returns existing unchanged when text is empty', () => {
		assert.strictEqual(appendDictationText('hello', ''), 'hello');
	});
});

suite('insertDictationIntoChat (_chat.dictation.insertText)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('calls setInput with appended text and never acceptInput', () => {
		const calls: { method: string; args: unknown[] }[] = [];
		let input = 'hello';
		const widget = {
			getInput: () => input,
			setInput: (query?: string) => {
				calls.push({ method: 'setInput', args: [query] });
				input = query ?? '';
			},
			acceptInput: (query?: string) => {
				calls.push({ method: 'acceptInput', args: [query] });
				return Promise.resolve(undefined);
			},
		};

		insertDictationIntoChat(widget, 'world');

		assert.deepStrictEqual(calls, [{ method: 'setInput', args: ['hello world'] }]);
		assert.strictEqual(input, 'hello world');
	});

	test('no-ops when text is empty without touching the widget', () => {
		let setInputCalls = 0;
		let acceptInputCalls = 0;
		const widget = {
			getInput: () => 'kept',
			setInput: () => { setInputCalls++; },
			acceptInput: () => {
				acceptInputCalls++;
				return Promise.resolve(undefined);
			},
		};

		insertDictationIntoChat(widget, '');

		assert.strictEqual(setInputCalls, 0);
		assert.strictEqual(acceptInputCalls, 0);
	});
});
