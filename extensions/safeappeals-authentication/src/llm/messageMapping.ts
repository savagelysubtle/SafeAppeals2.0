/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * OpenAI-style chat message produced for POST /llm/chat.
 */
export interface CloudChatMessage {
	readonly role: 'user' | 'assistant' | 'system';
	readonly content: string;
}

/**
 * Duck-typed {@link vscode.LanguageModelChatRequestMessage} so this module stays vscode-free.
 */
export interface ChatRequestMessageLike {
	readonly role: number;
	readonly content: ReadonlyArray<unknown>;
	readonly name?: string;
}

/** Mirrors vscode.LanguageModelChatMessageRole.User */
const ROLE_USER = 1;
/** Mirrors vscode.LanguageModelChatMessageRole.Assistant */
const ROLE_ASSISTANT = 2;

/**
 * Maps LanguageModelChat request messages to cloud `{ role, content }` messages.
 * Concatenates text parts, stringifies tool-result parts, drops image data parts.
 */
export function mapChatMessages(messages: ReadonlyArray<ChatRequestMessageLike>): CloudChatMessage[] {
	const result: CloudChatMessage[] = [];
	for (const message of messages) {
		const content = flattenContent(message.content);
		if (!content) {
			continue;
		}
		result.push({
			role: roleToCloud(message.role),
			content,
		});
	}
	return result;
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

function roleToCloud(role: number): 'user' | 'assistant' {
	switch (role) {
		case ROLE_ASSISTANT:
			return 'assistant';
		case ROLE_USER:
		default:
			return 'user';
	}
}

function flattenContent(parts: ReadonlyArray<unknown>): string {
	const chunks: string[] = [];
	for (const part of parts) {
		if (typeof part === 'string') {
			chunks.push(part);
			continue;
		}
		const record = asRecord(part);
		if (!record) {
			continue;
		}
		// LanguageModelDataPart — drop images; ignore other binary parts for Ask-mode.
		if (typeof record.mimeType === 'string') {
			continue;
		}
		// LanguageModelToolResultPart — stringify for the model.
		if (typeof record.callId === 'string' && Array.isArray(record.content)) {
			chunks.push(stringifyToolResult(record));
			continue;
		}
		// LanguageModelToolCallPart — stringify so history is not silently dropped.
		if (typeof record.callId === 'string' && typeof record.name === 'string') {
			chunks.push(safeJsonStringify({
				toolCall: record.name,
				callId: record.callId,
				input: record.input,
			}));
			continue;
		}
		// LanguageModelTextPart
		if (typeof record.value === 'string') {
			chunks.push(record.value);
		}
	}
	return chunks.join('');
}

function stringifyToolResult(part: Record<string, unknown>): string {
	const inner = Array.isArray(part.content)
		? part.content.map(item => {
			if (typeof item === 'string') {
				return item;
			}
			const rec = asRecord(item);
			if (rec && typeof rec.value === 'string') {
				return rec.value;
			}
			return safeJsonStringify(item);
		}).join('')
		: '';
	return safeJsonStringify({
		toolResult: part.callId,
		content: inner,
	});
}

function safeJsonStringify(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return '[unserializable]';
	}
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return undefined;
}
