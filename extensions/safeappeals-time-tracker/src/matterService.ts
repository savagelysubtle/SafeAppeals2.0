/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker - Matter Service
 *  Case/matter management for time tracking
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { StorageService } from './storageService';
import type { Matter } from './types';

export class MatterService {
	constructor(private readonly storageService: StorageService) { }

	async createMatter(): Promise<Matter | undefined> {
		const clientName = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('Enter client name'),
			placeHolder: vscode.l10n.t('e.g., Smith, John'),
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return vscode.l10n.t('Client name is required');
				}
				return null;
			}
		});

		if (!clientName) return undefined;

		const matterName = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('Enter matter name'),
			placeHolder: vscode.l10n.t('e.g., Smith v. ABC Corp'),
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return vscode.l10n.t('Matter name is required');
				}
				return null;
			}
		});

		if (!matterName) return undefined;

		const matterNumber = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('Enter matter number (optional)'),
			placeHolder: vscode.l10n.t('e.g., 2026-WC-001')
		});

		const defaultRateStr = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('Enter default hourly rate (optional)'),
			placeHolder: vscode.l10n.t('e.g., 250.00'),
			validateInput: (value) => {
				if (value && isNaN(parseFloat(value))) {
					return vscode.l10n.t('Rate must be a number');
				}
				return null;
			}
		});

		const defaultRate = defaultRateStr ? parseFloat(defaultRateStr) : undefined;

		return this.storageService.createMatter(
			clientName.trim(),
			matterName.trim(),
			matterNumber?.trim(),
			defaultRate
		);
	}

	async selectMatter(): Promise<Matter | undefined> {
		const matters = this.storageService.getMatters(true);

		if (matters.length === 0) {
			const createNew = await vscode.window.showInformationMessage(
				vscode.l10n.t('No matters found. Would you like to create one?'),
				vscode.l10n.t('Create Matter'),
				vscode.l10n.t('Cancel')
			);

			if (createNew === vscode.l10n.t('Create Matter')) {
				return this.createMatter();
			}
			return undefined;
		}

		const items: { label: string; description: string; detail: string | undefined; matter: Matter | undefined }[] = matters.map(m => ({
			label: m.matter_name,
			description: m.client_name,
			detail: m.matter_number || undefined,
			matter: m
		}));

		// Add option to create new
		items.push({
			label: vscode.l10n.t('$(add) Create New Matter'),
			description: '',
			detail: undefined,
			matter: undefined
		});

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: vscode.l10n.t('Select a matter'),
			matchOnDescription: true,
			matchOnDetail: true
		});

		if (!selected) return undefined;

		if (!selected.matter) {
			return this.createMatter();
		}

		return selected.matter;
	}

	getMatters(activeOnly: boolean = true): Matter[] {
		return this.storageService.getMatters(activeOnly);
	}

	getMatterById(id: number): Matter | undefined {
		return this.storageService.getMatterById(id);
	}

	updateMatter(id: number, updates: Partial<Matter>): Matter | undefined {
		return this.storageService.updateMatter(id, updates);
	}

	deleteMatter(id: number): void {
		this.storageService.deleteMatter(id);
	}

	async manageMatter(matter: Matter): Promise<void> {
		const action = await vscode.window.showQuickPick([
			{ label: vscode.l10n.t('Edit'), value: 'edit' },
			{ label: vscode.l10n.t('Archive'), value: 'archive' },
			{ label: vscode.l10n.t('Delete'), value: 'delete' }
		], {
			placeHolder: vscode.l10n.t('Manage: {0}', matter.matter_name)
		});

		if (!action) return;

		switch (action.value) {
			case 'edit':
				await this.editMatter(matter);
				break;
			case 'archive':
				this.storageService.updateMatter(matter.id, { is_active: 0 });
				vscode.window.showInformationMessage(vscode.l10n.t('Archived matter: {0}', matter.matter_name));
				break;
			case 'delete':
				const confirm = await vscode.window.showWarningMessage(
					vscode.l10n.t('Are you sure you want to delete "{0}"? This will archive the matter and preserve existing time entries.', matter.matter_name),
					vscode.l10n.t('Delete'),
					vscode.l10n.t('Cancel')
				);
				if (confirm === vscode.l10n.t('Delete')) {
					this.storageService.deleteMatter(matter.id);
					vscode.window.showInformationMessage(vscode.l10n.t('Deleted matter: {0}', matter.matter_name));
				}
				break;
		}
	}

	private async editMatter(matter: Matter): Promise<void> {
		const clientName = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('Edit client name'),
			value: matter.client_name
		});

		if (clientName === undefined) return;

		const matterName = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('Edit matter name'),
			value: matter.matter_name
		});

		if (matterName === undefined) return;

		const matterNumber = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('Edit matter number'),
			value: matter.matter_number || ''
		});

		if (matterNumber === undefined) return;

		const defaultRateStr = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('Edit default hourly rate'),
			value: matter.default_rate?.toString() || ''
		});

		if (defaultRateStr === undefined) return;

		this.storageService.updateMatter(matter.id, {
			client_name: clientName.trim() || matter.client_name,
			matter_name: matterName.trim() || matter.matter_name,
			matter_number: matterNumber.trim() || null,
			default_rate: defaultRateStr ? parseFloat(defaultRateStr) : null
		});

		vscode.window.showInformationMessage(vscode.l10n.t('Updated matter: {0}', matterName || matter.matter_name));
	}
}
