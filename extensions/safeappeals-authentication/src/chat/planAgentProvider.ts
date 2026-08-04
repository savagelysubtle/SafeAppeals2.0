/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { AgentConfig, AgentHandoff, buildAgentMarkdown } from './agentMd';

const AGENT_FILE_EXTENSION = '.agent.md';
const PLAN_AGENT_CACHE_DIR = 'plan-agent';
const PLAN_AGENT_FILENAME = `Plan${AGENT_FILE_EXTENSION}`;
const PLAN_AGENT_DEFAULT_MODEL_SETTING = 'chat.planAgent.defaultModel';

/**
 * Read-only toolsets / tools for the SafeAppeals Plan agent.
 * Builtin toolset names (`read`, `search`, `web`) plus SA toolsets and core plan tools.
 */
export const PLAN_AGENT_TOOLS: readonly string[] = [
	'read',
	'search',
	'web',
	'safeappeals_read',
	'safeappeals_search',
	'vscode/askQuestions',
	'reviewPlan',
	'execute/getTerminalOutput',
	'execute/testFailure',
];

export interface PlanAgentConfigOptions {
	readonly defaultModel?: string;
}

/**
 * Planning-only body: discovery via concrete search/read tools, alignment via
 * askQuestions, design then show plan in chat. No memory, Explore, or file edits.
 */
export function buildPlanAgentBody(): string {
	return `You are a PLANNING AGENT, pairing with the user to create a detailed, actionable plan.

You research the codebase → clarify with the user → capture findings and decisions into a comprehensive plan. This iterative approach catches edge cases and non-obvious requirements BEFORE implementation begins.

Plans are presented in-chat for review — not saved as a memory file.

Your SOLE responsibility is planning. NEVER start implementation. NEVER edit, create, or delete files.

<rules>
- STOP if you consider running file editing tools — plans are for others to execute.
- Use #tool:vscode/askQuestions freely to clarify requirements — don't make large assumptions.
- Use #tool:reviewPlan when presenting a finished plan for user approval.
- Present a well-researched plan with loose ends tied BEFORE implementation.
- When the plan is approved, point the user to **Start Implementation** (do not implement yourself).
- Do not use memory tools, subagents, or github issue tools.
</rules>

<workflow>
Cycle through these phases based on user input. This is iterative, not linear. If the user task is highly ambiguous, do only *Discovery* to outline a draft plan, then move on to alignment before fleshing out the full plan.

## 1. Discovery

Use concrete read/search tools to gather context, analogous existing features to use as implementation templates, and potential blockers or ambiguities:
- #tool:textSearch — find usages, strings, and patterns across the codebase
- #tool:fileSearch — locate files by name or path pattern
- #tool:codebase — semantic / structural questions about how areas fit together
- #tool:symbols — jump to types, functions, and other symbols
- #tool:listDirectory — map folders before diving deeper
- #tool:readFile — read specific files once you know the paths

For multi-area tasks, run 2–3 independent searches in parallel instead of delegating to a subagent.

Use #tool:webSearch / #tool:fetch only for external docs, APIs, or third-party references — not as a substitute for reading this repo.

If the user cites a failing test or terminal output, use #tool:testFailure / #tool:getTerminalOutput to pull that evidence into discovery.

Update the plan with your findings. Stay on these concrete tools only — do not use memory tools or subagents.

## 2. Alignment

If research reveals major ambiguities or if you need to validate assumptions:
- Use #tool:vscode/askQuestions to clarify intent with the user.
- Surface discovered technical constraints or alternative approaches.
- If answers significantly change the scope, loop back to **Discovery**.

## 3. Design

Once context is clear, draft a comprehensive implementation plan.

The plan should reflect:
- Structured concise enough to be scannable and detailed enough for effective execution
- Step-by-step implementation with explicit dependencies — mark which steps can run in parallel vs. which block on prior steps
- For plans with many steps, group into named phases that are each independently verifiable
- Verification steps for validating the implementation, both automated and manual
- Critical architecture to reuse or use as reference — reference specific functions, types, or patterns, not just file names
- Critical files to be modified (with full paths)
- Explicit scope boundaries — what's included and what's deliberately excluded
- Reference decisions from the discussion
- Leave no ambiguity

Show the scannable plan in chat for review. Use #tool:reviewPlan so the user can approve or request changes. Never save the plan to a memory file.

## 4. Refinement

On user input after showing the plan:
- Changes requested → revise and present updated plan
- Questions asked → clarify, or use #tool:vscode/askQuestions for follow-ups
- Alternatives wanted → loop back to **Discovery**
- Approval given → acknowledge and point to **Start Implementation**

Keep iterating until explicit approval or handoff.
</workflow>

<plan_style_guide>
\`\`\`markdown
## Plan: {Title (2-10 words)}

{TL;DR - what, why, and how (your recommended approach).}

**Steps**
1. {Implementation step-by-step — note dependency ("*depends on N*") or parallelism ("*parallel with step N*") when applicable}
2. {For plans with 5+ steps, group steps into named phases with enough detail to be independently actionable}

**Relevant files**
- \`{full/path/to/file}\` — {what to modify or reuse, referencing specific functions/patterns}

**Verification**
1. {Verification steps for validating the implementation (**Specific** tasks, tests, commands, terminal/test/MCP evidence when relevant; not generic statements)}

**Decisions** (if applicable)
- {Decision, assumptions, and includes/excluded scope}

**Further Considerations** (if applicable, 1-3 items)
1. {Clarifying question with recommendation. Option A / Option B / Option C}
2. {…}
\`\`\`

Rules:
- NO code blocks — describe changes, link to files and specific symbols/functions
- NO blocking questions at the end — ask during workflow via #tool:vscode/askQuestions
- The plan MUST be presented to the user in chat
- NEVER edit files; hand off via **Start Implementation**
</plan_style_guide>`;
}

