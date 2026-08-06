/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { isArtifactPinConfigured } from './artifactPin';
import {
	formatOcrDownloadStatus,
	mapFileDownloadPercent,
	OCR_CONNECTING_PERCENT,
	OCR_INSTALL_START_PERCENT,
	OCR_STARTING_PERCENT,
} from './localAiSetupProgress';
import type { MlBridge } from './mlBridge';
import type { ConsentInstallProgress } from './mlBridge';
import type { ConsentInstallOutcome } from './types';
import { UNLIMITED_OCR_MODEL_ID } from './types';

export type OcrInstallSessionOutcome = 'installed' | 'already-ready' | 'failed' | 'ineligible';

export interface OcrInstallAndEnsureResult {
	readonly sessionOutcome: OcrInstallSessionOutcome;
	readonly errorMessage?: string;
}

export type InstallProgressReporter = (
	message: string,
	percent?: number,
	indeterminate?: boolean,
) => void | Promise<void>;

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

function reportDownloadProgress(
	progress: ConsentInstallProgress,
	reportProgress: InstallProgressReporter,
): void {
	const mapped = mapFileDownloadPercent(progress);
	void reportProgress(
		formatOcrDownloadStatus(progress),
		mapped.percent,
		mapped.indeterminate,
	);
}

/**
 * Consent-install Unlimited-OCR, then ensure DocParse sidecar is ready.
 * Only returns `installed` / `already-ready` when ensure succeeds.
 */
export async function installOcrWithEnsure(
	ml: MlBridge,
	reportProgress: InstallProgressReporter,
): Promise<OcrInstallAndEnsureResult> {
	const ocrSpec = ml.catalog.get?.(UNLIMITED_OCR_MODEL_ID);
	if (!isArtifactPinConfigured(ocrSpec)) {
		return {
			sessionOutcome: 'failed',
			errorMessage: 'Unlimited-OCR download pins are not configured for this build.',
		};
	}

	await reportProgress('Installing scanned-PDF tools…', OCR_INSTALL_START_PERCENT, false);
	const outcome = await ml.consentInstall(UNLIMITED_OCR_MODEL_ID, true, {
		onProgress: progress => {
			reportDownloadProgress(progress, reportProgress);
		},
	});
	const classified = classifyOutcome(outcome);
	if (classified === 'ineligible') {
		return { sessionOutcome: 'ineligible' };
	}
	if (classified === 'failed') {
		return { sessionOutcome: 'failed', errorMessage: outcomeMessage(outcome) };
	}

	await reportProgress('Starting scanned PDF tools…', OCR_STARTING_PERCENT, false);
	await reportProgress('Connecting…', OCR_CONNECTING_PERCENT, false);
	const ensureResult = await ml.ensureDocParseReady();
	if (!ensureResult.ready) {
		const detail = ensureResult.detail?.trim();
		return {
			sessionOutcome: 'failed',
			errorMessage: detail
				? `Download finished but scanned PDF tools could not start: ${detail}`
				: 'Download finished but scanned PDF tools could not start. Try again.',
		};
	}

	return { sessionOutcome: classified };
}
