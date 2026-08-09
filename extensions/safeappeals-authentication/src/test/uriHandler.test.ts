/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { OutputChannel, Uri } from 'vscode';
import {
	CloudUriHandler,
	type AuthCallbackError,
	type AuthCallbackResult,
	type ConnectCallbackResult,
} from '../uriHandler';

/** Builds the shape of a deep link `handleUri` reads, without touching Uri.parse. */
function deepLink(path: string, query = '', fragment = ''): Uri {
	return {
		scheme: 'safe-appeals-navigator',
		authority: 'safeappeals.safeappeals-authentication',
		path,
		query,
		fragment,
	} as Uri;
}

function makeHandler() {
	const lines: string[] = [];
	const output = { appendLine: (line: string) => { lines.push(line); } } as OutputChannel;
	// register: false — VS Code allows a single URI handler per extension.
	const handler = new CloudUriHandler(output, false);
	const auth: AuthCallbackResult[] = [];
	const connects: ConnectCallbackResult[] = [];
	const errors: AuthCallbackError[] = [];
	handler.onCallback(result => auth.push(result));
	handler.onConnectCallback(result => connects.push(result));
	handler.onError(result => errors.push(result));
	return { handler, auth, connects, errors, lines };
}

suite('CloudUriHandler', () => {
	test('routes /connect and /auth/callback, ignoring everything else', () => {
		const { handler, auth, connects } = makeHandler();

		handler.handleUri(deepLink('/connect', 'requestId=req-1&status=ok'));
		handler.handleUri(deepLink('/connect', 'requestId=req-2&status=error&error_description=denied'));
		handler.handleUri(deepLink('/connect', 'status=ok'));
		handler.handleUri(deepLink('/auth/callback', 'code=auth-code&state=state-1'));
		handler.handleUri(deepLink('/connect/extra', 'requestId=req-3&status=ok'));

		assert.deepStrictEqual(
			{ connects, auth },
			{
				connects: [
					{ requestId: 'req-1', ok: true },
					{ requestId: 'req-2', ok: false, message: 'denied' },
				],
				auth: [{ code: 'auth-code', state: 'state-1' }],
			},
		);
		handler.dispose();
	});

	test('bounds OAuth descriptions without logging attacker-controlled text', () => {
		const { handler, errors, lines } = makeHandler();
		const attack = `${'x'.repeat(300)}%0Aforged-log`;
		handler.handleUri(deepLink('/auth/callback', `error=server_error&state=state-1&error_description=${attack}`));

		assert.deepStrictEqual({
			errorLength: errors[0]?.cancelled === false ? errors[0].message.length : 0,
			loggedAttack: lines.some(line => line.includes('forged-log')),
		}, { errorLength: 200, loggedAttack: false });
		handler.dispose();
	});

	test('a connect deep link carrying fragment tokens is still only a requestId', () => {
		const { handler, connects } = makeHandler();
		handler.handleUri(deepLink('/connect', 'requestId=req-1&status=ok', 'access_token=leaked'));
		assert.deepStrictEqual(connects, [{ requestId: 'req-1', ok: true }]);
		handler.dispose();
	});
});
