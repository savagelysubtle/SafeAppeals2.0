/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

export const OCR_INSTALL_START_PERCENT = 5;
export const OCR_INSTALLING_MIN_PERCENT = 10;
export const OCR_INSTALLING_MAX_PERCENT = 80;
export const OCR_STARTING_PERCENT = 85;
export const OCR_CONNECTING_PERCENT = 95;
export const OCR_DONE_PERCENT = 100;

export interface FileDownloadProgressInput {
	readonly completedFiles: number;
	readonly totalFiles: number;
	readonly bytesReceived?: number;
	readonly bytesTotal?: number;
	readonly packBytesReceived?: number;
	readonly packBytesTotal?: number;
}

export interface FileDownloadPercentResult {
	readonly percent?: number;
	readonly indeterminate: boolean;
}

/** Format byte counts as human-readable GB/MB/KB labels. */
export function formatByteCount(bytes: number): string {
	if (bytes >= 1024 ** 3) {
		return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
	}
	if (bytes >= 1024 ** 2) {
		return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
	}
	if (bytes >= 1024) {
		return `${Math.round(bytes / 1024)} KB`;
	}
	return `${bytes} B`;
}

/**
 * Map multi-file download progress into the installing phase band (default 10–80%).
 * Prefers pack-level byte progress when totals are known; otherwise blends
 * completed files with in-file byte fraction.
 */
export function mapFileDownloadPercent(
	input: FileDownloadProgressInput,
	minPercent = OCR_INSTALLING_MIN_PERCENT,
	maxPercent = OCR_INSTALLING_MAX_PERCENT,
): FileDownloadPercentResult {
	const {
		completedFiles,
		totalFiles,
		bytesReceived,
		bytesTotal,
		packBytesReceived,
		packBytesTotal,
	} = input;

	if (
		packBytesTotal !== undefined &&
		packBytesTotal > 0 &&
		packBytesReceived !== undefined
	) {
		const fraction = Math.min(packBytesReceived / packBytesTotal, 1);
		return {
			percent: Math.round(minPercent + fraction * (maxPercent - minPercent)),
			indeterminate: false,
		};
	}

	if (totalFiles <= 0) {
		return { percent: minPercent, indeterminate: false };
	}

	const completed = Math.min(completedFiles, totalFiles);
	const received = bytesReceived ?? 0;
	const hasKnownTotal = bytesTotal !== undefined && bytesTotal > 0;

	if (received > 0 && !hasKnownTotal && completed < totalFiles) {
		return { indeterminate: true };
	}

	let blended = completed;
	if (hasKnownTotal) {
		blended += Math.min(received / bytesTotal!, 1);
	}

	const fraction = Math.min(blended / totalFiles, 1);
	return {
		percent: Math.round(minPercent + fraction * (maxPercent - minPercent)),
		indeterminate: false,
	};
}

/** Short label for OCR pack file download status. */
export function formatOcrDownloadStatus(
	progress: FileDownloadProgressInput & { readonly relativePath?: string },
): string {
	const fileNum = Math.min(progress.completedFiles + 1, progress.totalFiles);
	const base = `Downloading scanned-PDF tools (${fileNum}/${progress.totalFiles})`;

	if (
		progress.packBytesReceived !== undefined &&
		progress.packBytesTotal !== undefined &&
		progress.packBytesTotal > 0
	) {
		return `${base}: ${formatByteCount(progress.packBytesReceived)} / ${formatByteCount(progress.packBytesTotal)}`;
	}

	if (progress.relativePath) {
		const name = progress.relativePath.split('/').pop() ?? progress.relativePath;
		return `${base}: ${name}…`;
	}
	return `${base}…`;
}

/** Percent complete after each Search pack model finishes (e.g. 50% after first of two). */
export function searchPackModelPercent(completedModels: number, totalModels: number): number {
	if (totalModels <= 0) {
		return 0;
	}
	return Math.round((Math.min(completedModels, totalModels) / totalModels) * 100);
}
