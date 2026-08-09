/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { registerAgentTools } from './agentTools';
import { ConverterDashboard } from './converterDashboard';
import { ConverterSidebarProvider } from './converterSidebar';
import { ConverterService } from './converterService';
import { getConversionSpec } from './protocol';
import { getConversionTargetsForExtension, localizeFidelityLabel, type ConversionTarget } from './conversionMap';
import { PageRangeError, parseOptionalPageRanges, parsePageRanges } from './pageRanges';
import { findSmartOutputPath } from './smartConvertPath';

let converterService: ConverterService | undefined;
let outputChannel: vscode.OutputChannel | undefined;

/** Activate exports for sibling extensions (e.g. safeappeals-rag digital PDF extract). */
export interface SafeAppealsConverterApi {
	getConverterService(): ConverterService | undefined;
}

export function getConverterService(): ConverterService | undefined {
	return converterService;
}

function log(message: string): void {
	outputChannel?.appendLine(message);
}

export function activate(context: vscode.ExtensionContext): SafeAppealsConverterApi {
	outputChannel = vscode.window.createOutputChannel('Safe Appeals Converter');
	converterService = new ConverterService(context.extensionPath, log);
	context.subscriptions.push(converterService, outputChannel);

	void converterService.initialize().catch(err => {
		log(`Converter initialization failed: ${err instanceof Error ? err.message : String(err)}`);
		ConverterSidebarProvider.refreshIfResolved();
	});

	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			void converterService?.configureFromWorkspace()
				.then(() => ConverterSidebarProvider.refreshIfResolved())
				.catch(e => log(String(e)));
		}),
	);

	registerAgentTools(context, () => converterService);

	const openDashboard = (): void => {
		if (!converterService) {
			return;
		}
		ConverterDashboard.show(context.extensionUri, converterService, log);
	};

	const sidebarProvider = new ConverterSidebarProvider(
		context.extensionUri,
		() => converterService,
		openDashboard,
	);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ConverterSidebarProvider.viewType,
			sidebarProvider,
		),
		vscode.commands.registerCommand('safeappeals-converter.openDashboard', openDashboard),
		vscode.commands.registerCommand('safeappeals-converter.smartConvert', async (uri?: vscode.Uri) => {
			await runSmartConvertCommand(context, uri);
		}),
		vscode.commands.registerCommand('safeappeals-converter.convertFile', async (uri?: vscode.Uri) => {
			await runConvertFileCommand(context, uri);
		}),
		vscode.commands.registerCommand('safeappeals-converter.mergePdfs', async () => {
			await runMergePdfsCommand(context);
		}),
		vscode.commands.registerCommand('safeappeals-converter.mergePdfsByPage', async () => {
			await runMergePdfsByPageCommand(context);
		}),
	);

	return { getConverterService };
}

export function deactivate(): void {
	converterService = undefined;
	outputChannel = undefined;
}

async function runConvertFileCommand(context: vscode.ExtensionContext, uri?: vscode.Uri): Promise<void> {
	if (!converterService) {
		return;
	}
	const folders = vscode.workspace.workspaceFolders;
	if (!folders?.length) {
		void vscode.window.showWarningMessage(vscode.l10n.t('Open a workspace folder before converting files.'));
		return;
	}

	let inputUri = uri;
	if (!inputUri) {
		const picked = await vscode.window.showOpenDialog({ canSelectMany: false });
		inputUri = picked?.[0];
	}
	if (!inputUri) {
		return;
	}

	const available = converterService.getAvailableConversions();
	const keys = Object.keys(available.conversions).filter(k => available.conversions[k].available);
	if (keys.length === 0) {
		void vscode.window.showWarningMessage(vscode.l10n.t('No conversions are available. Check sa-converter installation.'));
		return;
	}

	const pickedKey = await vscode.window.showQuickPick(
		keys.map(key => ({
			label: key,
			description: localizeFidelityLabel(available.conversions[key].fidelity),
			detail: available.conversions[key].engine,
		})),
		{ placeHolder: vscode.l10n.t('Select conversion type') },
	);
	if (!pickedKey) {
		return;
	}

	const outputUri = await vscode.window.showSaveDialog({
		saveLabel: vscode.l10n.t('Save Converted File As'),
	});
	if (!outputUri) {
		return;
	}

	const result = await converterService.convert({
		input: inputUri.fsPath,
		output: outputUri.fsPath,
		type: pickedKey.label,
	});
	if (result.success) {
		void vscode.window.showInformationMessage(
			vscode.l10n.t('Converted to {0}', result.output_path ?? outputUri.fsPath),
		);
	} else {
		void vscode.window.showErrorMessage(result.error ?? vscode.l10n.t('Conversion failed.'));
	}

	ConverterDashboard.show(context.extensionUri, converterService, log);
}

