/*--------------------------------------------------------------------------------------
 *  Legal Time Tracker - Export Service
 *  CSV, JSON, and LEDES export functionality
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { generateLedesFile } from './ledesFormatter';
import type { StorageService } from './storageService';
import type { ExportOptions, ExportResult, TimeEntryWithDetails } from './types';

export class ExportService {
	constructor(private readonly storageService: StorageService) { }

	/**
	 * Export time entries to CSV format
	 */
	async exportToCSV(options: ExportOptions = {}): Promise<string | undefined> {
		const entries = this.storageService.getEntries(options);

		if (entries.length === 0) {
			vscode.window.showWarningMessage(vscode.l10n.t('No time entries to export.'));
			return undefined;
		}

		const csvContent = this.generateCSV(entries);
		return this.saveExport(csvContent, 'csv', 'CSV');
	}

	/**
	 * Export time entries to JSON format
	 */
	async exportToJSON(options: ExportOptions = {}): Promise<string | undefined> {
		const entries = this.storageService.getEntries(options);

		if (entries.length === 0) {
			vscode.window.showWarningMessage(vscode.l10n.t('No time entries to export.'));
			return undefined;
		}

		const workspaceName = vscode.workspace.name || vscode.l10n.t('workspace');
		const summary = this.calculateSummary(entries);

		const exportData: ExportResult = {
			workspace: workspaceName,
			exported_at: new Date().toISOString(),
			summary: {
				total_hours: summary.totalHours,
				billable_hours: summary.billableHours,
				total_value: summary.totalValue,
				entry_count: entries.length
			},
			entries: entries
		};

		const jsonContent = JSON.stringify(exportData, null, 2);
		return this.saveExport(jsonContent, 'json', 'JSON');
	}

	/**
	 * Export time entries to LEDES 1998B format
	 */
	async exportToLEDES(options: ExportOptions = {}): Promise<string | undefined> {
		const entries = this.storageService.getEntries(options);

		if (entries.length === 0) {
			vscode.window.showWarningMessage(vscode.l10n.t('No time entries to export.'));
			return undefined;
		}

		// Filter for entries with matters only (LEDES requires matter info)
		const entriesWithMatters = entries.filter(e => e.matter_id !== null);

		if (entriesWithMatters.length === 0) {
			vscode.window.showWarningMessage(
				vscode.l10n.t('No time entries with associated matters. LEDES export requires matter information.')
			);
			return undefined;
		}

		if (entriesWithMatters.length < entries.length) {
			vscode.window.showWarningMessage(
				vscode.l10n.t('{0} entries without matters were excluded from export.', entries.length - entriesWithMatters.length)
			);
		}

		const ledesContent = generateLedesFile(entriesWithMatters);
		return this.saveExport(ledesContent, 'txt', 'LEDES 1998B');
	}

	private generateCSV(entries: TimeEntryWithDetails[]): string {
		const headers = [
			'date',
			'client',
			'matter',
			'matter_number',
			'hours',
			'rate',
			'amount',
			'task_code',
			'activity_code',
			'description',
			'billable'
		];

		const rows = entries.map(entry => {
			const date = entry.start_time ? new Date(entry.start_time).toISOString().split('T')[0] : '';
			const hours = (entry.duration_tenths || 0).toFixed(1);
			const rate = (entry.hourly_rate || 0).toFixed(2);
			const amount = ((entry.duration_tenths || 0) * (entry.hourly_rate || 0)).toFixed(2);

			return [
				date,
				this.escapeCSV(entry.client_name || ''),
				this.escapeCSV(entry.matter_name || ''),
				this.escapeCSV(entry.matter_number || ''),
				hours,
				rate,
				amount,
				entry.utbms_task || '',
				entry.utbms_activity || '',
				this.escapeCSV(entry.description),
				entry.is_billable ? 'true' : 'false'
			].join(',');
		});

		return [headers.join(','), ...rows].join('\n');
	}

	private escapeCSV(value: string): string {
		if (value.includes(',') || value.includes('"') || value.includes('\n')) {
			return `"${value.replace(/"/g, '""')}"`;
		}
		return value;
	}

	private calculateSummary(entries: TimeEntryWithDetails[]): {
		totalHours: number;
		billableHours: number;
		totalValue: number;
	} {
		let totalHours = 0;
		let billableHours = 0;
		let totalValue = 0;

		for (const entry of entries) {
			const hours = entry.duration_tenths || 0;
			const rate = entry.hourly_rate || 0;

			totalHours += hours;

			if (entry.is_billable) {
				billableHours += hours;
				totalValue += hours * rate;
			}
		}

		return { totalHours, billableHours, totalValue };
	}

	private async saveExport(
		content: string,
		extension: string,
		formatName: string
	): Promise<string | undefined> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		const defaultPath = workspaceFolders?.[0]?.uri.fsPath || '';

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
		const defaultFileName = `time-export-${timestamp}.${extension}`;

		const uri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file(path.join(defaultPath, defaultFileName)),
			filters: {
				[formatName]: [extension]
			},
			title: vscode.l10n.t('Export to {0}', formatName)
		});

		if (!uri) return undefined;

		try {
			fs.writeFileSync(uri.fsPath, content, 'utf-8');
			vscode.window.showInformationMessage(vscode.l10n.t('Exported {0} to: {1}', formatName, uri.fsPath));
			return uri.fsPath;
		} catch (error) {
			vscode.window.showErrorMessage(vscode.l10n.t('Failed to export: {0}', error instanceof Error ? error.message : String(error)));
			return undefined;
		}
	}

	/**
	 * Quick export with date range picker
	 */
	async exportWithDateRange(format: 'csv' | 'json' | 'ledes'): Promise<string | undefined> {
		const range = await vscode.window.showQuickPick([
			{ label: vscode.l10n.t('Today'), value: 'today' },
			{ label: vscode.l10n.t('This Week'), value: 'week' },
			{ label: vscode.l10n.t('This Month'), value: 'month' },
			{ label: vscode.l10n.t('This Year'), value: 'year' },
			{ label: vscode.l10n.t('All Time'), value: 'all' },
			{ label: vscode.l10n.t('Custom Range...'), value: 'custom' }
		], {
			placeHolder: vscode.l10n.t('Select date range for export')
		});

		if (!range) return undefined;

		const options: ExportOptions = {};

		const now = new Date();
		switch (range.value) {
			case 'today':
				const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
				options.startDate = today.getTime();
				break;
			case 'week':
				const weekStart = new Date(now);
				weekStart.setDate(now.getDate() - now.getDay());
				weekStart.setHours(0, 0, 0, 0);
				options.startDate = weekStart.getTime();
				break;
			case 'month':
				const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
				options.startDate = monthStart.getTime();
				break;
			case 'year':
				const yearStart = new Date(now.getFullYear(), 0, 1);
				options.startDate = yearStart.getTime();
				break;
			case 'custom':
				const startStr = await vscode.window.showInputBox({
					prompt: vscode.l10n.t('Enter start date (YYYY-MM-DD)'),
					placeHolder: '2026-01-01',
					validateInput: (value) => {
						if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
							return vscode.l10n.t('Please enter date in YYYY-MM-DD format');
						}
						return null;
					}
				});
				if (!startStr) return undefined;

				const endStr = await vscode.window.showInputBox({
					prompt: vscode.l10n.t('Enter end date (YYYY-MM-DD)'),
					placeHolder: '2026-12-31',
					validateInput: (value) => {
						if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
							return vscode.l10n.t('Please enter date in YYYY-MM-DD format');
						}
						return null;
					}
				});
				if (!endStr) return undefined;

				options.startDate = new Date(startStr).getTime();
				options.endDate = new Date(endStr + 'T23:59:59').getTime();
				break;
		}

		switch (format) {
			case 'csv':
				return this.exportToCSV(options);
			case 'json':
				return this.exportToJSON(options);
			case 'ledes':
				return this.exportToLEDES(options);
		}
	}
}
