/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import {
	acquireDek,
	createMementoDekDurabilityMarker,
	type DekDurabilityMarker,
	open,
	seal,
} from './shared/encryptedStore';
import { deleteFileIfExists, ensureDir, writeFileAtomic } from './shared/secureFs';
import type { DraftAttachment } from './types';

export const DRAFT_ATTACHMENTS_DIR = 'draft-attachments';
export const DRAFT_ATTACHMENT_DEK_KEY_ID = 'safeappeals-email.dek.draftAttachments';

/** Per-file size limit (20 MiB). */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
/** Aggregate size limit per draft (20 MiB). */
export const MAX_DRAFT_ATTACHMENT_BYTES = 20 * 1024 * 1024;
/** Max attachments per draft. */
export const MAX_ATTACHMENTS_PER_DRAFT = 10;
/** Max basename length after sanitization. */
export const MAX_FILENAME_LENGTH = 255;

/** UUID v1–v8 (matches `randomUUID()` output). */
const SAFE_STORE_ID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONTENT_TYPES: Record<string, string> = {
	'.pdf': 'application/pdf',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.txt': 'text/plain',
	'.csv': 'text/csv',
	'.html': 'text/html',
	'.htm': 'text/html',
	'.json': 'application/json',
	'.doc': 'application/msword',
	'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'.xls': 'application/vnd.ms-excel',
	'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'.ppt': 'application/vnd.ms-powerpoint',
	'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'.zip': 'application/zip',
	'.eml': 'message/rfc822',
};

interface MemoryEntry {
	meta: DraftAttachment;
	bytes: Buffer;
}

/**
 * Sanitize a user-facing filename to a safe basename (≤255 chars).
 */
