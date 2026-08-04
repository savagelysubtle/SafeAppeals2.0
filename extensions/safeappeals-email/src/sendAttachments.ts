/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { OutboundAttachment } from './types';

/**
 * When `draftId` is set, always use store-loaded attachments and ignore inbound payloads.
 * Without a draftId, pass through request attachments (e.g. non-draft sends).
 */
export function chooseSendAttachments(
	draftId: string | undefined,
	inbound: OutboundAttachment[] | undefined,
	loadedFromStore: OutboundAttachment[] | undefined,
): OutboundAttachment[] | undefined {
	if (draftId) {
		return loadedFromStore ?? [];
	}
	return inbound;
}
