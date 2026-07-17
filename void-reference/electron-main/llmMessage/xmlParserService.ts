/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createRequire } from 'module'
import { generateUuid } from '../../../../../base/common/uuid.js'
import { InternalToolInfo } from '../../common/prompt/prompts.js'
import { MultipleToolCalls, RawToolCallObj, RawToolParamsObj, SingleToolCall } from '../../common/sendLLMMessageTypes.js'
import { ToolName, ToolParamName } from '../../common/tools/toolsServiceTypes.js'
import { parseXMLPrefixToToolCall } from './extractGrammar.js'

// Try to import partial-xml-stream-parser, but handle if it's not available
// Use createRequire for ESM compatibility with CommonJS modules
let PartialXMLStreamParser: any = null
try {
	const require = createRequire(import.meta.url)
	const parserModule = require('partial-xml-stream-parser')
	PartialXMLStreamParser = parserModule.default || parserModule.PartialXMLStreamParser || parserModule
} catch (e) {
	// Library not available, will use fallback
}

export type ParseStrategy = 'antml' | 'custom' | 'streaming' | 'regex' | 'failed'

export interface ParseResult {
	toolCall: RawToolCallObj | null
	strategy: ParseStrategy
	error?: string
	recoveryActions?: string[] // Track what recovery actions were taken
}

/**
 * XML sanitization and recovery utilities
 */
class XMLRecoveryUtils {
	/**
	 * Escape unescaped special characters in XML content (not in tags)
	 * Handles: &, <, >, ", '
	 */
	static escapeSpecialCharacters(xml: string): { sanitized: string; actions: string[] } {
		const actions: string[] = []
		let sanitized = xml

		// Map of characters to entities
		const entityMap: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&apos;'
		}

		// Only escape characters that are not part of XML structure (tags)
		// Use a more sophisticated approach: detect if we're inside a tag or in content
		let inTag = false
		let result = ''
		let i = 0

		while (i < sanitized.length) {
			const char = sanitized[i]
			const nextChar = i + 1 < sanitized.length ? sanitized[i + 1] : ''

			// Track tag boundaries
			if (char === '<' && nextChar !== '/') {
				inTag = true
				result += char
				i++
				continue
			}

			if (char === '>' || (char === '/' && nextChar === '>')) {
				inTag = false
				result += char
				i++
				continue
			}

			// If we're in content (not in a tag), escape special characters
			if (!inTag && char in entityMap) {
				// Check if it's already part of an entity (e.g., &amp;)
				const remaining = sanitized.substring(i)
				if (!remaining.match(/^&(amp|lt|gt|quot|apos);/)) {
					result += entityMap[char]
					actions.push(`Escaped unescaped '${char}' character`)
				} else {
					result += char
				}
			} else {
				result += char
			}

			i++
		}

