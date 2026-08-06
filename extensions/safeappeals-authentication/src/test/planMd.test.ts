/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	applyPlanStringReplace,
	parsePlanMarkdown,
	serializePlanMarkdown,
	type PlanFrontmatter,
} from '../chat/planMd';

suite('planMd', () => {
	const sampleFrontmatter: PlanFrontmatter = {
		name: 'Create Plan Helpers',
		overview: 'Path and markdown helpers for SafeAppeals CreatePlan.',
		todos: [
			{ id: 'paths', content: 'Implement planPaths helpers', status: 'pending' },
			{ id: 'md', content: 'Implement planMd serialize/parse', status: 'in_progress' },
			{ id: 'tests', content: 'Cover helpers with unit tests', status: 'completed' },
		],
		isProject: false,
	};

	test('serializePlanMarkdown emits Cursor-style YAML frontmatter and body', () => {
		const text = serializePlanMarkdown(sampleFrontmatter, '# Body\n\nDetails here.\n');
		assert.deepStrictEqual(
			{
				startsWithFence: text.startsWith('---\n'),
				hasName: text.includes('name: Create Plan Helpers\n'),
				hasOverview: text.includes('overview: "Path and markdown helpers for SafeAppeals CreatePlan."\n'),
				hasTodo: text.includes('  - id: paths\n    content: Implement planPaths helpers\n    status: pending\n'),
				hasInProgress: text.includes('status: in_progress\n'),
				hasIsProject: text.includes('isProject: false\n'),
				hasBody: text.includes('---\n\n# Body\n\nDetails here.\n'),
			},
			{
				startsWithFence: true,
				hasName: true,
				hasOverview: true,
				hasTodo: true,
				hasInProgress: true,
				hasIsProject: true,
				hasBody: true,
			},
		);
	});

	test('parsePlanMarkdown round-trips serialized frontmatter and body', () => {
		const body = '# Implementation\n\nDo the work.\n';
		const serialized = serializePlanMarkdown(sampleFrontmatter, body);
		const parsed = parsePlanMarkdown(serialized);
		assert.deepStrictEqual(parsed, {
			frontmatter: sampleFrontmatter,
			body,
		});
	});

	test('parsePlanMarkdown reads quoted overview and cancelled/completed statuses', () => {
		const text = [
			'---',
			'name: Sample',
			'overview: "One-line summary with: colon"',
			'todos:',
			'  - id: a',
			'    content: "Quoted content"',
			'    status: cancelled',
			'isProject: true',
			'---',
			'',
			'# Hello',
			'',
		].join('\n');

		assert.deepStrictEqual(parsePlanMarkdown(text), {
			frontmatter: {
				name: 'Sample',
				overview: 'One-line summary with: colon',
				todos: [{ id: 'a', content: 'Quoted content', status: 'cancelled' }],
				isProject: true,
			},
			body: '# Hello\n',
		});
	});

	test('applyPlanStringReplace replaces exactly one match', () => {
		const full = 'alpha\nbeta\ngamma\n';
		assert.strictEqual(applyPlanStringReplace(full, 'beta', 'BETA'), 'alpha\nBETA\ngamma\n');
	});

	test('applyPlanStringReplace throws on zero or ambiguous matches', () => {
		const full = 'one two one\n';
		assert.throws(
			() => applyPlanStringReplace(full, 'missing', 'x'),
			(error: unknown) => error instanceof Error && error.message.includes('not found'),
		);
		assert.throws(
			() => applyPlanStringReplace(full, 'one', 'x'),
			(error: unknown) => error instanceof Error && error.message.includes('more than once'),
		);
		assert.throws(
			() => applyPlanStringReplace(full, '', 'x'),
			(error: unknown) => error instanceof Error && error.message.includes('non-empty'),
		);
	});
});
