/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

export type ResourceKind = 'whisper' | 'diarization' | 'embedding' | 'docparse' | 'ffmpeg';

export type SlotState = 'cold' | 'loading' | 'ready' | 'running' | 'unloading' | 'crashed';

export interface MlEngineOptions {
	/** Default 2048 — EH + children on 8GB-class machines. */
	readonly peakRssBudgetMb: number;
	/** Default 30_000 — unload after last release when idle. */
	readonly idleUnloadMs: number;
	/** Default 15 * 60_000 — max time spent waiting in the acquire queue. */
	readonly acquireTimeoutMs: number;
	readonly estimatesMb: Record<ResourceKind, number>;
}

export interface MlLease {
	readonly id: string;
	readonly kind: ResourceKind;
	readonly jobId: string;
	release(): Promise<void>;
}

export interface SlotSnapshot {
	state: SlotState;
	refCount: number;
	lastUsedAt?: number;
}

export interface MlEngineSnapshot {
	heavyKindLoaded?: ResourceKind;
	activeJobId?: string;
	queueLength: number;
	estimatedRssMb: number;
	budgetMb: number;
	slots: Record<ResourceKind, SlotSnapshot>;
}

export interface ResourceAdapter {
	readonly kind: ResourceKind;
	readonly estimateMb: number;
	load(signal: AbortSignal): Promise<void>;
	unload(): Promise<void>;
	/** Optional: cooperative cancel of in-flight native work. */
	cancel?(reason: string): void;
	isLoaded(): boolean;
}

export interface AcquireOptions {
	jobId: string;
	signal?: AbortSignal;
	/** When true, fail fast instead of queue (e.g. UI double-click). */
	rejectIfBusy?: boolean;
}

/**
 * Estimated EH / owned-child RSS. Docparse inference stays in a localhost sidecar
 * (never in EH); the estimate covers client bookkeeping + optional owned child.
 */
export const DEFAULT_ML_ESTIMATES_MB: Record<ResourceKind, number> = {
	whisper: 800,
	diarization: 200,
	embedding: 400,
	docparse: 1600,
	ffmpeg: 50,
};

export const DEFAULT_ML_ENGINE_OPTIONS: MlEngineOptions = {
	peakRssBudgetMb: 2048,
	idleUnloadMs: 30_000,
	acquireTimeoutMs: 15 * 60_000,
	estimatesMb: { ...DEFAULT_ML_ESTIMATES_MB },
};

/**
 * Derive peak RSS budget from total system RAM (Mb).
 * Heavy XOR is unchanged — this limits heavy + ffmpeg stack on laptops.
 */
export function peakRssBudgetFromTotalRamMb(totalRamMb: number): number {
	if (!Number.isFinite(totalRamMb) || totalRamMb <= 0) {
		return DEFAULT_ML_ENGINE_OPTIONS.peakRssBudgetMb;
	}
	return Math.max(1024, Math.min(4096, Math.floor(totalRamMb * 0.25)));
}

const HEAVY_KINDS: readonly ResourceKind[] = ['whisper', 'diarization', 'embedding', 'docparse'];

export function isHeavyKind(kind: ResourceKind): boolean {
	return HEAVY_KINDS.includes(kind);
}

export function heavyKinds(): readonly ResourceKind[] {
	return HEAVY_KINDS;
}
