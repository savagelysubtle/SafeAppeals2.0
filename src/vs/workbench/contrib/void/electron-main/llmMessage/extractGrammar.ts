/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { generateUuid } from '../../../../../base/common/uuid.js'
import { endsWithAnyPrefixOf, SurroundingsRemover } from '../../common/helpers/extractCodeFromResult.js'
import { availableTools, InternalToolInfo } from '../../common/prompt/prompts.js'
import { OnFinalMessage, OnText, RawToolCallObj, RawToolParamsObj } from '../../common/sendLLMMessageTypes.js'
import { ToolName, ToolParamName } from '../../common/toolsServiceTypes.js'
import { ChatMode } from '../../common/voidSettingsTypes.js'
import { getXMLParserTelemetry } from '../../common/xmlParserTelemetry.js'
import { XMLParserService } from './xmlParserService.js'


// =============== reasoning ===============

// could simplify this - this assumes we can never add a tag without committing it to the user's screen, but that's not true
export const extractReasoningWrapper = (
	onText: OnText, onFinalMessage: OnFinalMessage, thinkTags: [string, string]
): { newOnText: OnText, newOnFinalMessage: OnFinalMessage } => {
	let latestAddIdx = 0 // exclusive index in fullText_
	let foundTag1 = false
	let foundTag2 = false

	let fullTextSoFar = ''
	let fullReasoningSoFar = ''


	if (!thinkTags[0] || !thinkTags[1]) throw new Error(`thinkTags must not be empty if provided. Got ${JSON.stringify(thinkTags)}.`)

	let onText_ = onText
	onText = (params) => {
		onText_(params)
	}

	const newOnText: OnText = ({ fullText: fullText_, ...p }) => {

		// until found the first think tag, keep adding to fullText
		if (!foundTag1) {
			const endsWithTag1 = endsWithAnyPrefixOf(fullText_, thinkTags[0])
			if (endsWithTag1) {
				// console.log('endswith1', { fullTextSoFar, fullReasoningSoFar, fullText_ })
				// wait until we get the full tag or know more
				return
			}
			// if found the first tag
			const tag1Index = fullText_.indexOf(thinkTags[0])
			if (tag1Index !== -1) {
				// console.log('tag1Index !==1', { tag1Index, fullTextSoFar, fullReasoningSoFar, thinkTags, fullText_ })
				foundTag1 = true
				// Add text before the tag to fullTextSoFar
				fullTextSoFar += fullText_.substring(0, tag1Index)
				// Update latestAddIdx to after the first tag
				latestAddIdx = tag1Index + thinkTags[0].length
				onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
				return
			}

			// console.log('adding to text A', { fullTextSoFar, fullReasoningSoFar })
			// add the text to fullText
			fullTextSoFar = fullText_
			latestAddIdx = fullText_.length
			onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
			return
		}

		// at this point, we found <tag1>

		// until found the second think tag, keep adding to fullReasoning
		if (!foundTag2) {
			const endsWithTag2 = endsWithAnyPrefixOf(fullText_, thinkTags[1])
			if (endsWithTag2 && endsWithTag2 !== thinkTags[1]) { // if ends with any partial part (full is fine)
				// console.log('endsWith2', { fullTextSoFar, fullReasoningSoFar })
				// wait until we get the full tag or know more
				return
			}

			// if found the second tag
			const tag2Index = fullText_.indexOf(thinkTags[1], latestAddIdx)
			if (tag2Index !== -1) {
				// console.log('tag2Index !== -1', { fullTextSoFar, fullReasoningSoFar })
				foundTag2 = true
				// Add everything between first and second tag to reasoning
				fullReasoningSoFar += fullText_.substring(latestAddIdx, tag2Index)
				// Update latestAddIdx to after the second tag
				latestAddIdx = tag2Index + thinkTags[1].length
				onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
				return
			}

			// add the text to fullReasoning (content after first tag but before second tag)
			// console.log('adding to text B', { fullTextSoFar, fullReasoningSoFar })

			// If we have more text than we've processed, add it to reasoning
			if (fullText_.length > latestAddIdx) {
				fullReasoningSoFar += fullText_.substring(latestAddIdx)
				latestAddIdx = fullText_.length
			}

			onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
			return
		}

		// at this point, we found <tag2> - content after the second tag is normal text
		// console.log('adding to text C', { fullTextSoFar, fullReasoningSoFar })

		// Add any new text after the closing tag to fullTextSoFar
		if (fullText_.length > latestAddIdx) {
			fullTextSoFar += fullText_.substring(latestAddIdx)
			latestAddIdx = fullText_.length
		}

		onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
	}


	const getOnFinalMessageParams = () => {
		const fullText_ = fullTextSoFar
		const tag1Idx = fullText_.indexOf(thinkTags[0])
		const tag2Idx = fullText_.indexOf(thinkTags[1])
		if (tag1Idx === -1) return { fullText: fullText_, fullReasoning: '' } // never started reasoning
		if (tag2Idx === -1) return { fullText: '', fullReasoning: fullText_ } // never stopped reasoning

		const fullReasoning = fullText_.substring(tag1Idx + thinkTags[0].length, tag2Idx)
		const fullText = fullText_.substring(0, tag1Idx) + fullText_.substring(tag2Idx + thinkTags[1].length, Infinity)

		return { fullText, fullReasoning }
	}

	const newOnFinalMessage: OnFinalMessage = (params) => {

		// treat like just got text before calling onFinalMessage (or else we sometimes miss the final chunk that's new to finalMessage)
		newOnText({ ...params })

		const { fullText, fullReasoning } = getOnFinalMessageParams()
		onFinalMessage({ ...params, fullText, fullReasoning })
	}

	return { newOnText, newOnFinalMessage }
}


