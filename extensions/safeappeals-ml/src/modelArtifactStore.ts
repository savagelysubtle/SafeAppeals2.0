/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createReadStream, createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Readable, type Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import type * as vscode from 'vscode';
import type { ModelCatalog } from './modelCatalog';
import type { ModelSpec } from './types';

/** Relative root under `context.globalStorageUri`. */
export const ML_MODELS_ROOT = 'ml-models';

/** Browser-like User-Agent for HuggingFace and CDN fetches. */
const HTTP_USER_AGENT =
	'Mozilla/5.0 (compatible; SafeAppeals/1.0; +https://safeappeals.com)';

/** Throttle download progress callbacks to ~4 Hz. */
const PROGRESS_THROTTLE_MS = 250;

/** Default idle stall timeout when no bytes arrive (ms). */
const DEFAULT_IDLE_TIMEOUT_MS = 45_000;

/** Default maximum download attempts including resume. */
const DEFAULT_MAX_ATTEMPTS = 5;

/** Exponential backoff base delay between retries (ms). */
const BACKOFF_BASE_MS = 500;

/** Cap for exponential backoff between retries (ms). */
const BACKOFF_CAP_MS = 8000;

export interface ArtifactManifestFileEntry {
	readonly relativePath: string;
	readonly sha256: string;
}

/** Manifest written after a successful consent download + SHA verify. */
export interface ArtifactManifest {
	readonly modelId: string;
	readonly version: string;
	readonly sha256: string;
	readonly fileName: string;
	readonly verifiedAt: number;
	readonly files?: readonly ArtifactManifestFileEntry[];
}

export interface ArtifactFetcherProgress {
	readonly bytesReceived: number;
	readonly bytesTotal?: number;
}

export type ArtifactFetcher = (
	url: string,
	options?: { readonly onProgress?: (progress: ArtifactFetcherProgress) => void },
) => Promise<Uint8Array>;

export interface DownloadToFileResult {
	readonly digest: string;
	readonly bytesWritten: number;
}

export interface DownloadUrlToFileOptions {
	readonly onProgress?: (progress: ArtifactFetcherProgress) => void;
	readonly idleTimeoutMs?: number;
	readonly maxAttempts?: number;
	readonly now?: () => number;
	readonly fetchImpl?: typeof fetch;
}

export type DownloadToFileFn = (
	url: string,
	destPath: string,
	options?: DownloadUrlToFileOptions,
) => Promise<DownloadToFileResult>;

export interface ArtifactDownloadProgress {
	readonly completedFiles: number;
	readonly totalFiles: number;
	readonly relativePath: string;
	readonly fileIndex?: number;
	readonly bytesReceived?: number;
	readonly bytesTotal?: number;
	readonly packBytesReceived?: number;
	readonly packBytesTotal?: number;
}

export interface ModelArtifactStoreDeps {
	/** Absolute fs path to `context.globalStorageUri`. */
	readonly globalStorageFsPath: string;
	readonly catalog: ModelCatalog;
	readonly fetcher?: ArtifactFetcher;
	readonly downloadToFile?: DownloadToFileFn;
	readonly now?: () => number;
	readonly mkdir?: (dir: string, opts: { recursive: boolean; mode?: number }) => Promise<void>;
	readonly writeFile?: (filePath: string, data: Uint8Array, opts?: { mode?: number }) => Promise<void>;
	readonly readFile?: (filePath: string) => Promise<Buffer>;
	readonly access?: (filePath: string) => Promise<void>;
	readonly chmod?: (filePath: string, mode: number) => Promise<void>;
	readonly stat?: (filePath: string) => Promise<{ size: number }>;
}

/**
 * Pack digest: sort `relativePath:sha256` lines (lowercase digest), join with `\n`, trailing `\n`, sha256 hex.
 */
export function packDigestSha256(
	files: readonly { relativePath: string; sha256: string }[],
): string {
	const body =
		[...files]
			.map(file => `${file.relativePath}:${file.sha256.toLowerCase()}`)
			.sort()
			.join('\n') + '\n';
	return createHash('sha256').update(body, 'utf8').digest('hex');
}

