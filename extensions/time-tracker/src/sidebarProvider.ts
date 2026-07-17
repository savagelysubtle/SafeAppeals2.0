/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker - Sidebar Provider
 *  Webview sidebar panel for time tracking UI
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ExportService } from './exportService';
import type { MatterService } from './matterService';
import type { RateService } from './rateService';
import type { StorageService } from './storageService';
import type { TimeTrackerService } from './timeTrackerService';
import type { WebviewMessage, WebviewResponse } from './types';
import { getUTBMSCodes } from './utbmsCodes';

export class SidebarProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'timeTracker.sidebar';
	private _view?: vscode.WebviewView;
	private disposables: vscode.Disposable[] = [];

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly matterService: MatterService,
		private readonly rateService: RateService,
		private readonly storageService: StorageService,
		private readonly exportService: ExportService
	) {
		// Subscribe to timer state changes
		this.disposables.push(
			this.timeTrackerService.onStateChanged((state) => {
				this.postMessage({ type: 'state', data: state });
			})
		);
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.extensionUri]
		};

		webviewView.webview.html = this.getHtmlContent(webviewView.webview);

		// Handle messages from the webview
		webviewView.webview.onDidReceiveMessage(
			(message: WebviewMessage) => this.handleMessage(message),
			undefined,
			this.disposables
		);

		// Send initial state when view becomes visible
		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible) {
				this.postMessage({ type: 'state', data: this.timeTrackerService.getState() });
			}
		});
	}

	private async handleMessage(message: WebviewMessage): Promise<void> {
		try {
			switch (message.type) {
				case 'executeCommand':
					await vscode.commands.executeCommand(message.command);
					// Refresh matters and rates after command execution
					this.postMessage({ type: 'matters', data: this.matterService.getMatters() });
					this.postMessage({ type: 'rates', data: this.rateService.getRates() });
					break;

				case 'getState':
					this.postMessage({ type: 'state', data: this.timeTrackerService.getState() });
					break;

				case 'startTimer':
					this.timeTrackerService.start(
						message.matterId,
						message.rateId,
						message.description,
						message.utbmsTask,
						message.utbmsActivity,
						message.isBillable
					);
					this.postMessage({ type: 'timerStarted', data: this.timeTrackerService.getState() });
					break;

				case 'stopTimer':
					const entry = this.timeTrackerService.stop();
					if (entry) {
						this.postMessage({ type: 'timerStopped', entry });
					}
					break;

				case 'toggleTimer':
					const result = this.timeTrackerService.toggle();
					if (result.started) {
						this.postMessage({ type: 'timerStarted', data: this.timeTrackerService.getState() });
					} else if (result.entry) {
						this.postMessage({ type: 'timerStopped', entry: result.entry });
					}
					break;

				case 'updateTimerState':
					this.timeTrackerService.updateTimerState({
						description: message.description,
						utbmsTask: message.utbmsTask,
						utbmsActivity: message.utbmsActivity,
						isBillable: message.isBillable
					});
					break;

				case 'getMatters':
					this.postMessage({ type: 'matters', data: this.matterService.getMatters() });
					break;

				case 'getRates':
					this.postMessage({ type: 'rates', data: this.rateService.getRates() });
					break;

				case 'getEntries':
					this.postMessage({
						type: 'entries',
						data: this.storageService.getEntries(message.options)
					});
					break;

				case 'getUTBMSCodes':
					this.postMessage({ type: 'utbmsCodes', data: getUTBMSCodes() });
					break;

				case 'createMatter':
					const newMatter = this.storageService.createMatter(
						message.clientName,
						message.matterName,
						message.matterNumber,
						message.defaultRate
					);
					this.postMessage({ type: 'matterCreated', data: newMatter });
					break;

				case 'updateMatter':
					const updatedMatter = this.storageService.updateMatter(message.id, message.updates);
					if (updatedMatter) {
						this.postMessage({ type: 'matterUpdated', data: updatedMatter });
					}
					break;

				case 'deleteMatter':
					this.storageService.deleteMatter(message.id);
					this.postMessage({ type: 'matterDeleted', id: message.id });
					break;

				case 'createRate':
					const newRate = this.storageService.createRate(
						message.name,
						message.hourlyRate,
						message.isDefault
					);
					this.postMessage({ type: 'rateCreated', data: newRate });
					break;

				case 'updateRate':
					const updatedRate = this.storageService.updateRate(message.id, message.updates);
					if (updatedRate) {
						this.postMessage({ type: 'rateUpdated', data: updatedRate });
					}
					break;

				case 'deleteRate':
					this.storageService.deleteRate(message.id);
					this.postMessage({ type: 'rateDeleted', id: message.id });
					break;

				case 'updateEntry':
					const updatedEntry = this.storageService.updateEntry(message.id, message.updates);
					if (updatedEntry) {
						this.postMessage({ type: 'entryUpdated', data: updatedEntry });
					}
					break;

				case 'confirmDeleteEntry':
					const confirmDelete = await vscode.window.showWarningMessage(
						'Delete this time entry?',
						{ modal: true },
						'Delete'
					);
					if (confirmDelete === 'Delete') {
						this.storageService.deleteEntry(message.id);
						this.postMessage({ type: 'entryDeleted', id: message.id });
					}
					break;

				case 'deleteEntry':
					this.storageService.deleteEntry(message.id);
					this.postMessage({ type: 'entryDeleted', id: message.id });
					break;

				case 'exportCSV':
					const csvPath = await this.exportService.exportToCSV(message.options);
					if (csvPath) {
						this.postMessage({ type: 'exportComplete', format: 'CSV', path: csvPath });
					}
					break;

				case 'exportJSON':
					const jsonPath = await this.exportService.exportToJSON(message.options);
					if (jsonPath) {
						this.postMessage({ type: 'exportComplete', format: 'JSON', path: jsonPath });
					}
					break;

				case 'exportLEDES':
					const ledesPath = await this.exportService.exportToLEDES(message.options);
					if (ledesPath) {
						this.postMessage({ type: 'exportComplete', format: 'LEDES', path: ledesPath });
					}
					break;
			}
		} catch (error) {
			this.postMessage({ type: 'error', message: String(error) });
		}
	}

	private postMessage(message: WebviewResponse): void {
		this._view?.webview.postMessage(message);
	}

	private getHtmlContent(webview: vscode.Webview): string {
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionUri, 'media', 'sidebar.css')
		);

		const nonce = this.getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
	<link href="${styleUri}" rel="stylesheet">
	<title>Time Tracker</title>
