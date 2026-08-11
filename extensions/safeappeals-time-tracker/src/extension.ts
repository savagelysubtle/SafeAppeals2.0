/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker Extension
 *  Professional time tracking with UTBMS codes, 6-minute billing, and LEDES export
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { registerAgentTools } from './agentTools';
import { CodesService } from './codesService';
import { ExportService } from './exportService';
import { MatterService } from './matterService';
import { RateService } from './rateService';
import { SensitiveStateStore } from './sensitiveStateStore';
import { SidebarProvider } from './sidebarProvider';
import { StatusBarController } from './statusBarController';
import { StorageService } from './storageService';
import { serializeTimeTrackerWorkspaceIdentity } from './workspaceIdentity';
import { TimeTrackerService } from './timeTrackerService';
import { initializeLogger, logError, logInfo, logWarning } from './logger';

let storageService: StorageService;
let codesService: CodesService;
let timeTrackerService: TimeTrackerService;
let matterService: MatterService;
let rateService: RateService;
let exportService: ExportService;
let statusBarController: StatusBarController;
let sidebarProvider: SidebarProvider;
let sensitiveStateStore: SensitiveStateStore;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	initializeLogger(context, vscode.window.createOutputChannel('Time Tracker', { log: true }));
	logInfo('Activating extension');
	const workspaceIdentity = serializeTimeTrackerWorkspaceIdentity(
		vscode.workspace.workspaceFile?.toString(true),
		vscode.workspace.workspaceFolders?.map(folder => folder.uri.toString(true)) ?? []
	);

	// Construct storage first so the clear-database escape hatch works even when initialize() fails.
	storageService = new StorageService(context, {
		workspacePath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
		workspaceIdentity,
		showUnreadableDatabaseWarning: setAsidePath => { void vscode.window.showWarningMessage(vscode.l10n.t(
			'Time Tracker: the previous time-tracking database could not be read and has been set aside at {0}. A new empty encrypted database will be created.',
			setAsidePath
		)); },
		showNoWorkspaceWarning: () => {
			// Quiet: empty window is expected. Durable storage starts when a folder is opened.
			logInfo('Time Tracker: open a workspace folder to enable durable encrypted storage.');
		},
		showMemoryFallbackWarning: reason => {
			logWarning(`Time Tracker durable DB unavailable: ${reason ?? 'unknown'}`);
			void vscode.window.showWarningMessage(vscode.l10n.t(
				'Secure key storage is unavailable ({0}). Time Tracker is using memory only; entries from this session will be lost when the window closes.',
				reason ?? 'unknown'
			));
		},
		showLegacyCleanupFailureWarning: legacyPath => { void vscode.window.showWarningMessage(vscode.l10n.t(
			'Time Tracker could not securely remove the previous plaintext database at {0}. Close other programs using it, then retry. The encrypted database will not be activated until cleanup succeeds.',
			legacyPath
		)); },
	});
	sensitiveStateStore = new SensitiveStateStore(context, {
		workspacePath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
		workspaceIdentity,
		showNoWorkspaceWarning: () => {
			logInfo('Time Tracker sensitive state: open a workspace folder for durable timer recovery / codes.');
		},
		showMemoryFallbackWarning: reason => {
			logWarning(`Time Tracker sensitive state unavailable: ${reason ?? 'unknown'}`);
			void vscode.window.showWarningMessage(vscode.l10n.t(
				'Time Tracker cannot access secure key storage ({0}). Timer recovery and custom billing codes will remain in memory only for this session.',
				reason ?? 'unknown'
			));
		},
		showLegacyCleanupFailureWarning: legacyPath => { void vscode.window.showWarningMessage(vscode.l10n.t(
			'Time Tracker encrypted the legacy custom billing codes but could not remove the plaintext file at {0}. Close other programs using it, then retry. Sensitive state will not be activated until cleanup succeeds.',
			legacyPath
		)); },
	});
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.clearLocalDatabase', async () => {
			const confirm = await vscode.window.showWarningMessage(
				vscode.l10n.t('Permanently delete all time entries, matters, and billing rates for this workspace? This cannot be undone.'),
				{ modal: true },
				vscode.l10n.t('Delete Database')
			);
			if (confirm !== vscode.l10n.t('Delete Database')) {
				return;
			}
			await storageService.clearLocalDatabase();
			const reload = await vscode.window.showInformationMessage(
				vscode.l10n.t('Time Tracker: local database deleted. Reload the window to continue.'),
				vscode.l10n.t('Reload Window')
			);
			if (reload === vscode.l10n.t('Reload Window')) {
				await vscode.commands.executeCommand('workbench.action.reloadWindow');
			}
		}),
		vscode.commands.registerCommand('timeTracker.clearLocalData', async () => {
			const confirm = await vscode.window.showWarningMessage(
				vscode.l10n.t('Permanently delete all managed local time tracking data, including timer recovery and custom billing codes? Legacy timer recovery for unopened workspaces will be removed when each workspace is next opened.'),
				{ modal: true },
				vscode.l10n.t('Delete All Local Data')
			);
			if (confirm !== vscode.l10n.t('Delete All Local Data')) {
				return;
			}
			await storageService.clearAllLocalDatabases();
			await sensitiveStateStore.purgeAll();
			void vscode.window.showInformationMessage(vscode.l10n.t('Managed Time Tracker local data was deleted. Legacy timer recovery in unopened workspaces is scheduled for deletion when those workspaces are next opened. Reload the window to continue.'));
		}),
		{ dispose: () => storageService.close() }
	);

	try {
		await storageService.initialize();
		await sensitiveStateStore.initialize();

		// Initialize codes service
		codesService = new CodesService(sensitiveStateStore);
		await codesService.loadCodes();

		// Initialize services
		timeTrackerService = new TimeTrackerService(storageService, sensitiveStateStore);
		matterService = new MatterService(storageService);
		rateService = new RateService(storageService);
		exportService = new ExportService(storageService);

		// Initialize UI controllers
		statusBarController = new StatusBarController(
			timeTrackerService,
			matterService,
			storageService
		);

		sidebarProvider = new SidebarProvider(
			context.extensionUri,
			timeTrackerService,
			matterService,
			rateService,
			storageService,
			exportService,
			codesService
		);

		// Register sidebar webview provider
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider(
				SidebarProvider.viewType,
				sidebarProvider
			)
		);

		// Register commands
		registerCommands(context);
		registerAgentTools(context, () => timeTrackerService);

		// Add disposables
		context.subscriptions.push(
			statusBarController,
			{ dispose: () => timeTrackerService.dispose() },
			{ dispose: () => sidebarProvider.dispose() },
			{ dispose: () => codesService.dispose() }
		);

		logInfo('Extension activated successfully');
	} catch (error) {
		logError(`Activation failed: ${error instanceof Error ? error.message : String(error)}`);
		await reportInitializationFailure(error);
	}
}