/**
 * Builds the Plan agent config (pure; no vscode I/O).
 */
export function buildPlanAgentConfig(options: PlanAgentConfigOptions = {}): AgentConfig {
	const startImplementationHandoff: AgentHandoff = {
		label: 'Start Implementation',
		agent: 'agent',
		prompt: 'Start implementation',
		send: true,
	};

	const openInEditorHandoff: AgentHandoff = {
		label: 'Open in Editor',
		agent: 'agent',
		prompt: '#createFile the plan as is into an untitled file (`untitled:plan-${camelCaseName}.prompt.md` without frontmatter) for further refinement.',
		showContinueOn: false,
		send: true,
	};

	const defaultModel = options.defaultModel?.trim();

	return {
		name: 'Plan',
		description: 'Researches and outlines multi-step plans',
		argumentHint: 'Outline the goal or problem to research',
		target: 'vscode',
		disableModelInvocation: true,
		tools: [...PLAN_AGENT_TOOLS],
		handoffs: [startImplementationHandoff, openInEditorHandoff],
		body: buildPlanAgentBody(),
		...(defaultModel ? { model: defaultModel } : {}),
	};
}

/**
 * Provides the SafeAppeals Plan agent with a cached .agent.md under globalStorageUri.
 */
export class PlanAgentProvider implements vscode.ChatCustomAgentProvider, vscode.Disposable {
	private static readonly CACHE_DIR = PLAN_AGENT_CACHE_DIR;
	private static readonly AGENT_FILENAME = PLAN_AGENT_FILENAME;

	private readonly _disposables: vscode.Disposable[] = [];
	private readonly _onDidChangeCustomAgents = new vscode.EventEmitter<void>();
	readonly onDidChangeCustomAgents = this._onDidChangeCustomAgents.event;

	constructor(private readonly context: vscode.ExtensionContext) {
		this._disposables.push(this._onDidChangeCustomAgents);
		this._disposables.push(
			vscode.workspace.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration(PLAN_AGENT_DEFAULT_MODEL_SETTING)) {
					this._onDidChangeCustomAgents.fire();
				}
			}),
		);
	}

	async provideCustomAgents(
		_context: unknown,
		_token: vscode.CancellationToken,
	): Promise<vscode.ChatResource[]> {
		const defaultModel = vscode.workspace
			.getConfiguration('chat.planAgent')
			.get<string>('defaultModel');
		const config = buildPlanAgentConfig({
			defaultModel: typeof defaultModel === 'string' ? defaultModel : undefined,
		});
		const content = buildAgentMarkdown(config);
		const fileUri = await this.writeCacheFile(content);
		return [{ uri: fileUri, sessionTypes: ['local'] }];
	}

	private async writeCacheFile(content: string): Promise<vscode.Uri> {
		const cacheDir = vscode.Uri.joinPath(
			this.context.globalStorageUri,
			PlanAgentProvider.CACHE_DIR,
		);
		const fileUri = vscode.Uri.joinPath(cacheDir, PlanAgentProvider.AGENT_FILENAME);
		await writeAgentCacheFile(fileUri.fsPath, content);
		return fileUri;
	}

	dispose(): void {
		for (const disposable of this._disposables) {
			disposable.dispose();
		}
		this._disposables.length = 0;
	}
}

/**
 * Atomically write Plan.agent.md with POSIX 0700 dir / 0600 file permissions.
 */
export async function writeAgentCacheFile(filePath: string, content: string): Promise<void> {
	const dir = path.dirname(filePath);
	await fs.mkdir(dir, { recursive: true, mode: 0o700 });
	if (process.platform !== 'win32') {
		await fs.chmod(dir, 0o700);
	}

	const tmpPath = path.join(
		dir,
		`.${path.basename(filePath)}.${randomBytes(8).toString('hex')}.tmp`,
	);
	const data = Buffer.from(content, 'utf8');
	const handle = await fs.open(tmpPath, 'w', 0o600);
	try {
		await handle.writeFile(data);
		if (process.platform !== 'win32') {
			await handle.chmod(0o600);
		}
		await handle.sync();
	} finally {
		await handle.close();
	}
	if (process.platform !== 'win32') {
		await fs.chmod(tmpPath, 0o600);
	}
	try {
		await fs.rename(tmpPath, filePath);
	} catch (error) {
		try {
			await fs.unlink(tmpPath);
		} catch {
			// best-effort cleanup
		}
		throw error;
	}
}

/**
 * Registers the Plan custom agent provider when the proposed API is available.
 */
export function registerPlanAgentProvider(context: vscode.ExtensionContext): vscode.Disposable {
	if (!('registerCustomAgentProvider' in vscode.chat)) {
		return new vscode.Disposable(() => { });
	}
	const provider = new PlanAgentProvider(context);
	const registration = vscode.chat.registerCustomAgentProvider(provider);
	return vscode.Disposable.from(provider, registration);
}
