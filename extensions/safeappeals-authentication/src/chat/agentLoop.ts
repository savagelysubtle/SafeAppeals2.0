/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { MAX_AGENT_ITERATIONS, nextAgentLoopDecision } from './agentLoopHelpers';
import { buildModeReminderMessage } from './switchModeHelpers';
import { resolveAllowedInvokeToolName, selectAgentTools } from './toolAllowlist';
import { toLanguageModelChatTools } from './tools';

export interface CollectedResponseParts {
	readonly text: string;
	readonly toolCalls: vscode.LanguageModelToolCallPart[];
}

/**
 * Collects text + tool-call parts from a model response stream while streaming text to the chat UI.
 */
export async function collectResponseParts(
	response: vscode.LanguageModelChatResponse,
	stream: vscode.ChatResponseStream,
	token: vscode.CancellationToken,
): Promise<CollectedResponseParts> {
	const toolCalls: vscode.LanguageModelToolCallPart[] = [];
	let text = '';
	for await (const part of response.stream) {
		if (token.isCancellationRequested) {
			break;
		}
		if (part instanceof vscode.LanguageModelTextPart) {
			if (part.value) {
				text += part.value;
				stream.markdown(part.value);
			}
		} else if (part instanceof vscode.LanguageModelToolCallPart) {
			toolCalls.push(part);
		}
	}
	return { text, toolCalls };
}

/**
 * Builds LanguageModelChat messages from prior turns for this participant.
 */
export function messagesFromHistory(history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>): vscode.LanguageModelChatMessage[] {
	const messages: vscode.LanguageModelChatMessage[] = [];
	for (const turn of history) {
		if (turn instanceof vscode.ChatRequestTurn) {
			messages.push(vscode.LanguageModelChatMessage.User(turn.prompt));
		} else if (turn instanceof vscode.ChatResponseTurn) {
			const text = turn.response
				.filter((part): part is vscode.ChatResponseMarkdownPart => part instanceof vscode.ChatResponseMarkdownPart)
				.map(part => typeof part.value === 'string' ? part.value : part.value.value)
				.join('');
			if (text) {
				messages.push(vscode.LanguageModelChatMessage.Assistant(text));
			}
		}
	}
	return messages;
}

/**
 * Converts a tool result into content parts suitable for a LanguageModelToolResultPart.
 */
export function toolResultContentParts(
	result: vscode.LanguageModelToolResult,
): Array<vscode.LanguageModelTextPart | vscode.LanguageModelPromptTsxPart | vscode.LanguageModelDataPart> {
	const parts: Array<vscode.LanguageModelTextPart | vscode.LanguageModelPromptTsxPart | vscode.LanguageModelDataPart> = [];
	for (const part of result.content) {
		if (
			part instanceof vscode.LanguageModelTextPart
			|| part instanceof vscode.LanguageModelPromptTsxPart
			|| part instanceof vscode.LanguageModelDataPart
		) {
			parts.push(part);
		}
	}
	if (parts.length === 0) {
		parts.push(new vscode.LanguageModelTextPart('(empty tool result)'));
	}
	return parts;
}

export interface AgentLoopOptions {
	readonly request: vscode.ChatRequest;
	readonly context: vscode.ChatContext;
	readonly stream: vscode.ChatResponseStream;
	readonly token: vscode.CancellationToken;
	readonly maxIterations?: number;
	readonly invokeTool?: typeof vscode.lm.invokeTool;
	readonly listTools?: () => readonly vscode.LanguageModelToolInformation[];
}

/**
 * Agent tool loop: send via request.model with tools → invoke tools → append results → repeat.
 */
export async function runAgentLoop(options: AgentLoopOptions): Promise<vscode.ChatResult> {
	const {
		request,
		context,
		stream,
		token,
		maxIterations = MAX_AGENT_ITERATIONS,
		invokeTool = (name, invokeOptions, invokeToken) => vscode.lm.invokeTool(name, invokeOptions, invokeToken),
		listTools = () => vscode.lm.tools,
	} = options;

	const selectedTools = selectAgentTools({
		pool: listTools(),
		requestTools: request.tools,
	});
	const selectedToolNames = new Set(selectedTools.map(tool => tool.name));
	const tools = toLanguageModelChatTools(selectedTools);
	const messages = messagesFromHistory(context.history);
	const modeInstructions = request.modeInstructions2;
	messages.push(vscode.LanguageModelChatMessage.User(buildModeReminderMessage({
		modeName: modeInstructions?.name,
		modeContent: modeInstructions?.content,
	})));
	messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

	for (let iteration = 0; ; iteration++) {
		if (token.isCancellationRequested) {
			return {};
		}

		const response = await request.model.sendRequest(
			messages,
			{
				tools: tools.length > 0 ? tools : undefined,
				toolMode: vscode.LanguageModelChatToolMode.Auto,
			},
			token,
		);

		const { text, toolCalls } = await collectResponseParts(response, stream, token);
		const decision = nextAgentLoopDecision({
			iteration: iteration + 1,
			maxIterations,
			toolCallCount: toolCalls.length,
			cancelled: token.isCancellationRequested,
		});

		if (decision.kind === 'stop') {
			if (decision.reason === 'maxIterations' && toolCalls.length > 0) {
				stream.markdown(vscode.l10n.t('\n\n_Stopped after the maximum number of tool rounds._'));
			}
			return {};
		}

		const assistantParts: Array<vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart> = [];
		if (text) {
			assistantParts.push(new vscode.LanguageModelTextPart(text));
		}
		for (const call of toolCalls) {
			assistantParts.push(call);
		}
		messages.push(vscode.LanguageModelChatMessage.Assistant(assistantParts));

		const resultParts: vscode.LanguageModelToolResultPart[] = [];
		for (const call of toolCalls) {
			if (token.isCancellationRequested) {
				return {};
			}
			const invokeName = resolveAllowedInvokeToolName(call.name, selectedToolNames);
			if (invokeName === undefined) {
				resultParts.push(new vscode.LanguageModelToolResultPart(
					call.callId,
					[new vscode.LanguageModelTextPart(`Tool not allowed: ${call.name}`)],
				));
				continue;
			}
			try {
				const toolResult = await invokeTool(invokeName, {
					input: call.input,
					toolInvocationToken: request.toolInvocationToken,
				}, token);
				resultParts.push(new vscode.LanguageModelToolResultPart(call.callId, toolResultContentParts(toolResult)));
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				resultParts.push(new vscode.LanguageModelToolResultPart(
					call.callId,
					[new vscode.LanguageModelTextPart(`Tool error: ${message}`)],
				));
			}
		}
		messages.push(vscode.LanguageModelChatMessage.User(resultParts));
	}
}
