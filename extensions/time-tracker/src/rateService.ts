/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker - Rate Service
 *  Billing rate management
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { StorageService } from './storageService';
import type { BillingRate } from './types';

export class RateService {
	constructor(private readonly storageService: StorageService) { }

	async createRate(): Promise<BillingRate | undefined> {
		const name = await vscode.window.showInputBox({
			prompt: 'Enter rate name',
			placeHolder: 'e.g., Partner, Associate, Paralegal',
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return 'Rate name is required';
				}
				return null;
			}
		});

		if (!name) return undefined;

		const hourlyRateStr = await vscode.window.showInputBox({
			prompt: 'Enter hourly rate',
			placeHolder: 'e.g., 250.00',
			validateInput: (value) => {
				if (!value || isNaN(parseFloat(value))) {
					return 'Hourly rate must be a valid number';
				}
				if (parseFloat(value) < 0) {
					return 'Hourly rate cannot be negative';
				}
				return null;
			}
		});

		if (!hourlyRateStr) return undefined;

		const hourlyRate = parseFloat(hourlyRateStr);

		const existingRates = this.storageService.getRates();
		let isDefault = false;

		if (existingRates.length === 0) {
			isDefault = true;
		} else {
			const makeDefault = await vscode.window.showQuickPick(
				[
					{ label: 'Yes', value: true },
					{ label: 'No', value: false }
				],
				{ placeHolder: 'Make this the default rate?' }
			);
			isDefault = makeDefault?.value || false;
		}

		return this.storageService.createRate(name.trim(), hourlyRate, isDefault);
	}

	async selectRate(): Promise<BillingRate | undefined> {
		const rates = this.storageService.getRates();

		if (rates.length === 0) {
			const createNew = await vscode.window.showInformationMessage(
				'No billing rates found. Would you like to create one?',
				'Create Rate',
				'Cancel'
			);

			if (createNew === 'Create Rate') {
				return this.createRate();
			}
			return undefined;
		}

		const items = rates.map(r => ({
			label: r.name,
			description: `$${r.hourly_rate.toFixed(2)}/hr`,
			detail: r.is_default ? '(Default)' : undefined,
			rate: r
		}));

		// Add option to create new
		items.push({
			label: '$(add) Create New Rate',
			description: '',
			detail: undefined,
			rate: undefined as unknown as BillingRate
		});

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select a billing rate',
			matchOnDescription: true
		});

		if (!selected) return undefined;

		if (!selected.rate) {
			return this.createRate();
		}

		return selected.rate;
	}

	getRates(): BillingRate[] {
		return this.storageService.getRates();
	}

	getRateById(id: number): BillingRate | undefined {
		return this.storageService.getRateById(id);
	}

	getDefaultRate(): BillingRate | undefined {
		return this.storageService.getDefaultRate();
	}

	updateRate(id: number, updates: Partial<BillingRate>): BillingRate | undefined {
		return this.storageService.updateRate(id, updates);
	}

	deleteRate(id: number): void {
		this.storageService.deleteRate(id);
	}

	async manageRate(rate: BillingRate): Promise<void> {
		const actions = [
			{ label: 'Edit', value: 'edit' },
			{ label: rate.is_default ? 'Remove Default' : 'Set as Default', value: 'default' },
			{ label: 'Delete', value: 'delete' }
		];

		const action = await vscode.window.showQuickPick(actions, {
			placeHolder: `Manage: ${rate.name} ($${rate.hourly_rate.toFixed(2)}/hr)`
		});

		if (!action) return;

		switch (action.value) {
			case 'edit':
				await this.editRate(rate);
				break;
			case 'default':
				this.storageService.updateRate(rate.id, { is_default: rate.is_default ? 0 : 1 });
				vscode.window.showInformationMessage(
					rate.is_default
						? `Removed default from: ${rate.name}`
						: `Set as default: ${rate.name}`
				);
				break;
			case 'delete':
				const confirm = await vscode.window.showWarningMessage(
					`Are you sure you want to delete the rate "${rate.name}"?`,
					'Delete',
					'Cancel'
				);
				if (confirm === 'Delete') {
					this.storageService.deleteRate(rate.id);
					vscode.window.showInformationMessage(`Deleted rate: ${rate.name}`);
				}
				break;
		}
	}

	private async editRate(rate: BillingRate): Promise<void> {
		const name = await vscode.window.showInputBox({
			prompt: 'Edit rate name',
			value: rate.name
		});

		if (name === undefined) return;

		const hourlyRateStr = await vscode.window.showInputBox({
			prompt: 'Edit hourly rate',
			value: rate.hourly_rate.toString(),
			validateInput: (value) => {
				if (!value || isNaN(parseFloat(value))) {
					return 'Hourly rate must be a valid number';
				}
				if (parseFloat(value) < 0) {
					return 'Hourly rate cannot be negative';
				}
				return null;
			}
		});

		if (hourlyRateStr === undefined) return;

		this.storageService.updateRate(rate.id, {
			name: name.trim() || rate.name,
			hourly_rate: parseFloat(hourlyRateStr)
		});

		vscode.window.showInformationMessage(`Updated rate: ${name || rate.name}`);
	}
}
