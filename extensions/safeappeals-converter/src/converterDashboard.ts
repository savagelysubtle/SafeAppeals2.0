/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ConverterService } from './converterService';
import { unavailableConversionMessage } from './protocol';
import type { HostToWebviewMessage, WebviewToHostMessage } from './types';

/**
 * File converter dashboard webview (static bundle in media/dashboard/).
 */
export class ConverterDashboard {
	public static current: ConverterDashboard | undefined;
	public static readonly viewType = 'safeappeals-converter.dashboard';

	private readonly panel: vscode.WebviewPanel;
	private readonly disposables: vscode.Disposable[] = [];

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		private readonly service: ConverterService,
		_log: (message: string) => void,
	) {
		this.panel = panel;
		this.panel.webview.html = getDashboardHtml(this.panel.webview, extensionUri);
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.webview.onDidReceiveMessage(
			msg => void this.onMessage(msg as WebviewToHostMessage),
			null,
			this.disposables,
		);
		this.disposables.push(
			service.onProgress(event => {
				this.postMessage({
					type: 'progress',
					jobId: event.jobId,
					progress: event.progress,
					message: event.message,
				});
			}),
			service.onConversionsChanged(conversions => {
				this.postMessage({ type: 'conversionsUpdated', conversions });
			}),
		);
	}

	static show(
		extensionUri: vscode.Uri,
		service: ConverterService,
		log: (message: string) => void,
	): ConverterDashboard {
		const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
		if (ConverterDashboard.current) {
			ConverterDashboard.current.panel.reveal(column);
			void ConverterDashboard.current.postBootstrap();
			return ConverterDashboard.current;
		}
		const panel = vscode.window.createWebviewPanel(
			ConverterDashboard.viewType,
			vscode.l10n.t('File Converter'),
			column,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(extensionUri, 'media', 'dashboard'),
					extensionUri,
				],
			},
		);
		ConverterDashboard.current = new ConverterDashboard(panel, extensionUri, service, log);
		void ConverterDashboard.current.postBootstrap();
		return ConverterDashboard.current;
	}

	private async postBootstrap(): Promise<void> {
		let sidecarError: string | undefined;
		if (!this.service.isSidecarAvailable) {
			sidecarError = vscode.l10n.t(
				'sa-converter not found. Build rust/converter or set SAFEAPPEALS_CONVERTER_PATH.',
			);
		}
		let conversions = this.service.getAvailableConversions();
		if (this.service.isSidecarAvailable) {
			try {
				conversions = await this.service.refreshAvailableConversions();
			} catch (err) {
				sidecarError = err instanceof Error ? err.message : String(err);
			}
		}
		this.postMessage({
			type: 'bootstrap',
			conversions,
			sidecarReady: this.service.isSidecarAvailable && !sidecarError,
			sidecarError,
		});
	}

	private postMessage(message: HostToWebviewMessage): void {
		void this.panel.webview.postMessage(message);
	}

	private async onMessage(message: WebviewToHostMessage): Promise<void> {
		switch (message.type) {
			case 'ready':
				await this.postBootstrap();
				return;
			case 'pickInput':
				await this.pickFile('input');
				return;
			case 'pickOutput':
				await this.pickSave('output');
				return;
			case 'pickBatchInputs':
				await this.pickMultiple('batchInputs');
				return;
			case 'pickMergeInputs':
				await this.pickMultiple('mergeInputs', { PDF: ['pdf'] });
				return;
			case 'pickMergeOutput':
				await this.pickSave('mergeOutput', { PDF: ['pdf'] });
				return;
			case 'convert':
				await this.runConvert(message.conversionKey, message.input, message.output);
				return;
			case 'batchConvert':
				await this.runBatch(message.conversionKey, message.inputs, message.outputDir);
				return;
			case 'mergePdfs':
				await this.runMerge(message.inputs, message.output);
				return;
		}
	}

	private async pickFile(field: 'input'): Promise<void> {
		const uris = await vscode.window.showOpenDialog({
			canSelectMany: false,
			openLabel: vscode.l10n.t('Select Input File'),
		});
		if (uris?.[0]) {
			this.postMessage({ type: 'paths', [field]: uris[0].fsPath });
		}
	}

	private async pickSave(
		field: 'output' | 'mergeOutput',
		filters?: { [name: string]: string[] },
	): Promise<void> {
		const uri = await vscode.window.showSaveDialog({
			saveLabel: vscode.l10n.t('Select Output File'),
			filters,
		});
		if (uri) {
			this.postMessage({ type: 'paths', [field]: uri.fsPath });
		}
	}

	private async pickMultiple(
		field: 'batchInputs' | 'mergeInputs',
		filters?: { [name: string]: string[] },
	): Promise<void> {
		const uris = await vscode.window.showOpenDialog({
			canSelectMany: true,
			openLabel: vscode.l10n.t('Select Files'),
			filters,
		});
		if (uris?.length) {
			this.postMessage({ type: 'paths', [field]: uris.map(u => u.fsPath) });
		}
	}

	private conversionAvailabilityError(conversionKey: string): string | undefined {
		return unavailableConversionMessage(conversionKey, this.service.getAvailableConversions());
	}

	private async runConvert(conversionKey: string, input: string, output: string): Promise<void> {
		const availabilityError = this.conversionAvailabilityError(conversionKey);
		if (availabilityError) {
			this.postMessage({ type: 'result', success: false, message: availabilityError });
			return;
		}
		this.postMessage({ type: 'progress', jobId: 'convert', progress: 0, message: vscode.l10n.t('Starting conversion…') });
		const result = await this.service.convert({ input, output, type: conversionKey });
		if (result.success) {
			this.postMessage({
				type: 'result',
				success: true,
				message: vscode.l10n.t('Conversion completed in {0} ms.', String(result.duration_ms ?? 0)),
				outputPath: result.output_path,
			});
		} else {
			this.postMessage({
				type: 'result',
				success: false,
				message: result.error ?? vscode.l10n.t('Conversion failed.'),
			});
		}
	}

	private async runBatch(conversionKey: string, inputs: string[], outputDir?: string): Promise<void> {
		const availabilityError = this.conversionAvailabilityError(conversionKey);
		if (availabilityError) {
			this.postMessage({ type: 'result', success: false, message: availabilityError });
			return;
		}
		this.postMessage({ type: 'progress', jobId: 'batch', progress: 0, message: vscode.l10n.t('Starting batch conversion…') });
		const result = await this.service.batchConvert({ inputs, type: conversionKey, output_dir: outputDir });
		const okCount = result.results.filter(r => r.success).length;
		this.postMessage({
			type: 'result',
			success: result.success,
			message: result.success
				? vscode.l10n.t('Batch completed: {0}/{1} succeeded.', String(okCount), String(result.results.length))
				: result.error ?? vscode.l10n.t('Batch conversion failed.'),
		});
	}

	private async runMerge(inputs: string[], output: string): Promise<void> {
		const availabilityError = this.conversionAvailabilityError('merge_pdfs');
		if (availabilityError) {
			this.postMessage({ type: 'result', success: false, message: availabilityError });
			return;
		}
		this.postMessage({ type: 'progress', jobId: 'merge', progress: 0, message: vscode.l10n.t('Merging PDFs…') });
		const result = await this.service.mergePdfs({ inputs, output });
		this.postMessage({
			type: 'result',
			success: result.success,
			message: result.success
				? vscode.l10n.t('Merged {0} PDFs.', String(inputs.length))
				: result.error ?? vscode.l10n.t('Merge failed.'),
			outputPath: result.output_path,
		});
	}

	dispose(): void {
		ConverterDashboard.current = undefined;
		while (this.disposables.length) {
			this.disposables.pop()?.dispose();
		}
		this.panel.dispose();
	}
}

function getDashboardHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'dashboard', 'dashboard.js'));
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'dashboard', 'dashboard.css'));
	const cspSource = webview.cspSource;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource}; script-src ${cspSource};">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="${styleUri}" rel="stylesheet">
	<title>File Converter</title>
</head>
<body>
	<div class="container">
		<header>
			<h1>File Converter</h1>
			<p class="subtitle">Convert documents within your workspace using sa-converter.</p>
		</header>
		<div id="sidecar-status" class="status-banner hidden"></div>
		<section class="panel">
			<h2>Single Conversion</h2>
			<label for="conversion-select">Conversion</label>
			<select id="conversion-select"></select>
			<div id="fidelity-badge" class="badge hidden"></div>
			<div id="install-guidance" class="guidance hidden"></div>
			<div class="path-row">
				<label>Input</label>
				<input id="input-path" type="text" readonly placeholder="Pick an input file…">
				<button id="pick-input" type="button">Browse…</button>
			</div>
			<div class="path-row">
				<label>Output</label>
				<input id="output-path" type="text" readonly placeholder="Pick an output file…">
				<button id="pick-output" type="button">Browse…</button>
			</div>
			<button id="start-convert" type="button" class="primary" disabled>Start</button>
		</section>
		<section class="panel">
			<h2>Batch Conversion</h2>
			<label for="batch-conversion-select">Conversion</label>
			<select id="batch-conversion-select"></select>
			<div class="path-row">
				<label>Inputs</label>
				<input id="batch-inputs" type="text" readonly placeholder="Pick input files…">
				<button id="pick-batch" type="button">Browse…</button>
			</div>
			<button id="start-batch" type="button" disabled>Start Batch</button>
		</section>
		<section class="panel">
			<h2>Merge PDFs</h2>
			<div class="path-row">
				<label>Inputs</label>
				<input id="merge-inputs" type="text" readonly placeholder="Pick PDF files…">
				<button id="pick-merge-inputs" type="button">Browse…</button>
			</div>
			<div class="path-row">
				<label>Output</label>
				<input id="merge-output" type="text" readonly placeholder="Pick output PDF…">
				<button id="pick-merge-output" type="button">Browse…</button>
			</div>
			<button id="start-merge" type="button" disabled>Merge</button>
		</section>
		<section id="progress-section" class="panel hidden">
			<h2>Progress</h2>
			<div class="progress-bar"><div id="progress-fill"></div></div>
			<p id="progress-message"></p>
		</section>
		<section id="result-section" class="panel hidden">
			<h2>Result</h2>
			<p id="result-message"></p>
		</section>
	</div>
	<script src="${scriptUri}"></script>
</body>
</html>`;
}
