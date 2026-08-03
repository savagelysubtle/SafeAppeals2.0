/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { scaffoldStandardFolders } from './scaffold';

/** Folder name under extension global storage where the sample matter is materialized. */
const SAMPLE_CASE_DIR = 'sample-case';

/**
 * Safety-critical fake markers for the bundled sample matter. Exported so a
 * future extension test can pin them with one snapshot assertion — if these
 * strings are "cleaned up", practice data could look like a real client case.
 */
export const SAMPLE_CASE_IDENTITY = {
	caseName: '[SAMPLE — NOT A REAL CASE] Fictional Worker v. Demo Employer Co.',
	claimNumber: 'SAMPLE-0000-NOT-REAL',
	clientName: 'Alex Sampleton (FICTIONAL — practice data only)',
	opposingParty: 'Demo Employer Co. (FICTIONAL)',
	opposingRepresentative: 'Jordan Example, Esq. (FICTIONAL)',
} as const;

/**
 * Static sample case brief. Plain prose for the agent — no managed markers and
 * no twin `.safeAppeals/case.json`.
 */
export const SAMPLE_AGENTS_MD = [
	`# ${SAMPLE_CASE_IDENTITY.caseName}`,
	'',
	'**SAMPLE PRACTICE DATA ONLY — not a real client matter.**',
	'',
	'This folder is a Safe Appeals practice workspace. Edit this file freely;',
	'Safe Appeals does not manage or regenerate it.',
	'',
	'## Case snapshot',
	'',
	`- **Case name:** ${SAMPLE_CASE_IDENTITY.caseName}`,
	`- **Claim number:** ${SAMPLE_CASE_IDENTITY.claimNumber}`,
	'- **Case type / area of law:** Workers\' Compensation (practice data only)',
	'- **Jurisdiction:** BC WCB',
	'- **Injury / incident date:** 2024-06-15',
	'- **Status:** active (sample)',
	'',
	'## Client (our side)',
	'',
	`- **Name:** ${SAMPLE_CASE_IDENTITY.clientName}`,
	'- **Contact:** alex.sampleton@example.invalid',
	'',
	'## Opposing side',
	'',
	`- **Party:** ${SAMPLE_CASE_IDENTITY.opposingParty}`,
	`- **Representative:** ${SAMPLE_CASE_IDENTITY.opposingRepresentative}`,
	'',
	'## Case notes for the agent',
	'',
	'Alex Sampleton (FICTIONAL) reported a low-back strain after a staged warehouse',
	'demo scenario on 2024-06-15. Demo Employer Co. (FICTIONAL) acknowledged claim',
	'SAMPLE-0000-NOT-REAL. Use the sample folders (Medical_Reports, Correspondence,',
	'Decisions_and_Orders, Personal_Notes) to explore layout only — do not treat',
	'any file here as authority for a real filing.',
	'',
].join('\n');

const SAMPLE_README = [
	'# SAMPLE CASE — NOT A REAL MATTER',
	'',
	'This folder is bundled practice data for learning Safe Appeals.',
	'',
	'- Every name, claim number, and document is **fictional**.',
	'- Nothing here is a real client file.',
	'- Opening or browsing this case spends **no credits** and does not call the AI.',
	'',
	'When you are ready for real work, open your own case folder and ask Chat to',
	'help draft an `AGENTS.md` case brief.',
	'',
].join('\n');

const SAMPLE_MEDICAL_NOTE = [
	'# SAMPLE — Fictional Treating Physician Note',
	'',
	'**NOT A REAL MEDICAL RECORD. Practice data only.**',
	'',
	'- Patient: Alex Sampleton (FICTIONAL)',
	'- Date of visit: 2024-06-18',
	'- Complaint: reported low-back strain after a staged warehouse demo scenario',
	'- Plan: rest, follow-up in two weeks (fictional)',
	'',
	'Do not cite this note in any filing. It exists only so the sample case folder',
	'looks like a real matter layout.',
	'',
].join('\n');

