/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { AccountStore } from './accountStore';
import { getCurrentCase } from './config';
import { DashboardPanel, EmailSidebarProvider } from './dashboardPanel';
import { resolveDraftAccountId } from './draftAccount';
import type { EmailIndex } from './emailIndex';
import { resolveWorkspaceFilePath } from './pathResolve';
import type { SyncEngine } from './syncEngine';
import type {
	EmailAccountConfig,
	EmailDraft,
	EmailMessage,
	EmailMessageSummary,
	EmailThread,
	ThreadSort,
} from './types';

export const SAFEAPPEALS_EMAIL_SEARCH_TOOL = 'safeappeals_email_search';
export const SAFEAPPEALS_EMAIL_LIST_THREADS_TOOL = 'safeappeals_email_listThreads';
export const SAFEAPPEALS_EMAIL_GET_MESSAGE_TOOL = 'safeappeals_email_getMessage';
export const SAFEAPPEALS_EMAIL_LIST_ACCOUNTS_TOOL = 'safeappeals_email_listAccounts';
export const SAFEAPPEALS_EMAIL_LIST_FOLDERS_TOOL = 'safeappeals_email_listFolders';
export const SAFEAPPEALS_EMAIL_LIST_TAGS_TOOL = 'safeappeals_email_listTags';
export const SAFEAPPEALS_EMAIL_TAG_THREAD_TOOL = 'safeappeals_email_tagThread';
export const SAFEAPPEALS_EMAIL_UNTAG_THREAD_TOOL = 'safeappeals_email_untagThread';
export const SAFEAPPEALS_EMAIL_DELETE_TAG_TOOL = 'safeappeals_email_deleteTag';
export const SAFEAPPEALS_EMAIL_HIDE_THREAD_TOOL = 'safeappeals_email_hideThread';
export const SAFEAPPEALS_EMAIL_UNHIDE_THREAD_TOOL = 'safeappeals_email_unhideThread';
export const SAFEAPPEALS_EMAIL_LINK_THREAD_TO_CASE_TOOL = 'safeappeals_email_linkThreadToCase';
export const SAFEAPPEALS_EMAIL_UNLINK_THREAD_FROM_CASE_TOOL = 'safeappeals_email_unlinkThreadFromCase';
export const SAFEAPPEALS_EMAIL_CREATE_DRAFT_TOOL = 'safeappeals_email_createDraft';

export { resolveDraftAccountId } from './draftAccount';

/** All contributed Safe Appeals Email LM tool names (14). No send tool. */
export const SAFEAPPEALS_EMAIL_TOOL_NAMES = [
	SAFEAPPEALS_EMAIL_SEARCH_TOOL,
	SAFEAPPEALS_EMAIL_LIST_THREADS_TOOL,
	SAFEAPPEALS_EMAIL_GET_MESSAGE_TOOL,
	SAFEAPPEALS_EMAIL_LIST_ACCOUNTS_TOOL,
	SAFEAPPEALS_EMAIL_LIST_FOLDERS_TOOL,
	SAFEAPPEALS_EMAIL_LIST_TAGS_TOOL,
	SAFEAPPEALS_EMAIL_TAG_THREAD_TOOL,
	SAFEAPPEALS_EMAIL_UNTAG_THREAD_TOOL,
	SAFEAPPEALS_EMAIL_DELETE_TAG_TOOL,
	SAFEAPPEALS_EMAIL_HIDE_THREAD_TOOL,
	SAFEAPPEALS_EMAIL_UNHIDE_THREAD_TOOL,
	SAFEAPPEALS_EMAIL_LINK_THREAD_TO_CASE_TOOL,
	SAFEAPPEALS_EMAIL_UNLINK_THREAD_FROM_CASE_TOOL,
	SAFEAPPEALS_EMAIL_CREATE_DRAFT_TOOL,
] as const;

const BODY_TRUNCATE_CHARS = 60_000;

interface CreateDraftInput {
	to: string;
	subject: string;
	content: string;
	accountId?: string;
	cc?: string;
	bcc?: string;
	emailId?: string;
	draftId?: string;
	/** When false, skip opening the compose pane after save. Default true. */
	openInCompose?: boolean;
	/** Workspace-relative or absolute paths inside an open workspace folder */
	attachments?: Array<{ path: string }>;
}

