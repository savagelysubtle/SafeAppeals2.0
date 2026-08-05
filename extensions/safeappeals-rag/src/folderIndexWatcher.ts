/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	docIdForSourceUri,
	isIndexableTextPath,
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
]);

export interface FolderIndexGate {
	readonly ok: boolean;
	readonly code?: HardDisableCode;
	readonly message?: string;
}

export interface FolderIndexWatcherDeps {
	readonly indexPipeline: Pick<IndexPipeline, 'indexPath'>;
	readonly getWorkspaceFolders?: () => readonly vscode.WorkspaceFolder[] | undefined;
	readonly debounceMs?: number;
	readonly log?: (message: string) => void;
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
	 * Walk a workspace root for indexable absolute paths (txt/md), applying the deny-list.
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
 * Recursively list indexable txt/md under a workspace root, skipping deny-listed dirs.
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
			if (entry.isFile() && isIndexableTextPath(full)) {
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
 * - Startup walk of each workspace root for txt/md (deny-list applied)
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
	private readonly log?: (message: string) => void;
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
	/** True when a startup scan was deferred due to models-missing / host unavailable. */
	private startupScanPending = false;
	private startupScanRunning = false;

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

	/** Start core_references watchers, save listener, and fire-and-forget startup scan. */
	start(): void {
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
		void this.runStartupScan('activate');
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

	/** Test helper: run startup scan and await completion. */
	async runStartupScanForTesting(reason = 'test'): Promise<void> {
		await this.runStartupScan(reason);
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
			const pattern = new vscode.RelativePattern(
				folder,
				`${CORE_REFERENCES_FOLDER}/**/*`,
			);
			const watcher = this.createWatcher(pattern);
			this.watchers.push(
				watcher,
				watcher.onDidCreate(uri => this.schedule(uri)),
				watcher.onDidChange(uri => this.schedule(uri)),
				watcher.onDidDelete(uri => {
					void this.handleDelete(uri);
				}),
			);
			this.log?.(
				`Watching ${path.join(folder.uri.fsPath, CORE_REFERENCES_FOLDER)} for auto-index`,
			);
		}
	}

	/** Workspace file eligible for save/startup index (txt/md, not deny-listed). */
	private isIndexCandidate(fsPath: string): boolean {
		if (!isIndexableTextPath(fsPath)) {
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

	private async runStartupScan(reason: string): Promise<void> {
		if (this.startupScanRunning) {
			return;
		}
		const gate = this.isIndexingAllowed?.();
		if (gate && !gate.ok) {
			if (gate.code === 'models-missing' || gate.code === 'native-missing') {
				this.startupScanPending = true;
				this.log?.(
					`Startup index deferred (${reason}): ${gate.code}${gate.message ? ` — ${gate.message}` : ''}`,
				);
				return;
			}
			this.log?.(
				`Startup index skipped (${reason}): ${gate.code ?? 'unavailable'}`,
			);
			return;
		}

		this.startupScanRunning = true;
		this.startupScanPending = false;
		try {
			const folders = this.getWorkspaceFolders() ?? [];
			let scheduled = 0;
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
					this.schedule(vscode.Uri.file(fsPath));
					scheduled += 1;
				}
			}
			this.log?.(
				`Startup index scheduled ${scheduled} file(s) (${reason})`,
			);
		} finally {
			this.startupScanRunning = false;
		}
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
		if (!isIndexableTextPath(uri.fsPath)) {
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

	private logIndexResult(uri: vscode.Uri, result: IndexPipelineResult): void {
		if (result.kind === 'ok') {
			this.log?.(
				`Auto-indexed ${path.basename(uri.fsPath)} (${result.chunkCount} chunks, scope=${result.scope})`,
			);
		} else if (result.kind === 'hard-disable') {
			if (result.code === 'models-missing') {
				this.startupScanPending = true;
			}
			this.log?.(`Auto-index hard-disable (${result.code}): ${result.message}`);
		} else {
			this.log?.(`Auto-index skipped: ${result.reason}`);
		}
	}

	dispose(): void {
		this.disposeWatchers();
		for (const d of this.lifetime.splice(0)) {
			d.dispose();
		}
	}
}
