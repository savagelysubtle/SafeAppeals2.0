/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { scaffoldStandardFolders } from './scaffold';

/** Folder name under extension global storage where the sample matter is materialized. */
const SAMPLE_CASE_DIR = 'sample-case';

/** Shared reference materials folder at workspace root (mirrors safeappeals-rag). */
const CORE_REFERENCES_FOLDER = 'core_references';

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

/** Filename for the bundled sample multi-root workspace file. */
export const SAMPLE_CODE_WORKSPACE_FILENAME = 'sample_case.code-workspace';

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
	'SAMPLE-0000-NOT-REAL. Use the sample folders (medical_reports, correspondence,',
	'decisions_and_orders, personal_notes) to explore layout only — do not treat',
	'any file here as authority for a real filing.',
	'',
	'## Notes for the agent',
	'',
	'This workspace is a legal practice matter. **Never push** to GitHub or any git',
	'remote. Commit locally only when the user wants history. If they ask to push,',
	'warn that confidential documents would leave this computer and proceed only',
	'after explicit confirmation. (Pure coding/software projects that are not client',
	'matters may push after one confirmation when the user asks.)',
	'',
	'## Reference materials',
	'',
	`Put statutes, policy manuals, and other shared reference documents in the \`${CORE_REFERENCES_FOLDER}/\` folder. Private Search can index them for citation-backed lookup. Keep case-specific working files (medical records, correspondence) in your case folders instead.`,
	'',
].join('\n');

/**
 * Explains what belongs in `core_references/` vs case-specific files.
 * Mirrors safeappeals-rag `CORE_REFERENCES_README_TEMPLATE` (no cross-extension import).
 */
export const SAMPLE_CORE_REFERENCES_README = [
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
	'Those are case-specific files that belong elsewhere in the workspace — Private Search indexes them under the `case_index` search scope (not a folder named `case_index`).',
	'',
	'For workspace rules about this case or project, edit the `AGENTS.md` file at the workspace root.',
	'',
].join('\n');

