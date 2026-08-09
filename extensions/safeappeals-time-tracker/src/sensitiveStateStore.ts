/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import * as fsPromises from 'node:fs/promises';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import type * as vscode from 'vscode';
import { acquireDek, createMementoDekDurabilityMarker, open, seal } from './shared/encryptedStore';
import type { CustomUTBMSCodes, TimerState } from './types';
import { logError, logWarning } from './logger';
import {
	createSensitiveStateDeleteName, createSensitiveStateTemporaryName,
	sensitiveStateDeleteNamePattern, sensitiveStateTemporaryNamePattern
} from './storageArtifactNames';
import { getTimeTrackerWorkspaceId } from './workspaceIdentity';

interface SensitiveState {
	timerState?: TimerState;
	customCodes?: CustomUTBMSCodes;
}

const DEK_KEY_ID = 'time-tracker.dek.sensitive-state';
const STORE_FILE_NAME = 'sensitive-state.saenc';
const LEGACY_CODES_FILE_NAME = 'time-tracker-codes.json';
const PURGE_GENERATION_KEY = 'time-tracker.sensitive-state.purge-generation';
const WORKSPACE_PURGE_GENERATION_KEY = 'time-tracker.sensitive-state.workspace-purge-generation';

interface SensitiveStateContext {
	readonly globalStorageUri: { readonly fsPath: string };
	readonly secrets: vscode.SecretStorage;
	readonly globalState: vscode.Memento;
	readonly workspaceState: vscode.Memento;
}

interface FileIdentity { readonly device: string; readonly inode: string; readonly kind: string; readonly linkCount: number }
interface SecureFile { readonly descriptorPath: string; readonly identity: FileIdentity; close(): void }
interface DirectoryLock {
	writeSensitiveState(temporaryName: string, bytes: Buffer, expected?: FileIdentity): FileIdentity;
	quarantineCurrent(source: string, staging: string, expected: SecureFile): SecureFile;
	deleteQuarantine(staging: string, expected: SecureFile): void;
	fsyncDirectory(): void;
	close(): void;
}
interface SecureDirectory {
	enumerateChildren(limit: number): readonly { readonly name: string }[];
	openRegularFile(name: string, writable: boolean): SecureFile;
	acquireExclusiveLock(): DirectoryLock;
	openPrivateChild(name: string): SecureDirectory;
	close(): void;
}
interface LegacyCodesWorkspace {
	openCodes(): SecureFile;
	acquireExclusiveLock(): DirectoryLock & { quarantineCodes(staging: string, expected: SecureFile): SecureFile };
	close(): void;
}
interface SecureFsBinding {
	bootstrapPrivateDirectory(anchor: string, components: string[]): SecureDirectory;
	openLegacyCodesWorkspace(workspacePath: string): LegacyCodesWorkspace | null;
}

function loadSecureFs(): SecureFsBinding {
	const runtime = process.versions.electron ? 'electron' : 'node';
	const bindingPath = path.join(__dirname, '..', 'prebuilds', `${process.platform}-${process.arch}`, `${runtime}-${process.versions.modules}`, 'safeappeals_secure_fs.node');
	return require(bindingPath) as SecureFsBinding;
}

/** Encrypted persistence for timer descriptions, matter selection, and custom billing codes. */
export class SensitiveStateStore {
	private readonly storePath: string;
	private state: SensitiveState = {};
	private dek: Buffer | undefined;
	private writeQueue: Promise<void> = Promise.resolve();
	private readonly durable: boolean;
	private readonly workspaceId: string;
	private storeIdentity: FileIdentity | undefined;

	constructor(
		private readonly context: SensitiveStateContext,
		private readonly environment: {
			readonly workspacePath?: string;
			readonly workspaceIdentity?: string;
			readonly showMemoryFallbackWarning?: () => void;
			readonly showLegacyCleanupFailureWarning?: (legacyPath: string) => void;
			readonly deleteFileIfExists?: (filePath: string) => Promise<boolean>;
		} = {}
	) {
		this.durable = Boolean(environment.workspaceIdentity ?? environment.workspacePath);
		this.workspaceId = this.durable ? getTimeTrackerWorkspaceId(
			context.globalStorageUri.fsPath,
			environment.workspaceIdentity ?? environment.workspacePath
		) : '';
		this.storePath = this.durable ? path.join(context.globalStorageUri.fsPath, 'workspaces', this.workspaceId, STORE_FILE_NAME) : '';
	}

