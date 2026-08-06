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
		assert.ok(markdown.includes('.safeAppeals/plans'));
		assert.ok(!markdown.includes('#createFile'));
		assert.ok(!markdown.includes('untitled:'));

		assert.ok(markdown.includes('vscode/askQuestions'));
		assert.ok(markdown.includes('createPlan'));
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
		assert.ok(body.includes('NEVER edit') || body.includes('Never use edit'));
		assert.ok(body.includes('Start Implementation'));
		assert.ok(body.includes('## 1. Discovery'));
		assert.ok(body.includes('## 3. CreatePlan') || body.includes('CreatePlan'));
		assert.ok(body.includes('#tool:vscode/askQuestions'));
		assert.ok(body.includes('#tool:createPlan'));
		assert.ok(body.includes('safeappeals_createPlan'));
		assert.ok(body.includes('#tool:reviewPlan'));
		assert.ok(
			body.includes('`content`') && body.includes('`plan`'),
			'reviewPlan instructions should name content vs plan URI fields separately',
		);
		assert.ok(!body.includes('`plan` set to the file URI from CreatePlan **and** the markdown'));
		assert.ok(body.includes('.safeAppeals/plans'));
		assert.ok(
			body.includes('#tool:textSearch') || body.includes('#tool:codebase'),
			'Discovery should reference concrete search tools',
		);
		assert.ok(
			body.includes('in parallel') || body.includes('parallel'),
			'Discovery should guide parallel independent searches',
		);
		assert.ok(body.includes('never push'));
		assert.ok(body.includes('confidential documents would leave this computer'));
		assert.ok(body.includes('camelCase') || body.includes('underscores'));
		assert.ok(body.includes('subgraph id [Label]'));
		assert.ok(body.includes('classDef') || body.includes('No explicit colors'));
		assert.ok(body.includes('one approach') || body.includes('one concrete approach'));
		assert.ok(!body.includes('presented in-chat for review'));
		assert.ok(!body.includes('Never save the plan to a memory file'));
		assert.ok(!body.includes('never save as a memory file'));
		assert.ok(!body.includes('vscode/memory'));
		assert.ok(!body.includes('Explore'));
		assert.ok(!body.includes('searchSubagent'));
		assert.ok(!body.includes('/memories/'));
		assert.ok(!body.includes('Copilot'));
	});

	test('optional defaultModel is included in frontmatter', () => {
		const markdown = buildAgentMarkdown(
			buildPlanAgentConfig({ defaultModel: 'safeappeals-cloud/gpt-test' }),
		);
		assert.ok(markdown.includes('model: safeappeals-cloud/gpt-test'));
	});

	test('PLAN_AGENT_TOOLS matches the planning-only allowlist', () => {
		assert.deepStrictEqual([...PLAN_AGENT_TOOLS].sort(), [
			'createPlan',
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
