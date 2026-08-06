/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Todo status values persisted in plan frontmatter. */
export type PlanTodoStatus = 'pending' | 'completed' | 'in_progress' | 'cancelled';

/** Structured todo entry in a plan's YAML frontmatter. */
export interface PlanTodo {
	readonly id: string;
	readonly content: string;
	readonly status: PlanTodoStatus;
}

/** Cursor-style plan frontmatter fields. */
export interface PlanFrontmatter {
	readonly name: string;
	readonly overview: string;
	readonly todos: readonly PlanTodo[];
	readonly isProject: boolean;
}

const PLAN_TODO_STATUSES = new Set<PlanTodoStatus>([
	'pending',
	'completed',
	'in_progress',
	'cancelled',
]);

/**
 * Serializes plan frontmatter + markdown body to Cursor-style `.plan.md` text.
 * Hand-rolled YAML — no external dependency.
 */
export function serializePlanMarkdown(frontmatter: PlanFrontmatter, body: string): string {
	const lines: string[] = ['---'];
	lines.push(`name: ${formatYamlScalar(frontmatter.name, false)}`);
	lines.push(`overview: ${formatYamlScalar(frontmatter.overview, true)}`);
	lines.push('todos:');
	for (const todo of frontmatter.todos) {
		lines.push(`  - id: ${formatYamlScalar(todo.id, false)}`);
		lines.push(`    content: ${formatYamlScalar(todo.content, false)}`);
		lines.push(`    status: ${todo.status}`);
	}
	lines.push(`isProject: ${frontmatter.isProject ? 'true' : 'false'}`);
	lines.push('---');
	return `${lines.join('\n')}\n\n${body}`;
}

/**
 * Parses Cursor-style plan markdown into frontmatter + body.
 */
export function parsePlanMarkdown(text: string): { frontmatter: PlanFrontmatter; body: string } {
	const normalized = text.replace(/^\uFEFF/, '');
	const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
	if (!match) {
		throw new Error('Plan markdown is missing a YAML frontmatter block delimited by ---');
	}

	const yaml = match[1] ?? '';
	const body = (match[2] ?? '').replace(/^\r?\n/, '');
	return {
		frontmatter: parseFrontmatterYaml(yaml),
		body,
	};
}

/**
 * Applies an exact single-occurrence string replacement to plan text.
 * Throws when `oldStr` is missing or matches more than once.
 */
export function applyPlanStringReplace(fullText: string, oldStr: string, newStr: string): string {
	if (oldStr.length === 0) {
		throw new Error('Plan string replace old_str must be non-empty');
	}

	const first = fullText.indexOf(oldStr);
	if (first < 0) {
		throw new Error('Plan string replace old_str was not found');
	}
	const second = fullText.indexOf(oldStr, first + oldStr.length);
	if (second >= 0) {
		throw new Error('Plan string replace old_str matched more than once (ambiguous)');
	}
	return fullText.slice(0, first) + newStr + fullText.slice(first + oldStr.length);
}

