/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { getProfile, pickJurisdiction } from './profile';
import { CASE_STATUSES, CaseInfo, UserProfile } from './types';

const BEGIN_MARKER = '<!-- safeappeals-case:begin — managed by Safe Appeals; edit via the "Safe Appeals Case: Edit Case Info" command -->';
const END_MARKER = '<!-- safeappeals-case:end -->';

/**
 * Standard case folders, each with its own nested AGENTS.md so the agent
 * knows the folder's purpose (surfaced via `chat.useNestedAgentsMdFiles`).
 */
const STANDARD_FOLDERS: ReadonlyArray<{ name: string; brief: string }> = [
	{
		name: 'Medical_Reports',
		brief: 'Medical evidence for this case: doctor reports, specialist assessments, independent medical examinations (IMEs), imaging results, and treatment records. When summarizing the case, weigh treating-physician reports and IMEs here. Never modify or delete originals; drafts and summaries belong in Personal_Notes.',
	},
	{
		name: 'Correspondence',
		brief: 'Letters and emails exchanged with the board, employer, and representatives. File saved emails and letters here. Preserve originals; when drafting replies, create new files rather than editing received correspondence.',
	},
	{
		name: 'Decisions_and_Orders',
		brief: 'Official decisions, orders, and rulings from the board or tribunal. These drive appeal deadlines — when a new decision lands here, check its date against the jurisdiction\'s statute of limitations in the case brief. Treat every file as read-only.',
	},
	{
		name: 'Evidence',
		brief: 'Supporting evidence that is not medical: witness statements, photos, pay records, job descriptions, expert reports, and research. Keep originals untouched.',
	},
	{
		name: 'Personal_Notes',
		brief: 'The user\'s own notes, drafts, and working documents. This is the right folder for agent-drafted documents, summaries, and analysis before they are finalized.',
	},
	{
		name: 'tosort',
		brief: 'Unsorted intake. Files land here before being filed. When asked to organize, classify each file into the standard case folders (Medical_Reports, Correspondence, Decisions_and_Orders, Evidence, Personal_Notes) based on content; move files, never delete them, and ask when the destination is ambiguous.',
	},
];

function renderFolderAgentsMd(folderName: string, brief: string, caseName: string): string {
	return [
		`# ${folderName.replace(/_/g, ' ')} — ${caseName}`,
		'',
		brief,
		'',
	].join('\n');
}

export function caseJsonUri(folder: vscode.WorkspaceFolder): vscode.Uri {
	return vscode.Uri.joinPath(folder.uri, '.safeAppeals', 'case.json');
}

export function agentsMdUri(folder: vscode.WorkspaceFolder): vscode.Uri {
	return vscode.Uri.joinPath(folder.uri, 'AGENTS.md');
}

export async function readCaseInfo(folder: vscode.WorkspaceFolder): Promise<CaseInfo | undefined> {
	try {
		const bytes = await vscode.workspace.fs.readFile(caseJsonUri(folder));
		return JSON.parse(Buffer.from(bytes).toString('utf8')) as CaseInfo;
	} catch {
		return undefined;
	}
}

function line(label: string, value: string): string {
	return `- **${label}:** ${value || '_not set_'}`;
}

