/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { TimeTrackerService } from './timeTrackerService';

export const SAFEAPPEALS_TIMER_GET_STATE_TOOL = 'safeappeals_timer_getState';
export const SAFEAPPEALS_TIMER_START_TOOL = 'safeappeals_timer_start';
export const SAFEAPPEALS_TIMER_STOP_TOOL = 'safeappeals_timer_stop';

interface TimerStartInput {
	description?: string;
	matterId?: number | null;
	rateId?: number | null;
	isBillable?: boolean;
}

function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

function formatState(service: TimeTrackerService): string {
	const state = service.getState();
	const elapsedSec = Math.floor(state.elapsedMs / 1000);
	return JSON.stringify({
		isRunning: state.isRunning,
		startTime: state.startTime,
		elapsedMs: state.elapsedMs,
		elapsedSeconds: elapsedSec,
		elapsedTenths: service.getElapsedTenths(),
		currentMatterId: state.currentMatterId,
		currentRateId: state.currentRateId,
		currentDescription: state.currentDescription,
		currentUtbmsTask: state.currentUtbmsTask,
		currentUtbmsActivity: state.currentUtbmsActivity,
		isBillable: state.isBillable,
	}, null, 2);
}

class TimerGetStateTool implements vscode.LanguageModelTool<Record<string, never>> {
	constructor(private readonly getService: () => TimeTrackerService | undefined) { }

	async invoke(
		_options: vscode.LanguageModelToolInvocationOptions<Record<string, never>>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const service = this.getService();
		if (!service) {
			return textResult('Error: Time Tracker is not initialized.');
		}
		return textResult(formatState(service));
	}
}

class TimerStartTool implements vscode.LanguageModelTool<TimerStartInput> {
	constructor(private readonly getService: () => TimeTrackerService | undefined) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<TimerStartInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const description = options.input?.description?.trim() || '(no description)';
		return {
			invocationMessage: `Starting timer: ${description}`,
			confirmationMessages: {
				title: 'Start Timer',
				message: `Start the legal time tracker with description:\n${description}`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<TimerStartInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const service = this.getService();
		if (!service) {
			return textResult('Error: Time Tracker is not initialized.');
		}
		const input = options.input ?? {};
		service.start(
			input.matterId ?? null,
			input.rateId ?? null,
			input.description?.trim() ?? '',
			null,
			null,
			input.isBillable !== false,
		);
		return textResult(`Timer started.\n${formatState(service)}`);
	}
}

class TimerStopTool implements vscode.LanguageModelTool<Record<string, never>> {
	constructor(private readonly getService: () => TimeTrackerService | undefined) { }

	async prepareInvocation(
		_options: vscode.LanguageModelToolInvocationPrepareOptions<Record<string, never>>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		return {
			invocationMessage: 'Stopping timer',
			confirmationMessages: {
				title: 'Stop Timer',
				message: 'Stop the running timer and save a time entry.',
			},
		};
	}

	async invoke(
		_options: vscode.LanguageModelToolInvocationOptions<Record<string, never>>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const service = this.getService();
		if (!service) {
			return textResult('Error: Time Tracker is not initialized.');
		}
		const before = service.getState();
		if (!before.isRunning) {
			return textResult('No timer is running.');
		}
		const entry = service.stop();
		if (!entry) {
			return textResult('Timer was not running.');
		}
		return textResult(
			`Timer stopped. Recorded ${entry.duration_tenths?.toFixed(1) ?? '0'} hours.\n` +
			`Entry id: ${entry.id}\nDescription: ${entry.description}`,
		);
	}
}

/**
 * Register LM tools for the legal time tracker.
 */
export function registerAgentTools(
	context: vscode.ExtensionContext,
	getService: () => TimeTrackerService | undefined,
): void {
	context.subscriptions.push(
		vscode.lm.registerTool(SAFEAPPEALS_TIMER_GET_STATE_TOOL, new TimerGetStateTool(getService)),
		vscode.lm.registerTool(SAFEAPPEALS_TIMER_START_TOOL, new TimerStartTool(getService)),
		vscode.lm.registerTool(SAFEAPPEALS_TIMER_STOP_TOOL, new TimerStopTool(getService)),
	);
}