		return { sanitized: result, actions }
	}

	/**
	 * Fix mismatched tags (e.g., <uri>value</url>)
	 * Attempts to find the correct closing tag
	 */
	static fixMismatchedTags(xml: string, toolName: ToolName, paramNames: string[]): { fixed: string; actions: string[] } {
		const actions: string[] = []
		let fixed = xml

		// Find opening tag for tool
		const toolOpenTag = `<${toolName}>`
		const toolOpenIdx = fixed.indexOf(toolOpenTag)

		if (toolOpenIdx === -1) {
			return { fixed, actions }
		}

		// For each parameter, check for mismatched closing tags
		for (const paramName of paramNames) {
			const openTag = `<${paramName}>`
			const correctCloseTag = `</${paramName}>`

			// Find all opening tags
			let searchIdx = fixed.indexOf(openTag)
			while (searchIdx !== -1) {
				// Find the next closing tag after this opening tag
				const contentStart = searchIdx + openTag.length
				const closeTagIdx = fixed.indexOf('</', contentStart)

				if (closeTagIdx !== -1) {
					// Extract the tag name from the closing tag
					const tagEndIdx = fixed.indexOf('>', closeTagIdx)
					if (tagEndIdx !== -1) {
						const foundCloseTag = fixed.substring(closeTagIdx, tagEndIdx + 1)

						// Check if it's mismatched
						if (foundCloseTag !== correctCloseTag && foundCloseTag.startsWith('</')) {
							// Try to find a similar tag name (handle typos)
							const foundTagName = foundCloseTag.substring(2, foundCloseTag.length - 1)
							const similarity = this.calculateSimilarity(paramName, foundTagName)

							// If similar enough, replace it
							if (similarity > 0.7) {
								fixed = fixed.substring(0, closeTagIdx) + correctCloseTag + fixed.substring(tagEndIdx + 1)
								actions.push(`Fixed mismatched tag: ${foundCloseTag} -> ${correctCloseTag}`)
							}
						}
					}
				}

				// Find next occurrence
				searchIdx = fixed.indexOf(openTag, searchIdx + 1)
			}
		}

		return { fixed, actions }
	}

	/**
	 * Calculate string similarity (Levenshtein-based)
	 */
	private static calculateSimilarity(str1: string, str2: string): number {
		const longer = str1.length > str2.length ? str1 : str2
		const shorter = str1.length > str2.length ? str2 : str1

		if (longer.length === 0) return 1.0

		const distance = this.levenshteinDistance(longer, shorter)
		return (longer.length - distance) / longer.length
	}

	/**
	 * Calculate Levenshtein distance between two strings
	 */
	private static levenshteinDistance(str1: string, str2: string): number {
		const matrix: number[][] = []

		for (let i = 0; i <= str2.length; i++) {
			matrix[i] = [i]
		}

		for (let j = 0; j <= str1.length; j++) {
			matrix[0][j] = j
		}

		for (let i = 1; i <= str2.length; i++) {
			for (let j = 1; j <= str1.length; j++) {
				if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1]
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1, // substitution
						matrix[i][j - 1] + 1, // insertion
						matrix[i - 1][j] + 1 // deletion
					)
				}
			}
		}

		return matrix[str2.length][str1.length]
	}

	/**
	 * Preprocess XML string with all recovery mechanisms
	 */
	static preprocessXML(xml: string, toolName: ToolName, paramNames: string[]): { preprocessed: string; actions: string[] } {
		const allActions: string[] = []

		// Step 1: Escape special characters
		const escaped = this.escapeSpecialCharacters(xml)
		allActions.push(...escaped.actions)

		// Step 2: Fix mismatched tags
		const fixed = this.fixMismatchedTags(escaped.sanitized, toolName, paramNames)
		allActions.push(...fixed.actions)

		return {
			preprocessed: fixed.fixed,
			actions: allActions
		}
	}
}

export interface IXMLParser {
	parseToolCall(
		toolName: ToolName,
		toolId: string,
		xmlString: string,
		toolOfToolName: { [toolName: string]: InternalToolInfo | undefined }
	): ParseResult
}

/**
 * Normalize ANTML XML for better parsing reliability
 * Fixes common formatting issues that cause parsing failures
 */
function normalizeANTML(xml: string): string {
	console.log('[normalizeANTML] Input XML length:', xml.length, 'first 200 chars:', xml.substring(0, 200))

	// If XML is all on one line, add line breaks for readability and parsing
	let normalized = xml
		// Add line breaks after closing tags
		.replace(/<\/invoke>/g, '</invoke>\n')
		.replace(/<\/parameter>/g, '</parameter>\n')
		.replace(/<\/function_calls>/g, '</function_calls>\n')
		// Add line breaks before opening tags
		.replace(/<invoke/g, '\n<invoke')
		.replace(/<parameter/g, '\n<parameter')
		// Collapse multiple whitespace/newlines into single spaces
		.replace(/\s+/g, ' ')
		// But keep line breaks around tags
		.replace(/\s*\n\s*/g, '\n')
		.trim()

	console.log('[normalizeANTML] Output XML length:', normalized.length, 'first 200 chars:', normalized.substring(0, 200))
	return normalized
}

/**
 * ANTML Parser - handles Anthropic's nested XML format
 * Parses: <function_calls><invoke name="X"><parameter name="Y">...</parameter></invoke></function_calls>
 */