interface SearchInput {
	query: string;
	accountId?: string;
	limit?: number;
}

interface ListThreadsInput {
	accountId?: string;
	folder?: string;
	offset?: number;
	limit?: number;
	sort?: ThreadSort;
	tag?: string;
	caseFolderPath?: string;
}

interface GetMessageInput {
	messageId: string;
	forceReload?: boolean;
}

interface ListFoldersInput {
	accountId?: string;
}

interface ThreadTagInput {
	threadId: string;
	tag: string;
}

interface ThreadIdInput {
	threadId: string;
}

interface DeleteTagInput {
	tag: string;
}

interface LinkThreadInput {
	threadId: string;
	caseFolderPath?: string;
}

export interface AfterDraftSavedHooks {
	refreshEmailUi?: () => void | Promise<void>;
	openComposeWithDraft?: (draft: EmailDraft) => void;
}

export interface AgentToolUiHooks {
	refreshEmailUi?: () => void | Promise<void>;
	openComposeWithDraft?: (draft: EmailDraft) => void;
}

/**
 * Truncate a message body for model output. Leaves short bodies unchanged.
 */
export function truncateBody(text: string, maxChars = BODY_TRUNCATE_CHARS): string {
	if (text.length <= maxChars) {
		return text;
	}
	return (
		`${text.slice(0, maxChars)}\n\n`
		+ `[truncated: body was ${text.length} characters; showing first ${maxChars}]`
	);
}

export function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

/** Refresh dashboard + sidebar when they are already open/resolved. */
export function refreshEmailUi(): void {
	void DashboardPanel.refreshIfOpen();
	EmailSidebarProvider.refreshIfResolved();
}

/**
 * Post-save orchestration for createDraft. Injectable hooks keep unit tests UI-free.
 */
export async function afterDraftSaved(
	draft: EmailDraft,
	opts: { openInCompose?: boolean } = {},
	hooks: AfterDraftSavedHooks = {},
): Promise<void> {
	const refresh = hooks.refreshEmailUi ?? refreshEmailUi;
	await refresh();
	if (opts.openInCompose !== false) {
		hooks.openComposeWithDraft?.(draft);
	}
}

function clampLimit(value: number | undefined, defaultVal: number, max: number): number {
	if (value === undefined || value === null) {
		return defaultVal;
	}
	const n = Math.floor(Number(value));
	if (!Number.isFinite(n) || n < 1) {
		return defaultVal;
	}
	return Math.min(n, max);
}

function formatSearchHit(m: EmailMessageSummary): string {
	const snippet = (m.snippet || '').replace(/\s+/g, ' ').trim();
	return [
		`id: ${m.id}`,
		`messageId: ${m.messageId || ''}`,
		`threadId: ${m.threadId}`,
		`from: ${m.from}`,
		`subject: ${m.subject}`,
		`date: ${m.date}`,
		snippet ? `snippet: ${snippet}` : undefined,
	].filter(Boolean).join('\n');
}

function formatThread(t: EmailThread): string {
	return [
		`threadId: ${t.threadId}`,
		`accountId: ${t.accountId}`,
		`folder: ${t.folder}`,
		`subject: ${t.subject}`,
		`latestDate: ${t.latestDate}`,
		`emailCount: ${t.emailCount}`,
		`tags: ${(t.tags || []).join(', ') || '(none)'}`,
		`hidden: ${t.hidden ? 'true' : 'false'}`,
		`caseFolderPath: ${t.caseFolderPath || '(none)'}`,
	].join('\n');
}

/**
 * Format a message for the model: bodyText (truncated), attachment metadata only.
 * Never includes bodyHtml or attachment content bytes.
 */
