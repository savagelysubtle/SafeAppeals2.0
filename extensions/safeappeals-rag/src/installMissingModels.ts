/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { isArtifactPinConfigured } from './artifactPin';
import { installOcrWithEnsure } from './localAiSetupOcr';
import { SETUP_LOCAL_SEARCH_COMMAND } from './localAiSetupCompletion';
import {
	DEFAULT_OCR_DISK_MB,
	DEFAULT_SEARCH_PACK_DISK_MB,
	SEARCH_PACK_MODEL_IDS,
} from './localAiSetupState';
import type { MlBridge } from './mlBridge';
import type { ConsentInstallOutcome } from './types';
import { UNLIMITED_OCR_MODEL_ID } from './types';

/** Command that consent-installs missing Search pack models. */
export const INSTALL_MISSING_MODELS_COMMAND = 'safeappeals-rag.installMissingModels';

/** Approximate Search pack download size shown in the consent modal. */
export const SEARCH_PACK_INSTALL_DISK_MB = DEFAULT_SEARCH_PACK_DISK_MB;

export interface InstallMissingModelsDeps {
	readonly ml: MlBridge | undefined;
	readonly onReady: () => Promise<void>;
	readonly log: (message: string) => void;
}

export interface InstallMissingModelsSummary {
	readonly installed: readonly string[];
	readonly alreadyReady: readonly string[];
	readonly errors: readonly { readonly modelId: string; readonly message: string }[];
	/** Soft issues (e.g. weights OK, OCR runtime binary missing). */
	readonly warnings: readonly { readonly modelId: string; readonly message: string }[];
}

/** Whisper default model install (safeappeals-audio command). */
export const WHISPER_MODEL_ID = 'whisper-ggml-base.en';
export const INSTALL_WHISPER_COMMAND = 'safeappeals-audio.downloadWhisperModel';

/** Approximate Whisper base.en download size for consent copy. */
export const WHISPER_INSTALL_DISK_MB = 150;

export interface InstallMissingModelsPlan {
	readonly includeOcr: boolean;
	readonly includeWhisper: boolean;
	readonly searchPackDiskMb: number;
	readonly ocrDiskMb: number;
	readonly whisperDiskMb: number;
}

/**
 * Decide whether Install Missing Models should offer OCR / Whisper alongside Search pack.
 */
export async function resolveInstallMissingModelsPlan(
	ml: MlBridge,
): Promise<InstallMissingModelsPlan> {
	const searchPackDiskMb = resolveSearchPackDiskMb(ml);
	const ocrDiskMb = ml.catalog?.get?.(UNLIMITED_OCR_MODEL_ID)?.diskMb ?? DEFAULT_OCR_DISK_MB;
	const whisperDiskMb = WHISPER_INSTALL_DISK_MB;
	const includeWhisper = await resolveIncludeWhisper();
	const ocrSpec = ml.catalog?.get?.(UNLIMITED_OCR_MODEL_ID);
	if (!isArtifactPinConfigured(ocrSpec)) {
		return { includeOcr: false, includeWhisper, searchPackDiskMb, ocrDiskMb, whisperDiskMb };
	}
	try {
		const snapshot = await ml.probe.snapshot();
		const ocrEval = ml.catalog?.evaluate?.(UNLIMITED_OCR_MODEL_ID, snapshot);
		if (!ocrEval?.eligible) {
			return { includeOcr: false, includeWhisper, searchPackDiskMb, ocrDiskMb, whisperDiskMb };
		}
		const ocrReady = await ml.artifacts?.isReady(UNLIMITED_OCR_MODEL_ID);
		return { includeOcr: !ocrReady, includeWhisper, searchPackDiskMb, ocrDiskMb, whisperDiskMb };
	} catch {
		return { includeOcr: false, includeWhisper, searchPackDiskMb, ocrDiskMb, whisperDiskMb };
	}
}

async function resolveIncludeWhisper(): Promise<boolean> {
	try {
		const commands = await vscode.commands.getCommands(true);
		if (!commands.includes(INSTALL_WHISPER_COMMAND)) {
			return false;
		}
		// Audio installs Whisper into its own globalStorage; we always offer the
		// install command when the extension is present (idempotent if already there).
		return true;
	} catch {
		return false;
	}
}

function resolveSearchPackDiskMb(ml: MlBridge): number {
	let total = 0;
	let found = 0;
	for (const modelId of SEARCH_PACK_MODEL_IDS) {
		const diskMb = ml.catalog?.get?.(modelId)?.diskMb;
		if (typeof diskMb === 'number') {
			total += diskMb;
			found++;
		}
	}
	return found === SEARCH_PACK_MODEL_IDS.length ? total : SEARCH_PACK_INSTALL_DISK_MB;
}

