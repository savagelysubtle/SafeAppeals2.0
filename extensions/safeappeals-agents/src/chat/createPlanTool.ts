/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { writeAgentCacheFile } from './planAgentProvider';
import {
	applyPlanStringReplace,
	parsePlanMarkdown,
	serializePlanMarkdown,
	type PlanFrontmatter,
	type PlanTodo,
	type PlanTodoStatus,
} from './planMd';
import {
	resolvePlanFileUri,
	resolvePlansDirectory,
} from './planPaths';
import { isPathInsideWorkspaceRoot, SAFEAPPEALS_CREATE_PLAN_TOOL } from './toolAllowlist';

const PLAN_TODO_STATUSES = new Set<PlanTodoStatus>([
	'pending',
	'completed',
	'in_progress',
	'cancelled',
]);

/** Last plan URI written per chat session resource (sticky updates without planPath). */
const lastPlanBySession = new Map<string, vscode.Uri>();

export interface CreatePlanTodoInput {
	readonly id: string;
	readonly content: string;
	readonly status?: string;
}

export interface CreatePlanInput {
	readonly name?: string;
	readonly overview?: string;
	readonly plan?: string;
	readonly todos?: readonly CreatePlanTodoInput[];
	readonly isProject?: boolean;
	readonly planPath?: string;
	readonly oldStr?: string;
	readonly newStr?: string;
}

export interface CreatePlanExecuteOptions {
	readonly workspaceFolder: vscode.Uri | undefined;
	readonly sessionKey: string | undefined;
}

function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function normalizeTodos(raw: unknown): PlanTodo[] | { error: string } {
	if (raw === undefined) {
		return [];
	}
	if (!Array.isArray(raw)) {
		return { error: 'Error: todos must be an array of { id, content, status? } objects.' };
	}
	const todos: PlanTodo[] = [];
	for (let i = 0; i < raw.length; i++) {
		const item = raw[i];
		if (!item || typeof item !== 'object') {
			return { error: `Error: todos[${i}] must be an object with id and content.` };
		}
		const record = item as Record<string, unknown>;
		if (!isNonEmptyString(record.id) || typeof record.content !== 'string') {
			return { error: `Error: todos[${i}] requires non-empty id and string content.` };
		}
		const statusRaw = record.status === undefined ? 'pending' : record.status;
		if (typeof statusRaw !== 'string' || !PLAN_TODO_STATUSES.has(statusRaw as PlanTodoStatus)) {
			return {
				error: `Error: todos[${i}].status must be one of pending|completed|in_progress|cancelled.`,
			};
		}
		todos.push({
			id: record.id.trim(),
			content: record.content,
			status: statusRaw as PlanTodoStatus,
		});
	}
	return todos;
}

/**
 * Converts a `file:` URI string to an absolute filesystem path.
 * Avoids relying on incomplete `vscode.Uri.parse` stubs in unit tests.
 */
function fsPathFromFileUri(fileUri: string): string {
	try {
		const parsed = vscode.Uri.parse(fileUri);
		if (parsed.scheme === 'file' && typeof parsed.fsPath === 'string' && parsed.fsPath.length > 0) {
			return path.resolve(parsed.fsPath);
		}
	} catch {
		// fall through to manual parse
	}

	let rest = fileUri.replace(/^file:\/\//i, '');
	rest = decodeURIComponent(rest);
	// `file:///C:/...` → `/C:/...` on some parsers; normalize Windows drive paths.
	if (/^\/[A-Za-z]:[\\/]/.test(rest)) {
		rest = rest.slice(1);
	}
	return path.resolve(rest);
}

/**
 * Resolves a planPath to a file URI that must stay under `.safeAppeals/plans/`.
 */
export function resolveExistingPlanUri(
	planPath: string,
	workspaceFolder: vscode.Uri,
): vscode.Uri | undefined {
	const trimmed = planPath.trim();
	if (!trimmed) {
		return undefined;
	}

	let candidate: vscode.Uri;
	try {
		if (/^file:/i.test(trimmed)) {
			candidate = vscode.Uri.file(fsPathFromFileUri(trimmed));
		} else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
			// Non-file schemes are never valid plan paths.
			return undefined;
		} else if (path.isAbsolute(trimmed) || /^[A-Za-z]:[\\/]/.test(trimmed)) {
			candidate = vscode.Uri.file(path.resolve(trimmed));
		} else {
			candidate = vscode.Uri.joinPath(workspaceFolder, trimmed);
			candidate = vscode.Uri.file(path.resolve(candidate.fsPath));
		}
	} catch {
		return undefined;
	}

	const plansDir = resolvePlansDirectory(workspaceFolder);
	if (!isPathInsideWorkspaceRoot(candidate.fsPath, [plansDir.fsPath])) {
		return undefined;
	}
	if (!candidate.fsPath.toLowerCase().endsWith('.plan.md')) {
		return undefined;
	}
	return candidate;
}