export function formatMessageForModel(msg: EmailMessage): string {
	const attachments = (msg.attachments || []).map(a =>
		`- ${a.filename} (${a.contentType}${a.size !== undefined ? `, ${a.size} bytes` : ''})`
	);
	const body = truncateBody(msg.bodyText || '');
	return [
		`id: ${msg.id}`,
		`messageId: ${msg.messageId || ''}`,
		`threadId: ${msg.threadId}`,
		`accountId: ${msg.accountId}`,
		`folder: ${msg.folder}`,
		`from: ${msg.from}`,
		`to: ${msg.to}`,
		msg.cc ? `cc: ${msg.cc}` : undefined,
		`subject: ${msg.subject}`,
		`date: ${msg.date}`,
		`bodyLoaded: ${msg.bodyLoaded ? 'true' : 'false'}`,
		attachments.length ? `attachments:\n${attachments.join('\n')}` : 'attachments: (none)',
		'',
		'bodyText:',
		body || '(empty)',
	].filter(v => v !== undefined).join('\n');
}

function notInitialized(): vscode.LanguageModelToolResult {
	return textResult('Error: Safe Appeals Email is not initialized.');
}

/**
 * Infer mailbox provider from non-secret account config only (hosts).
 * Never reads SecretStorage / credentials.
 */
export function accountProviderLabel(account: EmailAccountConfig): string {
	const hosts = `${account.imapHost} ${account.smtpHost}`.toLowerCase();
	if (hosts.includes('gmail.com') || hosts.includes('googlemail.com')) {
		return 'google';
	}
	if (
		hosts.includes('outlook.office365.com')
		|| hosts.includes('smtp.office365.com')
		|| hosts.includes('outlook.com')
		|| hosts.includes('hotmail.com')
		|| hosts.includes('live.com')
	) {
		return 'microsoft';
	}
	return 'password';
}

class EmailSearchTool implements vscode.LanguageModelTool<SearchInput> {
	constructor(private readonly getIndex: () => EmailIndex | undefined) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<SearchInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const q = options.input?.query?.trim() || '(empty)';
		return { invocationMessage: `Searching local email index for “${q}”` };
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<SearchInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const index = this.getIndex();
		if (!index) {
			return notInitialized();
		}
		const query = options.input?.query?.trim() ?? '';
		if (!query) {
			return textResult('Error: "query" is required.');
		}
		const limit = clampLimit(options.input?.limit, 25, 100);
		const accountId = options.input?.accountId?.trim() || undefined;
		const hits = index.search(query, accountId).slice(0, limit);
		if (hits.length === 0) {
			return textResult(`No matches for “${query}” in the local synced email index.`);
		}
		const blocks = hits.map((h, i) => `[${i + 1}]\n${formatSearchHit(h)}`);
		return textResult(
			`Found ${hits.length} match(es) in the local synced index`
			+ (accountId ? ` (accountId=${accountId})` : '')
			+ `:\n\n${blocks.join('\n\n')}`,
		);
	}
}

class EmailListThreadsTool implements vscode.LanguageModelTool<ListThreadsInput> {
	constructor(private readonly getEngine: () => SyncEngine | undefined) { }

	async prepareInvocation(
		_options: vscode.LanguageModelToolInvocationPrepareOptions<ListThreadsInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		return { invocationMessage: 'Listing email threads' };
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ListThreadsInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const engine = this.getEngine();
		if (!engine) {
			return notInitialized();
		}
		const input = options.input || {};
		const limit = clampLimit(input.limit, 20, 50);
		const offset = Math.max(0, Math.floor(Number(input.offset ?? 0)) || 0);
		const sort = input.sort;
		const result = engine.listThreads({
			accountId: input.accountId?.trim() || undefined,
			folder: input.folder?.trim() || undefined,
			offset,
			limit,
			sort,
			tag: input.tag?.trim() || undefined,
			caseFolderPath: input.caseFolderPath?.trim() || undefined,
		});
		if (result.threads.length === 0) {
			return textResult(`No threads (total=${result.total}).`);
		}
		const blocks = result.threads.map((t, i) => `[${i + 1}]\n${formatThread(t)}`);
		return textResult(
			`Threads ${offset + 1}-${offset + result.threads.length} of ${result.total}:\n\n`
			+ blocks.join('\n\n'),
		);
	}
}

