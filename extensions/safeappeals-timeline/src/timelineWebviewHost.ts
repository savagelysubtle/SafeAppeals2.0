/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { jurisdictionLabel } from './types';
import type { TimelineService } from './timelineService';
import type { CaseTimeline, TimelineEvent, TimelineEventUpdates } from './timelineTypes';

interface CalendarSoftEvent {
	id: string;
	title: string;
	date: string;
	provider?: string;
}

interface JurisdictionOption {
	id: string;
	name: string;
	label: string;
	statuteOfLimitationsDays: number;
}

export type TimelineWebviewSurface = 'sidebar' | 'dashboard';

export type WebviewToHostMessage =
	| { type: 'ready' }
	| { type: 'addEvent'; event: TimelineEventUpdates & Pick<TimelineEvent, 'date' | 'title' | 'category' | 'isDeadline' | 'linkedDocuments'> }
	| { type: 'updateEvent'; id: string; updates: TimelineEventUpdates }
	| { type: 'deleteEvent'; id: string }
	| { type: 'setJurisdiction'; jurisdictionId: string }
	| { type: 'setInjuryDate'; injuryDate: string }
	| { type: 'setNotificationsEnabled'; enabled: boolean }
	| { type: 'exportIcs' }
	| { type: 'pullCalendar' }
	| { type: 'toggleSyncToCalendar'; id: string }
	| { type: 'openDocument'; uri: string }
	| { type: 'pickDocuments' }
	| { type: 'attachActiveDocument' }
	| { type: 'openTimeline' }
	| { type: 'selectEvent'; eventId: string };

export interface TimelineWebviewHostOptions {
	onOpenTimeline?: () => void;
	onSelectEvent?: (eventId: string) => void;
}

/**
 * Shared message protocol for Case Timeline webviews (sidebar + editor dashboard).
 */
export class TimelineWebviewHost {
	private changeSubscription: vscode.Disposable | undefined;

	constructor(
		private readonly getService: () => TimelineService | undefined,
		private readonly postMessage: (message: unknown) => Thenable<boolean>,
		private readonly options: TimelineWebviewHostOptions = {},
	) { }

	/**
	 * Listen for timeline store changes and push `timelineUpdated` to the webview.
	 * Re-attaches on each {@link postBootstrap} so workspace-folder swaps pick up the new service.
	 */
	subscribeTimelineChanges(disposables: vscode.Disposable[]): void {
		this.attachTimelineListener();
		disposables.push({
			dispose: () => {
				this.changeSubscription?.dispose();
				this.changeSubscription = undefined;
			},
		});
	}

	private attachTimelineListener(): void {
		this.changeSubscription?.dispose();
		const service = this.getService();
		if (!service) {
			this.changeSubscription = undefined;
			return;
		}
		this.changeSubscription = service.onDidChangeTimeline(timeline => {
			void this.postMessage({ type: 'timelineUpdated', timeline });
		});
	}

