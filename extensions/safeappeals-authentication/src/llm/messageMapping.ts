/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * OpenAI-style function tool descriptor for POST /llm/chat.
 */
export interface CloudChatTool {
	readonly type: 'function';
	readonly function: {
		readonly name: string;
		readonly description?: string;
		readonly parameters?: object;
	};
}

/**
 * OpenAI-style tool call on an assistant message.
 */
export interface CloudToolCall {
	readonly id: string;
	readonly type: 'function';
	readonly function: {
		readonly name: string;
		readonly arguments: string;
	};
}

/**
 * OpenAI-style chat message produced for POST /llm/chat.
 */
export interface CloudChatMessage {
	readonly role: 'user' | 'assistant' | 'system' | 'tool';
	readonly content?: string | null;
	readonly tool_calls?: readonly CloudToolCall[];
	readonly tool_call_id?: string;
}

/**
 * Duck-typed {@link vscode.LanguageModelChatRequestMessage} so this module stays vscode-free.
 */
export interface ChatRequestMessageLike {
	readonly role: number;
	readonly content: ReadonlyArray<unknown>;
	readonly name?: string;
}

/**
 * Duck-typed {@link vscode.LanguageModelChatTool}.
 */
export interface ChatToolLike {
	readonly name: string;
	readonly description: string;
	readonly inputSchema?: object;
}

/** Mirrors vscode.LanguageModelChatMessageRole.User */
const ROLE_USER = 1;
/** Mirrors vscode.LanguageModelChatMessageRole.Assistant */
const ROLE_ASSISTANT = 2;
/** Mirrors vscode.LanguageModelChatToolMode.Required */
const TOOL_MODE_REQUIRED = 2;

/**
 * Maps LanguageModelChat request messages to cloud OpenAI-style messages.
 *
 * - Text parts → `content`
 * - {@link vscode.LanguageModelToolCallPart} → assistant `tool_calls`
 * - {@link vscode.LanguageModelToolResultPart} → `role: "tool"` with `tool_call_id`
 * - Image data parts are dropped
 */
export function mapChatMessages(messages: ReadonlyArray<ChatRequestMessageLike>): CloudChatMessage[] {
	const result: CloudChatMessage[] = [];
	for (const message of messages) {
		result.push(...mapOneMessage(message));
	}
	return result;
}

/**
 * Maps host LM tools to OpenAI `tools` entries.
 */
export function mapTools(tools: ReadonlyArray<ChatToolLike>): CloudChatTool[] {
	return tools.map(tool => {
		const fn: CloudChatTool['function'] = {
			name: tool.name,
			description: tool.description,
		};
		if (tool.inputSchema !== undefined) {
			return {
				type: 'function' as const,
				function: { ...fn, parameters: tool.inputSchema },
			};
		}
		return { type: 'function' as const, function: fn };
	});
}

/**
 * Maps {@link vscode.LanguageModelChatToolMode} to OpenAI `tool_choice`.
 */
export function mapToolChoice(toolMode: number): 'auto' | 'required' {
	return toolMode === TOOL_MODE_REQUIRED ? 'required' : 'auto';
}

/**
 * Rough token estimate used for provideTokenCount (≈ ceil(len/4)).
 * Server 402 is authoritative for billing — this is UI-only.
 */
export function estimateTokens(text: string): number {
	if (!text) {
		return 0;
	}
	return Math.ceil(text.length / 4);
}

/**
 * Token estimate for mapped cloud messages (content + tool payloads).
 */
export function estimateMappedMessagesTokens(messages: ReadonlyArray<CloudChatMessage>): number {
	const chunks: string[] = [];
	for (const message of messages) {
		if (typeof message.content === 'string') {
			chunks.push(message.content);
		}
		if (message.tool_call_id) {
			chunks.push(message.tool_call_id);
		}
		if (message.tool_calls) {
			for (const call of message.tool_calls) {
				chunks.push(call.id, call.function.name, call.function.arguments);
			}
		}
	}
	return estimateTokens(chunks.join(''));
}

function mapOneMessage(message: ChatRequestMessageLike): CloudChatMessage[] {
	const textChunks: string[] = [];
	const toolCalls: CloudToolCall[] = [];
	const toolResults: CloudChatMessage[] = [];

	for (const part of message.content) {
		if (typeof part === 'string') {
			textChunks.push(part);
			continue;
		}
		const record = asRecord(part);
		if (!record) {
			continue;
		}
		// LanguageModelDataPart — drop images; ignore other binary parts.
		if (typeof record.mimeType === 'string') {
			continue;
		}
		// LanguageModelToolResultPart — becomes role:"tool" (OpenAI), not user text.
		if (typeof record.callId === 'string' && Array.isArray(record.content)) {
			toolResults.push({
				role: 'tool',
				tool_call_id: record.callId,
				content: flattenToolResultContent(record.content),
			});
			continue;
		}
		// LanguageModelToolCallPart — assistant tool_calls.
		if (typeof record.callId === 'string' && typeof record.name === 'string') {
			toolCalls.push({
				id: record.callId,
				type: 'function',
				function: {
					name: record.name,
					arguments: safeJsonStringify(record.input ?? {}),
				},
			});
			continue;
		}
		// LanguageModelTextPart
		if (typeof record.value === 'string') {
			textChunks.push(record.value);
		}
	}

	const out: CloudChatMessage[] = [];
	const text = textChunks.join('');

	if (toolCalls.length > 0) {
		// Assistant tool_use turn: content + tool_calls first (OpenAI / Anthropic).
		out.push({
			role: 'assistant',
			content: text.length > 0 ? text : null,
			tool_calls: toolCalls,
		});
		out.push(...toolResults);
		return out;
	}

	// Tool results must precede any following user text so Anthropic-via-LiteLLM
	// sees tool_result immediately after the prior assistant tool_use.
	out.push(...toolResults);
	if (text.length > 0) {
		out.push({
			role: roleToCloud(message.role),
			content: text,
		});
	}
	return out;
}

function roleToCloud(role: number): 'user' | 'assistant' {
	switch (role) {
		case ROLE_ASSISTANT:
			return 'assistant';
		case ROLE_USER:
		default:
			return 'user';
	}
}

function flattenToolResultContent(content: ReadonlyArray<unknown>): string {
	return content.map(item => {
		if (typeof item === 'string') {
			return item;
		}
		const rec = asRecord(item);
		if (rec && typeof rec.value === 'string') {
			return rec.value;
		}
		return safeJsonStringify(item);
	}).join('');
}

function safeJsonStringify(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return '{}';
	}
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return undefined;
}
