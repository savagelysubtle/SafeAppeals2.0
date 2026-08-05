/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type {
	AcquireOptions,
	IMlResourceEngine,
	MlLease,
	ResourceAdapter,
	ResourceKind,
} from './mlEngineTypes';
import type {
	ConsentInstallOutcome,
	HwSnapshot,
	IArtifactReadiness,
	IHwProbe,
	IModelCatalog,
	IModelSpecLite,
	ModelEvaluateResult,
} from './types';

const ML_EXTENSION_ID = 'safeappeals.safeappeals-ml';

/**
 * Minimal slice of safeappeals-ml activate() exports (sibling host).
 * Kept local so compile does not import sibling sources under rootDir.
 */
export interface SafeAppealsMlApi {
	readonly probe: IHwProbe;
	readonly catalog: IModelCatalog;
	readonly engine?: IMlResourceEngine;
	readonly artifactStore?: {
		isReady(modelId: string): Promise<boolean>;
		artifactDir(modelId: string, version: string): string;
		getSpec?(modelId: string): IModelSpecLite | undefined;
	};
	isArtifactReady(modelId: string): Promise<boolean>;
	/**
	 * Consent-gated install. Pass `userConsented: true` only after an explicit UI confirm.
	 * Never downloads without consent; fails closed when downloadUrl/sha256 are unset.
	 */
	consentInstall(modelId: string, userConsented: boolean): Promise<ConsentInstallOutcome>;
	withLease?<T>(
		kind: ResourceKind,
		options: AcquireOptions,
		fn: (lease: MlLease) => Promise<T>,
	): Promise<T>;
	reportCrash?(kind: ResourceKind, message?: string): void;
	registerAdapter?(adapter: ResourceAdapter): void;
}

export interface MlBridge {
	readonly catalog: IModelCatalog;
	readonly probe: IHwProbe;
	readonly artifacts: IArtifactReadiness;
	readonly engine: IMlResourceEngine | undefined;
	consentInstall(modelId: string, userConsented: boolean): Promise<ConsentInstallOutcome>;
	/** Absolute artifact directory when ready; undefined otherwise. */
	artifactDir(modelId: string): Promise<string | undefined>;
	withLease<T>(
		kind: ResourceKind,
		options: AcquireOptions,
		fn: (lease: MlLease) => Promise<T>,
	): Promise<T>;
	reportCrash(kind: ResourceKind, message?: string): void;
	registerAdapter(adapter: ResourceAdapter): void;
}

function resolveArtifactDir(
	api: SafeAppealsMlApi,
	modelId: string,
): Promise<string | undefined> {
	return (async () => {
		const store = api.artifactStore;
		if (!store) {
			return undefined;
		}
		const ready = await (api.isArtifactReady?.(modelId) ?? store.isReady(modelId));
		if (!ready) {
			return undefined;
		}
		const spec = store.getSpec?.(modelId) ?? api.catalog.get?.(modelId);
		const version = spec?.version;
		if (!version) {
			return undefined;
		}
		return store.artifactDir(modelId, version);
	})();
}

function engineMissingError(op: string): Error {
	return new Error(`safeappeals-ml MlResourceEngine is unavailable (${op}).`);
}

/**
 * Resolve probe/catalog/artifact readiness / consentInstall / engine from safeappeals-ml.
 */
