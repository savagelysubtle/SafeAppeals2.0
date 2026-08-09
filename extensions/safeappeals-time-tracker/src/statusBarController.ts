/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker - Status Bar Controller
 *  Status bar UI with live timer display
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { MatterService } from './matterService';
import type { StorageService } from './storageService';
import type { TimeTrackerService } from './timeTrackerService';
import { formatDuration, formatTenths } from './timeTrackerService';

export class StatusBarController implements vscode.Disposable {
	private statusBarItem: vscode.StatusBarItem;
	private disposables: vscode.Disposable[] = [];

	constructor(
		private readonly timeTrackerService: TimeTrackerService,
		private readonly matterService: MatterService,
		private readonly storageService: StorageService
	) {
		// Create status bar item on the left side with high priority
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			100
		);

		this.statusBarItem.command = 'timeTracker.toggle';
		this.updateDisplay();
		this.statusBarItem.show();

		// Subscribe to timer state changes
		this.disposables.push(
			this.timeTrackerService.onStateChanged(() => this.updateDisplay())
		);
	}

	private updateDisplay(): void {
		const state = this.timeTrackerService.getState();

		if (state.isRunning) {
			// Timer is running
			const elapsed = formatDuration(state.elapsedMs);
			const tenths = this.timeTrackerService.getElapsedTenths();

			let matterText = '';
			if (state.currentMatterId) {
				const matter = this.matterService.getMatterById(state.currentMatterId);
				if (matter) {
					matterText = ` [${this.truncate(matter.matter_name, 15)}]`;
				}
			}

			this.statusBarItem.text = `$(clock) ${elapsed}${matterText}`;
			this.statusBarItem.backgroundColor = new vscode.ThemeColor(
				'statusBarItem.warningBackground'
			);

			// Build tooltip
			const tooltip = new vscode.MarkdownString();
			tooltip.appendMarkdown('**Timer Running**\n\n');
			tooltip.appendMarkdown(`- Elapsed: ${elapsed} (${formatTenths(tenths)})\n`);

			if (state.currentMatterId) {
				const matter = this.matterService.getMatterById(state.currentMatterId);
				if (matter) {
					tooltip.appendMarkdown(`- Matter: ${matter.matter_name}\n`);
					tooltip.appendMarkdown(`- Client: ${matter.client_name}\n`);
				}
			}

			if (state.currentUtbmsTask) {
				tooltip.appendMarkdown(`- Task: ${state.currentUtbmsTask}\n`);
			}

			if (state.currentUtbmsActivity) {
				tooltip.appendMarkdown(`- Activity: ${state.currentUtbmsActivity}\n`);
			}

			tooltip.appendMarkdown(`\n*Click to stop timer*`);
			this.statusBarItem.tooltip = tooltip;

		} else {
			// Timer is stopped
			const todayTotal = this.storageService.getTodayTotalHours();

			this.statusBarItem.text = `$(clock) ${formatTenths(todayTotal)} today`;
			this.statusBarItem.backgroundColor = undefined;

			const tooltip = new vscode.MarkdownString();
			tooltip.appendMarkdown('**Time Tracker**\n\n');
			tooltip.appendMarkdown(`- Today: ${formatTenths(todayTotal)}\n`);
			tooltip.appendMarkdown(`\n*Click to start timer*`);
			this.statusBarItem.tooltip = tooltip;
		}
	}

	private truncate(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength - 3) + '...';
	}

	dispose(): void {
		this.statusBarItem.dispose();
		this.disposables.forEach(d => d.dispose());
	}
}
