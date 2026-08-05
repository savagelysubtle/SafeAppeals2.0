/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DocParseAdapter } from './adapters/docParseAdapter';
import {
	consentInstallModel,
	consentInstallUnlimitedOcr,
	type ConsentInstallOutcome,
} from './consentInstall';
import { smokeDocParseHealth } from './docParseSmoke';
import type {
	AcquireOptions,
	MlLease,
	ResourceAdapter,
	ResourceKind,
} from './engineTypes';
import { HwCapabilityProbe } from './hwCapabilityProbe';
import { ModelArtifactStore } from './modelArtifactStore';
import { createDefaultModelCatalog, type ModelCatalog } from './modelCatalog';
import { MlResourceEngine } from './resourceEngine';

let outputChannel: vscode.OutputChannel | undefined;
let mlEngine: MlResourceEngine | undefined;

/**
 * Public API for sibling hosts (safeappeals-audio, safeappeals-rag).
 */
export interface SafeAppealsMlApi {
	readonly probe: HwCapabilityProbe;
	readonly catalog: ModelCatalog;
	readonly artifactStore: ModelArtifactStore;
	/** Shared process-local ML resource engine (heavy XOR + ffmpeg lane). */
	readonly engine: MlResourceEngine;
	/** True when consent-installed artifacts are SHA-verified ready. */
	isArtifactReady(modelId: string): Promise<boolean>;
	/**
	 * Consent-gated install. Pass `userConsented: true` only after an explicit UI confirm.
	 * Ineligible hardware never downloads. Unlimited-OCR runs a localhost `/health` smoke after download.
	 */
	consentInstall(modelId: string, userConsented: boolean): Promise<ConsentInstallOutcome>;
	/** Purge `ml-models/<modelId>` or the entire `ml-models` root when omitted. */
	purgeArtifacts(modelId?: string): Promise<{ readonly purged: readonly string[] }>;
	/** Convenience: acquire a lease, run `fn`, always release. */
	withLease<T>(
		kind: ResourceKind,
		options: AcquireOptions,
		fn: (lease: MlLease) => Promise<T>,
	): Promise<T>;
	/** Mark a slot crashed and drain waiters (sidecar / native failure). */
	reportCrash(kind: ResourceKind, message?: string): void;
	/** Register or replace a cold adapter (whisper / diarization / embedding / …). */
	registerAdapter(adapter: ResourceAdapter): void;
}

/**
 * Activate the shared ML host: probe + catalog + ModelArtifactStore + MlResourceEngine.
 */
