/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { createWriteStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { ensureDir } from './shared/secureFs';

export const WHISPER_MODEL_FILENAME = 'ggml-base.en.bin';

/** HuggingFace resolve URL for the English base GGML model. */
export const WHISPER_MODEL_URL =
	'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';

/** Minimum plausible size for ggml-base.en.bin (~141 MiB); used to skip re-download. */
const MIN_EXISTING_BYTES = 100 * 1024 * 1024;

export type FetchLike = (
	input: string | URL,
	init?: { signal?: AbortSignal; redirect?: 'follow' | 'error' | 'manual' },
) => Promise<Response>;

/**
 * Managed Whisper model path under SafeAppeals app data
 * (`User/globalStorage/<publisher>.<extension>/models/whisper/…`).
 * Shared for the whole product profile — not per workspace.
 */
export function whisperModelDestination(globalStorageFsPath: string): string {
	return path.join(globalStorageFsPath, 'models', 'whisper', WHISPER_MODEL_FILENAME);
}

export async function existingWhisperModelPath(
	destinationPath: string,
): Promise<string | undefined> {
	try {
		const stat = await fs.stat(destinationPath);
		if (stat.isFile() && stat.size >= MIN_EXISTING_BYTES) {
			return destinationPath;
		}
	} catch {
		// missing or unreadable — download
	}
	return undefined;
}

/**
 * Download a Whisper GGML model into managed globalStorage (atomic tmp + rename).
 * Follows redirects (HuggingFace CDN). Reports byte progress when Content-Length is known.
 */
export async function downloadWhisperModelFile(options: {
	readonly destinationPath: string;
	readonly url?: string;
	readonly onProgress?: (downloadedBytes: number, totalBytes: number | undefined) => void;
	readonly signal?: AbortSignal;
	readonly fetchImpl?: FetchLike;
}): Promise<string> {
	const destinationPath = options.destinationPath;
	const existing = await existingWhisperModelPath(destinationPath);
	if (existing) {
		options.onProgress?.(MIN_EXISTING_BYTES, MIN_EXISTING_BYTES);
		return existing;
	}

	const url = options.url ?? WHISPER_MODEL_URL;
	const fetchImpl = options.fetchImpl ?? fetch;
	const response = await fetchImpl(url, {
		redirect: 'follow',
		signal: options.signal,
	});
	if (!response.ok) {
		throw new Error(`Whisper model download failed: HTTP ${response.status}`);
	}
	if (!response.body) {
		throw new Error('Whisper model download failed: empty response body.');
	}

	const totalHeader = response.headers.get('content-length');
	const totalBytes = totalHeader ? Number.parseInt(totalHeader, 10) : undefined;
	const knownTotal = totalBytes !== undefined && Number.isFinite(totalBytes) ? totalBytes : undefined;

	const dir = path.dirname(destinationPath);
	await ensureDir(dir);
	const tmpPath = `${destinationPath}.${process.pid}.${Date.now()}.tmp`;

	let downloadedBytes = 0;
	const nodeStream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
	nodeStream.on('data', (chunk: Buffer | string) => {
		downloadedBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.byteLength;
		options.onProgress?.(downloadedBytes, knownTotal);
	});

	try {
		await pipeline(nodeStream, createWriteStream(tmpPath, { mode: 0o600 }));
		if (process.platform !== 'win32') {
			await fs.chmod(tmpPath, 0o600);
		}
		await fs.rename(tmpPath, destinationPath);
		if (process.platform !== 'win32') {
			await fs.chmod(destinationPath, 0o600);
		}
	} catch (error) {
		await fs.unlink(tmpPath).catch(() => undefined);
		throw error;
	}

	return destinationPath;
}