class EmailGetMessageTool implements vscode.LanguageModelTool<GetMessageInput> {
	constructor(private readonly getEngine: () => SyncEngine | undefined) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<GetMessageInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const id = options.input?.messageId?.trim() || '(unknown)';
		return { invocationMessage: `Loading email message ${id}` };
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<GetMessageInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const engine = this.getEngine();
		if (!engine) {
			return notInitialized();
		}
		const messageId = options.input?.messageId?.trim() ?? '';
		if (!messageId) {
			return textResult('Error: "messageId" is required.');
		}
		try {
			const msg = await engine.getMessage(messageId, !!options.input?.forceReload);
			return textResult(formatMessageForModel(msg));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error loading message: ${message}`);
		}
	}
}

class EmailListAccountsTool implements vscode.LanguageModelTool<object> {
	constructor(private readonly getAccounts: () => AccountStore | undefined) { }

	async prepareInvocation(
		_options: vscode.LanguageModelToolInvocationPrepareOptions<object>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		return { invocationMessage: 'Listing email accounts' };
	}

	async invoke(
		_options: vscode.LanguageModelToolInvocationOptions<object>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const accounts = this.getAccounts();
		if (!accounts) {
			return notInitialized();
		}
		const listed = accounts.listAccounts();
		if (listed.length === 0) {
			return textResult('No email accounts configured.');
		}
		const lines = listed.map(a =>
			[
				`id: ${a.id}`,
				`email: ${a.email}`,
				`label: ${a.label}`,
				`authStatus: ${a.authStatus || 'ok'}`,
				`provider: ${accountProviderLabel(a)}`,
			].join('\n'),
		);
		return textResult(`${listed.length} account(s):\n\n${lines.join('\n\n')}`);
	}
}

class EmailListFoldersTool implements vscode.LanguageModelTool<ListFoldersInput> {
	constructor(
		private readonly getEngine: () => SyncEngine | undefined,
		private readonly getAccounts: () => AccountStore | undefined,
	) { }

	async prepareInvocation(
		_options: vscode.LanguageModelToolInvocationPrepareOptions<ListFoldersInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		return { invocationMessage: 'Listing mailbox folders' };
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ListFoldersInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const engine = this.getEngine();
		const accounts = this.getAccounts();
		if (!engine || !accounts) {
			return notInitialized();
		}
		const listed = accounts.listAccounts();
		const resolved = resolveDraftAccountId(options.input?.accountId, listed);
		if ('error' in resolved) {
			return textResult(resolved.error);
		}
		try {
			const folders = await engine.listFolders(resolved.accountId);
			if (!folders.length) {
				return textResult(`No folders for account ${resolved.accountId}.`);
			}
			const lines = folders.map(f =>
				`- ${f.path}${f.specialUse ? ` (${f.specialUse})` : ''}`
			);
			return textResult(`Folders for ${resolved.accountId}:\n${lines.join('\n')}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error listing folders: ${message}`);
		}
	}
}

class EmailListTagsTool implements vscode.LanguageModelTool<object> {
	constructor(private readonly getIndex: () => EmailIndex | undefined) { }

	async prepareInvocation(
		_options: vscode.LanguageModelToolInvocationPrepareOptions<object>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		return { invocationMessage: 'Listing email tags' };
	}

	async invoke(
		_options: vscode.LanguageModelToolInvocationOptions<object>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const index = this.getIndex();
		if (!index) {
			return notInitialized();
		}
		const tags = index.listTags();
		if (tags.length === 0) {
			return textResult('No tags defined.');
		}
		return textResult(
			`Tags:\n${tags.map(t => `- ${t.name} (count=${t.count})`).join('\n')}`,
		);
	}
}

class EmailTagThreadTool implements vscode.LanguageModelTool<ThreadTagInput> {
	constructor(
		private readonly getEngine: () => SyncEngine | undefined,
		private readonly getIndex: () => EmailIndex | undefined,
		private readonly ui: AgentToolUiHooks,
	) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<ThreadTagInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const threadId = options.input?.threadId ?? '(unknown)';
		const tag = options.input?.tag ?? '(unknown)';
		return {
			invocationMessage: `Tagging thread ${threadId}`,
			confirmationMessages: {
				title: 'Tag Email Thread',
				message: `Apply tag “${tag}” to thread ${threadId}?`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ThreadTagInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const engine = this.getEngine();
		const index = this.getIndex();
		if (!engine || !index) {
			return notInitialized();
		}
		const threadId = options.input?.threadId?.trim() ?? '';
		const tag = options.input?.tag?.trim() ?? '';
		if (!threadId) {
			return textResult('Error: "threadId" is required.');
		}
		if (!tag) {
			return textResult('Error: "tag" is required.');
		}
		if (!engine.getThread(threadId)) {
			return textResult(`Error: thread not found: ${threadId}`);
		}
		try {
			await index.tagThread(threadId, tag);
			await (this.ui.refreshEmailUi ?? refreshEmailUi)();
			const tags = index.getThreadTags(threadId);
			return textResult(
				`Tagged thread ${threadId} with “${tag}”.\nCurrent tags: ${tags.join(', ') || '(none)'}`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error tagging thread: ${message}`);
		}
	}
}