</head>
<body>
	<div class="sidebar-container">
		<!-- Timer Section -->
		<section class="section">
			<div class="timer-display card">
				<div class="timer-time" id="timerDisplay">00:00</div>
				<div class="timer-tenths" id="timerTenths">0.0 hrs</div>
			</div>

			<div class="timer-controls">
				<button id="toggleBtn" class="btn btn-primary btn-large">
					<span class="icon" id="toggleIcon">▶</span>
					<span id="toggleBtnText">Start Timer</span>
				</button>
			</div>
		</section>

		<!-- Current Entry Details -->
		<section class="section" id="entryDetails">
			<h3 class="section-title">Entry Details</h3>

			<div class="form-group">
				<label for="matterSelect">Matter</label>
				<select id="matterSelect" class="select">
					<option value="">No matter</option>
				</select>
			</div>

			<div class="form-group">
				<label for="rateSelect">Rate</label>
				<select id="rateSelect" class="select">
					<option value="">No rate</option>
				</select>
			</div>

			<div class="form-row">
				<div class="form-group half">
					<label for="taskSelect">Task Code</label>
					<select id="taskSelect" class="select">
						<option value="">None</option>
					</select>
				</div>
				<div class="form-group half">
					<label for="activitySelect">Activity</label>
					<select id="activitySelect" class="select">
						<option value="">None</option>
					</select>
				</div>
			</div>

			<div class="form-group">
				<label for="description">Description</label>
				<textarea id="description" class="textarea" rows="3" placeholder="Describe your work..."></textarea>
				<div class="char-count" id="charCount">0/500</div>
			</div>

			<div class="form-group">
				<label class="checkbox-label">
					<input type="checkbox" id="billableCheck" checked>
					<span>Billable</span>
				</label>
			</div>
		</section>

		<!-- Today's Entries -->
		<section class="section">
			<div class="section-header">
				<h3 class="section-title">Today's Entries</h3>
				<span class="badge" id="todayTotal">0.0 hrs</span>
			</div>
			<div id="entriesList" class="entries-list">
				<p class="empty-message">No entries today</p>
			</div>
		</section>

		<!-- Quick Actions -->
		<section class="section">
			<h3 class="section-title">Export</h3>
			<div class="button-group">
				<button id="exportCSV" class="btn btn-secondary">
					<span class="icon">📄</span> CSV
				</button>
				<button id="exportJSON" class="btn btn-secondary">
					<span class="icon">{ }</span> JSON
				</button>
				<button id="exportLEDES" class="btn btn-secondary">
					<span class="icon">⚖</span> LEDES
				</button>
			</div>
		</section>

		<!-- Management -->
		<section class="section">
			<h3 class="section-title">Manage</h3>
			<div class="button-group">
				<button id="manageMatters" class="btn btn-secondary">
					<span class="icon">💼</span> Matters
				</button>
				<button id="manageRates" class="btn btn-secondary">
					<span class="icon">💰</span> Rates
				</button>
			</div>
		</section>
	</div>

	<script nonce="${nonce}">
		(function() {
			const vscode = acquireVsCodeApi();

			// State
			let isRunning = false;
			let startTime = null;
			let matters = [];
			let rates = [];
			let utbmsCodes = { tasks: {}, activities: {} };

			// DOM Elements
			const timerDisplay = document.getElementById('timerDisplay');
			const timerTenths = document.getElementById('timerTenths');
			const toggleBtn = document.getElementById('toggleBtn');
			const toggleBtnText = document.getElementById('toggleBtnText');
			const matterSelect = document.getElementById('matterSelect');
			const rateSelect = document.getElementById('rateSelect');
			const taskSelect = document.getElementById('taskSelect');
			const activitySelect = document.getElementById('activitySelect');
			const description = document.getElementById('description');
			const charCount = document.getElementById('charCount');
			const billableCheck = document.getElementById('billableCheck');
			const entriesList = document.getElementById('entriesList');
			const todayTotal = document.getElementById('todayTotal');

			// Timer update interval
			let timerInterval = null;

			// Format duration
			function formatDuration(ms) {
				const totalSeconds = Math.floor(ms / 1000);
				const hours = Math.floor(totalSeconds / 3600);
				const minutes = Math.floor((totalSeconds % 3600) / 60);
				const seconds = totalSeconds % 60;
				if (hours > 0) {
					return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
				}
				return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
			}

			// Format tenths
			function formatTenths(tenths) {
				return tenths.toFixed(1) + ' hrs';
			}

			// Round to tenths (6-min increments, round up)
			function roundToTenths(ms) {
				const hours = ms / (1000 * 60 * 60);
				return Math.ceil(hours * 10) / 10;
			}

			// Update timer display
			function updateTimer() {
				if (isRunning && startTime) {
					const elapsed = Date.now() - startTime;
					timerDisplay.textContent = formatDuration(elapsed);
					timerTenths.textContent = formatTenths(roundToTenths(elapsed));
				}
			}

			// Start timer display updates
			function startTimerUpdates() {
				if (timerInterval) clearInterval(timerInterval);
				timerInterval = setInterval(updateTimer, 1000);
				updateTimer();
			}

			// Stop timer display updates
			function stopTimerUpdates() {
				if (timerInterval) {
					clearInterval(timerInterval);
					timerInterval = null;
				}
				timerDisplay.textContent = '00:00';
				timerTenths.textContent = '0.0 hrs';
			}

			// Update UI state
			function updateUIState() {
				const toggleIcon = document.getElementById('toggleIcon');
				if (isRunning) {
					toggleBtn.classList.add('running');
					toggleBtnText.textContent = 'Stop Timer';
					toggleIcon.textContent = '⏹';
				} else {
					toggleBtn.classList.remove('running');
					toggleBtnText.textContent = 'Start Timer';
					toggleIcon.textContent = '▶';
				}
			}

			// Populate select options
			function populateMatters() {
				matterSelect.innerHTML = '<option value="">No matter</option>';
				matters.forEach(m => {
					const opt = document.createElement('option');
					opt.value = m.id;
					opt.textContent = m.client_name + ' - ' + m.matter_name;
					matterSelect.appendChild(opt);
				});
			}

			function populateRates() {
				rateSelect.innerHTML = '<option value="">No rate</option>';
				rates.forEach(r => {
					const opt = document.createElement('option');
					opt.value = r.id;
					opt.textContent = r.name + ' ($' + r.hourly_rate.toFixed(2) + '/hr)';
					if (r.is_default) opt.textContent += ' (Default)';
					rateSelect.appendChild(opt);
				});
			}

			function populateUTBMS() {
				taskSelect.innerHTML = '<option value="">None</option>';
				for (const [code, desc] of Object.entries(utbmsCodes.tasks)) {
					const opt = document.createElement('option');
					opt.value = code;
					opt.textContent = code + ' - ' + desc.substring(0, 30) + (desc.length > 30 ? '...' : '');
					opt.title = desc;
					taskSelect.appendChild(opt);
				}

				activitySelect.innerHTML = '<option value="">None</option>';
				for (const [code, desc] of Object.entries(utbmsCodes.activities)) {
					const opt = document.createElement('option');
					opt.value = code;
					opt.textContent = code + ' - ' + desc;
					activitySelect.appendChild(opt);
				}
			}

			// Render entries
			function renderEntries(entries) {
				if (!entries || entries.length === 0) {
					entriesList.innerHTML = '<p class="empty-message">No entries today</p>';
					todayTotal.textContent = '0.0 hrs';
					return;
				}

				let total = 0;
				let html = '';

				entries.forEach(e => {
					total += e.duration_tenths || 0;
					const startTime = new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
					const endTime = e.end_time ? new Date(e.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Running';
					const startDate = new Date(e.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' });
					const hours = (e.duration_tenths || 0).toFixed(1);

					html += '<div class="entry-card" data-entry-id="' + e.id + '">';
					html += '<div class="entry-header">';
					html += '<div class="entry-times">';
					html += '<span class="entry-date">' + startDate + '</span>';
					html += '<span class="entry-time-range">' + startTime + ' → ' + endTime + '</span>';
					html += '</div>';
					html += '<div class="entry-actions">';
					html += '<span class="entry-hours">' + hours + ' hrs</span>';
					html += '<button class="btn-delete" data-id="' + e.id + '" title="Delete entry">✕</button>';
					html += '</div>';
					html += '</div>';
					if (e.matter_name) {
						html += '<div class="entry-matter">' + e.matter_name + '</div>';
					}
					if (e.utbms_task || e.utbms_activity) {
						html += '<div class="entry-codes">';
						if (e.utbms_task) html += '<span class="code-badge">' + e.utbms_task + '</span>';
						if (e.utbms_activity) html += '<span class="code-badge">' + e.utbms_activity + '</span>';
						html += '</div>';
					}
					html += '<div class="entry-description">' + (e.description || 'No description') + '</div>';
					html += '<div class="entry-badges">';
					html += '<span class="badge ' + (e.is_billable ? 'badge-billable' : 'badge-nonbillable') + '">';
					html += e.is_billable ? 'Billable' : 'Non-billable';
					html += '</span>';
					html += '</div>';
					html += '</div>';
				});

				entriesList.innerHTML = html;
				todayTotal.textContent = total.toFixed(1) + ' hrs';

				// Add delete button handlers
				document.querySelectorAll('.btn-delete').forEach(btn => {
					btn.addEventListener('click', (e) => {
						e.stopPropagation();
						const id = parseInt(btn.getAttribute('data-id'));
						// Send confirmation request to extension host
						vscode.postMessage({ type: 'confirmDeleteEntry', id: id });
					});
				});
			}

			// Handle messages from extension
			window.addEventListener('message', event => {
				const message = event.data;

				switch (message.type) {
					case 'state':
						isRunning = message.data.isRunning;
						startTime = message.data.startTime;
						if (message.data.currentMatterId) {
							matterSelect.value = message.data.currentMatterId;
						}
						if (message.data.currentRateId) {
							rateSelect.value = message.data.currentRateId;
						}
						if (message.data.currentUtbmsTask) {
							taskSelect.value = message.data.currentUtbmsTask;
						}
						if (message.data.currentUtbmsActivity) {
							activitySelect.value = message.data.currentUtbmsActivity;
						}
						if (message.data.currentDescription) {
							description.value = message.data.currentDescription;
							charCount.textContent = message.data.currentDescription.length + '/500';
						}
						billableCheck.checked = message.data.isBillable;
						updateUIState();
						if (isRunning) {
							startTimerUpdates();
						} else {
							stopTimerUpdates();
						}
						break;

					case 'matters':
						matters = message.data;
						populateMatters();
						break;

					case 'rates':
						rates = message.data;
						populateRates();
						break;

					case 'entries':
						renderEntries(message.data);
						break;

					case 'utbmsCodes':
						utbmsCodes = message.data;
						populateUTBMS();
						break;

					case 'timerStarted':
						isRunning = true;
						startTime = message.data.startTime;
						updateUIState();
						startTimerUpdates();
						break;

					case 'timerStopped':
						isRunning = false;
						startTime = null;
						updateUIState();
						stopTimerUpdates();
						// Refresh entries
						vscode.postMessage({ type: 'getEntries', options: { startDate: getTodayStart() } });
						break;

					case 'entryDeleted':
						// Refresh entries after deletion
						vscode.postMessage({ type: 'getEntries', options: { startDate: getTodayStart() } });
						break;

					case 'error':
						console.error('Time Tracker Error:', message.message);
						break;
				}
			});

			// Get today's start timestamp
			function getTodayStart() {
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				return today.getTime();
			}

			// Event listeners
			toggleBtn.addEventListener('click', () => {
				if (isRunning) {
					vscode.postMessage({ type: 'stopTimer' });
				} else {
					vscode.postMessage({
						type: 'startTimer',
						matterId: matterSelect.value ? parseInt(matterSelect.value) : null,
						rateId: rateSelect.value ? parseInt(rateSelect.value) : null,
						description: description.value,
						utbmsTask: taskSelect.value || null,
						utbmsActivity: activitySelect.value || null,
						isBillable: billableCheck.checked
					});
				}
			});

			description.addEventListener('input', () => {
				const len = description.value.length;
				charCount.textContent = len + '/500';
				if (len > 500) {
					charCount.classList.add('over-limit');
				} else {
					charCount.classList.remove('over-limit');
				}

				if (isRunning) {
					vscode.postMessage({
						type: 'updateTimerState',
						description: description.value
					});
				}
			});

			// Update timer state when selects change
			[matterSelect, rateSelect, taskSelect, activitySelect].forEach(el => {
				el.addEventListener('change', () => {
					if (isRunning) {
						vscode.postMessage({
							type: 'updateTimerState',
							utbmsTask: taskSelect.value || null,
							utbmsActivity: activitySelect.value || null
						});
					}
				});
			});

			billableCheck.addEventListener('change', () => {
				if (isRunning) {
					vscode.postMessage({
						type: 'updateTimerState',
						isBillable: billableCheck.checked
					});
				}
			});

			// Export buttons
			document.getElementById('exportCSV').addEventListener('click', () => {
				vscode.postMessage({ type: 'exportCSV' });
			});

			document.getElementById('exportJSON').addEventListener('click', () => {
				vscode.postMessage({ type: 'exportJSON' });
			});

			document.getElementById('exportLEDES').addEventListener('click', () => {
				vscode.postMessage({ type: 'exportLEDES' });
			});

			// Manage buttons - trigger VSCode commands
			document.getElementById('manageMatters').addEventListener('click', () => {
				vscode.postMessage({ type: 'executeCommand', command: 'timeTracker.manageMatter' });
			});

			document.getElementById('manageRates').addEventListener('click', () => {
				vscode.postMessage({ type: 'executeCommand', command: 'timeTracker.manageRates' });
			});

			// Initialize
			vscode.postMessage({ type: 'getState' });
			vscode.postMessage({ type: 'getMatters' });
			vscode.postMessage({ type: 'getRates' });
			vscode.postMessage({ type: 'getUTBMSCodes' });
			vscode.postMessage({ type: 'getEntries', options: { startDate: getTodayStart() } });
		})();
	</script>
</body>
</html>`;
	}

	private getNonce(): string {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}

	dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}
