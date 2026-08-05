/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { HwCapabilityProbe } from './hwCapabilityProbe';
import type { ModelCatalog } from './modelCatalog';
import type { ModelArtifactStore } from './modelArtifactStore';

export type ConsentInstallOutcome =
	| { readonly kind: 'installed'; readonly modelId: string; readonly version: string }
	| { readonly kind: 'already-ready'; readonly modelId: string; readonly version: string }
	| { readonly kind: 'ineligible'; readonly modelId: string; readonly reasons: readonly string[] }
	| { readonly kind: 'consent-required'; readonly modelId: string }
	| { readonly kind: 'error'; readonly modelId: string; readonly message: string };

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

/** Convenience wrapper for Unlimited-OCR consent install. */
export async function consentInstallUnlimitedOcr(
	deps: ConsentInstallDeps,
	userConsented: boolean,
	options: {
		readonly downloadUrl?: string;
		readonly sha256?: string;
		readonly smokeTest?: () => Promise<void>;
	} = {},
): Promise<ConsentInstallOutcome> {
	return consentInstallModel(deps, {
		modelId: 'unlimited-ocr',
		userConsented,
		downloadUrl: options.downloadUrl,
		sha256: options.sha256,
		smokeTest: options.smokeTest,
	});
}
