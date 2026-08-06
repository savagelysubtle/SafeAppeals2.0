/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { formatRagStatsString } from './toolContracts';
import type { IndexWriteRole, RagStats } from './ragCoreHost';
import type { HardDisableCode } from './types';

/** Counts from the most recent folder startup scan (primary window). */
export interface IngestLastScanStats {
	readonly skipped: number;
	readonly indexed: number;
	readonly hardDisable: number;
}

export interface IngestSummaryInput {
	readonly available: boolean;
	readonly disableCode: HardDisableCode | undefined;
	readonly disableMessage: string | undefined;
	readonly indexWriteRole: IndexWriteRole | undefined;
	readonly indexWriteCapable: boolean | undefined;
	readonly indexing: boolean;
	readonly inFlight: number;
	readonly stats: RagStats | undefined;
	readonly docParseReady: boolean;
	readonly modelsPresent: boolean | undefined;
	readonly lastScan?: IngestLastScanStats;
}

/** Primary modal title — includes doc count when the index is open. */
export function formatIngestSummaryPrimaryMessage(input: IngestSummaryInput): string {
	if (input.stats) {
		const n = input.stats.documents;
		return n === 1
			? 'Private Search — 1 doc indexed'
			: `Private Search — ${n} docs indexed`;
	}
	return 'Private Search';
}

/**
 * User-facing ingest summary lines (status-bar click / showStatus).
 * Full engineer detail stays in the Private Search output channel.
 */
export function formatIngestSummaryLines(input: IngestSummaryInput): string[] {
	const lines: string[] = [];

	const roleLabel =
		input.indexWriteRole === 'secondary'
			? 'Agents window (read-only search)'
			: 'Primary window';
	const capabilityLabel = input.indexWriteCapable ? 'index + search' : 'search only';
	lines.push(`Session: ${roleLabel} — ${capabilityLabel}`);

	if (input.indexing) {
		const suffix = input.inFlight === 1 ? '1 file' : `${input.inFlight} files`;
		lines.push(`Indexing: in progress (${suffix})`);
	} else {
		lines.push('Indexing: idle');
	}

	if (input.stats) {
		lines.push(
			`Index: ${input.stats.documents} docs · ${input.stats.chunks} chunks · ${input.stats.vectors} vectors`,
		);
	} else {
		lines.push('Index: no workspace open');
	}

	lines.push(`DocParse (scanned PDF): ${input.docParseReady ? 'ready' : 'not ready'}`);

	if (input.lastScan) {
		const { skipped, indexed, hardDisable } = input.lastScan;
		const parts: string[] = [];
		if (skipped > 0) {
			parts.push(`${skipped} skipped`);
		}
		if (indexed > 0) {
			parts.push(`${indexed} indexed`);
		}
		if (hardDisable > 0) {
			parts.push(`${hardDisable} blocked`);
		}
		lines.push(
			parts.length > 0
				? `Last scan: ${parts.join(', ')}`
				: 'Last scan: no files processed',
		);
	}

	if (input.disableCode === 'models-missing') {
		lines.push('Status: local search models not installed');
	} else if (!input.available) {
		lines.push(
			input.disableMessage
				? `Status: unavailable — ${input.disableMessage}`
				: 'Status: unavailable',
		);
	} else if (input.modelsPresent === false) {
		lines.push('Status: search models not ready');
	} else {
		lines.push('Status: ready for on-device search');
	}

	return lines;
}

/** Single detail string for `showInformationMessage` `{ detail }`. */
export function formatIngestSummaryDetail(input: IngestSummaryInput): string {
	const lines = formatIngestSummaryLines(input);
	if (input.stats) {
		lines.push('');
		lines.push(formatRagStatsString(input.stats));
	}
	return lines.join('\n');
}
