/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { HwSnapshot, ModelEvaluateResult, ModelSpec } from './types';

/**
 * Unlimited-OCR thresholds + HF commit-pinned artifact pack (baidu/Unlimited-OCR).
 * Consent install only when {@link isArtifactPinConfigured} and HW eligible. Never auto-download.
 *
 * Search pack models (BGE + ms-marco CE) are commit-pinned in this catalog the same way.
 */
const UNLIMITED_OCR_HF_COMMIT = 'd549bb9d6a055dbe291408916d66acc2cd5920f6';
const UNLIMITED_OCR_HF_BASE =
	`https://huggingface.co/baidu/Unlimited-OCR/resolve/${UNLIMITED_OCR_HF_COMMIT}`;

export const UNLIMITED_OCR_SPEC: ModelSpec = {
	id: 'unlimited-ocr',
	version: '1.0.0',
	minVramMb: 8192,
	minRamMb: 16384,
	diskMb: 7000,
	backends: ['cuda-vllm'],
	pageSoftCap: 40,
	artifactFileName: 'pack',
	sha256: '479af7bfa444743ce5e53f27ba5badf126975545c64bbe23d85a7fcb313c8721',
	files: [
		{
			relativePath: 'config.json',
			downloadUrl: `${UNLIMITED_OCR_HF_BASE}/config.json`,
			sha256: '27246d03fd670904ec9601b1cb0861fbb79ec076830771daa8d943d6229946f9',
		},
		{
			relativePath: 'configuration_deepseek_v2.py',
			downloadUrl: `${UNLIMITED_OCR_HF_BASE}/configuration_deepseek_v2.py`,
			sha256: 'b8470dd616ba8745fce6e27b093aef73a098863cc891b2477dcf9326a36000f7',
		},
		{
			relativePath: 'conversation.py',
			downloadUrl: `${UNLIMITED_OCR_HF_BASE}/conversation.py`,
			sha256: 'ec7b6ce89bcda643de1f43269ffa66a7b2e65dc3ed30e427958f776546b4ba03',
		},
		{
			relativePath: 'deepencoder.py',
			downloadUrl: `${UNLIMITED_OCR_HF_BASE}/deepencoder.py`,
			sha256: '0ae2fb6d1e5ae8cf100fc32f854830acd08c821a0a1f23a94a76588c222ddcf2',
		},
		{
			relativePath: 'model-00001-of-000001.safetensors',
			downloadUrl: `${UNLIMITED_OCR_HF_BASE}/model-00001-of-000001.safetensors`,
			sha256: '2bc48a7a110061ea58fff65d3169367eebe3aee371ca6968dc2219c1b2855fc6',
		},
		{
			relativePath: 'model.safetensors.index.json',
			downloadUrl: `${UNLIMITED_OCR_HF_BASE}/model.safetensors.index.json`,
			sha256: '354be1f2dcfb72ebb385e25465522ce5413a77c36f3b35fec088a3162a11af99',
		},
		{
			relativePath: 'modeling_deepseekv2.py',
			downloadUrl: `${UNLIMITED_OCR_HF_BASE}/modeling_deepseekv2.py`,
			sha256: '74e36e6bd0ba7bc565ef76464a99baa8e6bccb710ae9c1007b54ac30b855fa4c',
		},
		{
			relativePath: 'modeling_unlimitedocr.py',
			downloadUrl: `${UNLIMITED_OCR_HF_BASE}/modeling_unlimitedocr.py`,
			sha256: '268bdcbe12cf37bf5a2debb53faf542e56570958a5d9f3314aab3cab2cf6cb48',
		},
		{
			relativePath: 'processor_config.json',
			downloadUrl: `${UNLIMITED_OCR_HF_BASE}/processor_config.json`,
			sha256: '92588cffb1d7032ec83d0a06c3a5171b41df5cbf432d68765441139a57899328',
		},
		{
			relativePath: 'special_tokens_map.json',
			downloadUrl: `${UNLIMITED_OCR_HF_BASE}/special_tokens_map.json`,
			sha256: 'ab4bd57ce17d62e39e0a39e739de1e407484f090f0b2c7e391312bca7a5b061a',
		},
		{
			relativePath: 'tokenizer.json',
			downloadUrl: `${UNLIMITED_OCR_HF_BASE}/tokenizer.json`,
			sha256: 'a02f8fd5228c90256bb4f6554c34a579d48f909e5beb232dc4afad870b55a8b4',
		},
		{
			relativePath: 'tokenizer_config.json',
			downloadUrl: `${UNLIMITED_OCR_HF_BASE}/tokenizer_config.json`,
			sha256: 'a0cbe8464049da1f891b7a12676de06af4cb54c130995d42f71adc1c30c6e9f3',
		},
	],
};