class EmailUntagThreadTool implements vscode.LanguageModelTool<ThreadTagInput> {
	constructor(
		private readonly getEngine: () => SyncEngine | undefined,
		private readonly getIndex: () => EmailIndex | undefined,
		private readonly ui: AgentToolUiHooks,
	) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<ThreadTagInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const threadId = options.input?.threadId ?? '(unknown)';
		const tag = options.input?.tag ?? '(unknown)';
		return {
			invocationMessage: `Removing tag from thread ${threadId}`,
			confirmationMessages: {
				title: 'Untag Email Thread',
				message: `Remove tag “${tag}” from thread ${threadId}?`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ThreadTagInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const engine = this.getEngine();
		const index = this.getIndex();
		if (!engine || !index) {
			return notInitialized();
		}
		const threadId = options.input?.threadId?.trim() ?? '';
		const tag = options.input?.tag?.trim() ?? '';
		if (!threadId) {
			return textResult('Error: "threadId" is required.');
		}
		if (!tag) {
			return textResult('Error: "tag" is required.');
		}
		if (!engine.getThread(threadId)) {
			return textResult(`Error: thread not found: ${threadId}`);
		}
		try {
			await index.untagThread(threadId, tag);
			await (this.ui.refreshEmailUi ?? refreshEmailUi)();
			const tags = index.getThreadTags(threadId);
			return textResult(
				`Removed tag “${tag}” from thread ${threadId}.\nCurrent tags: ${tags.join(', ') || '(none)'}`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error untagging thread: ${message}`);
		}
	}
}

class EmailDeleteTagTool implements vscode.LanguageModelTool<DeleteTagInput> {
	constructor(
		private readonly getIndex: () => EmailIndex | undefined,
		private readonly ui: AgentToolUiHooks,
	) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<DeleteTagInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const tag = options.input?.tag ?? '(unknown)';
		return {
			invocationMessage: `Deleting tag “${tag}”`,
			confirmationMessages: {
				title: 'Delete Email Tag',
				message:
					`Delete tag “${tag}” from the vocabulary and strip it from every thread that has it?\n\n`
					+ 'This never deletes emails — only the tag label and associations.',
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<DeleteTagInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const index = this.getIndex();
		if (!index) {
			return notInitialized();
		}
		const tag = options.input?.tag?.trim() ?? '';
		if (!tag) {
			return textResult('Error: "tag" is required.');
		}
		try {
			await index.deleteTag(tag);
			await (this.ui.refreshEmailUi ?? refreshEmailUi)();
			return textResult(
				`Deleted tag “${tag}” from the vocabulary and all threads. Emails were not deleted.`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error deleting tag: ${message}`);
		}
	}
}

class EmailHideThreadTool implements vscode.LanguageModelTool<ThreadIdInput> {
	constructor(
		private readonly getEngine: () => SyncEngine | undefined,
		private readonly getIndex: () => EmailIndex | undefined,
		private readonly ui: AgentToolUiHooks,
	) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<ThreadIdInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const threadId = options.input?.threadId ?? '(unknown)';
		return {
			invocationMessage: `Hiding thread ${threadId}`,
			confirmationMessages: {
				title: 'Hide Email Thread',
				message:
					`Hide thread ${threadId}? It stays in listings (sorted to the bottom) and is not deleted.`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ThreadIdInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const engine = this.getEngine();
		const index = this.getIndex();
		if (!engine || !index) {
			return notInitialized();
		}
		const threadId = options.input?.threadId?.trim() ?? '';
		if (!threadId) {
			return textResult('Error: "threadId" is required.');
		}
		if (!engine.getThread(threadId)) {
			return textResult(`Error: thread not found: ${threadId}`);
		}
		try {
			await index.hideThread(threadId);
			await (this.ui.refreshEmailUi ?? refreshEmailUi)();
			return textResult(`Hidden thread ${threadId}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error hiding thread: ${message}`);
		}
	}
}

class EmailUnhideThreadTool implements vscode.LanguageModelTool<ThreadIdInput> {
	constructor(
		private readonly getEngine: () => SyncEngine | undefined,
		private readonly getIndex: () => EmailIndex | undefined,
		private readonly ui: AgentToolUiHooks,
	) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<ThreadIdInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const threadId = options.input?.threadId ?? '(unknown)';
		return {
			invocationMessage: `Unhiding thread ${threadId}`,
			confirmationMessages: {
				title: 'Unhide Email Thread',
				message: `Unhide thread ${threadId} and restore its natural sort position?`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ThreadIdInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const engine = this.getEngine();
		const index = this.getIndex();
		if (!engine || !index) {
			return notInitialized();
		}
		const threadId = options.input?.threadId?.trim() ?? '';
		if (!threadId) {
			return textResult('Error: "threadId" is required.');
		}
		if (!engine.getThread(threadId)) {
			return textResult(`Error: thread not found: ${threadId}`);
		}
		try {
			await index.unhideThread(threadId);
			await (this.ui.refreshEmailUi ?? refreshEmailUi)();
			return textResult(`Unhidden thread ${threadId}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error unhiding thread: ${message}`);
		}
	}
}

class EmailLinkThreadToCaseTool implements vscode.LanguageModelTool<LinkThreadInput> {
	constructor(
		private readonly getEngine: () => SyncEngine | undefined,
		private readonly getIndex: () => EmailIndex | undefined,
		private readonly ui: AgentToolUiHooks,
	) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<LinkThreadInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const threadId = options.input?.threadId ?? '(unknown)';
		const target = options.input?.caseFolderPath?.trim()
			|| getCurrentCase()?.caseFolderPath
			|| '(current case)';
		return {
			invocationMessage: `Linking thread ${threadId} to case`,
			confirmationMessages: {
				title: 'Link Thread to Case',
				message: `Link thread ${threadId} to case folder:\n${target}`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<LinkThreadInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const engine = this.getEngine();
		const index = this.getIndex();
		if (!engine || !index) {
			return notInitialized();
		}
		const threadId = options.input?.threadId?.trim() ?? '';
		if (!threadId) {
			return textResult('Error: "threadId" is required.');
		}
		if (!engine.getThread(threadId)) {
			return textResult(`Error: thread not found: ${threadId}`);
		}
		const target = options.input?.caseFolderPath?.trim() || getCurrentCase()?.caseFolderPath;
		if (!target) {
			return textResult(
				'Error: caseFolderPath is required when no case folder is open in the workspace.',
			);
		}
		try {
			await index.linkThreadToCase(threadId, target);
			await (this.ui.refreshEmailUi ?? refreshEmailUi)();
			return textResult(`Linked thread ${threadId} to case ${target}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error linking thread to case: ${message}`);
		}
	}
}

class EmailUnlinkThreadFromCaseTool implements vscode.LanguageModelTool<ThreadIdInput> {
	constructor(
		private readonly getEngine: () => SyncEngine | undefined,
		private readonly getIndex: () => EmailIndex | undefined,
		private readonly ui: AgentToolUiHooks,
	) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<ThreadIdInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const threadId = options.input?.threadId ?? '(unknown)';
		return {
			invocationMessage: `Unlinking thread ${threadId} from case`,
			confirmationMessages: {
				title: 'Unlink Thread from Case',
				message: `Remove the case link from thread ${threadId}?`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ThreadIdInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const engine = this.getEngine();
		const index = this.getIndex();
		if (!engine || !index) {
			return notInitialized();
		}
		const threadId = options.input?.threadId?.trim() ?? '';
		if (!threadId) {
			return textResult('Error: "threadId" is required.');
		}
		if (!engine.getThread(threadId)) {
			return textResult(`Error: thread not found: ${threadId}`);
		}
		try {
			await index.unlinkThread(threadId);
			await (this.ui.refreshEmailUi ?? refreshEmailUi)();
			return textResult(`Unlinked thread ${threadId} from its case.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error unlinking thread from case: ${message}`);
		}
	}
}

class EmailCreateDraftTool implements vscode.LanguageModelTool<CreateDraftInput> {
	constructor(
		private readonly getEngine: () => SyncEngine | undefined,
		private readonly getAccounts: () => AccountStore | undefined,
		private readonly ui: AgentToolUiHooks,
	) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<CreateDraftInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const to = options.input?.to ?? '(unknown)';
		const subject = options.input?.subject ?? '(no subject)';
		const attachCount = Array.isArray(options.input?.attachments)
			? options.input.attachments.length
			: 0;
		const attachLine = attachCount > 0
			? `\nAttachments: ${attachCount} file(s)`
			: '';
		return {
			invocationMessage: `Saving email draft to ${to}`,
			confirmationMessages: {
				title: 'Create Email Draft',
				message: `Save a draft (does not send):\nTo: ${to}\nSubject: ${subject}${attachLine}`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<CreateDraftInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const engine = this.getEngine();
		const accounts = this.getAccounts();
		if (!engine || !accounts) {
			return notInitialized();
		}

		const input = options.input;
		const to = input?.to?.trim() ?? '';
		const subject = input?.subject?.trim() ?? '';
		const content = input?.content ?? '';
		if (!to) {
			return textResult('Error: "to" is required.');
		}
		if (!subject) {
			return textResult('Error: "subject" is required.');
		}

		const listed = accounts.listAccounts();
		const resolved = resolveDraftAccountId(input.accountId, listed);
		if ('error' in resolved) {
			return textResult(resolved.error);
		}
		const accountId = resolved.accountId;

		const attachmentPaths: string[] = [];
		const attachInputs = Array.isArray(input.attachments) ? input.attachments : [];
		if (attachInputs.length > 0) {
			const folders = vscode.workspace.workspaceFolders ?? [];
			for (const item of attachInputs) {
				const rawPath = typeof item?.path === 'string' ? item.path : '';
				// realpath + re-check containment — rejects symlink escapes outside workspace
				const uri = await resolveWorkspaceFilePath(rawPath, folders);
				if (!uri || uri.scheme !== 'file') {
					return textResult(
						`Error: attachment path must be inside an open workspace folder: ${rawPath || '(empty)'}`,
					);
				}
				attachmentPaths.push(uri.fsPath);
			}
		}

		try {
			const result = await engine.saveDraft({
				accountId,
				emailId: input.emailId?.trim() || '',
				to,
				cc: input.cc?.trim() || undefined,
				bcc: input.bcc?.trim() || undefined,
				subject,
				content,
				draftId: input.draftId?.trim() || undefined,
				attachmentPaths: attachmentPaths.length > 0 ? attachmentPaths : undefined,
			});
			const draft = result.draft;
			await afterDraftSaved(
				draft,
				{ openInCompose: input.openInCompose },
				{
					refreshEmailUi: this.ui.refreshEmailUi ?? refreshEmailUi,
					openComposeWithDraft: this.ui.openComposeWithDraft,
				},
			);
			const remoteLine = result.remoteError
				? `\nremoteError: ${result.remoteError} (local draft kept)`
				: result.remote
					? `\nremoteFolder: ${result.remote.folder}`
						+ (result.remote.uid !== undefined ? `\nremoteUid: ${result.remote.uid}` : '')
					: '';
			const attachMeta = (draft.attachments || []).map(a =>
				`- ${a.filename} (${a.contentType}, ${a.size} bytes, id=${a.id})`
			);
			const attachLine = attachMeta.length > 0
				? `\nattachments:\n${attachMeta.join('\n')}`
				: '';
			return textResult(
				`Draft saved (not sent). Review it in the Email dashboard Drafts pane`
				+ (input.openInCompose === false ? '' : ' (compose opened when available)')
				+ `.\nid: ${draft.id}\naccountId: ${draft.accountId}\nto: ${draft.to}`
				+ `\nsubject: ${draft.subject}\nstatus: ${draft.status}\nversion: ${draft.version}`
				+ attachLine
				+ remoteLine,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error saving draft: ${message}`);
		}
	}
}

/**
 * Register LM tools for Safe Appeals Email (draft + read/organize; no send).
 */
export function registerAgentTools(
	context: vscode.ExtensionContext,
	getEngine: () => SyncEngine | undefined,
	getAccounts: () => AccountStore | undefined,
	getIndex: () => EmailIndex | undefined,
	uiHooks: AgentToolUiHooks = {},
): void {
	const ui: AgentToolUiHooks = {
		refreshEmailUi: uiHooks.refreshEmailUi ?? refreshEmailUi,
		openComposeWithDraft: uiHooks.openComposeWithDraft,
	};

	context.subscriptions.push(
		vscode.lm.registerTool(SAFEAPPEALS_EMAIL_SEARCH_TOOL, new EmailSearchTool(getIndex)),
		vscode.lm.registerTool(SAFEAPPEALS_EMAIL_LIST_THREADS_TOOL, new EmailListThreadsTool(getEngine)),
		vscode.lm.registerTool(SAFEAPPEALS_EMAIL_GET_MESSAGE_TOOL, new EmailGetMessageTool(getEngine)),
		vscode.lm.registerTool(SAFEAPPEALS_EMAIL_LIST_ACCOUNTS_TOOL, new EmailListAccountsTool(getAccounts)),
		vscode.lm.registerTool(
			SAFEAPPEALS_EMAIL_LIST_FOLDERS_TOOL,
			new EmailListFoldersTool(getEngine, getAccounts),
		),
		vscode.lm.registerTool(SAFEAPPEALS_EMAIL_LIST_TAGS_TOOL, new EmailListTagsTool(getIndex)),
		vscode.lm.registerTool(
			SAFEAPPEALS_EMAIL_TAG_THREAD_TOOL,
			new EmailTagThreadTool(getEngine, getIndex, ui),
		),
		vscode.lm.registerTool(
			SAFEAPPEALS_EMAIL_UNTAG_THREAD_TOOL,
			new EmailUntagThreadTool(getEngine, getIndex, ui),
		),
		vscode.lm.registerTool(
			SAFEAPPEALS_EMAIL_DELETE_TAG_TOOL,
			new EmailDeleteTagTool(getIndex, ui),
		),
		vscode.lm.registerTool(
			SAFEAPPEALS_EMAIL_HIDE_THREAD_TOOL,
			new EmailHideThreadTool(getEngine, getIndex, ui),
		),
		vscode.lm.registerTool(
			SAFEAPPEALS_EMAIL_UNHIDE_THREAD_TOOL,
			new EmailUnhideThreadTool(getEngine, getIndex, ui),
		),
		vscode.lm.registerTool(
			SAFEAPPEALS_EMAIL_LINK_THREAD_TO_CASE_TOOL,
			new EmailLinkThreadToCaseTool(getEngine, getIndex, ui),
		),
		vscode.lm.registerTool(
			SAFEAPPEALS_EMAIL_UNLINK_THREAD_FROM_CASE_TOOL,
			new EmailUnlinkThreadFromCaseTool(getEngine, getIndex, ui),
		),
		vscode.lm.registerTool(
			SAFEAPPEALS_EMAIL_CREATE_DRAFT_TOOL,
			new EmailCreateDraftTool(getEngine, getAccounts, ui),
		),
	);
}