async function runMergePdfsCommand(context: vscode.ExtensionContext): Promise<void> {
	if (!converterService) {
		return;
	}
	const folders = vscode.workspace.workspaceFolders;
	if (!folders?.length) {
		void vscode.window.showWarningMessage(vscode.l10n.t('Open a workspace folder before merging PDFs.'));
		return;
	}

	const mergeSpec = getConversionSpec('merge_pdfs', converterService.getAvailableConversions());
	if (mergeSpec && !mergeSpec.available) {
		void vscode.window.showWarningMessage(
			mergeSpec.install_hint ?? vscode.l10n.t('PDF merge is not available.'),
		);
		return;
	}

	const inputs = await vscode.window.showOpenDialog({
		canSelectMany: true,
		filters: { PDF: ['pdf'] },
		openLabel: vscode.l10n.t('Select PDFs to Merge'),
	});
	if (!inputs?.length) {
		return;
	}

	const outputUri = await vscode.window.showSaveDialog({
		filters: { PDF: ['pdf'] },
		saveLabel: vscode.l10n.t('Save Merged PDF As'),
	});
	if (!outputUri) {
		return;
	}

	const result = await converterService.mergePdfs({
		inputs: inputs.map(u => u.fsPath),
		output: outputUri.fsPath,
	});
	if (result.success) {
		void vscode.window.showInformationMessage(vscode.l10n.t('Merged PDF saved to {0}', result.output_path ?? outputUri.fsPath));
	} else {
		void vscode.window.showErrorMessage(result.error ?? vscode.l10n.t('Merge failed.'));
	}

	ConverterDashboard.show(context.extensionUri, converterService, log);
}

async function runMergePdfsByPageCommand(context: vscode.ExtensionContext): Promise<void> {
	if (!converterService) {
		return;
	}
	const folders = vscode.workspace.workspaceFolders;
	if (!folders?.length) {
		void vscode.window.showWarningMessage(vscode.l10n.t('Open a workspace folder before merging PDFs by page.'));
		return;
	}

	const mergeByPageSpec = getConversionSpec('merge_pdfs_by_page', converterService.getAvailableConversions());
	if (mergeByPageSpec && !mergeByPageSpec.available) {
		void vscode.window.showWarningMessage(
			mergeByPageSpec.install_hint ?? vscode.l10n.t('PDF merge by page is not available.'),
		);
		return;
	}

	const inputs = await vscode.window.showOpenDialog({
		canSelectMany: true,
		filters: { PDF: ['pdf'] },
		openLabel: vscode.l10n.t('Select PDFs to Merge by Page'),
	});
	if (!inputs?.length) {
		return;
	}

	// For each selected PDF, ask which pages to include
	const mergeInputs: Array<{ path: string; pages: number[] }> = [];
	for (const uri of inputs) {
		const extracted = await converterService.extractPdfPages(uri.fsPath);
		if (!extracted.success || extracted.page_count === undefined) {
			void vscode.window.showErrorMessage(extracted.error ?? vscode.l10n.t('Could not determine the PDF page count.'));
			return;
		}
		const pageInput = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('Enter pages to include from {0} (e.g., 1-3,5,7-9)', uri.fsPath),
			placeHolder: vscode.l10n.t('For example: 1-3,5,7-9'),
			validateInput: (value) => {
				try {
					parsePageRanges(value, extracted.page_count);
					return undefined;
				} catch (error) {
					return pageRangeErrorMessage(error);
				}
			},
		});
		const pages = parseOptionalPageRanges(pageInput, extracted.page_count);
		if (!pages) {
			return; // User cancelled
		}
		mergeInputs.push({ path: uri.fsPath, pages });
	}

	const outputUri = await vscode.window.showSaveDialog({
		filters: { PDF: ['pdf'] },
		saveLabel: vscode.l10n.t('Save Merged PDF As'),
	});
	if (!outputUri) {
		return;
	}

	const result = await converterService.mergePdfsByPage({
		inputs: mergeInputs,
		output: outputUri.fsPath,
	});
	if (result.success) {
		void vscode.window.showInformationMessage(vscode.l10n.t('Merged PDF saved to {0}', result.output_path ?? outputUri.fsPath));
	} else {
		void vscode.window.showErrorMessage(result.error ?? vscode.l10n.t('Merge by page failed.'));
	}

	ConverterDashboard.show(context.extensionUri, converterService, log);
}

