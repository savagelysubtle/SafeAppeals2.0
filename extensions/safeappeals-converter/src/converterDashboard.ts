/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ConverterService } from './converterService';
import { unavailableConversionMessage } from './protocol';
import { PageRangeError, parseOptionalPageRanges, parsePageRanges } from './pageRanges';
import { getPathDisplayName } from './smartConvertPath';
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
			uiStrings: {
				fidelityOffice: vscode.l10n.t('Office Fidelity'),
				fidelitySemantic: vscode.l10n.t('Semantic'),
				fidelityBrowserPrint: vscode.l10n.t('Browser Print'),
				fidelityPreviewFast: vscode.l10n.t('Fast Preview'),
				fidelityPdfOperations: vscode.l10n.t('PDF Operations'),
				fidelityOcr: vscode.l10n.t('OCR'),
				rangeInvalid: vscode.l10n.t('Invalid page selection.'),
				rangeEmpty: vscode.l10n.t('At least one page must be specified.'),
				rangeDuplicate: vscode.l10n.t('Page {0} is selected more than once.'),
				rangeBounds: vscode.l10n.t('Page {0} exceeds the PDF page count of {1}.'),
				rangeFormat: vscode.l10n.t('Invalid page or range: {0}'),
				rangeOrder: vscode.l10n.t('Page range must be in ascending order: {0}'),
				mergingByPage: vscode.l10n.t('Merging by page…'),
				noPdfsSelected: vscode.l10n.t('No PDFs selected. Select Browse PDFs to add files.'),
				pageExample: vscode.l10n.t('For example: 1-3,5,7-9'),
				pagesFor: vscode.l10n.t('Pages for {0}'),
				remove: vscode.l10n.t('Remove {0}'),
				starting: vscode.l10n.t('Starting…'),
				startingBatch: vscode.l10n.t('Starting batch…'),
				merging: vscode.l10n.t('Merging…'),
				sidecarUnavailable: vscode.l10n.t('sa-converter sidecar is not available.'),
				unavailable: vscode.l10n.t('{0} (unavailable)'),
				additionalSoftware: vscode.l10n.t('This conversion requires additional software.'),
				mergeByPageTitle: vscode.l10n.t('Merge PDFs by Page'),
				inputs: vscode.l10n.t('Inputs'),
				browsePdfs: vscode.l10n.t('Browse PDFs…'),
				output: vscode.l10n.t('Output'),
				pickOutputPdf: vscode.l10n.t('Pick output PDF…'),
				browse: vscode.l10n.t('Browse…'),
				mergeByPageAction: vscode.l10n.t('Merge by Page'),
				dashboardTitle: vscode.l10n.t('File Converter'),
				dashboardSubtitle: vscode.l10n.t('Convert documents within your workspace using sa-converter.'),
				singleConversion: vscode.l10n.t('Single Conversion'),
				conversion: vscode.l10n.t('Conversion'),
				input: vscode.l10n.t('Input'),
				pickInputFile: vscode.l10n.t('Pick an input file…'),
				pickOutputFile: vscode.l10n.t('Pick an output file…'),
				start: vscode.l10n.t('Start'),
				batchConversion: vscode.l10n.t('Batch Conversion'),
				pickInputFiles: vscode.l10n.t('Pick input files…'),
				startBatch: vscode.l10n.t('Start Batch'),
				mergePdfs: vscode.l10n.t('Merge PDFs'),
				pickPdfFiles: vscode.l10n.t('Pick PDF files…'),
				merge: vscode.l10n.t('Merge'),
				progress: vscode.l10n.t('Progress'),
				result: vscode.l10n.t('Result'),
			},
		});
	}

	private postMessage(message: HostToWebviewMessage): void {
		void this.panel.webview.postMessage(message);
	}

	/** Add a PDF file to the merge list from external trigger (e.g., context menu). */
	addToMerge(path: string): void {
		this.postMessage({ type: 'addToMerge', path });
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
			case 'pickMergeByPageInputs':
				await this.pickMergeByPageInputs();
				return;
			case 'pickMergeByPageOutput':
				await this.pickSave('mergeByPageOutput', { PDF: ['pdf'] });
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
			case 'mergePdfsByPage':
				await this.runMergeByPage(message.inputs, message.output);
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
		field: 'output' | 'mergeOutput' | 'mergeByPageOutput',
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

	private async pickMergeByPageInputs(): Promise<void> {
		const uris = await vscode.window.showOpenDialog({
			canSelectMany: true,
			openLabel: vscode.l10n.t('Select PDF Files for Page Merge'),
			filters: { PDF: ['pdf'] },
		});
		if (!uris?.length) {
			return;
		}
		// For each selected PDF, ask which pages to include
		const inputs: Array<{ path: string; pages: number[]; pageCount: number }> = [];
		for (const uri of uris) {
			const extracted = await this.service.extractPdfPages(uri.fsPath);
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
			inputs.push({ path: uri.fsPath, pages, pageCount: extracted.page_count });
		}
		this.postMessage({
			type: 'paths',
			mergeByPageInputs: inputs.map(item => ({ ...item, displayName: getPathDisplayName(item.path) })),
		});
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

	private async runMergeByPage(inputs: Array<{ path: string; pages: number[] }>, output: string): Promise<void> {
		const availabilityError = this.conversionAvailabilityError('merge_pdfs_by_page');
		if (availabilityError) {
			this.postMessage({ type: 'result', success: false, message: availabilityError });
			return;
		}
		const totalPages = inputs.reduce((sum, item) => sum + item.pages.length, 0);
		this.postMessage({ type: 'progress', jobId: 'mergeByPage', progress: 0, message: vscode.l10n.t('Merging {0} pages from {1} PDFs…', String(totalPages), String(inputs.length)) });
		const result = await this.service.mergePdfsByPage({ inputs, output });
		this.postMessage({
			type: 'result',
			success: result.success,
			message: result.success
				? vscode.l10n.t('Merged {0} pages from {1} PDFs.', String(totalPages), String(inputs.length))
				: result.error ?? vscode.l10n.t('Merge by page failed.'),
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

function getDashboardHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'dashboard', 'dashboard.js'));
	const pageRangesScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'dashboard', 'pageRanges.js'));
	const renderScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'dashboard', 'render.js'));
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'dashboard', 'dashboard.css'));
	const cspSource = webview.cspSource;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource}; script-src ${cspSource};">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="${styleUri}" rel="stylesheet">
	<title></title>
