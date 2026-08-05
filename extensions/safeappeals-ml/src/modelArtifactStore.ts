/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import type { ModelCatalog } from './modelCatalog';
import type { ModelSpec } from './types';

/** Relative root under `context.globalStorageUri`. */
export const ML_MODELS_ROOT = 'ml-models';

/** Manifest written after a successful consent download + SHA verify. */
export interface ArtifactManifest {
	readonly modelId: string;
	readonly version: string;
	readonly sha256: string;
	readonly fileName: string;
	readonly verifiedAt: number;
}

export type ArtifactFetcher = (url: string) => Promise<Uint8Array>;

export interface ModelArtifactStoreDeps {
	/** Absolute fs path to `context.globalStorageUri`. */
	readonly globalStorageFsPath: string;
	readonly catalog: ModelCatalog;
	readonly fetcher?: ArtifactFetcher;
	readonly now?: () => number;
	readonly mkdir?: (dir: string, opts: { recursive: boolean; mode?: number }) => Promise<void>;
	readonly writeFile?: (filePath: string, data: Uint8Array, opts?: { mode?: number }) => Promise<void>;
	readonly readFile?: (filePath: string) => Promise<Buffer>;
	readonly access?: (filePath: string) => Promise<void>;
	readonly chmod?: (filePath: string, mode: number) => Promise<void>;
}

/**
 * Consent-gated model artifact storage under `globalStorageUri/ml-models/<id>/<version>/`.
 * Never downloads without `userConsented: true`.
 */
export class ModelArtifactStore {
	private readonly rootFsPath: string;
	private readonly catalog: ModelCatalog;
	private readonly fetcher: ArtifactFetcher;
	private readonly now: () => number;
	private readonly mkdir: NonNullable<ModelArtifactStoreDeps['mkdir']>;
	private readonly writeFile: NonNullable<ModelArtifactStoreDeps['writeFile']>;
	private readonly readFile: NonNullable<ModelArtifactStoreDeps['readFile']>;
	private readonly access: NonNullable<ModelArtifactStoreDeps['access']>;
	private readonly chmod: NonNullable<ModelArtifactStoreDeps['chmod']>;

	constructor(deps: ModelArtifactStoreDeps) {
		this.rootFsPath = path.join(deps.globalStorageFsPath, ML_MODELS_ROOT);
		this.catalog = deps.catalog;
		this.fetcher = deps.fetcher ?? defaultHttpFetcher;
		this.now = deps.now ?? (() => Date.now());
		this.mkdir = deps.mkdir ?? ((dir, opts) => fs.mkdir(dir, opts).then(() => undefined));
		this.writeFile = deps.writeFile ?? ((filePath, data, opts) => fs.writeFile(filePath, data, opts));
		this.readFile = deps.readFile ?? (filePath => fs.readFile(filePath));
		this.access = deps.access ?? (filePath => fs.access(filePath));
		this.chmod = deps.chmod ?? ((filePath, mode) => fs.chmod(filePath, mode));
	}

	static fromExtensionContext(
		context: Pick<vscode.ExtensionContext, 'globalStorageUri'>,
		catalog: ModelCatalog,
		extra: Partial<ModelArtifactStoreDeps> = {},
	): ModelArtifactStore {
		return new ModelArtifactStore({
			globalStorageFsPath: context.globalStorageUri.fsPath,
			catalog,
			...extra,
		});
	}

	/** `…/ml-models/<id>/<version>/` */
	artifactDir(modelId: string, version: string): string {
		return path.join(this.rootFsPath, modelId, version);
	}

	manifestPath(modelId: string, version: string): string {
		return path.join(this.artifactDir(modelId, version), 'manifest.json');
	}

	/**
	 * True when a verified manifest and artifact file exist for the catalog version.
	 * SHA compares are case-insensitive on both sides.
	 */
	async isReady(modelId: string): Promise<boolean> {
		const spec = this.catalog.get(modelId);
		if (!spec?.version || !spec.sha256 || !spec.artifactFileName) {
			return false;
		}
		try {
			const manifest = await this.readManifest(modelId, spec.version);
			if (!manifest) {
				return false;
			}
			const expectedSha = spec.sha256.toLowerCase();
			if (
				manifest.sha256.toLowerCase() !== expectedSha ||
				manifest.fileName !== spec.artifactFileName
			) {
				return false;
			}
			const artifactPath = path.join(this.artifactDir(modelId, spec.version), manifest.fileName);
			await this.access(artifactPath);
			const bytes = await this.readFile(artifactPath);
			return sha256Hex(bytes).toLowerCase() === expectedSha;
		} catch {
			return false;
		}
	}

