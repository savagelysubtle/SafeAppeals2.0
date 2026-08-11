/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { HwCapabilityProbe } from './hwCapabilityProbe';
import { isArtifactPinConfigured } from './modelCatalog';
import type { ModelCatalog } from './modelCatalog';
import type { ModelArtifactStore, ArtifactDownloadProgress } from './modelArtifactStore';

export type ConsentInstallOutcome =
	| {
		readonly kind: 'installed';
		readonly modelId: string;
		readonly version: string;
		/** Soft warning (e.g. weights OK but runtime sidecar not ready). */
		readonly warning?: string;
	}
	| { readonly kind: 'already-ready'; readonly modelId: string; readonly version: string }
	| { readonly kind: 'ineligible'; readonly modelId: string; readonly reasons: readonly string[] }
	| { readonly kind: 'consent-required'; readonly modelId: string }
	| { readonly kind: 'error'; readonly modelId: string; readonly message: string };

export type { ArtifactDownloadProgress };

export interface ConsentInstallDeps {
	readonly probe: HwCapabilityProbe;
	readonly catalog: ModelCatalog;
	readonly store: ModelArtifactStore;
}

/**
 * Consent-gated install helper: probe → catalog.evaluate → download only when
 * eligible **and** `userConsented === true`. Ineligible machines never download.
 */
export async function consentInstallModel(
	deps: ConsentInstallDeps,
	options: {
		readonly modelId: string;
		/** Must be literally `true` to download. `false` never triggers a fetch. */
		readonly userConsented: boolean;
		readonly downloadUrl?: string;
		readonly sha256?: string;
		/**
		 * Optional post-download smoke. Throw / reject → install marked broken
		 * and {@link ModelArtifactStore.isReady} stays false.
		 */
		readonly smokeTest?: () => Promise<void>;
		readonly onProgress?: (progress: ArtifactDownloadProgress) => void;
	},
): Promise<ConsentInstallOutcome> {
	const { modelId, userConsented } = options;
	const spec = deps.catalog.get(modelId);
	if (!spec) {
		return { kind: 'error', modelId, message: `Unknown model: ${modelId}` };
	}

	const snapshot = await deps.probe.snapshot();
	const evaluation = deps.catalog.evaluate(modelId, snapshot);
	if (!evaluation.eligible) {
		return { kind: 'ineligible', modelId, reasons: evaluation.reasons };
	}

	if (!isArtifactPinConfigured(spec)) {
		return {
			kind: 'error',
			modelId,
			message:
				`Model ${modelId} has no sha256 pinned; refusing download until digest is configured.`,
		};
	}

	if (await deps.store.isReady(modelId)) {
		return {
			kind: 'already-ready',
			modelId,
			version: spec.version ?? 'unknown',
		};
	}

	if (userConsented !== true) {
		return { kind: 'consent-required', modelId };
	}

	try {
		const result = await deps.store.downloadWithConsent({
			modelId,
			userConsented: true,
			downloadUrl: options.downloadUrl,
			sha256: options.sha256,
			onProgress: options.onProgress,
		});
		if (options.smokeTest) {
			try {
				await options.smokeTest();
			} catch (smokeErr) {
				const message = smokeErr instanceof Error ? smokeErr.message : String(smokeErr);
				await deps.store.markBroken(modelId, message);
				return {
					kind: 'error',
					modelId,
					message: `Post-install smoke failed: ${message}`,
				};
			}
		}
		return { kind: 'installed', modelId: result.modelId, version: result.version };
	} catch (err) {
		return {
			kind: 'error',
			modelId,
			message: err instanceof Error ? err.message : String(err),
		};
	}
}

export type DocParseReadyResult = {
	readonly ready: boolean;
	readonly detail?: string;
	/**
	 * Weights/artifacts are present but the managed `sa-docparse` binary is not
	 * on disk (and no BYO localhost sidecar answered). Not a corrupt download.
	 */
	readonly runtimeMissing?: boolean;
};

/** Convenience wrapper for Unlimited-OCR consent install. */
export async function consentInstallUnlimitedOcr(
	deps: ConsentInstallDeps,
	userConsented: boolean,
	options: {
		readonly downloadUrl?: string;
		readonly sha256?: string;
		/**
		 * Post-download readiness: start managed sidecar (when available) then health smoke.
		 * Failures do not mark artifacts broken — only corrupt downloads do.
		 */
		readonly ensureDocParseReady?: () => Promise<DocParseReadyResult>;
		readonly onProgress?: (progress: ArtifactDownloadProgress) => void;
	} = {},
): Promise<ConsentInstallOutcome> {
	const outcome = await consentInstallModel(deps, {
		modelId: 'unlimited-ocr',
		userConsented,
		downloadUrl: options.downloadUrl,
		sha256: options.sha256,
		onProgress: options.onProgress,
	});

	if (outcome.kind !== 'installed' || !options.ensureDocParseReady) {
		return outcome;
	}

	const readyResult = await options.ensureDocParseReady();
	if (readyResult.ready) {
		return outcome;
	}

	// Artifacts verified; missing sidecar is a packaging/dev setup gap, not a bad download.
	if (readyResult.runtimeMissing) {
		return {
			kind: 'installed',
			modelId: outcome.modelId,
			version: outcome.version,
			warning: readyResult.detail
				?? 'Unlimited-OCR weights are installed, but the sa-docparse runtime is not available yet.',
		};
	}

	return {
		kind: 'error',
		modelId: 'unlimited-ocr',
		message: readyResult.detail ?? 'DocParse sidecar is not ready after install.',
	};
}
