/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BrowserWindow, Menu, WebContentsView, dialog, session } from 'electron';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { BrowserViewBounds, BrowserViewNavigationEvent, BrowserViewLoadingEvent } from '../common/browserPanelTypes.js';

interface ManagedView {
	view: WebContentsView;
	windowId: number;
}

export interface BrowserDownloadEvent {
	viewId: string;
	filename: string;
	url: string;
	state: 'started' | 'completed' | 'cancelled' | 'interrupted';
	receivedBytes: number;
	totalBytes: number;
	savePath: string;
}

export class BrowserPanelChannel implements IServerChannel {

	private readonly viewOfId = new Map<string, ManagedView>();
	private _browserSession: Electron.Session | undefined;
	private _cleanUA = '';

	private readonly _onNavigation = new Emitter<BrowserViewNavigationEvent>();
	private readonly _onLoading = new Emitter<BrowserViewLoadingEvent>();
	private readonly _onDownload = new Emitter<BrowserDownloadEvent>();

	listen(_: unknown, event: string): Event<any> {
		switch (event) {
			case 'onNavigation': return this._onNavigation.event;
			case 'onLoading': return this._onLoading.event;
			case 'onDownload': return this._onDownload.event;
			default: throw new Error(`Event not found: ${event}`);
		}
	}

	async call(_ctx: unknown, command: string, args?: any): Promise<any> {
		switch (command) {
			case 'createView': return this._createView(args.viewId, args.url, args.bounds);
			case 'destroyView': return this._destroyView(args.viewId);
			case 'navigateTo': return this._navigateTo(args.viewId, args.url);
			case 'goBack': return this._goBack(args.viewId);
			case 'goForward': return this._goForward(args.viewId);
			case 'reload': return this._reload(args.viewId);
			case 'setBounds': return this._setBounds(args.viewId, args.bounds);
			case 'setVisible': return this._setVisible(args.viewId, args.visible);
			case 'openDevTools': return this._openDevTools(args.viewId);
			case 'findInPage': return this._findInPage(args.viewId, args.text, args.options);
			case 'stopFindInPage': return this._stopFindInPage(args.viewId);
			case 'focusView': return this._focusView(args.viewId);
			case 'showContextMenu': return this._showContextMenu(args.items);
			default: throw new Error(`Call not found: ${command}`);
		}
	}

	private _getWindow(): BrowserWindow | undefined {
		return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
	}

	// Minimal session setup matching electron-browser-shell:
	// only strip Electron/app identifiers from the UA string.
	// No header interception, no CSP stripping, no consent cookies,
	// no navigator overrides. Let Google's own flows run unmodified.
	private _ensureBrowserSession(): Electron.Session {
		if (this._browserSession) { return this._browserSession; }

		const ses = session.fromPartition('persist:void-browser-v2');

		const rawUA = ses.getUserAgent();
		this._cleanUA = rawUA
			.replace(/\s*Electron\/\S+/g, '')
			.replace(/\s*safe-appeals-navigator\/\S+/g, '');

		ses.setUserAgent(this._cleanUA);

		this._browserSession = ses;
		return ses;
	}