	/**
	 * Download and SHA-verify an artifact. Requires literal `userConsented: true`.
	 * Never auto-downloads; callers must obtain explicit user consent first.
	 */
	async downloadWithConsent(options: {
		readonly modelId: string;
		readonly userConsented: true;
		readonly downloadUrl?: string;
		readonly sha256?: string;
		readonly version?: string;
		readonly artifactFileName?: string;
	}): Promise<{ readonly modelId: string; readonly version: string; readonly dir: string }> {
		if (options.userConsented !== true) {
			throw new Error('Model download refused: userConsented must be true (consent-only policy).');
		}

		const spec = this.catalog.get(options.modelId);
		if (!spec) {
			throw new Error(`Unknown model: ${options.modelId}`);
		}

		const version = options.version ?? spec.version;
		const sha256 = options.sha256 ?? spec.sha256;
		const downloadUrl = options.downloadUrl ?? spec.downloadUrl;
		const fileName = options.artifactFileName ?? spec.artifactFileName ?? 'model.bin';

		if (!version) {
			throw new Error(`Model ${options.modelId} has no version pinned for artifact storage.`);
		}
		if (!sha256) {
			throw new Error(
				`Model ${options.modelId} has no sha256 pinned; refusing download until digest is configured.`,
			);
		}
		if (!downloadUrl) {
			throw new Error(
				`Model ${options.modelId} has no downloadUrl; refusing download until a URL is configured.`,
			);
		}

		const dir = this.artifactDir(options.modelId, version);
		await this.mkdir(dir, { recursive: true, mode: 0o700 });
		if (process.platform !== 'win32') {
			try {
				await this.chmod(dir, 0o700);
			} catch {
				// best-effort on exotic FS
			}
		}

		const bytes = await this.fetcher(downloadUrl);
		const digest = sha256Hex(bytes);
		if (digest !== sha256.toLowerCase()) {
			throw new Error(
				`SHA-256 mismatch for ${options.modelId}: expected ${sha256}, got ${digest}`,
			);
		}

		const artifactPath = path.join(dir, fileName);
		const tmpPath = `${artifactPath}.${this.now()}.tmp`;
		await this.writeFile(tmpPath, bytes, { mode: 0o600 });
		if (process.platform !== 'win32') {
			try {
				await this.chmod(tmpPath, 0o600);
			} catch {
				// best-effort
			}
		}
		await fs.rename(tmpPath, artifactPath).catch(async () => {
			await this.writeFile(artifactPath, bytes, { mode: 0o600 });
			await fs.unlink(tmpPath).catch(() => undefined);
		});

		const manifest: ArtifactManifest = {
			modelId: options.modelId,
			version,
			sha256: digest,
			fileName,
			verifiedAt: this.now(),
		};
		await this.writeFile(
			this.manifestPath(options.modelId, version),
			Buffer.from(`${JSON.stringify(manifest, null, '\t')}\n`, 'utf8'),
			{ mode: 0o600 },
		);

		return { modelId: options.modelId, version, dir };
	}

	async readManifest(modelId: string, version: string): Promise<ArtifactManifest | undefined> {
		try {
			const raw = await this.readFile(this.manifestPath(modelId, version));
			const parsed = JSON.parse(raw.toString('utf8')) as Partial<ArtifactManifest>;
			if (
				typeof parsed.modelId !== 'string' ||
				typeof parsed.version !== 'string' ||
				typeof parsed.sha256 !== 'string' ||
				typeof parsed.fileName !== 'string' ||
				typeof parsed.verifiedAt !== 'number'
			) {
				return undefined;
			}
			return {
				modelId: parsed.modelId,
				version: parsed.version,
				sha256: parsed.sha256,
				fileName: parsed.fileName,
				verifiedAt: parsed.verifiedAt,
			};
		} catch {
			return undefined;
		}
	}

	/** Resolve the catalog {@link ModelSpec} used for readiness checks. */
	getSpec(modelId: string): ModelSpec | undefined {
		return this.catalog.get(modelId);
	}

	/**
	 * Delete installed artifacts under `ml-models/`.
	 * - `purge('unlimited-ocr')` removes that model id tree
	 * - `purge()` removes the entire `ml-models` root
	 */
	async purge(modelId?: string): Promise<{ readonly purged: readonly string[] }> {
		if (modelId) {
			const target = path.join(this.rootFsPath, modelId);
			await fs.rm(target, { recursive: true, force: true });
			return { purged: [modelId] };
		}

		let entries: string[] = [];
		try {
			entries = await fs.readdir(this.rootFsPath);
		} catch (err) {
			const code = (err as { code?: string } | null)?.code;
			if (code !== 'ENOENT') {
				throw err;
			}
			return { purged: [] };
		}
		await fs.rm(this.rootFsPath, { recursive: true, force: true });
		return { purged: entries };
	}

	/**
	 * Mark an install broken after a failed smoke test: quarantine manifest so
	 * {@link isReady} returns false until a fresh consent download succeeds.
	 */
	async markBroken(modelId: string, reason: string): Promise<void> {
		const spec = this.catalog.get(modelId);
		if (!spec?.version) {
			return;
		}
		const manifest = this.manifestPath(modelId, spec.version);
		try {
			await this.access(manifest);
		} catch {
			return;
		}
		const stamp = this.now();
		const brokenPath = `${manifest}.broken-${stamp}`;
		try {
			await fs.rename(manifest, brokenPath);
			await this.writeFile(
				`${brokenPath}.reason.txt`,
				Buffer.from(`${reason}\n`, 'utf8'),
				{ mode: 0o600 },
			);
		} catch {
			// best-effort: delete manifest if rename fails
			try {
				await fs.unlink(manifest);
			} catch {
				// ignore
			}
		}
	}
}

export function sha256Hex(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function defaultHttpFetcher(url: string): Promise<Uint8Array> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Artifact download failed (${response.status}): ${url}`);
	}
	const buffer = await response.arrayBuffer();
	const bytes = new Uint8Array(buffer.byteLength);
	bytes.set(new Uint8Array(buffer));
	return bytes;
}
