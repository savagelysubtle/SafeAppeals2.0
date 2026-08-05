/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * Local slice of safeappeals-ml engine types (rootDir isolation — no sibling imports).
 */
export type ResourceKind = 'whisper' | 'diarization' | 'embedding' | 'docparse' | 'ffmpeg';

export interface MlLease {
	readonly id: string;
	readonly kind: ResourceKind;
	readonly jobId: string;
	release(): Promise<void>;
}

export interface AcquireOptions {
	jobId: string;
	signal?: AbortSignal;
	rejectIfBusy?: boolean;
}

export interface ResourceAdapter {
	readonly kind: ResourceKind;
	readonly estimateMb: number;
	load(signal: AbortSignal): Promise<void>;
	unload(): Promise<void>;
	cancel?(reason: string): void;
	isLoaded(): boolean;
}

export interface IMlResourceEngine {
	withLease<T>(
		kind: ResourceKind,
		options: AcquireOptions,
		fn: (lease: MlLease) => Promise<T>,
	): Promise<T>;
	registerAdapter(adapter: ResourceAdapter): void;
	reportCrash(kind: ResourceKind, message?: string): void;
	cancelJob?(jobId: string, reason?: string): void;
	requestUnload?(kind: ResourceKind): Promise<void>;
	dispose?(): Promise<void>;
}
