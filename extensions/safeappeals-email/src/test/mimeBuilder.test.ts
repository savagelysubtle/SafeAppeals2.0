/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { buildRfc822Message } from '../mimeBuilder';
import type { EmailAccountConfig } from '../types';

suite('buildRfc822Message', () => {
	test('includes From, To, and Subject headers', async () => {
		const account: EmailAccountConfig = {
			id: 'a1',
			label: 'Test',
			email: 'from@example.com',
			imapHost: 'imap.example.com',
			imapPort: 993,
			imapSecure: true,
			smtpHost: 'smtp.example.com',
			smtpPort: 465,
			smtpSecure: true,
			username: 'from@example.com',
		};
		const raw = await buildRfc822Message(account, {
			to: 'to@example.com',
			subject: 'Draft subject',
			text: 'Hello draft',
		});
		const text = raw.toString('utf8');
		assert.deepStrictEqual(
			{
				hasFrom: /from:\s*from@example\.com/i.test(text),
				hasTo: /to:\s*to@example\.com/i.test(text),
				hasSubject: /subject:\s*Draft subject/i.test(text),
				hasBody: text.includes('Hello draft'),
			},
			{
				hasFrom: true,
				hasTo: true,
				hasSubject: true,
				hasBody: true,
			},
		);
	});
});
