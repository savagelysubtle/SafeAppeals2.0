/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { HardDisableCode } from './types';

/** Status-bar presentation for Private Search (left strip). */
export type PrivateSearchBarKind = 'ready' | 'readOnlySearch' | 'indexing' | 'setupNeeded' | 'unavailable';

export interface PrivateSearchBarInput {
	/** Host reports Private Search is fully available for search/index. */
	readonly available: boolean;
	readonly disableCode: HardDisableCode | undefined;
	/** True when this EH is secondary (search-only; flock held elsewhere). */
	readonly isSecondary: boolean;
	/** True while IndexPipeline has in-flight work. */
	readonly indexing: boolean;
	/** Indexed document count when known (Ready text). */
	readonly documentCount: number | undefined;
}

export interface PrivateSearchBarState {
	readonly kind: PrivateSearchBarKind;
	readonly text: string;
	readonly tooltip: string;
}

/**
 * Pure mapping from host + indexing → status-bar kind/text/tooltip keys.
 * Strings are English defaults; callers may wrap with l10n for UI.
 */
export function resolvePrivateSearchBarState(input: PrivateSearchBarInput): PrivateSearchBarState {
	if (input.indexing) {
		return {
			kind: 'indexing',
			text: '$(sync~spin) Private Search',
			tooltip: 'Indexing workspace files…',
		};
	}

	if (input.disableCode === 'models-missing') {
		return {
			kind: 'setupNeeded',
			text: '$(warning) Private Search',
			tooltip: 'Local search models not installed. Click for status.',
		};
	}

	if (input.isSecondary && input.available) {
		const n = input.documentCount ?? 0;
		return {
			kind: 'readOnlySearch',
			text: `$(search) Private Search · ${n} docs (read-only)`,
			tooltip: 'On-device search (read-only). Indexing runs in the main window.',
		};
	}

	if (!input.available || input.disableCode !== undefined) {
		return {
			kind: 'unavailable',
			text: '$(error) Private Search',
			tooltip: 'Private Search unavailable. Click for details.',
		};
	}

	const n = input.documentCount ?? 0;
	return {
		kind: 'ready',
		text: `$(search) Private Search · ${n} docs`,
		tooltip: 'On-device search. Click for status.',
	};
}

/** Toast category shown once at activate (not per-file). */
export type PrivateSearchActivateToast =
	| { readonly kind: 'runningAndIndexing' }
	| { readonly kind: 'modelsMissing' }
	| { readonly kind: 'unavailable'; readonly code: HardDisableCode }
	| { readonly kind: 'none' };

/**
 * Decide the one-shot activate toast from host status + whether a scan was scheduled.
 */
export function resolveActivateToast(input: {
	readonly available: boolean;
	readonly disableCode: HardDisableCode | undefined;
	readonly isSecondary: boolean;
	readonly indexingOrScanScheduled: boolean;
}): PrivateSearchActivateToast {
	if (input.disableCode === 'models-missing') {
		return { kind: 'modelsMissing' };
	}
	if (
		input.disableCode === 'native-missing' ||
		input.disableCode === 'index-lock-busy' ||
		input.disableCode === 'crypto-unavailable'
	) {
		return { kind: 'unavailable', code: input.disableCode };
	}
	if (input.disableCode !== undefined || !input.available) {
		return { kind: 'unavailable', code: input.disableCode ?? 'native-missing' };
	}
	if (input.isSecondary) {
		return { kind: 'none' };
	}
	if (input.indexingOrScanScheduled) {
		return { kind: 'runningAndIndexing' };
	}
	return { kind: 'none' };
}
