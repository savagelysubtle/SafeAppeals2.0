/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { IModelSpecLite } from './types';

/**
 * True when a catalog spec has enough pin metadata for consent download + SHA verify.
 * Mirrors safeappeals-ml {@link isArtifactPinConfigured} without importing sibling sources.
 */
export function isArtifactPinConfigured(spec: IModelSpecLite | undefined): boolean {
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
