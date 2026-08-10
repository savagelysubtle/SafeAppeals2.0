/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { BrowserChatToolReferenceName } from '../../../../../platform/browserView/common/browserChatToolReferenceNames.js';
import {
	BROWSER_CDP_MAX_RESULT_CHARS,
	BrowserCdpToolId,
	truncateCdpJson,
} from '../../electron-browser/tools/browserCdpTool.js';
import { browserCdpSessionStore } from '../../electron-browser/tools/browserCdpSessionStore.js';

suite('browserCdpTool contract', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	teardown(() => {
		browserCdpSessionStore.clearForTests();
	});

	test('reference name and tool id stay aligned for CORE registration', () => {
		assert.deepStrictEqual(
			{
				toolId: BrowserCdpToolId,
				reference: BrowserChatToolReferenceName.BrowserCdp,
			},
			{
				toolId: 'browser_cdp',
				reference: 'browserCdp',
			},
		);
	});

	test('truncateCdpJson caps oversized payloads in memory', () => {
		const small = truncateCdpJson({ ok: true });
		const big = truncateCdpJson({ blob: 'x'.repeat(BROWSER_CDP_MAX_RESULT_CHARS + 500) });
		assert.deepStrictEqual(
			{
				smallOk: small.includes('ok'),
				bigCapped: big.length <= BROWSER_CDP_MAX_RESULT_CHARS + 120,
				bigMentionsTruncated: big.includes('truncated'),
			},
			{
				smallOk: true,
				bigCapped: true,
				bigMentionsTruncated: true,
			},
		);
	});

	test('CDP session store reuses groups, drops stale mapping on destroy, and disposes with chat session', async () => {
		browserCdpSessionStore.clearForTests();
		const destroyed: string[] = [];
		let createCount = 0;
		const destroyEmitters = new Map<string, Emitter<void>>();

		const fakeCdp = {
			async createSessionGroup(browserId: string): Promise<string> {
				createCount++;
				const groupId = `group-${browserId}-${createCount}`;
				const emitter = store.add(new Emitter<void>());
				destroyEmitters.set(groupId, emitter);
				return groupId;
			},
			async destroySessionGroup(groupId: string): Promise<void> {
				destroyed.push(groupId);
				destroyEmitters.get(groupId)?.fire();
			},
			onDidDestroy(groupId: string): Event<void> {
				return destroyEmitters.get(groupId)?.event ?? Event.None;
			},
		};

		const g1 = await browserCdpSessionStore.getOrCreateGroup(fakeCdp as never, 'chat-a', 'page-1');
		const g1Again = await browserCdpSessionStore.getOrCreateGroup(fakeCdp as never, 'chat-a', 'page-1');
		assert.strictEqual(g1, g1Again);

		// Mid-chat destroy: drop stale mapping and recreate on next getOrCreate.
		destroyEmitters.get(g1)?.fire();
		assert.strictEqual(browserCdpSessionStore.hasGroupForTests('chat-a', 'page-1'), false);

		const g1Recreated = await browserCdpSessionStore.getOrCreateGroup(fakeCdp as never, 'chat-a', 'page-1');
		assert.notStrictEqual(g1, g1Recreated);
		assert.strictEqual(browserCdpSessionStore.hasGroupForTests('chat-a', 'page-1'), true);

		const g2 = await browserCdpSessionStore.getOrCreateGroup(fakeCdp as never, 'chat-a', 'page-2');
		assert.notStrictEqual(g1Recreated, g2);

		await browserCdpSessionStore.disposeChatSession(fakeCdp as never, 'chat-a');
		assert.deepStrictEqual(
			{
				destroyedSorted: destroyed.slice().sort(),
				sessions: browserCdpSessionStore.trackedSessionCountForTests(),
				createCount,
			},
			{
				destroyedSorted: [g1Recreated, g2].sort(),
				sessions: 0,
				createCount: 3,
			},
		);
	});
});
