/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { describeImapError, toImapFlowAuth } from '../imapClient';
import { toNodemailerAuth } from '../smtpClient';

suite('mailbox auth → library auth', () => {
	test('password and oauth map for imapflow and nodemailer', () => {
		const user = 'lawyer@example.com';
		assert.deepStrictEqual(
			{
				imapPassword: toImapFlowAuth(user, { type: 'password', password: 'app-pass' }),
				imapOauth: toImapFlowAuth(user, { type: 'oauth', accessToken: 'ya29.token' }),
				smtpPassword: toNodemailerAuth(user, { type: 'password', password: 'app-pass' }),
				smtpOauth: toNodemailerAuth(user, { type: 'oauth', accessToken: 'ya29.token' }),
			},
			{
				imapPassword: { user, pass: 'app-pass' },
				imapOauth: { user, accessToken: 'ya29.token' },
				smtpPassword: { user, pass: 'app-pass' },
				smtpOauth: { type: 'OAuth2', user, accessToken: 'ya29.token' },
			},
		);
	});
});

suite('describeImapError Gmail app-password hint', () => {
	test('appends hint only for password auth on Gmail auth failures', () => {
		const authErr = {
			message: 'Command failed',
			responseText: 'Invalid credentials',
			serverResponseCode: 'AUTHENTICATIONFAILED',
			authenticationFailed: true,
		};
		const passwordHint = describeImapError(authErr, 'imap.gmail.com', 'password');
		const oauthNoHint = describeImapError(authErr, 'imap.gmail.com', 'oauth');
		const nonGmail = describeImapError(authErr, 'imap.example.com', 'password');
		assert.deepStrictEqual(
			{
				passwordHasHint: passwordHint.includes('App Password'),
				oauthHasHint: oauthNoHint.includes('App Password'),
				nonGmailHasHint: nonGmail.includes('App Password'),
				oauthKeepsCode: oauthNoHint.includes('AUTHENTICATIONFAILED'),
			},
			{
				passwordHasHint: true,
				oauthHasHint: false,
				nonGmailHasHint: false,
				oauthKeepsCode: true,
			},
		);
	});

	test('oauth failure carrying a required scope points at a missing Gmail grant', () => {
		const parsed = describeImapError(
			{
				message: 'Command failed',
				responseText: 'Invalid credentials (Failure)',
				serverResponseCode: 'AUTHENTICATIONFAILED',
				authenticationFailed: true,
				oauthError: { status: 'invalid_request', scope: 'https://mail.google.com/' },
			},
			'imap.gmail.com',
			'oauth',
		);
		const raw = describeImapError(
			{
				message: 'Command failed',
				responseText: 'Invalid credentials (Failure)',
				authenticationFailed: true,
				oauthError: '{"status":"invalid_request","scope":"https://mail.google.com/"}',
			},
			'imap.gmail.com',
			'oauth',
		);
		const withoutScope = describeImapError(
			{
				message: 'Command failed',
				responseText: 'Invalid credentials (Failure)',
				authenticationFailed: true,
				oauthError: { status: 'invalid_request' },
			},
			'imap.gmail.com',
			'oauth',
		);
		assert.deepStrictEqual(
			{
				parsedMentionsScope: parsed.includes('missing Gmail access (https://mail.google.com/)'),
				parsedSuggestsReconnect: parsed.includes('reconnect the mailbox'),
				rawMentionsScope: raw.includes('missing Gmail access (https://mail.google.com/)'),
				withoutScopeStaysQuiet: withoutScope.includes('missing Gmail access'),
			},
			{
				parsedMentionsScope: true,
				parsedSuggestsReconnect: true,
				rawMentionsScope: true,
				withoutScopeStaysQuiet: false,
			},
		);
	});
});
