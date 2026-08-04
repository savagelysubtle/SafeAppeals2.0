/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { MlBackendUnavailableError, MlCancelledError } from '../errors';
import type { ResourceAdapter } from '../types';
import type { WhisperHost } from '../../whisperHost';

/**
 * Heavy-slot adapter around {@link WhisperHost}.
 *
 * Unload is best-effort: we drop the cached kutalia `transcribe` function so the next
 * acquire re-probes. The `@kutalia/whisper-node-addon` native heap is **not** freed by the
 * addon API today — process RSS may remain elevated until the extension host restarts.
 */
export class WhisperSlotAdapter implements ResourceAdapter {
	readonly kind = 'whisper' as const;
	readonly estimateMb: number;
	private loaded = false;

	constructor(
		private readonly host: WhisperHost,
		estimateMb = 800,
	) {
		this.estimateMb = estimateMb;
	}

	async load(signal: AbortSignal): Promise<void> {
		if (signal.aborted) {
			throw new MlCancelledError('Whisper load aborted.');
		}
		const gate = this.host.canTranscribe();
		if (!gate.ok) {
			throw new MlBackendUnavailableError(gate.reason);
		}
		// Touch the probe path so the addon is resolved before the lease is granted.
		if (!this.host.isAddonAvailable()) {
			throw new MlBackendUnavailableError('Whisper native addon is unavailable.');
		}
		if (signal.aborted) {
			throw new MlCancelledError('Whisper load aborted.');
		}
		this.loaded = true;
	}

	async unload(): Promise<void> {
		this.host.clearTranscribeCache();
		this.loaded = false;
		// kutalia limitation: no native free/unload; RSS may stay warm in the EH process.
	}

	isLoaded(): boolean {
		return this.loaded;
	}
}