	private _createView(viewId: string, url: string, bounds: BrowserViewBounds): void {
		if (this.viewOfId.has(viewId)) {
			this._destroyView(viewId);
		}

		const win = this._getWindow();
		if (!win) { return; }

		const browserSession = this._ensureBrowserSession();

		const view = new WebContentsView({
			webPreferences: {
				sandbox: true,
				contextIsolation: true,
				nodeIntegration: false,
				session: browserSession,
			}
		});

		view.setBounds({
			x: Math.round(bounds.x),
			y: Math.round(bounds.y),
			width: Math.round(bounds.width),
			height: Math.round(bounds.height),
		});

		win.contentView.addChildView(view);

		this.viewOfId.set(viewId, { view, windowId: win.id });

		const wc = view.webContents;
		wc.setUserAgent(this._cleanUA);

		wc.on('did-navigate', (_e, url) => {
			console.log(`[BrowserPanel] did-navigate: ${url}`);
			this._fireNavigation(viewId, wc);
		});
		wc.on('did-navigate-in-page', (_e, url) => {
			console.log(`[BrowserPanel] did-navigate-in-page: ${url}`);
			this._fireNavigation(viewId, wc);
		});
		wc.on('will-navigate', (_e, url) => {
			console.log(`[BrowserPanel] will-navigate (from view): ${url}`);
		});
		wc.on('did-start-loading', () => this._onLoading.fire({ viewId, isLoading: true }));
		wc.on('did-stop-loading', () => {
			this._onLoading.fire({ viewId, isLoading: false });
			this._fireNavigation(viewId, wc);
		});
		wc.on('page-title-updated', () => this._fireNavigation(viewId, wc));
		wc.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
			console.error(`[BrowserPanel] Load failed: ${validatedURL} – ${errorDescription} (${errorCode})`);
		});

		wc.setWindowOpenHandler((details) => {
			const targetUrl = details.url;
			console.log(`[BrowserPanel] setWindowOpenHandler: url=${targetUrl} disposition=${details.disposition}`);
			if (targetUrl && targetUrl !== 'about:blank' && !targetUrl.startsWith('about:')) {
				process.nextTick(() => {
					console.log(`[BrowserPanel] Navigating to: ${targetUrl}`);
					wc.loadURL(targetUrl);
				});
			}
			return { action: 'deny' };
		});

		wc.session.on('will-download', (_event, item) => {
			const filename = item.getFilename();
			const parentWin = BrowserWindow.fromId(win.id);

			if (parentWin) {
				const result = dialog.showSaveDialogSync(parentWin, {
					defaultPath: filename,
				});
				if (result) {
					item.setSavePath(result);
				} else {
					item.cancel();
					return;
				}
			}

			this._onDownload.fire({
				viewId,
				filename,
				url: item.getURL(),
				state: 'started',
				receivedBytes: 0,
				totalBytes: item.getTotalBytes(),
				savePath: item.getSavePath(),
			});

			item.on('updated', (_event, state) => {
				this._onDownload.fire({
					viewId,
					filename,
					url: item.getURL(),
					state: state === 'progressing' ? 'started' : 'interrupted',
					receivedBytes: item.getReceivedBytes(),
					totalBytes: item.getTotalBytes(),
					savePath: item.getSavePath(),
				});
			});

			item.once('done', (_event, state) => {
				this._onDownload.fire({
					viewId,
					filename,
					url: item.getURL(),
					state: state === 'completed' ? 'completed' : 'cancelled',
					receivedBytes: item.getReceivedBytes(),
					totalBytes: item.getTotalBytes(),
					savePath: item.getSavePath(),
				});
			});
		});

		wc.loadURL(url);
	}

	private _focusView(viewId: string): void {
		const managed = this.viewOfId.get(viewId);
		if (managed) {
			managed.view.webContents.focus();
		}
	}

	private _fireNavigation(viewId: string, wc: Electron.WebContents): void {
		this._onNavigation.fire({
			viewId,
			url: wc.getURL(),
			title: wc.getTitle(),
			canGoBack: wc.canGoBack(),
			canGoForward: wc.canGoForward(),
		});
	}

	private _destroyView(viewId: string): void {
		const managed = this.viewOfId.get(viewId);
		if (!managed) { return; }

		const win = BrowserWindow.fromId(managed.windowId);
		if (win) {
			win.contentView.removeChildView(managed.view);
		}

		managed.view.webContents.close();
		this.viewOfId.delete(viewId);
	}

	private _navigateTo(viewId: string, url: string): void {
		const managed = this.viewOfId.get(viewId);
		if (managed) {
			managed.view.webContents.loadURL(url);
		}
	}

	private _goBack(viewId: string): void {
		const managed = this.viewOfId.get(viewId);
		if (managed?.view.webContents.canGoBack()) {
			managed.view.webContents.goBack();
		}
	}

	private _goForward(viewId: string): void {
		const managed = this.viewOfId.get(viewId);
		if (managed?.view.webContents.canGoForward()) {
			managed.view.webContents.goForward();
		}
	}

	private _reload(viewId: string): void {
		const managed = this.viewOfId.get(viewId);
		if (managed) {
			managed.view.webContents.reload();
		}
	}

	private _setBounds(viewId: string, bounds: BrowserViewBounds): void {
		const managed = this.viewOfId.get(viewId);
		if (managed) {
			managed.view.setBounds({
				x: Math.round(bounds.x),
				y: Math.round(bounds.y),
				width: Math.round(bounds.width),
				height: Math.round(bounds.height),
			});
		}
	}

	private _setVisible(viewId: string, visible: boolean): void {
		const managed = this.viewOfId.get(viewId);
		if (!managed) { return; }

		const win = BrowserWindow.fromId(managed.windowId);
		if (!win) { return; }

		if (visible) {
			win.contentView.addChildView(managed.view);
		} else {
			win.contentView.removeChildView(managed.view);
		}
	}

	private _openDevTools(viewId: string): void {
		const managed = this.viewOfId.get(viewId);
		if (managed) {
			managed.view.webContents.openDevTools({ mode: 'detach' });
		}
	}

	private _findInPage(viewId: string, text: string, options?: Electron.FindInPageOptions): void {
		const managed = this.viewOfId.get(viewId);
		if (managed && text) {
			managed.view.webContents.findInPage(text, options);
		}
	}

	private _stopFindInPage(viewId: string): void {
		const managed = this.viewOfId.get(viewId);
		if (managed) {
			managed.view.webContents.stopFindInPage('clearSelection');
		}
	}

	private _showContextMenu(items: { id: string; label: string; separator?: boolean }[]): Promise<string | null> {
		return new Promise((resolve) => {
			const template: Electron.MenuItemConstructorOptions[] = [];
			for (const item of items) {
				if (item.separator) {
					template.push({ type: 'separator' });
				} else {
					template.push({
						label: item.label,
						click: () => resolve(item.id),
					});
				}
			}
			const menu = Menu.buildFromTemplate(template);
			menu.popup({
				callback: () => resolve(null),
			});
		});
	}
}
