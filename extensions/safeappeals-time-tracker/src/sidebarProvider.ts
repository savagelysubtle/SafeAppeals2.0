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
import { CodesService } from './codesService';
import type { WebviewMessage, WebviewResponse } from './types';

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
		private readonly exportService: ExportService,
		private readonly codesService: CodesService
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
					this.postMessage({ type: 'utbmsCodes', data: await this.codesService.loadCodes() });
					break;

				case 'getCustomCodes':
					const customCodes = await this.codesService.getCustomCodes();
					this.postMessage({ type: 'customCodes', data: customCodes });
					break;

				case 'saveCustomCodes':
					await this.codesService.saveCustomCodes(message.codes);
					this.postMessage({ type: 'utbmsCodes', data: await this.codesService.loadCodes() });
					break;

				case 'addTaskCode':
					await this.codesService.addTaskCode(message.code, message.description);
					this.postMessage({ type: 'utbmsCodes', data: await this.codesService.loadCodes() });
					break;

				case 'addActivityCode':
					await this.codesService.addActivityCode(message.code, message.description);
					this.postMessage({ type: 'utbmsCodes', data: await this.codesService.loadCodes() });
					break;

				case 'deleteTaskCode':
					await this.codesService.deleteTaskCode(message.code);
					this.postMessage({ type: 'utbmsCodes', data: await this.codesService.loadCodes() });
					break;

				case 'deleteActivityCode':
					await this.codesService.deleteActivityCode(message.code);
					this.postMessage({ type: 'utbmsCodes', data: await this.codesService.loadCodes() });
					break;

				case 'setInheritBuiltIn':
					await this.codesService.setInheritBuiltIn(message.inherit);
					this.postMessage({ type: 'utbmsCodes', data: await this.codesService.loadCodes() });
					break;

				case 'validateCode':
					const validation = this.codesService.validateCode(message.code, message.description);
					this.postMessage({ type: 'codeValidation', data: validation });
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
		const l10n = {
			title: vscode.l10n.t('Time Tracker'),
			startTimer: vscode.l10n.t('Start Timer'),
			stopTimer: vscode.l10n.t('Stop Timer'),
			entryDetails: vscode.l10n.t('Entry Details'),
			matter: vscode.l10n.t('Matter'),
			noMatter: vscode.l10n.t('No matter'),
			rate: vscode.l10n.t('Rate'),
			noRate: vscode.l10n.t('No rate'),
			noEntriesToday: vscode.l10n.t('No entries today'),
			noDescription: vscode.l10n.t('No description'),
			deleteEntry: vscode.l10n.t('Delete entry'),
			deleteCode: vscode.l10n.t('Delete code'),
		};
		const webviewL10n = JSON.stringify(l10n).replace(/</g, '\\u003c');

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
	<link href="${styleUri}" rel="stylesheet">
	<style>
		/* Codes Modal Styles */
		.modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; }
		.modal.hidden { display: none; }
		.modal-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); }
		.modal-content { position: relative; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; width: 90%; max-width: 700px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; }
		.codes-modal { max-height: 90vh; }
		.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--vscode-panel-border); }
		.modal-header h3 { margin: 0; font-size: 14px; font-weight: 600; }
		.modal-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--vscode-foreground); padding: 0 8px; line-height: 1; }
		.modal-close:hover { color: var(--vscode-errorForeground); }
		.modal-body { padding: 16px; overflow-y: auto; max-height: 60vh; }
		.codes-tabs { display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 8px; }
		.tab-btn { padding: 8px 16px; background: var(--vscode-button-secondaryBackground); border: none; border-radius: 4px; cursor: pointer; font-size: 12px; color: var(--vscode-button-secondaryForeground); }
		.tab-btn.active { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
		.tab-panel { display: none; }
		.tab-panel.active { display: block; }
		.codes-toolbar { margin-bottom: 12px; padding: 8px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px; }
		.codes-list { max-height: 300px; overflow-y: auto; border: 1px solid var(--vscode-panel-border); border-radius: 4px; }
		.code-row { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); gap: 12px; }
		.code-row:last-child { border-bottom: none; }
		.code-row.built-in { opacity: 0.7; background: var(--vscode-editor-inactiveSelectionBackground); }
		.code-badge { font-family: monospace; font-size: 11px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 2px 6px; border-radius: 3px; min-width: 80px; text-align: center; }
		.code-desc { flex: 1; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
		.code-type { font-size: 10px; padding: 2px 6px; border-radius: 3px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
		.code-row .btn-delete { background: none; border: none; color: var(--vscode-errorForeground); cursor: pointer; padding: 2px 6px; font-size: 14px; line-height: 1; }
		.code-row .btn-delete:hover { background: var(--vscode-errorForeground); color: var(--vscode-button-foreground); border-radius: 3px; }
		.code-form { margin-top: 16px; padding: 16px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px; }
		.code-form h4 { margin: 0 0 12px; font-size: 13px; }
		.form-row { display: flex; gap: 12px; margin-bottom: 12px; }
		.form-group.half { flex: 1; }
		.input { width: 100%; padding: 6px 10px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 3px; font-size: 12px; box-sizing: border-box; }
		.validation-error { color: var(--vscode-errorForeground); font-size: 11px; margin-top: 4px; }
		.validation-error.hidden { display: none; }
		.btn { padding: 6px 12px; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; }
		.btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
		.btn-primary:hover { background: var(--vscode-button-hoverBackground); }
		.btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
		.btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
		.btn-large { padding: 10px 20px; font-size: 13px; }
		.btn-delete { background: none; border: none; color: var(--vscode-errorForeground); cursor: pointer; padding: 4px; font-size: 14px; line-height: 1; }
		.btn-delete:hover { color: var(--vscode-button-foreground); background: var(--vscode-errorForeground); border-radius: 3px; }
		.button-group { display: flex; flex-wrap: wrap; gap: 8px; }
		.section { margin-bottom: 16px; }
		.section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--vscode-foreground); margin-bottom: 12px; }
		.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
		.badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
		.badge-billable { background: var(--vscode-testing-iconPassed); color: var(--vscode-editor-background); }
		.badge-nonbillable { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
		.form-group { margin-bottom: 12px; }
		.form-group label { display: block; font-size: 11px; font-weight: 500; margin-bottom: 4px; }
		.select, .textarea { width: 100%; padding: 6px 10px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 3px; font-size: 12px; box-sizing: border-box; }
		.textarea { min-height: 60px; resize: vertical; font-family: inherit; }
		.char-count { font-size: 10px; color: var(--vscode-descriptionForeground); text-align: right; margin-top: 4px; }
		.char-count.over-limit { color: var(--vscode-errorForeground); }
		.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; }
		.entries-list { max-height: 300px; overflow-y: auto; }
		.entry-card { border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 12px; margin-bottom: 8px; background: var(--vscode-editor-background); }
		.entry-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
		.entry-times { display: flex; flex-direction: column; gap: 2px; }
		.entry-date { font-size: 11px; color: var(--vscode-descriptionForeground); }
		.entry-time-range { font-size: 11px; font-family: monospace; }
		.entry-actions { display: flex; align-items: center; gap: 8px; }
		.entry-hours { font-weight: 600; font-size: 12px; color: var(--vscode-testing-iconPassed); }
		.entry-matter { font-size: 12px; font-weight: 500; color: var(--vscode-foreground); margin-bottom: 4px; }
		.entry-codes { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
		.code-badge { font-family: monospace; font-size: 10px; padding: 2px 6px; border-radius: 3px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
		.entry-description { font-size: 12px; color: var(--vscode-foreground); margin-bottom: 8px; }
		.entry-badges { display: flex; gap: 8px; }
		.empty-message { color: var(--vscode-descriptionForeground); font-size: 12px; text-align: center; padding: 20px; }
		.timer-display { text-align: center; padding: 20px; }
		.timer-time { font-size: 36px; font-weight: 300; font-family: monospace; letter-spacing: 2px; }
		.timer-tenths { font-size: 14px; color: var(--vscode-descriptionForeground); margin-top: 4px; }
		.timer-controls { text-align: center; margin-top: 16px; }
		.toggleBtn.running { background: var(--vscode-errorForeground); color: var(--vscode-button-foreground); }
		.sidebar-container { padding: 16px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; }
		card { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 6px; }
	</style>
	<title>${l10n.title}</title>
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
					<span id="toggleBtnText">${l10n.startTimer}</span>
				</button>
			</div>
		</section>

		<!-- Current Entry Details -->
		<section class="section" id="entryDetails">
			<h3 class="section-title">${l10n.entryDetails}</h3>

			<div class="form-group">
				<label for="matterSelect">${l10n.matter}</label>
				<select id="matterSelect" class="select">
					<option value="">${l10n.noMatter}</option>
				</select>
			</div>

			<div class="form-group">
				<label for="rateSelect">${l10n.rate}</label>
				<select id="rateSelect" class="select">
					<option value="">${l10n.noRate}</option>
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
				<button id="manageCodes" class="btn btn-secondary">
					<span class="icon">🏷️</span> Codes
				</button>
			</div>
		</section>
	</div>

	<!-- Codes Management Modal -->
	<div id="codesModal" class="modal hidden">
		<div class="modal-overlay"></div>
		<div class="modal-content codes-modal">
			<div class="modal-header">
				<h3>Manage UTBMS Codes</h3>
				<button class="modal-close" id="closeCodesModal" aria-label="Close">&times;</button>
			</div>
			<div class="modal-body">
				<div class="codes-tabs">
					<button class="tab-btn active" data-tab="tasks">Task Codes</button>
					<button class="tab-btn" data-tab="activities">Activity Codes</button>
				</div>

				<div class="tab-panel active" id="tasksPanel">
					<div class="codes-toolbar">
						<label class="checkbox-label">
							<input type="checkbox" id="inheritBuiltInTasks" checked>
							<span>Include built-in UTBMS task codes</span>
						</label>
					</div>
					<div class="codes-list" id="tasksList"></div>
					<div class="code-form" id="taskForm">
						<h4>Add Custom Task Code</h4>
						<div class="form-row">
							<div class="form-group half">
								<label for="newTaskCode">Code</label>
								<input type="text" id="newTaskCode" class="input" placeholder="e.g., CUSTOM01" maxlength="20">
								<div class="validation-error hidden" id="newTaskCodeError"></div>
							</div>
							<div class="form-group half">
								<label for="newTaskDesc">Description</label>
								<input type="text" id="newTaskDesc" class="input" placeholder="e.g., Client Intake" maxlength="200">
							</div>
						</div>
						<button id="addTaskCode" class="btn btn-primary">Add Task Code</button>
					</div>
				</div>

				<div class="tab-panel" id="activitiesPanel">
					<div class="codes-toolbar">
						<label class="checkbox-label">
							<input type="checkbox" id="inheritBuiltInActivities" checked>
							<span>Include built-in UTBMS activity codes</span>
						</label>
					</div>
					<div class="codes-list" id="activitiesList"></div>
					<div class="code-form" id="activityForm">
						<h4>Add Custom Activity Code</h4>
						<div class="form-row">
							<div class="form-group half">
								<label for="newActivityCode">Code</label>
								<input type="text" id="newActivityCode" class="input" placeholder="e.g., CUSTOM_A01" maxlength="20">
								<div class="validation-error hidden" id="newActivityCodeError"></div>
							</div>
							<div class="form-group half">
								<label for="newActivityDesc">Description</label>
								<input type="text" id="newActivityDesc" class="input" placeholder="e.g., Medical Review" maxlength="200">
							</div>
						</div>
						<button id="addActivityCode" class="btn btn-primary">Add Activity Code</button>
					</div>
				</div>
			</div>
		</div>
	</div>

		<script nonce="${nonce}">
			const l10n = ${webviewL10n};
			function escapeHtml(value) {
				const element = document.createElement('div');
				element.textContent = String(value);
				return element.innerHTML;
			}
		(function() {
			const vscode = acquireVsCodeApi();

			// State
			let isRunning = false;
			let startTime = null;
			let matters = [];
			let rates = [];
			let utbmsCodes = { tasks: {}, activities: {} };
			let customCodes = null;
			let codesModalOpen = false;

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

			// Codes Modal Elements
			const codesModal = document.getElementById('codesModal');
			const closeCodesModal = document.getElementById('closeCodesModal');
			const manageCodesBtn = document.getElementById('manageCodes');
			const tasksPanel = document.getElementById('tasksPanel');
			const activitiesPanel = document.getElementById('activitiesPanel');
			const tasksList = document.getElementById('tasksList');
			const activitiesList = document.getElementById('activitiesList');
			const inheritBuiltInTasks = document.getElementById('inheritBuiltInTasks');
			const inheritBuiltInActivities = document.getElementById('inheritBuiltInActivities');
			const newTaskCode = document.getElementById('newTaskCode');
			const newTaskDesc = document.getElementById('newTaskDesc');
			const newTaskCodeError = document.getElementById('newTaskCodeError');
			const newActivityCode = document.getElementById('newActivityCode');
			const newActivityDesc = document.getElementById('newActivityDesc');
			const newActivityCodeError = document.getElementById('newActivityCodeError');
			const addTaskCodeBtn = document.getElementById('addTaskCode');
			const addActivityCodeBtn = document.getElementById('addActivityCode');

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
					toggleBtnText.textContent = l10n.stopTimer;
					toggleIcon.textContent = '⏹';
				} else {
					toggleBtn.classList.remove('running');
					toggleBtnText.textContent = l10n.startTimer;
					toggleIcon.textContent = '▶';
				}
			}

			// Populate select options
			function populateMatters() {
				matterSelect.innerHTML = '<option value="">' + escapeHtml(l10n.noMatter) + '</option>';
				matters.forEach(m => {
					const opt = document.createElement('option');
					opt.value = m.id;
					opt.textContent = m.client_name + ' - ' + m.matter_name;
					matterSelect.appendChild(opt);
				});
			}

			function populateRates() {
				rateSelect.innerHTML = '<option value="">' + escapeHtml(l10n.noRate) + '</option>';
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

			// Codes Management Functions
			function openCodesModal() {
				codesModal.classList.remove('hidden');
				codesModalOpen = true;
				vscode.postMessage({ type: 'getCustomCodes' });
				renderCodesLists();
			}

			function closeCodesModalFn() {
				codesModal.classList.add('hidden');
				codesModalOpen = false;
			}

			function switchTab(tab) {
				document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
				document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
				document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
				document.getElementById(tab + 'Panel').classList.add('active');
			}

			function renderCodesLists() {
				if (!customCodes) return;

				const inheritTasks = inheritBuiltInTasks.checked;
				const inheritActivities = inheritBuiltInActivities.checked;

				// Render tasks
				tasksList.innerHTML = '';
				const allTasks = { ...(inheritTasks ? utbmsCodes.tasks : {}), ...(customCodes.taskCodes || {}) };
				for (const [code, desc] of Object.entries(allTasks)) {
					const isBuiltIn = code in utbmsCodes.tasks && !(code in (customCodes.taskCodes || {}));
					const isCustom = code in (customCodes.taskCodes || {});
					const row = document.createElement('div');
					row.className = 'code-row' + (isBuiltIn ? ' built-in' : '');
					row.innerHTML = '<span class="code-badge">' + code + '</span>' +
						'<span class="code-desc" title="' + desc + '">' + desc + '</span>' +
						'<span class="code-type">' + (isBuiltIn ? 'Built-in' : 'Custom') + '</span>' +
						(isCustom ? '<button class="btn-delete" data-code="' + code + '" data-type="task" title="Delete">✕</button>' : '');
					tasksList.appendChild(row);
				}

				// Render activities
				activitiesList.innerHTML = '';
				const allActivities = { ...(inheritActivities ? utbmsCodes.activities : {}), ...(customCodes.activityCodes || {}) };
				for (const [code, desc] of Object.entries(allActivities)) {
					const isBuiltIn = code in utbmsCodes.activities && !(code in (customCodes.activityCodes || {}));
					const isCustom = code in (customCodes.activityCodes || {});
					const row = document.createElement('div');
					row.className = 'code-row' + (isBuiltIn ? ' built-in' : '');
					row.innerHTML = '<span class="code-badge">' + code + '</span>' +
						'<span class="code-desc" title="' + desc + '">' + desc + '</span>' +
						'<span class="code-type">' + (isBuiltIn ? 'Built-in' : 'Custom') + '</span>' +
						(isCustom ? '<button class="btn-delete" data-code="' + code + '" data-type="activity" title="Delete">✕</button>' : '');
					activitiesList.appendChild(row);
				}

				// Add delete handlers
				document.querySelectorAll('#tasksList .btn-delete, #activitiesList .btn-delete').forEach(btn => {
					btn.addEventListener('click', (e) => {
						e.stopPropagation();
						const code = btn.getAttribute('data-code');
						const type = btn.getAttribute('data-type');
						if (type === 'task') {
							vscode.postMessage({ type: 'deleteTaskCode', code: code });
						} else {
							vscode.postMessage({ type: 'deleteActivityCode', code: code });
						}
					});
				});
			}

			function validateCodeInput(codeInput, errorElement) {
				const code = codeInput.value.trim().toUpperCase();
				if (!code) {
					errorElement.textContent = 'Code is required';
					errorElement.classList.remove('hidden');
					return false;
				}
				if (!/^[A-Z0-9_]{2,20}$/.test(code)) {
					errorElement.textContent = 'Code must be 2-20 chars, uppercase, numbers, underscore only';
					errorElement.classList.remove('hidden');
					return false;
				}
				// Check if code already exists (built-in or custom)
				const allTasks = { ...utbmsCodes.tasks, ...(customCodes?.taskCodes || {}) };
				const allActivities = { ...utbmsCodes.activities, ...(customCodes?.activityCodes || {}) };
				if (code in allTasks || code in allActivities) {
					errorElement.textContent = 'Code already exists';
					errorElement.classList.remove('hidden');
					return false;
				}
				errorElement.classList.add('hidden');
				return true;
			}

			// Render entries
			function renderEntries(entries) {
				if (!entries || entries.length === 0) {
					entriesList.innerHTML = '<p class="empty-message">' + escapeHtml(l10n.noEntriesToday) + '</p>';
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
					html += '<button class="btn-delete" data-id="' + e.id + '" title="' + escapeHtml(l10n.deleteEntry) + '">✕</button>';
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
					html += '<div class="entry-description">' + escapeHtml(e.description || l10n.noDescription) + '</div>';
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

					case 'customCodes':
						customCodes = message.data;
						if (customCodes) {
							inheritBuiltInTasks.checked = customCodes.inheritBuiltIn !== false;
							inheritBuiltInActivities.checked = customCodes.inheritBuiltIn !== false;
						}
						renderCodesLists();
						break;

					case 'codeValidation':
						// Validation result handled inline
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
						// Error details are already presented in the webview and may contain confidential data.
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

			// Codes Management Modal
			manageCodesBtn.addEventListener('click', openCodesModal);
			closeCodesModal.addEventListener('click', closeCodesModalFn);
			codesModal.querySelector('.modal-overlay').addEventListener('click', closeCodesModalFn);

			// Tab switching
			document.querySelectorAll('.tab-btn').forEach(btn => {
				btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
			});

			// Inherit built-in checkboxes
			inheritBuiltInTasks.addEventListener('change', () => {
				vscode.postMessage({ type: 'setInheritBuiltIn', inherit: inheritBuiltInTasks.checked });
			});
			inheritBuiltInActivities.addEventListener('change', () => {
				vscode.postMessage({ type: 'setInheritBuiltIn', inherit: inheritBuiltInActivities.checked });
			});

			// Add task code
			newTaskCode.addEventListener('input', () => {
				newTaskCode.value = newTaskCode.value.toUpperCase();
				validateCodeInput(newTaskCode, newTaskCodeError);
			});
			addTaskCodeBtn.addEventListener('click', () => {
				const code = newTaskCode.value.trim().toUpperCase();
				const desc = newTaskDesc.value.trim();
				if (validateCodeInput(newTaskCode, newTaskCodeError) && desc) {
					vscode.postMessage({ type: 'addTaskCode', code: code, description: desc });
					newTaskCode.value = '';
					newTaskDesc.value = '';
				} else if (!desc) {
					newTaskCodeError.textContent = 'Description is required';
					newTaskCodeError.classList.remove('hidden');
				}
			});

			// Add activity code
			newActivityCode.addEventListener('input', () => {
				newActivityCode.value = newActivityCode.value.toUpperCase();
				validateCodeInput(newActivityCode, newActivityCodeError);
			});
			addActivityCodeBtn.addEventListener('click', () => {
				const code = newActivityCode.value.trim().toUpperCase();
				const desc = newActivityDesc.value.trim();
				if (validateCodeInput(newActivityCode, newActivityCodeError) && desc) {
					vscode.postMessage({ type: 'addActivityCode', code: code, description: desc });
					newActivityCode.value = '';
					newActivityDesc.value = '';
				} else if (!desc) {
					newActivityCodeError.textContent = 'Description is required';
					newActivityCodeError.classList.remove('hidden');
				}
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
