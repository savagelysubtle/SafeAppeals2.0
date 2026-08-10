/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import type { IBrowserViewCDPService } from '../../common/browserView.js';

/**
 * Tracks Agent `browser_cdp` session groups keyed by chat session + page id so
 * groups can be destroyed when the chat session disposes (parity with Playwright).
 *
 * If a group is destroyed mid-chat (e.g. page closed), the mapping is dropped so
 * the next call recreates via {@link IBrowserViewCDPService.createSessionGroup}.
 */
class BrowserCdpSessionStore {
	/** chatSessionId → (pageId → groupId) */
	private readonly _groups = new Map<string, Map<string, string>>();
	/** chatSessionId → disposables for onDidDestroy listeners */
	private readonly _listeners = new Map<string, DisposableStore>();
	private _nextRequestId = 1;

	nextRequestId(): number {
		const id = this._nextRequestId++;
		if (this._nextRequestId > 1_000_000_000) {
			this._nextRequestId = 1;
		}
		return id;
	}

	async getOrCreateGroup(
		cdpService: IBrowserViewCDPService,
		chatSessionId: string,
		pageId: string,
	): Promise<string> {
		let byPage = this._groups.get(chatSessionId);
		if (!byPage) {
			byPage = new Map();
			this._groups.set(chatSessionId, byPage);
		}
		const existing = byPage.get(pageId);
		if (existing) {
			return existing;
		}
		const groupId = await cdpService.createSessionGroup(pageId);
		byPage.set(pageId, groupId);

		let sessionListeners = this._listeners.get(chatSessionId);
		if (!sessionListeners) {
			sessionListeners = new DisposableStore();
			this._listeners.set(chatSessionId, sessionListeners);
		}
		sessionListeners.add(cdpService.onDidDestroy(groupId)(() => {
			this._dropGroupMapping(chatSessionId, pageId, groupId);
		}));

		return groupId;
	}

	/**
	 * Drop a stale page→group mapping when the group is destroyed mid-chat.
	 * Safe if the mapping already points at a newer groupId.
	 */
	private _dropGroupMapping(chatSessionId: string, pageId: string, groupId: string): void {
		const byPage = this._groups.get(chatSessionId);
		if (!byPage) {
			return;
		}
		if (byPage.get(pageId) === groupId) {
			byPage.delete(pageId);
		}
		if (byPage.size === 0) {
			this._groups.delete(chatSessionId);
		}
	}

	/**
	 * Destroy all CDP groups created for a chat session.
	 * Safe to call when the session had no CDP activity.
	 */
	async disposeChatSession(cdpService: IBrowserViewCDPService, chatSessionId: string): Promise<void> {
		const byPage = this._groups.get(chatSessionId);
		this._listeners.get(chatSessionId)?.dispose();
		this._listeners.delete(chatSessionId);
		if (!byPage) {
			return;
		}
		this._groups.delete(chatSessionId);
		await Promise.all([...byPage.values()].map(groupId =>
			cdpService.destroySessionGroup(groupId).catch(() => { })
		));
	}

	/** Test helper: clear all tracked groups without destroying (no IPC). */
	clearForTests(): void {
		for (const store of this._listeners.values()) {
			store.dispose();
		}
		this._listeners.clear();
		this._groups.clear();
		this._nextRequestId = 1;
	}

	/** Test helper: number of tracked chat sessions. */
	trackedSessionCountForTests(): number {
		return this._groups.size;
	}

	/** Test helper: whether a page still maps to a group for a chat session. */
	hasGroupForTests(chatSessionId: string, pageId: string): boolean {
		return this._groups.get(chatSessionId)?.has(pageId) ?? false;
	}
}

export const browserCdpSessionStore = new BrowserCdpSessionStore();