	async initialize(): Promise<boolean> {
		if (!this.durable || process.platform !== 'linux' || process.arch !== 'x64') {
			this.environment.showMemoryFallbackWarning?.();
			await this.applyPendingLegacyPurge();
			return false;
		}
		const result = await acquireDek({
			secrets: this.context.secrets,
			keyId: DEK_KEY_ID,
			existingDataPaths: [this.storePath],
			marker: createMementoDekDurabilityMarker(this.context.globalState, DEK_KEY_ID),
			log: logWarning,
		});
		if (result.kind === 'unavailable') {
			this.environment.showMemoryFallbackWarning?.();
			return false;
		}

		this.dek = result.dek;
		const directory = this.openManagedDirectory();
		try {
			const names = directory.enumerateChildren(256).map(entry => entry.name);
			if (names.includes(STORE_FILE_NAME)) {
				const held = directory.openRegularFile(STORE_FILE_NAME, false);
				try {
					this.storeIdentity = held.identity;
					this.state = JSON.parse(open(await fsPromises.readFile(held.descriptorPath), result.dek).toString('utf8')) as SensitiveState;
				} finally { held.close(); }
			}
		} finally { directory.close(); }
		await this.applyPendingLegacyPurge();
		await this.migrateLegacyState();
		return true;
	}