// =============== tools (XML) ===============



const findPartiallyWrittenToolTagAtEnd = (fullText: string, toolTags: string[]) => {
	for (const toolTag of toolTags) {
		const foundPrefix = endsWithAnyPrefixOf(fullText, toolTag)
		if (foundPrefix) {
			return [foundPrefix, toolTag] as const
		}
	}
	return false
}

const findIndexOfAny = (fullText: string, matches: string[]) => {
	for (const str of matches) {
		const idx = fullText.indexOf(str);
		if (idx !== -1) {
			return [idx, str] as const
		}
	}
	return null
}


export type ToolOfToolName = { [toolName: string]: InternalToolInfo | undefined }
export const parseXMLPrefixToToolCall = <T extends ToolName,>(toolName: T, toolId: string, str: string, toolOfToolName: ToolOfToolName): RawToolCallObj => {
	const paramsObj: RawToolParamsObj = {}
	const doneParams: ToolParamName<T>[] = []
	let isDone = false

	const getAnswer = (): RawToolCallObj => {
		// trim off all whitespace at and before first \n and after last \n for each param
		for (const p in paramsObj) {
			const paramName = p as ToolParamName<T>
			const orig = paramsObj[paramName]
			if (orig === undefined) continue
			paramsObj[paramName] = trimBeforeAndAfterNewLines(orig)
		}

		// return tool call
		const ans: RawToolCallObj = {
			name: toolName,
			rawParams: paramsObj,
			doneParams: doneParams,
			isDone: isDone,
			id: toolId,
		}
		return ans
	}

	// find first toolName tag
	const openToolTag = `<${toolName}>`
	let i = str.indexOf(openToolTag)
	if (i === -1) return getAnswer()
	let j = str.lastIndexOf(`</${toolName}>`)
	if (j === -1) j = Infinity
	else isDone = true


	str = str.substring(i + openToolTag.length, j)

	const pm = new SurroundingsRemover(str)

	const allowedParams = Object.keys(toolOfToolName[toolName]?.params ?? {}) as ToolParamName<T>[]
	if (allowedParams.length === 0) return getAnswer()
	let latestMatchedOpenParam: null | ToolParamName<T> = null
	let n = 0
	while (true) {
		n += 1
		// ✅ FIX: Increased from 10 to 100 to support tools with many parameters
		// This was causing silent failures for tools with >10 params
		if (n > 100) {
			logParsingError(toolName, `Exceeded 100 parameter iterations - possible infinite loop or malformed XML`, {
				iterations: n,
				paramsFound: Object.keys(paramsObj),
				doneParams: doneParams.length
			})
			return getAnswer()
		}

		// find the param name opening tag
		let matchedOpenParam: null | ToolParamName<T> = null
		for (const paramName of allowedParams) {
			const removed = pm.removeFromStartUntilFullMatch(`<${paramName}>`, true)
			if (removed) {
				matchedOpenParam = paramName
				break
			}
		}
		// if did not find a new param, stop
		if (matchedOpenParam === null) {
			if (latestMatchedOpenParam !== null) {
				paramsObj[latestMatchedOpenParam] += pm.value()
			}
			return getAnswer()
		}
		else {
			latestMatchedOpenParam = matchedOpenParam
		}

		paramsObj[latestMatchedOpenParam] = ''

		// find the param name closing tag
		let matchedCloseParam: boolean = false
		let paramContents = ''
		for (const paramName of allowedParams) {
			const i = pm.i
			const closeTag = `</${paramName}>`
			const removed = pm.removeFromStartUntilFullMatch(closeTag, true)
			if (removed) {
				const i2 = pm.i
				paramContents = pm.originalS.substring(i, i2 - closeTag.length)
				matchedCloseParam = true
				break
			}
		}
		// if did not find a new close tag, stop
		if (!matchedCloseParam) {
			paramsObj[latestMatchedOpenParam] += pm.value()
			return getAnswer()
		}
		else {
			doneParams.push(latestMatchedOpenParam)
		}

		paramsObj[latestMatchedOpenParam] += paramContents
	}
}