/**
 * Resolve a pack-relative path under `dir`, rejecting absolute paths and `..` segments.
 */
export function resolvePackRelativePath(dir: string, relativePath: string): string {
	if (path.isAbsolute(relativePath)) {
		throw new Error(`Unsafe artifact relativePath: ${relativePath}`);
	}
	const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
	if (!normalized || normalized.split('/').some(segment => segment === '..' || segment === '')) {
		throw new Error(`Unsafe artifact relativePath: ${relativePath}`);
	}
	const resolved = path.resolve(dir, normalized);
	const root = path.resolve(dir);
	if (resolved !== root && !resolved.startsWith(root + path.sep)) {
		throw new Error(`Artifact path escapes pack directory: ${relativePath}`);
	}
	return resolved;
}

export function sha256Hex(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

/** Stream-hash a file on disk without loading it entirely into RAM. */
export async function sha256HexFromFile(filePath: string): Promise<string> {
	const hash = createHash('sha256');
	const stream = createReadStream(filePath);
	for await (const chunk of stream) {
		hash.update(chunk);
	}
	return hash.digest('hex');
}

function partialFilePath(destPath: string): string {
	return `${destPath}.partial`;
}

/** Remove finalized artifact and any leftover partial download. */
async function deleteBadArtifact(artifactPath: string): Promise<void> {
	await fs.unlink(artifactPath).catch(() => undefined);
	await fs.unlink(partialFilePath(artifactPath)).catch(() => undefined);
}

/** Remove legacy timestamped `${destPath}.*.tmp` files from prior download implementation. */
async function deleteLegacyTmpFiles(destPath: string): Promise<void> {
	const dir = path.dirname(destPath);
	const baseName = path.basename(destPath);
	const prefix = `${baseName}.`;
	try {
		const entries = await fs.readdir(dir);
		for (const entry of entries) {
			if (entry.startsWith(prefix) && entry.endsWith('.tmp') && entry !== `${baseName}.partial`) {
				await fs.unlink(path.join(dir, entry)).catch(() => undefined);
			}
		}
	} catch {
		// parent dir may not exist yet
	}
}

/** Parse total file size from a `Content-Range: bytes start-end/total` header. */
function parseContentRangeTotal(contentRange: string | null): number | undefined {
	if (!contentRange) {
		return undefined;
	}
	const match = /^bytes \d+-\d+\/(\d+)$/.exec(contentRange);
	if (!match) {
		return undefined;
	}
	const parsed = Number.parseInt(match[1]!, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseContentLength(contentLength: string | null): number | undefined {
	if (!contentLength) {
		return undefined;
	}
	const parsed = Number.parseInt(contentLength, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function retryBackoffMs(attempt: number): number {
	return Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_CAP_MS);
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/** Wait for a writable stream to drain its internal buffer after backpressure. */
export function waitForWritableDrain(stream: Writable): Promise<void> {
	return once(stream, 'drain').then(() => undefined);
}

async function seedHashFromFile(
	hash: ReturnType<typeof createHash>,
	filePath: string,
): Promise<void> {
	const stream = createReadStream(filePath);
	for await (const chunk of stream) {
		hash.update(chunk);
	}
}

async function getPartialSize(partialPath: string): Promise<number> {
	try {
		const fileStat = await fs.stat(partialPath);
		return fileStat.size;
	} catch {
		return 0;
	}
}

function isRetryableHttpStatus(status: number): boolean {
	return status === 408 || status === 429 || status >= 500;
}

function isRetryableDownloadError(err: unknown): boolean {
	if (err instanceof DownloadStallError) {
		return true;
	}
	if (err instanceof RetryableHttpError) {
		return true;
	}
	if (err instanceof TypeError) {
		return true;
	}
	if (err instanceof Error && err.name === 'AbortError') {
		return true;
	}
	return false;
}

class DownloadStallError extends Error {
	constructor(idleTimeoutMs: number) {
		super(`Artifact download stalled (no data for ${idleTimeoutMs}ms)`);
		this.name = 'DownloadStallError';
	}
}

class RetryableHttpError extends Error {
	readonly status: number;

	constructor(status: number, url: string) {
		super(`Artifact download failed (${status}): ${url}`);
		this.name = 'RetryableHttpError';
		this.status = status;
	}
}

interface StreamDownloadContext {
	readonly url: string;
	readonly partialPath: string;
	readonly idleTimeoutMs: number;
	readonly onProgress?: (progress: ArtifactFetcherProgress) => void;
	readonly now: () => number;
}

/**
 * Stream response body to partial file with rolling SHA-256 and idle stall detection.
 * Caller prepares hash seeding and write stream flags before invoking.
 */
async function streamResponseBody(
	response: Response,
	writeStream: ReturnType<typeof createWriteStream>,
	hash: ReturnType<typeof createHash>,
	ctx: StreamDownloadContext,
	initialBytesReceived: number,
	bytesTotal: number | undefined,
): Promise<number> {
	if (!response.body) {
		throw new Error(`Artifact download failed (empty body): ${ctx.url}`);
	}

	let bytesReceived = initialBytesReceived;
	let lastProgressAt = 0;
	const reportProgress = (force = false): void => {
		const t = ctx.now();
		if (!force && t - lastProgressAt < PROGRESS_THROTTLE_MS) {
			return;
		}
		lastProgressAt = t;
		ctx.onProgress?.({ bytesReceived, bytesTotal });
	};

	reportProgress(true);

	const nodeStream = Readable.fromWeb(
		response.body as import('node:stream/web').ReadableStream,
	);

	let stallTimer: ReturnType<typeof setTimeout> | undefined;
	let rejectStall: ((err: DownloadStallError) => void) | undefined;

	const clearStallTimer = (): void => {
		if (stallTimer !== undefined) {
			clearTimeout(stallTimer);
			stallTimer = undefined;
		}
	};

	const armStallTimer = (): void => {
		clearStallTimer();
		stallTimer = setTimeout(() => {
			const stallErr = new DownloadStallError(ctx.idleTimeoutMs);
			nodeStream.destroy(stallErr);
			rejectStall?.(stallErr);
		}, ctx.idleTimeoutMs);
	};

	const stallPromise = new Promise<never>((_, reject) => {
		rejectStall = reject;
	});

	const streamTask = async (): Promise<number> => {
		try {
			armStallTimer();
			for await (const chunk of nodeStream) {
				clearStallTimer();
				const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
				hash.update(buffer);
				const canContinue = writeStream.write(buffer);
				bytesReceived += buffer.byteLength;
				reportProgress();
				if (!canContinue) {
					await waitForWritableDrain(writeStream);
				}
				armStallTimer();
			}
			clearStallTimer();
			writeStream.end();
			await finished(writeStream);
			return bytesReceived;
		} catch (err) {
			writeStream.destroy();
			if (err instanceof DownloadStallError) {
				throw err;
			}
			throw err;
		} finally {
			clearStallTimer();
		}
	};

	try {
		bytesReceived = await Promise.race([streamTask(), stallPromise]);
	} catch (err) {
		writeStream.destroy();
		if (err instanceof DownloadStallError) {
			throw err;
		}
		throw err;
	}

	reportProgress(true);
	return bytesReceived;
}

/**
 * Single download attempt: optional HTTP Range resume into `${destPath}.partial`.
 */
async function downloadUrlToFileAttempt(
	url: string,
	destPath: string,
	options: Required<Pick<DownloadUrlToFileOptions, 'idleTimeoutMs' | 'now' | 'fetchImpl'>> &
		Pick<DownloadUrlToFileOptions, 'onProgress'>,
): Promise<DownloadToFileResult> {
	const partialPath = partialFilePath(destPath);
	const parentDir = path.dirname(destPath);
	await fs.mkdir(parentDir, { recursive: true, mode: 0o700 });
	await deleteLegacyTmpFiles(destPath);

	let existingBytes = await getPartialSize(partialPath);
	const rangeRequested = existingBytes > 0;

	const headers: Record<string, string> = { 'User-Agent': HTTP_USER_AGENT };
	if (rangeRequested) {
		headers['Range'] = `bytes=${existingBytes}-`;
	}

	const fetchAbort = new AbortController();
	const fetchTimer = setTimeout(() => {
		fetchAbort.abort(new DownloadStallError(options.idleTimeoutMs));
	}, options.idleTimeoutMs);

	let response: Response;
	try {
		response = await options.fetchImpl(url, { headers, signal: fetchAbort.signal });
	} catch (err) {
		if (fetchAbort.signal.aborted) {
			const reason = fetchAbort.signal.reason;
			if (reason instanceof DownloadStallError) {
				throw reason;
			}
			throw new DownloadStallError(options.idleTimeoutMs);
		}
		throw err;
	} finally {
		clearTimeout(fetchTimer);
	}

	if (response.status === 416 && rangeRequested) {
		await fs.unlink(partialPath).catch(() => undefined);
		throw new RetryableHttpError(416, url);
	}

	if (!response.ok) {
		if (isRetryableHttpStatus(response.status)) {
			throw new RetryableHttpError(response.status, url);
		}
		throw new Error(`Artifact download failed (${response.status}): ${url}`);
	}

	let appendMode = false;
	let bytesTotal: number | undefined;
	let initialBytesReceived = existingBytes;

	if (rangeRequested && response.status === 206) {
		appendMode = true;
		bytesTotal = parseContentRangeTotal(response.headers.get('content-range'));
		if (bytesTotal === undefined) {
			const remaining = parseContentLength(response.headers.get('content-length'));
			if (remaining !== undefined) {
				bytesTotal = existingBytes + remaining;
			}
		}
	} else if (rangeRequested && response.status === 200) {
		existingBytes = 0;
		initialBytesReceived = 0;
		appendMode = false;
		await fs.unlink(partialPath).catch(() => undefined);
		bytesTotal = parseContentLength(response.headers.get('content-length'));
	} else {
		bytesTotal = parseContentLength(response.headers.get('content-length'));
	}

	const hash = createHash('sha256');
	if (appendMode && existingBytes > 0) {
		await seedHashFromFile(hash, partialPath);
	}

	const writeStream = createWriteStream(partialPath, {
		flags: appendMode ? 'a' : 'w',
		mode: 0o600,
	});

	const bytesReceived = await streamResponseBody(
		response,
		writeStream,
		hash,
		{
			url,
			partialPath,
			idleTimeoutMs: options.idleTimeoutMs,
			onProgress: options.onProgress,
			now: options.now,
		},
		initialBytesReceived,
		bytesTotal,
	);

	const digest = hash.digest('hex');
	await fs.rename(partialPath, destPath).catch(async () => {
		await fs.copyFile(partialPath, destPath);
		await fs.unlink(partialPath).catch(() => undefined);
	});

	return { digest, bytesWritten: bytesReceived };
}

/**
 * Stream an HTTP response body to `destPath`, rolling SHA-256, atomic rename on success.
 * Uses a stable `${destPath}.partial` for resume, idle stall detection, and retries.
 * Never assembles a full-file buffer in memory.
 */
export async function downloadUrlToFile(
	url: string,
	destPath: string,
	options?: DownloadUrlToFileOptions,
): Promise<DownloadToFileResult> {
	const idleTimeoutMs = options?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
	const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
	const now = options?.now ?? (() => Date.now());
	const fetchImpl = options?.fetchImpl ?? fetch;

	const attemptOptions = {
		onProgress: options?.onProgress,
		idleTimeoutMs,
		now,
		fetchImpl,
	};

	let lastError: unknown;
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			return await downloadUrlToFileAttempt(url, destPath, attemptOptions);
		} catch (err) {
			lastError = err;

			if (!isRetryableDownloadError(err)) {
				throw err;
			}

			if (attempt + 1 >= maxAttempts) {
				throw err;
			}

			await sleep(retryBackoffMs(attempt));
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error(`Artifact download failed after ${maxAttempts} attempts: ${url}`);
}

/**
 * Consent-gated model artifact storage under `globalStorageUri/ml-models/<id>/<version>/`.
 * Never downloads without `userConsented: true`.
 */
export class ModelArtifactStore {
	private readonly rootFsPath: string;
	private readonly catalog: ModelCatalog;
	private readonly fetcher: ArtifactFetcher;
	private readonly downloadToFile: DownloadToFileFn;
	private readonly now: () => number;
	private readonly mkdir: NonNullable<ModelArtifactStoreDeps['mkdir']>;
	private readonly writeFile: NonNullable<ModelArtifactStoreDeps['writeFile']>;
	private readonly readFile: NonNullable<ModelArtifactStoreDeps['readFile']>;
	private readonly access: NonNullable<ModelArtifactStoreDeps['access']>;
	private readonly chmod: NonNullable<ModelArtifactStoreDeps['chmod']>;
	private readonly stat: NonNullable<ModelArtifactStoreDeps['stat']>;

	constructor(deps: ModelArtifactStoreDeps) {
		this.rootFsPath = path.join(deps.globalStorageFsPath, ML_MODELS_ROOT);
		this.catalog = deps.catalog;
		this.fetcher = deps.fetcher ?? defaultHttpFetcher;
		this.downloadToFile = deps.downloadToFile ?? downloadUrlToFile;
		this.now = deps.now ?? (() => Date.now());
		this.mkdir = deps.mkdir ?? ((dir, opts) => fs.mkdir(dir, opts).then(() => undefined));
		this.writeFile = deps.writeFile ?? ((filePath, data, opts) => fs.writeFile(filePath, data, opts));
		this.readFile = deps.readFile ?? (filePath => fs.readFile(filePath));
		this.access = deps.access ?? (filePath => fs.access(filePath));
		this.chmod = deps.chmod ?? ((filePath, mode) => fs.chmod(filePath, mode));
		this.stat = deps.stat ?? (filePath => fs.stat(filePath));
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
	 * True when a verified manifest and artifact file(s) exist for the catalog version.
	 * SHA compares are case-insensitive on both sides.
	 */
	async isReady(modelId: string): Promise<boolean> {
		const spec = this.catalog.get(modelId);
		if (!spec?.version || !spec.sha256) {
			return false;
		}
		if (spec.files?.length) {
			return this.isMultiFileReady(modelId, spec);
		}
		if (!spec.artifactFileName) {
			return false;
		}
		return this.isSingleFileReady(modelId, spec);
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
		readonly onProgress?: (progress: ArtifactDownloadProgress) => void;
	}): Promise<{ readonly modelId: string; readonly version: string; readonly dir: string }> {
		if (options.userConsented !== true) {
			throw new Error('Model download refused: userConsented must be true (consent-only policy).');
		}

		const spec = this.catalog.get(options.modelId);
		if (!spec) {
			throw new Error(`Unknown model: ${options.modelId}`);
		}

		const version = options.version ?? spec.version;
		const packDigest = options.sha256 ?? spec.sha256;

		if (!version) {
			throw new Error(`Model ${options.modelId} has no version pinned for artifact storage.`);
		}
		if (!packDigest) {
			throw new Error(
				`Model ${options.modelId} has no sha256 pinned; refusing download until digest is configured.`,
			);
		}

		if (spec.files?.length) {
			return this.downloadMultiFilePack(
				options.modelId,
				spec,
				version,
				packDigest,
				options.onProgress,
			);
		}

		const downloadUrl = options.downloadUrl ?? spec.downloadUrl;
		const fileName = options.artifactFileName ?? spec.artifactFileName ?? 'model.bin';
		if (!downloadUrl) {
			throw new Error(
				`Model ${options.modelId} has no downloadUrl; refusing download until a URL is configured.`,
			);
		}

		return this.downloadSingleFile({
			modelId: options.modelId,
			version,
			sha256: packDigest,
			downloadUrl,
			fileName,
			onProgress: options.onProgress,
		});
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
			let files: readonly ArtifactManifestFileEntry[] | undefined;
			if (parsed.files !== undefined) {
				if (!Array.isArray(parsed.files)) {
					return undefined;
				}
				const entries: ArtifactManifestFileEntry[] = [];
				for (const item of parsed.files) {
					if (
						typeof item !== 'object' ||
						item === null ||
						typeof (item as ArtifactManifestFileEntry).relativePath !== 'string' ||
						typeof (item as ArtifactManifestFileEntry).sha256 !== 'string'
					) {
						return undefined;
					}
					entries.push({
						relativePath: (item as ArtifactManifestFileEntry).relativePath,
						sha256: (item as ArtifactManifestFileEntry).sha256,
					});
				}
				files = entries;
			}
			return {
				modelId: parsed.modelId,
				version: parsed.version,
				sha256: parsed.sha256,
				fileName: parsed.fileName,
				verifiedAt: parsed.verifiedAt,
				files,
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

	private async isSingleFileReady(modelId: string, spec: ModelSpec): Promise<boolean> {
		try {
			const manifest = await this.readManifest(modelId, spec.version!);
			if (!manifest) {
				return false;
			}
			const expectedSha = spec.sha256!.toLowerCase();
			if (
				manifest.sha256.toLowerCase() !== expectedSha ||
				manifest.fileName !== spec.artifactFileName
			) {
				return false;
			}
			const artifactPath = path.join(this.artifactDir(modelId, spec.version!), manifest.fileName);
			await this.access(artifactPath);
			const digest = await sha256HexFromFile(artifactPath);
			return digest.toLowerCase() === expectedSha;
		} catch {
			return false;
		}
	}

	private async isMultiFileReady(modelId: string, spec: ModelSpec): Promise<boolean> {
		const files = spec.files!;
		try {
			const manifest = await this.readManifest(modelId, spec.version!);
			if (!manifest) {
				return false;
			}
			const expectedPackSha = spec.sha256!.toLowerCase();
			if (manifest.sha256.toLowerCase() !== expectedPackSha || manifest.fileName !== 'pack') {
				return false;
			}
			if (!manifest.files || manifest.files.length !== files.length) {
				return false;
			}
			const manifestByPath = new Map(
				manifest.files.map(entry => [entry.relativePath, entry.sha256.toLowerCase()]),
			);
			const dir = this.artifactDir(modelId, spec.version!);
			for (const filePin of files) {
				const manifestSha = manifestByPath.get(filePin.relativePath);
				if (manifestSha !== filePin.sha256.toLowerCase()) {
					return false;
				}
				const artifactPath = resolvePackRelativePath(dir, filePin.relativePath);
				await this.access(artifactPath);
				const digest = await sha256HexFromFile(artifactPath);
				if (digest.toLowerCase() !== filePin.sha256.toLowerCase()) {
					return false;
				}
			}
			return true;
		} catch {
			return false;
		}
	}

	private packBytesEstimate(spec: ModelSpec): number | undefined {
		if (spec.diskMb > 0) {
			return spec.diskMb * 1024 * 1024;
		}
		return undefined;
	}

	private computePackByteProgress(
		packBytesDoneSoFar: number,
		currentBytesReceived: number,
		currentBytesTotal: number | undefined,
		spec: ModelSpec,
	): { packBytesReceived: number; packBytesTotal: number | undefined } {
		const packBytesReceived = packBytesDoneSoFar + currentBytesReceived;
		let packBytesTotal = this.packBytesEstimate(spec);
		if (currentBytesTotal !== undefined && currentBytesTotal > 0) {
			const knownTotal = packBytesDoneSoFar + currentBytesTotal;
			packBytesTotal =
				packBytesTotal !== undefined ? Math.max(packBytesTotal, knownTotal) : knownTotal;
		}
		return { packBytesReceived, packBytesTotal };
	}

	private async downloadSingleFile(options: {
		readonly modelId: string;
		readonly version: string;
		readonly sha256: string;
		readonly downloadUrl: string;
		readonly fileName: string;
		readonly onProgress?: (progress: ArtifactDownloadProgress) => void;
	}): Promise<{ readonly modelId: string; readonly version: string; readonly dir: string }> {
		const dir = this.artifactDir(options.modelId, options.version);
		await this.ensureArtifactDir(dir);

		const artifactPath = path.join(dir, options.fileName);
		const spec = this.catalog.get(options.modelId);
		const packBytesTotalEstimate = spec ? this.packBytesEstimate(spec) : undefined;

		let digest: string;
		if (this.fetcher !== defaultHttpFetcher) {
			const bytes = await this.fetcher(options.downloadUrl);
			digest = sha256Hex(bytes);
			if (digest !== options.sha256.toLowerCase()) {
				throw new Error(
					`SHA-256 mismatch for ${options.modelId}: expected ${options.sha256}, got ${digest}`,
				);
			}
			await this.writeAtomicFile(artifactPath, bytes);
		} else {
			const result = await this.downloadToFile(options.downloadUrl, artifactPath, {
				onProgress: ({ bytesReceived, bytesTotal }) => {
					const packBytesTotal =
						bytesTotal !== undefined
							? bytesTotal
							: packBytesTotalEstimate;
					options.onProgress?.({
						completedFiles: 0,
						totalFiles: 1,
						relativePath: options.fileName,
						bytesReceived,
						bytesTotal,
						packBytesReceived: bytesReceived,
						packBytesTotal,
					});
				},
			});
			digest = result.digest;
			if (digest !== options.sha256.toLowerCase()) {
				await deleteBadArtifact(artifactPath);
				throw new Error(
					`SHA-256 mismatch for ${options.modelId}: expected ${options.sha256}, got ${digest}`,
				);
			}
		}

		const manifest: ArtifactManifest = {
			modelId: options.modelId,
			version: options.version,
			sha256: digest,
			fileName: options.fileName,
			verifiedAt: this.now(),
		};
		await this.writeManifest(options.modelId, options.version, manifest);

		return { modelId: options.modelId, version: options.version, dir };
	}

	private async tryReuseVerifiedFile(
		artifactPath: string,
		expectedSha: string,
	): Promise<{ digest: string; bytesWritten: number } | undefined> {
		try {
			await this.access(artifactPath);
		} catch {
			return undefined;
		}
		const digest = await sha256HexFromFile(artifactPath);
		if (digest.toLowerCase() !== expectedSha.toLowerCase()) {
			return undefined;
		}
		const fileStat = await this.stat(artifactPath);
		return { digest, bytesWritten: fileStat.size };
	}

	private async downloadMultiFilePack(
		modelId: string,
		spec: ModelSpec,
		version: string,
		packDigest: string,
		onProgress?: (progress: ArtifactDownloadProgress) => void,
	): Promise<{ readonly modelId: string; readonly version: string; readonly dir: string }> {
		const files = spec.files!;
		for (const filePin of files) {
			if (!filePin.downloadUrl || !filePin.sha256) {
				throw new Error(
					`Model ${modelId} file ${filePin.relativePath} is missing downloadUrl or sha256; refusing download.`,
				);
			}
		}

		const computedDigest = packDigestSha256(files);
		if (computedDigest !== packDigest.toLowerCase()) {
			throw new Error(
				`Pack digest mismatch for ${modelId}: catalog pins ${packDigest}, computed ${computedDigest}`,
			);
		}

		const dir = this.artifactDir(modelId, version);
		await this.ensureArtifactDir(dir);

		const manifestFiles: ArtifactManifestFileEntry[] = [];
		let packBytesDoneSoFar = 0;

		for (let index = 0; index < files.length; index++) {
			const filePin = files[index]!;
			const artifactPath = resolvePackRelativePath(dir, filePin.relativePath);

			const reportProgress = (
				bytesReceived: number,
				bytesTotal?: number,
				completedFiles = index,
			): void => {
				const pack = this.computePackByteProgress(
					packBytesDoneSoFar,
					bytesReceived,
					bytesTotal,
					spec,
				);
				onProgress?.({
					completedFiles,
					totalFiles: files.length,
					relativePath: filePin.relativePath,
					fileIndex: index,
					bytesReceived,
					bytesTotal,
					packBytesReceived: pack.packBytesReceived,
					packBytesTotal: pack.packBytesTotal,
				});
			};

			reportProgress(0, undefined);

			const reused = await this.tryReuseVerifiedFile(artifactPath, filePin.sha256);
			let digest: string;
			let fileBytes: number;

			if (reused) {
				digest = reused.digest;
				fileBytes = reused.bytesWritten;
				reportProgress(fileBytes, fileBytes, index + 1);
			} else {
				const result = await this.downloadToFile(filePin.downloadUrl, artifactPath, {
					onProgress: ({ bytesReceived, bytesTotal }) => {
						reportProgress(bytesReceived, bytesTotal);
					},
				});
				digest = result.digest;
				fileBytes = result.bytesWritten;
				if (digest !== filePin.sha256.toLowerCase()) {
					await deleteBadArtifact(artifactPath);
					throw new Error(
						`SHA-256 mismatch for ${modelId}/${filePin.relativePath}: expected ${filePin.sha256}, got ${digest}`,
					);
				}
				reportProgress(fileBytes, fileBytes, index + 1);
			}

			packBytesDoneSoFar += fileBytes;
			manifestFiles.push({ relativePath: filePin.relativePath, sha256: digest });
		}

		const manifest: ArtifactManifest = {
			modelId,
			version,
			sha256: computedDigest,
			fileName: 'pack',
			verifiedAt: this.now(),
			files: manifestFiles,
		};
		await this.writeManifest(modelId, version, manifest);

		return { modelId, version, dir };
	}

	private async ensureArtifactDir(dir: string): Promise<void> {
		await this.mkdir(dir, { recursive: true, mode: 0o700 });
		if (process.platform !== 'win32') {
			try {
				await this.chmod(dir, 0o700);
			} catch {
				// best-effort on exotic FS
			}
		}
	}

	private async writeAtomicFile(artifactPath: string, bytes: Uint8Array): Promise<void> {
		const parentDir = path.dirname(artifactPath);
		await this.mkdir(parentDir, { recursive: true, mode: 0o700 });
		if (process.platform !== 'win32') {
			try {
				await this.chmod(parentDir, 0o700);
			} catch {
				// best-effort
			}
		}

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
	}

	private async writeManifest(
		modelId: string,
		version: string,
		manifest: ArtifactManifest,
	): Promise<void> {
		await this.writeFile(
			this.manifestPath(modelId, version),
			Buffer.from(`${JSON.stringify(manifest, null, '\t')}\n`, 'utf8'),
			{ mode: 0o600 },
		);
	}
}

async function defaultHttpFetcher(
	url: string,
	options?: { readonly onProgress?: (progress: ArtifactFetcherProgress) => void },
): Promise<Uint8Array> {
	const response = await fetch(url, {
		headers: { 'User-Agent': HTTP_USER_AGENT },
	});
	if (!response.ok) {
		throw new Error(`Artifact download failed (${response.status}): ${url}`);
	}
	if (!response.body) {
		throw new Error(`Artifact download failed (empty body): ${url}`);
	}

	const totalHeader = response.headers.get('content-length');
	const parsedTotal = totalHeader ? Number.parseInt(totalHeader, 10) : undefined;
	const bytesTotal =
		parsedTotal !== undefined && Number.isFinite(parsedTotal) ? parsedTotal : undefined;

	const chunks: Uint8Array[] = [];
	let bytesReceived = 0;
	let lastProgressAt = 0;
	const nodeStream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);

	for await (const chunk of nodeStream) {
		const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
		chunks.push(new Uint8Array(buffer));
		bytesReceived += buffer.byteLength;
		const now = Date.now();
		if (now - lastProgressAt >= PROGRESS_THROTTLE_MS || bytesReceived === bytesTotal) {
			lastProgressAt = now;
			options?.onProgress?.({ bytesReceived, bytesTotal });
		}
	}

	const bytes = new Uint8Array(bytesReceived);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}
