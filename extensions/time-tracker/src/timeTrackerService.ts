/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker - Time Tracker Service
 *  Core timer logic with 6-minute billing increments
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { StorageService } from './storageService';
import type { RoundingMode, TimeEntry, TimerState } from './types';

export class TimeTrackerService {
	private timerState: TimerState = {
		isRunning: false,
		startTime: null,
		currentMatterId: null,
		currentRateId: null,
		currentDescription: '',
		currentUtbmsTask: null,
		currentUtbmsActivity: null,
		isBillable: true
	};

	private updateInterval: NodeJS.Timeout | null = null;
	private _onStateChanged = new vscode.EventEmitter<TimerState & { elapsedMs: number }>();
	readonly onStateChanged = this._onStateChanged.event;

	constructor(
		private readonly storageService: StorageService,
		private readonly context: vscode.ExtensionContext
	) {
		// Restore any running timer from previous session
		this.restoreState();
	}

	private restoreState(): void {
		const savedState = this.context.workspaceState.get<TimerState>('timerState');
		if (savedState && savedState.isRunning && savedState.startTime) {
			this.timerState = savedState;
			this.startUpdateInterval();
		}
	}

	private persistState(): void {
		this.context.workspaceState.update('timerState', this.timerState);
	}

	getState(): TimerState & { elapsedMs: number } {
		return {
			...this.timerState,
			elapsedMs: this.getElapsedMs()
		};
	}

	getElapsedMs(): number {
		if (!this.timerState.isRunning || !this.timerState.startTime) {
			return 0;
		}
		return Date.now() - this.timerState.startTime;
	}

	getElapsedTenths(): number {
		return this.roundToTenths(this.getElapsedMs(), this.getRoundingMode());
	}

	private getRoundingMode(): RoundingMode {
		const config = vscode.workspace.getConfiguration('timeTracker');
		return config.get<RoundingMode>('defaultRoundingMode', 'up');
	}

	private getMinimumIncrement(): number {
		const config = vscode.workspace.getConfiguration('timeTracker');
		return config.get<number>('minimumIncrement', 0.1);
	}

	/**
	 * Round milliseconds to tenths of an hour (6-minute increments)
	 * This is standard legal billing practice
	 */
	roundToTenths(durationMs: number, mode: RoundingMode): number {
		const hours = durationMs / (1000 * 60 * 60);
		const tenths = hours * 10;
		const minimum = this.getMinimumIncrement();

		let rounded: number;
		switch (mode) {
			case 'up':
				rounded = Math.ceil(tenths) / 10;
				break;
			case 'down':
				rounded = Math.floor(tenths) / 10;
				break;
			case 'nearest':
				rounded = Math.round(tenths) / 10;
				break;
		}

		// Ensure minimum increment
		return Math.max(rounded, minimum);
	}

	start(
		matterId: number | null = null,
		rateId: number | null = null,
		description: string = '',
		utbmsTask: string | null = null,
		utbmsActivity: string | null = null,
		isBillable: boolean = true
	): TimerState {
		if (this.timerState.isRunning) {
			// Stop existing timer first
			this.stop();
		}

		this.timerState = {
			isRunning: true,
			startTime: Date.now(),
			currentMatterId: matterId,
			currentRateId: rateId,
			currentDescription: description,
			currentUtbmsTask: utbmsTask,
			currentUtbmsActivity: utbmsActivity,
			isBillable: isBillable
		};

		this.persistState();
		this.startUpdateInterval();
		this.emitState();

		return this.timerState;
	}

	stop(): TimeEntry | null {
		if (!this.timerState.isRunning || !this.timerState.startTime) {
			return null;
		}

		this.stopUpdateInterval();

		const endTime = Date.now();
		const durationMs = endTime - this.timerState.startTime;
		const durationTenths = this.roundToTenths(durationMs, this.getRoundingMode());

		// Create the time entry
		const entry = this.storageService.createEntry(
			this.timerState.startTime,
			endTime,
			durationTenths,
			this.timerState.currentDescription || 'No description',
			this.timerState.currentMatterId || undefined,
			this.timerState.currentRateId || undefined,
			this.timerState.currentUtbmsTask || undefined,
			this.timerState.currentUtbmsActivity || undefined,
			this.timerState.isBillable
		);

		// Reset timer state
		this.timerState = {
			isRunning: false,
			startTime: null,
			currentMatterId: null,
			currentRateId: null,
			currentDescription: '',
			currentUtbmsTask: null,
			currentUtbmsActivity: null,
			isBillable: true
		};

		this.persistState();
		this.emitState();

		return entry;
	}

	toggle(): { started: boolean; entry?: TimeEntry } {
		if (this.timerState.isRunning) {
			const entry = this.stop();
			return { started: false, entry: entry || undefined };
		} else {
			this.start();
			return { started: true };
		}
	}

	updateTimerState(updates: {
		description?: string;
		utbmsTask?: string | null;
		utbmsActivity?: string | null;
		isBillable?: boolean;
		matterId?: number | null;
		rateId?: number | null;
	}): void {
		if (updates.description !== undefined) {
			this.timerState.currentDescription = updates.description;
		}
		if (updates.utbmsTask !== undefined) {
			this.timerState.currentUtbmsTask = updates.utbmsTask;
		}
		if (updates.utbmsActivity !== undefined) {
			this.timerState.currentUtbmsActivity = updates.utbmsActivity;
		}
		if (updates.isBillable !== undefined) {
			this.timerState.isBillable = updates.isBillable;
		}
		if (updates.matterId !== undefined) {
			this.timerState.currentMatterId = updates.matterId;
		}
		if (updates.rateId !== undefined) {
			this.timerState.currentRateId = updates.rateId;
		}

		this.persistState();
		this.emitState();
	}

	private startUpdateInterval(): void {
		this.stopUpdateInterval();

		// Update every second for live display
		this.updateInterval = setInterval(() => {
			this.emitState();
		}, 1000);
	}

	private stopUpdateInterval(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
	}

	private emitState(): void {
		this._onStateChanged.fire(this.getState());
	}

	dispose(): void {
		this.stopUpdateInterval();
		this._onStateChanged.dispose();
	}
}

// Utility functions for formatting time
export function formatDuration(durationMs: number): string {
	const totalSeconds = Math.floor(durationMs / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatTenths(tenths: number): string {
	return `${tenths.toFixed(1)} hrs`;
}
