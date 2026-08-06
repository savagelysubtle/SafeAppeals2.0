/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SCAFFOLD_CORE_REFERENCES_COMMAND } from './coreReferencesScaffold';
import {
	GETTING_STARTED_PRIVATE_SEARCH_WALKTHROUGH,
	markLocalAiSetupCompleted,
} from './localAiSetupCompletion';
import { installOcrWithEnsure } from './localAiSetupOcr';
import {
	applyOcrResult,
	applyScanResult,
	applySearchPackResult,
	advanceFromEducate,
	advanceFromScan,
	buildDoneSummary,
	createInitialSession,
	DEFAULT_OCR_DISK_MB,
	DEFAULT_SEARCH_PACK_DISK_MB,
	SEARCH_PACK_MODEL_IDS,
	skipToDone,
	type LocalAiSetupSession,
} from './localAiSetupState';
import { searchPackModelPercent } from './localAiSetupProgress';
import type { MlBridge } from './mlBridge';
import {
	BGE_SMALL_MODEL_ID,
	MS_MARCO_CE_MODEL_ID,
	UNLIMITED_OCR_MODEL_ID,
	type ConsentInstallOutcome,
} from './types';

type WebviewToHostMessage =
	| { readonly type: 'ready' }
	| { readonly type: 'continue' }
	| { readonly type: 'installSearchPack' }
	| { readonly type: 'skipSearchPack' }
	| { readonly type: 'installOcr' }
	| { readonly type: 'skipOcr' }
	| { readonly type: 'scaffoldCoreReferences' }
	| { readonly type: 'finish' }
	| { readonly type: 'skipAll' };

type HostToWebviewMessage =
	| {
		readonly type: 'state';
		readonly session: LocalAiSetupSession;
		readonly doneSummary: ReturnType<typeof buildDoneSummary> | undefined;
		readonly busy: boolean;
		readonly statusMessage: string | undefined;
		readonly mlAvailable: boolean;
		readonly progressPercent?: number;
		readonly progressIndeterminate?: boolean;
	};

/**
 * Local AI Setup webview — educate → scan → Search pack → OCR → done.
 * Downloads only after explicit consent; probe may pre-warm read-only.
 */
export interface LocalAiSetupPanelOptions {
	/**
	 * Called after Search pack install succeeds (`installed` / `already-ready`)
	 * so the rag-core host can re-sync model env and clear `models-missing`.
	 */
	readonly onSearchPackReady?: () => void | Promise<void>;
}

export class LocalAiSetupPanel {
	public static current: LocalAiSetupPanel | undefined;
	public static readonly viewType = 'safeappeals-rag.localAiSetup';

	private readonly panel: vscode.WebviewPanel;
	private readonly disposables: vscode.Disposable[] = [];
	private session: LocalAiSetupSession;
	private busy = false;
	private statusMessage: string | undefined;
	private progressPercent: number | undefined;
	private progressIndeterminate = false;
	private probeStarted = false;

	private constructor(
		panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
		private readonly ml: MlBridge | undefined,
		private readonly log: (message: string) => void,
		private readonly onSearchPackReady?: () => void | Promise<void>,
	) {
		this.panel = panel;
		this.session = createInitialSession({
			searchPackDiskMb: this.resolveSearchPackDiskMb(),
			ocrDiskMb: this.resolveOcrDiskMb(),
		});
		this.panel.webview.html = getPanelHtml(this.panel.webview, extensionUri);
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.webview.onDidReceiveMessage(
			msg => void this.onMessage(msg as WebviewToHostMessage),
			null,
			this.disposables,
		);
	}