export function activate(context: vscode.ExtensionContext): SafeAppealsMlApi {
	outputChannel = vscode.window.createOutputChannel('Safe Appeals ML');
	context.subscriptions.push(outputChannel);

	const probe = new HwCapabilityProbe();
	const catalog = createDefaultModelCatalog();
	const artifactStore = ModelArtifactStore.fromExtensionContext(context, catalog);

	const unlimitedOcrSmoke = async (): Promise<void> => {
		const configured = vscode.workspace
			.getConfiguration()
			.get<string>('safeappeals.rag.docParseSidecarUrl');
		await smokeDocParseHealth({
			baseUrl: configured?.trim() || undefined,
		});
	};

	const docParseBaseUrl = (): string => {
		const fromEnv = process.env.SAFEAPPEALS_DOCPARSE_URL?.trim();
		if (fromEnv) {
			return fromEnv;
		}
		return (
			vscode.workspace.getConfiguration().get<string>('safeappeals.rag.docParseSidecarUrl')?.trim() ||
			'http://127.0.0.1:8742'
		);
	};

	const engine = new MlResourceEngine({}, [
		new DocParseAdapter({
			baseUrl: docParseBaseUrl(),
			log: message => outputChannel?.appendLine(message),
			// v1: BYO localhost health only — Unlimited-OCR runner binary may be absent.
			// When a spawn path lands later, pass spawnOwned and unload will kill the child.
		}),
	]);
	mlEngine = engine;
	context.subscriptions.push({
		dispose: () => {
			void engine.dispose();
			if (mlEngine === engine) {
				mlEngine = undefined;
			}
		},
	});

	const api: SafeAppealsMlApi = {
		probe,
		catalog,
		artifactStore,
		engine,
		isArtifactReady: (modelId: string) => artifactStore.isReady(modelId),
		consentInstall: (modelId: string, userConsented: boolean) =>
			consentInstallModel(
				{ probe, catalog, store: artifactStore },
				{
					modelId,
					userConsented,
					smokeTest: modelId === 'unlimited-ocr' ? unlimitedOcrSmoke : undefined,
				},
			),
		purgeArtifacts: (modelId?: string) => artifactStore.purge(modelId),
		withLease: (kind, options, fn) => engine.withLease(kind, options, fn),
		reportCrash: (kind, message) => engine.reportCrash(kind, message),
		registerAdapter: adapter => engine.registerAdapter(adapter),
	};

	context.subscriptions.push(
		vscode.commands.registerCommand('safeappeals-ml.showHardwareSnapshot', async () => {
			try {
				const snapshot = await api.probe.snapshot();
				const ocr = api.catalog.evaluate('unlimited-ocr', snapshot);
				const ready = await api.isArtifactReady('unlimited-ocr');
				const lines = [
					`Platform: ${snapshot.platform} ${snapshot.arch} (${snapshot.osRelease})`,
					`CPU: ${snapshot.cpuModel} × ${snapshot.cpuCount}`,
					`RAM: ${snapshot.totalRamMb} MB total / ${snapshot.freeRamMb} MB free`,
					`Disk free: ${snapshot.diskFreeMb} MB`,
					`GPU: ${snapshot.gpuName ?? 'none detected'} / VRAM ${snapshot.gpuVramMb ?? 'unknown'} MB`,
					`Unlimited-OCR: ${ocr.eligible ? 'eligible' : 'not eligible'}${ocr.reasons.length ? ` — ${ocr.reasons.join('; ')}` : ''}`,
					`Unlimited-OCR artifacts: ${ready ? 'ready' : 'not installed'}`,
					`ML engine heavy: ${engine.getSnapshot().heavyKindLoaded ?? '(none)'} queue=${engine.getSnapshot().queueLength}`,
				];
				const summary = lines.join('\n');
				outputChannel?.appendLine(summary);
				outputChannel?.show(true);
				void vscode.window.showInformationMessage(
					vscode.l10n.t('Hardware snapshot written to the Safe Appeals ML output channel.'),
				);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				outputChannel?.appendLine(`Hardware snapshot failed: ${message}`);
				void vscode.window.showErrorMessage(
					vscode.l10n.t('Failed to collect a hardware snapshot.'),
				);
			}
		}),
		vscode.commands.registerCommand('safeappeals-ml.installUnlimitedOcr', async () => {
			const snapshot = await api.probe.snapshot();
			const evaluation = api.catalog.evaluate('unlimited-ocr', snapshot);
			if (!evaluation.eligible) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t(
						'Unlimited-OCR cannot be installed on this computer. {0}',
						evaluation.reasons.join('; ') || vscode.l10n.t('Hardware requirements not met.'),
					),
				);
				return;
			}

			if (await api.isArtifactReady('unlimited-ocr')) {
				void vscode.window.showInformationMessage(
					vscode.l10n.t('Unlimited-OCR is already installed and verified.'),
				);
				return;
			}

			const confirm = await vscode.window.showWarningMessage(
				vscode.l10n.t(
					'Install Unlimited-OCR (~7 GB)? Weights stay on this computer and are never downloaded without your consent.',
				),
				{ modal: true },
				vscode.l10n.t('Install Unlimited-OCR'),
			);
			if (confirm !== vscode.l10n.t('Install Unlimited-OCR')) {
				outputChannel?.appendLine('Unlimited-OCR install cancelled (no consent).');
				return;
			}

			const outcome = await consentInstallUnlimitedOcr(
				{ probe, catalog, store: artifactStore },
				true,
				{ smokeTest: unlimitedOcrSmoke },
			);
			logConsentOutcome(outcome);
			switch (outcome.kind) {
				case 'installed':
				case 'already-ready':
					void vscode.window.showInformationMessage(
						vscode.l10n.t('Unlimited-OCR is ready (version {0}).', outcome.version),
					);
					break;
				case 'ineligible':
					void vscode.window.showWarningMessage(
						vscode.l10n.t(
							'Unlimited-OCR cannot be installed on this computer. {0}',
							outcome.reasons.join('; '),
						),
					);
					break;
				case 'consent-required':
					void vscode.window.showWarningMessage(
						vscode.l10n.t('Unlimited-OCR install requires your consent.'),
					);
					break;
				case 'error':
					void vscode.window.showErrorMessage(
						vscode.l10n.t('Unlimited-OCR install failed: {0}', outcome.message),
					);
					break;
			}
		}),
		vscode.commands.registerCommand('safeappeals-ml.purgeModelArtifacts', async () => {
			const confirm = await vscode.window.showWarningMessage(
				vscode.l10n.t(
					'Delete all Safe Appeals ML model artifacts from this computer? You will need to reinstall with consent to use them again.',
				),
				{ modal: true },
				vscode.l10n.t('Purge Model Artifacts'),
			);
			if (confirm !== vscode.l10n.t('Purge Model Artifacts')) {
				return;
			}
			try {
				const result = await api.purgeArtifacts();
				outputChannel?.appendLine(
					`Purged ML artifacts: ${result.purged.length ? result.purged.join(', ') : '(empty)'}`,
				);
				void vscode.window.showInformationMessage(
					vscode.l10n.t('Safe Appeals ML model artifacts were purged.'),
				);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				outputChannel?.appendLine(`Purge failed: ${message}`);
				void vscode.window.showErrorMessage(
					vscode.l10n.t('Failed to purge ML model artifacts: {0}', message),
				);
			}
		}),
	);

	return api;
}

