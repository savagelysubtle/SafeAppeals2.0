/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker Extension
 *  Professional time tracking with UTBMS codes, 6-minute billing, and LEDES export
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ExportService } from './exportService';
import { MatterService } from './matterService';
import { RateService } from './rateService';
import { SidebarProvider } from './sidebarProvider';
import { StatusBarController } from './statusBarController';
import { StorageService } from './storageService';
import { TimeTrackerService } from './timeTrackerService';

let storageService: StorageService;
let timeTrackerService: TimeTrackerService;
let matterService: MatterService;
let rateService: RateService;
let exportService: ExportService;
let statusBarController: StatusBarController;
let sidebarProvider: SidebarProvider;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	console.log('Time Tracker extension activating...');

	// Construct storage first so the clear-database escape hatch works even when initialize() fails.
	storageService = new StorageService(context);
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.clearLocalDatabase', async () => {
			const confirm = await vscode.window.showWarningMessage(
				'Permanently delete all time entries, matters, and billing rates for this workspace? This cannot be undone.',
				{ modal: true },
				'Delete Database'
			);
			if (confirm !== 'Delete Database') {
				return;
			}
			await storageService.clearLocalDatabase();
			const reload = await vscode.window.showInformationMessage(
				'Time Tracker: local database deleted. Reload the window to continue.',
				'Reload Window'
			);
			if (reload === 'Reload Window') {
				await vscode.commands.executeCommand('workbench.action.reloadWindow');
			}
		}),
		{ dispose: () => storageService.close() }
	);

	try {
		await storageService.initialize();

		// Initialize services
		timeTrackerService = new TimeTrackerService(storageService, context);
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
			exportService
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

		// Add disposables
		context.subscriptions.push(
			statusBarController,
			{ dispose: () => timeTrackerService.dispose() },
			{ dispose: () => sidebarProvider.dispose() }
		);

		console.log('Time Tracker extension activated successfully');
	} catch (error) {
		console.error('Failed to activate Time Tracker extension:', error);
		vscode.window.showErrorMessage(`Time Tracker: Failed to initialize - ${error}`);
	}
}

function registerCommands(context: vscode.ExtensionContext): void {
	// Start timer command
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.start', async () => {
			const matter = await matterService.selectMatter();
			const rate = await rateService.selectRate();

			const description = await vscode.window.showInputBox({
				prompt: 'Enter description (optional)',
				placeHolder: 'What are you working on?'
			});

			if (description === undefined) return; // Cancelled

			timeTrackerService.start(
				matter?.id || null,
				rate?.id || null,
				description || ''
			);

			vscode.window.showInformationMessage('Timer started!');
		})
	);

	// Stop timer command
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.stop', async () => {
			const state = timeTrackerService.getState();

			if (!state.isRunning) {
				vscode.window.showInformationMessage('No timer is running.');
				return;
			}

			// Prompt for description if empty
			if (!state.currentDescription) {
				const description = await vscode.window.showInputBox({
					prompt: 'Enter description for this entry',
					placeHolder: 'What did you work on?',
					validateInput: (value) => {
						if (!value || value.trim().length === 0) {
							return 'Description is required';
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
					`Timer stopped: ${entry.duration_tenths?.toFixed(1) || 0} hours recorded.`
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
						prompt: 'Enter description for this entry',
						placeHolder: 'What did you work on?',
						validateInput: (value) => {
							if (!value || value.trim().length === 0) {
								return 'Description is required';
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
						`Timer stopped: ${entry.duration_tenths?.toFixed(1) || 0} hours`
					);
				}
			} else {
				// Start quick timer (no matter/rate selection)
				timeTrackerService.start();
				vscode.window.showInformationMessage('Timer started!');
			}
		})
	);

	// Add manual entry command
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.addEntry', async () => {
			const matter = await matterService.selectMatter();
			const rate = await rateService.selectRate();

			const hoursStr = await vscode.window.showInputBox({
				prompt: 'Enter hours (in 0.1 increments)',
				placeHolder: '0.5',
				validateInput: (value) => {
					const num = parseFloat(value);
					if (isNaN(num) || num <= 0) {
						return 'Please enter a positive number';
					}
					return null;
				}
			});

			if (!hoursStr) return;

			const description = await vscode.window.showInputBox({
				prompt: 'Enter description',
				placeHolder: 'What did you work on?',
				validateInput: (value) => {
					if (!value || value.trim().length === 0) {
						return 'Description is required';
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
				`Manual entry added: ${entry.duration_tenths?.toFixed(1)} hours`
			);
		})
	);

	// Manage matters command
	context.subscriptions.push(
		vscode.commands.registerCommand('timeTracker.manageMatter', async () => {
			const matters = matterService.getMatters(false); // Include inactive

			if (matters.length === 0) {
				const create = await vscode.window.showInformationMessage(
					'No matters found. Create one?',
					'Create Matter'
				);
				if (create === 'Create Matter') {
					await matterService.createMatter();
				}
				return;
			}

			const items = [
				{ label: '$(add) Create New Matter', matter: null },
				...matters.map(m => ({
					label: m.matter_name,
					description: m.client_name,
					detail: m.is_active ? undefined : '(Archived)',
					matter: m
				}))
			];

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: 'Select matter to manage'
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
					'No billing rates found. Create one?',
					'Create Rate'
				);
				if (create === 'Create Rate') {
					await rateService.createRate();
				}
				return;
			}

			const items = [
				{ label: '$(add) Create New Rate', rate: null },
				...rates.map(r => ({
					label: r.name,
					description: `$${r.hourly_rate.toFixed(2)}/hr`,
					detail: r.is_default ? '(Default)' : undefined,
					rate: r
				}))
			];

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: 'Select rate to manage'
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

export function deactivate(): void {
	console.log('Time Tracker extension deactivating...');

	// Auto-stop timer on deactivation if configured
	const config = vscode.workspace.getConfiguration('timeTracker');
	const autoStop = config.get<boolean>('autoStopOnClose', true);

	if (autoStop && timeTrackerService) {
		const state = timeTrackerService.getState();

		if (state.isRunning) {
			// Ensure we have a description
			if (!state.currentDescription) {
				timeTrackerService.updateTimerState({
					description: 'Auto-saved on exit'
				});
			}

			const entry = timeTrackerService.stop();

			if (entry) {
				console.log(
					`Time Tracker: Auto-saved ${entry.duration_tenths?.toFixed(1)} hours on exit`
				);
			}
		}
	}

	// Clean up resources
	if (storageService) {
		storageService.close();
	}

	console.log('Time Tracker extension deactivated');
}
