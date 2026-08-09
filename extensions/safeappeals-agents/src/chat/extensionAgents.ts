/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Read-only SafeAppeals tool ids for shipped extension agents.
 * Aligned with product `SUBAGENT_DEFAULT_ENABLED_TOOL_IDS` (read/search/RAG search +
 * timeline getters — not index, not edit).
 */
export const EXTENSION_AGENT_TOOLS = [
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

const EXTENSION_AGENT_TOOLS_YAML =
	`tools: [${EXTENSION_AGENT_TOOLS.map(t => `'${t}'`).join(', ')}]`;

/**
 * Generic read-only research / Private Search extension agent.
 */
export const RESEARCH_AGENT_MD = [
	'---',
	'name: research',
	'description: \'Read-only research helper. Use when looking up case files, searching folders, or running Private Search (RAG) over the workspace and core references. Does not edit or index.\'',
	'argument-hint: \'research question or what to find\'',
	EXTENSION_AGENT_TOOLS_YAML,
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
 * Generic case-summary extension agent (same read-only tool set as research).
 */
export const CASE_SUMMARY_AGENT_MD = [
	'---',
	'name: case-summary',
	'description: \'Draft a short overview of the current matter from AGENTS.md and key folders. Use for status briefs or orientation. Read-only — does not edit or index.\'',
	'argument-hint: \'optional focus (e.g. medical, deadlines)\'',
	EXTENSION_AGENT_TOOLS_YAML,
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

/**
 * Extension agent files provided by this extension.
 */
export const EXTENSION_AGENT_FILES = [
	{ fileName: 'research.agent.md', content: RESEARCH_AGENT_MD },
	{ fileName: 'case-summary.agent.md', content: CASE_SUMMARY_AGENT_MD },
] as const;