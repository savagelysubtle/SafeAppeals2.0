/* GENERATED — do not edit. Canonical source: extensions/safeappeals-shared/src/secureFs.ts. Run: npm run sync-safeappeals-shared */
/*--- Secure filesystem helpers — atomic writes, POSIX mode bits, quarantine ---*/

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const RENAME_RETRIES = 3;
const RENAME_RETRY_DELAY_MS = 50;

function errorCode(error: unknown): string | undefined {
	const code = (error as { code?: unknown } | null | undefined)?.code;
	return typeof code === 'string' ? code : undefined;
}

function isEnoent(error: unknown): boolean {
	return errorCode(error) === 'ENOENT';
}

function isEperm(error: unknown): boolean {
	return errorCode(error) === 'EPERM';
}

async function sleep(ms: number): Promise<void> {
	await new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function renameWithRetry(from: string, to: string): Promise<void> {
	let lastError: unknown;
	for (let attempt = 0; attempt < RENAME_RETRIES; attempt++) {
		try {
			await fs.rename(from, to);
			return;
		} catch (error) {
			lastError = error;
			if (!isEperm(error) || attempt === RENAME_RETRIES - 1) {
				throw error;
			}
			await sleep(RENAME_RETRY_DELAY_MS);
		}
	}
	throw lastError;
}

/**
 * Create a directory (and parents) and set mode 0700 on POSIX.
 */
export async function ensureDir(dirPath: string): Promise<void> {
	await fs.mkdir(dirPath, { recursive: true, mode: 0o700 });
	if (process.platform !== 'win32') {
		await fs.chmod(dirPath, 0o700);
	}
}

/**
 * Read a file as a Buffer, or return undefined when the path is missing.
 */
export async function readFileOrUndefined(filePath: string): Promise<Buffer | undefined> {
	try {
		return await fs.readFile(filePath);
	} catch (error) {
		if (isEnoent(error)) {
			return undefined;
		}
		throw error;
	}
}

/**
 * Atomically write `data` to `filePath` via a same-directory temp file.
 * Sets mode 0600 on POSIX before rename; retries rename on Windows EPERM.
 */
export async function writeFileAtomic(filePath: string, data: Buffer): Promise<void> {
	const dir = path.dirname(filePath);
	await ensureDir(dir);
	const tmpPath = path.join(dir, `.${path.basename(filePath)}.${randomBytes(8).toString('hex')}.tmp`);
	const handle = await fs.open(tmpPath, 'w', 0o600);
	try {
		await handle.writeFile(data);
		if (process.platform !== 'win32') {
			await handle.chmod(0o600);
		}
		await handle.sync();
	} finally {
		await handle.close();
	}
	if (process.platform !== 'win32') {
		await fs.chmod(tmpPath, 0o600);
	}
	try {
		await renameWithRetry(tmpPath, filePath);
	} catch (error) {
		try {
			await fs.unlink(tmpPath);
		} catch {
			// best-effort cleanup
		}
		throw error;
	}
}

/**
 * Delete a file if present. Returns false when the path was already absent.
 */
export async function deleteFileIfExists(filePath: string): Promise<boolean> {
	try {
		await fs.unlink(filePath);
		return true;
	} catch (error) {
		if (isEnoent(error)) {
			return false;
		}
		throw error;
	}
}

/**
 * Rename a corrupt file aside. Returns the quarantine path, or undefined on failure.
 */
export async function quarantineFile(filePath: string): Promise<string | undefined> {
	const stamp = new Date().toISOString().replace(/:/g, '-');
	const quarantinePath = `${filePath}.corrupt-${stamp}`;
	try {
		await fs.rename(filePath, quarantinePath);
		return quarantinePath;
	} catch {
		return undefined;
	}
}
