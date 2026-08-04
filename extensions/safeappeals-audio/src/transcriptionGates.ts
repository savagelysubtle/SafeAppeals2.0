/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * Transcription may decrypt audio to managed tmp under the encrypted store root only.
 * Memory-only / missing store root → refuse (never os.tmpdir / home paths).
 */
export function assertTranscriptionStorageReady(options: {
	readonly memoryOnly: boolean;
	readonly storeRootDir: string | undefined;
	readonly secretStorageAvailable?: boolean;
}): void {
	if (options.memoryOnly || options.secretStorageAvailable === false) {
		throw new Error(
			'Transcription is disabled while secure storage is unavailable (memory-only mode). Audio will not be written to disk.',
		);
	}
	if (!options.storeRootDir) {
		throw new Error(
			'Transcription requires an encrypted workspace store under globalStorage. Open a folder and ensure secure storage is available.',
		);
	}
}

export function canTranscribeWithStorage(options: {
	readonly memoryOnly: boolean;
	readonly secretStorageAvailable: boolean;
}): boolean {
	return !options.memoryOnly && options.secretStorageAvailable;
}