// Structured logging helper for XML parsing
const logParsedToolCall = (toolCall: RawToolCallObj, xmlSnippet?: string) => {
	if ('name' in toolCall) {
		// Single tool call
		console.log(`[XML Parser] ✅ Parsed single tool call: ${toolCall.name}`, {
			isDone: toolCall.isDone,
			paramCount: Object.keys(toolCall.rawParams).length,
			doneParams: toolCall.doneParams.length,
			params: Object.keys(toolCall.rawParams),
			doneParamsList: toolCall.doneParams,
			...(xmlSnippet ? { xmlSnippet: xmlSnippet.substring(0, 200) } : {})
		})
	} else {
		// Multiple tool calls
		console.log(`[XML Parser] ✅ Parsed multiple tool calls (ANTML):`, {
			count: toolCall.toolCalls.length,
			tools: toolCall.toolCalls.map(t => t.name),
			...(xmlSnippet ? { xmlSnippet: xmlSnippet.substring(0, 200) } : {})
		})
	}
}

const logParsingError = (toolName: string, error: string, context?: Record<string, any>) => {
	console.error(`[XML Parser] ❌ Parsing error for tool ${toolName}: ${error}`, context || {})
}

export const extractXMLToolsWrapper = (
	onText: OnText,
	onFinalMessage: OnFinalMessage,
	chatMode: ChatMode | null,
	mcpTools: InternalToolInfo[] | undefined,
): { newOnText: OnText, newOnFinalMessage: OnFinalMessage } => {

	console.log('[extractXMLToolsWrapper] 🔍 INITIALIZED with chatMode:', chatMode, 'mcpTools:', mcpTools?.length ?? 0)

	if (!chatMode) {
		console.error('[extractXMLToolsWrapper] ❌❌❌ chatMode is NULL - XML extraction DISABLED!')
		return { newOnText: onText, newOnFinalMessage: onFinalMessage }
	}
	const tools = availableTools(chatMode, mcpTools)
	console.log('[extractXMLToolsWrapper] 🔍 availableTools returned:', tools?.length ?? 0, 'tools for chatMode:', chatMode)
	if (!tools || tools.length === 0) {
		console.error('[extractXMLToolsWrapper] ❌❌❌ No tools available for chatMode:', chatMode, 'tools:', tools, '- XML extraction DISABLED!')
		console.error('[extractXMLToolsWrapper] ⚠️ This means tool calls will NOT be parsed. Check availableTools() implementation.')
		return { newOnText: onText, newOnFinalMessage: onFinalMessage }
	}
	console.log('[extractXMLToolsWrapper] ✅ chatMode:', chatMode, 'tools count:', tools.length)

	console.log('[extractXMLToolsWrapper] Extracting XML tools for chatMode:', chatMode, 'with', tools.length, 'tools')
	console.log('[extractXMLToolsWrapper] Tool names:', tools.map(t => t.name))
	console.log('[extractXMLToolsWrapper] Tool open tags:', tools.map(t => `<${t.name}>`))

	const toolOfToolName: ToolOfToolName = {}
	const toolOpenTags = tools.map(t => `<${t.name}>`)
	for (const t of tools) { toolOfToolName[t.name] = t }

	const toolId = generateUuid()
	const parserService = new XMLParserService() // Create once per wrapper instance

	// detect <availableTools[0]></availableTools[0]>, etc
	let fullText = '';
	let trueFullText = ''
	let latestToolCall: RawToolCallObj | undefined = undefined

	let foundOpenTag: { idx: number, toolName: ToolName } | null = null
	let openToolTagBuffer = '' // the characters we've seen so far that come after a < with no space afterwards, not yet added to fullText

	let prevFullTextLen = 0
	let prevFullReasoningLen = 0
	const newOnText: OnText = (params) => {
		// CRITICAL FIX: Check BOTH fullText and fullReasoning for tool calls
		// When extended thinking is enabled, tool calls may appear in fullReasoning instead of fullText
		const combinedText = (params.fullText || '') + (params.fullReasoning || '')
		const newText = combinedText.substring(prevFullTextLen + prevFullReasoningLen)

		prevFullTextLen = params.fullText?.length || 0
		prevFullReasoningLen = params.fullReasoning?.length || 0
		trueFullText = combinedText

		// Log when we receive reasoning content
		if (params.fullReasoning && params.fullReasoning.length > 0) {
			console.log('[extractXMLToolsWrapper] 🧠 Received REASONING content (length:', params.fullReasoning.length, ') - checking for tool calls')
			if (params.fullReasoning.includes('<')) {
				console.log('[extractXMLToolsWrapper] 🔍 Reasoning contains XML tags:', params.fullReasoning.substring(0, 100))
			}
		}

		// Log every call to verify wrapper is running
		if (params.fullText.includes('<edit_document>')) {
			console.log('[extractXMLToolsWrapper] Received text with <edit_document> tag. fullText length:', params.fullText.length, 'foundOpenTag:', foundOpenTag, 'toolOpenTags:', toolOpenTags)
			console.log('[extractXMLToolsWrapper] fullText contains <edit_document>:', params.fullText.includes('<edit_document>'))
			console.log('[extractXMLToolsWrapper] toolOpenTags includes <edit_document>:', toolOpenTags.includes('<edit_document>'))
		}


		if (foundOpenTag === null) {
			// NEW: Check for ANTML format first - ONLY in fullText, not reasoning
			const functionCallsIdx = params.fullText.indexOf('<function_calls>')

			if (functionCallsIdx !== -1) {
				// Found ANTML format - extract text before it
				const textBeforeTools = params.fullText.substring(0, functionCallsIdx)
				fullText = textBeforeTools

				// Parse ANTML format (from fullText only, not combined)
				const xmlSubstring = params.fullText.substring(functionCallsIdx)
				const parseStartTime = performance.now()

				console.log('[extractXMLToolsWrapper] ✅ FOUND <function_calls> tag at index:', functionCallsIdx)

				const parseResult = parserService.parseToolCall(
					undefined,  // no toolName - it's in the XML
					toolId,
					xmlSubstring,
					toolOfToolName
				)

				const parseDuration = performance.now() - parseStartTime

				// Record telemetry
				const telemetry = getXMLParserTelemetry()
				telemetry.recordParse(
					'function_calls' as ToolName,  // Special marker for ANTML
					parseResult.strategy,
					parseResult.toolCall !== null,
					parseDuration,
					parseResult.recoveryActions,
					parseResult.error
				)

				if (parseResult.toolCall) {
					latestToolCall = parseResult.toolCall
					console.log('[extractXMLToolsWrapper] ✅ Parsed ANTML format successfully')
					if (parseResult.recoveryActions && parseResult.recoveryActions.length > 0) {
						console.log(`[XML Parser] Recovery actions:`, parseResult.recoveryActions)
					}
				} else {
					console.error(`[XML Parser] Failed to parse ANTML format:`, parseResult.error)
				}

				// Mark as found to avoid further parsing
				foundOpenTag = { idx: functionCallsIdx, toolName: 'function_calls' as ToolName }
			}
			// OLD: Legacy format detection (fallback)
			else {
				const newFullText = openToolTagBuffer + newText
				// ensure the code below doesn't run if only half a tag has been written
				const isPartial = findPartiallyWrittenToolTagAtEnd(newFullText, toolOpenTags)
				if (isPartial) {
					// console.log('--- partial!!!')
					openToolTagBuffer += newText
				}
				// if no tooltag is partially written at the end, attempt to get the index
				else {
					// we will instantly retroactively remove this if it's a tag match
					fullText += openToolTagBuffer
					openToolTagBuffer = ''
					fullText += newText

					const i = findIndexOfAny(fullText, toolOpenTags)
					if (i !== null) {
						const [idx, toolTag] = i
						const toolName = toolTag.substring(1, toolTag.length - 1) as ToolName
						console.log('[extractXMLToolsWrapper] ✅ FOUND legacy tool tag:', toolName, 'at index:', idx, 'in text:', fullText.substring(Math.max(0, idx - 20), idx + 50))
						foundOpenTag = { idx, toolName }

						// do not count anything at or after i in fullText
						fullText = fullText.substring(0, idx)
					} else {
						// Debug: Check if tag exists but wasn't found
						if (fullText.includes('<edit_document>')) {
							const editDocIdx = fullText.indexOf('<edit_document>')
							console.log('[extractXMLToolsWrapper] ❌ <edit_document> found in text at index', editDocIdx, 'but findIndexOfAny returned null!', {
								fullTextSample: fullText.substring(Math.max(0, editDocIdx - 10), editDocIdx + 30),
								toolOpenTags,
								toolOpenTagsLength: toolOpenTags.length,
								availableTools: Object.keys(toolOfToolName),
								fullTextLength: fullText.length
							})
							// Try to see if there's a mismatch
							for (const tag of toolOpenTags) {
								if (fullText.includes(tag)) {
									console.log('[extractXMLToolsWrapper] But found tag:', tag, 'at index:', fullText.indexOf(tag))
								}
							}
						}
					}
				}
			}
		}

		// toolTagIdx is not null, so parse the XML (legacy format only)
		if (foundOpenTag !== null && foundOpenTag.toolName !== 'function_calls') {
			const xmlSubstring = trueFullText.substring(foundOpenTag.idx, Infinity)
			const parseStartTime = performance.now()

			// Use parser service with fallback support
			const parseResult = parserService.parseToolCall(
				foundOpenTag.toolName,
				toolId,
				xmlSubstring,
				toolOfToolName,
			)

			const parseDuration = performance.now() - parseStartTime

			// Record telemetry
			const telemetry = getXMLParserTelemetry()
			telemetry.recordParse(
				foundOpenTag.toolName,
				parseResult.strategy,
				parseResult.toolCall !== null,
				parseDuration,
				parseResult.recoveryActions,
				parseResult.error
			)

			if (parseResult.toolCall) {
				latestToolCall = parseResult.toolCall
				logParsedToolCall(latestToolCall, xmlSubstring)
				// Log which strategy succeeded for monitoring
				if (parseResult.strategy !== 'custom') {
					console.log(`[XML Parser] Used ${parseResult.strategy} parser for tool ${foundOpenTag.toolName}`)
				}
				// Log recovery actions if any were taken
				if (parseResult.recoveryActions && parseResult.recoveryActions.length > 0) {
					console.log(`[XML Parser] Recovery actions for ${foundOpenTag.toolName}:`, parseResult.recoveryActions)
				}
			} else {
				// All parsers failed
				console.error(`[XML Parser] Failed to parse tool call for ${foundOpenTag.toolName}:`, parseResult.error)
				if (parseResult.recoveryActions && parseResult.recoveryActions.length > 0) {
					console.log(`[XML Parser] Recovery attempts made:`, parseResult.recoveryActions)
				}
			}
		}

		onText({
			...params,
			fullText,
			toolCall: latestToolCall,
		});
	};


	const newOnFinalMessage: OnFinalMessage = (params) => {
		// treat like just got text before calling onFinalMessage (or else we sometimes miss the final chunk that's new to finalMessage)
		newOnText({ ...params })

		fullText = fullText.trimEnd()
		let toolCall = latestToolCall

		// ✅ FIX: Only pass tool call if it's complete (isDone: true)
		// Incomplete tool calls cause validation errors in ToolsService
		if (toolCall && 'name' in toolCall && !toolCall.isDone) {
			const singleToolCall = toolCall // Type narrowed here
			logParsingError(singleToolCall.name, 'INCOMPLETE tool call detected - LLM output was likely truncated', {
				params: Object.keys(singleToolCall.rawParams),
				doneParams: singleToolCall.doneParams,
				missingParams: Object.keys(singleToolCall.rawParams).filter(p => !singleToolCall.doneParams.includes(p as ToolParamName<ToolName>))
			})
			toolCall = undefined // Don't execute incomplete tools
		}

		onFinalMessage({ ...params, fullText, toolCall: toolCall })
	}
	return { newOnText, newOnFinalMessage };
}



// trim all whitespace up until the first newline, and all whitespace up until the last newline
const trimBeforeAndAfterNewLines = (s: string) => {
	if (!s) return s;

	const firstNewLineIndex = s.indexOf('\n');

	if (firstNewLineIndex !== -1 && s.substring(0, firstNewLineIndex).trim() === '') {
		s = s.substring(firstNewLineIndex + 1, Infinity)
	}

	const lastNewLineIndex = s.lastIndexOf('\n');
	if (lastNewLineIndex !== -1 && s.substring(lastNewLineIndex + 1, Infinity).trim() === '') {
		s = s.substring(0, lastNewLineIndex)
	}

	return s
}
