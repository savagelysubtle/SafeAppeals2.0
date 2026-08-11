/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'node:os';
import * as vscode from 'vscode';
import { DocParseAdapter } from './adapters/docParseAdapter';
import {
	consentInstallModel,
	consentInstallUnlimitedOcr,
	type ConsentInstallOutcome,
} from './consentInstall';
import { DocParseSidecarHost } from './docParseSidecarHost';
import { smokeDocParseHealth } from './docParseSmoke';
import type {
	AcquireOptions,
	MlLease,
	ResourceAdapter,
	ResourceKind,
} from './engineTypes';
import { HwCapabilityProbe, bytesToMb } from './hwCapabilityProbe';
import { ModelArtifactStore } from './modelArtifactStore';
import { createDefaultModelCatalog, isArtifactPinConfigured, type ModelCatalog } from './modelCatalog';
import { peakRssBudgetFromTotalRamMb } from './engineTypes';
import { MlResourceEngine } from './resourceEngine';

let outputChannel: vscode.OutputChannel | undefined;
let mlEngine: MlResourceEngine | undefined;
let docParseSidecarHost: DocParseSidecarHost | undefined;

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
	 * Ineligible hardware never downloads. Unlimited-OCR starts the managed sidecar then smokes `/health`.
	 */
	consentInstall(
		modelId: string,
		userConsented: boolean,
		options?: { readonly onProgress?: (progress: import('./modelArtifactStore').ArtifactDownloadProgress) => void },
	): Promise<ConsentInstallOutcome>;
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
	/** Start managed DocParse sidecar when artifacts + binary are ready; smoke `/health`. */
	ensureDocParseReady(): Promise<{ readonly ready: boolean; readonly detail?: string }>;
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

	// Heavy kinds stay XOR; budget caps total heavy + ffmpeg RSS (25% of RAM, 1–4 GB).
	const peakRssBudgetMb = peakRssBudgetFromTotalRamMb(bytesToMb(os.totalmem()));

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

	const sidecarHost = new DocParseSidecarHost({
		extensionPath: context.extensionPath,
		baseUrl: docParseBaseUrl(),
		log: message => outputChannel?.appendLine(message),
	});
	docParseSidecarHost = sidecarHost;
	context.subscriptions.push({ dispose: () => sidecarHost.dispose() });

	const refreshDocParseModelDir = async (): Promise<string | undefined> => {
		const spec = catalog.get('unlimited-ocr');
		if (!spec?.version) {
			return undefined;
		}
		if (!(await artifactStore.isReady('unlimited-ocr'))) {
			return undefined;
		}
		return artifactStore.artifactDir('unlimited-ocr', spec.version);
	};

	const ensureDocParseReady = async (): Promise<{
		readonly ready: boolean;
		readonly detail?: string;
		readonly runtimeMissing?: boolean;
	}> => {
		const modelDir = await refreshDocParseModelDir();
		if (!modelDir) {
			return {
				ready: false,
				detail: 'Unlimited-OCR artifacts are not installed or verified.',
			};
		}
		sidecarHost.setModelDir(modelDir);

		if (sidecarHost.isBinaryAvailable) {
			try {
				await sidecarHost.start();
				return { ready: true };
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return { ready: false, detail: message };
			}
		}

		// Optional external/BYO sidecar on the configured loopback URL.
		try {
			await smokeDocParseHealth({ baseUrl: docParseBaseUrl() });
			return { ready: true };
		} catch {
			// No bundled binary and nothing listening — not a corrupt weight pack.
			return {
				ready: false,
				runtimeMissing: true,
				detail:
					'sa-docparse runtime is missing (extensions/safeappeals-ml/bin/sa-docparse[.exe]). ' +
					'Weights can still install; build the sidecar with ' +
					'`cargo build -p docparse --release` and copy it into bin/, or set SAFEAPPEALS_DOCPARSE_PATH.',
			};
		}
	};

	void refreshDocParseModelDir().then(dir => {
		if (dir) {
			sidecarHost.setModelDir(dir);
		}
	});

	const engine = new MlResourceEngine({ peakRssBudgetMb }, [
		new DocParseAdapter({
			baseUrl: docParseBaseUrl(),
			log: message => outputChannel?.appendLine(message),
			spawnOwned: async () => {
				const modelDir = await refreshDocParseModelDir();
				if (modelDir) {
					sidecarHost.setModelDir(modelDir);
				}
				return sidecarHost.ensureStarted();
			},
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
		consentInstall: (
			modelId: string,
			userConsented: boolean,
			options?: { readonly onProgress?: (progress: import('./modelArtifactStore').ArtifactDownloadProgress) => void },
		) =>
			modelId === 'unlimited-ocr'
				? consentInstallUnlimitedOcr(
					{ probe, catalog, store: artifactStore },
					userConsented,
					{ ensureDocParseReady, onProgress: options?.onProgress },
				)
				: consentInstallModel(
					{ probe, catalog, store: artifactStore },
					{ modelId, userConsented, onProgress: options?.onProgress },
				),
		purgeArtifacts: (modelId?: string) => artifactStore.purge(modelId),
		withLease: (kind, options, fn) => engine.withLease(kind, options, fn),
		reportCrash: (kind, message) => engine.reportCrash(kind, message),
		registerAdapter: adapter => engine.registerAdapter(adapter),
		ensureDocParseReady,
	};

	context.subscriptions.push(
		vscode.commands.registerCommand('safeappeals-ml.showHardwareSnapshot', async () => {
			try {
				const snapshot = await api.probe.snapshot();
				const ocr = api.catalog.evaluate('unlimited-ocr', snapshot);
				const ocrSpec = api.catalog.get('unlimited-ocr');
				const ocrPinned = isArtifactPinConfigured(ocrSpec);
				const ready = await api.isArtifactReady('unlimited-ocr');
				const lines = [
					`Platform: ${snapshot.platform} ${snapshot.arch} (${snapshot.osRelease})`,
					`CPU: ${snapshot.cpuModel} × ${snapshot.cpuCount}`,
					`RAM: ${snapshot.totalRamMb} MB total / ${snapshot.freeRamMb} MB free`,
					`Disk free: ${snapshot.diskFreeMb} MB`,
					`GPU: ${snapshot.gpuName ?? 'none detected'} / VRAM ${snapshot.gpuVramMb ?? 'unknown'} MB`,
					`Unlimited-OCR: ${ocr.eligible ? 'eligible' : 'not eligible'}${ocr.reasons.length ? ` — ${ocr.reasons.join('; ')}` : ''}`,
					`Unlimited-OCR artifact pins: ${ocrPinned ? 'configured' : 'not configured (install blocked)'}`,
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

			const ocrSpec = api.catalog.get('unlimited-ocr');
			if (!isArtifactPinConfigured(ocrSpec)) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t(
						'Unlimited-OCR cannot be installed: artifact download pins are not configured for this build.',
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
				{ ensureDocParseReady },
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
			if (outcome.warning) {
				outputChannel?.appendLine(`Install warning for ${outcome.modelId}: ${outcome.warning}`);
			}
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
	docParseSidecarHost = undefined;
}

/** Managed DocParse sidecar host (undefined before activate). */
export function getDocParseSidecarHost(): DocParseSidecarHost | undefined {
	return docParseSidecarHost;
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
