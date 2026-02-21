/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as DOM from '../../../../../base/browser/dom.js';
import { Dimension } from '../../../../../base/browser/dom.js';
import { getZoomFactor } from '../../../../../base/browser/browser.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { IEditorOptions } from '../../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { EditorPane } from '../../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../../common/editor.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { IEditorGroup } from '../../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IBrowserPanelService } from './browserService.js';
import { BrowserInput } from './browserInput.js';

function appendIcon(parent: HTMLElement, ...classNames: string[]): HTMLSpanElement {
	const span = document.createElement('span');
	span.classList.add('codicon', ...classNames);
	parent.appendChild(span);
	return span;
}

function setIcon(parent: HTMLElement, ...classNames: string[]): void {
	while (parent.firstChild) { parent.removeChild(parent.firstChild); }
	appendIcon(parent, ...classNames);
}

export class BrowserEditor extends EditorPane {
	static readonly ID = 'void.browserEditor';

	private _parentElement?: HTMLElement;
	private _container?: HTMLElement;
	private _toolbar?: HTMLElement;
	private _bookmarksBar?: HTMLElement;
	private _contentArea?: HTMLElement;
	private _urlInput?: HTMLInputElement;
	private _backBtn?: HTMLButtonElement;
	private _forwardBtn?: HTMLButtonElement;
	private _reloadBtn?: HTMLButtonElement;
	private _homeBtn?: HTMLButtonElement;
	private _bookmarkBtn?: HTMLButtonElement;
	private _devToolsBtn?: HTMLButtonElement;
	private _newTabBtn?: HTMLButtonElement;
	private _findBar?: HTMLElement;
	private _findInput?: HTMLInputElement;
	private _loadingBar?: HTMLElement;
	private _historyDropdown?: HTMLElement;

	private readonly viewId = generateUuid();
	private _viewCreated = false;
	private _pendingUrl = '';
	private _currentUrl = '';
	private _findBarVisible = false;
	private _resizeObserver?: ResizeObserver;
	private _layoutDimension?: Dimension;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IBrowserPanelService private readonly browserPanelService: IBrowserPanelService,
		@IEditorService private readonly editorService: IEditorService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super(BrowserEditor.ID, group, telemetryService, themeService, storageService);

		this._register(this.browserPanelService.onNavigation(e => {
			if (e.viewId !== this.viewId) { return; }
			this._currentUrl = e.url;
			if (this._urlInput) { this._urlInput.value = e.url; }
			if (this._backBtn) { this._backBtn.disabled = !e.canGoBack; }
			if (this._forwardBtn) { this._forwardBtn.disabled = !e.canGoForward; }
			this._updateBookmarkIcon();

			const currentInput = this.input;
			if (currentInput instanceof BrowserInput) {
				currentInput.setUrl(e.url);
				currentInput.setTitle(e.title || 'Browser');
			}
		}));

		this._register(this.browserPanelService.onLoading(e => {
			if (e.viewId !== this.viewId) { return; }
			this._loadingBar?.classList.toggle('visible', e.isLoading);
		}));

