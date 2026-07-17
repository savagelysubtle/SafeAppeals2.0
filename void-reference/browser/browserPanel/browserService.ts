/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { BrowserViewBounds, BrowserViewNavigationEvent, BrowserViewLoadingEvent } from '../../common/browserPanelTypes.js';

export interface BrowserDownloadEvent {
	viewId: string;
	filename: string;
	url: string;
	state: 'started' | 'completed' | 'cancelled' | 'interrupted';
	receivedBytes: number;
	totalBytes: number;
	savePath: string;
}

export interface BrowserHistoryEntry {
	url: string;
	title: string;
	timestamp: number;
}

export interface BrowserBookmark {
	url: string;
	title: string;
	addedAt: number;
}

const HISTORY_STORAGE_KEY = 'void.browser.history';
const BOOKMARKS_STORAGE_KEY = 'void.browser.bookmarks';
const MAX_HISTORY_ENTRIES = 200;

export const IBrowserPanelService = createDecorator<IBrowserPanelService>('browserPanelService');

export interface IBrowserPanelService {
	readonly _serviceBrand: undefined;

	readonly onNavigation: Event<BrowserViewNavigationEvent>;
	readonly onLoading: Event<BrowserViewLoadingEvent>;
	readonly onDownload: Event<BrowserDownloadEvent>;

	createView(viewId: string, url: string, bounds: BrowserViewBounds): Promise<void>;
	destroyView(viewId: string): Promise<void>;
	navigateTo(viewId: string, url: string): Promise<void>;
	goBack(viewId: string): Promise<void>;
	goForward(viewId: string): Promise<void>;
	reload(viewId: string): Promise<void>;
	setBounds(viewId: string, bounds: BrowserViewBounds): Promise<void>;
	setVisible(viewId: string, visible: boolean): Promise<void>;
	openDevTools(viewId: string): Promise<void>;
	findInPage(viewId: string, text: string, options?: { forward?: boolean; matchCase?: boolean }): Promise<void>;
	stopFindInPage(viewId: string): Promise<void>;
	focusView(viewId: string): Promise<void>;
	showContextMenu(items: { id: string; label: string; separator?: boolean }[]): Promise<string | null>;

	getHistory(): BrowserHistoryEntry[];
	clearHistory(): void;
	getBookmarks(): BrowserBookmark[];
	addBookmark(url: string, title: string): void;
	removeBookmark(url: string): void;
	isBookmarked(url: string): boolean;
}

class BrowserPanelService extends Disposable implements IBrowserPanelService {
	declare readonly _serviceBrand: undefined;

	private readonly channel: IChannel;

	private readonly _onNavigation = this._register(new Emitter<BrowserViewNavigationEvent>());
	readonly onNavigation: Event<BrowserViewNavigationEvent> = this._onNavigation.event;

	private readonly _onLoading = this._register(new Emitter<BrowserViewLoadingEvent>());
	readonly onLoading: Event<BrowserViewLoadingEvent> = this._onLoading.event;

	private readonly _onDownload = this._register(new Emitter<BrowserDownloadEvent>());
	readonly onDownload: Event<BrowserDownloadEvent> = this._onDownload.event;

	private _history: BrowserHistoryEntry[] = [];
	private _bookmarks: BrowserBookmark[] = [];

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();
		this.channel = mainProcessService.getChannel('void-channel-browser-panel');

		this._loadHistory();
		this._loadBookmarks();

		this._register(
			(this.channel.listen<BrowserViewNavigationEvent>('onNavigation'))(e => {
				this._onNavigation.fire(e);
				this._addHistoryEntry(e.url, e.title);
			})
		);

		this._register(
			(this.channel.listen<BrowserViewLoadingEvent>('onLoading'))(e => {
				this._onLoading.fire(e);
			})
		);

