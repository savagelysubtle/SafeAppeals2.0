/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { InternalToolInfo } from '../../../common/prompt/prompts.js'
import { RawToolCallObj } from '../../../common/sendLLMMessageTypes.js'
import { ToolName, ToolParamName } from '../../../common/toolsServiceTypes.js'

/**
 * Native Tool Adapter Interface
 *
 * Adapters convert between Void's internal tool representation
 * and provider-specific native tool calling formats.
 */
export interface NativeToolAdapter {
	/**
	 * Convert Void's internal tool definitions to provider's native schema
	 * @param tools Array of internal tool definitions
	 * @returns Provider-specific tool schema
	 */
	convertToNativeSchema(tools: InternalToolInfo[]): any

	/**
	 * Parse a completed native tool call response into Void's internal format
	 * @param response Provider's response object
	 * @returns Parsed tool call object
	 */
	parseNativeToolCall(response: any): RawToolCallObj | null

	/**
	 * Parse a streaming chunk for tool call data
	 * @param chunk Streaming chunk from provider
	 * @returns Partial tool call data or null if no tool data in chunk
	 */
	streamToolCall(chunk: any): Partial<RawToolCallObj> | null
}

/**
 * Base class with common utility methods for adapters
 */
export abstract class BaseToolAdapter implements NativeToolAdapter {
	abstract convertToNativeSchema(tools: InternalToolInfo[]): any
	abstract parseNativeToolCall(response: any): RawToolCallObj | null
	abstract streamToolCall(chunk: any): Partial<RawToolCallObj> | null

	/**
	 * Infer JSON Schema type from parameter description and definition
	 * This is a heuristic - providers should ideally provide explicit types
	 */
	protected inferType(param: InternalToolInfo['params'][string]): string {
		const description = param.description?.toLowerCase() || ''

		// Check for explicit type hints in description
		if (description.includes('number') || description.includes('integer') || description.includes('count')) {
			return 'number'
		}
		if (description.includes('boolean') || description.includes('true') || description.includes('false')) {
			return 'boolean'
		}
		if (description.includes('array') || description.includes('list')) {
			return 'array'
		}
		if (description.includes('object') || description.includes('json')) {
			return 'object'
		}

		// Default to string for safety
		return 'string'
	}

	/**
	 * Build required parameters list from tool definition
	 */
	protected getRequiredParams(tool: InternalToolInfo): string[] {
		return Object.entries(tool.params)
			.filter(([_, param]) => !param.description.toLowerCase().startsWith('optional'))
			.map(([name]) => name)
	}

	/**
	 * Validate that a tool call has all required parameters
	 * Only works for single tool calls
	 */
	protected hasRequiredParams(toolCall: RawToolCallObj, toolDef: InternalToolInfo): boolean {
		if (!('name' in toolCall)) {
			return false // Multiple tool calls - can't validate here
		}
		const requiredParams = this.getRequiredParams(toolDef)
		return requiredParams.every(param => toolCall.doneParams.includes(param as ToolParamName<ToolName>))
	}
}

