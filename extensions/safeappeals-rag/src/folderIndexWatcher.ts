/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	docIdForSourceUri,
	isIndexableSourcePath,
	type IndexPipeline,
	type IndexPipelineResult,
} from './indexPipeline';
import {
	assertSourceUriInWorkspace,
	getWorkspaceRootPaths,
} from './pathGuard';
import type { HardDisableCode } from './types';
import { CORE_REFERENCES_FOLDER } from './types';

const DEFAULT_DEBOUNCE_MS = 400;

/** Glob suffixes watched for delete (and optional create/change) outside the editor save path. */
const INDEXABLE_GLOB_SUFFIXES = ['md', 'markdown', 'txt', 'text', 'pdf'] as const;

/**
 * Directory basenames skipped during workspace walks / save eligibility.
 * Keeps Private Search from indexing monorepo junk (build outputs, VCS, caches).
 */
export const INDEX_DENY_DIR_NAMES = new Set([
	'.git',
	'.hg',
	'.svn',
	'.vs',
	'.vscode-test',
	'.cursor',
	'.cache',
	'.next',
	'.turbo',
	'.yarn',
	'node_modules',
	'out',
	'dist',
	'build',
	'target',
	'coverage',
	'__pycache__',
	'.pytest_cache',
	'tmp',
	'temp',
	'bin',
	'obj',
	'apps',
	'to_sort',
	'tosort', // legacy folder name — keep so old workspaces are not indexed
	'.venv',
	'venv',
]);

export interface FolderIndexGate {
	readonly ok: boolean;
	readonly code?: HardDisableCode;
	readonly message?: string;
}

/** Counts recorded by the most recent startup scan. */
export interface FolderIndexScanStats {
	readonly scheduled: number;
	readonly indexed: number;
	readonly skippedUnchanged: number;
	readonly skippedOther: number;
	readonly hardDisable: number;
}

export interface FolderIndexWatcherDeps {
	readonly indexPipeline: Pick<IndexPipeline, 'indexPath'>;
	readonly getWorkspaceFolders?: () => readonly vscode.WorkspaceFolder[] | undefined;
	readonly debounceMs?: number;
	readonly log?: (message: string, consoleLevel?: 'log' | 'warn' | 'none') => void;
	/**
	 * When indexing is gated (e.g. models-missing), startup scan is deferred until
	 * {@link FolderIndexWatcher.notifyModelsReady} runs.
	 */
	readonly isIndexingAllowed?: () => FolderIndexGate;
	/** Optional removeDoc for core_references onDidDelete (host must expose it). */
	readonly removeDoc?: (docId: string) => { ok: boolean; error?: string | null };
	/** Injectable for unit tests (defaults to `vscode.workspace.createFileSystemWatcher`). */
	readonly createWatcher?: (
		pattern: vscode.RelativePattern,
	) => vscode.FileSystemWatcher;
	/** Injectable save subscription for unit tests. */
	readonly onDidSaveTextDocument?: (
		listener: (document: vscode.TextDocument) => void,
	) => vscode.Disposable;
	/**
	 * Walk a workspace root for indexable absolute paths (txt/md/pdf), applying the deny-list.
	 * Injectable for unit tests; defaults to recursive filesystem walk.
	 */
	readonly walkWorkspaceIndexableFiles?: (
		workspaceRootFsPath: string,
	) => Promise<readonly string[]>;
}

/** True when any path segment is in {@link INDEX_DENY_DIR_NAMES}. */
export function isUnderDeniedDir(fsPath: string, workspaceRoot: string): boolean {
	const resolved = path.resolve(fsPath);
	const root = path.resolve(workspaceRoot);
	if (resolved !== root && !resolved.startsWith(root + path.sep)) {
		return true;
	}
	const relative = resolved === root ? '' : resolved.slice(root.length + path.sep.length);
	if (!relative) {
		return false;
	}
	for (const segment of relative.split(path.sep)) {
		if (INDEX_DENY_DIR_NAMES.has(segment)) {
			return true;
		}
	}
	return false;
}