		this._register(
			(this.channel.listen<BrowserDownloadEvent>('onDownload'))(e => {
				this._onDownload.fire(e);
			})
		);
	}

	async createView(viewId: string, url: string, bounds: BrowserViewBounds): Promise<void> {
		return this.channel.call('createView', { viewId, url, bounds });
	}

	async destroyView(viewId: string): Promise<void> {
		return this.channel.call('destroyView', { viewId });
	}

	async navigateTo(viewId: string, url: string): Promise<void> {
		return this.channel.call('navigateTo', { viewId, url });
	}

	async goBack(viewId: string): Promise<void> {
		return this.channel.call('goBack', { viewId });
	}

	async goForward(viewId: string): Promise<void> {
		return this.channel.call('goForward', { viewId });
	}

	async reload(viewId: string): Promise<void> {
		return this.channel.call('reload', { viewId });
	}

	async setBounds(viewId: string, bounds: BrowserViewBounds): Promise<void> {
		return this.channel.call('setBounds', { viewId, bounds });
	}

	async setVisible(viewId: string, visible: boolean): Promise<void> {
		return this.channel.call('setVisible', { viewId, visible });
	}

	async openDevTools(viewId: string): Promise<void> {
		return this.channel.call('openDevTools', { viewId });
	}

	async findInPage(viewId: string, text: string, options?: { forward?: boolean; matchCase?: boolean }): Promise<void> {
		return this.channel.call('findInPage', { viewId, text, options });
	}

	async stopFindInPage(viewId: string): Promise<void> {
		return this.channel.call('stopFindInPage', { viewId });
	}

	async focusView(viewId: string): Promise<void> {
		return this.channel.call('focusView', { viewId });
	}

	async showContextMenu(items: { id: string; label: string; separator?: boolean }[]): Promise<string | null> {
		return this.channel.call('showContextMenu', { items });
	}

	// --- History ---

	private _loadHistory(): void {
		try {
			const raw = this.storageService.get(HISTORY_STORAGE_KEY, StorageScope.PROFILE);
			if (raw) {
				this._history = JSON.parse(raw);
			}
		} catch {
			this._history = [];
		}
	}

	private _saveHistory(): void {
		this.storageService.store(HISTORY_STORAGE_KEY, JSON.stringify(this._history), StorageScope.PROFILE, StorageTarget.USER);
	}

	private _addHistoryEntry(url: string, title: string): void {
		if (!url || url === 'about:blank') { return; }
		const last = this._history[0];
		if (last && last.url === url) { return; }
		this._history.unshift({ url, title, timestamp: Date.now() });
		if (this._history.length > MAX_HISTORY_ENTRIES) {
			this._history = this._history.slice(0, MAX_HISTORY_ENTRIES);
		}
		this._saveHistory();
	}

	getHistory(): BrowserHistoryEntry[] {
		return [...this._history];
	}

	clearHistory(): void {
		this._history = [];
		this._saveHistory();
	}

	// --- Bookmarks ---

	private _loadBookmarks(): void {
		try {
			const raw = this.storageService.get(BOOKMARKS_STORAGE_KEY, StorageScope.PROFILE);
			if (raw) {
				this._bookmarks = JSON.parse(raw);
			}
		} catch {
			this._bookmarks = [];
		}
	}

	private _saveBookmarks(): void {
		this.storageService.store(BOOKMARKS_STORAGE_KEY, JSON.stringify(this._bookmarks), StorageScope.PROFILE, StorageTarget.USER);
	}

	getBookmarks(): BrowserBookmark[] {
		return [...this._bookmarks];
	}

	addBookmark(url: string, title: string): void {
		if (this.isBookmarked(url)) { return; }
		this._bookmarks.unshift({ url, title, addedAt: Date.now() });
		this._saveBookmarks();
	}

	removeBookmark(url: string): void {
		this._bookmarks = this._bookmarks.filter(b => b.url !== url);
		this._saveBookmarks();
	}

	isBookmarked(url: string): boolean {
		return this._bookmarks.some(b => b.url === url);
	}
}

registerSingleton(IBrowserPanelService, BrowserPanelService, InstantiationType.Delayed);