/**
 * Surfaces an initialize() failure. When the database is unreadable because its
 * key is gone, the only way forward is deleting it, so offer that inline rather
 * than naming a command the user has to go and find.
 */
async function reportInitializationFailure(error: unknown): Promise<void> {
	const message = error instanceof Error ? error.message : String(error);
	const keyNotDurable = message.startsWith('The encryption key for time tracking did not survive');
	const keyLost = message.startsWith('The encrypted time-tracker database cannot be decrypted');
	if (!keyNotDurable && !keyLost) {
		vscode.window.showErrorMessage(vscode.l10n.t('Time Tracker: Failed to initialize - {0}', message));
		return;
	}

	// On the not-durable path deleting is cleanup, not repair: the next session
	// will lose its key the same way, so the label must not promise a fix.
	const deleteAction = keyNotDurable ? vscode.l10n.t('Delete Unreadable Database') : vscode.l10n.t('Delete Database');
	const body = keyNotDurable
		? vscode.l10n.t('Time Tracker: the encryption key for time tracking did not survive a restart, so this workspace\'s entries cannot be read and are unrecoverable. This will keep happening until the app can store keys that outlast a restart — in a browser-served build, use the desktop app instead. Deleting only clears the unreadable file.')
		: vscode.l10n.t('Time Tracker: this workspace\'s time-tracking database cannot be opened because its encryption key is no longer in secure storage. The entries in it are unrecoverable. Delete the database to start tracking again — other workspaces are unaffected.');
	const choice = await vscode.window.showErrorMessage(body, deleteAction);
	if (choice === deleteAction) {
		await vscode.commands.executeCommand('timeTracker.clearLocalDatabase');
	}
}

