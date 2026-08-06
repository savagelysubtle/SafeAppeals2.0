/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Standard case folders, each with its own nested AGENTS.md so the agent
 * knows the folder's purpose (surfaced via `chat.useNestedAgentsMdFiles`).
 */
export const STANDARD_FOLDERS: ReadonlyArray<{ name: string; brief: string }> = [
	{
		name: 'medical_reports',
		brief: 'Medical evidence for this case: doctor reports, specialist assessments, independent medical examinations (IMEs), imaging results, and treatment records. When summarizing the case, weigh treating-physician reports and IMEs here. Never modify or delete originals; drafts and summaries belong in personal_notes.',
	},
	{
		name: 'correspondence',
		brief: 'Letters and emails exchanged with the board, employer, and representatives. File saved emails and letters here. Preserve originals; when drafting replies, create new files rather than editing received correspondence.',
	},
	{
		name: 'decisions_and_orders',
		brief: 'Official decisions, orders, and rulings from the board or tribunal. These drive appeal deadlines — when a new decision lands here, check its date against the jurisdiction\'s statute of limitations in the case brief. Treat every file as read-only.',
	},
	{
		name: 'evidence',
		brief: 'Supporting evidence that is not medical: witness statements, photos, pay records, job descriptions, expert reports, and research. Keep originals untouched.',
	},
	{
		name: 'personal_notes',
		brief: 'The user\'s own notes, drafts, and working documents. This is the right folder for agent-drafted documents, summaries, and analysis before they are finalized.',
	},
	{
		name: 'to_sort',
		brief: 'Unsorted intake. Files land here before being filed. When asked to organize, classify each file into the standard case folders (medical_reports, correspondence, decisions_and_orders, evidence, personal_notes) based on content; move files, never delete them, and ask when the destination is ambiguous.',
	},
];

/** Title-cases snake_case folder names for nested AGENTS.md H1 display. */
export function titleCaseFolderLabel(folderName: string): string {
	return folderName
		.split('_')
		.map(word => word.length === 0 ? word : word[0].toUpperCase() + word.slice(1))
		.join(' ');
}

export function renderFolderAgentsMd(folderName: string, brief: string, caseName: string): string {
	return [
		`# ${titleCaseFolderLabel(folderName)} — ${caseName}`,
		'',
		brief,
		'',
	].join('\n');
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
 * Creates the standard case folders with nested AGENTS.md briefs when missing.
 */
export async function scaffoldStandardFolders(root: vscode.Uri, caseName: string): Promise<void> {
	for (const spec of STANDARD_FOLDERS) {
		const dirUri = vscode.Uri.joinPath(root, spec.name);
		await vscode.workspace.fs.createDirectory(dirUri);
		const nestedUri = vscode.Uri.joinPath(dirUri, 'AGENTS.md');
		if (await readTextIfExists(nestedUri) === undefined) {
			await vscode.workspace.fs.writeFile(nestedUri, Buffer.from(renderFolderAgentsMd(spec.name, spec.brief, caseName), 'utf8'));
		}
	}
}