function parseFrontmatterYaml(yaml: string): PlanFrontmatter {
	let name: string | undefined;
	let overview: string | undefined;
	let isProject: boolean | undefined;
	const todos: PlanTodo[] = [];

	const lines = yaml.split(/\r?\n/);
	let i = 0;
	while (i < lines.length) {
		const line = lines[i] ?? '';
		const trimmed = line.trim();
		if (trimmed.length === 0 || trimmed.startsWith('#')) {
			i += 1;
			continue;
		}

		if (trimmed === 'todos:' || trimmed.startsWith('todos:')) {
			const inline = trimmed.slice('todos:'.length).trim();
			if (inline === '[]') {
				i += 1;
				continue;
			}
			i += 1;
			while (i < lines.length) {
				const todoLine = lines[i] ?? '';
				if (/^\S/.test(todoLine) && todoLine.trim().length > 0) {
					break;
				}
				const itemMatch = todoLine.match(/^\s*-\s+id:\s*(.*)$/);
				if (!itemMatch) {
					i += 1;
					continue;
				}
				const id = parseYamlScalar(itemMatch[1] ?? '');
				let content = '';
				let status: PlanTodoStatus = 'pending';
				i += 1;
				while (i < lines.length) {
					const fieldLine = lines[i] ?? '';
					if (/^\s*-\s+id:\s*/.test(fieldLine) || (/^\S/.test(fieldLine) && fieldLine.trim().length > 0)) {
						break;
					}
					const contentMatch = fieldLine.match(/^\s+content:\s*(.*)$/);
					if (contentMatch) {
						content = parseYamlScalar(contentMatch[1] ?? '');
						i += 1;
						continue;
					}
					const statusMatch = fieldLine.match(/^\s+status:\s*(.*)$/);
					if (statusMatch) {
						status = parseTodoStatus(parseYamlScalar(statusMatch[1] ?? ''));
						i += 1;
						continue;
					}
					i += 1;
				}
				todos.push({ id, content, status });
			}
			continue;
		}

		const kv = trimmed.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);
		if (!kv) {
			i += 1;
			continue;
		}
		const key = kv[1] ?? '';
		const rawValue = kv[2] ?? '';
		if (key === 'name') {
			name = parseYamlScalar(rawValue);
		} else if (key === 'overview') {
			overview = parseYamlScalar(rawValue);
		} else if (key === 'isProject') {
			isProject = parseYamlBoolean(rawValue);
		}
		i += 1;
	}

	if (name === undefined) {
		throw new Error('Plan frontmatter is missing required field: name');
	}
	if (overview === undefined) {
		throw new Error('Plan frontmatter is missing required field: overview');
	}
	if (isProject === undefined) {
		throw new Error('Plan frontmatter is missing required field: isProject');
	}

	return { name, overview, todos, isProject };
}

function parseTodoStatus(value: string): PlanTodoStatus {
	if (PLAN_TODO_STATUSES.has(value as PlanTodoStatus)) {
		return value as PlanTodoStatus;
	}
	throw new Error(`Invalid plan todo status: ${value}`);
}

function parseYamlBoolean(raw: string): boolean {
	const value = parseYamlScalar(raw).toLowerCase();
	if (value === 'true') {
		return true;
	}
	if (value === 'false') {
		return false;
	}
	throw new Error(`Invalid YAML boolean: ${raw}`);
}

function parseYamlScalar(raw: string): string {
	const trimmed = raw.trim();
	if (trimmed.length === 0) {
		return '';
	}
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
	) {
		const quote = trimmed[0];
		const inner = trimmed.slice(1, -1);
		if (quote === '"') {
			return inner
				.replace(/\\n/g, '\n')
				.replace(/\\r/g, '\r')
				.replace(/\\t/g, '\t')
				.replace(/\\"/g, '"')
				.replace(/\\\\/g, '\\');
		}
		return inner.replace(/''/g, "'");
	}
	return trimmed;
}

function formatYamlScalar(value: string, forceQuote: boolean): string {
	if (forceQuote || needsYamlQuotes(value)) {
		const escaped = value
			.replace(/\\/g, '\\\\')
			.replace(/"/g, '\\"')
			.replace(/\n/g, '\\n')
			.replace(/\r/g, '\\r')
			.replace(/\t/g, '\\t');
		return `"${escaped}"`;
	}
	return value;
}

function needsYamlQuotes(value: string): boolean {
	if (value.length === 0) {
		return true;
	}
	if (/^[-?:*&!|>%@`']/.test(value)) {
		return true;
	}
	if (/[#{}[\],*&!|>%@`]/.test(value) || /:\s/.test(value) || /\s#/.test(value)) {
		return true;
	}
	if (/[\n\r\t]/.test(value) || value.includes('"') || value.includes('\\')) {
		return true;
	}
	if (/^(true|false|null|~)$/i.test(value) || /^-?\d+(\.\d+)?$/.test(value)) {
		return true;
	}
	return false;
}
