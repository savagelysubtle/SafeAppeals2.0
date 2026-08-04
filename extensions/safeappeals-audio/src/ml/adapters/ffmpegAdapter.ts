/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { ResourceAdapter } from '../types';

/**
 * Lightweight utility-lane adapter. Ffmpeg work remains short-lived process spawns in
 * {@link FfmpegHost}; this adapter only participates in lane serialization / budget bookkeeping.
 */
export class FfmpegStubAdapter implements ResourceAdapter {
	readonly kind = 'ffmpeg' as const;
	readonly estimateMb: number;
	private loaded = false;

	constructor(estimateMb = 50) {
		this.estimateMb = estimateMb;
	}

	async load(_signal: AbortSignal): Promise<void> {
		this.loaded = true;
	}

	async unload(): Promise<void> {
		this.loaded = false;
	}

	isLoaded(): boolean {
		return this.loaded;
	}
}
