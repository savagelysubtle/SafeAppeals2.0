/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { HwSnapshot, ModelEvaluateResult, ModelSpec } from './types';

/**
 * Seeded Unlimited-OCR thresholds (HF baidu/Unlimited-OCR; ≥~8GB VRAM / ~7GB disk).
 *
 * `downloadUrl` / `sha256` stay unset until a real artifact is pinned (rung-14 / ops).
 * ConsentInstall refuses download until those fields (or call-site overrides) are set —
 * tests inject a fetcher + pinned digest. Never auto-download.
 */
export const UNLIMITED_OCR_SPEC: ModelSpec = {
	id: 'unlimited-ocr',
	version: '1.0.0',
	minVramMb: 8192,
	minRamMb: 16384,
	diskMb: 7000,
	backends: ['cuda-vllm'],
	pageSoftCap: 40,
	artifactFileName: 'model.safetensors',
	// downloadUrl / sha256: pin when shipping a real weight bundle; ConsentInstall blocks until set.
};

/** BGE-small embedding model (Search pack; CPU ONNX Runtime). */
export const BGE_SMALL_SPEC: ModelSpec = {
	id: 'bge-small-en-v1.5',
	version: '1.0.0',
	minVramMb: 0,
	minRamMb: 1024,
	diskMb: 200,
	backends: ['cpu-ort'],
	artifactFileName: 'model.onnx',
};

/** ms-marco MiniLM cross-encoder (Search pack; CPU ONNX Runtime). */
export const MS_MARCO_MINILM_SPEC: ModelSpec = {
	id: 'ms-marco-minilm-l6-v2',
	version: '1.0.0',
	minVramMb: 0,
	minRamMb: 1024,
	diskMb: 150,
	backends: ['cpu-ort'],
	artifactFileName: 'model.onnx',
};

const DEFAULT_SPECS: readonly ModelSpec[] = [
	UNLIMITED_OCR_SPEC,
	BGE_SMALL_SPEC,
	MS_MARCO_MINILM_SPEC,
];

/**
 * Declarative model catalog. Eligibility via {@link evaluate}; downloads live in ModelArtifactStore.
 */
export class ModelCatalog {
	private readonly byId: Map<string, ModelSpec>;

	constructor(specs: readonly ModelSpec[] = DEFAULT_SPECS) {
		this.byId = new Map(specs.map(spec => [spec.id, spec]));
	}

	get(modelId: string): ModelSpec | undefined {
		return this.byId.get(modelId);
	}

	list(): readonly ModelSpec[] {
		return [...this.byId.values()];
	}

	/**
	 * Compare a model’s declared thresholds to a hardware snapshot.
	 * Unknown GPU (`gpuVramMb === undefined`) fails any positive `minVramMb`.
	 */
	evaluate(modelId: string, snapshot: HwSnapshot): ModelEvaluateResult {
		const spec = this.byId.get(modelId);
		if (!spec) {
			return {
				eligible: false,
				reasons: [`Unknown model: ${modelId}`],
			};
		}

		const reasons: string[] = [];

		if (spec.minVramMb > 0) {
			if (snapshot.gpuVramMb === undefined) {
				reasons.push(`Graphics memory unknown; needs at least ${spec.minVramMb} MB`);
			} else if (snapshot.gpuVramMb < spec.minVramMb) {
				reasons.push(
					`Graphics memory ${snapshot.gpuVramMb} MB is below the ${spec.minVramMb} MB requirement`,
				);
			}
		}

		if (snapshot.totalRamMb < spec.minRamMb) {
			reasons.push(
				`System memory ${snapshot.totalRamMb} MB is below the ${spec.minRamMb} MB requirement`,
			);
		}

		if (snapshot.diskFreeMb < spec.diskMb) {
			reasons.push(
				`Free disk ${snapshot.diskFreeMb} MB is below the ${spec.diskMb} MB requirement`,
			);
		}

		return {
			eligible: reasons.length === 0,
			reasons,
		};
	}
}

export function createDefaultModelCatalog(): ModelCatalog {
	return new ModelCatalog();
}
