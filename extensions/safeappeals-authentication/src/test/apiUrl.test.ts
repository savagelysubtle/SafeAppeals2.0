/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { DEFAULT_API_URL, resolveApiUrl } from '../apiUrl';

suite('resolveApiUrl', () => {
	test('production always returns DEFAULT_API_URL and ignores overrides', () => {
		assert.deepStrictEqual(
			{
				plain: resolveApiUrl({ isDev: false }),
				withEnv: resolveApiUrl({
					isDev: false,
					envUrl: 'https://evil.example/',
					debugSettingUrl: 'http://localhost:8787/',
				}),
			},
			{
				plain: DEFAULT_API_URL,
				withEnv: DEFAULT_API_URL,
			},
		);
	});

	test('dev prefers env over debug setting, strips trailing slashes', () => {
		assert.deepStrictEqual(
			{
				envWins: resolveApiUrl({
					isDev: true,
					envUrl: '  http://localhost:8787/  ',
					debugSettingUrl: 'https://staging.example/',
				}),
				debugOnly: resolveApiUrl({
					isDev: true,
					envUrl: '   ',
					debugSettingUrl: 'https://staging.example///',
				}),
				neither: resolveApiUrl({ isDev: true, envUrl: '', debugSettingUrl: undefined }),
			},
			{
				envWins: 'http://localhost:8787',
				debugOnly: 'https://staging.example',
				neither: DEFAULT_API_URL,
			},
		);
	});
});