function formatDiskMbLabel(diskMb: number): string {
	if (diskMb >= 1000) {
		return `~${(diskMb / 1000).toFixed(diskMb >= 10_000 ? 0 : 1)} GB`;
	}
	return `~${diskMb} MB`;
}

/**
 * Consent-gated install loop for Search pack models (BGE + ms-marco CE),
 * and Unlimited-OCR when this computer is eligible. Never downloads without modal confirm.
 */
export async function runInstallMissingModels(
	deps: InstallMissingModelsDeps,
): Promise<InstallMissingModelsSummary> {
	const summary: {
		installed: string[];
		alreadyReady: string[];
		errors: { modelId: string; message: string }[];
		warnings: { modelId: string; message: string }[];
	} = {
		installed: [],
		alreadyReady: [],
		errors: [],
		warnings: [],
	};

	if (!deps.ml) {
		void vscode.window.showErrorMessage(
			vscode.l10n.t(
				'Private Search install is unavailable. safeappeals-ml is not ready.',
			),
		);
		return summary;
	}

	const plan = await resolveInstallMissingModelsPlan(deps.ml);
	const confirm = vscode.l10n.t('Install');
	const cancel = vscode.l10n.t('Cancel');
	const searchSize = formatDiskMbLabel(plan.searchPackDiskMb);
	const parts: string[] = [
		vscode.l10n.t('Search tools ({0})', searchSize),
	];
	if (plan.includeOcr) {
		parts.push(vscode.l10n.t('scanned-PDF tools ({0})', formatDiskMbLabel(plan.ocrDiskMb)));
	}
	if (plan.includeWhisper) {
		parts.push(vscode.l10n.t('speech transcription Whisper ({0})', formatDiskMbLabel(plan.whisperDiskMb)));
	}
	const consentMessage = vscode.l10n.t(
		'Install missing local AI models on this computer? {0} stay local; nothing is uploaded.',
		parts.join('; '),
	);
	const choice = await vscode.window.showWarningMessage(
		consentMessage,
		{ modal: true },
		confirm,
		cancel,
	);
	if (choice !== confirm) {
		deps.log('Install Missing Models cancelled by user.');
		return summary;
	}

	deps.log(
		`Install Missing Models: user consented; Search pack`
		+ (plan.includeOcr ? ' + OCR' : '')
		+ (plan.includeWhisper ? ' + Whisper' : '')
		+ '.',
	);

	for (const modelId of SEARCH_PACK_MODEL_IDS) {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: vscode.l10n.t('Installing {0}…', modelId),
				cancellable: false,
			},
			async () => {
				const outcome = await deps.ml!.consentInstall(modelId, true);
				recordOutcome(summary, modelId, outcome, deps.log);
			},
		);
	}

	if (plan.includeOcr) {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: vscode.l10n.t('Installing scanned-PDF tools…'),
				cancellable: false,
			},
			async progress => {
				const result = await installOcrWithEnsure(deps.ml!, async message => {
					progress.report({ message });
				});
				if (result.sessionOutcome === 'installed') {
					summary.installed.push(UNLIMITED_OCR_MODEL_ID);
					deps.log(`Installed ${UNLIMITED_OCR_MODEL_ID}.`);
				} else if (result.sessionOutcome === 'already-ready') {
					summary.alreadyReady.push(UNLIMITED_OCR_MODEL_ID);
					deps.log(`${UNLIMITED_OCR_MODEL_ID} already ready.`);
				} else if (result.sessionOutcome === 'ineligible') {
					summary.errors.push({
						modelId: UNLIMITED_OCR_MODEL_ID,
						message: 'Not eligible on this computer.',
					});
					deps.log(`Install ${UNLIMITED_OCR_MODEL_ID} ineligible.`);
				} else {
					summary.errors.push({
						modelId: UNLIMITED_OCR_MODEL_ID,
						message: friendlyInstallError(result.errorMessage ?? 'Install did not complete.'),
					});
					deps.log(`Install ${UNLIMITED_OCR_MODEL_ID} failed: ${result.errorMessage ?? 'unknown'}`);
				}
			},
		);
	}

	if (plan.includeWhisper) {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: vscode.l10n.t('Installing Whisper speech model…'),
				cancellable: false,
			},
			async () => {
				try {
					await vscode.commands.executeCommand(INSTALL_WHISPER_COMMAND);
					summary.installed.push(WHISPER_MODEL_ID);
					deps.log(`Installed ${WHISPER_MODEL_ID} via ${INSTALL_WHISPER_COMMAND}.`);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					summary.errors.push({ modelId: WHISPER_MODEL_ID, message });
					deps.log(`Install ${WHISPER_MODEL_ID} failed: ${message}`);
				}
			},
		);
	}

	const anySuccess = summary.installed.length > 0 || summary.alreadyReady.length > 0;
	if (anySuccess) {
		try {
			await deps.onReady();
		} catch (err) {
			deps.log(
				`Post-install ready callback failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	summarizeToUser(summary, plan.includeOcr || plan.includeWhisper);
	return summary;
}

function recordOutcome(
	summary: {
		installed: string[];
		alreadyReady: string[];
		errors: { modelId: string; message: string }[];
		warnings: { modelId: string; message: string }[];
	},
	modelId: string,
	outcome: ConsentInstallOutcome,
	log: (message: string) => void,
): void {
	switch (outcome.kind) {
		case 'installed':
			summary.installed.push(modelId);
			log(`Installed ${modelId} (${outcome.version}).`);
			if (outcome.warning) {
				summary.warnings.push({ modelId, message: outcome.warning });
				log(`Install ${modelId} warning: ${outcome.warning}`);
			}
			break;
		case 'already-ready':
			summary.alreadyReady.push(modelId);
			log(`${modelId} already ready (${outcome.version}).`);
			break;
		case 'ineligible':
			summary.errors.push({
				modelId,
				message: outcome.reasons.join('; ') || 'Not eligible on this computer.',
			});
			log(`Install ${modelId} ineligible: ${outcome.reasons.join('; ')}`);
			break;
		case 'consent-required':
			summary.errors.push({ modelId, message: 'Consent is required before download.' });
			log(`Install ${modelId} refused: consent required.`);
			break;
		case 'error':
			summary.errors.push({ modelId, message: friendlyInstallError(outcome.message) });
			log(`Install ${modelId} failed: ${outcome.message}`);
			break;
	}
}

function summarizeToUser(summary: InstallMissingModelsSummary, includedOcr: boolean): void {
	if (summary.errors.length === 0) {
		if (summary.installed.length > 0) {
			const base = includedOcr
				? vscode.l10n.t(
					'Private Search models installed ({0}). Search and scanned-PDF tools can use them now.',
					summary.installed.join(', '),
				)
				: vscode.l10n.t(
					'Search pack models installed ({0}). Private Search can use them now.',
					summary.installed.join(', '),
				);
			if (summary.warnings.length > 0) {
				const warnDetail = summary.warnings.map(w => `${w.modelId}: ${w.message}`).join(' ');
				void vscode.window.showWarningMessage(
					vscode.l10n.t('{0} Note: {1}', base, warnDetail),
				);
			} else {
				void vscode.window.showInformationMessage(base);
			}
		} else if (
			summary.alreadyReady.length >= SEARCH_PACK_MODEL_IDS.length &&
			(!includedOcr || summary.alreadyReady.includes(UNLIMITED_OCR_MODEL_ID))
		) {
			void vscode.window.showInformationMessage(
				includedOcr
					? vscode.l10n.t('Private Search models are already installed on this computer.')
					: vscode.l10n.t('Search pack models are already installed on this computer.'),
			);
		} else if (summary.warnings.length > 0) {
			const warnDetail = summary.warnings.map(w => `${w.modelId}: ${w.message}`).join(' ');
			void vscode.window.showWarningMessage(warnDetail);
		}
		return;
	}

	const unpinned = summary.errors.some(error => isUnpinnedCatalogError(error));
	const setup = vscode.l10n.t('Set Up Private Search');
	const detail = summary.errors.map(error => `${error.modelId}: ${error.message}`).join(' ');
	if (unpinned) {
		void vscode.window.showWarningMessage(
			vscode.l10n.t(
				'Private Search install could not complete: model pins are not configured for this build. {0}',
				detail,
			),
			setup,
		).then(choice => {
			if (choice === setup) {
				void vscode.commands.executeCommand(SETUP_LOCAL_SEARCH_COMMAND);
			}
		});
		return;
	}

	void vscode.window.showWarningMessage(
		vscode.l10n.t('Some Private Search models could not be installed. {0}', detail),
	);
}

function isUnpinnedCatalogError(error: { readonly modelId: string; readonly message: string }): boolean {
	if (!/downloadUrl|sha256|pinned|not configured/i.test(error.message)) {
		return false;
	}
	if (error.modelId === UNLIMITED_OCR_MODEL_ID) {
		return true;
	}
	return /not pinned|not configured|no downloadUrl|no sha256/i.test(error.message);
}

function friendlyInstallError(raw: string): string {
	if (/downloadUrl|sha256|pinned/i.test(raw)) {
		return `${raw} Check Settings → Private Search → Install Missing Models, or set BYO SA_RAG_* model dirs.`;
	}
	return raw;
}
