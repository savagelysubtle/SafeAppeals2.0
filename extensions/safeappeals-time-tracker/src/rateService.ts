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
			prompt: vscode.l10n.t('Enter rate name'),
			placeHolder: vscode.l10n.t('e.g., Partner, Associate, Paralegal'),
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return vscode.l10n.t('Rate name is required');
				}
				return null;
			}
		});

		if (!name) return undefined;

		const hourlyRateStr = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('Enter hourly rate'),
			placeHolder: vscode.l10n.t('e.g., 250.00'),
			validateInput: (value) => {
				if (!value || isNaN(parseFloat(value))) {
					return vscode.l10n.t('Hourly rate must be a valid number');
				}
				if (parseFloat(value) < 0) {
					return vscode.l10n.t('Hourly rate cannot be negative');
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
					{ label: vscode.l10n.t('Yes'), value: true },
					{ label: vscode.l10n.t('No'), value: false }
				],
				{ placeHolder: vscode.l10n.t('Make this the default rate?') }
			);
			isDefault = makeDefault?.value || false;
		}

		return this.storageService.createRate(name.trim(), hourlyRate, isDefault);
	}

	async selectRate(): Promise<BillingRate | undefined> {
		const rates = this.storageService.getRates();

		if (rates.length === 0) {
			const createNew = await vscode.window.showInformationMessage(
				vscode.l10n.t('No billing rates found. Would you like to create one?'),
				vscode.l10n.t('Create Rate'),
				vscode.l10n.t('Cancel')
			);

			if (createNew === vscode.l10n.t('Create Rate')) {
				return this.createRate();
			}
			return undefined;
		}

		const items: { label: string; description: string; detail: string | undefined; rate: BillingRate | undefined }[] = rates.map(r => ({
			label: r.name,
			description: vscode.l10n.t('${0}/hr', r.hourly_rate.toFixed(2)),
			detail: r.is_default ? vscode.l10n.t('(Default)') : undefined,
			rate: r
		}));

		// Add option to create new
		items.push({
			label: vscode.l10n.t('$(add) Create New Rate'),
			description: '',
			detail: undefined,
			rate: undefined
		});

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: vscode.l10n.t('Select a billing rate'),
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
			{ label: vscode.l10n.t('Edit'), value: 'edit' },
			{ label: rate.is_default ? vscode.l10n.t('Remove Default') : vscode.l10n.t('Set as Default'), value: 'default' },
			{ label: vscode.l10n.t('Delete'), value: 'delete' }
		];

		const action = await vscode.window.showQuickPick(actions, {
			placeHolder: vscode.l10n.t('Manage: {0} (${1}/hr)', rate.name, rate.hourly_rate.toFixed(2))
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
						? vscode.l10n.t('Removed default from: {0}', rate.name)
						: vscode.l10n.t('Set as default: {0}', rate.name)
				);
				break;
			case 'delete':
				const confirm = await vscode.window.showWarningMessage(
					vscode.l10n.t('Are you sure you want to delete the rate "{0}"?', rate.name),
					vscode.l10n.t('Delete'),
					vscode.l10n.t('Cancel')
				);
				if (confirm === vscode.l10n.t('Delete')) {
					this.storageService.deleteRate(rate.id);
					vscode.window.showInformationMessage(vscode.l10n.t('Deleted rate: {0}', rate.name));
				}
				break;
		}
	}

	private async editRate(rate: BillingRate): Promise<void> {
		const name = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('Edit rate name'),
			value: rate.name
		});

		if (name === undefined) return;

		const hourlyRateStr = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('Edit hourly rate'),
			value: rate.hourly_rate.toString(),
			validateInput: (value) => {
				if (!value || isNaN(parseFloat(value))) {
					return vscode.l10n.t('Hourly rate must be a valid number');
				}
				if (parseFloat(value) < 0) {
					return vscode.l10n.t('Hourly rate cannot be negative');
				}
				return null;
			}
		});

		if (hourlyRateStr === undefined) return;

		this.storageService.updateRate(rate.id, {
			name: name.trim() || rate.name,
			hourly_rate: parseFloat(hourlyRateStr)
		});

		vscode.window.showInformationMessage(vscode.l10n.t('Updated rate: {0}', name || rate.name));
	}
}
