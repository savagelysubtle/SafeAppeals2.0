/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { registerAgentTools } from './agentTools';
import { runProfileSetup } from './profile';
import { openSampleCase } from './sampleCase';
import { takeTour } from './tour';
import { TimelinePanel, TimelineSidebarProvider } from './timelinePanel';
import { TimelineService } from './timelineService';

let timelineService: TimelineService | undefined;

export function activate(context: vscode.ExtensionContext): void {
	const folder = vscode.workspace.workspaceFolders?.[0];
	timelineService = new TimelineService(folder);
	context.subscriptions.push({ dispose: () => timelineService?.dispose() });

	const ensureService = (): TimelineService | undefined => {
		if (!timelineService && vscode.workspace.workspaceFolders?.[0]) {
			timelineService = new TimelineService(vscode.workspace.workspaceFolders[0]);
		}
		return timelineService;
	};

	const openTimelinePanel = async (): Promise<void> => {
		if (!vscode.workspace.workspaceFolders?.length) {
			vscode.window.showErrorMessage('Open a workspace folder to use the Case Timeline.');
			return;
		}
		const service = ensureService();
		if (service) {
			await service.loadTimeline();
		}
		TimelinePanel.show(context.extensionUri, () => timelineService);
	};

	const openTimelineEvent = async (eventId: string): Promise<void> => {
		if (!vscode.workspace.workspaceFolders?.length) {
			vscode.window.showErrorMessage('Open a workspace folder to use the Case Timeline.');
			return;
		}
		const service = ensureService();
		if (service) {
			await service.loadTimeline();
		}
		TimelinePanel.showAndSelectEvent(context.extensionUri, () => timelineService, eventId);
	};

	const sidebarProvider = new TimelineSidebarProvider(
		context.extensionUri,
		() => timelineService,
		() => { void openTimelinePanel(); },
		eventId => { void openTimelineEvent(eventId); },
	);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			TimelineSidebarProvider.viewType,
			sidebarProvider,
		),
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			timelineService?.dispose();
			timelineService = new TimelineService(vscode.workspace.workspaceFolders?.[0]);
			void TimelinePanel.refreshIfOpen();
			TimelineSidebarProvider.refreshIfResolved();
		}),
	);

	registerAgentTools(context, () => timelineService);

	context.subscriptions.push(
		vscode.commands.registerCommand('safeappeals-timeline.setupProfile', () => runProfileSetup()),
		vscode.commands.registerCommand('safeappeals-timeline.openSampleCase', () => openSampleCase(context)),
		vscode.commands.registerCommand('safeappeals-timeline.takeTour', () => takeTour()),
		vscode.commands.registerCommand('safeappeals-timeline.openTimeline', () => openTimelinePanel()),
	);

	// Soft deadline notifications when a timeline exists
	void (async () => {
		try {
			const loaded = await timelineService?.loadTimeline();
			if (!loaded?.notificationsEnabled) {
				return;
			}
			const overdue = timelineService?.getOverdueDeadlines() ?? [];
			const upcoming = timelineService?.getUpcomingDeadlines(7) ?? [];
			if (overdue.length > 0) {
				vscode.window.showWarningMessage(
					`Timeline: ${overdue.length} overdue deadline(s). Open Case Timeline to review.`,
					'Open Timeline',
				).then(choice => {
					if (choice === 'Open Timeline') {
						void vscode.commands.executeCommand('safeappeals-timeline.openTimeline');
					}
				});
			} else if (upcoming.length > 0) {
				vscode.window.showInformationMessage(
					`Timeline: ${upcoming.length} deadline(s) in the next 7 days.`,
					'Open Timeline',
				).then(choice => {
					if (choice === 'Open Timeline') {
						void vscode.commands.executeCommand('safeappeals-timeline.openTimeline');
					}
				});
			}
		} catch {
			// Non-fatal
		}
	})();
}

export function deactivate(): void {
	timelineService?.dispose();
	timelineService = undefined;
}