class AntmlParser {
	parseToolCalls(
		xmlString: string,
		toolOfToolName: { [toolName: string]: InternalToolInfo | undefined }
	): ParseResult {
		console.log('[AntmlParser] Starting parse, XML length:', xmlString.length)
		console.log('[AntmlParser] XML first 300 chars:', xmlString.substring(0, 300))
		console.log('[AntmlParser] Available tools:', Object.keys(toolOfToolName))

		const toolCalls: SingleToolCall[] = []

		// 1. Find <function_calls> wrapper
		const functionCallsMatch = xmlString.match(/<function_calls>([\s\S]*?)<\/function_calls>/)
		if (!functionCallsMatch) {
			console.error('[AntmlParser] ❌ No <function_calls> wrapper found in XML')
			console.error('[AntmlParser] XML content:', xmlString.substring(0, 500))

			// Try normalizing and re-parsing
			const normalizedXml = normalizeANTML(xmlString)
			const retryMatch = normalizedXml.match(/<function_calls>([\s\S]*?)<\/function_calls>/)
			if (!retryMatch) {
				return { toolCall: null, strategy: 'antml', error: 'No <function_calls> wrapper found (tried normalization)' }
			}
			console.log('[AntmlParser] ✅ Found wrapper after normalization')
			return this.parseToolCalls(normalizedXml, toolOfToolName) // Recursive retry
		}

		const innerContent = functionCallsMatch[1]
		console.log('[AntmlParser] ✅ Found <function_calls> wrapper, inner content length:', innerContent.length)
		console.log('[AntmlParser] Inner content first 200 chars:', innerContent.substring(0, 200))

		// 2. Find all <invoke> blocks
		const invokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g
		let match

		while ((match = invokeRegex.exec(innerContent)) !== null) {
			const toolName = match[1] as ToolName
			const invokeContent = match[2]
			console.log('[AntmlParser] Found <invoke> for tool:', toolName, 'content length:', invokeContent.length)

			const toolDef = toolOfToolName[toolName]

			if (!toolDef) {
				console.warn(`[AntmlParser] ⚠️ Unknown tool: ${toolName} - skipping`)
				continue
			}

			// 3. Extract parameters from <parameter name="X">value</parameter>
			const paramsObj: RawToolParamsObj = {}
			const doneParams: ToolParamName<ToolName>[] = []

			const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g
			let paramMatch

			while ((paramMatch = paramRegex.exec(invokeContent)) !== null) {
				const paramName = paramMatch[1] as ToolParamName<ToolName>
				const paramValue = paramMatch[2].trim()
				console.log('[AntmlParser] Found parameter:', paramName, 'value length:', paramValue.length)

				if (paramName in toolDef.params) {
					paramsObj[paramName] = paramValue
					doneParams.push(paramName)
				} else {
					console.warn('[AntmlParser] ⚠️ Unknown parameter:', paramName, 'for tool:', toolName)
				}
			}

			console.log('[AntmlParser] ✅ Extracted tool call:', toolName, 'with', doneParams.length, 'params:', doneParams)

			toolCalls.push({
				name: toolName,
				rawParams: paramsObj,
				doneParams,
				id: generateUuid(),
				isDone: true
			})
		}

		console.log('[AntmlParser] 🎯 Final result: Extracted', toolCalls.length, 'tool calls')

		if (toolCalls.length === 0) {
			console.error('[AntmlParser] ❌ No valid tool calls found in <function_calls> block')
			console.error('[AntmlParser] Inner content was:', innerContent.substring(0, 500))
			return { toolCall: null, strategy: 'antml', error: 'No valid tool calls found in <function_calls> block' }
		}

		// Return single or multiple
		if (toolCalls.length === 1) {
			console.log('[AntmlParser] ✅ Returning single tool call:', toolCalls[0].name)
			return { toolCall: toolCalls[0], strategy: 'antml' }
		}

		console.log('[AntmlParser] ✅ Returning multiple tool calls:', toolCalls.map(t => t.name).join(', '))
		return {
			toolCall: { toolCalls, format: 'antml' } as MultipleToolCalls,
			strategy: 'antml'
		}
	}
}

/**
 * Custom XML parser - the existing implementation
 * Fast and lightweight, handles well-formed XML efficiently
 */
class CustomXMLParser implements IXMLParser {
	parseToolCall(
		toolName: ToolName,
		toolId: string,
		xmlString: string,
		toolOfToolName: { [toolName: string]: InternalToolInfo | undefined }
	): ParseResult {
		try {
			const toolCall = parseXMLPrefixToToolCall(toolName, toolId, xmlString, toolOfToolName)
			return {
				toolCall,
				strategy: 'custom'
			}
		} catch (error) {
			return {
				toolCall: null,
				strategy: 'custom',
				error: error instanceof Error ? error.message : String(error)
			}
		}
	}
}