	async handleMessage(msg: WebviewToHostMessage): Promise<void> {
		const service = this.getService();
		try {
			switch (msg.type) {
				case 'ready':
					await this.postBootstrap();
					return;
				case 'openTimeline':
					this.options.onOpenTimeline?.();
					return;
				case 'selectEvent':
					this.options.onSelectEvent?.(msg.eventId);
					return;
				case 'addEvent':
					if (!service) {
						throw new Error('No workspace folder open.');
					}
					await service.addEvent(msg.event);
					return;
				case 'updateEvent':
					if (!service) {
						throw new Error('No workspace folder open.');
					}
					await service.updateEvent(msg.id, msg.updates);
					return;
				case 'deleteEvent': {
					if (!service) {
						throw new Error('No workspace folder open.');
					}
					let timeline = service.getTimeline();
					if (!timeline) {
						timeline = await service.loadTimeline();
					}
					const event = timeline?.events.find(e => e.id === msg.id);
					if (!event) {
						throw new Error(`Event not found: ${msg.id}`);
					}
					const choice = await vscode.window.showWarningMessage(
						`Delete "${event.title}"?`,
						{ modal: true },
						'Delete',
					);
					if (choice !== 'Delete') {
						return;
					}
					await service.deleteEvent(msg.id);
					return;
				}
				case 'setJurisdiction':
					if (!service) {
						throw new Error('No workspace folder open.');
					}
					await service.setJurisdiction(msg.jurisdictionId);
					return;
				case 'setInjuryDate':
					if (!service) {
						throw new Error('No workspace folder open.');
					}
					await service.setInjuryDate(msg.injuryDate);
					return;
				case 'setNotificationsEnabled':
					if (!service) {
						throw new Error('No workspace folder open.');
					}
					await service.setNotificationsEnabled(msg.enabled);
					return;
				case 'toggleSyncToCalendar':
					if (!service) {
						throw new Error('No workspace folder open.');
					}
					await service.toggleSyncToCalendar(msg.id);
					return;
				case 'exportIcs':
					await this.exportIcs(service);
					return;
				case 'pullCalendar':
					await this.pullCalendar();
					return;
				case 'openDocument':
					await this.openDocument(msg.uri);
					return;
				case 'pickDocuments':
					await this.pickDocuments();
					return;
				case 'attachActiveDocument':
					await this.attachActiveDocument();
					return;
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await this.postMessage({ type: 'error', message });
		}
	}

	async postBootstrap(): Promise<void> {
		this.attachTimelineListener();
		const service = this.getService();
		let timeline: CaseTimeline | null = null;
		if (service) {
			timeline = await service.loadTimeline();
		}
		const jurisdictions: JurisdictionOption[] = (service?.getJurisdictions() ?? []).map(j => ({
			id: j.id,
			name: j.name,
			label: jurisdictionLabel(j.id) || j.name,
			statuteOfLimitationsDays: j.statuteOfLimitationsDays,
		}));
		const folder = vscode.workspace.workspaceFolders?.[0];
		const { events, available, error } = await softPullCalendarEvents();
		await this.postMessage({
			type: 'bootstrap',
			payload: {
				timeline,
				jurisdictions,
				workspaceName: folder?.name ?? 'Workspace',
				calendarEvents: events,
				calendarAvailable: available,
				calendarError: error,
			},
		});
	}

	postSelectEvent(eventId: string): void {
		void this.postMessage({ type: 'selectEvent', eventId });
	}

	private async exportIcs(service: TimelineService | undefined): Promise<void> {
		if (!service) {
			throw new Error('No workspace folder open.');
		}
		await service.loadTimeline();
		const content = service.exportToIcs();
		const folder = vscode.workspace.workspaceFolders?.[0];
		const defaultUri = folder
			? vscode.Uri.joinPath(folder.uri, 'timeline-export.ics')
			: undefined;
		const uri = await vscode.window.showSaveDialog({
			defaultUri,
			filters: { 'iCalendar': ['ics'] },
			saveLabel: 'Export ICS',
		});
		if (!uri) {
			return;
		}
		await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
		vscode.window.showInformationMessage(`Exported timeline ICS to ${vscode.workspace.asRelativePath(uri)}`);
	}

	private async pullCalendar(): Promise<void> {
		const { events, available, error } = await softPullCalendarEvents();
		await this.postMessage({
			type: 'calendarPulled',
			events,
			error: available ? undefined : error,
		});
	}

	private async pickDocuments(): Promise<void> {
		const folder = vscode.workspace.workspaceFolders?.[0];
		const uris = await vscode.window.showOpenDialog({
			canSelectMany: true,
			canSelectFiles: true,
			canSelectFolders: false,
			defaultUri: folder?.uri,
			openLabel: 'Attach',
		});
		if (!uris?.length) {
			return;
		}
		await this.postMessage({
			type: 'documentsPicked',
			uris: uris.map(uri => this.normalizeDocumentUri(uri)),
		});
	}

	private async attachActiveDocument(): Promise<void> {
		const uri = this.resolveAttachableDocumentUri();
		if (!uri) {
			vscode.window.showInformationMessage(
				'Focus a file editor first, then Attach current file.',
			);
			return;
		}
		await this.postMessage({
			type: 'documentsPicked',
			uris: [this.normalizeDocumentUri(uri)],
		});
	}

	/**
	 * Prefer the active text editor; fall back to visible editors / open tabs
	 * because webview focus often clears `activeTextEditor`.
	 */
	private resolveAttachableDocumentUri(): vscode.Uri | undefined {
		const active = vscode.window.activeTextEditor?.document;
		if (active && !active.isUntitled) {
			return active.uri;
		}
		for (const editor of vscode.window.visibleTextEditors ?? []) {
			if (!editor.document.isUntitled) {
				return editor.document.uri;
			}
		}
		const tabGroups = vscode.window.tabGroups;
		if (!tabGroups) {
			return undefined;
		}
		const tabs = [
			tabGroups.activeTabGroup?.activeTab,
			...tabGroups.all.flatMap(group => group.tabs),
		];
		for (const tab of tabs) {
			if (!tab) {
				continue;
			}
			const input = tab.input;
			if (input instanceof vscode.TabInputText) {
				return input.uri;
			}
			if (input && typeof input === 'object' && 'uri' in input) {
				const uri = (input as { uri?: vscode.Uri }).uri;
				if (uri) {
					return uri;
				}
			}
		}
		return undefined;
	}

	/**
	 * Prefer workspace-relative paths for in-folder files; otherwise keep a full URI string.
	 */
	private normalizeDocumentUri(uri: vscode.Uri): string {
		const folder = vscode.workspace.workspaceFolders?.[0];
		if (folder) {
			const relative = vscode.workspace.asRelativePath(uri, false);
			const looksAbsolute = relative.startsWith('/')
				|| /^[a-zA-Z]:[\\/]/.test(relative)
				|| relative === uri.fsPath
				|| relative === uri.path;
			if (!looksAbsolute) {
				return relative.replace(/\\/g, '/');
			}
		}
		return uri.toString();
	}

	private async openDocument(uriString: string): Promise<void> {
		try {
			let uri: vscode.Uri;
			if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uriString)) {
				uri = vscode.Uri.parse(uriString);
			} else if (!uriString.startsWith('/') && !/^[a-zA-Z]:[\\/]/.test(uriString)) {
				const folder = vscode.workspace.workspaceFolders?.[0];
				if (!folder) {
					throw new Error('No workspace folder open.');
				}
				uri = vscode.Uri.joinPath(folder.uri, ...uriString.split('/'));
			} else {
				uri = vscode.Uri.file(uriString);
			}
			await vscode.commands.executeCommand('vscode.open', uri);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Could not open document: ${message}`);
		}
	}
}

export function getTimelineWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	surface: TimelineWebviewSurface,
): string {
	const mediaFolder = surface === 'sidebar' ? 'sidebar' : 'dashboard';
	const scriptName = surface === 'sidebar' ? 'sidebar.js' : 'dashboard.js';
	const styleName = surface === 'sidebar' ? 'sidebar.css' : 'dashboard.css';
	const mediaRoot = vscode.Uri.joinPath(extensionUri, 'media', mediaFolder);
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, scriptName));
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, styleName));
	const title = surface === 'sidebar' ? 'Timeline' : 'Case Timeline';
	const csp = [
		`default-src 'none'`,
		`img-src ${webview.cspSource} https: data:`,
		`style-src ${webview.cspSource} 'unsafe-inline'`,
		`script-src ${webview.cspSource}`,
		`font-src ${webview.cspSource}`,
	].join('; ');
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy" content="${csp}" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<link rel="stylesheet" href="${styleUri}" />
	<title>${title}</title>
</head>
<body>
	<div id="root"></div>
	<script src="${scriptUri}"></script>
</body>
</html>`;
}

async function softPullCalendarEvents(): Promise<{
	events: CalendarSoftEvent[];
	available: boolean;
	error?: string;
}> {
	const start = new Date();
	start.setMonth(start.getMonth() - 3);
	const end = new Date();
	end.setMonth(end.getMonth() + 6);
	try {
		const raw = await vscode.commands.executeCommand<unknown>(
			'safeappeals-calendar.getEvents',
			{
				start: start.toISOString(),
				end: end.toISOString(),
				provider: 'all',
			},
		);
		if (!Array.isArray(raw)) {
			return {
				events: [],
				available: true,
				error: 'Calendar returned no events (connect a provider if needed).',
			};
		}
		const events: CalendarSoftEvent[] = [];
		for (const item of raw) {
			if (!item || typeof item !== 'object') {
				continue;
			}
			const ev = item as Record<string, unknown>;
			if (typeof ev.id !== 'string' || typeof ev.title !== 'string' || typeof ev.date !== 'string') {
				continue;
			}
			events.push({
				id: ev.id,
				title: ev.title,
				date: ev.date,
				provider: typeof ev.provider === 'string' ? ev.provider : undefined,
			});
		}
		return { events, available: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			events: [],
			available: false,
			error: `Calendar unavailable: ${message}`,
		};
	}
}
