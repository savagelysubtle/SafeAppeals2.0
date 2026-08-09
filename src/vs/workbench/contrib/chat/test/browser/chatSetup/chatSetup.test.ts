/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { buildUpgradeUrlWithRedirect } from '../../../browser/chatSetup/chatSetup.js';
import { runSafeAppealsCloudSetup } from '../../../browser/chatSetup/chatSetupRunner.js';

/**
 * Parses the final URL and extracts the decoded return_to value,
 * then extracts the decoded vscode URI from the return_to redirect.
 */
function parseRedirectUrl(url: string): { returnTo: string; redirectHost: string; vscodeUri: string } {
	const questionIdx = url.indexOf('return_to=');
	const returnTo = decodeURIComponent(url.slice(questionIdx + 'return_to='.length));
	const redirectUrl = new URL(returnTo);
	const vscodeUri = decodeURIComponent(redirectUrl.searchParams.get('url')!);
	return { returnTo, redirectHost: redirectUrl.host, vscodeUri };
}

suite('buildUpgradeUrlWithRedirect', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('stable quality uses vscode.dev host', () => {
		const result = buildUpgradeUrlWithRedirect(
			'https://github.com/github-copilot/upgrade?utm_source=vscode',
			'vscode',
			'stable'
		);
		const { redirectHost, vscodeUri } = parseRedirectUrl(result);
		assert.strictEqual(redirectHost, 'vscode.dev');
		assert.strictEqual(vscodeUri, 'vscode://GitHub.copilot-chat/upgrade-success');
	});

	test('insider quality uses insiders.vscode.dev host', () => {
		const result = buildUpgradeUrlWithRedirect(
			'https://github.com/github-copilot/upgrade?utm_source=vscode',
			'vscode-insiders',
			'insider'
		);
		const { redirectHost, vscodeUri } = parseRedirectUrl(result);
		assert.strictEqual(redirectHost, 'insiders.vscode.dev');
		assert.strictEqual(vscodeUri, 'vscode-insiders://GitHub.copilot-chat/upgrade-success');
	});

	test('undefined quality defaults to insiders.vscode.dev host', () => {
		const result = buildUpgradeUrlWithRedirect(
			'https://github.com/github-copilot/upgrade?utm_source=vscode',
			'code-oss',
			undefined
		);
		const { redirectHost, vscodeUri } = parseRedirectUrl(result);
		assert.strictEqual(redirectHost, 'insiders.vscode.dev');
		assert.strictEqual(vscodeUri, 'code-oss://GitHub.copilot-chat/upgrade-success');
	});

	test('appends with & when base URL already has query params', () => {
		const result = buildUpgradeUrlWithRedirect(
			'https://github.com/github-copilot/upgrade?utm_source=vscode',
			'vscode',
			'stable'
		);
		assert.ok(result.startsWith('https://github.com/github-copilot/upgrade?utm_source=vscode&return_to='));
	});

	test('appends with ? when base URL has no query params', () => {
		const result = buildUpgradeUrlWithRedirect(
			'https://github.com/github-copilot/upgrade',
			'vscode',
			'stable'
		);
		assert.ok(result.startsWith('https://github.com/github-copilot/upgrade?return_to='));
	});

	test('GHE URL is handled correctly', () => {
		const result = buildUpgradeUrlWithRedirect(
			'https://github.example.com/github-copilot/upgrade?utm_source=vscode',
			'vscode',
			'stable'
		);
		assert.ok(result.startsWith('https://github.example.com/github-copilot/upgrade?utm_source=vscode&return_to='));
		const { vscodeUri } = parseRedirectUrl(result);
		assert.strictEqual(vscodeUri, 'vscode://GitHub.copilot-chat/upgrade-success');
	});
});

suite('SafeAppeals Cloud setup', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('enables auth extension before proceeding through provider setup', async () => {
		const calls: string[] = [];
		await runSafeAppealsCloudSetup({
			enableAuthExtension: async () => { calls.push('enable'); },
			activateAuthProvider: async () => { calls.push('activate'); },
			getSessionCount: async () => { calls.push('sessions'); return 0; },
			createSession: async () => { calls.push('create'); },
		});
		assert.deepStrictEqual(calls, ['enable', 'activate', 'sessions', 'create']);
	});

	test('reports auth extension enable failure without proceeding', async () => {
		const expectedError = new Error('enable failed');
		const calls: string[] = [];
		await assert.rejects(() => runSafeAppealsCloudSetup({
			enableAuthExtension: async () => { throw expectedError; },
			activateAuthProvider: async () => { calls.push('activate'); },
			getSessionCount: async () => 0,
			createSession: async () => { calls.push('create'); },
		}), expectedError);
		assert.deepStrictEqual(calls, []);
	});

	test('already-enabled auth extension proceeds unchanged', async () => {
		const calls: string[] = [];
		await runSafeAppealsCloudSetup({
			enableAuthExtension: async () => { calls.push('checked'); },
			activateAuthProvider: async () => { calls.push('activate'); },
			getSessionCount: async () => 0,
			createSession: async () => { calls.push('create'); },
		});
		assert.deepStrictEqual(calls, ['checked', 'activate', 'create']);
	});

	test('preserves an existing session', async () => {
		const calls: string[] = [];
		await runSafeAppealsCloudSetup({
			enableAuthExtension: async () => { calls.push('checked'); },
			activateAuthProvider: async () => { calls.push('activate'); },
			getSessionCount: async () => { calls.push('sessions'); return 1; },
			createSession: async () => { calls.push('create'); },
		});
		assert.deepStrictEqual(calls, ['checked', 'activate', 'sessions']);
	});
});