async function ensurePlansDirectory(plansDir: vscode.Uri): Promise<void> {
	await fs.mkdir(plansDir.fsPath, { recursive: true, mode: 0o700 });
	if (process.platform !== 'win32') {
		await fs.chmod(plansDir.fsPath, 0o700);
		const parent = path.dirname(plansDir.fsPath);
		try {
			await fs.chmod(parent, 0o700);
		} catch {
			// Parent may already exist with different ownership; plans dir chmod is the hard requirement.
		}
	}
}

function rememberPlan(sessionKey: string | undefined, uri: vscode.Uri): void {
	if (sessionKey) {
		lastPlanBySession.set(sessionKey, uri);
	}
}

function nextStepMessage(uri: vscode.Uri, name: string, action: 'Created' | 'Updated'): string {
	return (
		`${action} plan "${name}" at ${uri.toString()} (${uri.fsPath}). ` +
		`Next step: call reviewPlan with this plan URI so the user can approve it.`
	);
}

/**
 * Core create/update logic for `safeappeals_createPlan` (testable without LM result types).
 */
export async function executeCreatePlan(
	input: CreatePlanInput,
	options: CreatePlanExecuteOptions,
): Promise<string> {
	const workspaceFolder = options.workspaceFolder;
	if (!workspaceFolder) {
		return 'Error: an open workspace folder is required to create or update plans under .safeAppeals/plans/.';
	}

	const wantsReplace =
		input.oldStr !== undefined || input.newStr !== undefined;
	const stickyUri = options.sessionKey
		? lastPlanBySession.get(options.sessionKey)
		: undefined;
	const hasUpdateTarget =
		isNonEmptyString(input.planPath) || stickyUri !== undefined;
	// Prefer update when planPath or a sticky session URI exists — even if name/overview/plan are set.
	const isCreate =
		!hasUpdateTarget &&
		!wantsReplace &&
		isNonEmptyString(input.name) &&
		isNonEmptyString(input.overview) &&
		typeof input.plan === 'string' &&
		input.plan.length > 0;

	try {
		if (isCreate) {
			return await createPlan(input, workspaceFolder, options.sessionKey);
		}
		return await updatePlan(input, workspaceFolder, options.sessionKey, wantsReplace);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return `Error: ${message}`;
	}
}

async function createPlan(
	input: CreatePlanInput,
	workspaceFolder: vscode.Uri,
	sessionKey: string | undefined,
): Promise<string> {
	const name = (input.name ?? '').trim();
	const overview = (input.overview ?? '').trim();
	const body = input.plan ?? '';
	const todosResult = normalizeTodos(input.todos);
	if ('error' in todosResult) {
		return todosResult.error;
	}

	const plansDir = resolvePlansDirectory(workspaceFolder);
	await ensurePlansDirectory(plansDir);

	const hash = randomBytes(4).toString('hex');
	const uri = resolvePlanFileUri(workspaceFolder, name, hash);
	if (!isPathInsideWorkspaceRoot(uri.fsPath, [plansDir.fsPath])) {
		return 'Error: refused to write plan outside .safeAppeals/plans/.';
	}

	const frontmatter: PlanFrontmatter = {
		name,
		overview,
		todos: todosResult,
		isProject: input.isProject === true,
	};
	const content = serializePlanMarkdown(frontmatter, body);
	await writeAgentCacheFile(uri.fsPath, content);
	rememberPlan(sessionKey, uri);
	return nextStepMessage(uri, name, 'Created');
}

