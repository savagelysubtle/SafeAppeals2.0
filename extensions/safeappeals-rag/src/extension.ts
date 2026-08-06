/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { createHash, randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { isArtifactPinConfigured } from './artifactPin';
import { registerAgentTools } from './agentTools';
import {
	runScaffoldCoreReferencesCommand,
	SCAFFOLD_CORE_REFERENCES_COMMAND,
} from './coreReferencesScaffold';
import { ConverterDigitalPdfExtract } from './converterDigitalPdfExtract';
import { NotReadyDocParseBackend, type IDocParseBackend } from './docParseBackend';
import { DocParseHost } from './docParseHost';
import { EmbeddingAdapter } from './embeddingAdapter';
import { FolderIndexWatcher } from './folderIndexWatcher';
import { formatIngestSummaryDetail, formatIngestSummaryLines } from './ingestStatusSummary';
import { IndexPipeline } from './indexPipeline';
import { IngestRouter } from './ingestRouter';
import {
	INSTALL_MISSING_MODELS_COMMAND,
	resolveInstallMissingModelsPlan,
	runInstallMissingModels,
} from './installMissingModels';
import { buildPrivateSearchSetupScan, GET_SETUP_SCAN_COMMAND } from './setupScan';
import { SETUP_LOCAL_SEARCH_COMMAND } from './localAiSetupCompletion';
import { LocalAiSetupPanel } from './localAiSetupPanel';
import { resolveMlBridge, type MlBridge } from './mlBridge';
import { getWorkspaceRootPaths } from './pathGuard';
import {
	resolveActivateToast,
	resolvePrivateSearchBarState,
} from './privateSearchStatus';
import { isAgentSessionsWindow, RagCoreHost } from './ragCoreHost';
import { SealedMarkdownStore } from './sealedMarkdown';
import { UnlimitedOCRBackend } from './unlimitedOcrBackend';
import { UNLIMITED_OCR_MODEL_ID } from './types';

/** Managed root segment when no workspace folder is open. */
export const NO_FOLDER_WORKSPACE_KEY = '_nofolder';

const OUTPUT_CHANNEL_NAME = 'Private Search';
const STATUS_BAR_PRIORITY = 48;
const INDEX_IDLE_TOAST_DEBOUNCE_MS = 2000;

let outputChannel: vscode.OutputChannel | undefined;
let statusBar: vscode.StatusBarItem | undefined;
let extensionContext: vscode.ExtensionContext | undefined;
let ingestRouter: IngestRouter | undefined;
let sealedStore: SealedMarkdownStore | undefined;
let docParseBackend: IDocParseBackend | undefined;
let mlBridge: MlBridge | undefined;
let ragCoreHost: RagCoreHost | undefined;
let indexPipeline: IndexPipeline | undefined;
let folderWatcher: FolderIndexWatcher | undefined;
let hardDisableChannelShown = false;
let indexIdleToastTimer: ReturnType<typeof setTimeout> | undefined;
let awaitStartupIndexIdleToast = false;
let startupOkIndexed = 0;
let finishedIndexToastShown = false;

/**
 * Lifecycle log: always to Output channel (timestamped); also console for lifecycle lines.
 * Pass `consoleLevel: 'none'` for high-volume / non-lifecycle detail that should stay
 * channel-only (or omit console entirely for suppressed per-file noise).
 */
function log(
	message: string,
	consoleLevel: 'log' | 'warn' | 'none' = 'log',
): void {
	const line = `[${new Date().toISOString()}] ${message}`;
	outputChannel?.appendLine(line);
	if (consoleLevel === 'log') {
		console.log(`[safeappeals-rag] ${message}`);
	} else if (consoleLevel === 'warn') {
		console.warn(`[safeappeals-rag] ${message}`);
	}
}

function refreshStatusBar(): void {
	if (!statusBar) {
		return;
	}
	const hostStatus = ragCoreHost?.getStatus();
	const bar = resolvePrivateSearchBarState({
		available: hostStatus?.available === true,
		disableCode: hostStatus?.disableCode,
		isSecondary: hostStatus?.indexWriteRole === 'secondary',
		indexing: indexPipeline?.isIndexing() === true,
		documentCount: hostStatus?.stats?.documents,
	});

	const localizedTooltip =
		bar.kind === 'ready'
			? vscode.l10n.t('On-device search. Click for status.')
			: bar.kind === 'readOnlySearch'
				? vscode.l10n.t('On-device search (read-only). Indexing runs in the main window.')
				: bar.kind === 'indexing'
					? vscode.l10n.t('Indexing workspace files…')
					: bar.kind === 'setupNeeded'
						? vscode.l10n.t('Local search models not installed. Click for status.')
						: vscode.l10n.t('Private Search unavailable. Click for details.');

	const localizedText =
		bar.kind === 'ready'
			? vscode.l10n.t(
				'$(search) Private Search · {0} docs',
				hostStatus?.stats?.documents ?? 0,
			)
			: bar.kind === 'readOnlySearch'
				? vscode.l10n.t(
					'$(search) Private Search · {0} docs (read-only)',
					hostStatus?.stats?.documents ?? 0,
				)
				: bar.text;

	statusBar.text = localizedText;
	statusBar.tooltip = localizedTooltip;
}

function maybeShowHardDisableChannel(): void {
	const code = ragCoreHost?.getStatus().disableCode;
	if (!code || hardDisableChannelShown) {
		return;
	}
	hardDisableChannelShown = true;
	outputChannel?.show(true);
}

function scheduleFinishedIndexingToast(): void {
	if (!awaitStartupIndexIdleToast || finishedIndexToastShown) {
		return;
	}
	if (indexIdleToastTimer) {
		clearTimeout(indexIdleToastTimer);
	}
	indexIdleToastTimer = setTimeout(() => {
		indexIdleToastTimer = undefined;
		if (!awaitStartupIndexIdleToast || finishedIndexToastShown) {
			return;
		}
		if (indexPipeline?.isIndexing()) {
			return;
		}
		finishedIndexToastShown = true;
		awaitStartupIndexIdleToast = false;
		const n = startupOkIndexed;
		if (n <= 0) {
			refreshStatusBar();
			return;
		}
		log(`Startup indexing finished: ${n} file(s).`);
		void vscode.window.showInformationMessage(
			vscode.l10n.t('Private Search finished indexing {0} file(s).', n),
		);
		refreshStatusBar();
	}, INDEX_IDLE_TOAST_DEBOUNCE_MS);
}

async function showActivateToasts(scanScheduled: number): Promise<void> {
	const status = ragCoreHost?.getStatus();
	const toast = resolveActivateToast({
		available: status?.available === true,
		disableCode: status?.disableCode,
		isSecondary: status?.indexWriteRole === 'secondary',
		indexingOrScanScheduled:
			scanScheduled > 0 || indexPipeline?.isIndexing() === true,
	});

	if (toast.kind === 'runningAndIndexing') {
		void vscode.window.showInformationMessage(
			vscode.l10n.t(
				'Private Search is running and indexing workspace text files.',
			),
		);
		return;
	}

	if (toast.kind === 'modelsMissing') {
		maybeShowHardDisableChannel();
		let includeOcrHint = false;
		if (mlBridge) {
			try {
				const plan = await resolveInstallMissingModelsPlan(mlBridge);
				includeOcrHint = plan.includeOcr;
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				log(`Install plan probe failed (toast): ${message}`, 'warn');
			}
		}
		const install = vscode.l10n.t('Install Missing Models');
		const setup = vscode.l10n.t('Set Up Private Search');
		const choice = await vscode.window.showWarningMessage(
			includeOcrHint
				? vscode.l10n.t(
					'Local search and scanned-PDF tools are not installed. Private Search needs a one-time setup.',
				)
				: vscode.l10n.t(
					'Local search models are not installed. Private Search needs a one-time setup.',
				),
			install,
			setup,
		);
		if (choice === install) {
			await runActivateToastCommand(INSTALL_MISSING_MODELS_COMMAND, 'Install Missing Models');
		} else if (choice === setup) {
			await runActivateToastCommand(SETUP_LOCAL_SEARCH_COMMAND, 'Set Up Private Search');
		}
		return;
	}

	if (toast.kind === 'unavailable') {
		maybeShowHardDisableChannel();
		const showStatus = vscode.l10n.t('Show Status');
		const choice = await vscode.window.showWarningMessage(
			status?.disableMessage ??
			vscode.l10n.t('Private Search is unavailable. See status for details.'),
			showStatus,
		);
		if (choice === showStatus) {
			await runActivateToastCommand('safeappeals-rag.showStatus', 'Show Status');
		}
	}
}

/**
 * Run a toast action command with logging — never fail silently if the command is missing.
 */
async function runActivateToastCommand(commandId: string, label: string): Promise<void> {
	try {
		await vscode.commands.executeCommand(commandId);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log(`${label} failed (${commandId}): ${message}`, 'warn');
		outputChannel?.show(true);
		void vscode.window.showErrorMessage(
			vscode.l10n.t('{0} failed: {1}', label, message),
		);
	}
}

async function notifySearchPackReady(
	ml: MlBridge | undefined,
	host: RagCoreHost | undefined,
	writeLog: (message: string) => void,
): Promise<void> {
	await host?.refreshModelGates();
	refreshStatusBar();
	await warmEmbeddingAtStartup(ml, host, writeLog);
	// Activate may have skipped pipeline/watcher while models-missing; wire now.
	await ensureIndexPipeline(ml);
	const scanScheduled = await ensureFolderIndexing('search-pack-ready', ml);
	if (scanScheduled === 0) {
		folderWatcher?.notifyModelsReady();
	}
	refreshStatusBar();
}

/**
 * True when search/index tools may use rag-core: host available, or only waiting on Search pack models.
 * Applies to primary and secondary sessions (Agents window gets IndexPipeline for read-only index attempts).
 */
function canEnsureIndexPipeline(): boolean {
	if (!ingestRouter || !ragCoreHost) {
		return false;
	}
	const status = ragCoreHost.getStatus();
	return status.available === true || status.disableCode === 'models-missing';
}

/**
 * True when folder watcher + initial scan may run (primary write-capable session only).
 */
function canStartFolderIndexing(): boolean {
	if (!canEnsureIndexPipeline() || !ragCoreHost) {
		return false;
	}
	const status = ragCoreHost.getStatus();
	if (status.indexWriteRole === 'secondary' || status.capabilities?.indexWriteCapable === false) {
		return false;
	}
	return true;
}

function createEmbeddingLeaseWrapper(ml: MlBridge | undefined): (<T>(fn: () => Promise<T>) => Promise<T>) | undefined {
	return ml
		? <T>(fn: () => Promise<T>): Promise<T> =>
			ml.withLease('embedding', { jobId: `embedding:${randomUUID()}` }, async () => fn())
		: undefined;
}

function createIndexPipelineInstance(host: RagCoreHost, ml: MlBridge | undefined): IndexPipeline {
	return new IndexPipeline({
		ingest: ingestRouter!,
		host,
		getWorkspaceRoots: () => getWorkspaceRootPaths(vscode.workspace.workspaceFolders),
		withEmbeddingLease: createEmbeddingLeaseWrapper(ml),
		log,
		onIndexingChanged: (indexing, _inFlight) => {
			refreshStatusBar();
			if (indexing) {
				if (indexIdleToastTimer) {
					clearTimeout(indexIdleToastTimer);
					indexIdleToastTimer = undefined;
				}
			} else {
				scheduleFinishedIndexingToast();
			}
		},
		onIndexResult: result => {
			if (awaitStartupIndexIdleToast && result.kind === 'ok') {
				startupOkIndexed += 1;
			}
		},
	});
}

/**
 * Create IndexPipeline when rag-core search is available (primary or secondary).
 * Agent index tools call through the pipeline so `assertIndexingAllowed()` can return read-only-session.
 */
async function ensureIndexPipeline(ml: MlBridge | undefined): Promise<boolean> {
	if (!canEnsureIndexPipeline() || !ragCoreHost || !ingestRouter) {
		return false;
	}
	if (indexPipeline) {
		return true;
	}
	try {
		indexPipeline = createIndexPipelineInstance(ragCoreHost, ml);
		refreshStatusBar();
		log('Private Search index pipeline ready (agent tools + manual index).');
		return true;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log(`Private Search index pipeline startup failed: ${message}`, 'warn');
		indexPipeline = undefined;
		return false;
	}
}

/**
 * Create FolderIndexWatcher + initial scan when primary (write-capable session).
 * IndexPipeline is ensured first so secondary sessions still get agent index tools.
 * @returns number of files scheduled for indexing (0 if already wired or unavailable)
 */
async function ensureFolderIndexing(
	reason: string,
	ml: MlBridge | undefined,
): Promise<number> {
	if (!canStartFolderIndexing() || !ragCoreHost || !ingestRouter) {
		return 0;
	}

	const pipelineReady = await ensureIndexPipeline(ml);
	if (!pipelineReady || !indexPipeline) {
		return 0;
	}

	if (folderWatcher) {
		folderWatcher.notifyModelsReady();
		return 0;
	}

	const host = ragCoreHost;
	const context = extensionContext;
	try {
		folderWatcher = new FolderIndexWatcher({
			indexPipeline,
			log,
			isIndexingAllowed: () => {
				const gate = host.assertIndexingAllowed();
				if (gate.ok) {
					return { ok: true };
				}
				return { ok: false, code: gate.code, message: gate.message };
			},
			removeDoc: docId => host.removeDoc(docId),
		});
		folderWatcher.start({ deferInitialScan: true });
		const scanScheduled = await folderWatcher.runInitialScan(reason);
		folderWatcher.notifyModelsReady();
		context?.subscriptions.push(folderWatcher);
		refreshStatusBar();

		if (scanScheduled > 0) {
			awaitStartupIndexIdleToast = true;
			startupOkIndexed = 0;
			finishedIndexToastShown = false;
			if (!indexPipeline.isIndexing()) {
				scheduleFinishedIndexingToast();
			}
			log(`Folder indexing started (${reason}): scheduled ${scanScheduled} file(s).`);
		} else {
			log(`Folder indexing wired (${reason}); no indexable files scheduled.`);
		}
		return scanScheduled;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log(`Private Search folder indexing startup failed (${reason}): ${message}`, 'warn');
		folderWatcher = undefined;
		return 0;
	}
}

/**
 * Warm the embedding adapter when Search pack / BYO dirs are ready.
 * Call before the first FolderIndexWatcher startup scan so gates are settled
 * (avoids warm-vs-scan race leaving startupScanPending stuck).
 */
async function warmEmbeddingAtStartup(
	ml: MlBridge | undefined,
	host: RagCoreHost | undefined,
	writeLog: (message: string) => void,
): Promise<void> {
	if (!host) {
		return;
	}
	try {
		await host.refreshModelGates();
	} catch (err) {
		writeLog(
			`Startup model gate refresh failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	const status = host.getStatus();
	const embedReady =
		status.modelEnv?.embedReady === true || status.capabilities?.modelsPresent === true;
	if (!embedReady) {
		writeLog(
			'Embedding warm skipped at startup (Search pack / BYO embed dir not ready).',
		);
		return;
	}

	if (ml?.withLease) {
		try {
			await ml.withLease(
				'embedding',
				{ jobId: `embedding-warm:${randomUUID()}` },
				async () => {
					// Lease load runs EmbeddingAdapter.load → sync env + refreshModelGates.
				},
			);
			writeLog('Embedding model warmed at startup (withLease).');
		} catch (err) {
			writeLog(
				`Embedding warm failed: ${err instanceof Error ? err.message : String(err)}`,
			);
			try {
				await host.refreshModelGates();
			} catch {
				// ignore secondary refresh errors
			}
		}
	} else {
		writeLog('Embedding warm skipped (MlResourceEngine withLease unavailable).');
	}
}

/**
 * Background warm + first index scan. Must not run on the activate critical path
 * (ONNX load routinely exceeds the extension-host startup budget).
 */
async function warmThenIndex(
	ml: MlBridge | undefined,
	host: RagCoreHost | undefined,
	writeLog: (message: string, level?: 'none' | 'warn') => void,
): Promise<void> {
	try {
		await warmEmbeddingAtStartup(ml, host, writeLog);
		refreshStatusBar();
		await ensureIndexPipeline(ml);
		if (canStartFolderIndexing()) {
			await ensureFolderIndexing('activate-after-warm', ml);
		} else if (host) {
			const status = host.getStatus();
			if (status.indexWriteRole === 'secondary') {
				writeLog(
					'Private Search folder indexing skipped in Agents window (read-only search session).',
				);
			} else {
				writeLog(
					`Private Search folder indexing skipped after warm (${status.disableCode ?? 'unavailable'}).`,
					'warn',
				);
			}
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		writeLog(`Deferred embedding warm / indexing failed: ${message}`, 'warn');
	}
}

export function workspaceIdForFolder(workspaceFolderUri: vscode.Uri | undefined): string {
	if (!workspaceFolderUri) {
		return NO_FOLDER_WORKSPACE_KEY;
	}
	return createHash('sha256')
		.update(workspaceFolderUri.toString())
		.digest('hex')
		.slice(0, 16);
}

function formatStatusLines(): string[] {
	const hostStatus = ragCoreHost?.getStatus();
	const caps = hostStatus?.capabilities;
	const stats = hostStatus?.stats;
	const lines = [
		`Ingest router: ${ingestRouter ? 'ready' : 'unavailable'}`,
		`Sealed Markdown: ${sealedStore ? (sealedStore.memoryOnly ? 'memory-only' : 'encrypted') : 'unavailable'}`,
		`Digital PDF extract: ${ingestRouter ? 'sa-converter (born-digital)' : 'unavailable'}`,
		`rag-core native: ${hostStatus?.nativeVersion ?? 'unavailable'}`,
		`rag-core available: ${hostStatus?.available ? 'yes' : 'no'}`,
		`Session: ${hostStatus?.indexWriteRole ?? 'unknown'} (${hostStatus?.capabilities?.indexWriteCapable ? 'index+search' : 'search-only'})`,
		`Indexing: ${indexPipeline?.isIndexing() ? `in flight (${indexPipeline.getInFlightCount()})` : 'idle'}`,
	];

	if (hostStatus?.disableCode) {
		lines.push(`Hard-disable: ${hostStatus.disableCode}`);
		if (hostStatus.disableMessage) {
			lines.push(`  ${hostStatus.disableMessage}`);
		}
		for (const reason of hostStatus.reasons) {
			lines.push(`  - ${reason}`);
		}
	}

	if (caps) {
		lines.push(
			`Capabilities: hybrid=${caps.hybrid} qp=${caps.queryProcessor} rerank=${caps.rerank} ` +
			`modelsPresent=${caps.modelsPresent} storageReady=${caps.storageReady} dims=${caps.dims} ` +
			`readOnly=${caps.indexWriteRole === 'secondary'} indexWriteRole=${caps.indexWriteRole ?? 'none'} indexWriteCapable=${caps.indexWriteCapable}`,
		);
	} else {
		lines.push('Capabilities: (unavailable)');
	}

	if (stats) {
		lines.push(
			`Stats: documents=${stats.documents} chunks=${stats.chunks} vectors=${stats.vectors} textDocs=${stats.textDocs}`,
		);
	} else {
		lines.push('Stats: (workspace not open)');
	}

	if (hostStatus?.workspaceRoot) {
		lines.push(`Index root: ${hostStatus.workspaceRoot}`);
	}
	if (hostStatus?.modelEnv) {
		lines.push(
			`Model env: embed=${hostStatus.modelEnv.embedDir ?? '(unset)'} ce=${hostStatus.modelEnv.ceDir ?? '(unset)'}`,
		);
	}
	lines.push(`Packaging: ${hostStatus?.electron146Note ?? 'see PACKAGING.md'}`);

	let docReady = false;
	let docParseUrl = '(invalid or unavailable)';
	if (docParseBackend instanceof UnlimitedOCRBackend) {
		// refresh is async — status command awaits separately
	} else {
		docReady = docParseBackend?.isReady() === true;
	}
	try {
		docParseUrl = DocParseHost.resolveBaseUrl();
	} catch (err) {
		docParseUrl = err instanceof Error ? err.message : String(err);
	}
	lines.push(`DocParse URL: ${docParseUrl}`);
	lines.push(`DocParse / Unlimited-OCR: ${docReady ? 'ready' : 'not ready'} (refresh on Show Status)`);
	const ocrPinned = mlBridge?.catalog.get?.(UNLIMITED_OCR_MODEL_ID);
	const pinConfigured = isArtifactPinConfigured(ocrPinned);
	if (!pinConfigured) {
		lines.push(
			'Honest gaps: Unlimited-OCR artifact pins missing; scanned PDF OCR hard-disables until configured.',
		);
	} else {
		lines.push(
			'Unlimited-OCR: HF commit-pinned (consent install when HW eligible + sidecar ready).',
		);
	}
	return lines;
}

/**
 * Activate the RAG host shell: ingest + DocParse + rag-core host (M6) + Local AI setup.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
	extensionContext = context;
	outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
	context.subscriptions.push(outputChannel);

	statusBar = vscode.window.createStatusBarItem('privateSearch', vscode.StatusBarAlignment.Left, STATUS_BAR_PRIORITY);
	statusBar.command = 'safeappeals-rag.showStatus';
	statusBar.tooltip = vscode.l10n.t('On-device search. Click for status.');
	statusBar.text = '$(search) Private Search';
	statusBar.show();
	context.subscriptions.push(statusBar);
	context.subscriptions.push({
		dispose: () => {
			if (indexIdleToastTimer) {
				clearTimeout(indexIdleToastTimer);
				indexIdleToastTimer = undefined;
			}
		},
	});

	log('Activating Private Search…');

	const workspaceId = workspaceIdForFolder(vscode.workspace.workspaceFolders?.[0]?.uri);
	const sealed = await SealedMarkdownStore.create(context, workspaceId, log);
	sealedStore = sealed.store;
	if (sealed.memoryOnly) {
		log(`Sealed Markdown store is memory-only (${sealed.dekReason ?? 'unknown'}).`, 'warn');
	} else {
		log(`Sealed Markdown store ready under rag/${workspaceId}/sealed_md.`);
	}

	const ml = await resolveMlBridge(log);
	mlBridge = ml;
	if (ml) {
		let backend: IDocParseBackend = new NotReadyDocParseBackend();
		let sidecarUrlLabel = '(unavailable)';
		try {
			const host = DocParseHost.fromWorkspaceSettings(log);
			sidecarUrlLabel = host.baseUrlValue;
			const unlimited = new UnlimitedOCRBackend({
				host,
				artifacts: ml.artifacts,
				getWorkspaceRoots: () => getWorkspaceRootPaths(vscode.workspace.workspaceFolders),
				pageSoftCap: 40,
				log,
				onSidecarCrash: message => {
					log(`DocParse sidecar crash: ${message}`, 'warn');
					ml.reportCrash('docparse', message);
				},
			});
			backend = unlimited;
			const ready = await unlimited.refreshReady();
			log(
				`DocParse sidecar @ ${sidecarUrlLabel}: ${ready ? 'ready' : 'not ready'} ` +
				`(artifacts + health). Override with SAFEAPPEALS_DOCPARSE_URL or setting safeappeals.rag.docParseSidecarUrl.`,
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			log(`DocParse host refused (fail closed): ${message}`, 'warn');
			backend = new NotReadyDocParseBackend();
		}
		docParseBackend = backend;

		const withDocParseLease = <T>(fn: () => Promise<T>): Promise<T> =>
			ml.withLease('docparse', { jobId: `docparse:${randomUUID()}` }, async () => fn());

		const ensureDocParseReady = () => ml.ensureDocParseReady();
		const refreshDocParseReady = async (): Promise<boolean> => {
			if (backend instanceof UnlimitedOCRBackend) {
				return backend.refreshReady();
			}
			return backend.isReady();
		};

		ingestRouter = new IngestRouter({
			catalog: ml.catalog,
			probe: ml.probe,
			artifacts: ml.artifacts,
			digitalPdf: new ConverterDigitalPdfExtract({ log }),
			docParse: backend,
			sealedStore: sealed.store,
			withDocParseLease,
			ensureDocParseReady,
			refreshDocParseReady,
			log,
		});
		log(
			ml.engine
				? 'Ingest router ready (born-digital PDF via sa-converter; DocParse via withLease(docparse)).'
				: 'Ingest router ready (MlResourceEngine missing — DocParse leases unavailable).',
		);
	} else {
		log('Ingest router unavailable: safeappeals-ml bridge missing.', 'warn');
	}

	ragCoreHost = await RagCoreHost.create({
		context,
		workspaceId,
		getArtifactDir: modelId =>
			mlBridge?.artifactDir(modelId) ?? Promise.resolve(undefined),
		log,
		preferSecondary: isAgentSessionsWindow(),
	});
	context.subscriptions.push({
		dispose: () => {
			ragCoreHost?.closeWorkspace();
		},
	});

	if (ml?.engine && ragCoreHost) {
		try {
			ml.registerAdapter(
				new EmbeddingAdapter({
					getArtifactDir: modelId => ml.artifactDir(modelId),
					ensureRagCoreReady: async () => {
						await ragCoreHost!.refreshModelGates();
						refreshStatusBar();
					},
					ragHost: ragCoreHost,
					log,
				}),
			);
			log('Registered EmbeddingAdapter on safeappeals-ml MlResourceEngine.');
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			log(`EmbeddingAdapter registration failed: ${message}`, 'warn');
		}
	}

	// Re-evaluate model gates after openWorkspace (artifact sync only; embed load is lease-owned).
	await ragCoreHost.refreshModelGates();
	refreshStatusBar();

	// EH startup budget — never await ONNX load in activate.
	void warmThenIndex(ml, ragCoreHost, log);

	// Register commands BEFORE activate toasts — toast buttons call executeCommand, and
	// awaiting the toast previously blocked registration (Set Up Private Search no-op).
	context.subscriptions.push(
		vscode.commands.registerCommand('safeappeals-rag.showStatus', async () => {
			if (docParseBackend instanceof UnlimitedOCRBackend) {
				await docParseBackend.refreshReady();
			}
			const hostStatus = ragCoreHost?.getStatus();
			const docParseReady =
				docParseBackend instanceof UnlimitedOCRBackend
					? docParseBackend.isReady()
					: docParseBackend?.isReady() === true;
			const scanStats = folderWatcher?.getLastScanStats();
			const lastScan = scanStats
				? {
					skipped: scanStats.skippedUnchanged + scanStats.skippedOther,
					indexed: scanStats.indexed,
					hardDisable: scanStats.hardDisable,
				}
				: undefined;
			const summaryInput = {
				available: hostStatus?.available === true,
				disableCode: hostStatus?.disableCode,
				disableMessage: hostStatus?.disableMessage,
				indexWriteRole: hostStatus?.indexWriteRole,
				indexWriteCapable: hostStatus?.capabilities?.indexWriteCapable,
				indexing: indexPipeline?.isIndexing() === true,
				inFlight: indexPipeline?.getInFlightCount() ?? 0,
				stats: hostStatus?.stats,
				docParseReady,
				modelsPresent: hostStatus?.capabilities?.modelsPresent,
				lastScan,
			};
			const summaryDetail = formatIngestSummaryDetail(summaryInput);
			const summaryLines = formatIngestSummaryLines(summaryInput);
			const docCount = hostStatus?.stats?.documents;
			const primaryMessage =
				docCount === undefined
					? vscode.l10n.t('Private Search')
					: docCount === 1
						? vscode.l10n.t('Private Search — 1 doc indexed')
						: vscode.l10n.t('Private Search — {0} docs indexed', docCount);
			const lines = formatStatusLines();
			if (docParseBackend instanceof UnlimitedOCRBackend) {
				const ready = docParseBackend.isReady();
				const idx = lines.findIndex(l => l.startsWith('DocParse / Unlimited-OCR:'));
				if (idx >= 0) {
					lines[idx] = `DocParse / Unlimited-OCR: ${ready ? 'ready' : 'not ready'}`;
				}
			}
			log('--- Ingest summary ---', 'none');
			for (const line of summaryLines) {
				log(line, 'none');
			}
			log('', 'none');
			log('--- Private Search status ---', 'none');
			for (const line of lines) {
				log(line, 'none');
			}
			outputChannel?.show(true);
			refreshStatusBar();
			const openLog = vscode.l10n.t('Open Log');
			const setupScanned = vscode.l10n.t('Set Up Scanned PDFs');
			const startScanned = vscode.l10n.t('Start Scanned PDF Tools');
			const actions: string[] = [];
			let ocrEligible = false;
			let ocrArtifactsReady = false;
			let ocrPinConfigured = false;
			if (mlBridge) {
				try {
					const snapshot = await mlBridge.probe.snapshot();
					ocrEligible = mlBridge.catalog.evaluate(UNLIMITED_OCR_MODEL_ID, snapshot).eligible;
					ocrArtifactsReady = await mlBridge.artifacts.isReady(UNLIMITED_OCR_MODEL_ID);
					ocrPinConfigured = isArtifactPinConfigured(
						mlBridge.catalog.get?.(UNLIMITED_OCR_MODEL_ID),
					);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					log(`OCR status probe failed: ${message}`, 'warn');
				}
			}
			if (ocrEligible && ocrPinConfigured && !ocrArtifactsReady) {
				actions.push(setupScanned);
			} else if (ocrArtifactsReady && !docParseReady) {
				actions.push(startScanned);
			}
			actions.push(openLog);
			const choice = await vscode.window.showInformationMessage(
				primaryMessage,
				{ detail: summaryDetail, modal: true },
				...actions,
			);
			if (choice === setupScanned) {
				await vscode.commands.executeCommand(SETUP_LOCAL_SEARCH_COMMAND);
			} else if (choice === startScanned) {
				const result = await mlBridge?.ensureDocParseReady();
				if (docParseBackend instanceof UnlimitedOCRBackend) {
					await docParseBackend.refreshReady();
				}
				refreshStatusBar();
				if (result?.ready) {
					void vscode.window.showInformationMessage(
						vscode.l10n.t('Scanned PDF tools are ready.'),
					);
				} else {
					void vscode.window.showErrorMessage(
						vscode.l10n.t(
							'Could not start scanned PDF tools: {0}',
							result?.detail ?? 'not ready',
						),
					);
				}
			} else if (choice === openLog) {
				outputChannel?.show(true);
			}
		}),
		vscode.commands.registerCommand('safeappeals-rag.search', async () => {
			const host = ragCoreHost;
			if (!host) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t('Private Search is not initialized.'),
				);
				return;
			}
			const status = host.getStatus();
			if (!status.available) {
				void vscode.window.showWarningMessage(
					status.disableMessage ??
					vscode.l10n.t('Private Search is hard-disabled. See Show Status for details.'),
				);
				for (const line of formatStatusLines()) {
					outputChannel?.appendLine(line);
				}
				outputChannel?.show(true);
				return;
			}

			const query = await vscode.window.showInputBox({
				title: vscode.l10n.t('Private Search'),
				prompt: vscode.l10n.t('Enter a search query (dev / status search)'),
				ignoreFocusOut: true,
			});
			if (!query?.trim()) {
				return;
			}

			if (!ml?.withLease) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t(
						'Private Search requires the ML engine (embedding lease unavailable).',
					),
				);
				return;
			}

			const runSearch = () =>
				host.search(query.trim(), { finalK: 8, scope: 'all' });
			const result = await ml.withLease(
				'embedding',
				{ jobId: `search:${randomUUID()}` },
				async () => runSearch(),
			);
			if (!result.ok) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t('Search failed: {0}', result.error ?? 'unknown error'),
				);
				return;
			}

			const lines = [
				`Search: ${query.trim()}`,
				`Hits: ${result.results.length}`,
				...result.results.map(
					(hit, i) =>
						`${i + 1}. [${hit.fusedScore.toFixed(4)}] ${hit.sourceUri ?? hit.docId}` +
						(hit.heading ? ` — ${hit.heading}` : '') +
						`\n   ${hit.text.slice(0, 200).replace(/\s+/g, ' ')}`,
				),
			];
			log(`Search returned ${result.results.length} hit(s).`);
			for (const line of lines) {
				outputChannel?.appendLine(line);
			}
			outputChannel?.show(true);
			void vscode.window.showInformationMessage(
				vscode.l10n.t(
					'Search returned {0} hit(s). See the Private Search output channel.',
					result.results.length,
				),
			);
		}),
		vscode.commands.registerCommand(SETUP_LOCAL_SEARCH_COMMAND, () => {
			try {
				LocalAiSetupPanel.show(context.extensionUri, mlBridge, log, {
					onSearchPackReady: async () => {
						await notifySearchPackReady(mlBridge, ragCoreHost, log);
					},
				});
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				log(`Set Up Private Search panel failed: ${message}`, 'warn');
				void vscode.window.showErrorMessage(
					vscode.l10n.t('Could not open Private Search Setup: {0}', message),
				);
			}
		}),
		vscode.commands.registerCommand(INSTALL_MISSING_MODELS_COMMAND, () =>
			runInstallMissingModels({
				ml: mlBridge,
				log,
				onReady: async () => {
					await notifySearchPackReady(mlBridge, ragCoreHost, log);
				},
			}),
		),
		vscode.commands.registerCommand(GET_SETUP_SCAN_COMMAND, () =>
			buildPrivateSearchSetupScan(mlBridge),
		),
		vscode.commands.registerCommand(SCAFFOLD_CORE_REFERENCES_COMMAND, () =>
			runScaffoldCoreReferencesCommand(),
		),
	);

	registerAgentTools(
		context,
		() => ragCoreHost,
		() => indexPipeline,
		ml?.withLease
			? <T>(fn: () => Promise<T>) =>
				ml.withLease('embedding', { jobId: `search-tool:${randomUUID()}` }, async () => fn())
			: undefined,
	);

	maybeShowHardDisableChannel();
	refreshStatusBar();
	// Fire-and-forget: do not block activate on toast dismissal or deferred warm/index.
	void showActivateToasts(0);

	log('Private Search activated.');
	refreshStatusBar();
}

export function deactivate(): void {
	if (indexIdleToastTimer) {
		clearTimeout(indexIdleToastTimer);
		indexIdleToastTimer = undefined;
	}
	LocalAiSetupPanel.current?.dispose();
	ragCoreHost?.closeWorkspace();
	ragCoreHost = undefined;
	indexPipeline = undefined;
	folderWatcher = undefined;
	ingestRouter = undefined;
	sealedStore = undefined;
	docParseBackend = undefined;
	mlBridge = undefined;
	statusBar = undefined;
	outputChannel = undefined;
	extensionContext = undefined;
	hardDisableChannelShown = false;
	awaitStartupIndexIdleToast = false;
	startupOkIndexed = 0;
	finishedIndexToastShown = false;
}

/** Test / future host access to the active router. */
export function getIngestRouter(): IngestRouter | undefined {
	return ingestRouter;
}

/** Test / future host access to the sealed Markdown store. */
export function getSealedMarkdownStore(): SealedMarkdownStore | undefined {
	return sealedStore;
}

/** Test / future host access to the DocParse backend. */
export function getDocParseBackend(): IDocParseBackend | undefined {
	return docParseBackend;
}

/** Test / future host access to rag-core. */
export function getRagCoreHost(): RagCoreHost | undefined {
	return ragCoreHost;
}

/** Test / future host access to the index pipeline. */
export function getIndexPipeline(): IndexPipeline | undefined {
	return indexPipeline;
}