function renderManagedBlock(info: CaseInfo, profile: UserProfile): string {
	const parts: string[] = [
		BEGIN_MARKER,
		'## Case information',
		'',
		line('Case name', info.caseName),
		line('Claim number', info.claimNumber),
		line('Case type / area of law', info.caseType),
		line('Jurisdiction', info.jurisdiction),
		line('Injury / incident date', info.injuryDate),
		line('Status', info.status),
		'',
		'## Client (our side)',
		'',
		line('Name', info.client.name),
		line('Contact', info.client.contact),
		'',
		'## Opposing side',
		'',
		line('Party', info.opposing.party),
		line('Representative', info.opposing.representative),
	];
	if (profile.name || profile.organization || profile.role) {
		parts.push(
			'',
			'## Representative working this case',
			'',
			line('Name', profile.name),
			line('Firm / organization', profile.organization),
			line('Role', profile.role),
			line('Practice area', profile.practiceArea),
		);
	}
	parts.push('', 'Structured copy of this data lives in `.safeAppeals/case.json`.', END_MARKER);
	return parts.join('\n');
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
 * Writes `.safeAppeals/case.json` and upserts the managed block in AGENTS.md.
 * Content outside the marker comments is never modified; when AGENTS.md has
 * no markers yet, the block is inserted (with a notes section on first
 * creation).
 */
export async function writeCaseFiles(folder: vscode.WorkspaceFolder, info: CaseInfo): Promise<void> {
	const profile = getProfile();

	await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder.uri, '.safeAppeals'));
	await vscode.workspace.fs.writeFile(caseJsonUri(folder), Buffer.from(JSON.stringify(info, null, '\t') + '\n', 'utf8'));

	const block = renderManagedBlock(info, profile);
	const uri = agentsMdUri(folder);
	const existing = await readTextIfExists(uri);

	let content: string;
	if (existing === undefined) {
		content = [
			`# ${info.caseName || folder.name} — Case Brief`,
			'',
			'This folder is a Safe Appeals case workspace. The block below is maintained',
			'by the "Safe Appeals Case: Edit Case Info" command; edit it there so the',
			'structured copy stays in sync.',
			'',
			block,
			'',
			'## Case notes for the agent',
			'',
			'Add case-specific background, guidance, and preferences here — Safe Appeals',
			'never touches anything outside the managed block above.',
			'',
		].join('\n');
	} else {
		const begin = existing.indexOf(BEGIN_MARKER);
		const end = existing.indexOf(END_MARKER);
		if (begin !== -1 && end !== -1 && end > begin) {
			content = existing.slice(0, begin) + block + existing.slice(end + END_MARKER.length);
		} else {
			const separator = existing.endsWith('\n') ? '\n' : '\n\n';
			content = existing + separator + block + '\n';
		}
	}
	await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
}

async function pickCaseFolder(): Promise<vscode.WorkspaceFolder | undefined> {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		vscode.window.showWarningMessage('Open a case folder first, then run this command again.');
		return undefined;
	}
	if (folders.length === 1) {
		return folders[0];
	}
	const picked = await vscode.window.showQuickPick(
		folders.map(f => ({ label: f.name, description: f.uri.fsPath, folder: f })),
		{ title: 'Which case folder?', ignoreFocusOut: true },
	);
	return picked?.folder;
}

function validateDate(value: string): string | undefined {
	if (!value) {
		return undefined;
	}
	return /^\d{4}-\d{2}-\d{2}$/.test(value) ? undefined : 'Use YYYY-MM-DD, or leave empty';
}

/**
 * Quick-input flow for case fields, prefilled from `existing` when editing.
 * Returns undefined when the user cancels.
 */
async function runCaseInfoFlow(folder: vscode.WorkspaceFolder, existing: CaseInfo | undefined): Promise<CaseInfo | undefined> {
	const profile = getProfile();

	const caseName = await vscode.window.showInputBox({
		title: 'Case Info (1/8) — Case Name',
		prompt: 'A short name for this case',
		value: existing?.caseName || folder.name,
		ignoreFocusOut: true,
	});
	if (caseName === undefined) {
		return undefined;
	}

	const claimNumber = await vscode.window.showInputBox({
		title: 'Case Info (2/8) — Claim / File Number',
		value: existing?.claimNumber ?? '',
		ignoreFocusOut: true,
	});
	if (claimNumber === undefined) {
		return undefined;
	}

	const clientName = await vscode.window.showInputBox({
		title: 'Case Info (3/8) — Client Name',
		prompt: 'The worker / claimant this case is for',
		value: existing?.client.name ?? '',
		ignoreFocusOut: true,
	});
	if (clientName === undefined) {
		return undefined;
	}

	const clientContact = await vscode.window.showInputBox({
		title: 'Case Info (4/8) — Client Contact',
		prompt: 'Email or phone (optional)',
		value: existing?.client.contact ?? '',
		ignoreFocusOut: true,
	});
	if (clientContact === undefined) {
		return undefined;
	}

	const opposingParty = await vscode.window.showInputBox({
		title: 'Case Info (5/8) — Opposing Party',
		prompt: 'e.g. employer name, WCB / board',
		value: existing?.opposing.party ?? '',
		ignoreFocusOut: true,
	});
	if (opposingParty === undefined) {
		return undefined;
	}

	const opposingRep = await vscode.window.showInputBox({
		title: 'Case Info (6/8) — Opposing Representative',
		prompt: 'Lawyer or case manager on the other side (optional)',
		value: existing?.opposing.representative ?? '',
		ignoreFocusOut: true,
	});
	if (opposingRep === undefined) {
		return undefined;
	}

	const jurisdiction = await pickJurisdiction(existing?.jurisdiction || profile.jurisdiction, 'Case Info (7/8) — Jurisdiction');
	if (jurisdiction === undefined) {
		return undefined;
	}

	const injuryDate = await vscode.window.showInputBox({
		title: 'Case Info (8/8) — Injury / Incident Date',
		prompt: 'YYYY-MM-DD, leave empty if unknown',
		value: existing?.injuryDate ?? '',
		validateInput: validateDate,
		ignoreFocusOut: true,
	});
	if (injuryDate === undefined) {
		return undefined;
	}

	let status = existing?.status ?? 'active';
	if (existing) {
		const picked = await vscode.window.showQuickPick(
			CASE_STATUSES.map(s => ({ label: s, picked: s === status })),
			{ title: 'Case Status', ignoreFocusOut: true },
		);
		if (!picked) {
			return undefined;
		}
		status = picked.label;
	}

	const now = new Date().toISOString();
	return {
		version: 1,
		caseName,
		claimNumber,
		caseType: existing?.caseType || profile.practiceArea || 'Workers\' Compensation',
		jurisdiction,
		injuryDate,
		status,
		client: { name: clientName, contact: clientContact },
		opposing: { party: opposingParty, representative: opposingRep },
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
	};
}

