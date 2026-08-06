/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * Best-effort hardware snapshot used by {@link ModelCatalog.evaluate}.
 * Missing GPU fields mean “unknown / unavailable”, not zero VRAM.
 */
export interface HwSnapshot {
	readonly platform: NodeJS.Platform;
	readonly arch: string;
	readonly osRelease: string;
	readonly cpuModel: string;
	readonly cpuCount: number;
	/** Total system RAM in megabytes. */
	readonly totalRamMb: number;
	/** Approximately free system RAM in megabytes. */
	readonly freeRamMb: number;
	/** Free disk space on the probe path in megabytes. */
	readonly diskFreeMb: number;
	/**
	 * Total GPU VRAM in megabytes when known.
	 * `undefined` when no GPU probe succeeded (never invents a value).
	 */
	readonly gpuVramMb: number | undefined;
	/** Primary GPU name when known. */
	readonly gpuName: string | undefined;
	/** Unix ms when the snapshot was taken. */
	readonly probedAt: number;
}

/** One file in a multi-file HuggingFace-style model pack. */
export interface ModelArtifactFilePin {
	readonly relativePath: string;
	readonly downloadUrl: string;
	readonly sha256: string;
}

/**
 * Declarative model install / eligibility thresholds + artifact pin fields.
 * Downloads require consent via {@link ModelArtifactStore.downloadWithConsent}.
 *
 * When {@link ModelSpec.files} is set, top-level `downloadUrl` / `artifactFileName` are
 * unused for download; top-level `sha256` is the pack digest over all pinned files.
 */
export interface ModelSpec {
	readonly id: string;
	/** Artifact version directory name under `ml-models/<id>/`. */
	readonly version?: string;
	/** Minimum GPU VRAM in MB. `0` means VRAM is not required (CPU backends). */
	readonly minVramMb: number;
	/** Minimum system RAM in MB. */
	readonly minRamMb: number;
	/** Approximate on-disk footprint in MB required to install. */
	readonly diskMb: number;
	/** Declared runtime backends (informational for adapters). */
	readonly backends: readonly string[];
	/** Expected artifact digest (required before consent download succeeds). */
	readonly sha256?: string;
	/** Consent-download URL (required before consent download succeeds). */
	readonly downloadUrl?: string;
	/** File name written under the version directory. */
	readonly artifactFileName?: string;
	/** Multi-file pack pins (HF-style dirs with onnx/, tokenizer.json, etc.). */
	readonly files?: readonly ModelArtifactFilePin[];
	/** Soft page cap for OCR-style models (e.g. Unlimited-OCR ≈ 40). */
	readonly pageSoftCap?: number;
}

export interface ModelEvaluateResult {
	readonly eligible: boolean;
	readonly reasons: string[];
}
