/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Product path for user-global SafeAppeals agents (tilde form).
 * Matches `SAFE_APPEALS_USER_AGENTS_SOURCE_FOLDER` / `chat.agentFilesLocations`.
 */
export const SAFE_APPEALS_USER_AGENTS_SOURCE_FOLDER = '~/.safeAppeals/agents';

/**
 * Read-only SafeAppeals tool ids for shipped global starter agents.
 * Aligned with product `SUBAGENT_DEFAULT_ENABLED_TOOL_IDS` (read/search/RAG search +
 * timeline getters — not index, not edit).
 */
export const GLOBAL_STARTER_AGENT_TOOLS = [
	'safeappeals_readFile',
	'safeappeals_listDir',
	'safeappeals_findFiles',
	'safeappeals_findTextInFiles',
	'safeappeals_searchWorkspaceSymbols',
	'safeappeals_getErrors',
	'safeappeals_getChangedFiles',
	'safeappeals_searchCodebase',
	'safeappeals_rag_get_stats',
	'safeappeals_rag_search_reference',
	'safeappeals_rag_search_workspace',
	'safeappeals_rag_search_all',
	'timeline_get_events',
	'timeline_get_deadlines',
] as const;

const GLOBAL_STARTER_AGENT_TOOLS_YAML =
	`tools: [${GLOBAL_STARTER_AGENT_TOOLS.map(t => `'${t}'`).join(', ')}]`;

/** Filename of the global research starter agent. */
export const GLOBAL_RESEARCH_AGENT_FILENAME = 'research.agent.md';

/** Filename of the global case-summary starter agent. */
export const GLOBAL_CASE_SUMMARY_AGENT_FILENAME = 'case-summary.agent.md';

/**
 * Generic read-only research / Private Search starter agent.
 * Installed under `~/.safeAppeals/agents/` — not case-specific fiction.
 */
export const GLOBAL_RESEARCH_AGENT_MD = [
	'---',
	'name: research',
	'description: \'Read-only research helper. Use when looking up case files, searching folders, or running Private Search (RAG) over the workspace and core references. Does not edit or index.\'',
	'argument-hint: \'research question or what to find\'',
	GLOBAL_STARTER_AGENT_TOOLS_YAML,
	'user-invocable: true',
	'---',
	'',
	'# Research',
	'',
	'You are a read-only research subagent. Stay inside the current workspace.',
	'',
	'1. Start from the root `AGENTS.md` case brief when context is unclear.',
	'2. Prefer `safeappeals_findFiles` / `safeappeals_findTextInFiles` /',
	'   `safeappeals_listDir` / `safeappeals_readFile` for folder exploration.',
	'3. Prefer Private Search tools (`safeappeals_rag_search_*`) when looking for',
	'   citeable passages in case files or `core_references/`.',
	'4. Use timeline getters only to orient deadlines/events — do not mutate.',
	'5. Never invent facts. Quote or paraphrase only what you find.',
	'',
	'Do **not** edit files, create files, or index documents into Private Search.',
	'',
].join('\n');

/**
 * Generic case-summary starter agent (same read-only tool set as research).
 */
export const GLOBAL_CASE_SUMMARY_AGENT_MD = [
	'---',
	'name: case-summary',
	'description: \'Draft a short overview of the current matter from AGENTS.md and key folders. Use for status briefs or orientation. Read-only — does not edit or index.\'',
	'argument-hint: \'optional focus (e.g. medical, deadlines)\'',
	GLOBAL_STARTER_AGENT_TOOLS_YAML,
	'user-invocable: true',
	'---',
	'',
	'# Case summary',
	'',
	'You are a read-only case-summary helper.',
	'',
	'1. Read the root `AGENTS.md` case brief.',
	'2. Skim key matter folders (for example `medical_reports/`, `correspondence/`,',
	'   `decisions_and_orders/`, `personal_notes/`) with list/find/read tools —',
	'   do not invent facts.',
	'3. Optionally use Private Search (`safeappeals_rag_search_*`) if folders are',
	'   large or you need citation-backed passages.',
	'4. Return a short summary in Chat (parties, claim number, status, open items).',
	'',
	'Do **not** write files or run indexing tools.',
	'',
].join('\n');

/** Starter agent files installed into the user-global agents directory. */
export const GLOBAL_STARTER_AGENT_FILES = [
	{ fileName: GLOBAL_RESEARCH_AGENT_FILENAME, content: GLOBAL_RESEARCH_AGENT_MD },
	{ fileName: GLOBAL_CASE_SUMMARY_AGENT_FILENAME, content: GLOBAL_CASE_SUMMARY_AGENT_MD },
] as const;

/**
 * Resolves `~/.safeAppeals/agents` against a home directory.
 * Uses the same home expansion as prompt locations — does not hardcode
 * product data-folder names such as `code-oss-dev`.
 */
export function resolveGlobalAgentsDirectory(homeDir: string = os.homedir()): string {
	return path.join(homeDir, '.safeAppeals', 'agents');
}

export interface EnsureGlobalStarterAgentsResult {
	readonly directory: string;
	readonly written: readonly string[];
	readonly skipped: readonly string[];
}

export interface EnsureGlobalStarterAgentsOptions {
	readonly homeDir?: string;
	readonly mkdir?: (dir: string, options: { recursive: true; mode?: number }) => Promise<void>;
	readonly access?: (filePath: string) => Promise<void>;
	readonly writeFile?: (
		filePath: string,
		content: string,
		options: { encoding: 'utf8'; mode?: number },
	) => Promise<void>;
}

/**
 * Idempotently installs starter agents into `~/.safeAppeals/agents`.
 * Creates the directory when missing. Writes each file only when absent.
 * Never overwrites an existing user-edited agent of the same name.
 */
export async function ensureGlobalStarterAgents(
	options: EnsureGlobalStarterAgentsOptions = {},
): Promise<EnsureGlobalStarterAgentsResult> {
	const homeDir = options.homeDir ?? os.homedir();
	const directory = resolveGlobalAgentsDirectory(homeDir);
	const mkdir = options.mkdir
		?? (async (dir, opts) => {
			await fs.mkdir(dir, opts);
		});
	const access = options.access
		?? (async (filePath) => {
			await fs.access(filePath);
		});
	const writeFile = options.writeFile
		?? (async (filePath, content, opts) => {
			await fs.writeFile(filePath, content, opts);
		});

	await mkdir(directory, { recursive: true, mode: 0o700 });

	const written: string[] = [];
	const skipped: string[] = [];

	for (const file of GLOBAL_STARTER_AGENT_FILES) {
		const filePath = path.join(directory, file.fileName);
		try {
			await access(filePath);
			skipped.push(file.fileName);
		} catch {
			await writeFile(filePath, file.content, { encoding: 'utf8', mode: 0o600 });
			written.push(file.fileName);
		}
	}

	return { directory, written, skipped };
}