	private async migrateLegacyState(): Promise<void> {
		let changed = false;
		const legacyTimer = this.context.workspaceState.get<TimerState>('timerState');
		if (!this.state.timerState && legacyTimer) {
			this.state.timerState = legacyTimer;
			changed = true;
		}

		const workspacePath = this.environment.workspacePath;
		if (workspacePath) {
			const legacyPath = path.join(workspacePath, LEGACY_CODES_FILE_NAME);
			try {
				const codesWorkspace = loadSecureFs().openLegacyCodesWorkspace(workspacePath);
				if (codesWorkspace) {
					const heldCodes = codesWorkspace.openCodes();
					if (!this.state.customCodes) {
					const bytes = await fsPromises.readFile(heldCodes.descriptorPath);
					this.state.customCodes = JSON.parse(Buffer.from(bytes).toString('utf8')) as CustomUTBMSCodes;
					changed = true;
					await this.persist();
					}
					const lock = codesWorkspace.acquireExclusiveLock();
					try {
						const staging = `.safeappeals-tx-legacy-codes-${crypto.randomUUID()}`;
						const quarantined = lock.quarantineCodes(staging, heldCodes);
						lock.deleteQuarantine(staging, quarantined);
						quarantined.close();
					} finally { lock.close(); heldCodes.close(); codesWorkspace.close(); }
				}
			} catch (error) {
				if (!['ENOENT', 'FileNotFound', 'SA_FS_NOT_FOUND'].includes((error as { code?: string }).code ?? '')) {
					this.environment.showLegacyCleanupFailureWarning?.(legacyPath);
					throw new Error(`Failed to securely clean up legacy custom codes: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}

		if (changed) {
			await this.persist();
			await this.context.workspaceState.update('timerState', undefined);
		}
	}

	getTimerState(): TimerState | undefined {
		return this.state.timerState;
	}

	setTimerState(timerState: TimerState): void {
		this.state.timerState = timerState;
		void this.persist();
	}

	getCustomCodes(): CustomUTBMSCodes | undefined {
		return this.state.customCodes;
	}

	async setCustomCodes(customCodes: CustomUTBMSCodes): Promise<void> {
		this.state.customCodes = customCodes;
		await this.persist();
	}

	async purge(): Promise<void> {
		this.state = {};
		await this.writeQueue;
		if (this.durable) { this.deleteNativeState(this.openManagedDirectory()); }
		await this.context.workspaceState.update('timerState', undefined);
		if (!(await this.hasOtherWorkspaceStores())) {
			await this.deleteKeyAndMarker();
		}
		this.dek = undefined;
	}

	async purgeAll(): Promise<void> {
		this.state = {};
		await this.writeQueue;
		const globalStoragePath = this.context.globalStorageUri.fsPath;
		const workspaces = fs.existsSync(globalStoragePath)
			? loadSecureFs().bootstrapPrivateDirectory(globalStoragePath, ['workspaces'])
			: loadSecureFs().bootstrapPrivateDirectory(path.dirname(globalStoragePath), [path.basename(globalStoragePath), 'workspaces']);
		try {
			for (const entry of workspaces.enumerateChildren(4096)) {
				const child = workspaces.openPrivateChild(entry.name);
				this.deleteNativeState(child);
			}
		} finally { workspaces.close(); }
		await this.context.workspaceState.update('timerState', undefined);
		const generation = this.context.globalState.get<number>(PURGE_GENERATION_KEY, 0) + 1;
		await this.context.globalState.update(PURGE_GENERATION_KEY, generation);
		await this.context.workspaceState.update(WORKSPACE_PURGE_GENERATION_KEY, generation);
		await this.deleteKeyAndMarker();
		this.dek = undefined;
	}

	private async applyPendingLegacyPurge(): Promise<void> {
		const generation = this.context.globalState.get<number>(PURGE_GENERATION_KEY, 0);
		const appliedGeneration = this.context.workspaceState.get<number>(WORKSPACE_PURGE_GENERATION_KEY, 0);
		if (appliedGeneration < generation) {
			await this.context.workspaceState.update('timerState', undefined);
			await this.context.workspaceState.update(WORKSPACE_PURGE_GENERATION_KEY, generation);
		}
	}

	private async hasOtherWorkspaceStores(): Promise<boolean> {
		const workspacesPath = path.dirname(path.dirname(this.storePath));
		let workspaceNames: string[] = [];
		try { workspaceNames = await fsPromises.readdir(workspacesPath); } catch { return false; }
		for (const workspaceName of workspaceNames) {
			const candidate = path.join(workspacesPath, workspaceName, STORE_FILE_NAME);
			if (candidate !== this.storePath) {
				try { await fsPromises.access(candidate); return true; } catch { /* absent */ }
			}
		}
		return false;
	}

	private async deleteKeyAndMarker(): Promise<void> {
		await this.context.secrets.delete(DEK_KEY_ID);
		await createMementoDekDurabilityMarker(this.context.globalState, DEK_KEY_ID).setStored(false);
	}

	async flush(): Promise<void> {
		await this.writeQueue;
	}

	private persist(): Promise<void> {
		if (!this.dek) {
			return Promise.resolve();
		}
		const snapshot = structuredClone(this.state);
		this.writeQueue = this.writeQueue
			.catch(error => logError(`Previous encrypted state write failed: ${error instanceof Error ? error.message : String(error)}`))
			.then(() => this.writeNative(snapshot));
		return this.writeQueue;
	}

	private openManagedDirectory(): SecureDirectory {
		const globalStoragePath = this.context.globalStorageUri.fsPath;
		if (fs.existsSync(globalStoragePath)) {
			return loadSecureFs().bootstrapPrivateDirectory(globalStoragePath, ['workspaces', this.workspaceId]);
		}
		return loadSecureFs().bootstrapPrivateDirectory(path.dirname(globalStoragePath), [path.basename(globalStoragePath), 'workspaces', this.workspaceId]);
	}

	private async writeNative(snapshot: SensitiveState): Promise<void> {
		const directory = this.openManagedDirectory();
		const lock = directory.acquireExclusiveLock();
		try {
			const bytes = seal(Buffer.from(JSON.stringify(snapshot), 'utf8'), this.dek!);
			this.storeIdentity = lock.writeSensitiveState(
				createSensitiveStateTemporaryName(),
				bytes,
				this.storeIdentity
			);
		} finally { lock.close(); directory.close(); }
	}

	private deleteNativeState(directory: SecureDirectory): void {
		try {
			const lock = directory.acquireExclusiveLock();
			try {
				const names = directory.enumerateChildren(256).map(entry => entry.name);
				const malformed = names.find(name => name.startsWith('.safeappeals-tx-sensitive-state-')
					&& !sensitiveStateTemporaryNamePattern.test(name) && !sensitiveStateDeleteNamePattern.test(name));
				if (malformed) { throw new Error(`Unknown sensitive-state transaction artifact blocks purge: ${malformed}`); }
				const targets = names.filter(name => name === STORE_FILE_NAME
					|| sensitiveStateTemporaryNamePattern.test(name) || sensitiveStateDeleteNamePattern.test(name));
				for (const name of targets) {
					const held = directory.openRegularFile(name, true);
					try {
						const staging = createSensitiveStateDeleteName();
						const quarantined = lock.quarantineCurrent(name, staging, held);
						try {
							lock.fsyncDirectory();
							lock.deleteQuarantine(staging, quarantined);
							lock.fsyncDirectory();
						} finally { quarantined.close(); }
					} finally { held.close(); }
				}
			} finally { lock.close(); }
		} finally { directory.close(); }
		this.storeIdentity = undefined;
	}
}
