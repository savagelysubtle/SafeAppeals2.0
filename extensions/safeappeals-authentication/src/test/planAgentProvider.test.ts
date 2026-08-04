/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { buildAgentMarkdown } from '../chat/agentMd';
import {
	buildPlanAgentBody,
	buildPlanAgentConfig,
	PLAN_AGENT_TOOLS,
} from '../chat/planAgentProvider';

suite('Plan agent markdown builders', () => {
	test('generated markdown has Plan frontmatter, handoffs, and planning-only tools', () => {
		const config = buildPlanAgentConfig();
		const markdown = buildAgentMarkdown(config);

		assert.ok(markdown.includes('name: Plan'));
		assert.ok(markdown.includes('description: Researches and outlines multi-step plans'));
		assert.ok(markdown.includes('argument-hint: Outline the goal or problem to research'));
		assert.ok(markdown.includes('target: vscode'));
		assert.ok(markdown.includes('disable-model-invocation: true'));

		assert.ok(markdown.includes('agent: agent'));
		assert.ok(markdown.includes('label: Start Implementation'));
		assert.ok(markdown.includes('prompt: \'Start implementation\''));
		assert.ok(markdown.includes('send: true'));
		assert.ok(markdown.includes('label: Open in Editor'));
		assert.ok(markdown.includes('showContinueOn: false'));

		assert.ok(markdown.includes('vscode/askQuestions'));
		assert.ok(markdown.includes('reviewPlan'));
		assert.ok(markdown.includes('safeappeals_read'));
		assert.ok(markdown.includes('safeappeals_search'));
		assert.ok(markdown.includes('execute/getTerminalOutput'));
		assert.ok(markdown.includes('execute/testFailure'));

		assert.ok(!markdown.includes('vscode/memory'));
		assert.ok(!markdown.includes('safeappeals_edit'));
		assert.ok(!/\bagents:\s*\[/.test(markdown));
		assert.ok(!markdown.includes('Explore'));

		const body = buildPlanAgentBody();
		assert.ok(body.includes('SOLE responsibility is planning'));
		assert.ok(body.includes('NEVER edit'));
		assert.ok(body.includes('Start Implementation'));
		assert.ok(body.includes('## 1. Discovery'));
		assert.ok(body.includes('#tool:vscode/askQuestions'));
		assert.ok(body.includes('#tool:reviewPlan'));
		assert.ok(
			body.includes('#tool:textSearch') || body.includes('#tool:codebase'),
			'Discovery should reference concrete search tools',
		);
		assert.ok(
			body.includes('in parallel') || body.includes('parallel'),
			'Discovery should guide parallel independent searches',
		);
		assert.ok(!body.includes('vscode/memory'));
		assert.ok(!body.includes('Explore'));
		assert.ok(!body.includes('searchSubagent'));
		assert.ok(!body.includes('/memories/'));
	});

	test('optional defaultModel is included in frontmatter', () => {
		const markdown = buildAgentMarkdown(
			buildPlanAgentConfig({ defaultModel: 'safeappeals-cloud/gpt-test' }),
		);
		assert.ok(markdown.includes('model: safeappeals-cloud/gpt-test'));
	});

	test('PLAN_AGENT_TOOLS matches the planning-only allowlist', () => {
		assert.deepStrictEqual([...PLAN_AGENT_TOOLS].sort(), [
			'execute/getTerminalOutput',
			'execute/testFailure',
			'read',
			'reviewPlan',
			'safeappeals_read',
			'safeappeals_search',
			'search',
			'vscode/askQuestions',
			'web',
		].sort());

		assert.ok(!PLAN_AGENT_TOOLS.includes('vscode/memory'));
		assert.ok(!PLAN_AGENT_TOOLS.some(t => t.toLowerCase().includes('explore')));
		assert.ok(!PLAN_AGENT_TOOLS.some(t => t.includes('edit') || t.includes('github')));
	});
});
