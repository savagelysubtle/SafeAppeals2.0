/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { resolveDraftAccountId } from '../draftAccount';

suite('email agentTools', () => {
	test('resolveDraftAccountId picks sole account or requires id', () => {
		assert.deepStrictEqual(
			{
				none: resolveDraftAccountId(undefined, []),
				one: resolveDraftAccountId(undefined, [{ id: 'a1', email: 'a@example.com' }]),
				many: resolveDraftAccountId(undefined, [
					{ id: 'a1', email: 'a@example.com' },
					{ id: 'a2', label: 'Other' },
				]),
				explicit: resolveDraftAccountId('a2', [
					{ id: 'a1', email: 'a@example.com' },
					{ id: 'a2', label: 'Other' },
				]),
				unknown: resolveDraftAccountId('missing', [{ id: 'a1', email: 'a@example.com' }]),
			},
			{
				none: {
					error: 'Error: no email accounts configured. Add an account before creating drafts.',
				},
				one: { accountId: 'a1' },
				many: {
					error: 'Error: accountId is required when multiple accounts exist. Available: a1 (a@example.com), a2 (Other)',
				},
				explicit: { accountId: 'a2' },
				unknown: { error: 'Error: unknown accountId "missing".' },
			},
		);
	});
});