const SAMPLE_CORRESPONDENCE = [
	'# SAMPLE — Fictional Acknowledgement Letter',
	'',
	'**NOT REAL CORRESPONDENCE. Practice data only.**',
	'',
	'Dear Alex Sampleton (FICTIONAL),',
	'',
	'This letter pretends to acknowledge claim SAMPLE-0000-NOT-REAL against',
	'Demo Employer Co. (FICTIONAL). No board, employer, or claimant is involved.',
	'',
	'Sincerely,',
	'Sample Board Clerk (FICTIONAL)',
	'',
].join('\n');

const SAMPLE_DECISION = [
	'# SAMPLE — Fictional Decision Summary',
	'',
	'**NOT A REAL DECISION OR ORDER. Practice data only.**',
	'',
	'Claim SAMPLE-0000-NOT-REAL is described here only so the Decisions_and_Orders',
	'folder has a realistic placeholder. No appeal rights attach to this file.',
	'',
].join('\n');

const SAMPLE_NOTES = [
	'# SAMPLE — Practice Notes',
	'',
	'Use this folder in a real case for drafts and working notes.',
	'In the sample matter it only holds this placeholder so the layout is complete.',
	'',
	'Reminder: the AI assistant is **not** running while you explore this sample.',
	'',
].join('\n');

/**
 * Root URI under extension global storage for the materialized sample case.
 * Managed path — never written to a bare home-directory location.
 */
export function sampleCaseRootUri(context: vscode.ExtensionContext): vscode.Uri {
	return vscode.Uri.joinPath(context.globalStorageUri, SAMPLE_CASE_DIR);
}

function agentsMdUri(root: vscode.Uri): vscode.Uri {
	return vscode.Uri.joinPath(root, 'AGENTS.md');
}

async function writeText(uri: vscode.Uri, text: string): Promise<void> {
	await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf8'));
}

/**
 * Writes the bundled fake sample matter into extension global storage and opens it.
 */
export async function openSampleCase(context: vscode.ExtensionContext): Promise<void> {
	const root = sampleCaseRootUri(context);
	await vscode.workspace.fs.createDirectory(root);

	await writeText(agentsMdUri(root), SAMPLE_AGENTS_MD);
	await scaffoldStandardFolders(root, SAMPLE_CASE_IDENTITY.caseName);
	await writeText(vscode.Uri.joinPath(root, 'README_SAMPLE.md'), SAMPLE_README);
	await writeText(vscode.Uri.joinPath(root, 'Medical_Reports', 'SAMPLE_physician_note.md'), SAMPLE_MEDICAL_NOTE);
	await writeText(vscode.Uri.joinPath(root, 'Correspondence', 'SAMPLE_acknowledgement.md'), SAMPLE_CORRESPONDENCE);
	await writeText(vscode.Uri.joinPath(root, 'Decisions_and_Orders', 'SAMPLE_decision_summary.md'), SAMPLE_DECISION);
	await writeText(vscode.Uri.joinPath(root, 'Personal_Notes', 'SAMPLE_practice_notes.md'), SAMPLE_NOTES);
	await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(root, '.vscode'));
	await writeText(
		vscode.Uri.joinPath(root, '.vscode', 'settings.json'),
		JSON.stringify({ 'chat.useNestedAgentsMdFiles': true }, null, '\t') + '\n',
	);

	const folders = vscode.workspace.workspaceFolders;
	const sampleAlreadyOpen = folders?.some(f => f.uri.toString() === root.toString()) === true;

	if (sampleAlreadyOpen) {
		try {
			const doc = await vscode.workspace.openTextDocument(agentsMdUri(root));
			await vscode.window.showTextDocument(doc, { preview: false });
		} catch {
			// Brief may still be opening after a prior folder reload.
		}
		vscode.window.showInformationMessage(
			'Opened the sample case (fictional practice data only). No credits are used and the AI is not running.',
		);
		return;
	}

	// Empty window → reuse it (newcomer path). Any other open folder is treated
	// as the user's work — open the sample in a new window so a live client
	// matter is never swapped away without warning.
	const reuseWindow = !folders || folders.length === 0;
	await vscode.commands.executeCommand('vscode.openFolder', root, {
		forceReuseWindow: reuseWindow,
		forceNewWindow: !reuseWindow,
	});
}
