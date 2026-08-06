/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';

/**
 * Trust Context Keys
 */

export const WorkspaceTrustContext = {
	IsEnabled: new RawContextKey<boolean>('isWorkspaceTrustEnabled', false, localize('workspaceTrustEnabledCtx', "Whether the workspace trust feature is enabled.")),
	IsTrusted: new RawContextKey<boolean>('isWorkspaceTrusted', false, localize('workspaceTrustedCtx', "Whether the current workspace has been trusted by the user."))
};

export const MANAGE_TRUST_COMMAND_ID = 'workbench.trust.manage';

/**
 * Internal command: silently trust the SafeAppeals sample-case folder only.
 * Resolves the path under the timeline extension globalStorage — does not accept
 * caller-supplied URIs (avoids an unrestricted silent-trust API).
 */
export const TRUST_SAFE_APPEALS_SAMPLE_CASE_COMMAND_ID = '_workbench.trust.safeAppealsSampleCase';

/** Extension id used for timeline globalStorage (lowercased by the storage host). */
export const SAFEAPPEALS_TIMELINE_EXTENSION_STORAGE_ID = 'safeappeals.safeappeals-timeline';

/** Folder name under timeline globalStorage where the sample matter is materialized. */
export const SAFEAPPEALS_SAMPLE_CASE_DIR = 'sample-case';

/**
 * Resolve the `file://` URI for the SafeAppeals sample case root under the given
 * profile globalStorage home. Mirrors timeline `sampleCaseRootUri` + `asFileUri`.
 */
export function resolveSafeAppealsSampleCaseTrustUri(globalStorageHome: URI): URI {
	const storageRoot = URI.joinPath(
		globalStorageHome,
		SAFEAPPEALS_TIMELINE_EXTENSION_STORAGE_ID.toLowerCase(),
		SAFEAPPEALS_SAMPLE_CASE_DIR,
	);
	// openSampleCase opens via file:// — trust must use the same scheme.
	return storageRoot.scheme === Schemas.file ? storageRoot : URI.file(storageRoot.fsPath);
}