async function updatePlan(
	input: CreatePlanInput,
	workspaceFolder: vscode.Uri,
	sessionKey: string | undefined,
	wantsReplace: boolean,
): Promise<string> {
	const sticky = sessionKey ? lastPlanBySession.get(sessionKey) : undefined;
	let targetUri: vscode.Uri | undefined;
	if (isNonEmptyString(input.planPath)) {
		targetUri = resolveExistingPlanUri(input.planPath, workspaceFolder);
		if (!targetUri) {
			return 'Error: planPath must resolve to a .plan.md file inside .safeAppeals/plans/.';
		}
	} else if (sticky) {
		const plansDir = resolvePlansDirectory(workspaceFolder);
		if (!isPathInsideWorkspaceRoot(sticky.fsPath, [plansDir.fsPath])) {
			return 'Error: sticky plan URI is outside .safeAppeals/plans/; pass planPath explicitly.';
		}
		targetUri = sticky;
	} else {
		return 'Error: update requires planPath, or a prior plan in this chat session (create a plan first).';
	}

	const plansDir = resolvePlansDirectory(workspaceFolder);
	if (!isPathInsideWorkspaceRoot(targetUri.fsPath, [plansDir.fsPath])) {
		return 'Error: refused to write plan outside .safeAppeals/plans/.';
	}

	let existing: string;
	try {
		existing = await fs.readFile(targetUri.fsPath, 'utf8');
	} catch {
		return `Error: plan file not found at ${targetUri.fsPath}.`;
	}

	if (wantsReplace) {
		if (typeof input.oldStr !== 'string' || typeof input.newStr !== 'string') {
			return 'Error: update with string replace requires both oldStr and newStr.';
		}
		if (typeof input.plan === 'string' && input.plan.length > 0) {
			return 'Error: provide either plan (full body update) or oldStr+newStr, not both.';
		}
		let replaced: string;
		try {
			replaced = applyPlanStringReplace(existing, input.oldStr, input.newStr);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return `Error: ${message}`;
		}
		await writeAgentCacheFile(targetUri.fsPath, replaced);
		rememberPlan(sessionKey, targetUri);
		let displayName = path.basename(targetUri.fsPath);
		try {
			displayName = parsePlanMarkdown(replaced).frontmatter.name;
		} catch {
			// keep basename
		}
		return nextStepMessage(targetUri, displayName, 'Updated');
	}

	if (typeof input.plan !== 'string') {
		return 'Error: update requires either plan (full markdown body) or both oldStr and newStr.';
	}

	let parsed: { frontmatter: PlanFrontmatter; body: string };
	try {
		parsed = parsePlanMarkdown(existing);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return `Error: could not parse existing plan: ${message}`;
	}

	let todos = parsed.frontmatter.todos;
	if (input.todos !== undefined) {
		const todosResult = normalizeTodos(input.todos);
		if ('error' in todosResult) {
			return todosResult.error;
		}
		todos = todosResult;
	}

	const frontmatter: PlanFrontmatter = {
		name: isNonEmptyString(input.name) ? input.name.trim() : parsed.frontmatter.name,
		overview: isNonEmptyString(input.overview) ? input.overview.trim() : parsed.frontmatter.overview,
		todos,
		isProject: typeof input.isProject === 'boolean' ? input.isProject : parsed.frontmatter.isProject,
	};
	const content = serializePlanMarkdown(frontmatter, input.plan);
	await writeAgentCacheFile(targetUri.fsPath, content);
	rememberPlan(sessionKey, targetUri);
	return nextStepMessage(targetUri, frontmatter.name, 'Updated');
}

class CreatePlanTool implements vscode.LanguageModelTool<CreatePlanInput> {
	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<CreatePlanInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const input = options.input;
		const sessionKey = options.chatSessionResource?.toString();
		const stickyUri = sessionKey ? lastPlanBySession.get(sessionKey) : undefined;
		const hasUpdateTarget =
			isNonEmptyString(input?.planPath) || stickyUri !== undefined;
		const wantsReplace = input?.oldStr !== undefined || input?.newStr !== undefined;
		const isCreate =
			!hasUpdateTarget &&
			!wantsReplace &&
			isNonEmptyString(input?.name) &&
			isNonEmptyString(input?.overview) &&
			typeof input?.plan === 'string' &&
			input.plan.length > 0;
		return {
			invocationMessage: isCreate ? 'Creating plan' : 'Updating plan',
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<CreatePlanInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const message = await executeCreatePlan(options.input ?? {}, {
			workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri,
			sessionKey: options.chatSessionResource?.toString(),
		});
		return textResult(message);
	}
}

/**
 * Clears sticky plan URIs (unit tests only).
 */
export function resetCreatePlanSessionStateForTests(): void {
	lastPlanBySession.clear();
}

/**
 * Registers the SafeAppeals create/update plan LM tool.
 */
export function registerCreatePlanTool(): vscode.Disposable {
	return vscode.lm.registerTool<CreatePlanInput>(SAFEAPPEALS_CREATE_PLAN_TOOL, new CreatePlanTool());
}
