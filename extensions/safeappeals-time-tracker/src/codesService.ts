/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { CodeValidationResult, CustomUTBMSCodes, UTBMSCodes } from './types';
import type { SensitiveStateStore } from './sensitiveStateStore';
import { BUILTIN_ACTIVITIES, BUILTIN_TASKS } from './utbmsCodes';

const CONFIG_VERSION = 1;

export class CodesService {
	private readonly _onCodesChanged = new vscode.EventEmitter<UTBMSCodes>();
	readonly onCodesChanged = this._onCodesChanged.event;
	private cachedCodes: UTBMSCodes | null = null;

	constructor(private readonly stateStore: SensitiveStateStore) {}

	async loadCodes(): Promise<UTBMSCodes> {
		this.cachedCodes ??= this.mergeCodes(this.stateStore.getCustomCodes());
		return this.cachedCodes;
	}

	private mergeCodes(custom: CustomUTBMSCodes | undefined): UTBMSCodes {
		const tasks: Record<string, string> = custom?.inheritBuiltIn === false ? {} : { ...BUILTIN_TASKS };
		const activities: Record<string, string> = custom?.inheritBuiltIn === false ? {} : { ...BUILTIN_ACTIVITIES };
		if (custom) {
			Object.assign(tasks, custom.taskCodes);
			Object.assign(activities, custom.activityCodes);
		}
		return { tasks, activities };
	}

	private current(): CustomUTBMSCodes {
		return this.stateStore.getCustomCodes() ?? { version: CONFIG_VERSION, taskCodes: {}, activityCodes: {}, inheritBuiltIn: true };
	}

	async saveCustomCodes(custom: Partial<CustomUTBMSCodes>): Promise<void> {
		const existing = this.current();
		const updated: CustomUTBMSCodes = {
			version: CONFIG_VERSION,
			taskCodes: { ...existing.taskCodes, ...custom.taskCodes },
			activityCodes: { ...existing.activityCodes, ...custom.activityCodes },
			inheritBuiltIn: custom.inheritBuiltIn ?? existing.inheritBuiltIn,
		};
		await this.replaceCustomCodes(updated);
	}

	private async replaceCustomCodes(updated: CustomUTBMSCodes): Promise<void> {
		await this.stateStore.setCustomCodes(updated);
		this.cachedCodes = this.mergeCodes(updated);
		this._onCodesChanged.fire(this.cachedCodes);
	}

	async addTaskCode(code: string, description: string): Promise<void> {
		this.assertValid(code, description);
		const custom = this.current();
		if (code in BUILTIN_TASKS) { throw new Error(`Code "${code}" is a built-in task code and cannot be overridden`); }
		if (code in custom.taskCodes) { throw new Error(`Custom task code "${code}" already exists`); }
		await this.saveCustomCodes({ taskCodes: { ...custom.taskCodes, [code]: description } });
	}

	async addActivityCode(code: string, description: string): Promise<void> {
		this.assertValid(code, description);
		const custom = this.current();
		if (code in BUILTIN_ACTIVITIES) { throw new Error(`Code "${code}" is a built-in activity code and cannot be overridden`); }
		if (code in custom.activityCodes) { throw new Error(`Custom activity code "${code}" already exists`); }
		await this.saveCustomCodes({ activityCodes: { ...custom.activityCodes, [code]: description } });
	}

	async deleteTaskCode(code: string): Promise<void> {
		const custom = this.current();
		if (!(code in custom.taskCodes)) { throw new Error(`Custom task code "${code}" not found`); }
		const taskCodes = { ...custom.taskCodes };
		delete taskCodes[code];
		await this.replaceCustomCodes({ ...custom, taskCodes });
	}

	async deleteActivityCode(code: string): Promise<void> {
		const custom = this.current();
		if (!(code in custom.activityCodes)) { throw new Error(`Custom activity code "${code}" not found`); }
		const activityCodes = { ...custom.activityCodes };
		delete activityCodes[code];
		await this.replaceCustomCodes({ ...custom, activityCodes });
	}

	async setInheritBuiltIn(inheritBuiltIn: boolean): Promise<void> { await this.saveCustomCodes({ inheritBuiltIn }); }
	async getCustomCodes(): Promise<CustomUTBMSCodes | null> { return this.stateStore.getCustomCodes() ?? null; }

	validateCode(code: string, description: string): CodeValidationResult {
		if (!/^[A-Z0-9_]{2,20}$/.test(code)) { return { valid: false, error: 'Code must be 2-20 characters, uppercase letters, numbers, and underscores only' }; }
		if (!description.trim()) { return { valid: false, error: 'Description is required' }; }
		if (description.length > 200) { return { valid: false, error: 'Description must be 200 characters or less' }; }
		return { valid: true };
	}

	private assertValid(code: string, description: string): void {
		const result = this.validateCode(code, description);
		if (!result.valid) { throw new Error(result.error); }
	}

	isBuiltInTaskCode(code: string): boolean { return code in BUILTIN_TASKS; }
	isBuiltInActivityCode(code: string): boolean { return code in BUILTIN_ACTIVITIES; }
	isCustomTaskCode(code: string): boolean { return Object.hasOwn(this.current().taskCodes, code); }
	isCustomActivityCode(code: string): boolean { return Object.hasOwn(this.current().activityCodes, code); }
	getMergedCodes(): Promise<UTBMSCodes> { return this.loadCodes(); }

	async syncCustomCodesFromServer(authToken: string, apiUrl: string = 'https://api.safeappeals.com'): Promise<void> {
		try {
			const response = await fetch(`${apiUrl}/team-codes`, {
				headers: {
					'Authorization': `Bearer ${authToken}`,
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`Sync failed: ${response.statusText}`);
			}

			const data = (await response.json()) as { codes: Array<{ code: string; description: string; code_type: 'task' | 'activity' }> };
			if (data?.codes) {
				const currentConfig = this.current();
				const taskCodes = { ...currentConfig.taskCodes };
				const activityCodes = { ...currentConfig.activityCodes };

				for (const item of data.codes) {
					if (item.code_type === 'task') {
						taskCodes[item.code] = item.description;
					} else if (item.code_type === 'activity') {
						activityCodes[item.code] = item.description;
					}
				}

				const updated: CustomUTBMSCodes = {
					version: CONFIG_VERSION,
					taskCodes,
					activityCodes,
					inheritBuiltIn: currentConfig.inheritBuiltIn,
				};

				await this.replaceCustomCodes(updated);
			}
		} catch (err) {
			console.error('[TimeTracker] Failed to sync team codes:', err);
			throw err;
		}
	}

	dispose(): void { this._onCodesChanged.dispose(); }
}
