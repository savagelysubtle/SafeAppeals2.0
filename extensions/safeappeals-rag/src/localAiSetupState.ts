/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { HwSnapshot, ModelEvaluateResult } from './types';
import {
	BGE_SMALL_MODEL_ID,
	MS_MARCO_CE_MODEL_ID,
	UNLIMITED_OCR_MODEL_ID,
} from './types';

/** Ordered setup beats (lawyer-facing Local AI walkthrough). */
export type LocalAiSetupBeat = 'educate' | 'scan' | 'searchPack' | 'ocr' | 'done';

export type SearchPackChoice = 'installed' | 'skipped' | 'already-ready' | 'failed' | 'pending';
export type OcrChoice = 'installed' | 'skipped' | 'already-ready' | 'failed' | 'ineligible' | 'pending';

export interface FriendlyHwSummary {
	readonly graphicsMemoryLabel: string;
	readonly systemMemoryLabel: string;
	readonly freeDiskLabel: string;
	readonly verdict: 'ready-for-scanned' | 'text-pdfs-only';
	readonly verdictLabel: string;
	readonly reasonLine: string;
	readonly technicalDetails: readonly string[];
}

export interface LocalAiSetupSession {
	readonly beat: LocalAiSetupBeat;
	readonly hw: FriendlyHwSummary | undefined;
	readonly ocrEligible: boolean;
	readonly ocrReasons: readonly string[];
	readonly searchPack: SearchPackChoice;
	readonly ocr: OcrChoice;
	readonly searchPackError: string | undefined;
	readonly ocrError: string | undefined;
	readonly searchPackDiskMb: number;
	readonly ocrDiskMb: number;
}

export interface DoneSummary {
	readonly searchPackLine: string;
	readonly ocrLine: string;
	readonly reopenHint: string;
}

/** Approximate Search pack footprint (BGE + ms-marco CE) when catalog sizes unavailable. */
export const DEFAULT_SEARCH_PACK_DISK_MB = 350;
/** Approximate Unlimited-OCR footprint. */
export const DEFAULT_OCR_DISK_MB = 7000;

export const SEARCH_PACK_MODEL_IDS: readonly string[] = [BGE_SMALL_MODEL_ID, MS_MARCO_CE_MODEL_ID];

export function createInitialSession(options?: {
	readonly searchPackDiskMb?: number;
	readonly ocrDiskMb?: number;
}): LocalAiSetupSession {
	return {
		beat: 'educate',
		hw: undefined,
		ocrEligible: false,
		ocrReasons: [],
		searchPack: 'pending',
		ocr: 'pending',
		searchPackError: undefined,
		ocrError: undefined,
		searchPackDiskMb: options?.searchPackDiskMb ?? DEFAULT_SEARCH_PACK_DISK_MB,
		ocrDiskMb: options?.ocrDiskMb ?? DEFAULT_OCR_DISK_MB,
	};
}

/**
 * Format a hardware snapshot for lawyers (no CUDA / VRAM jargon in primary labels).
 */
export function formatFriendlyHwSummary(
	snapshot: HwSnapshot,
	ocrEval: ModelEvaluateResult,
): FriendlyHwSummary {
	const graphicsMemoryLabel =
		snapshot.gpuVramMb !== undefined
			? `${formatGbFromMb(snapshot.gpuVramMb)} graphics memory${snapshot.gpuName ? ` (${snapshot.gpuName})` : ''}`
			: 'Graphics memory not detected';
	const systemMemoryLabel = `${formatGbFromMb(snapshot.totalRamMb)} memory`;
	const freeDiskLabel = `${formatGbFromMb(snapshot.diskFreeMb)} free disk`;

	const technicalDetails = [
		`Platform: ${snapshot.platform} ${snapshot.arch}`,
		`CPU: ${snapshot.cpuModel} × ${snapshot.cpuCount}`,
		`RAM: ${snapshot.totalRamMb} MB total / ${snapshot.freeRamMb} MB free`,
		`Disk free: ${snapshot.diskFreeMb} MB`,
		`GPU: ${snapshot.gpuName ?? 'none'} / ${snapshot.gpuVramMb ?? 'unknown'} MB`,
		...ocrEval.reasons,
	];

	if (ocrEval.eligible) {
		return {
			graphicsMemoryLabel,
			systemMemoryLabel,
			freeDiskLabel,
			verdict: 'ready-for-scanned',
			verdictLabel: 'Ready for scanned PDFs',
			reasonLine: 'This computer can install optional tools to read scanned PDFs privately.',
			technicalDetails,
		};
	}

	const reasonLine = ocrEval.reasons[0]
		? softenReason(ocrEval.reasons[0])
		: 'This computer is set up for text PDFs and searchable documents.';

	return {
		graphicsMemoryLabel,
		systemMemoryLabel,
		freeDiskLabel,
		verdict: 'text-pdfs-only',
		verdictLabel: 'Text PDFs only',
		reasonLine,
		technicalDetails,
	};
}

