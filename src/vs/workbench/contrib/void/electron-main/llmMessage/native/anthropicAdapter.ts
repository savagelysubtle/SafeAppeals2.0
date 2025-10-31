/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import Anthropic from '@anthropic-ai/sdk'
import { BaseToolAdapter } from './toolAdapter.js'
import { InternalToolInfo } from '../../../common/prompt/prompts.js'
import { RawToolCallObj, RawToolParamsObj } from '../../../common/sendLLMMessageTypes.js'
import { ToolName, ToolParamName } from '../../../common/toolsServiceTypes.js'

/**
 * Anthropic Native Tool Adapter
 *
 * Converts between Void's internal tool format and Anthropic's native tool calling format.
 * Anthropic uses JSON Schema with input_schema and tool_use blocks.
 */
export class AnthropicNativeAdapter extends BaseToolAdapter {
	/**
	 * Convert Void's internal tool definitions to Anthropic's native schema
	 *
	 * Anthropic format:
	 * {
	 *   name: string,
	 *   description: string,
	 *   input_schema: {
	 *     type: 'object',
	 *     properties: { [paramName]: { type: 'string', description: string } },
	 *     required?: string[]
	 *   }
	 * }
	 */
	convertToNativeSchema(tools: InternalToolInfo[]): Anthropic.Messages.ToolUnion[] {
		return tools.map(tool => {
			const paramsWithType: { [s: string]: { description: string; type: 'string' } } = {}
			for (const key in tool.params) {
				paramsWithType[key] = {
					...tool.params[key],
					type: 'string' // Anthropic currently requires all params to be strings
				}
			}

			const required = this.getRequiredParams(tool)

			return {
				name: tool.name,
				description: tool.description,
				input_schema: {
					type: 'object',
					properties: paramsWithType,
					...(required.length > 0 ? { required } : {})
				}
			} satisfies Anthropic.Messages.Tool
		})
	}

	/**
	 * Parse a completed Anthropic tool call response
	 *
	 * Anthropic returns tool calls as ToolUseBlock objects in response.content:
	 * {
	 *   type: 'tool_use',
	 *   id: string,
	 *   name: string,
	 *   input: { [paramName]: value }
	 * }
	 */
	parseNativeToolCall(response: any): RawToolCallObj | null {
		// Anthropic returns tool calls in response.content array
		const toolUseBlocks = Array.isArray(response.content)
			? response.content.filter((c: any) => c.type === 'tool_use')
			: []

		if (toolUseBlocks.length === 0) {
			return null
		}

		// Anthropic supports sequential tool calls, but we'll take the first one
		// Multiple tool calls would need to be handled by the caller
		const toolBlock = toolUseBlocks[0] as Anthropic.Messages.ToolUseBlock
		const { id, name, input } = toolBlock

		if (input === null || typeof input !== 'object') {
			return null
		}

		const rawParams: RawToolParamsObj = input
		return {
			id,
			name: name as ToolName,
			rawParams,
			doneParams: Object.keys(rawParams) as ToolParamName<ToolName>[],
			isDone: true
		}
	}

	/**
	 * Parse streaming chunks from Anthropic
	 *
	 * Anthropic streaming events:
	 * - content_block_start with type: 'tool_use' - contains tool name and id
	 * - content_block_delta with type: 'input_json_delta' - contains partial JSON string
	 *
	 * Note: Anthropic streams tool calls as partial JSON strings that need to be accumulated
	 */
	streamToolCall(chunk: any): Partial<RawToolCallObj> | null {
		// Handle content_block_start events
		if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
			const toolBlock = chunk.content_block as Anthropic.Messages.ToolUseBlockParam
			return {
				name: toolBlock.name as ToolName,
				id: toolBlock.id,
				rawParams: {}
			}
		}

		// Handle content_block_delta events for tool parameters
		if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'input_json_delta') {
			// Anthropic sends partial JSON as a string that needs to be accumulated
			// The caller is responsible for accumulating these and parsing when complete
			const partialJson = chunk.delta.partial_json || ''

			// Try to parse if we have complete JSON (ends with closing brace)
			// Otherwise return the partial string for accumulation
			if (partialJson.trim().endsWith('}')) {
				try {
					const parsed = JSON.parse(partialJson)
					return {
						rawParams: parsed as RawToolParamsObj
					}
				} catch {
					// Partial JSON - return null to signal caller should accumulate
					return null
				}
			}

			// Return null to signal this is partial data that needs accumulation
			return null
		}

		return null
	}
}

