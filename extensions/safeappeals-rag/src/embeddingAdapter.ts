/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { ResourceAdapter } from './mlEngineTypes';
import { syncRagModelEnv, type ModelEnvSyncResult } from './modelEnvSync';
import type { RagEnsureEmbedderResult } from './ragCoreHost';

export interface EmbeddingAdapterDeps {
	readonly getArtifactDir: (modelId: string) => Promise<string | undefined>;
	/** Ensure rag-core can see synced env (e.g. refreshModelGates). */
	readonly ensureRagCoreReady?: () => Promise<void>;
	/** Load / unload native BGE residency (MlResourceEngine lease). */
	readonly ragHost?: {
		ensureEmbedderLoaded(): RagEnsureEmbedderResult;
		clearEmbedder(): void;
	};
	readonly estimateMb?: number;
	readonly log?: (message: string) => void;
}

/**
 * Heavy-slot adapter for BGE-small / rag-core embedding.
 * Load syncs model env from ML artifacts and confirms rag-core readiness.
 * Inference stays in the native sidecar / rag-core binding — never a VLM in EH.
 */
export class EmbeddingAdapter implements ResourceAdapter {
	readonly kind = 'embedding' as const;
	readonly estimateMb: number;
	private loaded = false;
	private lastSync: ModelEnvSyncResult | undefined;
	private readonly getArtifactDir: (modelId: string) => Promise<string | undefined>;
	private readonly ensureRagCoreReady?: () => Promise<void>;
	private readonly ragHost?: EmbeddingAdapterDeps['ragHost'];
	private readonly log?: (message: string) => void;

	constructor(deps: EmbeddingAdapterDeps) {
		this.getArtifactDir = deps.getArtifactDir;
		this.ensureRagCoreReady = deps.ensureRagCoreReady;
		this.ragHost = deps.ragHost;
		this.estimateMb = deps.estimateMb ?? 400;
		this.log = deps.log;
	}

	async load(signal: AbortSignal): Promise<void> {
		if (signal.aborted) {
			throw new Error('Embedding load aborted.');
		}
		this.lastSync = await syncRagModelEnv({
			getArtifactDir: this.getArtifactDir,
			log: this.log,
		});
		if (!this.lastSync.embedReady) {
			throw new Error(
				'Embedding backend is not ready (SA_RAG_EMBED_MODEL_DIR unset and Search pack artifacts missing).',
			);
		}
		if (signal.aborted) {
			throw new Error('Embedding load aborted.');
		}
		if (this.ragHost) {
			const ensureResult = this.ragHost.ensureEmbedderLoaded();
			if (!ensureResult.ok) {
				throw new Error(
					ensureResult.error ??
					'Embedding model failed to load in rag-core (ensureEmbedderLoaded).',
				);
			}
		}
		if (this.ensureRagCoreReady) {
			await this.ensureRagCoreReady();
		}
		this.loaded = true;
		this.log?.(
			`EmbeddingAdapter ready (embedDir=${this.lastSync.embedDir ?? '(env)'})`,
		);
	}

	async unload(): Promise<void> {
		this.ragHost?.clearEmbedder();
		this.loaded = false;
		this.log?.('EmbeddingAdapter unloaded (native embedder cleared).');
	}

	isLoaded(): boolean {
		return this.loaded;
	}

	get lastSyncResult(): ModelEnvSyncResult | undefined {
		return this.lastSync;
	}
}