/**
 * Recursively list indexable txt/md/pdf under a workspace root, skipping deny-listed dirs.
 * Missing roots yield an empty list.
 */
export async function walkWorkspaceIndexableFilesDefault(
	workspaceRootFsPath: string,
): Promise<string[]> {
	const found: string[] = [];
	const root = path.resolve(workspaceRootFsPath);

	const walk = async (dir: string): Promise<void> => {
		let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
		try {
			const raw = await fs.readdir(dir, { withFileTypes: true });
			entries = raw.map(entry => ({
				name: String(entry.name),
				isDirectory: () => entry.isDirectory(),
				isFile: () => entry.isFile(),
			}));
		} catch (err) {
			const code = err && typeof err === 'object' && 'code' in err
				? String((err as { code: unknown }).code)
				: '';
			if (code === 'ENOENT') {
				return;
			}
			throw err;
		}
		for (const entry of entries) {
			if (INDEX_DENY_DIR_NAMES.has(entry.name)) {
				continue;
			}
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
				continue;
			}
			if (entry.isFile() && isIndexableSourcePath(full)) {
				found.push(full);
			}
		}
	};

	await walk(root);
	return found;
}

function pathToFileUri(fsPath: string): string {
	const normalized = fsPath.replace(/\\/g, '/');
	if (/^[A-Za-z]:\//.test(normalized)) {
		return `file:///${normalized}`;
	}
	return `file://${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

/**
 * Private Search folder indexer:
 * - FS watch `core_references/**` (create/change/delete)
 * - Startup walk of each workspace root for txt/md/pdf (deny-list applied)
 * - `onDidSaveTextDocument` for any workspace indexable file
 *
 * Scope is inferred by {@link IndexPipeline.indexPath} / `scopeFromSourcePath`:
 * paths under `core_references/` → `core_reference`; everything else → `case_index`.
 * There is no physical `case_index/` folder.
 */
export class FolderIndexWatcher implements vscode.Disposable {
	private readonly lifetime: vscode.Disposable[] = [];
	private readonly watchers: vscode.Disposable[] = [];
	private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();
	private readonly indexPipeline: Pick<IndexPipeline, 'indexPath'>;
	private readonly getWorkspaceFolders: () => readonly vscode.WorkspaceFolder[] | undefined;
	private readonly debounceMs: number;
	private readonly log?: (message: string, consoleLevel?: 'log' | 'warn' | 'none') => void;
	private readonly isIndexingAllowed?: () => FolderIndexGate;
	private readonly removeDoc?: (docId: string) => { ok: boolean; error?: string | null };
	private readonly createWatcher: (
		pattern: vscode.RelativePattern,
	) => vscode.FileSystemWatcher;
	private readonly onDidSaveTextDocument: (
		listener: (document: vscode.TextDocument) => void,
	) => vscode.Disposable;
	private readonly walkWorkspaceIndexableFiles: (
		workspaceRootFsPath: string,
	) => Promise<readonly string[]>;
	/** True when a startup scan was deferred due to models-missing / host / index lock. */
	private startupScanPending = false;
	private startupScanRunning = false;
	private lastScanStats: FolderIndexScanStats | undefined;

	constructor(deps: FolderIndexWatcherDeps) {
		this.indexPipeline = deps.indexPipeline;
		this.getWorkspaceFolders =
			deps.getWorkspaceFolders ?? (() => vscode.workspace.workspaceFolders);
		this.debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;
		this.log = deps.log;
		this.isIndexingAllowed = deps.isIndexingAllowed;
		this.removeDoc = deps.removeDoc;
		this.createWatcher =
			deps.createWatcher ??
			((pattern: vscode.RelativePattern) =>
				vscode.workspace.createFileSystemWatcher(pattern));
		this.onDidSaveTextDocument =
			deps.onDidSaveTextDocument ??
			((listener: (document: vscode.TextDocument) => void) =>
				vscode.workspace.onDidSaveTextDocument(listener));
		this.walkWorkspaceIndexableFiles =
			deps.walkWorkspaceIndexableFiles ?? walkWorkspaceIndexableFilesDefault;
	}

	/**
	 * Start FS watchers + save listener.
	 * By default runs a fire-and-forget startup scan; pass `deferInitialScan` when
	 * the host will `await` model warm first, then call {@link runInitialScan}.
	 */
	start(options?: { readonly deferInitialScan?: boolean }): void {
		this.rebuildWatchers();
		this.lifetime.push(
			vscode.workspace.onDidChangeWorkspaceFolders(() => {
				this.rebuildWatchers();
				void this.runStartupScan('workspace-folders-changed');
			}),
			this.onDidSaveTextDocument(document => {
				this.scheduleIfIndexCandidate(document.uri);
			}),
		);
		if (!options?.deferInitialScan) {
			void this.runStartupScan('activate');
		}
	}

	/** Awaitable first/retry startup scan (after model warm). Returns files scheduled. */
	async runInitialScan(reason = 'activate'): Promise<number> {
		return this.runStartupScan(reason);
	}

	/**
	 * Call after `refreshModelGates` / embedding warm clears `models-missing`
	 * so a deferred startup scan can run.
	 */
	notifyModelsReady(): void {
		if (this.startupScanPending) {
			this.log?.('Models ready — retrying deferred folder startup index.');
			void this.runStartupScan('models-ready');
		}
	}

	/** Test helper: whether startup scan is waiting on models / host. */
	isStartupScanPendingForTesting(): boolean {
		return this.startupScanPending;
	}

	/** Test helper: schedule without debounce (same path as FS/save). */
	scheduleForTesting(uri: vscode.Uri): void {
		this.schedule(uri);
	}

	/** Test helper: flush a pending debounce immediately. */
	async flushForTesting(uri: vscode.Uri): Promise<void> {
		const key = uri.fsPath;
		const existing = this.pending.get(key);
		if (existing) {
			clearTimeout(existing);
			this.pending.delete(key);
		}
		await this.handle(uri);
	}

	/** Test helper: run startup scan and await completion. Returns files scheduled. */
	async runStartupScanForTesting(reason = 'test'): Promise<number> {
		return this.runStartupScan(reason);
	}

	/** Stats from the most recent startup scan (undefined before first scan). */
	getLastScanStats(): FolderIndexScanStats | undefined {
		return this.lastScanStats;
	}

	/** Test helper: stats from the most recent startup scan. */
	getLastScanStatsForTesting(): FolderIndexScanStats | undefined {
		return this.lastScanStats;
	}

	private disposeWatchers(): void {
		for (const d of this.watchers.splice(0)) {
			d.dispose();
		}
		for (const timer of this.pending.values()) {
			clearTimeout(timer);
		}
		this.pending.clear();
	}

	private rebuildWatchers(): void {
		this.disposeWatchers();

		const folders = this.getWorkspaceFolders() ?? [];
		for (const folder of folders) {
			if (folder.uri.scheme !== 'file') {
				continue;
			}
			// core_references: create / change / delete
			const corePattern = new vscode.RelativePattern(
				folder,
				`${CORE_REFERENCES_FOLDER}/**/*`,
			);
			const coreWatcher = this.createWatcher(corePattern);
			this.watchers.push(
				coreWatcher,
				coreWatcher.onDidCreate(uri => this.schedule(uri)),
				coreWatcher.onDidChange(uri => this.schedule(uri)),
				coreWatcher.onDidDelete(uri => {
					void this.handleDelete(uri);
				}),
			);
			this.log?.(
				`Watching ${path.join(folder.uri.fsPath, CORE_REFERENCES_FOLDER)} for auto-index`,
			);

			// Workspace-wide txt/md/pdf deletes (case_index scope + core overlap). Deny-list in handleDelete.
			for (const suffix of INDEXABLE_GLOB_SUFFIXES) {
				const pattern = new vscode.RelativePattern(folder, `**/*.${suffix}`);
				const watcher = this.createWatcher(pattern);
				this.watchers.push(
					watcher,
					watcher.onDidDelete(uri => {
						void this.handleDelete(uri);
					}),
				);
			}
			this.log?.(
				`Watching ${folder.uri.fsPath}/**/*.{md,txt,pdf,…} for index remove-on-delete`,
			);
		}
	}

	/** Workspace file eligible for save/startup index (txt/md/pdf, not deny-listed). */
	private isIndexCandidate(fsPath: string): boolean {
		if (!isIndexableSourcePath(fsPath)) {
			return false;
		}
		const roots = getWorkspaceRootPaths(this.getWorkspaceFolders());
		const resolved = path.resolve(fsPath);
		for (const root of roots) {
			const resolvedRoot = path.resolve(root);
			if (resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep)) {
				return !isUnderDeniedDir(resolved, resolvedRoot);
			}
		}
		return false;
	}

	private scheduleIfIndexCandidate(uri: vscode.Uri): void {
		if (uri.scheme !== 'file') {
			return;
		}
		if (!this.isIndexCandidate(uri.fsPath)) {
			return;
		}
		this.schedule(uri);
	}

	private schedule(uri: vscode.Uri): void {
		if (uri.scheme !== 'file') {
			return;
		}
		const key = uri.fsPath;
		const existing = this.pending.get(key);
		if (existing) {
			clearTimeout(existing);
		}
		const timer = setTimeout(() => {
			this.pending.delete(key);
			void this.handle(uri);
		}, this.debounceMs);
		this.pending.set(key, timer);
	}

	private async runStartupScan(reason: string): Promise<number> {
		if (this.startupScanRunning) {
			return 0;
		}
		const gate = this.isIndexingAllowed?.();
		if (gate && !gate.ok) {
			if (
				gate.code === 'models-missing' ||
				gate.code === 'native-missing' ||
				gate.code === 'index-lock-busy'
			) {
				this.startupScanPending = true;
				this.log?.(
					`Startup index deferred (${reason}): ${gate.code}${gate.message ? ` — ${gate.message}` : ''}`,
				);
				return 0;
			}
			this.log?.(
				`Startup index skipped (${reason}): ${gate.code ?? 'unavailable'}`,
			);
			return 0;
		}

		this.startupScanRunning = true;
		this.startupScanPending = false;
		const stats = {
			scheduled: 0,
			indexed: 0,
			skippedUnchanged: 0,
			skippedOther: 0,
			hardDisable: 0,
		};
		try {
			const folders = this.getWorkspaceFolders() ?? [];
			for (const folder of folders) {
				if (folder.uri.scheme !== 'file') {
					continue;
				}
				const rootFsPath = folder.uri.fsPath;
				let files: readonly string[];
				try {
					files = await this.walkWorkspaceIndexableFiles(rootFsPath);
				} catch (err) {
					this.log?.(
						`Startup walk failed for ${rootFsPath}: ${err instanceof Error ? err.message : String(err)}`,
					);
					continue;
				}
				for (const fsPath of files) {
					if (!this.isIndexCandidate(fsPath)) {
						continue;
					}
					stats.scheduled += 1;
					await new Promise<void>(resolve => setImmediate(resolve));
					await this.indexStartupFile(vscode.Uri.file(fsPath), stats);
				}
			}
			this.lastScanStats = stats;
			this.logStartupScanSummary(reason, stats);
			return stats.scheduled;
		} finally {
			this.startupScanRunning = false;
		}
	}

	private async indexStartupFile(
		uri: vscode.Uri,
		stats: {
			indexed: number;
			skippedUnchanged: number;
			skippedOther: number;
			hardDisable: number;
		},
	): Promise<void> {
		const roots = getWorkspaceRootPaths(this.getWorkspaceFolders());
		try {
			assertSourceUriInWorkspace(uri.toString(), roots);
		} catch (err) {
			this.log?.(
				`Folder index watch skipped (PathGuard): ${err instanceof Error ? err.message : String(err)}`,
				'none',
			);
			return;
		}

		if (!this.isIndexCandidate(uri.fsPath)) {
			return;
		}

		const result = await this.indexPipeline.indexPath(uri.toString());
		this.recordStartupIndexResult(result, stats);
	}

	private recordStartupIndexResult(
		result: IndexPipelineResult,
		stats: {
			indexed: number;
			skippedUnchanged: number;
			skippedOther: number;
			hardDisable: number;
		},
	): void {
		if (result.kind === 'ok') {
			stats.indexed += 1;
			return;
		}
		if (result.kind === 'hard-disable') {
			stats.hardDisable += 1;
			if (result.code === 'models-missing') {
				this.startupScanPending = true;
			}
			return;
		}
		if (result.reason === 'Document already indexed (unchanged)') {
			stats.skippedUnchanged += 1;
			return;
		}
		stats.skippedOther += 1;
	}

	private logStartupScanSummary(
		reason: string,
		stats: FolderIndexScanStats,
	): void {
		const skippedTotal = stats.skippedUnchanged + stats.skippedOther;
		const parts: string[] = [];
		if (skippedTotal > 0) {
			parts.push(`${skippedTotal} skipped (unchanged)`);
		}
		if (stats.indexed > 0) {
			parts.push(`${stats.indexed} indexed`);
		}
		if (stats.hardDisable > 0) {
			parts.push(`${stats.hardDisable} hard-disable`);
		}
		const detail = parts.length > 0 ? parts.join(', ') : 'no files to index';
		this.log?.(
			`Startup scan complete (${reason}): ${detail} (${stats.scheduled} scheduled).`,
		);
	}

	private async handle(uri: vscode.Uri): Promise<void> {
		const roots = getWorkspaceRootPaths(this.getWorkspaceFolders());
		try {
			assertSourceUriInWorkspace(uri.toString(), roots);
		} catch (err) {
			this.log?.(
				`Folder index watch skipped (PathGuard): ${err instanceof Error ? err.message : String(err)}`,
			);
			return;
		}

		if (!this.isIndexCandidate(uri.fsPath)) {
			return;
		}

		const result = await this.indexPipeline.indexPath(uri.toString());
		this.logIndexResult(uri, result);
	}

	private async handleDelete(uri: vscode.Uri): Promise<void> {
		if (!this.removeDoc || uri.scheme !== 'file') {
			return;
		}
		// Path-based eligibility (deny-list + extension); file need not exist anymore.
		if (!this.isIndexCandidate(uri.fsPath)) {
			return;
		}
		const roots = getWorkspaceRootPaths(this.getWorkspaceFolders());
		try {
			assertSourceUriInWorkspace(uri.toString(), roots);
		} catch {
			return;
		}
		const sourceUri = uri.toString().startsWith('file:')
			? uri.toString()
			: pathToFileUri(uri.fsPath);
		const docId = docIdForSourceUri(sourceUri);
		const removed = this.removeDoc(docId);
		if (removed.ok) {
			this.log?.(`Removed indexed doc on delete: ${path.basename(uri.fsPath)}`);
		} else if (removed.error) {
			this.log?.(`removeDoc failed for ${path.basename(uri.fsPath)}: ${removed.error}`);
		}
	}

	/** Test helper: invoke delete path directly. */
	async handleDeleteForTesting(uri: vscode.Uri): Promise<void> {
		await this.handleDelete(uri);
	}

	private logIndexResult(uri: vscode.Uri, result: IndexPipelineResult): void {
		// Per-file OK is silent (status bar spinner + startup/batch summaries only).
		if (result.kind === 'ok') {
			return;
		}
		if (result.kind === 'hard-disable') {
			if (result.code === 'models-missing') {
				this.startupScanPending = true;
			}
			this.log?.(`Auto-index hard-disable (${result.code}): ${result.message}`);
			return;
		}
		if (result.reason === 'Document already indexed (unchanged)') {
			this.log?.(
				`Auto-index skipped (${path.basename(uri.fsPath)}): ${result.reason}`,
				'none',
			);
			return;
		}
		this.log?.(`Auto-index skipped (${path.basename(uri.fsPath)}): ${result.reason}`);
	}

	dispose(): void {
		this.disposeWatchers();
		for (const d of this.lifetime.splice(0)) {
			d.dispose();
		}
	}
}
