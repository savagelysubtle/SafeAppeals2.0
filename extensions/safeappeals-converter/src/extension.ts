/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { registerAgentTools } from './agentTools';
import { ConverterDashboard } from './converterDashboard';
import { ConverterSidebarProvider } from './converterSidebar';
import { ConverterService } from './converterService';
import { getConversionSpec } from './protocol';

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
		vscode.commands.registerCommand('safeappeals-converter.convertFile', async (uri?: vscode.Uri) => {
			await runConvertFileCommand(context, uri);
		}),
		vscode.commands.registerCommand('safeappeals-converter.mergePdfs', async () => {
			await runMergePdfsCommand(context);
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
			description: available.conversions[key].fidelity,
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