function logConsentOutcome(outcome: ConsentInstallOutcome): void {
	switch (outcome.kind) {
		case 'installed':
			outputChannel?.appendLine(`Installed ${outcome.modelId} @ ${outcome.version}`);
			break;
		case 'already-ready':
			outputChannel?.appendLine(`Already ready: ${outcome.modelId} @ ${outcome.version}`);
			break;
		case 'ineligible':
			outputChannel?.appendLine(
				`Ineligible for ${outcome.modelId}: ${outcome.reasons.join('; ')}`,
			);
			break;
		case 'consent-required':
			outputChannel?.appendLine(`Consent required for ${outcome.modelId}`);
			break;
		case 'error':
			outputChannel?.appendLine(`Install error for ${outcome.modelId}: ${outcome.message}`);
			break;
	}
}

export function deactivate(): void {
	outputChannel = undefined;
	mlEngine = undefined;
}

// Re-exports for consumers / tests that resolve the package modules after compile.
export { DocParseAdapter } from './adapters/docParseAdapter';
export {
	MlAcquireTimeoutError,
	MlBackendCrashedError,
	MlBackendUnavailableError,
	MlBudgetExceededError,
	MlBusyError,
	MlCancelledError,
	MlError,
} from './errors';
export {
	DEFAULT_ML_ENGINE_OPTIONS,
	DEFAULT_ML_ESTIMATES_MB,
	heavyKinds,
	isHeavyKind,
	type AcquireOptions,
	type MlEngineOptions,
	type MlEngineSnapshot,
	type MlLease,
	type ResourceAdapter,
	type ResourceKind,
	type SlotSnapshot,
	type SlotState,
} from './engineTypes';
export { MlResourceEngine } from './resourceEngine';
