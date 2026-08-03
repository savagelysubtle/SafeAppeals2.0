/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { TimelineService } from './timelineService';
import {
	getTimelineWebviewHtml,
	TimelineWebviewHost,
	type WebviewToHostMessage,
} from './timelineWebviewHost';

/**
 * Timeline editor webview panel (React dashboard bundle in media/dashboard/).
 */
export class TimelinePanel {
	public static current: TimelinePanel | undefined;
	public static readonly viewType = 'safeappeals-timeline.panel';

	private readonly panel: vscode.WebviewPanel;
	private readonly host: TimelineWebviewHost;
	private readonly disposables: vscode.Disposable[] = [];
	private pendingSelectEventId: string | undefined;

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		getService: () => TimelineService | undefined,
	) {
		this.panel = panel;
		this.host = new TimelineWebviewHost(getService, message => this.panel.webview.postMessage(message));
		this.panel.webview.html = getTimelineWebviewHtml(this.panel.webview, extensionUri, 'dashboard');
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.webview.onDidReceiveMessage(
			(msg: WebviewToHostMessage) => {
				if (msg.type === 'ready' && this.pendingSelectEventId) {
					const eventId = this.pendingSelectEventId;
					this.pendingSelectEventId = undefined;
					void this.host.handleMessage(msg).then(() => {
						this.host.postSelectEvent(eventId);
					});
					return;
				}
				void this.host.handleMessage(msg);
			},
			null,
			this.disposables,
		);
		this.host.subscribeTimelineChanges(this.disposables);
	}

	static show(
		extensionUri: vscode.Uri,
		getService: () => TimelineService | undefined,
	): TimelinePanel {
		const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
		if (TimelinePanel.current) {
			TimelinePanel.current.panel.reveal(column);
			void TimelinePanel.current.host.postBootstrap();
			return TimelinePanel.current;
		}
		const panel = vscode.window.createWebviewPanel(
			TimelinePanel.viewType,
			'Case Timeline',
			column,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(extensionUri, 'media', 'dashboard'),
					extensionUri,
				],
			},
		);
		TimelinePanel.current = new TimelinePanel(panel, extensionUri, getService);
		return TimelinePanel.current;
	}

	/** Reveal the timeline panel and focus a chronology event. */
	static showAndSelectEvent(
		extensionUri: vscode.Uri,
		getService: () => TimelineService | undefined,
		eventId: string,
	): TimelinePanel {
		const panel = TimelinePanel.show(extensionUri, getService);
		panel.selectEvent(eventId);
		return panel;
	}

	static async refreshIfOpen(): Promise<void> {
		if (TimelinePanel.current) {
			await TimelinePanel.current.host.postBootstrap();
		}
	}

	selectEvent(eventId: string): void {
		this.pendingSelectEventId = eventId;
		this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.One);
		this.host.postSelectEvent(eventId);
	}

	dispose(): void {
		TimelinePanel.current = undefined;
		while (this.disposables.length) {
			this.disposables.pop()?.dispose();
		}
		this.panel.dispose();
	}
}

/**
 * Activity-bar sidebar webview — setup, filters, compact lists; opens the editor panel for chronology.
 */
export class TimelineSidebarProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'safeappeals-timeline.sidebar';
	private static current: TimelineSidebarProvider | undefined;

	private view: vscode.WebviewView | undefined;
	private host: TimelineWebviewHost | undefined;
	private readonly viewDisposables: vscode.Disposable[] = [];

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly getService: () => TimelineService | undefined,
		private readonly openTimeline: () => void,
		private readonly openEvent: (eventId: string) => void,
	) {
		TimelineSidebarProvider.current = this;
	}

	static refreshIfResolved(): void {
		void TimelineSidebarProvider.current?.refresh();
	}

	async refresh(): Promise<void> {
		await this.host?.postBootstrap();
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.disposeViewState();
		this.view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.extensionUri, 'media', 'sidebar'),
				this.extensionUri,
			],
		};

		this.host = new TimelineWebviewHost(
			this.getService,
			message => webviewView.webview.postMessage(message),
			{
				onOpenTimeline: () => this.openTimeline(),
				onSelectEvent: eventId => this.openEvent(eventId),
			},
		);
		webviewView.webview.html = getTimelineWebviewHtml(webviewView.webview, this.extensionUri, 'sidebar');
		this.host.subscribeTimelineChanges(this.viewDisposables);
		this.viewDisposables.push(
			webviewView.webview.onDidReceiveMessage(
				(msg: WebviewToHostMessage) => void this.host?.handleMessage(msg),
			),
		);

		webviewView.onDidDispose(() => {
			if (this.view === webviewView) {
				this.disposeViewState();
			}
		});
	}

	private disposeViewState(): void {
		while (this.viewDisposables.length) {
			this.viewDisposables.pop()?.dispose();
		}
		this.view = undefined;
		this.host = undefined;
	}
}