function registerCommands(context: vscode.ExtensionContext): void {
	// Start timer command
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.start', async () => {
			const matter = await matterService.selectMatter();
			const rate = await rateService.selectRate();

			const description = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Enter description (optional)'),
				placeHolder: vscode.l10n.t('What are you working on?')
			});

			if (description === undefined) return; // Cancelled

			timeTrackerService.start(
				matter?.id || null,
				rate?.id || null,
				description || ''
			);

			vscode.window.showInformationMessage(vscode.l10n.t('Timer started!'));
		})
	);

	// Stop timer command
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.stop', async () => {
			const state = timeTrackerService.getState();

			if (!state.isRunning) {
				vscode.window.showInformationMessage(vscode.l10n.t('No timer is running.'));
				return;
			}

			// Prompt for description if empty
			if (!state.currentDescription) {
				const description = await vscode.window.showInputBox({
					prompt: vscode.l10n.t('Enter description for this entry'),
					placeHolder: vscode.l10n.t('What did you work on?'),
					validateInput: (value) => {
						if (!value || value.trim().length === 0) {
							return vscode.l10n.t('Description is required');
						}
						return null;
					}
				});

				if (!description) {
					// User cancelled, don't stop timer
					return;
				}

				timeTrackerService.updateTimerState({ description });
			}

			const entry = timeTrackerService.stop();

			if (entry) {
				vscode.window.showInformationMessage(
					vscode.l10n.t('Timer stopped: {0} hours recorded.', entry.duration_tenths?.toFixed(1) || 0)
				);
			}
		})
	);

	// Toggle timer command
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.toggle', async () => {
			const state = timeTrackerService.getState();

			if (state.isRunning) {
				// Stop - ensure description
				if (!state.currentDescription) {
					const description = await vscode.window.showInputBox({
						prompt: vscode.l10n.t('Enter description for this entry'),
						placeHolder: vscode.l10n.t('What did you work on?'),
						validateInput: (value) => {
							if (!value || value.trim().length === 0) {
								return vscode.l10n.t('Description is required');
							}
							return null;
						}
					});

					if (!description) return;
					timeTrackerService.updateTimerState({ description });
				}

				const entry = timeTrackerService.stop();
				if (entry) {
					vscode.window.showInformationMessage(
						vscode.l10n.t('Timer stopped: {0} hours', entry.duration_tenths?.toFixed(1) || 0)
					);
				}
			} else {
				// Start quick timer (no matter/rate selection)
				timeTrackerService.start();
				vscode.window.showInformationMessage(vscode.l10n.t('Timer started!'));
			}
		})
	);

	// Add manual entry command
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.addEntry', async () => {
			const matter = await matterService.selectMatter();
			const rate = await rateService.selectRate();

			const hoursStr = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Enter hours (in 0.1 increments)'),
				placeHolder: '0.5',
				validateInput: (value) => {
					const num = parseFloat(value);
					if (isNaN(num) || num <= 0) {
						return vscode.l10n.t('Please enter a positive number');
					}
					return null;
				}
			});

			if (!hoursStr) return;

			const description = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Enter description'),
				placeHolder: vscode.l10n.t('What did you work on?'),
				validateInput: (value) => {
					if (!value || value.trim().length === 0) {
						return vscode.l10n.t('Description is required');
					}
					return null;
				}
			});

			if (!description) return;

			const hours = parseFloat(hoursStr);
			const now = Date.now();
			const durationMs = hours * 60 * 60 * 1000;

			const entry = storageService.createEntry(
				now - durationMs,
				now,
				hours,
				description,
				matter?.id,
				rate?.id,
				undefined,
				undefined,
				true
			);

			vscode.window.showInformationMessage(
				vscode.l10n.t('Manual entry added: {0} hours', entry.duration_tenths?.toFixed(1) ?? 0)
			);
		})
	);

	// Manage matters command
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.manageMatter', async () => {
			const matters = matterService.getMatters(false); // Include inactive

			if (matters.length === 0) {
				const create = await vscode.window.showInformationMessage(
					vscode.l10n.t('No matters found. Create one?'),
					vscode.l10n.t('Create Matter')
				);
				if (create === vscode.l10n.t('Create Matter')) {
					await matterService.createMatter();
				}
				return;
			}

			const items = [
				{ label: vscode.l10n.t('$(add) Create New Matter'), matter: null },
				...matters.map(m => ({
					label: m.matter_name,
					description: m.client_name,
					detail: m.is_active ? undefined : vscode.l10n.t('(Archived)'),
					matter: m
				}))
			];

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: vscode.l10n.t('Select matter to manage')
			});

			if (!selected) return;

			if (!selected.matter) {
				await matterService.createMatter();
			} else {
				await matterService.manageMatter(selected.matter);
			}
		})
	);

	// Manage rates command
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.manageRates', async () => {
			const rates = rateService.getRates();

			if (rates.length === 0) {
				const create = await vscode.window.showInformationMessage(
					vscode.l10n.t('No billing rates found. Create one?'),
					vscode.l10n.t('Create Rate')
				);
				if (create === vscode.l10n.t('Create Rate')) {
					await rateService.createRate();
				}
				return;
			}

			const items = [
				{ label: vscode.l10n.t('$(add) Create New Rate'), rate: null },
				...rates.map(r => ({
					label: r.name,
					description: vscode.l10n.t('${0}/hr', r.hourly_rate.toFixed(2)),
					detail: r.is_default ? vscode.l10n.t('(Default)') : undefined,
					rate: r
				}))
			];

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: vscode.l10n.t('Select rate to manage')
			});

			if (!selected) return;

			if (!selected.rate) {
				await rateService.createRate();
			} else {
				await rateService.manageRate(selected.rate);
			}
		})
	);

	// Export CSV command
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.exportCSV', async () => {
			await exportService.exportWithDateRange('csv');
		})
	);

	// Export JSON command
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.exportJSON', async () => {
			await exportService.exportWithDateRange('json');
		})
	);

	// Export LEDES command
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.exportLEDES', async () => {
			await exportService.exportWithDateRange('ledes');
		})
	);
}

export async function deactivate(): Promise<void> {
	logInfo('Deactivating extension');

	// Auto-stop timer on deactivation if configured
	const config = vscode.workspace.getConfiguration('timeTracker');
	const autoStop = config.get<boolean>('autoStopOnClose', true);

	if (autoStop && timeTrackerService) {
		const state = timeTrackerService.getState();

		if (state.isRunning) {
			// Ensure we have a description
			if (!state.currentDescription) {
				timeTrackerService.updateTimerState({
					description: vscode.l10n.t('Auto-saved on exit')
				});
			}

			const entry = timeTrackerService.stop();

			if (entry) {
				logInfo(
					`Time Tracker: Auto-saved ${entry.duration_tenths?.toFixed(1)} hours on exit`
				);
			}
		}
	}

	// Clean up resources
	if (storageService) {
		storageService.close();
	}

	if (codesService) {
		codesService.dispose();
	}
	await sensitiveStateStore?.flush();

	logInfo('Extension deactivated');
}
