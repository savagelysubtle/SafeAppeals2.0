/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { resolveInstallMissingModelsPlan } from './installMissingModels';
import {
	DEFAULT_OCR_DISK_MB,
	DEFAULT_SEARCH_PACK_DISK_MB,
	SEARCH_PACK_MODEL_IDS,
} from './localAiSetupState';
import type { MlBridge } from './mlBridge';
import { UNLIMITED_OCR_MODEL_ID } from './types';

/** Command that returns a JSON-serializable Private Search setup scan. */
export const GET_SETUP_SCAN_COMMAND = 'safeappeals-rag.getSetupScan';

export type SetupScanSearchStatus = 'ready' | 'missing' | 'unavailable';
export type SetupScanOcrStatus = 'ready' | 'missing-eligible' | 'ineligible' | 'unavailable';

export interface PrivateSearchSetupScan {
	readonly searchPack: {
		readonly status: SetupScanSearchStatus;
		readonly readyModelIds: readonly string[];
		readonly missingModelIds: readonly string[];
		readonly diskMb: number;
	};
	readonly ocr: {
		readonly status: SetupScanOcrStatus;
		readonly diskMb: number;
	};
	readonly includeOcrInInstall: boolean;
}

/**
 * Read-only setup scan for Welcome Onboarding Get Started (Search pack + OCR readiness).
 */
export async function buildPrivateSearchSetupScan(
	ml: MlBridge | undefined,
): Promise<PrivateSearchSetupScan> {
	if (!ml) {
		return {
			searchPack: {
				status: 'unavailable',
				readyModelIds: [],
				missingModelIds: [],
				diskMb: DEFAULT_SEARCH_PACK_DISK_MB,
			},
			ocr: {
				status: 'unavailable',
				diskMb: DEFAULT_OCR_DISK_MB,
			},
			includeOcrInInstall: false,
		};
	}

	const plan = await resolveInstallMissingModelsPlan(ml);
	const readyModelIds: string[] = [];
	const missingModelIds: string[] = [];

	for (const modelId of SEARCH_PACK_MODEL_IDS) {
		const ready = await ml.artifacts.isReady(modelId);
		if (ready) {
			readyModelIds.push(modelId);
		} else {
			missingModelIds.push(modelId);
		}
	}

	const searchPackStatus: SetupScanSearchStatus =
		missingModelIds.length === 0 ? 'ready' : 'missing';

	const ocrReady = await ml.artifacts.isReady(UNLIMITED_OCR_MODEL_ID);
	let ocrStatus: SetupScanOcrStatus;
	if (ocrReady) {
		ocrStatus = 'ready';
	} else if (plan.includeOcr) {
		ocrStatus = 'missing-eligible';
	} else {
		ocrStatus = 'ineligible';
	}

	return {
		searchPack: {
			status: searchPackStatus,
			readyModelIds,
			missingModelIds,
			diskMb: plan.searchPackDiskMb,
		},
		ocr: {
			status: ocrStatus,
			diskMb: plan.ocrDiskMb,
		},
		includeOcrInInstall: plan.includeOcr,
	};
}
