/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ResourceAdapter } from './ml/types';
import type { AcquireOptions, MlLease, ResourceKind } from './ml/types';

const ML_EXTENSION_ID = 'safeappeals.safeappeals-ml';

/**
 * Minimal surface of safeappeals-ml {@link MlResourceEngine} used by audio.
 * Kept local so compile does not import sibling sources under rootDir.
 */
export interface IMlResourceEngine {
	withLease<T>(
		kind: ResourceKind,
		options: AcquireOptions,
		fn: (lease: MlLease) => Promise<T>,
	): Promise<T>;
	acquire(kind: ResourceKind, options: AcquireOptions): Promise<MlLease>;
	registerAdapter(adapter: ResourceAdapter): void;
	reportCrash(kind: ResourceKind, message?: string): void;
	cancelJob(jobId: string, reason?: string): void;
	requestUnload(kind: ResourceKind): Promise<void>;
	dispose(): Promise<void>;
}

export interface SafeAppealsMlEngineApi {
	readonly engine: IMlResourceEngine;
	withLease<T>(
		kind: ResourceKind,
		options: AcquireOptions,
		fn: (lease: MlLease) => Promise<T>,
	): Promise<T>;
	reportCrash(kind: ResourceKind, message?: string): void;
	registerAdapter(adapter: ResourceAdapter): void;
}

/**
 * Resolve the shared {@link IMlResourceEngine} from activated safeappeals-ml.
 */
export async function resolveMlResourceEngine(
	log?: (message: string) => void,
): Promise<IMlResourceEngine | undefined> {
	const ext = vscode.extensions.getExtension<SafeAppealsMlEngineApi>(ML_EXTENSION_ID);
	if (!ext) {
		log?.(`safeappeals-ml extension not found (${ML_EXTENSION_ID})`);
		return undefined;
	}
	const api = ext.isActive ? ext.exports : await ext.activate();
	if (!api?.engine) {
		log?.('safeappeals-ml activate() did not export engine');
		return undefined;
	}
	return api.engine;
}

/** Duck-type busy errors across the extension boundary (distinct class copies). */
export function isMlBusyError(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}
	const e = error as { name?: string; code?: string };
	return e.name === 'MlBusyError' || e.code === 'busy';
}