export const SAMPLE_README = [
	'# SAMPLE CASE — NOT A REAL MATTER',
	'',
	'This folder is bundled practice data for learning Safe Appeals.',
	'',
	'- Every name, claim number, and document is **fictional**.',
	'- Nothing here is a real client file.',
	'- Opening or browsing this case spends **no credits** and does not call the AI.',
	'- The `core_references/` folder holds shared statutes and policy excerpts (sample content only); case-specific files stay in the other folders.',
	'',
	'## Local git backups (optional)',
	'',
	'You can turn this folder into a local git repository and commit your matter',
	'documents so you have a history of changes on your machine. A `.gitignore`',
	'file is included so everyday OS/editor junk and Safe Appeals organizer logs',
	'stay out of that history. Case document folders, `.safeAppeals/skills/`, and',
	'`.safeAppeals/agents/` are **not** ignored.',
	'',
	'Safe Appeals does not run `git init` for you — start a repo only if you want to.',
	'',
	'**Warning:** do **not** push this folder (or real client matters) to GitHub or',
	'any remote unless you trust that provider\'s privacy policy for confidential',
	'case data. Otherwise use Git locally and never push.',
	'',
	'## Workspace settings (`.safeAppeals/`)',
	'',
	'Folder settings live in `.safeAppeals/settings.json` (not `.vscode/`).',
	'This sample enables nested `AGENTS.md` briefs (`chat.useNestedAgentsMdFiles`),',
	'discovers agent skills under `.safeAppeals/skills/`, and discovers custom',
	'agents under `.safeAppeals/agents/` and `~/.safeAppeals/agents/` (plus the',
	'usual default roots in `chat.agentSkillsLocations` and',
	'`chat.agentFilesLocations`).',
	'',
	'## Workspace file (`sample_case.code-workspace`)',
	'',
	'This small file opens the sample case as a **named workspace** with the same',
	'Chat settings as `.safeAppeals/settings.json`. Prefer **File → Open Workspace',
	'from File…** and choose `sample_case.code-workspace`, or use the Open Sample',
	'Case command (which opens that workspace file). Opening the bare folder still',
	'works; `.safeAppeals/settings.json` keeps the same Chat behavior.',
	'',
	'## Agent skills (optional)',
	'',
	'Skills are reusable workflows. This sample includes',
	'`.safeAppeals/skills/summarize-case/SKILL.md` and a short tutorial in',
	'`.safeAppeals/skills/README.md`. In Chat, type `/summarize-case` or ask in',
	'plain language. Built-in `/project-setup` and `/organize-files` ship with',
	'Safe Appeals; add more case skills under `.safeAppeals/skills/` the same way.',
	'',
	'## Custom agents (optional)',
	'',
	'Safe Appeals ships a few generic starter agents globally under',
	'`~/.safeAppeals/agents/` (available in every workspace). This case folder',
	'keeps `.safeAppeals/agents/README.md` as a short tutorial for matter-specific',
	'agents — it does **not** seed local `.agent.md` files. Create your own from',
	'**Agent Customizations → Agents**.',
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
	'Claim SAMPLE-0000-NOT-REAL is described here only so the decisions_and_orders',
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

const SAMPLE_POLICY_EXCERPT = [
	'# SAMPLE — Fictional Policy Excerpt',
	'',
	'**NOT REAL BOARD POLICY. Practice data only.**',
	'',
	'This placeholder pretends to be a short excerpt from a workers\' compensation',
	'policy manual so the `core_references/` folder has example content for Private',
	'Search demos. Do not cite it in any filing.',
	'',
	'> Sample rule (FICTIONAL): A worker who reports an injury within 24 hours of',
	'> the incident may be eligible for expedited claim intake review.',
	'',
].join('\n');

/** Relative path of the bundled practice workspace skill. */
export const SAMPLE_SKILL_RELATIVE_PATH = '.safeAppeals/skills/summarize-case/SKILL.md';

/**
 * Practice workspace skill for the sample case.
 * Lives under `.safeAppeals/skills/` — Safe Appeals branded workspace skill root.
 */
export const SAMPLE_SKILL_MD = [
	'---',
	'name: summarize-case',
	'description: \'Summarize this practice matter from AGENTS.md and key case folders. Sample skill for learning — fictional data only.\'',
	'---',
	'',
	'# Summarize this practice matter',
	'',
	'**SAMPLE PRACTICE DATA ONLY — fictional matter.**',
	'',
	'1. Read the root `AGENTS.md` case brief.',
	'2. Skim `medical_reports/`, `correspondence/`, `decisions_and_orders/`, and',
	'   `personal_notes/` — use only what is there; do not invent facts.',
	'3. Write a short summary in Chat, or save it under `personal_notes/` if the',
	'   user asks for a file.',
	'4. Remind the user that every name, claim number, and document here is',
	'   fictional SAMPLE practice data — not a real client matter.',
	'',
].join('\n');

/** Relative path of the agents tutorial README (folder + README only — no local starters). */
export const SAMPLE_AGENTS_README_RELATIVE_PATH = '.safeAppeals/agents/README.md';

/**
 * Short tutorial for local vs global SafeAppeals subagents.
 * Materializes the `.safeAppeals/agents/` folder without shipping starter `.agent.md` files.
 */
export const SAMPLE_AGENTS_README_MD = [
	'# Custom agents in this case',
	'',
	'Agents are specialized helpers defined as `*.agent.md` files. Safe Appeals',
	'looks in two places:',
	'',
	'- **Local (this matter):** `.safeAppeals/agents/*.agent.md` — shared with the',
	'  case folder (and with your team if you version-control the matter).',
	'- **Global (your machine):** `~/.safeAppeals/agents/*.agent.md` — private to',
	'  you and available across every workspace.',
	'',
	'Safe Appeals installs a couple of generic global starters under',
	'`~/.safeAppeals/agents` for everyone (for example research and case summary).',
	'This case folder is for **matter-specific** agents you create yourself.',
	'',
	'To add one: open **Agent Customizations → Agents**, choose Workspace or',
	'Global, and create a new agent. Or add a `*.agent.md` file in the matching',
	'folder by hand.',
	'',
].join('\n');

/** Relative path of the skills tutorial README (sits beside sample skills). */
export const SAMPLE_SKILLS_README_RELATIVE_PATH = '.safeAppeals/skills/README.md';

/**
 * Short tutorial for local vs personal agent skills.
 * Keeps existing sample skills (e.g. summarize-case) alongside this README.
 */
export const SAMPLE_SKILLS_README_MD = [
	'# Agent skills in this case',
	'',
	'Skills are reusable workflows the agent can follow. Each skill is a folder',
	'with a `SKILL.md` file.',
	'',
	'- **Local (this matter):** `.safeAppeals/skills/<name>/SKILL.md` — the product',
	'  default for case folders. This sample includes `summarize-case` here.',
	'- **Other discovery roots Safe Appeals also finds by default:**',
	'  - Workspace: `.agents/skills`, `.github/skills`, `.claude/skills`',
	'  - Your machine: `~/.agents/skills`, `~/.copilot/skills`, `~/.claude/skills`',
	'',
	'There is no `~/.safeAppeals/skills` path today — for matter work, prefer',
	'`.safeAppeals/skills/` in the case folder.',
	'',
	'To browse or create skills, open **Agent Customizations → Skills**. In Chat,',
	'type `/` plus the skill name (for example `/summarize-case`), or ask in',
	'plain language.',
	'',
].join('\n');

/** Bundled `.gitignore` for optional local git backups of matter documents. */
export const SAMPLE_GITIGNORE = [
	'# Safe Appeals organizer churn (not matter documents / skills)',
	'.safeAppeals/organization_log.json',
	'.safeAppeals/undo_plan.json',
	'to_sort/_originals/',
	'',
	'# OS & editor junk',
	'.DS_Store',
	'Thumbs.db',
	'desktop.ini',
	'~$*',
	'*.tmp',
	'*.temp',
	'',
	'# Optional — uncomment if you don\'t want timeline state in git',
	'# .safeAppeals/timeline.json',
	'',
].join('\n');

/**
 * Chat settings shared by `.safeAppeals/settings.json` and `sample_case.code-workspace`.
 * Includes default skill/agent roots plus SafeAppeals product paths so overriding
 * those objects does not wipe other discovery paths. Never writes `.vscode/`.
 */
export const SAMPLE_CASE_SETTINGS = {
	'chat.useNestedAgentsMdFiles': true,
	'chat.agentSkillsLocations': {
		'.agents/skills': true,
		'.github/skills': true,
		'.claude/skills': true,
		'~/.agents/skills': true,
		'~/.copilot/skills': true,
		'~/.claude/skills': true,
		'.safeAppeals/skills': true,
	},
	'chat.agentFilesLocations': {
		'.safeAppeals/agents': true,
		'~/.safeAppeals/agents': true,
		'.github/agents': true,
		'.claude/agents': true,
		'~/.copilot/agents': true,
		'~/.claude/agents': true,
	},
} as const;

/** Serialized folder settings written to `.safeAppeals/settings.json`. */
export const SAMPLE_SAFE_APPEALS_SETTINGS_JSON = JSON.stringify(SAMPLE_CASE_SETTINGS, null, '\t') + '\n';

/** Contents of `sample_case.code-workspace`. */
export const SAMPLE_CODE_WORKSPACE = JSON.stringify(
	{
		folders: [
			{ path: '.', name: 'Sample Case (Practice)' },
		],
		settings: SAMPLE_CASE_SETTINGS,
	},
	null,
	'\t',
) + '\n';

/**
 * Sample content files written by `openSampleCase` — path + body together so
 * materialization and tests share one source of truth.
 */
const SAMPLE_CONTENT_FILES = [
	{ relativePath: 'sample_readme.md', content: SAMPLE_README },
	{ relativePath: '.gitignore', content: SAMPLE_GITIGNORE },
	{ relativePath: SAMPLE_CODE_WORKSPACE_FILENAME, content: SAMPLE_CODE_WORKSPACE },
	{ relativePath: '.safeAppeals/settings.json', content: SAMPLE_SAFE_APPEALS_SETTINGS_JSON },
	{ relativePath: 'medical_reports/sample_physician_note.md', content: SAMPLE_MEDICAL_NOTE },
	{ relativePath: 'correspondence/sample_acknowledgement.md', content: SAMPLE_CORRESPONDENCE },
	{ relativePath: 'decisions_and_orders/sample_decision_summary.md', content: SAMPLE_DECISION },
	{ relativePath: 'personal_notes/sample_practice_notes.md', content: SAMPLE_NOTES },
	{ relativePath: 'core_references/sample_policy_excerpt.md', content: SAMPLE_POLICY_EXCERPT },
	{ relativePath: SAMPLE_SKILLS_README_RELATIVE_PATH, content: SAMPLE_SKILLS_README_MD },
	{ relativePath: SAMPLE_SKILL_RELATIVE_PATH, content: SAMPLE_SKILL_MD },
	{ relativePath: SAMPLE_AGENTS_README_RELATIVE_PATH, content: SAMPLE_AGENTS_README_MD },
] as const;

/** Relative paths for sample content files written by `openSampleCase`. */
export const SAMPLE_CONTENT_RELATIVE_PATHS = SAMPLE_CONTENT_FILES.map(f => f.relativePath);

/**
 * Legacy PascalCase / SAMPLE_* paths from earlier sample materializations.
 * Removed best-effort after writing the current snake_case layout.
 */
export const LEGACY_SAMPLE_PATHS = [
	'Medical_Reports',
	'Correspondence',
	'Decisions_and_Orders',
	'Evidence',
	'Personal_Notes',
	'tosort',
	'README_SAMPLE.md',
	'core_references/SAMPLE_policy_excerpt.md',
	// Prior unreleased sample skill locations and folder-settings root.
	'.agents',
	'.github/skills',
	'.vscode',
	// Starters moved to ~/.safeAppeals/agents — remove old case-local copies.
	'.safeAppeals/agents/research.agent.md',
	'.safeAppeals/agents/case-summary.agent.md',
] as const;

/**
 * Root URI under extension global storage for the materialized sample case.
 * Managed path — never written to a bare home-directory location.
 */
export function sampleCaseRootUri(context: vscode.ExtensionContext): vscode.Uri {
	return vscode.Uri.joinPath(context.globalStorageUri, SAMPLE_CASE_DIR);
}

/**
 * Convert a URI to a real `file://` URI via {@link vscode.Uri.fsPath} when the
 * scheme is not already `file`.
 *
 * Extension `globalStorageUri` may use `vscode-userdata:` while still mapping to
 * a real on-disk path. Writes should keep using the original storage URI (extension
 * FS API). Opening a folder/workspace must use `file://` — see {@link openSampleCase}.
 */
export function asFileUri(uri: vscode.Uri): vscode.Uri {
	return uri.scheme === 'file' ? uri : vscode.Uri.file(uri.fsPath);
}

/**
 * Internal workbench command that trusts only the SafeAppeals sample-case folder
 * (resolved under timeline globalStorage — no caller-supplied URI).
 * Trusting on open avoids Restricted Mode disabling other SA extensions
 * (`untrustedWorkspaces.supported: false`).
 */
export const TRUST_SAFE_APPEALS_SAMPLE_CASE_COMMAND_ID = '_workbench.trust.safeAppealsSampleCase';

/**
 * Silently trust the sample case folder before `vscode.openFolder`.
 * Workbench resolves the allowlisted path; parent-folder trust covers the nested
 * `sample_case.code-workspace` URI.
 */
export async function trustSampleCaseFolder(): Promise<void> {
	try {
		await vscode.commands.executeCommand(TRUST_SAFE_APPEALS_SAMPLE_CASE_COMMAND_ID);
	} catch {
		// Host without the internal command (non-product builds) — leave untrusted;
		// user can still Manage Workspace Trust manually.
	}
}

/** Normalize for cross-scheme / trailing-slash fsPath equality checks. */
function normalizeFsPath(p: string): string {
	return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function sameFsPath(a: string, b: string): boolean {
	return normalizeFsPath(a) === normalizeFsPath(b);
}

function agentsMdUri(root: vscode.Uri): vscode.Uri {
	return vscode.Uri.joinPath(root, 'AGENTS.md');
}

async function writeText(uri: vscode.Uri, text: string): Promise<void> {
	await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf8'));
}

/** Ensures parent directories exist for a nested relative path under `root`. */
async function ensureParentDirs(root: vscode.Uri, relativePath: string): Promise<void> {
	const parts = relativePath.split('/');
	if (parts.length <= 1) {
		return;
	}
	let current = root;
	for (const part of parts.slice(0, -1)) {
		current = vscode.Uri.joinPath(current, part);
		await vscode.workspace.fs.createDirectory(current);
	}
}

/**
 * Best-effort removal of prior PascalCase / SAMPLE_* sample materializations.
 * Missing paths are ignored.
 */
async function removeLegacySamplePaths(root: vscode.Uri): Promise<void> {
	for (const relative of LEGACY_SAMPLE_PATHS) {
		const uri = vscode.Uri.joinPath(root, ...relative.split('/'));
		try {
			await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
		} catch {
			// Path absent or already removed — ignore.
		}
	}
}

/** Result of {@link openSampleCase}: whether a folder open will reload/replace the window. */
export type OpenSampleCaseResult = {
	reloading: boolean;
};

/**
 * True when the open workspace is the sample case on a non-`file` scheme
 * (`vscode-userdata:`, etc.). Session restore can sticky-restore the sample that
 * way; other SA extensions stay DisabledByVirtualWorkspace until we reopen as
 * `file://`.
 *
 * Pure fsPath + scheme check — no I/O — so activate and tests share one gate.
 */
export function sampleCaseNeedsFileSchemeUpgrade(args: {
	sampleRootFsPath: string;
	sampleWorkspaceFsPath: string;
	workspaceFile: { fsPath: string; scheme: string } | undefined;
	folders: readonly { fsPath: string; scheme: string }[] | undefined;
}): boolean {
	const folders = args.folders;
	const sampleAlreadyOpen = folders?.some(f => {
		return sameFsPath(f.fsPath, args.sampleRootFsPath) || sameFsPath(f.fsPath, args.sampleWorkspaceFsPath);
	}) === true
		|| (args.workspaceFile !== undefined
			&& sameFsPath(args.workspaceFile.fsPath, args.sampleWorkspaceFsPath));

	if (!sampleAlreadyOpen) {
		return false;
	}

	return (
		(args.workspaceFile !== undefined
			&& sameFsPath(args.workspaceFile.fsPath, args.sampleWorkspaceFsPath)
			&& args.workspaceFile.scheme !== 'file')
		|| folders?.some(f => {
			const matches = sameFsPath(f.fsPath, args.sampleRootFsPath)
				|| sameFsPath(f.fsPath, args.sampleWorkspaceFsPath);
			return matches && f.scheme !== 'file';
		}) === true
	);
}

/**
 * At most one activate-time reopen prompt per extension-host session.
 * Never auto-runs closeFolder/openFolder — that tears down the restored window.
 */
let sampleCaseFileSchemeUpgradeOffered = false;

/** Test-only: clear the once-per-session reopen-offer guard. */
export function resetSampleCaseFileSchemeUpgradeForTests(): void {
	sampleCaseFileSchemeUpgradeOffered = false;
}

/**
 * On activate / session restore: if the sticky sample workspace is still on a
 * virtual scheme, show a non-modal info message once per session. The user must
 * click **Reopen Sample Case** to run {@link openSampleCase} (closeFolder →
 * file://). Does not auto-upgrade — activate must never tear down the window.
 */
export async function upgradeSampleCaseToFileSchemeIfNeeded(
	context: vscode.ExtensionContext,
): Promise<OpenSampleCaseResult | undefined> {
	if (sampleCaseFileSchemeUpgradeOffered) {
		return undefined;
	}

	const root = sampleCaseRootUri(context);
	const workspaceUri = vscode.Uri.joinPath(root, SAMPLE_CODE_WORKSPACE_FILENAME);
	const folders = vscode.workspace.workspaceFolders;
	const needsUpgrade = sampleCaseNeedsFileSchemeUpgrade({
		sampleRootFsPath: root.fsPath,
		sampleWorkspaceFsPath: workspaceUri.fsPath,
		workspaceFile: vscode.workspace.workspaceFile
			? {
				fsPath: vscode.workspace.workspaceFile.fsPath,
				scheme: vscode.workspace.workspaceFile.scheme,
			}
			: undefined,
		folders: folders?.map(f => ({ fsPath: f.uri.fsPath, scheme: f.uri.scheme })),
	});

	if (!needsUpgrade) {
		return undefined;
	}

	sampleCaseFileSchemeUpgradeOffered = true;
	const choice = await vscode.window.showInformationMessage(
		'This sample case was restored as a virtual workspace, so other Safe Appeals features stay disabled. Reopen it as a normal folder to enable them.',
		'Reopen Sample Case',
	);
	if (choice !== 'Reopen Sample Case') {
		return undefined;
	}
	return openSampleCase(context);
}

/**
 * Writes the bundled fake sample matter into extension global storage and opens it.
 *
 * Returns `{ reloading: true }` when `vscode.openFolder` was issued (empty window,
 * virtual→file upgrade, or new-window open). Callers such as Tutorials must leave
 * pending state alone so activate can resume after reload.
 */
export async function openSampleCase(context: vscode.ExtensionContext): Promise<OpenSampleCaseResult> {
	const root = sampleCaseRootUri(context);
	await vscode.workspace.fs.createDirectory(root);

	await writeText(agentsMdUri(root), SAMPLE_AGENTS_MD);
	await scaffoldStandardFolders(root, SAMPLE_CASE_IDENTITY.caseName);
	const coreReferencesDir = vscode.Uri.joinPath(root, CORE_REFERENCES_FOLDER);
	await vscode.workspace.fs.createDirectory(coreReferencesDir);
	await writeText(vscode.Uri.joinPath(coreReferencesDir, 'README.md'), SAMPLE_CORE_REFERENCES_README);
	for (const file of SAMPLE_CONTENT_FILES) {
		await ensureParentDirs(root, file.relativePath);
		const uri = vscode.Uri.joinPath(root, ...file.relativePath.split('/'));
		await writeText(uri, file.content);
	}

	await removeLegacySamplePaths(root);

	const workspaceUri = vscode.Uri.joinPath(root, SAMPLE_CODE_WORKSPACE_FILENAME);
	const folders = vscode.workspace.workspaceFolders;
	// Prefer fsPath equality over URI string equality so `file://` vs
	// `vscode-userdata:` (same disk path) still counts as already open.
	const sampleAlreadyOpen = folders?.some(f => {
		const folderPath = f.uri.fsPath;
		return sameFsPath(folderPath, root.fsPath) || sameFsPath(folderPath, workspaceUri.fsPath);
	}) === true
		|| (vscode.workspace.workspaceFile !== undefined
			&& sameFsPath(vscode.workspace.workspaceFile.fsPath, workspaceUri.fsPath));

	// A prior open via the raw globalStorage URI can leave the window on
	// `vscode-userdata:` (virtual). Same fsPath must not early-return — reopen
	// as `file://` so other SA extensions (virtualWorkspaces: false) can activate.
	const needsFileSchemeUpgrade = sampleCaseNeedsFileSchemeUpgrade({
		sampleRootFsPath: root.fsPath,
		sampleWorkspaceFsPath: workspaceUri.fsPath,
		workspaceFile: vscode.workspace.workspaceFile
			? {
				fsPath: vscode.workspace.workspaceFile.fsPath,
				scheme: vscode.workspace.workspaceFile.scheme,
			}
			: undefined,
		folders: folders?.map(f => ({ fsPath: f.uri.fsPath, scheme: f.uri.scheme })),
	});

	if (sampleAlreadyOpen && !needsFileSchemeUpgrade) {
		try {
			const doc = await vscode.workspace.openTextDocument(agentsMdUri(root));
			await vscode.window.showTextDocument(doc, { preview: false });
		} catch {
			// Brief may still be opening after a prior folder reload.
		}
		vscode.window.showInformationMessage(
			'Opened the sample case (fictional practice data only). No credits are used and the AI is not running.',
		);
		return { reloading: false };
	}

	// Empty window → reuse it (newcomer path). Virtual-scheme upgrade of the
	// sample already in this window also reuses. Any other open folder is the
	// user's work — open the sample in a new window so a live client matter is
	// never swapped away without warning.
	//
	// Open via file:// — not the raw globalStorage URI. Writes above still use
	// the original storage URI; only the openFolder target is converted.
	//
	// Trust the file:// sample root before openFolder so the reloaded window
	// is not Restricted Mode (startup trust prompt defaults to never here).
	//
	// Same-fsPath openFolder with only a scheme change (vscode-userdata → file)
	// is treated as a no-op by the workbench. Clear the workspace first so the
	// subsequent openFolder actually lands on file://.
	const fileWorkspaceUri = asFileUri(workspaceUri);
	await trustSampleCaseFolder();

	if (needsFileSchemeUpgrade) {
		await vscode.commands.executeCommand('workbench.action.closeFolder');
		await vscode.commands.executeCommand('vscode.openFolder', fileWorkspaceUri, {
			forceReuseWindow: true,
		});
		return { reloading: true };
	}

	const reuseWindow = !folders || folders.length === 0;
	await vscode.commands.executeCommand('vscode.openFolder', fileWorkspaceUri, {
		forceReuseWindow: reuseWindow,
		forceNewWindow: !reuseWindow,
	});
	return { reloading: true };
}