		this._register(this.browserPanelService.onDownload(e => {
			if (e.viewId !== this.viewId) { return; }
			if (e.state === 'completed') {
				this.notificationService.info(`Download complete: ${e.filename}`);
			}
		}));
	}

	protected override createEditor(parent: HTMLElement): void {
		this._parentElement = parent;
		parent.style.overflow = 'hidden';
		parent.style.position = 'relative';

		this._container = DOM.append(parent, DOM.$('div.browser-editor-container'));
		this._container.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;overflow:hidden;';

		this._toolbar = DOM.append(this._container, DOM.$('div.browser-toolbar'));
		this._bookmarksBar = DOM.append(this._container, DOM.$('div.browser-bookmarks-bar'));
		this._findBar = DOM.append(this._container, DOM.$('div.browser-find-bar'));
		this._contentArea = DOM.append(this._container, DOM.$('div.browser-content-area'));

		this._buildToolbar();
		this._buildFindBar();
		this._applyStyles();
		this._renderBookmarksBar();
	}

	private _buildToolbar(): void {
		if (!this._toolbar) { return; }

		const navGroup = DOM.append(this._toolbar, DOM.$('div.browser-nav-group'));

		this._backBtn = DOM.append(navGroup, DOM.$('button.browser-btn')) as HTMLButtonElement;
		appendIcon(this._backBtn, 'codicon-arrow-left');
		this._backBtn.title = 'Back';
		this._backBtn.disabled = true;
		this._backBtn.addEventListener('click', () => this.browserPanelService.goBack(this.viewId));

		this._forwardBtn = DOM.append(navGroup, DOM.$('button.browser-btn')) as HTMLButtonElement;
		appendIcon(this._forwardBtn, 'codicon-arrow-right');
		this._forwardBtn.title = 'Forward';
		this._forwardBtn.disabled = true;
		this._forwardBtn.addEventListener('click', () => this.browserPanelService.goForward(this.viewId));

		this._reloadBtn = DOM.append(navGroup, DOM.$('button.browser-btn')) as HTMLButtonElement;
		appendIcon(this._reloadBtn, 'codicon-refresh');
		this._reloadBtn.title = 'Reload';
		this._reloadBtn.addEventListener('click', () => this.browserPanelService.reload(this.viewId));

		this._homeBtn = DOM.append(navGroup, DOM.$('button.browser-btn')) as HTMLButtonElement;
		appendIcon(this._homeBtn, 'codicon-home');
		this._homeBtn.title = 'Home';
		this._homeBtn.addEventListener('click', () => this._navigate('https://www.google.com'));

		this._urlInput = DOM.append(this._toolbar, DOM.$('input.browser-url-input')) as HTMLInputElement;
		this._urlInput.type = 'text';
		this._urlInput.placeholder = 'Search or enter URL...';
		this._urlInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				this._navigate(this._urlInput!.value);
				this._urlInput!.blur();
				this._hideHistoryDropdown();
			} else if (e.key === 'Escape') {
				this._urlInput!.value = this._currentUrl;
				this._urlInput!.blur();
				this._hideHistoryDropdown();
			}
		});
		this._urlInput.addEventListener('focus', () => this._showHistoryDropdown());
		this._urlInput.addEventListener('blur', () => {
			setTimeout(() => this._hideHistoryDropdown(), 200);
		});

		this._historyDropdown = DOM.append(this._toolbar, DOM.$('div.browser-history-dropdown'));

		const rightGroup = DOM.append(this._toolbar, DOM.$('div.browser-nav-group'));

		this._bookmarkBtn = DOM.append(rightGroup, DOM.$('button.browser-btn.bookmark-btn')) as HTMLButtonElement;
		appendIcon(this._bookmarkBtn, 'codicon-star-empty');
		this._bookmarkBtn.title = 'Bookmark this page';
		this._bookmarkBtn.addEventListener('click', () => this._toggleBookmark());

		this._newTabBtn = DOM.append(rightGroup, DOM.$('button.browser-btn')) as HTMLButtonElement;
		appendIcon(this._newTabBtn, 'codicon-add');
		this._newTabBtn.title = 'New tab';
		this._newTabBtn.addEventListener('click', () => {
			this.editorService.openEditor(new BrowserInput(), { pinned: true });
		});

		this._devToolsBtn = DOM.append(rightGroup, DOM.$('button.browser-btn')) as HTMLButtonElement;
		appendIcon(this._devToolsBtn, 'codicon-tools');
		this._devToolsBtn.title = 'DevTools';
		this._devToolsBtn.addEventListener('click', () => this.browserPanelService.openDevTools(this.viewId));

		this._loadingBar = DOM.append(this._toolbar, DOM.$('div.browser-loading-bar'));
	}

	private _buildFindBar(): void {
		if (!this._findBar) { return; }

		this._findInput = DOM.append(this._findBar, DOM.$('input.browser-find-input')) as HTMLInputElement;
		this._findInput.type = 'text';
		this._findInput.placeholder = 'Find in page...';

		this._findInput.addEventListener('input', () => {
			const text = this._findInput!.value;
			if (text) {
				this.browserPanelService.findInPage(this.viewId, text);
			} else {
				this.browserPanelService.stopFindInPage(this.viewId);
			}
		});

		this._findInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				const text = this._findInput!.value;
				if (text) {
					this.browserPanelService.findInPage(this.viewId, text, { forward: !e.shiftKey });
				}
			} else if (e.key === 'Escape') {
				this._toggleFindBar();
			}
		});

		const closeBtn = DOM.append(this._findBar, DOM.$('button.browser-btn.find-close-btn')) as HTMLButtonElement;
		appendIcon(closeBtn, 'codicon-close');
		closeBtn.title = 'Close find';
		closeBtn.addEventListener('click', () => this._toggleFindBar());

		this._container?.addEventListener('keydown', (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
				e.preventDefault();
				e.stopPropagation();
				this._toggleFindBar();
			}
			if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
				e.preventDefault();
				this._urlInput?.focus();
				this._urlInput?.select();
			}
		});
	}

	private _toggleFindBar(): void {
		this._findBarVisible = !this._findBarVisible;
		if (this._findBar) {
			this._findBar.style.display = this._findBarVisible ? 'flex' : 'none';
		}
		if (this._findBarVisible) {
			this._findInput?.focus();
			this._findInput?.select();
		} else {
			this.browserPanelService.stopFindInPage(this.viewId);
			if (this._findInput) { this._findInput.value = ''; }
		}
		this._updateViewBounds();
	}

	private _toggleBookmark(): void {
		if (!this._currentUrl) {
			this.notificationService.warn('Cannot bookmark: no page loaded.');
			return;
		}
		const wasBookmarked = this.browserPanelService.isBookmarked(this._currentUrl);
		if (wasBookmarked) {
			this.browserPanelService.removeBookmark(this._currentUrl);
			this.notificationService.info('Bookmark removed.');
		} else {
			const currentInput = this.input;
			const title = currentInput instanceof BrowserInput ? currentInput.getName() : 'Untitled';
			this.browserPanelService.addBookmark(this._currentUrl, title);
			this.notificationService.info(`Bookmarked: ${title}`);
		}
		this._updateBookmarkIcon();
		this._renderBookmarksBar();
	}

	private _updateBookmarkIcon(): void {
		if (!this._bookmarkBtn) { return; }
		const isBookmarked = this._currentUrl && this.browserPanelService.isBookmarked(this._currentUrl);
		setIcon(this._bookmarkBtn, isBookmarked ? 'codicon-star-full' : 'codicon-star-empty');
		this._bookmarkBtn.title = isBookmarked ? 'Remove bookmark' : 'Bookmark this page';
		if (isBookmarked) {
			this._bookmarkBtn.style.color = '#f5c518';
		} else {
			this._bookmarkBtn.style.color = 'var(--vscode-icon-foreground)';
		}
	}

	private _renderBookmarksBar(): void {
		if (!this._bookmarksBar) { return; }

		const bookmarks = this.browserPanelService.getBookmarks();
		DOM.clearNode(this._bookmarksBar);

		if (bookmarks.length === 0) {
			this._bookmarksBar.style.display = 'none';
			requestAnimationFrame(() => this._updateViewBounds());
			return;
		}

		this._bookmarksBar.style.display = 'flex';

		for (const bm of bookmarks) {
			const chip = DOM.append(this._bookmarksBar, DOM.$('button.bookmark-chip'));
			const icon = appendIcon(chip, 'codicon-star-full');
			icon.style.marginRight = '4px';
			icon.style.color = '#f5c518';
			icon.style.fontSize = '12px';

			const label = document.createElement('span');
			label.textContent = bm.title || new URL(bm.url).hostname;
			label.style.overflow = 'hidden';
			label.style.textOverflow = 'ellipsis';
			label.style.whiteSpace = 'nowrap';
			chip.appendChild(label);

			chip.title = bm.url;
			chip.addEventListener('click', () => this._navigate(bm.url));
			chip.addEventListener('contextmenu', (e) => {
				e.preventDefault();
				this._showBookmarkContextMenu(e, bm.url, bm.title);
			});
		}

		requestAnimationFrame(() => this._updateViewBounds());
	}

	private async _showBookmarkContextMenu(_e: MouseEvent, url: string, title: string): Promise<void> {
		const selected = await this.browserPanelService.showContextMenu([
			{ id: 'open', label: 'Open' },
			{ id: 'openNewTab', label: 'Open in New Tab' },
			{ id: 'copyUrl', label: 'Copy URL' },
			{ id: 'sep', label: '', separator: true },
			{ id: 'remove', label: 'Remove Bookmark' },
		]);

		switch (selected) {
			case 'open':
				this._navigate(url);
				break;
			case 'openNewTab':
				this.editorService.openEditor(new BrowserInput(url), { pinned: true });
				break;
			case 'copyUrl':
				navigator.clipboard.writeText(url);
				this.notificationService.info('URL copied to clipboard.');
				break;
			case 'remove':
				this.browserPanelService.removeBookmark(url);
				this.notificationService.info(`Removed bookmark: ${title || url}`);
				this._updateBookmarkIcon();
				this._renderBookmarksBar();
				break;
		}
	}

	private _showHistoryDropdown(): void {
		if (!this._historyDropdown) { return; }

		const history = this.browserPanelService.getHistory();
		const bookmarks = this.browserPanelService.getBookmarks();

		DOM.clearNode(this._historyDropdown);

		if (bookmarks.length > 0) {
			const header = DOM.append(this._historyDropdown, DOM.$('div.dropdown-header'));
			header.textContent = 'Bookmarks';
			for (const bm of bookmarks.slice(0, 5)) {
				const item = DOM.append(this._historyDropdown, DOM.$('div.dropdown-item'));
				const icon = appendIcon(item, 'codicon-star-full');
				icon.style.marginRight = '6px';
				const label = document.createElement('span');
				label.textContent = bm.title || bm.url;
				item.appendChild(label);
				item.title = bm.url;
				item.addEventListener('mousedown', (e) => {
					e.preventDefault();
					this._navigate(bm.url);
					this._hideHistoryDropdown();
				});
			}
		}

		if (history.length > 0) {
			const header = DOM.append(this._historyDropdown, DOM.$('div.dropdown-header'));
			header.textContent = 'Recent';
			for (const entry of history.slice(0, 10)) {
				const item = DOM.append(this._historyDropdown, DOM.$('div.dropdown-item'));
				const icon = appendIcon(item, 'codicon-history');
				icon.style.marginRight = '6px';
				const label = document.createElement('span');
				label.textContent = entry.title || entry.url;
				item.appendChild(label);
				item.title = entry.url;
				item.addEventListener('mousedown', (e) => {
					e.preventDefault();
					this._navigate(entry.url);
					this._hideHistoryDropdown();
				});
			}
		}

		if (bookmarks.length === 0 && history.length === 0) {
			const item = DOM.append(this._historyDropdown, DOM.$('div.dropdown-item'));
			item.textContent = 'No history yet';
			item.style.opacity = '0.5';
		}

		this._historyDropdown.style.display = 'block';
	}

	private _hideHistoryDropdown(): void {
		if (this._historyDropdown) {
			this._historyDropdown.style.display = 'none';
		}
	}

	private _applyStyles(): void {
		if (!this._toolbar || !this._contentArea) { return; }

		this._toolbar.style.cssText = `
			display: flex; align-items: center; gap: 4px;
			padding: 4px 8px; position: relative;
			background: var(--vscode-editor-background);
			border-bottom: 1px solid var(--vscode-panel-border);
			flex-shrink: 0;
		`;

		if (this._bookmarksBar) {
			this._bookmarksBar.style.cssText = `
				display: none; align-items: center; gap: 2px;
				padding: 2px 8px; overflow-x: auto; overflow-y: hidden;
				background: var(--vscode-editor-background);
				border-bottom: 1px solid var(--vscode-panel-border);
				flex-shrink: 0; min-height: 0;
			`;
		}

		this._contentArea.style.cssText = `
			flex: 1; position: relative;
			overflow: hidden; min-height: 0;
		`;

		if (this._urlInput) {
			this._urlInput.style.cssText = `
				flex: 1; padding: 3px 8px;
				border: 1px solid var(--vscode-input-border);
				border-radius: 4px;
				color: var(--vscode-input-foreground);
				background: var(--vscode-input-background);
				font-family: var(--vscode-font-family);
				font-size: var(--vscode-font-size);
				outline: none;
			`;
		}

		if (this._findBar) {
			this._findBar.style.cssText = `
				display: none; align-items: center; gap: 4px;
				padding: 4px 8px;
				background: var(--vscode-editorWidget-background);
				border-bottom: 1px solid var(--vscode-panel-border);
				flex-shrink: 0;
			`;
		}

		if (this._findInput) {
			this._findInput.style.cssText = `
				flex: 1; padding: 3px 8px;
				border: 1px solid var(--vscode-input-border);
				border-radius: 4px;
				color: var(--vscode-input-foreground);
				background: var(--vscode-input-background);
				font-family: var(--vscode-font-family);
				font-size: var(--vscode-font-size);
				outline: none;
			`;
		}

		if (this._historyDropdown) {
			this._historyDropdown.style.cssText = `
				display: none; position: absolute;
				top: 100%; left: 60px; right: 60px;
				max-height: 300px; overflow-y: auto;
				background: var(--vscode-editorWidget-background);
				border: 1px solid var(--vscode-panel-border);
				border-radius: 4px; z-index: 100;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
			`;
		}

		const btns = this._container?.querySelectorAll('.browser-btn');
		btns?.forEach(btn => {
			const el = btn as HTMLElement;
			el.style.border = 'none';
			el.style.background = 'none';
			el.style.padding = '4px';
			el.style.cursor = 'pointer';
			el.style.borderRadius = '4px';
			el.style.display = 'flex';
			el.style.alignItems = 'center';
			if (!el.classList.contains('bookmark-btn')) {
				el.style.color = 'var(--vscode-icon-foreground)';
			}
		});

		if (this._loadingBar) {
			this._loadingBar.style.cssText = `
				position: absolute; bottom: 0; left: 0; right: 0;
				height: 2px; display: none;
				background: var(--vscode-progressBar-background);
				animation: browser-loading-pulse 1.5s ease-in-out infinite;
			`;
		}

		const style = document.createElement('style');
		style.textContent = `
			@keyframes browser-loading-pulse {
				0%, 100% { opacity: 0.4; }
				50% { opacity: 1; }
			}
			.browser-loading-bar.visible { display: block !important; }
			.browser-btn:hover:not(:disabled) {
				background: var(--vscode-toolbar-hoverBackground) !important;
			}
			.browser-btn:disabled { opacity: 0.3; cursor: default !important; }
			.dropdown-header {
				padding: 6px 12px; font-size: 11px; font-weight: 600;
				color: var(--vscode-descriptionForeground);
				text-transform: uppercase; letter-spacing: 0.5px;
			}
			.dropdown-item {
				padding: 6px 12px; cursor: pointer;
				display: flex; align-items: center;
				color: var(--vscode-foreground);
				font-size: var(--vscode-font-size);
				white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
			}
			.dropdown-item:hover {
				background: var(--vscode-list-hoverBackground);
			}
			.bookmark-chip {
				display: flex; align-items: center;
				padding: 2px 8px; border: none;
				border-radius: 3px; cursor: pointer;
				background: var(--vscode-button-secondaryBackground, rgba(255,255,255,0.06));
				color: var(--vscode-foreground);
				font-family: var(--vscode-font-family);
				font-size: 11px; max-width: 160px;
				white-space: nowrap; overflow: hidden;
				text-overflow: ellipsis; flex-shrink: 0;
			}
			.bookmark-chip:hover {
				background: var(--vscode-toolbar-hoverBackground);
			}
		`;
		this._container?.appendChild(style);
	}

	private _navigate(rawUrl: string): void {
		let url = rawUrl.trim();
		if (!url) { return; }
		if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) {
			if (url.includes('.') && !url.includes(' ')) {
				url = 'https://' + url;
			} else {
				url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
			}
		}
		this._currentUrl = url;
		if (this._urlInput) { this._urlInput.value = url; }
		this.browserPanelService.navigateTo(this.viewId, url);
	}

	override async setInput(
		input: EditorInput,
		options: IEditorOptions | undefined,
		context: IEditorOpenContext,
		token: CancellationToken,
	): Promise<void> {
		await super.setInput(input, options, context, token);
		if (token.isCancellationRequested || !(input instanceof BrowserInput)) { return; }

		const url = input.url;
		this._currentUrl = url;
		if (this._urlInput) { this._urlInput.value = url; }

		if (this._viewCreated) {
			this.browserPanelService.navigateTo(this.viewId, url);
		} else {
			this._pendingUrl = url;
			this._tryCreateView();
		}
	}

	private _computeContentBounds(): { x: number; y: number; width: number; height: number } | null {
		if (!this._contentArea) { return null; }

		const rect = this._contentArea.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) { return null; }

		// getBoundingClientRect() returns CSS pixels, but WebContentsView.setBounds()
		// expects native DIP coordinates. When VSCode applies a zoom level, these diverge.
		const zoom = getZoomFactor(DOM.getWindow(this._contentArea));

		return {
			x: Math.round(rect.left * zoom),
			y: Math.round(rect.top * zoom),
			width: Math.round(rect.width * zoom),
			height: Math.round(rect.height * zoom),
		};
	}

	private _tryCreateView(): void {
		if (this._viewCreated || !this._pendingUrl || !this._layoutDimension) { return; }

		const bounds = this._computeContentBounds();
		if (!bounds) { return; }

		this._viewCreated = true;
		const url = this._pendingUrl;
		this._pendingUrl = '';
		this.browserPanelService.createView(this.viewId, url, bounds);
		this.browserPanelService.focusView(this.viewId);

		this._startResizeObserver();
	}

	private _startResizeObserver(): void {
		if (this._resizeObserver || !this._parentElement) { return; }
		this._resizeObserver = new ResizeObserver(() => {
			requestAnimationFrame(() => this._updateViewBounds());
		});
		this._resizeObserver.observe(this._parentElement);
	}

	override layout(dimension: Dimension): void {
		this._layoutDimension = dimension;

		if (!this._viewCreated && this._pendingUrl) {
			requestAnimationFrame(() => this._tryCreateView());
		} else {
			requestAnimationFrame(() => this._updateViewBounds());
		}
	}

	private _updateViewBounds(): void {
		if (!this._viewCreated) { return; }
		const bounds = this._computeContentBounds();
		if (bounds) {
			this.browserPanelService.setBounds(this.viewId, bounds);
		}
	}

	protected override setEditorVisible(visible: boolean): void {
		if (this._viewCreated) {
			this.browserPanelService.setVisible(this.viewId, visible);
			if (visible) {
				requestAnimationFrame(() => {
					this._updateViewBounds();
					this.browserPanelService.focusView(this.viewId);
				});
			}
		}
		super.setEditorVisible(visible);
	}

	override clearInput(): void {
		if (this._viewCreated) {
			this.browserPanelService.destroyView(this.viewId);
			this._viewCreated = false;
		}
		super.clearInput();
	}

	override dispose(): void {
		this._resizeObserver?.disconnect();
		this._resizeObserver = undefined;
		if (this._viewCreated) {
			this.browserPanelService.destroyView(this.viewId);
			this._viewCreated = false;
		}
		super.dispose();
	}
}
