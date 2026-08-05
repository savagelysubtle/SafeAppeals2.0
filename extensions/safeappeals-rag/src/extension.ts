/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { createHash, randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { registerAgentTools } from './agentTools';
import {
	runScaffoldCoreReferencesCommand,
	SCAFFOLD_CORE_REFERENCES_COMMAND,
} from './coreReferencesScaffold';
import { NotReadyDocParseBackend, type IDocParseBackend } from './docParseBackend';
import { DocParseHost } from './docParseHost';
import { EmbeddingAdapter } from './embeddingAdapter';
import { FolderIndexWatcher } from './folderIndexWatcher';
import { IndexPipeline } from './indexPipeline';
import { IngestRouter } from './ingestRouter';
import { SETUP_LOCAL_SEARCH_COMMAND } from './localAiSetupCompletion';
import { LocalAiSetupPanel } from './localAiSetupPanel';
import { resolveMlBridge, type MlBridge } from './mlBridge';
import { getWorkspaceRootPaths } from './pathGuard';
import { RagCoreHost } from './ragCoreHost';
import { SealedMarkdownStore } from './sealedMarkdown';
import { UnlimitedOCRBackend } from './unlimitedOcrBackend';

/** Managed root segment when no workspace folder is open. */
export const NO_FOLDER_WORKSPACE_KEY = '_nofolder';

let outputChannel: vscode.OutputChannel | undefined;
let ingestRouter: IngestRouter | undefined;
let sealedStore: SealedMarkdownStore | undefined;
let docParseBackend: IDocParseBackend | undefined;
let mlBridge: MlBridge | undefined;
let ragCoreHost: RagCoreHost | undefined;
let indexPipeline: IndexPipeline | undefined;

function log(message: string): void {
	outputChannel?.appendLine(message);
}

/**
 * Background warm of the embedding adapter when Search pack / BYO dirs are ready.
 * Clears sticky models-missing via ensureRagCoreReady and retries deferred folder scans.
 */
async function warmEmbeddingAtStartup(
	ml: MlBridge | undefined,
	host: RagCoreHost | undefined,
	watcher: FolderIndexWatcher | undefined,
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

	watcher?.notifyModelsReady();
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
		'Digital PDF extract: stub (TODO pdfium / rag-core)',
		`rag-core native: ${hostStatus?.nativeVersion ?? 'unavailable'}`,
		`rag-core available: ${hostStatus?.available ? 'yes' : 'no'}`,
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
			`modelsPresent=${caps.modelsPresent} storageReady=${caps.storageReady} dims=${caps.dims}`,
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
	lines.push(
		'Honest gaps: Search pack downloadUrl/sha unpinned → models-missing until BYO; digital PDF stub; electron-146 missing; index is txt/md-only.',
	);
	return lines;
}

/**
 * Activate the RAG host shell: ingest + DocParse + rag-core host (M6) + Local AI setup.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
	outputChannel = vscode.window.createOutputChannel('Safe Appeals RAG');
	context.subscriptions.push(outputChannel);

	const workspaceId = workspaceIdForFolder(vscode.workspace.workspaceFolders?.[0]?.uri);
	const sealed = await SealedMarkdownStore.create(context, workspaceId, log);
	sealedStore = sealed.store;
	if (sealed.memoryOnly) {
		log(`Sealed Markdown store is memory-only (${sealed.dekReason ?? 'unknown'}).`);
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
					log(`DocParse sidecar crash: ${message}`);
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
			log(`DocParse host refused (fail closed): ${message}`);
			backend = new NotReadyDocParseBackend();
		}
		docParseBackend = backend;

		const withDocParseLease = <T>(fn: () => Promise<T>): Promise<T> =>
			ml.withLease('docparse', { jobId: `docparse:${randomUUID()}` }, async () => fn());

		ingestRouter = new IngestRouter({
			catalog: ml.catalog,
			probe: ml.probe,
			artifacts: ml.artifacts,
			docParse: backend,
			sealedStore: sealed.store,
			withDocParseLease,
			log,
		});
		log(
			ml.engine
				? 'Ingest router ready (DocParse via withLease(docparse); digital extract stub).'
				: 'Ingest router ready (MlResourceEngine missing — DocParse leases unavailable).',
		);
	} else {
		log('Ingest router unavailable: safeappeals-ml bridge missing.');
	}

	ragCoreHost = await RagCoreHost.create({
		context,
		workspaceId,
		getArtifactDir: modelId =>
			mlBridge?.artifactDir(modelId) ?? Promise.resolve(undefined),
		log,
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
					},
					log,
				}),
			);
			log('Registered EmbeddingAdapter on safeappeals-ml MlResourceEngine.');
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			log(`EmbeddingAdapter registration failed: ${message}`);
		}
	}

	// Re-evaluate model gates after openWorkspace (try_load_default / artifact sync).
	await ragCoreHost.refreshModelGates();

	let folderWatcher: FolderIndexWatcher | undefined;
	if (ingestRouter && ragCoreHost) {
		const withEmbeddingLease = ml
			? <T>(fn: () => Promise<T>): Promise<T> =>
				ml.withLease('embedding', { jobId: `embedding:${randomUUID()}` }, async () => fn())
			: undefined;

		indexPipeline = new IndexPipeline({
			ingest: ingestRouter,
			host: ragCoreHost,
			getWorkspaceRoots: () => getWorkspaceRootPaths(vscode.workspace.workspaceFolders),
			withEmbeddingLease,
			log,
		});
		folderWatcher = new FolderIndexWatcher({
			indexPipeline,
			log,
			isIndexingAllowed: () => {
				const gate = ragCoreHost!.assertIndexingAllowed();
				if (gate.ok) {
					return { ok: true };
				}
				return { ok: false, code: gate.code, message: gate.message };
			},
			removeDoc: docId => ragCoreHost!.removeDoc(docId),
		});
		folderWatcher.start();
		context.subscriptions.push(folderWatcher);
	}

	// Eagerly warm embedding (syncs embed + CE env via EmbeddingAdapter.load) without blocking activate long.
	void warmEmbeddingAtStartup(ml, ragCoreHost, folderWatcher, log);

	context.subscriptions.push(
		vscode.commands.registerCommand('safeappeals-rag.showStatus', async () => {
			if (docParseBackend instanceof UnlimitedOCRBackend) {
				await docParseBackend.refreshReady();
			}
			const lines = formatStatusLines();
			if (docParseBackend instanceof UnlimitedOCRBackend) {
				const ready = docParseBackend.isReady();
				const idx = lines.findIndex(l => l.startsWith('DocParse / Unlimited-OCR:'));
				if (idx >= 0) {
					lines[idx] = `DocParse / Unlimited-OCR: ${ready ? 'ready' : 'not ready'}`;
				}
			}
			const summary = lines.join('\n');
			outputChannel?.appendLine(summary);
			outputChannel?.show(true);
			void vscode.window.showInformationMessage(
				vscode.l10n.t('RAG status written to the Safe Appeals RAG output channel.'),
			);
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
				outputChannel?.appendLine(formatStatusLines().join('\n'));
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

			const result = host.search(query.trim(), { finalK: 8, scope: 'all' });
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
			outputChannel?.appendLine(lines.join('\n'));
			outputChannel?.show(true);
			void vscode.window.showInformationMessage(
				vscode.l10n.t(
					'Search returned {0} hit(s). See the Safe Appeals RAG output channel.',
					result.results.length,
				),
			);
		}),
		vscode.commands.registerCommand(SETUP_LOCAL_SEARCH_COMMAND, () => {
			LocalAiSetupPanel.show(context.extensionUri, mlBridge, log, {
				onSearchPackReady: async () => {
					await ragCoreHost?.refreshModelGates();
					folderWatcher?.notifyModelsReady();
				},
			});
		}),
		vscode.commands.registerCommand(SCAFFOLD_CORE_REFERENCES_COMMAND, () =>
			runScaffoldCoreReferencesCommand(),
		),
	);

	registerAgentTools(
		context,
		() => ragCoreHost,
		() => indexPipeline,
	);
}

export function deactivate(): void {
	LocalAiSetupPanel.current?.dispose();
	ragCoreHost?.closeWorkspace();
	ragCoreHost = undefined;
	indexPipeline = undefined;
	ingestRouter = undefined;
	sealedStore = undefined;
	docParseBackend = undefined;
	mlBridge = undefined;
	outputChannel = undefined;
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