async function runSendForMergeCommand(context: vscode.ExtensionContext, uri?: vscode.Uri): Promise<void> {
	if (!converterService) {
		return;
	}
	const folders = vscode.workspace.workspaceFolders;
	if (!folders?.length) {
		void vscode.window.showWarningMessage(vscode.l10n.t('Open a workspace folder before merging PDFs.'));
		return;
	}

	// Open dashboard and pre-select the PDF for merging
	const dashboard = ConverterDashboard.show(context.extensionUri, converterService, log);

	// If a URI was provided (from context menu), send it to the dashboard
	if (uri) {
		// Give dashboard time to load, then send the file
		setTimeout(() => {
			dashboard.addToMerge(uri.fsPath);
		}, 300);
	}
}

async function runSmartConvertCommand(context: vscode.ExtensionContext, uri?: vscode.Uri): Promise<void> {
	if (!converterService) {
		return;
	}
	const folders = vscode.workspace.workspaceFolders;
	if (!folders?.length) {
		void vscode.window.showWarningMessage(vscode.l10n.t('Open a workspace folder before converting files.'));
		return;
	}

	let inputUri = uri;
	if (!inputUri) {
		const picked = await vscode.window.showOpenDialog({ canSelectMany: false });
		inputUri = picked?.[0];
	}
	if (!inputUri) {
		return;
	}

	const inputPath = inputUri.fsPath;
	const inputExtension = inputPath.includes('\\') ? (await import('node:path')).win32.extname(inputPath) : (await import('node:path')).posix.extname(inputPath);
	const ext = inputExtension.slice(1).toLowerCase();
	const available = converterService.getAvailableConversions();
	const targets = getConversionTargetsForExtension(ext, available);

	// Build quick pick items: conversion targets + "Send for merge" for PDFs
	type QuickPickItem = {
		label: string;
		description?: string;
		detail?: string;
		target?: ConversionTarget;
		action: 'convert' | 'sendForMerge';
	};

	const quickPickItems: QuickPickItem[] = targets.map(t => ({
		label: t.label,
		description: localizeFidelityLabel(t.fidelity),
		detail: t.installHint ?? undefined,
		target: t,
		action: 'convert' as const,
	}));

	// Add "Send for merge" option for PDF files
	if (ext === 'pdf') {
		quickPickItems.unshift({
			label: vscode.l10n.t('Send for Merge'),
			description: vscode.l10n.t('Add to Merge List'),
			detail: vscode.l10n.t('Open Converter dashboard and add this PDF to the merge inputs'),
			action: 'sendForMerge' as const,
		});
	}

	if (targets.length === 0 && ext !== 'pdf') {
		void vscode.window.showInformationMessage(
			vscode.l10n.t('No conversions available for .{0} files.', ext),
		);
		return;
	}

	const pickedTarget = await vscode.window.showQuickPick(
		quickPickItems,
		{
			placeHolder: vscode.l10n.t('Select target format or action'),
			matchOnDescription: true,
			matchOnDetail: true,
		},
	);
	if (!pickedTarget) {
		return;
	}

	// Handle "Send for merge" action
	if (pickedTarget.action === 'sendForMerge') {
		await runSendForMergeCommand(context, inputUri);
		return;
	}

	// At this point, pickedTarget.action === 'convert' and target is defined
	const target = pickedTarget.target!;

	if (target.installHint) {
		const proceed = await vscode.window.showWarningMessage(
			vscode.l10n.t('{0} Requires: {1}', target.label, target.installHint),
			{ modal: true },
			vscode.l10n.t('Proceed Anyway'),
		);
		if (proceed !== vscode.l10n.t('Proceed Anyway')) {
			return;
		}
	}

	// Auto-generate output path in same folder with new extension
	const outputPath = findSmartOutputPath(inputPath, target.ext);

	const result = await converterService.convert({
		input: inputPath,
		output: outputPath,
		type: target.key,
	});
	if (result.success) {
		void vscode.window.showInformationMessage(
			vscode.l10n.t('Converted to {0}', result.output_path ?? outputPath),
		);
	} else {
		void vscode.window.showErrorMessage(result.error ?? vscode.l10n.t('Conversion failed.'));
	}

	ConverterDashboard.show(context.extensionUri, converterService, log);
}

function pageRangeErrorMessage(error: unknown): string {
	if (!(error instanceof PageRangeError)) {
		return vscode.l10n.t('Invalid page selection.');
	}
	switch (error.code) {
		case 'empty': return vscode.l10n.t('At least one page must be specified.');
		case 'duplicate': return vscode.l10n.t('Page {0} is selected more than once.', error.value ?? '');
		case 'bounds': return vscode.l10n.t('Page {0} exceeds the PDF page count of {1}.', error.value ?? '', String(error.pageCount ?? ''));
		case 'format': return vscode.l10n.t('Invalid page or range: {0}', error.value ?? '');
		case 'order': return vscode.l10n.t('Page range must be in ascending order: {0}', error.value ?? '');
	}
}
