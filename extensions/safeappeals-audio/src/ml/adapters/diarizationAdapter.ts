/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { DiarizationHost } from '../../diarizationHost';
import { MlBackendUnavailableError, MlCancelledError } from '../errors';
import type { ResourceAdapter } from '../types';

/**
 * Heavy-slot adapter around {@link DiarizationHost} (sherpa-onnx CLI).
 * Load verifies binary + models exist; unload kills any leftover child.
 */
export class DiarizationSlotAdapter implements ResourceAdapter {
	readonly kind = 'diarization' as const;
	readonly estimateMb: number;
	private loaded = false;

	constructor(
		private readonly host: DiarizationHost,
		estimateMb = 200,
	) {
		this.estimateMb = estimateMb;
	}

	async load(signal: AbortSignal): Promise<void> {
		if (signal.aborted) {
			throw new MlCancelledError('Diarization load aborted.');
		}
		const available = await this.host.isAvailable();
		if (!available) {
			throw new MlBackendUnavailableError(
				'Diarization backend is unavailable. Install sherpa-onnx models or set safeappeals.audio.diarization.* paths.',
			);
		}
		if (signal.aborted) {
			throw new MlCancelledError('Diarization load aborted.');
		}
		this.loaded = true;
	}

	async unload(): Promise<void> {
		await this.host.unload();
		this.loaded = false;
	}

	cancel(reason: string): void {
		this.host.cancel(reason);
	}

	isLoaded(): boolean {
		return this.loaded;
	}
}