export function applyScanResult(
	session: LocalAiSetupSession,
	snapshot: HwSnapshot,
	ocrEval: ModelEvaluateResult,
): LocalAiSetupSession {
	const hw = formatFriendlyHwSummary(snapshot, ocrEval);
	return {
		...session,
		beat: 'scan',
		hw,
		ocrEligible: ocrEval.eligible,
		ocrReasons: ocrEval.reasons,
		ocr: ocrEval.eligible ? session.ocr : 'ineligible',
	};
}

/**
 * Advance after the educate Continue CTA.
 */
export function advanceFromEducate(session: LocalAiSetupSession): LocalAiSetupSession {
	return { ...session, beat: 'scan' };
}

/**
 * Advance from scan → search pack.
 */
export function advanceFromScan(session: LocalAiSetupSession): LocalAiSetupSession {
	return { ...session, beat: 'searchPack' };
}

export function applySearchPackResult(
	session: LocalAiSetupSession,
	choice: Exclude<SearchPackChoice, 'pending'>,
	error?: string,
): LocalAiSetupSession {
	// Failures stay on the Search pack beat so the user can retry or choose Not Now.
	const nextBeat: LocalAiSetupBeat = choice === 'failed' ? 'searchPack' : 'ocr';
	return {
		...session,
		beat: nextBeat,
		searchPack: choice,
		searchPackError: error,
		ocr: session.ocrEligible ? (choice === 'failed' ? session.ocr : 'pending') : 'ineligible',
	};
}

export function applyOcrResult(
	session: LocalAiSetupSession,
	choice: Exclude<OcrChoice, 'pending'>,
	error?: string,
): LocalAiSetupSession {
	// Failures stay on the OCR beat so the user can retry or Skip.
	const nextBeat: LocalAiSetupBeat = choice === 'failed' ? 'ocr' : 'done';
	return {
		...session,
		beat: nextBeat,
		ocr: choice,
		ocrError: error,
	};
}

/**
 * Skip remaining installs and jump to done (completion still written by host).
 */
export function skipToDone(session: LocalAiSetupSession): LocalAiSetupSession {
	return {
		...session,
		beat: 'done',
		searchPack: session.searchPack === 'pending' ? 'skipped' : session.searchPack,
		ocr:
			session.ocr === 'pending'
				? (session.ocrEligible ? 'skipped' : 'ineligible')
				: session.ocr,
	};
}

export function buildDoneSummary(session: LocalAiSetupSession): DoneSummary {
	const searchPackLine = (() => {
		switch (session.searchPack) {
			case 'installed':
				return 'Search tools are installed on this computer.';
			case 'already-ready':
				return 'Search tools were already installed.';
			case 'failed':
				return session.searchPackError
					? `Search tools were not installed: ${session.searchPackError}`
					: 'Search tools were not installed.';
			case 'skipped':
				return 'Search tools were skipped. You can install them later.';
			default:
				return 'Search tools were not configured.';
		}
	})();

	const ocrLine = (() => {
		switch (session.ocr) {
			case 'installed':
				return 'Scanned-PDF reading tools are installed.';
			case 'already-ready':
				return 'Scanned-PDF reading tools were already installed.';
			case 'failed':
				return session.ocrError
					? `Scanned-PDF tools were not installed: ${session.ocrError}`
					: 'Scanned-PDF tools were not installed.';
			case 'skipped':
				return 'Scanned-PDF tools were skipped. Text PDFs still work.';
			case 'ineligible':
				return 'Scanned-PDF tools are not offered on this computer. Text PDFs still work.';
			default:
				return 'Scanned-PDF tools were not configured.';
		}
	})();

	return {
		searchPackLine,
		ocrLine,
		reopenHint: 'You can reopen Private Search Setup anytime from Help or the command palette.',
	};
}

export function formatDiskSizeLabel(diskMb: number): string {
	if (diskMb >= 1000) {
		return `~${(diskMb / 1000).toFixed(diskMb >= 10_000 ? 0 : 1)} GB`;
	}
	return `~${diskMb} MB`;
}

function formatGbFromMb(mb: number): string {
	const gb = mb / 1024;
	if (gb >= 10) {
		return `${Math.round(gb)} GB`;
	}
	return `${gb.toFixed(1)} GB`;
}

function softenReason(reason: string): string {
	return reason
		.replace(/Graphics memory/gi, 'Graphics memory')
		.replace(/\bVRAM\b/gi, 'graphics memory')
		.replace(/\bCUDA\b/gi, 'GPU acceleration');
}

/** Re-export model ids used by the Search pack / OCR beats for host install loops. */
export { BGE_SMALL_MODEL_ID, MS_MARCO_CE_MODEL_ID, UNLIMITED_OCR_MODEL_ID };
