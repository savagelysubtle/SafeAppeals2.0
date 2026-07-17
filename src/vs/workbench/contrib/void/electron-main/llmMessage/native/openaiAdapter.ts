/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import OpenAI from 'openai'
import { InternalToolInfo } from '../../../common/prompt/prompts.js'
import { RawToolCallObj, RawToolParamsObj, SingleToolCall } from '../../../common/sendLLMMessageTypes.js'
import { ToolName, ToolParamName } from '../../../common/tools/toolsServiceTypes.js'
import { BaseToolAdapter } from './toolAdapter.js'

/**
 * OpenAI Native Tool Adapter
 *
 * Converts between Void's internal tool format and OpenAI's native tool calling format.
 * OpenAI uses function calling with tools array and tool_calls in responses.
 * This adapter also works for OpenAI-compatible providers (Gemini, Mistral, Groq, etc.)
 */
export class OpenAINativeAdapter extends BaseToolAdapter {
	/**
	 * Convert Void's internal tool definitions to OpenAI's native schema
	 *
	 * OpenAI format:
	 * {
	 *   type: 'function',
	 *   function: {
	 *     name: string,
	 *     description: string,
	 *     parameters: {
	 *       type: 'object',
	 *       properties: { [paramName]: { type: string, description: string } },
	 *       required?: string[]
	 *     }
	 *   }
	 * }
	 */
	convertToNativeSchema(tools: InternalToolInfo[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
		return tools.map(tool => {
			const properties: { [key: string]: { type: string; description: string } } = {}

			for (const [paramName, param] of Object.entries(tool.params)) {
				properties[paramName] = {
					type: this.inferType(param),
					description: param.description || ''
				}
			}

			const required = this.getRequiredParams(tool)

			return {
				type: 'function',
				function: {
					name: tool.name,
					description: tool.description,
					parameters: {
						type: 'object',
						properties,
						...(required.length > 0 ? { required } : {})
					}
				}
			} satisfies OpenAI.Chat.Completions.ChatCompletionTool
		})
	}

	/**
	 * Parse a completed OpenAI tool call response
	 *
	 * OpenAI returns tool calls in response.choices[0].message.tool_calls:
	 * [{
	 *   id: string,
	 *   type: 'function',
	 *   function: {
	 *     name: string,
	 *     arguments: string (JSON string)
	 *   }
	 * }]
	 */
	parseNativeToolCall(response: any): RawToolCallObj | null {
		// Handle different response formats
		const toolCalls = response.choices?.[0]?.message?.tool_calls ||
			response.tool_calls ||
			[]

		if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
			return null
		}

		// OpenAI supports parallel tool calls, but we'll take the first one
		// Multiple tool calls would need to be handled by the caller
		const toolCall = toolCalls[0] as OpenAI.Chat.Completions.ChatCompletionMessageToolCall

		if (toolCall.type !== 'function' || !toolCall.function) {
			return null
		}

		const { id, function: func } = toolCall
		const { name, arguments: argsStr } = func

		if (!argsStr) {
			return null
		}

		// Parse JSON arguments
		let input: unknown
		try {
			input = JSON.parse(argsStr)
		} catch (e) {
			console.error('[OpenAINativeAdapter] Failed to parse tool arguments:', e)
			return null
		}

		if (input === null || typeof input !== 'object') {
			return null
		}

		const rawParams: RawToolParamsObj = input as RawToolParamsObj
		return {
			id,
			name: name as ToolName,
			rawParams,
			doneParams: Object.keys(rawParams) as ToolParamName<ToolName>[],
			isDone: true
		}
	}

	/**
	 * Parse streaming chunks from OpenAI
	 *
	 * OpenAI streaming chunks:
	 * - chunk.choices[0].delta.tool_calls - array of tool call deltas
	 *   Each delta contains:
	 *   - index: number (0 for first tool call)
	 *   - id?: string (in first chunk)
	 *   - function?: { name?: string, arguments?: string }
	 *
	 * Note: OpenAI streams tool calls as partial JSON strings that need to be accumulated
	 */
	streamToolCall(chunk: any): Partial<RawToolCallObj> | null {
		const toolCalls = chunk.choices?.[0]?.delta?.tool_calls

		if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
			return null
		}

		// Focus on the first tool call (index 0)
		const toolDelta = toolCalls.find((tc: any) => tc.index === 0) || toolCalls[0]

		if (!toolDelta) {
			return null
		}

		const result: Partial<SingleToolCall> = {}

		// Tool ID is provided in the first chunk
		if (toolDelta.id) {
			result.id = toolDelta.id
		}

		// Function name is provided in the first chunk
		if (toolDelta.function?.name) {
			result.name = toolDelta.function.name as ToolName
		}

		// Arguments are streamed as partial JSON strings
		if (toolDelta.function?.arguments) {
			const partialArgs = toolDelta.function.arguments

			// Try to parse if we have complete JSON (ends with closing brace)
			// Otherwise return null to signal caller should accumulate
			if (partialArgs.trim().endsWith('}')) {
				try {
					const parsed = JSON.parse(partialArgs)
					result.rawParams = parsed as RawToolParamsObj
					result.doneParams = Object.keys(parsed) as ToolParamName<ToolName>[]
				} catch {
					// Partial JSON - return null to signal caller should accumulate
					return null
				}
			} else {
				// Partial JSON - return null to signal caller should accumulate
				// The caller is responsible for accumulating these strings
				return null
			}
		}

		// Return result if we have any data
		return Object.keys(result).length > 0 ? result : null
	}
}

