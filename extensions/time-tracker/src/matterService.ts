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
			prompt: 'Enter client name',
			placeHolder: 'e.g., Smith, John',
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return 'Client name is required';
				}
				return null;
			}
		});

		if (!clientName) return undefined;

		const matterName = await vscode.window.showInputBox({
			prompt: 'Enter matter name',
			placeHolder: 'e.g., Smith v. ABC Corp',
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return 'Matter name is required';
				}
				return null;
			}
		});

		if (!matterName) return undefined;

		const matterNumber = await vscode.window.showInputBox({
			prompt: 'Enter matter number (optional)',
			placeHolder: 'e.g., 2026-WC-001'
		});

		const defaultRateStr = await vscode.window.showInputBox({
			prompt: 'Enter default hourly rate (optional)',
			placeHolder: 'e.g., 250.00',
			validateInput: (value) => {
				if (value && isNaN(parseFloat(value))) {
					return 'Rate must be a number';
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
				'No matters found. Would you like to create one?',
				'Create Matter',
				'Cancel'
			);

			if (createNew === 'Create Matter') {
				return this.createMatter();
			}
			return undefined;
		}

		const items = matters.map(m => ({
			label: m.matter_name,
			description: m.client_name,
			detail: m.matter_number || undefined,
			matter: m
		}));

		// Add option to create new
		items.push({
			label: '$(add) Create New Matter',
			description: '',
			detail: undefined,
			matter: undefined as unknown as Matter
		});

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select a matter',
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
			{ label: 'Edit', value: 'edit' },
			{ label: 'Archive', value: 'archive' },
			{ label: 'Delete', value: 'delete' }
		], {
			placeHolder: `Manage: ${matter.matter_name}`
		});

		if (!action) return;

		switch (action.value) {
			case 'edit':
				await this.editMatter(matter);
				break;
			case 'archive':
				this.storageService.updateMatter(matter.id, { is_active: 0 });
				vscode.window.showInformationMessage(`Archived matter: ${matter.matter_name}`);
				break;
			case 'delete':
				const confirm = await vscode.window.showWarningMessage(
					`Are you sure you want to delete "${matter.matter_name}"? This will archive the matter and preserve existing time entries.`,
					'Delete',
					'Cancel'
				);
				if (confirm === 'Delete') {
					this.storageService.deleteMatter(matter.id);
					vscode.window.showInformationMessage(`Deleted matter: ${matter.matter_name}`);
				}
				break;
		}
	}

	private async editMatter(matter: Matter): Promise<void> {
		const clientName = await vscode.window.showInputBox({
			prompt: 'Edit client name',
			value: matter.client_name
		});

		if (clientName === undefined) return;

		const matterName = await vscode.window.showInputBox({
			prompt: 'Edit matter name',
			value: matter.matter_name
		});

		if (matterName === undefined) return;

		const matterNumber = await vscode.window.showInputBox({
			prompt: 'Edit matter number',
			value: matter.matter_number || ''
		});

		if (matterNumber === undefined) return;

		const defaultRateStr = await vscode.window.showInputBox({
			prompt: 'Edit default hourly rate',
			value: matter.default_rate?.toString() || ''
		});

		if (defaultRateStr === undefined) return;

		this.storageService.updateMatter(matter.id, {
			client_name: clientName.trim() || matter.client_name,
			matter_name: matterName.trim() || matter.matter_name,
			matter_number: matterNumber.trim() || null,
			default_rate: defaultRateStr ? parseFloat(defaultRateStr) : null
		});

		vscode.window.showInformationMessage(`Updated matter: ${matterName || matter.matter_name}`);
	}
}
