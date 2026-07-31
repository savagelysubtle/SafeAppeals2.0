/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isAllowedExternalHttpsUrl } from './externalUrl';

/**
 * Thrown when the cloud API returns HTTP 402 (or an SSE error with the same meaning).
 * Optional fields are parsed from an untrusted body and may be absent.
 */
export class InsufficientCreditsError extends Error {
	readonly required: number | undefined;
	readonly available: number | undefined;
	/** Only set when the server URL passes https + hostname allow-list validation. */
	readonly purchaseUrl: string | undefined;

	constructor(options: {
		readonly message?: string;
		readonly required?: number;
		readonly available?: number;
		readonly purchaseUrl?: string;
	} = {}) {
		super(options.message ?? 'Not enough credits for this request');
		this.name = 'InsufficientCreditsError';
		this.required = options.required;
		this.available = options.available;
		this.purchaseUrl = options.purchaseUrl;
	}
}

/**
 * Parses an untrusted 402 (or SSE error) body into {@link InsufficientCreditsError}.
 * `purchaseUrl` is kept only when it passes {@link isAllowedExternalHttpsUrl}.
 */
export function parseInsufficientCreditsError(body: unknown): InsufficientCreditsError {
	const root = asRecord(body);
	const error = asRecord(root?.error) ?? root;
	const message = typeof error?.message === 'string' && error.message.trim()
		? error.message.trim()
		: undefined;
	const required = asFiniteNumber(error?.required);
	const available = asFiniteNumber(error?.available);
	const rawPurchaseUrl = typeof error?.purchaseUrl === 'string' ? error.purchaseUrl : undefined;
	const purchaseUrl = rawPurchaseUrl && isAllowedExternalHttpsUrl(rawPurchaseUrl)
		? rawPurchaseUrl
		: undefined;
	return new InsufficientCreditsError({ message, required, available, purchaseUrl });
}

/**
 * Returns true when an SSE / JSON error payload indicates insufficient credits (402).
 * Used mid-stream so 402 is branched before any auth refresh / retry.
 */
export function isInsufficientCreditsPayload(body: unknown): boolean {
	const root = asRecord(body);
	const error = asRecord(root?.error) ?? root;
	if (!error) {
		return false;
	}
	const status = asFiniteNumber(error.status) ?? asFiniteNumber(root?.status);
	if (status === 402) {
		return true;
	}
	const code = typeof error.code === 'string' ? error.code.toUpperCase() : '';
	return code === 'INSUFFICIENT_CREDITS' || code === '402';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