/**
 * True when a catalog spec has enough pin metadata for consent download + SHA verify.
 * Multi-file packs require `files[]` + pack `sha256`; single-file specs need `downloadUrl` + `sha256`.
 */
export function isArtifactPinConfigured(spec: ModelSpec | undefined): boolean {
	if (!spec?.sha256) {
		return false;
	}
	if (spec.files?.length) {
		return spec.files.every(
			file => Boolean(file.relativePath && file.downloadUrl && file.sha256),
		);
	}
	return Boolean(spec.downloadUrl && (spec.artifactFileName || spec.downloadUrl));
}

const BGE_HF_BASE =
	'https://huggingface.co/Xenova/bge-small-en-v1.5/resolve/ea104dacec62c0de699686887e3f920caeb4f3e3';
const CE_HF_BASE =
	'https://huggingface.co/Xenova/ms-marco-MiniLM-L-6-v2/resolve/a09144355adeed5f58c8ed011d209bf8ee5a1fec';

/** BGE-small embedding model (Search pack; CPU ONNX Runtime). */
export const BGE_SMALL_SPEC: ModelSpec = {
	id: 'bge-small-en-v1.5',
	version: '1.0.0',
	minVramMb: 0,
	minRamMb: 1024,
	diskMb: 150,
	backends: ['cpu-ort'],
	artifactFileName: 'pack',
	sha256: '7f6d59f051256a04cb14d133cc1b9855dd3ce5c18e3409ae87bcee924beaa145',
	files: [
		{
			relativePath: 'onnx/model.onnx',
			downloadUrl: `${BGE_HF_BASE}/onnx/model.onnx`,
			sha256: '828e1496d7fabb79cfa4dcd84fa38625c0d3d21da474a00f08db0f559940cf35',
		},
		{
			relativePath: 'tokenizer.json',
			downloadUrl: `${BGE_HF_BASE}/tokenizer.json`,
			sha256: 'd241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66',
		},
		{
			relativePath: 'config.json',
			downloadUrl: `${BGE_HF_BASE}/config.json`,
			sha256: 'fa73f90bf92c8cace1fbcb709626306f2bdbc9ea3e5b5f94b440df9b6aa56350',
		},
		{
			relativePath: 'special_tokens_map.json',
			downloadUrl: `${BGE_HF_BASE}/special_tokens_map.json`,
			sha256: 'b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3',
		},
		{
			relativePath: 'tokenizer_config.json',
			downloadUrl: `${BGE_HF_BASE}/tokenizer_config.json`,
			sha256: '9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3',
		},
	],
};

/** ms-marco MiniLM cross-encoder (Search pack; CPU ONNX Runtime). */
export const MS_MARCO_MINILM_SPEC: ModelSpec = {
	id: 'ms-marco-minilm-l6-v2',
	version: '1.0.0',
	minVramMb: 0,
	minRamMb: 1024,
	diskMb: 100,
	backends: ['cpu-ort'],
	artifactFileName: 'pack',
	sha256: '4ca7f09d1c67d1289a07cbf40b934041da06a7adfc116cf8dd6e51e77fe7a4a2',
	files: [
		{
			relativePath: 'onnx/model.onnx',
			downloadUrl: `${CE_HF_BASE}/onnx/model.onnx`,
			sha256: 'c623d0bcb99f4622beb413eaef00cfbe5db20df9f1dd982da4b4f26022881870',
		},
		{
			relativePath: 'tokenizer.json',
			downloadUrl: `${CE_HF_BASE}/tokenizer.json`,
			sha256: 'd241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66',
		},
		{
			relativePath: 'config.json',
			downloadUrl: `${CE_HF_BASE}/config.json`,
			sha256: 'd827779a72d27ae68cf878a6fc2e954542663fe21ca515d9f4783fc96be2d37e',
		},
	],
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
