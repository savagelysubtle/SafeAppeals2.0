/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
	GLOBAL_CASE_SUMMARY_AGENT_FILENAME,
	GLOBAL_CASE_SUMMARY_AGENT_MD,
	GLOBAL_RESEARCH_AGENT_FILENAME,
	GLOBAL_RESEARCH_AGENT_MD,
	GLOBAL_STARTER_AGENT_FILES,
	GLOBAL_STARTER_AGENT_TOOLS,
	SAFE_APPEALS_USER_AGENTS_SOURCE_FOLDER,
	ensureGlobalStarterAgents,
	resolveGlobalAgentsDirectory,
} from '../chat/globalStarterAgents';

/**
 * Hardcoded pin of `SUBAGENT_DEFAULT_ENABLED_TOOL_IDS` (runSubagentTool.ts).
 * Do not derive from `GLOBAL_STARTER_AGENT_TOOLS` — drift must fail this test.
 */
const EXPECTED_SUBAGENT_SEED_TOOL_IDS = [
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

/** Parses the `tools:` YAML array from starter `.agent.md` frontmatter. */
function parseAgentToolsFrontmatter(agentMd: string): string[] {
	const match = agentMd.match(/^tools:\s*\[([^\]]*)\]/m);
	assert.ok(match, 'agent frontmatter must include a tools: […] line');
	return [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

suite('globalStarterAgents', () => {
	test('product path and tool seed stay pinned', () => {
		assert.deepStrictEqual({
			userAgentsFolder: SAFE_APPEALS_USER_AGENTS_SOURCE_FOLDER,
			resolvedFromHome: resolveGlobalAgentsDirectory('/home/user'),
			fileNames: GLOBAL_STARTER_AGENT_FILES.map(f => f.fileName),
			toolCount: GLOBAL_STARTER_AGENT_TOOLS.length,
			exportedTools: [...GLOBAL_STARTER_AGENT_TOOLS],
			researchTools: parseAgentToolsFrontmatter(GLOBAL_RESEARCH_AGENT_MD),
			caseSummaryTools: parseAgentToolsFrontmatter(GLOBAL_CASE_SUMMARY_AGENT_MD),
			researchOmitsDisableModelInvocation: !GLOBAL_RESEARCH_AGENT_MD.includes('disable-model-invocation: true'),
			caseSummaryOmitsDisableModelInvocation: !GLOBAL_CASE_SUMMARY_AGENT_MD.includes('disable-model-invocation: true'),
			researchOmitsIndex: !GLOBAL_RESEARCH_AGENT_MD.includes('safeappeals_rag_index_document'),
			researchOmitsEdit: !GLOBAL_RESEARCH_AGENT_MD.includes('safeappeals_editFile'),
			caseSummaryOmitsIndex: !GLOBAL_CASE_SUMMARY_AGENT_MD.includes('safeappeals_rag_index_document'),
			researchIsGeneric: !GLOBAL_RESEARCH_AGENT_MD.includes('SAMPLE PRACTICE DATA ONLY'),
			caseSummaryIsGeneric: !GLOBAL_CASE_SUMMARY_AGENT_MD.includes('SAMPLE PRACTICE DATA ONLY'),
		}, {
			userAgentsFolder: '~/.safeAppeals/agents',
			resolvedFromHome: path.join('/home/user', '.safeAppeals', 'agents'),
			fileNames: [GLOBAL_RESEARCH_AGENT_FILENAME, GLOBAL_CASE_SUMMARY_AGENT_FILENAME],
			toolCount: 14,
			exportedTools: [...EXPECTED_SUBAGENT_SEED_TOOL_IDS],
			researchTools: [...EXPECTED_SUBAGENT_SEED_TOOL_IDS],
			caseSummaryTools: [...EXPECTED_SUBAGENT_SEED_TOOL_IDS],
			researchOmitsDisableModelInvocation: true,
			caseSummaryOmitsDisableModelInvocation: true,
			researchOmitsIndex: true,
			researchOmitsEdit: true,
			caseSummaryOmitsIndex: true,
			researchIsGeneric: true,
			caseSummaryIsGeneric: true,
		});
	});

	test('ensureGlobalStarterAgents writes missing files and skips existing ones', async () => {
		const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-global-agents-'));
		try {
			const first = await ensureGlobalStarterAgents({ homeDir });
			const agentsDir = resolveGlobalAgentsDirectory(homeDir);
			const researchPath = path.join(agentsDir, GLOBAL_RESEARCH_AGENT_FILENAME);
			const caseSummaryPath = path.join(agentsDir, GLOBAL_CASE_SUMMARY_AGENT_FILENAME);

			const customMarker = '# USER EDIT — do not overwrite\n';
			await fs.writeFile(researchPath, customMarker, 'utf8');

			const second = await ensureGlobalStarterAgents({ homeDir });

			const researchAfter = await fs.readFile(researchPath, 'utf8');
			const caseSummaryAfter = await fs.readFile(caseSummaryPath, 'utf8');

			assert.deepStrictEqual({
				firstDirectory: first.directory,
				firstWritten: [...first.written].sort(),
				firstSkipped: [...first.skipped],
				secondWritten: [...second.written],
				secondSkipped: [...second.skipped].sort(),
				researchPreserved: researchAfter,
				caseSummaryUnchanged: caseSummaryAfter === GLOBAL_CASE_SUMMARY_AGENT_MD,
			}, {
				firstDirectory: agentsDir,
				firstWritten: [GLOBAL_CASE_SUMMARY_AGENT_FILENAME, GLOBAL_RESEARCH_AGENT_FILENAME].sort(),
				firstSkipped: [],
				secondWritten: [],
				secondSkipped: [GLOBAL_CASE_SUMMARY_AGENT_FILENAME, GLOBAL_RESEARCH_AGENT_FILENAME].sort(),
				researchPreserved: customMarker,
				caseSummaryUnchanged: true,
			});
		} finally {
			await fs.rm(homeDir, { recursive: true, force: true });
		}
	});
});
