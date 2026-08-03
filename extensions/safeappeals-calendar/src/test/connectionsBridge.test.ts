/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	calendarProviderFor,
	connectionAccountLabel,
	connectionProviderFor,
	connectionServesCalendar,
	toCalendarConnectionInfo,
} from '../connectionsBridge';

suite('calendar connections bridge', () => {
	test('provider ids map between calendar and service connections', () => {
		assert.deepStrictEqual(
			{
				google: connectionProviderFor('google'),
				outlook: connectionProviderFor('outlook'),
				fromGoogle: calendarProviderFor('google'),
				fromMicrosoft: calendarProviderFor('microsoft'),
				fromUnknown: calendarProviderFor('outlook'),
			},
			{
				google: 'google',
				outlook: 'microsoft',
				fromGoogle: 'google',
				fromMicrosoft: 'outlook',
				fromUnknown: undefined,
			},
		);
	});

	test('connection records are validated and normalized', () => {
		assert.deepStrictEqual(
			{
				parsed: toCalendarConnectionInfo({
					id: ' conn-1 ',
					provider: 'microsoft',
					accountEmail: 'jane@outlook.com',
					accountLabel: 'Jane Doe',
					providerAccountId: 'ms-42',
					capabilities: ['calendar', 7],
					status: 'active',
				}),
				missingId: toCalendarConnectionInfo({ provider: 'google' }),
				unknownProvider: toCalendarConnectionInfo({ id: 'conn-2', provider: 'yahoo' }),
				notAnObject: toCalendarConnectionInfo('conn-3'),
			},
			{
				parsed: {
					id: 'conn-1',
					provider: 'outlook',
					accountEmail: 'jane@outlook.com',
					accountLabel: 'Jane Doe',
					providerAccountId: 'ms-42',
					capabilities: ['calendar'],
					status: 'active',
				},
				missingId: undefined,
				unknownProvider: undefined,
				notAnObject: undefined,
			},
		);
	});

	test('only active calendar grants serve calendar, and each has a label', () => {
		assert.deepStrictEqual(
			{
				active: connectionServesCalendar({
					id: 'conn-1',
					provider: 'google',
					capabilities: ['calendar'],
					status: 'active',
				}),
				revoked: connectionServesCalendar({
					id: 'conn-2',
					provider: 'google',
					capabilities: ['calendar'],
					status: 'revoked',
				}),
				mailOnly: connectionServesCalendar({
					id: 'conn-3',
					provider: 'google',
					capabilities: ['mail'],
				}),
				emailLabel: connectionAccountLabel({
					id: 'conn-4',
					provider: 'google',
					accountEmail: 'jane@gmail.com',
					accountLabel: 'Jane Doe',
				}),
				fallbackLabel: connectionAccountLabel({ id: 'conn-5', provider: 'google' }),
			},
			{
				active: true,
				revoked: false,
				mailOnly: false,
				emailLabel: 'jane@gmail.com',
				fallbackLabel: 'conn-5',
			},
		);
	});
});
