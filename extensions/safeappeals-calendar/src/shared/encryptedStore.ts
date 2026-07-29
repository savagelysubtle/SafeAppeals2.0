/* GENERATED — do not edit. Canonical source: extensions/safeappeals-shared/src/encryptedStore.ts. Run: npm run sync-safeappeals-shared */
/*--- AES-256-GCM encrypted JSON store — DEK in SecretStorage, envelope on disk ---*/

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type * as vscode from 'vscode';
import { quarantineFile, readFileOrUndefined, writeFileAtomic } from './secureFs';

export const ENVELOPE_MAGIC = 'SAENC1';
export const ENVELOPE_VERSION = 1;
export const ENVELOPE_HEADER_LENGTH = 35;

const MAGIC_LENGTH = 6;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const DEK_LENGTH = 32;

const MAGIC_BUF = Buffer.from(ENVELOPE_MAGIC, 'ascii');

function aadForVersion(version: number): Buffer {
	return Buffer.concat([MAGIC_BUF, Buffer.from([version])]);
}

/**
 * True when `data` begins with the SAENC1 magic and is long enough for a header.
 */
export function isEnvelope(data: Buffer): boolean {
	return data.length >= ENVELOPE_HEADER_LENGTH && data.subarray(0, MAGIC_LENGTH).equals(MAGIC_BUF);
}

/**
 * Seal plaintext into a SAENC1 envelope (AES-256-GCM).
 */
export function seal(plaintext: Buffer, dek: Buffer): Buffer {
	if (dek.length !== DEK_LENGTH) {
		throw new Error(`DEK must be ${DEK_LENGTH} bytes`);
	}
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv('aes-256-gcm', dek, iv);
	cipher.setAAD(aadForVersion(ENVELOPE_VERSION));
	const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([
		MAGIC_BUF,
		Buffer.from([ENVELOPE_VERSION]),
		iv,
		tag,
		ciphertext,
	]);
}

/**
 * Open a SAENC1 envelope. Throws on short/bad magic/unknown version/auth failure.
 */
