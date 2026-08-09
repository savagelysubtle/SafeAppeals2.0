/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Handoff configuration for agent transitions (e.g., Plan → Agent).
 */
export interface AgentHandoff {
	readonly label: string;
	readonly agent: string;
	readonly prompt: string;
	readonly send?: boolean;
	readonly showContinueOn?: boolean;
	readonly model?: string;
}

/**
 * Agent configuration for building .agent.md content.
 */
export interface AgentConfig {
	readonly name: string;
	readonly description: string;
	readonly argumentHint: string;
	readonly tools: string[];
	readonly model?: string | readonly string[];
	readonly target?: string;
	readonly disableModelInvocation?: boolean;
	readonly userInvocable?: boolean;
	readonly agents?: string[];
	readonly handoffs?: AgentHandoff[];
	readonly body: string;
}

/**
 * Builds .agent.md content from a configuration object using string formatting.
 * No YAML library required — generates valid YAML frontmatter via string templates.
 */
export function buildAgentMarkdown(config: AgentConfig): string {
	const lines: string[] = ['---'];

	lines.push(`name: ${config.name}`);
	lines.push(`description: ${config.description}`);
	lines.push(`argument-hint: ${config.argumentHint}`);

	if (config.model) {
		if (Array.isArray(config.model)) {
			const quoted = config.model.map(m => `'${m.replace(/'/g, '\'\'')}'`).join(', ');
			lines.push(`model: [${quoted}]`);
		} else {
			lines.push(`model: ${config.model}`);
		}
	}
	if (config.target) {
		lines.push(`target: ${config.target}`);
	}
	if (config.disableModelInvocation) {
		lines.push(`disable-model-invocation: true`);
	}
	if (config.userInvocable === false) {
		lines.push(`user-invocable: false`);
	}

	if (config.tools.length > 0) {
		const quotedTools = config.tools.map(t => `'${t.replace(/'/g, '\'\'')}'`).join(', ');
		lines.push(`tools: [${quotedTools}]`);
	}

	if (config.agents) {
		const quotedAgents = config.agents.map(a => `'${a.replace(/'/g, '\'\'')}'`).join(', ');
		lines.push(`agents: [${quotedAgents}]`);
	}

	if (config.handoffs && config.handoffs.length > 0) {
		lines.push('handoffs:');
		for (const handoff of config.handoffs) {
			lines.push(`  - label: ${handoff.label}`);
			lines.push(`    agent: ${handoff.agent}`);
			lines.push(`    prompt: '${handoff.prompt.replace(/'/g, '\'\'')}'`);
			if (handoff.send !== undefined) {
				lines.push(`    send: ${handoff.send}`);
			}
			if (handoff.showContinueOn !== undefined) {
				lines.push(`    showContinueOn: ${handoff.showContinueOn}`);
			}
			if (handoff.model !== undefined) {
				lines.push(`    model: ${handoff.model}`);
			}
		}
	}

	lines.push('---');
	lines.push(config.body);

	return lines.join('\n');
}