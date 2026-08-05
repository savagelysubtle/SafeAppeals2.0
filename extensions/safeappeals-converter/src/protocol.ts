/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type {
	AvailableConversions,
	ConversionFidelity,
	ConversionSpec,
	SidecarErrorResponse,
	SidecarProgressNotification,
	SidecarResponse,
} from './types';

const VALID_FIDELITIES = new Set<string>([
	'office-fidelity',
	'browser-print',
	'semantic',
	'preview-fast',
	'pdf-ops',
	'ocr',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseConversionSpec(key: string, raw: unknown): ConversionSpec | undefined {
	if (!isRecord(raw)) {
		return undefined;
	}
	const fidelity = String(raw.fidelity ?? raw.key ?? key);
	if (!VALID_FIDELITIES.has(fidelity)) {
		return undefined;
	}
	return {
		key: String(raw.key ?? key),
		fidelity: fidelity as ConversionFidelity,
		engine: String(raw.engine ?? 'unknown'),
		available: Boolean(raw.available),
		install_hint: typeof raw.install_hint === 'string' ? raw.install_hint : undefined,
	};
}

/**
 * Parse the `result` payload from `get_available_conversions`.
 * Exported for unit tests with mock sidecar responses.
 */
export function parseAvailableConversions(result: unknown): AvailableConversions {
	if (!isRecord(result)) {
		return { conversions: {}, aliases: {} };
	}

	const conversions: Record<string, ConversionSpec> = {};
	const rawConversions = result.conversions;
	if (isRecord(rawConversions)) {
		for (const [key, value] of Object.entries(rawConversions)) {
			const spec = parseConversionSpec(key, value);
			if (spec) {
				conversions[key] = spec;
			}
		}
	}

	const aliases: Record<string, string> = {};
	const rawAliases = result.aliases;
	if (isRecord(rawAliases)) {
		for (const [alias, canonical] of Object.entries(rawAliases)) {
			if (typeof canonical === 'string') {
				aliases[alias] = canonical;
			}
		}
	}

	return { conversions, aliases };
}

export function isSidecarResponse(line: unknown): line is SidecarResponse {
	return isRecord(line) && typeof line.id === 'string' && isRecord(line.result);
}

export function isSidecarErrorResponse(line: unknown): line is SidecarErrorResponse {
	return isRecord(line) && typeof line.id === 'string' && isRecord(line.error);
}

export function isSidecarProgressNotification(line: unknown): line is SidecarProgressNotification {
	return (
		isRecord(line)
		&& line.method === 'progress'
		&& isRecord(line.params)
		&& typeof line.params.job_id === 'string'
	);
}

export function resolveConversionKey(
	key: string,
	available: AvailableConversions,
): string {
	return available.aliases[key] ?? key;
}

export function getConversionSpec(
	key: string,
	available: AvailableConversions,
): ConversionSpec | undefined {
	const canonical = resolveConversionKey(key, available);
	return available.conversions[canonical];
}

/** Returns an error message when the conversion is missing or unavailable. */
export function unavailableConversionMessage(
	type: string,
	available: AvailableConversions,
): string | undefined {
	const spec = getConversionSpec(type, available);
	if (!spec) {
		return `Unknown conversion type: ${type}`;
	}
	if (!spec.available) {
		return spec.install_hint ?? `Conversion "${spec.key}" is not available.`;
	}
	return undefined;
}