export function open(envelope: Buffer, dek: Buffer): Buffer {
	if (envelope.length < ENVELOPE_HEADER_LENGTH) {
		throw new Error('Envelope too short');
	}
	if (!envelope.subarray(0, MAGIC_LENGTH).equals(MAGIC_BUF)) {
		throw new Error('Bad envelope magic');
	}
	const version = envelope[MAGIC_LENGTH]!;
	if (version !== ENVELOPE_VERSION) {
		throw new Error(`Unknown envelope version: ${version}`);
	}
	if (dek.length !== DEK_LENGTH) {
		throw new Error(`DEK must be ${DEK_LENGTH} bytes`);
	}
	const iv = envelope.subarray(MAGIC_LENGTH + 1, MAGIC_LENGTH + 1 + IV_LENGTH);
	const tag = envelope.subarray(MAGIC_LENGTH + 1 + IV_LENGTH, MAGIC_LENGTH + 1 + IV_LENGTH + TAG_LENGTH);
	const ciphertext = envelope.subarray(ENVELOPE_HEADER_LENGTH);
	const decipher = createDecipheriv('aes-256-gcm', dek, iv);
	decipher.setAAD(aadForVersion(version));
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export interface DekRequest {
	readonly secrets: vscode.SecretStorage;
	readonly keyId: string;
	readonly existingDataPaths: readonly string[];
	readonly log?: (message: string) => void;
}

export type DekResult =
	| { readonly kind: 'ok'; readonly dek: Buffer }
	| { readonly kind: 'unavailable'; readonly reason: 'secret-storage-unusable' | 'key-lost-with-data' };

function decodeDek(stored: string): Buffer | undefined {
	try {
		const dek = Buffer.from(stored, 'base64');
		return dek.length === DEK_LENGTH ? dek : undefined;
	} catch {
		return undefined;
	}
}

async function anyPathExists(paths: readonly string[]): Promise<boolean> {
	for (const filePath of paths) {
		const data = await readFileOrUndefined(filePath);
		if (data !== undefined) {
			return true;
		}
	}
	return false;
}

/**
 * Acquire or mint a 32-byte DEK from SecretStorage. Never throws.
 */
export async function acquireDek(request: DekRequest): Promise<DekResult> {
	const { secrets, keyId, existingDataPaths, log } = request;
	const probeKey = `${keyId}.probe`;
	const probeValue = randomBytes(16).toString('base64');
	try {
		await secrets.store(probeKey, probeValue);
		const roundTrip = await secrets.get(probeKey);
		await secrets.delete(probeKey);
		if (roundTrip !== probeValue) {
			log?.(`SecretStorage probe mismatch for ${keyId}`);
			return { kind: 'unavailable', reason: 'secret-storage-unusable' };
		}
	} catch (error) {
		log?.(`SecretStorage probe failed for ${keyId}: ${error instanceof Error ? error.message : String(error)}`);
		try {
			await secrets.delete(probeKey);
		} catch {
			// ignore cleanup failures
		}
		return { kind: 'unavailable', reason: 'secret-storage-unusable' };
	}

	try {
		const existing = await secrets.get(keyId);
		if (existing !== undefined) {
			const dek = decodeDek(existing);
			if (dek) {
				return { kind: 'ok', dek };
			}
			log?.(`Ignoring invalid DEK for ${keyId}`);
		}

		if (await anyPathExists(existingDataPaths)) {
			log?.(`DEK missing but encrypted data present for ${keyId}`);
			return { kind: 'unavailable', reason: 'key-lost-with-data' };
		}

		const dek = randomBytes(DEK_LENGTH);
		await secrets.store(keyId, dek.toString('base64'));
		return { kind: 'ok', dek };
	} catch (error) {
		log?.(`acquireDek failed for ${keyId}: ${error instanceof Error ? error.message : String(error)}`);
		return { kind: 'unavailable', reason: 'secret-storage-unusable' };
	}
}

export type LoadResult<T> =
	| { readonly kind: 'missing' }
	| { readonly kind: 'plaintext'; readonly value: T }
	| { readonly kind: 'encrypted'; readonly value: T }
	| { readonly kind: 'corrupt'; readonly reason: string };

/**
 * Read a JSON file that may be missing, plaintext, or SAENC1-encrypted. Never throws.
 */
export async function readEncryptedJson<T>(filePath: string, dek: Buffer): Promise<LoadResult<T>> {
	let data: Buffer | undefined;
	try {
		data = await readFileOrUndefined(filePath);
	} catch (error) {
		return { kind: 'corrupt', reason: error instanceof Error ? error.message : String(error) };
	}
	if (data === undefined) {
		return { kind: 'missing' };
	}
	if (isEnvelope(data)) {
		try {
			const plaintext = open(data, dek);
			const value = JSON.parse(plaintext.toString('utf8')) as T;
			return { kind: 'encrypted', value };
		} catch (error) {
			return { kind: 'corrupt', reason: error instanceof Error ? error.message : String(error) };
		}
	}
	try {
		const value = JSON.parse(data.toString('utf8')) as T;
		return { kind: 'plaintext', value };
	} catch (error) {
		return { kind: 'corrupt', reason: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Write `value` as SAENC1-encrypted JSON via an atomic 0600 write.
 */
export async function writeEncryptedJson(filePath: string, value: unknown, dek: Buffer): Promise<void> {
	const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
	const envelope = seal(plaintext, dek);
	await writeFileAtomic(filePath, envelope);
}

/**
 * Load JSON with plaintext→encrypted migration and corrupt-file quarantine.
 */
export async function loadJson<T>(
	filePath: string,
	dek: Buffer,
	log?: (message: string) => void,
): Promise<{ readonly value: T | undefined; readonly migrated: boolean; readonly quarantined: boolean }> {
	const result = await readEncryptedJson<T>(filePath, dek);
	switch (result.kind) {
		case 'missing':
			return { value: undefined, migrated: false, quarantined: false };
		case 'encrypted':
			return { value: result.value, migrated: false, quarantined: false };
		case 'plaintext': {
			await writeEncryptedJson(filePath, result.value, dek);
			log?.(`Migrated plaintext store to encrypted envelope: ${filePath}`);
			return { value: result.value, migrated: true, quarantined: false };
		}
		case 'corrupt': {
			log?.(`Quarantining corrupt store ${filePath}: ${result.reason}`);
			await quarantineFile(filePath);
			return { value: undefined, migrated: false, quarantined: true };
		}
	}
}