export async function initCase(): Promise<void> {
	const folder = await pickCaseFolder();
	if (!folder) {
		return;
	}

	const existing = await readCaseInfo(folder);
	if (existing) {
		const choice = await vscode.window.showInformationMessage(
			`${folder.name} is already a Safe Appeals case ("${existing.caseName}"). Edit its case info instead?`,
			'Edit Case Info',
		);
		if (choice === 'Edit Case Info') {
			await editCaseInfo();
		}
		return;
	}

	const info = await runCaseInfoFlow(folder, undefined);
	if (!info) {
		return;
	}

	const folderPicks = await vscode.window.showQuickPick(
		STANDARD_FOLDERS.map(f => ({ label: f.name, detail: f.brief.split('.')[0], picked: true })),
		{
			title: 'Create standard case folders? (each gets its own AGENTS.md so the agent knows its purpose)',
			canPickMany: true,
			ignoreFocusOut: true,
		},
	);

	await writeCaseFiles(folder, info);
	for (const pick of folderPicks ?? []) {
		const spec = STANDARD_FOLDERS.find(f => f.name === pick.label)!;
		const dirUri = vscode.Uri.joinPath(folder.uri, spec.name);
		await vscode.workspace.fs.createDirectory(dirUri);
		const nestedUri = vscode.Uri.joinPath(dirUri, 'AGENTS.md');
		if (await readTextIfExists(nestedUri) === undefined) {
			await vscode.workspace.fs.writeFile(nestedUri, Buffer.from(renderFolderAgentsMd(spec.name, spec.brief, info.caseName), 'utf8'));
		}
	}

	// Root AGENTS.md is read by default (chat.useAgentsMdFile), but the
	// per-folder briefs need the nested lookup, which is off by default —
	// enable it for this case workspace so folder briefs surface in chat.
	try {
		await vscode.workspace.getConfiguration('chat', folder.uri)
			.update('useNestedAgentsMdFiles', true, vscode.ConfigurationTarget.Workspace);
	} catch {
		// Non-fatal: root case brief still works without nested lookup.
	}

	const doc = await vscode.workspace.openTextDocument(agentsMdUri(folder));
	await vscode.window.showTextDocument(doc, { preview: false });
	vscode.window.showInformationMessage(`Case "${info.caseName}" initialized. The agent will pick up AGENTS.md automatically.`);
}

export async function editCaseInfo(): Promise<void> {
	const folder = await pickCaseFolder();
	if (!folder) {
		return;
	}

	const existing = await readCaseInfo(folder);
	if (!existing) {
		const choice = await vscode.window.showInformationMessage(
			`${folder.name} is not a Safe Appeals case yet. Initialize it?`,
			'Initialize Case Folder',
		);
		if (choice === 'Initialize Case Folder') {
			await initCase();
		}
		return;
	}

	const info = await runCaseInfoFlow(folder, existing);
	if (!info) {
		return;
	}
	await writeCaseFiles(folder, info);
	vscode.window.showInformationMessage(`Case info for "${info.caseName}" updated.`);
}

export async function openCaseBrief(): Promise<void> {
	const folder = await pickCaseFolder();
	if (!folder) {
		return;
	}
	try {
		const doc = await vscode.workspace.openTextDocument(agentsMdUri(folder));
		await vscode.window.showTextDocument(doc, { preview: false });
	} catch {
		const choice = await vscode.window.showInformationMessage(
			`${folder.name} has no case brief yet. Initialize it?`,
			'Initialize Case Folder',
		);
		if (choice === 'Initialize Case Folder') {
			await initCase();
		}
	}
}