/**
 * Streaming XML parser using partial-xml-stream-parser
 * Handles incomplete and malformed XML gracefully
 */
class StreamingXMLParser implements IXMLParser {
	parseToolCall(
		toolName: ToolName,
		toolId: string,
		xmlString: string,
		toolOfToolName: { [toolName: string]: InternalToolInfo | undefined }
	): ParseResult {
		if (!PartialXMLStreamParser) {
			return {
				toolCall: null,
				strategy: 'streaming',
				error: 'partial-xml-stream-parser not available'
			}
		}

		try {
			// The library API may vary, so we use a more flexible approach
			// Try to parse with lenient options
			const parser = typeof PartialXMLStreamParser === 'function'
				? new PartialXMLStreamParser({ ignoreInvalidTags: true, alwaysCreateTextNode: true })
				: PartialXMLStreamParser

			// Try different parse methods based on library version
			let parsed: any = null
			if (typeof parser.parse === 'function') {
				parsed = parser.parse(xmlString)
			} else if (typeof parser.parsePartial === 'function') {
				parsed = parser.parsePartial(xmlString)
			} else if (typeof parser === 'function') {
				parsed = parser(xmlString)
			} else {
				// Fallback: try to use as-is
				parsed = parser
			}

			// Extract tool parameters from parsed XML
			const paramsObj: RawToolParamsObj = {}
			const doneParams: ToolParamName<ToolName>[] = []

			const toolDef = toolOfToolName[toolName]
			if (!toolDef) {
				return {
					toolCall: null,
					strategy: 'streaming',
					error: `Tool definition not found for ${toolName}`
				}
			}

			// Check if we have the closing tag to determine ifDone
			const hasClosingTag = xmlString.includes(`</${toolName}>`)

			// Extract parameters from parsed XML structure
			// Handle different possible structures
			const toolContent = parsed?.[toolName] || parsed
			if (toolContent && typeof toolContent === 'object') {
				for (const paramName of Object.keys(toolDef.params)) {
					const value = toolContent[paramName]
					if (value !== undefined && value !== null) {
						// Handle string, number, or object with text property
						const stringValue = typeof value === 'string'
							? value
							: (typeof value === 'object' && 'text' in value && typeof value.text === 'string')
								? value.text
								: String(value)

						if (stringValue) {
							paramsObj[paramName as ToolParamName<ToolName>] = stringValue.trim()
							doneParams.push(paramName as ToolParamName<ToolName>)
						}
					}
				}
			}

			// Only return tool call if we extracted at least one parameter
			if (doneParams.length === 0) {
				return {
					toolCall: null,
					strategy: 'streaming',
					error: 'No parameters extracted from parsed XML'
				}
			}

			const toolCall: RawToolCallObj = {
				name: toolName,
				rawParams: paramsObj,
				doneParams: doneParams,
				isDone: hasClosingTag,
				id: toolId
			}

			return {
				toolCall,
				strategy: 'streaming'
			}
		} catch (error) {
			return {
				toolCall: null,
				strategy: 'streaming',
				error: error instanceof Error ? error.message : String(error)
			}
		}
	}
}

/**
 * Regex fallback parser - last resort for malformed XML
 * Attempts to extract parameters using regex patterns
 */
class RegexFallbackParser implements IXMLParser {
	parseToolCall(
		toolName: ToolName,
		toolId: string,
		xmlString: string,
		toolOfToolName: { [toolName: string]: InternalToolInfo | undefined }
	): ParseResult {
		const toolDef = toolOfToolName[toolName]
		if (!toolDef) {
			return {
				toolCall: null,
				strategy: 'regex',
				error: `Tool definition not found for ${toolName}`
			}
		}

		const paramsObj: RawToolParamsObj = {}
		const doneParams: ToolParamName<ToolName>[] = []

		// Try to extract parameters using regex
		for (const paramName of Object.keys(toolDef.params)) {
			// Match <paramName>value</paramName> allowing for malformed XML
			const regex = new RegExp(`<${paramName}[^>]*>([\\s\\S]*?)</${paramName}>`, 'i')
			const match = xmlString.match(regex)

			if (match && match[1]) {
				paramsObj[paramName as ToolParamName<ToolName>] = match[1].trim()
				doneParams.push(paramName as ToolParamName<ToolName>)
			}
		}

		// Only return if we got some parameters
		if (doneParams.length === 0) {
			return {
				toolCall: null,
				strategy: 'regex',
				error: 'No parameters extracted via regex'
			}
		}

		const hasClosingTag = xmlString.includes(`</${toolName}>`)

		const toolCall: RawToolCallObj = {
			name: toolName,
			rawParams: paramsObj,
			doneParams: doneParams,
			isDone: hasClosingTag,
			id: toolId
		}

		return {
			toolCall,
			strategy: 'regex'
		}
	}
}

