/*--------------------------------------------------------------------------------------
 *  Safe Appeals Calendar — Google / Outlook sync in the extension host
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	getSyncIntervalMinutes,
	isGoogleConfigured,
	isOutlookConfigured,
	isProviderConfigured,
	isWebClient,
} from './config';
import { EventCache } from './eventCache';
import { SyncEngine } from './syncEngine';
import { TokenStore } from './tokenStore';
import type { CalendarProvider, GetEventsQuery } from './types';

let output: vscode.OutputChannel;
let statusBar: vscode.StatusBarItem;
let engine: SyncEngine;
let cache: EventCache;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	output = vscode.window.createOutputChannel('Safe Appeals Calendar');
	const log = (msg: string) => {
		const line = `[${new Date().toISOString()}] ${msg}`;
		output.appendLine(line);
		console.log(`[safeappeals-calendar] ${msg}`);
	};

	log('Activating…');

	const tokens = new TokenStore(context.secrets);
	cache = new EventCache(context.globalStorageUri, context.secrets, context.globalState, log);
	await cache.initialize();

	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
	statusBar.command = 'safeappeals-calendar.status';
	statusBar.tooltip = 'Safe Appeals Calendar';
	statusBar.show();

	const refreshStatusBar = async () => {
		try {
			const status = await engine.getStatus();
			const parts: string[] = [];
			if (status.google.connected) {
				parts.push(`G:${status.google.cachedEventCount}`);
			}
			if (status.outlook.connected) {
				parts.push(`O:${status.outlook.cachedEventCount}`);
			}
			statusBar.text = parts.length
				? `$(calendar) ${parts.join(' ')}`
				: '$(calendar) Calendar';
		} catch {
			statusBar.text = '$(calendar) Calendar';
		}
	};

	engine = new SyncEngine(tokens, cache, log, () => {
		void refreshStatusBar();
	});

	registerCommands(context, log, () => {
		void refreshStatusBar();
	});
	await refreshStatusBar();
	engine.startBackgroundSync();

	context.subscriptions.push(
		output,
		statusBar,
		engine,
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('safeappealsCalendar.syncIntervalMinutes')) {
				log(`Sync interval changed → ${getSyncIntervalMinutes()} min; restarting timer`);
				engine.startBackgroundSync();
			}
		})
	);

	log('Activated');
}

export function deactivate(): void {
	engine?.dispose();
}

function registerCommands(
	context: vscode.ExtensionContext,
	log: (msg: string) => void,
	refreshUi: () => void,
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('safeappeals-calendar.connect', async (providerArg?: CalendarProvider) => {
			if (isWebClient()) {
				void vscode.window.showWarningMessage(
					'Connecting a calendar is not available in the browser because credentials cannot be stored securely. Use the desktop app.',
				);
				return { success: false, error: 'web_unsupported' };
			}
			const provider = providerArg || await pickProvider('Connect which calendar provider?', true);
			if (!provider) {
				return;
			}
			if (!isProviderConfigured(provider)) {
				const hint = provider === 'google'
					? 'Set safeappealsCalendar.google.clientId (or GOOGLE_CALENDAR_CLIENT_ID). Desktop clients use PKCE — no client secret required.'
					: 'Set safeappealsCalendar.outlook.clientId (or OUTLOOK_CLIENT_ID).';
				vscode.window.showWarningMessage(`Safe Appeals Calendar: ${provider} is not configured. ${hint}`);
				log(`Connect aborted — ${provider} not configured`);
				return { success: false, error: 'not_configured', provider };
			}

			try {
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: `Connecting ${provider}…`,
						cancellable: false,
					},
					async () => {
						await engine.connect(provider);
					}
				);
				vscode.window.showInformationMessage(`Safe Appeals Calendar: connected to ${provider}`);
				return { success: true, provider };
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				log(`Connect failed: ${message}`);
				vscode.window.showErrorMessage(`Safe Appeals Calendar: connect failed — ${message}`);
				return { success: false, error: message, provider };
			}
		}),

		vscode.commands.registerCommand('safeappeals-calendar.disconnect', async (providerArg?: CalendarProvider) => {
			const provider = providerArg || await pickProvider('Disconnect which calendar provider?', false);
			if (!provider) {
				return;
			}
			await engine.disconnect(provider);
			vscode.window.showInformationMessage(`Safe Appeals Calendar: disconnected ${provider}`);
			return { success: true, provider };
		}),

		vscode.commands.registerCommand('safeappeals-calendar.syncNow', async (providers?: CalendarProvider[]) => {
			try {
				const result = await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'Syncing calendars…',
						cancellable: false,
					},
					async () => engine.syncNow(providers)
				);
				if (result.providers.length === 0) {
					vscode.window.showInformationMessage(
						'Safe Appeals Calendar: nothing to sync (connect a provider first)'
					);
				} else if (result.errors.length) {
					vscode.window.showWarningMessage(
						`Safe Appeals Calendar: synced with errors (${result.fetched} events)`
					);
				} else {
					vscode.window.showInformationMessage(
						`Safe Appeals Calendar: synced ${result.fetched} event(s)`
					);
				}
				return result;
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Safe Appeals Calendar: sync failed — ${message}`);
				return { success: false, error: message };
			}
		}),

		vscode.commands.registerCommand(
			'safeappeals-calendar.getEvents',
			async (query?: GetEventsQuery) => {
				const q = query || await promptRangeQuery();
				if (!q) {
					return [];
				}
				const events = await engine.getEvents(q);
				log(`getEvents → ${events.length} event(s) [${q.start} .. ${q.end}]`);
				return events;
			}
		),

		vscode.commands.registerCommand('safeappeals-calendar.status', async () => {
			const status = await engine.getStatus();
			const lines = [
				`Google: ${status.google.configured ? 'configured' : 'NOT configured'}, ` +
				`${status.google.connected ? 'connected' : 'disconnected'}, ` +
				`${status.google.cachedEventCount} cached, lastSync=${status.google.lastSync ?? 'never'}`,
				`Outlook: ${status.outlook.configured ? 'configured' : 'NOT configured'}, ` +
				`${status.outlook.connected ? 'connected' : 'disconnected'}, ` +
				`${status.outlook.cachedEventCount} cached, lastSync=${status.outlook.lastSync ?? 'never'}`,
				`Interval: ${status.syncIntervalMinutes} min; last background: ${status.lastBackgroundSync ?? 'never'}`,
			];
			output.show(true);
			for (const line of lines) {
				log(line);
			}
			vscode.window.showInformationMessage(lines.join(' | '));
			return status;
		}),

		vscode.commands.registerCommand('safeappeals-calendar.clearLocalCache', async () => {
			const confirm = await vscode.window.showWarningMessage(
				'Delete the local calendar cache? Cached events on this machine will be removed and re-synced. Connected accounts are not affected.',
				{ modal: true },
				'Delete'
			);
			if (confirm !== 'Delete') {
				return;
			}
			await cache.clearLocalCache();
			log('Local calendar cache cleared');
			refreshUi();
			vscode.window.showInformationMessage('Safe Appeals Calendar: local cache cleared');
		})
	);
}

async function pickProvider(
	placeHolder: string,
	_requireConfigured: boolean
): Promise<CalendarProvider | undefined> {
	type ProviderItem = vscode.QuickPickItem & { provider: CalendarProvider };
	const items: ProviderItem[] = [
		{
			label: 'Google Calendar',
			description: isGoogleConfigured() ? 'configured' : 'not configured',
			provider: 'google',
		},
		{
			label: 'Outlook',
			description: isOutlookConfigured() ? 'configured' : 'not configured',
			provider: 'outlook',
		},
	];

	const picked = await vscode.window.showQuickPick<ProviderItem>(items, { placeHolder });
	return picked?.provider;
}

async function promptRangeQuery(): Promise<GetEventsQuery | undefined> {
	const start = await vscode.window.showInputBox({
		prompt: 'Range start (ISO 8601)',
		value: new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z',
	});
	if (!start) {
		return undefined;
	}
	const endDefault = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
	const end = await vscode.window.showInputBox({
		prompt: 'Range end (ISO 8601)',
		value: endDefault,
	});
	if (!end) {
		return undefined;
	}
	return { start, end, provider: 'all' };
}
