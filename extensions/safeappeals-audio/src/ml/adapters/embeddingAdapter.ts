/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { MlBackendUnavailableError } from '../errors';
import type { ResourceAdapter } from '../types';

/**
 * Stub embedding slot so `embedding` exists in the engine registry.
 * Real RAG / rag-core registration replaces this via {@link MlResourceEngine.registerAdapter}.
 */
export class EmbeddingStubAdapter implements ResourceAdapter {
	readonly kind = 'embedding' as const;
	readonly estimateMb: number;

	constructor(estimateMb = 400) {
		this.estimateMb = estimateMb;
	}

	async load(_signal: AbortSignal): Promise<void> {
		throw new MlBackendUnavailableError(
			'Embedding backend is not available yet. RAG will register an adapter later.',
		);
	}

	async unload(): Promise<void> {
		// Nothing resident.
	}

	isLoaded(): boolean {
		return false;
	}
}