/**
 * XML Parser Service - Unified interface for XML parsing with fallback support
 * Implements multi-level fallback strategy:
 * 1. Custom parser (fastest, handles well-formed XML)
 * 2. Streaming parser (handles incomplete/malformed XML)
 * 3. Regex fallback (extracts what's possible)
 */
export class XMLParserService {
	private antmlParser: AntmlParser
	private customParser: CustomXMLParser
	private streamingParser: StreamingXMLParser
	private regexParser: RegexFallbackParser

	constructor() {
		this.antmlParser = new AntmlParser()
		this.customParser = new CustomXMLParser()
		this.streamingParser = new StreamingXMLParser()
		this.regexParser = new RegexFallbackParser()
	}

	/**
	 * Parse tool call from XML string with automatic fallback and recovery
	 * Now supports both ANTML format (<function_calls>) and legacy format (<tool_name>)
	 */
	parseToolCall(
		toolName: ToolName | undefined,  // Now optional - ANTML has name in XML
		toolId: string,
		xmlString: string,
		toolOfToolName: { [toolName: string]: InternalToolInfo | undefined }
	): ParseResult {
		// Level 0: Try ANTML parser first (new format)
		if (xmlString.includes('<function_calls>')) {
			const antmlResult = this.antmlParser.parseToolCalls(xmlString, toolOfToolName)
			if (antmlResult.toolCall) {
				console.log('[XMLParserService] ✅ Parsed ANTML format successfully')
				return antmlResult
			}
		}

		// Fallback to old parsers if toolName provided (backwards compat)
		if (!toolName) {
			return {
				toolCall: null,
				strategy: 'failed',
				error: 'No <function_calls> found and no toolName provided for legacy parsing'
			}
		}

		const toolDef = toolOfToolName[toolName]
		const paramNames = toolDef ? Object.keys(toolDef.params) : []

		// Preprocess XML with recovery mechanisms (only for legacy format)
		const preprocessed = XMLRecoveryUtils.preprocessXML(xmlString, toolName, paramNames)
		const xmlToParse = preprocessed.actions.length > 0 ? preprocessed.preprocessed : xmlString

		// Level 1: Try custom parser (fastest)
		const customResult = this.customParser.parseToolCall(toolName, toolId, xmlToParse, toolOfToolName)
		if (customResult.toolCall && 'isDone' in customResult.toolCall && customResult.toolCall.isDone) {
			return {
				...customResult,
				recoveryActions: preprocessed.actions
			}
		}

		// Level 2: If custom parser failed or incomplete, try streaming parser
		const streamingResult = this.streamingParser.parseToolCall(toolName, toolId, xmlToParse, toolOfToolName)
		if (streamingResult.toolCall) {
			return {
				...streamingResult,
				recoveryActions: preprocessed.actions
			}
		}

		// Level 3: Last resort - regex fallback (use original XML, recovery may have broken regex patterns)
		const regexResult = this.regexParser.parseToolCall(toolName, toolId, xmlString, toolOfToolName)
		if (regexResult.toolCall) {
			return {
				...regexResult,
				recoveryActions: preprocessed.actions
			}
		}

		// Level 4: Total failure
		return {
			toolCall: null,
			strategy: 'failed',
			error: `All parsing strategies failed. Custom: ${customResult.error || 'success but incomplete'}, Streaming: ${streamingResult.error || 'none'}, Regex: ${regexResult.error || 'none'}`,
			recoveryActions: preprocessed.actions
		}
	}
}

