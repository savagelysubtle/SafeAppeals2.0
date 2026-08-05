/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { existsSync } from 'node:fs';
import {
	BGE_SMALL_MODEL_ID,
	MS_MARCO_CE_MODEL_ID,
} from './types';

/** Env var rag-core reads for BGE-small ONNX directory. */
export const SA_RAG_EMBED_MODEL_DIR = 'SA_RAG_EMBED_MODEL_DIR';

/** Env var rag-core reads for ms-marco CE ONNX directory. */
export const SA_RAG_CE_MODEL_DIR = 'SA_RAG_CE_MODEL_DIR';

export interface ModelEnvSyncResult {
	readonly embedDir: string | undefined;
	readonly ceDir: string | undefined;
	/** True when at least one env var was written this call. */
	readonly synced: boolean;
	/** True when an embed model directory is usable (env already set or just synced). */
	readonly embedReady: boolean;
}

export interface ModelEnvSyncOptions {
	/** Resolve absolute artifact dir when the model is ready (mlBridge / artifactStore). */
	readonly getArtifactDir: (modelId: string) => Promise<string | undefined>;
	readonly embedModelId?: string;
	readonly ceModelId?: string;
	readonly env?: NodeJS.ProcessEnv;
	readonly directoryExists?: (dir: string) => boolean;
	readonly log?: (message: string) => void;
}

function resolveExistingDir(
	env: NodeJS.ProcessEnv,
	key: string,
	directoryExists: (dir: string) => boolean,
): string | undefined {
	const current = env[key]?.trim();
	if (current && directoryExists(current)) {
		return current;
	}
	return undefined;
}

/**
 * Sync `SA_RAG_EMBED_MODEL_DIR` / `SA_RAG_CE_MODEL_DIR` from ML artifact dirs when ready.
 * Preserves existing BYO env values that point at real directories.
 * Does not download; Search pack downloadUrl/sha may still be unpinned → no sync until BYO/consent.
 */
export async function syncRagModelEnv(options: ModelEnvSyncOptions): Promise<ModelEnvSyncResult> {
	const env = options.env ?? process.env;
	const directoryExists = options.directoryExists ?? ((dir: string) => existsSync(dir));
	const embedModelId = options.embedModelId ?? BGE_SMALL_MODEL_ID;
	const ceModelId = options.ceModelId ?? MS_MARCO_CE_MODEL_ID;
	let synced = false;

	let embedDir = resolveExistingDir(env, SA_RAG_EMBED_MODEL_DIR, directoryExists);
	if (!embedDir) {
		const fromArtifacts = await options.getArtifactDir(embedModelId);
		if (fromArtifacts && directoryExists(fromArtifacts)) {
			env[SA_RAG_EMBED_MODEL_DIR] = fromArtifacts;
			embedDir = fromArtifacts;
			synced = true;
			options.log?.(`Set ${SA_RAG_EMBED_MODEL_DIR}=${fromArtifacts}`);
		}
	}

	let ceDir = resolveExistingDir(env, SA_RAG_CE_MODEL_DIR, directoryExists);
	if (!ceDir) {
		const fromArtifacts = await options.getArtifactDir(ceModelId);
		if (fromArtifacts && directoryExists(fromArtifacts)) {
			env[SA_RAG_CE_MODEL_DIR] = fromArtifacts;
			ceDir = fromArtifacts;
			synced = true;
			options.log?.(`Set ${SA_RAG_CE_MODEL_DIR}=${fromArtifacts}`);
		}
	}

	return {
		embedDir,
		ceDir,
		synced,
		embedReady: typeof embedDir === 'string' && embedDir.length > 0,
	};
}
