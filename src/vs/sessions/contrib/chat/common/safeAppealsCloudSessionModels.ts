/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { ILanguageModelChatMetadataAndIdentifier, ILanguageModelsService, SAFEAPPEALS_CLOUD_VENDOR_ID } from '../../../../workbench/contrib/chat/common/languageModels.js';

/** Logical session type id for the Copilot CLI / SafeAppeals Agent harness. */
const COPILOT_CLI_SESSION_TYPE_ID = 'copilotcli';

/**
 * SafeAppeals: true when the cloud LM vendor is registered or cloud models are
 * already present in the language-models registry.
 */
export function isSafeAppealsCloudPathActive(languageModelsService: ILanguageModelsService): boolean {
	if (languageModelsService.getVendors().some(v => v.vendor === SAFEAPPEALS_CLOUD_VENDOR_ID)) {
		return true;
	}
	return languageModelsService.getLanguageModelIds().some(id => {
		const metadata = languageModelsService.lookupLanguageModel(id);
		return metadata?.vendor === SAFEAPPEALS_CLOUD_VENDOR_ID;
	});
}

/**
 * User-selectable general-purpose models from the SafeAppeals Cloud vendor
 * (no {@link ILanguageModelChatMetadata.targetChatSessionType}).
 */
export function getSafeAppealsCloudUserSelectableModels(
	languageModelsService: ILanguageModelsService,
): readonly ILanguageModelChatMetadataAndIdentifier[] {
	return languageModelsService.getLanguageModelIds()
		.map((id): ILanguageModelChatMetadataAndIdentifier | undefined => {
			const metadata = languageModelsService.lookupLanguageModel(id);
			if (!metadata || metadata.vendor !== SAFEAPPEALS_CLOUD_VENDOR_ID) {
				return undefined;
			}
			if (metadata.isUserSelectable === false) {
				return undefined;
			}
			if (metadata.targetChatSessionType) {
				return undefined;
			}
			return { identifier: id, metadata };
		})
		.filter((m): m is ILanguageModelChatMetadataAndIdentifier => !!m);
}

export function shouldMergeSafeAppealsCloudModelsForSession(sessionType: string | undefined): boolean {
	return sessionType === COPILOT_CLI_SESSION_TYPE_ID;
}

/**
 * Merges general-purpose SafeAppeals Cloud models into an Agents session model
 * list when the cloud path is active and the session uses the CLI harness.
 */
export function mergeSessionModelsWithSafeAppealsCloud(
	sessionModels: readonly ILanguageModelChatMetadataAndIdentifier[],
	languageModelsService: ILanguageModelsService,
	sessionType: string | undefined,
): readonly ILanguageModelChatMetadataAndIdentifier[] {
	if (!shouldMergeSafeAppealsCloudModelsForSession(sessionType) || !isSafeAppealsCloudPathActive(languageModelsService)) {
		return sessionModels;
	}
	const cloudModels = getSafeAppealsCloudUserSelectableModels(languageModelsService);
	if (cloudModels.length === 0) {
		return sessionModels;
	}
	const seen = new Set(sessionModels.map(m => m.identifier));
	const merged = [...sessionModels];
	for (const model of cloudModels) {
		if (!seen.has(model.identifier)) {
			merged.push(model);
			seen.add(model.identifier);
		}
	}
	return merged;
}