export async function resolveMlBridge(log?: (message: string) => void): Promise<MlBridge | undefined> {
	const ext = vscode.extensions.getExtension<SafeAppealsMlApi>(ML_EXTENSION_ID);
	if (!ext) {
		log?.(`safeappeals-ml extension not found (${ML_EXTENSION_ID})`);
		return undefined;
	}
	const api = ext.isActive ? ext.exports : await ext.activate();
	if (!api?.catalog || !api?.probe) {
		log?.('safeappeals-ml activate() did not export catalog/probe');
		return undefined;
	}
	const consentInstall =
		typeof api.consentInstall === 'function'
			? api.consentInstall.bind(api)
			: async (modelId: string, _userConsented: boolean): Promise<ConsentInstallOutcome> => {
				log?.('safeappeals-ml activate() did not export consentInstall');
				return {
					kind: 'error',
					modelId,
					message: 'Private Search install is unavailable (safeappeals-ml consentInstall missing).',
				};
			};

	const artifactDir = (modelId: string) => resolveArtifactDir(api, modelId);
	const engine = api.engine;

	const withLease = <T>(
		kind: ResourceKind,
		options: AcquireOptions,
		fn: (lease: MlLease) => Promise<T>,
	): Promise<T> => {
		if (typeof api.withLease === 'function') {
			return api.withLease(kind, options, fn);
		}
		if (engine) {
			return engine.withLease(kind, options, fn);
		}
		return Promise.reject(engineMissingError('withLease'));
	};

	const reportCrash = (kind: ResourceKind, message?: string): void => {
		if (typeof api.reportCrash === 'function') {
			api.reportCrash(kind, message);
			return;
		}
		engine?.reportCrash(kind, message);
	};

	const registerAdapter = (adapter: ResourceAdapter): void => {
		if (typeof api.registerAdapter === 'function') {
			api.registerAdapter(adapter);
			return;
		}
		if (!engine) {
			throw engineMissingError('registerAdapter');
		}
		engine.registerAdapter(adapter);
	};

	if (!engine) {
		log?.('safeappeals-ml activate() did not export engine (M7 expected)');
	}

	return {
		catalog: api.catalog,
		probe: api.probe,
		artifacts: {
			isReady: (modelId: string) => api.isArtifactReady(modelId),
			artifactDir,
		},
		engine,
		consentInstall,
		artifactDir,
		withLease,
		reportCrash,
		registerAdapter,
	};
}

/** Test helper: fixed evaluate + readiness + optional consentInstall / artifact dirs / engine. */
export function fakeMlBridge(options: {
	readonly evaluate?: ModelEvaluateResult;
	readonly artifactReady?: boolean;
	readonly snapshot?: HwSnapshot;
	readonly consentInstall?: (modelId: string, userConsented: boolean) => Promise<ConsentInstallOutcome>;
	readonly catalogGet?: IModelCatalog['get'];
	readonly artifactDirs?: Readonly<Record<string, string>>;
	readonly engine?: IMlResourceEngine;
}): MlBridge {
	const snapshot: HwSnapshot = options.snapshot ?? {
		platform: 'linux',
		arch: 'x64',
		osRelease: '6.8.0',
		cpuModel: 'Test CPU',
		cpuCount: 8,
		totalRamMb: 32_768,
		freeRamMb: 16_384,
		diskFreeMb: 100_000,
		gpuVramMb: 12_288,
		gpuName: 'Test GPU',
		probedAt: 1,
	};
	const evaluate = options.evaluate ?? { eligible: true, reasons: [] };
	const artifactDir = async (modelId: string): Promise<string | undefined> => {
		if (options.artifactReady !== true && !options.artifactDirs?.[modelId]) {
			return undefined;
		}
		return options.artifactDirs?.[modelId];
	};
	const engine = options.engine;
	const passthroughLease = async <T>(
		kind: ResourceKind,
		optionsAcquire: AcquireOptions,
		fn: (lease: MlLease) => Promise<T>,
	): Promise<T> => {
		if (engine) {
			return engine.withLease(kind, optionsAcquire, fn);
		}
		const lease: MlLease = {
			id: 'fake',
			kind,
			jobId: optionsAcquire.jobId,
			release: async () => { },
		};
		return fn(lease);
	};
	return {
		catalog: {
			evaluate: () => evaluate,
			get: options.catalogGet,
		},
		probe: {
			snapshot: async () => snapshot,
		},
		artifacts: {
			isReady: async (modelId: string) =>
				options.artifactReady === true || Boolean(options.artifactDirs?.[modelId]),
			artifactDir,
		},
		engine,
		consentInstall: options.consentInstall ?? (async (modelId, userConsented) => {
			if (userConsented !== true) {
				return { kind: 'consent-required', modelId };
			}
			return { kind: 'installed', modelId, version: '1.0.0' };
		}),
		artifactDir,
		withLease: passthroughLease,
		reportCrash: (kind, message) => engine?.reportCrash(kind, message),
		registerAdapter: adapter => {
			if (!engine) {
				return;
			}
			engine.registerAdapter(adapter);
		},
	};
}
