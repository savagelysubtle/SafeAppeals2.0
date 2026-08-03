/*--------------------------------------------------------------------------------------
 *  Safe Appeals Calendar — Google / Outlook sync in the extension host
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	clearLegacyCalendarTokens,
	ensureCloudSession,
	hasLegacyCalendarTokens,
} from './calendarAuth';
import { getSyncIntervalMinutes, isWebClient } from './config';
import {
	connectionAccountLabel,
	createCalendarConnectionsBridge,
} from './connectionsBridge';
import { EventCache } from './eventCache';
import { SyncEngine } from './syncEngine';
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

	engine = new SyncEngine(createCalendarConnectionsBridge(), cache, log, () => {
		void refreshStatusBar();
	});

	registerCommands(context, log, () => {
		void refreshStatusBar();
	});
	await refreshStatusBar();
	engine.startBackgroundSync();
	void handleLegacyTokens(context.secrets, log);

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
					vscode.l10n.t(
						'Connecting a calendar is not available in the browser because events cannot be cached securely. Use the desktop app.',
					),
				);
				return { success: false, error: 'web_unsupported' };
			}
			const provider = providerArg
				|| await pickProvider(vscode.l10n.t('Connect which calendar?'));
			if (!provider) {
				return;
			}
			if (!(await ensureCloudSession(log))) {
				log(`Connect aborted — no SafeAppeals Cloud session for ${provider}`);
				return { success: false, error: 'cloud_sign_in_required', provider };
			}

			try {
				const connection = await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: vscode.l10n.t('Connecting {0}…', providerLabel(provider)),
						cancellable: false,
					},
					async () => engine.connect(provider)
				);
				await clearLegacyCalendarTokens(context.secrets, log);
				refreshUi();
				vscode.window.showInformationMessage(
					vscode.l10n.t('Calendar connected: {0}', connectionAccountLabel(connection)),
				);
				return { success: true, provider, connectionId: connection.id };
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				log(`Connect failed: ${message}`);
				vscode.window.showErrorMessage(
					vscode.l10n.t('Safe Appeals Calendar: connect failed — {0}', message),
				);
				return { success: false, error: message, provider };
			}
		}),

		vscode.commands.registerCommand('safeappeals-calendar.disconnect', async (providerArg?: CalendarProvider) => {
			const provider = providerArg
				|| await pickProvider(vscode.l10n.t('Disconnect which calendar?'));
			if (!provider) {
				return;
			}
			const result = await engine.disconnect(provider);
			refreshUi();
			if (result.error) {
				vscode.window.showWarningMessage(
					vscode.l10n.t(
						'Safe Appeals Calendar: {0} was removed from this machine, but Safe Appeals could not revoke the account — {1}',
						providerLabel(provider),
						result.error,
					),
				);
			} else {
				vscode.window.showInformationMessage(
					vscode.l10n.t('Safe Appeals Calendar: disconnected {0}', providerLabel(provider)),
				);
			}
			return { success: true, provider, revoked: result.revoked };
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
				`Google: ${status.google.enabled ? 'enabled' : 'DISABLED'}, ` +
				`${status.google.connected ? 'connected' : 'disconnected'}, ` +
				`${status.google.cachedEventCount} cached, lastSync=${status.google.lastSync ?? 'never'}`,
				`Outlook: ${status.outlook.enabled ? 'enabled' : 'DISABLED'}, ` +
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

/** Title-cased provider name for user-facing messages. */
function providerLabel(provider: CalendarProvider): string {
	return provider === 'google' ? 'Google Calendar' : 'Outlook Calendar';
}

async function pickProvider(placeHolder: string): Promise<CalendarProvider | undefined> {
	type ProviderItem = vscode.QuickPickItem & { provider: CalendarProvider };
	const describe = (provider: CalendarProvider) =>
		engine.isConnected(provider) ? vscode.l10n.t('connected') : vscode.l10n.t('not connected');
	const items: ProviderItem[] = (['google', 'outlook'] as const).map((provider) => ({
		label: providerLabel(provider),
		description: describe(provider),
		provider,
	}));

	const picked = await vscode.window.showQuickPick<ProviderItem>(items, { placeHolder });
	return picked?.provider;
}

/**
 * Tokens from the retired loopback flow cannot be migrated — the grants behind
 * them are unknown to Safe Appeals — so an affected machine has to reconnect.
 * Once a calendar is connected they are only stale secrets, and get deleted.
 */
async function handleLegacyTokens(
	secrets: vscode.SecretStorage,
	log: (msg: string) => void,
): Promise<void> {
	if (!(await hasLegacyCalendarTokens(secrets))) {
		return;
	}
	if (engine.isConnected('google') || engine.isConnected('outlook')) {
		await clearLegacyCalendarTokens(secrets, log);
		log('Removed calendar tokens left over from the retired loopback sign-in');
		return;
	}

	log('Calendar tokens from the retired loopback sign-in found — reconnect required');
	const connect = vscode.l10n.t('Connect Calendar');
	const choice = await vscode.window.showWarningMessage(
		vscode.l10n.t(
			'Safe Appeals Calendar now signs in through Safe Appeals. Reconnect your calendar to resume sync.',
		),
		connect,
	);
	if (choice === connect) {
		await vscode.commands.executeCommand('safeappeals-calendar.connect');
	}
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
