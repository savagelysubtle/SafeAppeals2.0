/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CORE_REFERENCES_FOLDER } from './types';

/** Command id contributed by safeappeals-rag. */
export const SCAFFOLD_CORE_REFERENCES_COMMAND = 'safeappeals-rag.scaffoldCoreReferences';

/**
 * Workspace-root AGENTS.md — rules guide for this case or project.
 * Written only when missing; never overwritten.
 */
export const ROOT_AGENTS_MD_TEMPLATE = [
	'# Workspace Agent Guide',
	'',
	'This file is where you tell the agent about **this case or project**.',
	'',
	'Think of it as your rules guide for this workspace: goals, parties, deadlines, tone, what to prioritize, and what not to do.',
	'',
	'You can fill it out yourself, or ask the agent to interview you and draft it here.',
	'',
	'---',
	'',
	'## Reference materials',
	'',
	`Put statutes, policy manuals, and other shared reference documents in the \`${CORE_REFERENCES_FOLDER}/\` folder. Private Search can index them for citation-backed lookup. Keep case-specific working files (medical records, correspondence) in your case folders instead.`,
	'',
].join('\n');

/**
 * Explains what belongs in `core_references/` vs case-specific files.
 * Written only when missing; never overwritten.
 */
export const CORE_REFERENCES_README_TEMPLATE = [
	'# Core References',
	'',
	'Use this folder for **shared reference materials** that Private Search can index for citation-backed lookup.',
	'',
	'## Put here',
	'',
	'- Statutes and regulations',
	'- Law books and published case law',
	'- Policy manuals and board rules',
	'- Other reference documents you cite across matters',
	'',
	'## Do not put here',
	'',
	'- This case\'s medical records',
	'- Correspondence and working drafts',
	'- Other case-specific files',
	'',
	'Those are case-specific files that belong with the case (case index), not in this reference library.',
	'',
	'For workspace rules about this case or project, edit the `AGENTS.md` file at the workspace root.',
	'',
].join('\n');

export interface ScaffoldCoreReferencesResult {
	readonly folderUri: vscode.Uri;
	readonly agentsMdUri: vscode.Uri;
	readonly readmeUri: vscode.Uri;
	readonly createdAgentsMd: boolean;
	readonly createdReadme: boolean;
}

async function readTextIfExists(uri: vscode.Uri): Promise<string | undefined> {
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		return Buffer.from(bytes).toString('utf8');
	} catch {
		return undefined;
	}
}

/**
 * Creates `core_references/` at the workspace root, a root `AGENTS.md` when
 * missing, and `core_references/README.md` when missing.
 */
export async function scaffoldCoreReferences(root: vscode.Uri): Promise<ScaffoldCoreReferencesResult> {
	const folderUri = vscode.Uri.joinPath(root, CORE_REFERENCES_FOLDER);
	const agentsMdUri = vscode.Uri.joinPath(root, 'AGENTS.md');
	const readmeUri = vscode.Uri.joinPath(folderUri, 'README.md');

	await vscode.workspace.fs.createDirectory(folderUri);

	let createdAgentsMd = false;
	if (await readTextIfExists(agentsMdUri) === undefined) {
		await vscode.workspace.fs.writeFile(agentsMdUri, Buffer.from(ROOT_AGENTS_MD_TEMPLATE, 'utf8'));
		createdAgentsMd = true;
	}

	let createdReadme = false;
	if (await readTextIfExists(readmeUri) === undefined) {
		await vscode.workspace.fs.writeFile(readmeUri, Buffer.from(CORE_REFERENCES_README_TEMPLATE, 'utf8'));
		createdReadme = true;
	}

	return { folderUri, agentsMdUri, readmeUri, createdAgentsMd, createdReadme };
}

async function pickWorkspaceRoot(): Promise<vscode.Uri | undefined> {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders?.length) {
		void vscode.window.showInformationMessage(
			vscode.l10n.t('Open a folder or workspace first, then create the core references folder.'),
		);
		return undefined;
	}
	if (folders.length === 1) {
		return folders[0].uri;
	}

	const picked = await vscode.window.showQuickPick(
		folders.map(folder => ({
			label: folder.name,
			description: folder.uri.fsPath,
			folder,
		})),
		{
			title: vscode.l10n.t('Create Core References Folder'),
			placeHolder: vscode.l10n.t('Select a workspace folder'),
			ignoreFocusOut: true,
		},
	);
	return picked?.folder.uri;
}

/**
 * Command handler: pick workspace root, scaffold idempotently, open root AGENTS.md.
 */
export async function runScaffoldCoreReferencesCommand(): Promise<void> {
	const root = await pickWorkspaceRoot();
	if (!root) {
		return;
	}

	const result = await scaffoldCoreReferences(root);

	try {
		const doc = await vscode.workspace.openTextDocument(result.agentsMdUri);
		await vscode.window.showTextDocument(doc, { preview: false });
	} catch {
		// Editor may be unavailable in some hosts; scaffold still succeeded.
	}

	if (result.createdAgentsMd || result.createdReadme) {
		void vscode.window.showInformationMessage(
			vscode.l10n.t(
				'Created {0}/ and workspace agent guide. Fill in AGENTS.md, or ask the agent to interview you.',
				CORE_REFERENCES_FOLDER,
			),
		);
	} else {
		void vscode.window.showInformationMessage(
			vscode.l10n.t(
				'{0}/ and AGENTS.md are already set up. Opened the workspace agent guide.',
				CORE_REFERENCES_FOLDER,
			),
		);
	}
}
