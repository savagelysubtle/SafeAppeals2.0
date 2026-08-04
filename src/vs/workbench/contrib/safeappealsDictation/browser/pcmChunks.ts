/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { decodeBase64, encodeBase64, VSBuffer } from '../../../../base/common/buffer.js';

/**
 * Concatenate base64-encoded raw PCM16 (Int16LE, no WAV header) chunks into
 * a single base64 string suitable for `safeappeals-audio.transcribePcm`.
 */
export function concatPcm16Base64Chunks(chunks: readonly string[]): string {
	if (chunks.length === 0) {
		return '';
	}
	if (chunks.length === 1) {
		return chunks[0];
	}
	const buffers = chunks.map(chunk => decodeBase64(chunk));
	return encodeBase64(VSBuffer.concat(buffers));
}