	static show(
		extensionUri: vscode.Uri,
		ml: MlBridge | undefined,
		log: (message: string) => void,
		options?: LocalAiSetupPanelOptions,
	): LocalAiSetupPanel {
		const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
		if (LocalAiSetupPanel.current) {
			LocalAiSetupPanel.current.panel.reveal(column);
			void LocalAiSetupPanel.current.postState();
			void LocalAiSetupPanel.current.ensureProbe();
			return LocalAiSetupPanel.current;
		}
		const panel = vscode.window.createWebviewPanel(
			LocalAiSetupPanel.viewType,
			vscode.l10n.t('Private Search Setup'),
			column,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(extensionUri, 'media', 'localAiSetup'),
					extensionUri,
				],
			},
		);
		LocalAiSetupPanel.current = new LocalAiSetupPanel(
			panel,
			extensionUri,
			ml,
			log,
			options?.onSearchPackReady,
		);
		void LocalAiSetupPanel.current.postState();
		void LocalAiSetupPanel.current.ensureProbe();
		return LocalAiSetupPanel.current;
	}

	private resolveSearchPackDiskMb(): number {
		const bge = this.ml?.catalog.get?.(BGE_SMALL_MODEL_ID)?.diskMb;
		const ce = this.ml?.catalog.get?.(MS_MARCO_CE_MODEL_ID)?.diskMb;
		if (typeof bge === 'number' && typeof ce === 'number') {
			return bge + ce;
		}
		return DEFAULT_SEARCH_PACK_DISK_MB;
	}

	private resolveOcrDiskMb(): number {
		return this.ml?.catalog.get?.(UNLIMITED_OCR_MODEL_ID)?.diskMb ?? DEFAULT_OCR_DISK_MB;
	}

	private async ensureProbe(): Promise<void> {
		if (this.probeStarted || !this.ml) {
			return;
		}
		this.probeStarted = true;
		try {
			const previousBeat = this.session.beat;
			const snapshot = await this.ml.probe.snapshot();
			const ocrEval = this.ml.catalog.evaluate(UNLIMITED_OCR_MODEL_ID, snapshot);
			this.session = applyScanResult(this.session, snapshot, ocrEval);
			// Probe may pre-warm while still on educate; do not yank the user back if they already advanced.
			if (previousBeat === 'educate') {
				this.session = { ...this.session, beat: 'educate' };
			} else if (previousBeat !== 'scan') {
				this.session = { ...this.session, beat: previousBeat };
			}
			this.log(
				`Local AI Setup probe: ocrEligible=${ocrEval.eligible}` +
				(ocrEval.reasons.length ? ` (${ocrEval.reasons.join('; ')})` : ''),
			);
			await this.postState();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.log(`Local AI Setup probe failed: ${message}`);
			this.statusMessage = vscode.l10n.t(
				'Could not check this computer yet. You can still continue or skip.',
			);
			await this.postState();
		}
	}

	private clearProgress(): void {
		this.progressPercent = undefined;
		this.progressIndeterminate = false;
	}

	private async postState(): Promise<void> {
		const message: HostToWebviewMessage = {
			type: 'state',
			session: this.session,
			doneSummary: this.session.beat === 'done' ? buildDoneSummary(this.session) : undefined,
			busy: this.busy,
			statusMessage: this.statusMessage,
			mlAvailable: Boolean(this.ml),
			progressPercent: this.progressPercent,
			progressIndeterminate: this.progressIndeterminate,
		};
		void this.panel.webview.postMessage(message);
	}

	private async onMessage(message: WebviewToHostMessage): Promise<void> {
		switch (message.type) {
			case 'ready':
				await this.postState();
				await this.ensureProbe();
				return;
			case 'continue':
				await this.onContinue();
				return;
			case 'installSearchPack':
				await this.onInstallSearchPack();
				return;
			case 'skipSearchPack':
				this.session = applySearchPackResult(this.session, 'skipped');
				this.statusMessage = undefined;
				await this.postState();
				return;
			case 'installOcr':
				await this.onInstallOcr();
				return;
			case 'skipOcr':
				this.session = applyOcrResult(
					this.session,
					this.session.ocrEligible ? 'skipped' : 'ineligible',
				);
				this.statusMessage = undefined;
				await this.postState();
				return;
			case 'scaffoldCoreReferences':
				try {
					await vscode.commands.executeCommand(SCAFFOLD_CORE_REFERENCES_COMMAND);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					this.log(`Create Core References Folder failed: ${message}`);
					this.statusMessage = vscode.l10n.t(
						'Could not create the core references folder. Try again from the command palette.',
					);
					await this.postState();
				}
				return;
			case 'finish':
				await this.completeAndClose({ openGettingStarted: true });
				return;
			case 'skipAll':
				this.session = skipToDone(this.session);
				await this.completeAndClose({ openGettingStarted: false });
				return;
		}
	}

	private async onContinue(): Promise<void> {
		if (this.busy) {
			return;
		}
		switch (this.session.beat) {
			case 'educate':
				await this.ensureProbe();
				this.session = advanceFromEducate(this.session);
				if (!this.session.hw && this.ml) {
					// Probe still in flight / failed — stay on scan with empty-friendly copy via re-probe.
					try {
						const snapshot = await this.ml.probe.snapshot();
						const ocrEval = this.ml.catalog.evaluate(UNLIMITED_OCR_MODEL_ID, snapshot);
						this.session = applyScanResult(
							{ ...this.session, beat: 'educate' },
							snapshot,
							ocrEval,
						);
					} catch {
						this.session = advanceFromEducate(this.session);
					}
				}
				await this.postState();
				return;
			case 'scan':
				this.session = advanceFromScan(this.session);
				await this.postState();
				return;
			case 'ocr':
				// Ineligible OCR beat: Continue advances to done without install.
				if (!this.session.ocrEligible) {
					this.session = applyOcrResult(this.session, 'ineligible');
					await this.postState();
				}
				return;
			default:
				return;
		}
	}

	private async onInstallSearchPack(): Promise<void> {
		if (!this.ml || this.busy) {
			this.statusMessage = vscode.l10n.t(
				'Private Search install is unavailable. safeappeals-ml is not ready.',
			);
			await this.postState();
			return;
		}
		this.busy = true;
		this.progressIndeterminate = true;
		this.progressPercent = undefined;
		this.statusMessage = vscode.l10n.t('Installing search tools…');
		await this.postState();

		let anyInstalled = false;
		let anyAlready = true;
		const errors: string[] = [];

		for (let index = 0; index < SEARCH_PACK_MODEL_IDS.length; index++) {
			const modelId = SEARCH_PACK_MODEL_IDS[index]!;
			this.statusMessage = vscode.l10n.t('Installing {0}…', modelId);
			this.progressPercent = searchPackModelPercent(index, SEARCH_PACK_MODEL_IDS.length);
			this.progressIndeterminate = false;
			await this.postState();
			const outcome = await this.ml.consentInstall(modelId, true);
			const classified = classifyOutcome(outcome);
			if (classified === 'failed') {
				errors.push(outcomeMessage(outcome));
				anyAlready = false;
			} else if (classified === 'installed') {
				anyInstalled = true;
				anyAlready = false;
			} else if (classified !== 'already-ready') {
				anyAlready = false;
				errors.push(outcomeMessage(outcome));
			}
			this.progressPercent = searchPackModelPercent(index + 1, SEARCH_PACK_MODEL_IDS.length);
			await this.postState();
		}

		this.busy = false;
		this.clearProgress();
		if (errors.length) {
			const message = friendlyInstallError(errors.join(' '));
			this.session = applySearchPackResult(this.session, 'failed', message);
			this.statusMessage = message;
		} else if (anyInstalled) {
			this.session = applySearchPackResult(this.session, 'installed');
			this.statusMessage = undefined;
			await this.notifySearchPackReady();
		} else if (anyAlready) {
			this.session = applySearchPackResult(this.session, 'already-ready');
			this.statusMessage = undefined;
			await this.notifySearchPackReady();
		} else {
			this.session = applySearchPackResult(this.session, 'failed', vscode.l10n.t('Install did not complete.'));
		}
		await this.postState();
	}

	private async notifySearchPackReady(): Promise<void> {
		if (!this.onSearchPackReady) {
			return;
		}
		try {
			await this.onSearchPackReady();
		} catch (err) {
			this.log(
				`Search pack ready callback failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	private async onInstallOcr(): Promise<void> {
		if (!this.ml || this.busy) {
			this.statusMessage = vscode.l10n.t(
				'Private Search install is unavailable. safeappeals-ml is not ready.',
			);
			await this.postState();
			return;
		}
		if (!this.session.ocrEligible) {
			this.session = applyOcrResult(this.session, 'ineligible');
			await this.postState();
			return;
		}
		this.busy = true;
		this.progressIndeterminate = true;
		this.progressPercent = undefined;
		this.statusMessage = vscode.l10n.t('Installing scanned-PDF tools…');
		await this.postState();

		const result = await installOcrWithEnsure(this.ml, async (message, percent, indeterminate) => {
			this.statusMessage = vscode.l10n.t(message);
			if (indeterminate) {
				this.progressIndeterminate = true;
				this.progressPercent = undefined;
			} else if (percent !== undefined) {
				this.progressPercent = percent;
				this.progressIndeterminate = false;
			} else {
				this.progressIndeterminate = true;
				this.progressPercent = undefined;
			}
			await this.postState();
		});

		this.busy = false;
		this.clearProgress();
		if (result.sessionOutcome === 'installed' || result.sessionOutcome === 'already-ready') {
			this.session = applyOcrResult(this.session, result.sessionOutcome);
			this.statusMessage = undefined;
		} else if (result.sessionOutcome === 'ineligible') {
			this.session = applyOcrResult(this.session, 'ineligible');
			this.statusMessage = undefined;
		} else {
			const message = friendlyInstallError(result.errorMessage ?? 'Install did not complete.');
			this.session = applyOcrResult(this.session, 'failed', message);
			this.statusMessage = message;
		}
		await this.postState();
	}

	private async completeAndClose(options: { readonly openGettingStarted: boolean }): Promise<void> {
		try {
			await markLocalAiSetupCompleted();
			this.log('Local AI Setup marked completed (machine setting).');
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.log(`Failed to persist Local AI Setup completion: ${message}`);
			void vscode.window.showWarningMessage(
				vscode.l10n.t('Could not save Private Search Setup completion on this computer.'),
			);
		}

		if (options.openGettingStarted) {
			try {
				await vscode.commands.executeCommand(
					'workbench.action.openWalkthrough',
					{
						category: GETTING_STARTED_PRIVATE_SEARCH_WALKTHROUGH.category,
						step: GETTING_STARTED_PRIVATE_SEARCH_WALKTHROUGH.step,
					},
					false,
				);
				this.log('Opened Getting Started (Private Search step) after Local AI Setup finish.');
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				this.log(`Getting Started walkthrough open failed (continuing close): ${message}`);
			}
		}

		this.dispose();
	}

	dispose(): void {
		LocalAiSetupPanel.current = undefined;
		while (this.disposables.length) {
			this.disposables.pop()?.dispose();
		}
		this.panel.dispose();
	}
}

function classifyOutcome(
	outcome: ConsentInstallOutcome,
): 'installed' | 'already-ready' | 'ineligible' | 'failed' {
	switch (outcome.kind) {
		case 'installed':
			return 'installed';
		case 'already-ready':
			return 'already-ready';
		case 'ineligible':
			return 'ineligible';
		default:
			return 'failed';
	}
}

function outcomeMessage(outcome: ConsentInstallOutcome): string {
	switch (outcome.kind) {
		case 'error':
			return outcome.message;
		case 'consent-required':
			return 'Consent is required before download.';
		case 'ineligible':
			return outcome.reasons.join('; ') || 'Not eligible on this computer.';
		default:
			return '';
	}
}

/**
 * Surface fail-closed pin gaps clearly; optional BYO note for unpinned artifacts.
 */
function friendlyInstallError(raw: string): string {
	if (/downloadUrl|sha256/i.test(raw)) {
		return (
			`${raw} ` +
			'Install packages are not published for this build yet. ' +
			'You can continue with text PDFs, or bring your own model files later.'
		);
	}
	return raw;
}

function getPanelHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'media', 'localAiSetup', 'localAiSetup.js'),
	);
	const styleUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'media', 'localAiSetup', 'localAiSetup.css'),
	);
	const cspSource = webview.cspSource;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource}; script-src ${cspSource};">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="${styleUri}" rel="stylesheet">
	<title>Private Search Setup</title>
</head>
<body>
	<div class="container">
		<header>
			<h1 id="headline">Private Search Setup</h1>
			<p id="subtitle" class="subtitle"></p>
		</header>
		<div id="status" class="status-banner hidden" role="status">
			<span id="status-text"></span>
			<div id="progress" class="progress hidden" aria-hidden="true">
				<div class="progress-track" aria-hidden="true">
					<div id="progress-fill" class="progress-fill"></div>
				</div>
				<span id="progress-label" class="progress-label"></span>
			</div>
		</div>
		<section id="beat" class="panel" aria-live="polite"></section>
		<footer class="actions">
			<button id="skip-all" type="button" class="secondary">Skip Setup</button>
			<div class="actions-primary">
				<button id="secondary" type="button" class="secondary hidden"></button>
				<button id="primary" type="button" class="primary"></button>
			</div>
		</footer>
		<p class="footnote">Nothing is downloaded without your consent. Search tools stay on this computer.</p>
	</div>
	<script src="${scriptUri}"></script>
</body>
</html>`;
}