</head>
<body>
	<div class="container">
		<header>
			<h1 id="dashboard-heading"></h1>
			<p id="dashboard-subtitle" class="subtitle"></p>
		</header>
		<div id="sidecar-status" class="status-banner hidden"></div>
		<section class="panel">
			<h2 id="single-conversion-title"></h2>
			<label id="conversion-label" for="conversion-select"></label>
			<select id="conversion-select"></select>
			<div id="fidelity-badge" class="badge hidden"></div>
			<div id="install-guidance" class="guidance hidden"></div>
			<div class="path-row">
				<label id="input-label"></label>
				<input id="input-path" type="text" readonly>
				<button id="pick-input" type="button"></button>
			</div>
			<div class="path-row">
				<label id="output-label"></label>
				<input id="output-path" type="text" readonly>
				<button id="pick-output" type="button"></button>
			</div>
			<button id="start-convert" type="button" class="primary" disabled></button>
		</section>
		<section class="panel">
			<h2 id="batch-conversion-title"></h2>
			<label id="batch-conversion-label" for="batch-conversion-select"></label>
			<select id="batch-conversion-select"></select>
			<div class="path-row">
				<label id="batch-inputs-label"></label>
				<input id="batch-inputs" type="text" readonly>
				<button id="pick-batch" type="button"></button>
			</div>
			<button id="start-batch" type="button" disabled></button>
		</section>
		<section class="panel">
			<h2 id="merge-title"></h2>
			<div class="path-row">
				<label id="merge-inputs-label"></label>
				<input id="merge-inputs" type="text" readonly>
				<button id="pick-merge-inputs" type="button"></button>
			</div>
			<div class="path-row">
				<label id="merge-output-label"></label>
				<input id="merge-output" type="text" readonly>
				<button id="pick-merge-output" type="button"></button>
			</div>
			<button id="start-merge" type="button" disabled></button>
		</section>
		<section class="panel">
			<h2 id="merge-by-page-title"></h2>
			<div class="path-row">
				<label id="merge-by-page-inputs-label"></label>
				<button id="pick-merge-by-page-inputs" type="button"></button>
			</div>
			<div id="merge-by-page-list" class="merge-page-list"></div>
			<div class="path-row">
				<label id="merge-by-page-output-label"></label>
				<input id="merge-by-page-output" type="text" readonly>
				<button id="pick-merge-by-page-output" type="button"></button>
			</div>
			<button id="start-merge-by-page" type="button" disabled></button>
		</section>
		<section id="progress-section" class="panel hidden">
			<h2 id="progress-title"></h2>
			<div class="progress-bar"><div id="progress-fill"></div></div>
			<p id="progress-message"></p>
		</section>
		<section id="result-section" class="panel hidden">
			<h2 id="result-title"></h2>
			<p id="result-message"></p>
		</section>
	</div>
	<script src="${pageRangesScriptUri}"></script>
	<script src="${renderScriptUri}"></script>
	<script src="${scriptUri}"></script>
</body>
</html>`;
}