export function sanitizeAttachmentFilename(name: string): string {
	let base = path.basename(name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
	base = base.replace(/[\\/]/g, '_');
	if (!base || base === '.' || base === '..') {
		throw new Error('Invalid attachment filename');
	}
	if (base.length > MAX_FILENAME_LENGTH) {
		const ext = path.extname(base);
		const maxStem = Math.max(1, MAX_FILENAME_LENGTH - ext.length);
		base = base.slice(0, maxStem) + ext;
		if (base.length > MAX_FILENAME_LENGTH) {
			base = base.slice(0, MAX_FILENAME_LENGTH);
		}
	}
	return base;
}

export function guessContentType(filename: string): string {
	const ext = path.extname(filename).toLowerCase();
	return CONTENT_TYPES[ext] || 'application/octet-stream';
}

/**
 * Reject absolute paths, `..`, separators, and non-UUID ids before any filesystem join.
 */
export function assertSafeStoreId(id: string, label: string): string {
	const trimmed = (id ?? '').trim();
	if (!trimmed) {
		throw new Error(`${label} is required`);
	}
	if (
		path.isAbsolute(trimmed)
		|| trimmed.includes('..')
		|| /[\\/]/.test(trimmed)
		|| path.basename(trimmed) !== trimmed
		|| !SAFE_STORE_ID_RE.test(trimmed)
	) {
		throw new Error(`Invalid ${label}`);
	}
	return trimmed;
}

/**
 * Encrypted sidecar store for draft attachment bytes.
 * Path: `globalStorageUri/draft-attachments/<draftId>/<attachmentId>` (SAENC1 via seal/open).
 * Fail-safe: in-memory when DEK unavailable — never plaintext on disk.
 */
export class DraftAttachmentStore {
	private dek: Buffer | undefined;
	private mode: 'encrypted' | 'memory' = 'memory';
	private warnedUnavailable = false;
	private readonly marker: DekDurabilityMarker;
	private readonly memory = new Map<string, Map<string, MemoryEntry>>();

	constructor(
		private readonly storageUri: vscode.Uri,
		private readonly secrets: vscode.SecretStorage,
		globalState: vscode.Memento,
		private readonly log?: (msg: string) => void,
		private readonly showWarning: (message: string) => void = () => { /* no-op in tests */ },
	) {
		this.marker = createMementoDekDurabilityMarker(globalState, DRAFT_ATTACHMENT_DEK_KEY_ID);
	}

	async initialize(): Promise<void> {
		try {
			await ensureDir(this.rootPath());
			await this.acquireEncryptionKey();
		} catch (error) {
			this.dek = undefined;
			this.mode = 'memory';
			this.log?.(
				`DraftAttachmentStore.initialize failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Read a file from disk, enforce limits against existing draft metadata, seal and store.
	 */
	async addFromFile(
		draftId: string,
		existing: readonly DraftAttachment[],
		filePath: string,
	): Promise<DraftAttachment> {
		const safeDraftId = assertSafeStoreId(draftId, 'draftId');
		if (existing.length >= MAX_ATTACHMENTS_PER_DRAFT) {
			throw new Error(`A draft may have at most ${MAX_ATTACHMENTS_PER_DRAFT} attachments`);
		}

		const filename = sanitizeAttachmentFilename(filePath);
		let bytes: Buffer;
		try {
			bytes = await fs.readFile(filePath);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Could not read attachment: ${message}`);
		}
		if (bytes.length > MAX_ATTACHMENT_BYTES) {
			throw new Error(
				`Attachment exceeds ${MAX_ATTACHMENT_BYTES} byte limit (${bytes.length} bytes)`,
			);
		}
		const existingTotal = existing.reduce((sum, a) => sum + (a.size || 0), 0);
		if (existingTotal + bytes.length > MAX_DRAFT_ATTACHMENT_BYTES) {
			throw new Error(
				`Draft attachments exceed ${MAX_DRAFT_ATTACHMENT_BYTES} byte aggregate limit`,
			);
		}

		const meta: DraftAttachment = {
			id: randomUUID(),
			filename,
			contentType: guessContentType(filename),
			size: bytes.length,
		};
		await this.writeBytes(safeDraftId, meta, bytes);
		return meta;
	}

	async remove(draftId: string, attachmentId: string): Promise<void> {
		const safeDraftId = assertSafeStoreId(draftId, 'draftId');
		const safeAttachmentId = assertSafeStoreId(attachmentId, 'attachmentId');
		const draftMap = this.memory.get(safeDraftId);
		draftMap?.delete(safeAttachmentId);
		if (draftMap && draftMap.size === 0) {
			this.memory.delete(safeDraftId);
		}
		await deleteFileIfExists(this.filePath(safeDraftId, safeAttachmentId));
	}

	async readBytes(draftId: string, attachmentId: string): Promise<Buffer | undefined> {
		const safeDraftId = assertSafeStoreId(draftId, 'draftId');
		const safeAttachmentId = assertSafeStoreId(attachmentId, 'attachmentId');
		const mem = this.memory.get(safeDraftId)?.get(safeAttachmentId);
		if (mem) {
			return Buffer.from(mem.bytes);
		}
		if (this.mode !== 'encrypted' || !this.dek) {
			return undefined;
		}
		try {
			const envelope = await fs.readFile(this.filePath(safeDraftId, safeAttachmentId));
			return open(envelope, this.dek);
		} catch {
			return undefined;
		}
	}

	async purgeDraft(draftId: string): Promise<void> {
		const safeDraftId = assertSafeStoreId(draftId, 'draftId');
		this.memory.delete(safeDraftId);
		const dir = this.draftDir(safeDraftId);
		try {
			await fs.rm(dir, { recursive: true, force: true });
		} catch (error) {
			this.log?.(
				`purgeDraft failed for ${safeDraftId}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async purgeAll(): Promise<void> {
		this.memory.clear();
		try {
			await fs.rm(this.rootPath(), { recursive: true, force: true });
		} catch (error) {
			this.log?.(
				`purgeAll failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		try {
			await this.secrets.delete(DRAFT_ATTACHMENT_DEK_KEY_ID);
		} catch (error) {
			this.log?.(
				`Failed to delete DEK ${DRAFT_ATTACHMENT_DEK_KEY_ID}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		try {
			await this.marker.setStored(false);
		} catch (error) {
			this.log?.(
				`Failed to clear durability marker for ${DRAFT_ATTACHMENT_DEK_KEY_ID}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		this.dek = undefined;
		this.mode = 'memory';
		this.warnedUnavailable = false;
		await ensureDir(this.rootPath());
		await this.acquireEncryptionKey();
	}

	private async writeBytes(
		draftId: string,
		meta: DraftAttachment,
		bytes: Buffer,
	): Promise<void> {
		const safeDraftId = assertSafeStoreId(draftId, 'draftId');
		const safeAttachmentId = assertSafeStoreId(meta.id, 'attachmentId');
		if (this.mode === 'encrypted' && this.dek) {
			const envelope = seal(bytes, this.dek);
			await writeFileAtomic(this.filePath(safeDraftId, safeAttachmentId), envelope);
			return;
		}
		// Fail closed to memory — never plaintext on disk
		let draftMap = this.memory.get(safeDraftId);
		if (!draftMap) {
			draftMap = new Map();
			this.memory.set(safeDraftId, draftMap);
		}
		draftMap.set(safeAttachmentId, { meta, bytes: Buffer.from(bytes) });
		this.warnMemoryMode();
	}

	private warnMemoryMode(): void {
		if (this.warnedUnavailable) {
			return;
		}
		this.warnedUnavailable = true;
		this.showWarning(
			'Draft attachments will not survive a restart because secure storage is unavailable.',
		);
	}

	private rootPath(): string {
		return path.resolve(this.storageUri.fsPath, DRAFT_ATTACHMENTS_DIR);
	}

	private draftDir(draftId: string): string {
		const safeDraftId = assertSafeStoreId(draftId, 'draftId');
		const dir = path.resolve(this.rootPath(), safeDraftId);
		this.assertPathUnderRoot(dir, this.rootPath());
		return dir;
	}

	private filePath(draftId: string, attachmentId: string): string {
		const safeDraftId = assertSafeStoreId(draftId, 'draftId');
		const safeAttachmentId = assertSafeStoreId(attachmentId, 'attachmentId');
		const draftRoot = this.draftDir(safeDraftId);
		const resolved = path.resolve(draftRoot, safeAttachmentId);
		if (path.dirname(resolved) !== draftRoot) {
			throw new Error('Invalid attachment path');
		}
		this.assertPathUnderRoot(resolved, draftRoot);
		return resolved;
	}

	/** Ensure `candidate` is exactly `root` or a descendant (after resolve). */
	private assertPathUnderRoot(candidate: string, root: string): void {
		const resolvedCandidate = path.resolve(candidate);
		const resolvedRoot = path.resolve(root);
		if (resolvedCandidate === resolvedRoot) {
			return;
		}
		const prefix = resolvedRoot.endsWith(path.sep)
			? resolvedRoot
			: resolvedRoot + path.sep;
		if (!resolvedCandidate.startsWith(prefix)) {
			throw new Error('Path escapes draft attachment root');
		}
	}

	private async existingSidecarPaths(): Promise<string[]> {
		const root = this.rootPath();
		const paths: string[] = [];
		try {
			const draftDirs = await fs.readdir(root);
			for (const draftId of draftDirs) {
				if (!SAFE_STORE_ID_RE.test(draftId)) {
					continue;
				}
				const dir = path.join(root, draftId);
				let entries: string[];
				try {
					entries = await fs.readdir(dir);
				} catch {
					continue;
				}
				for (const entry of entries) {
					if (!SAFE_STORE_ID_RE.test(entry)) {
						continue;
					}
					paths.push(path.join(dir, entry));
				}
			}
		} catch {
			// root missing
		}
		return paths;
	}

	private async acquireEncryptionKey(): Promise<void> {
		const result = await acquireDek({
			secrets: this.secrets,
			keyId: DRAFT_ATTACHMENT_DEK_KEY_ID,
			existingDataPaths: await this.existingSidecarPaths(),
			log: this.log,
			marker: this.marker,
		});
		if (result.kind === 'ok') {
			this.dek = result.dek;
			this.mode = 'encrypted';
			return;
		}
		this.dek = undefined;
		this.mode = 'memory';
		this.log?.(`DraftAttachmentStore encryption unavailable (${result.reason})`);
		if (!this.warnedUnavailable) {
			this.warnedUnavailable = true;
			if (result.reason === 'secret-storage-unusable') {
				this.showWarning(
					'Draft attachments will not be saved to disk because secure storage is unavailable.',
				);
			} else {
				this.showWarning(
					'Draft attachment storage cannot be decrypted (key missing). Clear the local email cache to reset it.',
				);
			}
		}
	}
}
