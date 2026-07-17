/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert'
import { generateUuid } from '../../../../../base/common/uuid.js'
import { InternalToolInfo } from '../../common/prompt/prompts.js'
import { ToolName } from '../../common/tools/toolsServiceTypes.js'
import { XMLParserService } from '../../electron-main/llmMessage/xmlParserService.js'

suite('XML Parser Service', () => {
	let parserService: XMLParserService

	setup(() => {
		parserService = new XMLParserService()
	})

	const createToolDef = (name: string, params: string[]): InternalToolInfo => {
		const paramsObj: { [key: string]: { description: string } } = {}
		for (const param of params) {
			paramsObj[param] = { description: `Parameter ${param}` }
		}
		return {
			name,
			description: `Tool ${name}`,
			params: paramsObj
		}
	}

	const toolOfToolName = (tools: InternalToolInfo[]) => {
		const result: { [toolName: string]: InternalToolInfo | undefined } = {}
		for (const tool of tools) {
			result[tool.name] = tool
		}
		return result
	}

	test('Parse well-formed XML tool call', () => {
		const toolDef = createToolDef('read_file', ['uri', 'start_line', 'end_line'])
		const tools = toolOfToolName([toolDef])
		const toolId = generateUuid()

		const xml = `<read_file>
<uri>/path/to/file.ts</uri>
<start_line>10</start_line>
<end_line>20</end_line>
</read_file>`

		const result = parserService.parseToolCall('read_file' as ToolName, toolId, xml, tools)

		assert.ok(result.toolCall, 'Should parse tool call successfully')
		assert.ok('name' in result.toolCall!, 'Should be a single tool call')
		if ('name' in result.toolCall!) {
			assert.strictEqual(result.toolCall.name, 'read_file')
			assert.strictEqual(result.toolCall.isDone, true)
			assert.strictEqual(result.toolCall.rawParams.uri, '/path/to/file.ts')
			assert.strictEqual(result.toolCall.rawParams.start_line, '10')
			assert.strictEqual(result.toolCall.rawParams.end_line, '20')
		}
		assert.strictEqual(result.strategy, 'custom')
	})

	test('Parse tool call with >10 parameters', () => {
		const params = Array.from({ length: 15 }, (_, i) => `param${i}`)
		const toolDef = createToolDef('complex_tool', params)
		const tools = toolOfToolName([toolDef])
		const toolId = generateUuid()

		const xmlParts = params.map(p => `<${p}>value_${p}</${p}>`).join('\n')
		const xml = `<complex_tool>
${xmlParts}
</complex_tool>`

		const result = parserService.parseToolCall('complex_tool' as ToolName, toolId, xml, tools)

		assert.ok(result.toolCall, 'Should parse tool call with >10 parameters')
		if ('name' in result.toolCall!) {
			assert.strictEqual(result.toolCall.isDone, true)
			assert.strictEqual(Object.keys(result.toolCall.rawParams).length, 15)
		}
	})

	test('Handle incomplete XML (missing closing tag)', () => {
		const toolDef = createToolDef('read_file', ['uri'])
		const tools = toolOfToolName([toolDef])
		const toolId = generateUuid()

		const xml = `<read_file>
<uri>/path/to/file.ts</uri>
`

		const result = parserService.parseToolCall('read_file' as ToolName, toolId, xml, tools)

		// Should still parse but mark as incomplete
		assert.ok(result.toolCall, 'Should parse incomplete XML')
		if ('name' in result.toolCall!) {
			assert.strictEqual(result.toolCall.isDone, false)
			assert.strictEqual(result.toolCall.rawParams.uri, '/path/to/file.ts')
		}
	})

	test('Handle unescaped special characters', () => {
		const toolDef = createToolDef('edit_file', ['uri', 'content'])
		const tools = toolOfToolName([toolDef])
		const toolId = generateUuid()

		const xml = `<edit_file>
<uri>/path/to/file.ts</uri>
<content>Code with < and > symbols & "quotes"</content>
</edit_file>`

		const result = parserService.parseToolCall('edit_file' as ToolName, toolId, xml, tools)

		assert.ok(result.toolCall, 'Should parse XML with unescaped characters')
		assert.ok(result.recoveryActions && result.recoveryActions.length > 0, 'Should have recovery actions')
		if ('name' in result.toolCall!) {
			const content = result.toolCall.rawParams?.content
			assert.ok(content && (content.includes('&lt;') || content.includes('<')), 'Should handle special characters')
		}
	})

	test('Handle mismatched tags (typo in closing tag)', () => {
		const toolDef = createToolDef('read_file', ['uri'])
		const tools = toolOfToolName([toolDef])
		const toolId = generateUuid()

		const xml = `<read_file>
<uri>/path/to/file.ts</url>
</read_file>`

		const result = parserService.parseToolCall('read_file' as ToolName, toolId, xml, tools)

		// Should attempt recovery or use fallback parser
		assert.ok(result.toolCall || result.strategy === 'regex' || result.strategy === 'streaming', 'Should handle mismatched tags')
		if (result.toolCall) {
			assert.ok(result.recoveryActions && result.recoveryActions.length > 0, 'Should have recovery actions for mismatched tags')
		}
	})

	test('Handle malformed XML with regex fallback', () => {
		const toolDef = createToolDef('read_file', ['uri'])
		const tools = toolOfToolName([toolDef])
		const toolId = generateUuid()

		const xml = `<read_file>
<uri>/path/to/file.ts
</read_file>`

		const result = parserService.parseToolCall('read_file' as ToolName, toolId, xml, tools)

		// Should use regex fallback for very malformed XML
		assert.ok(result.toolCall || result.strategy === 'regex', 'Should attempt regex fallback')
	})

	test('Handle empty parameters', () => {
		const toolDef = createToolDef('read_file', ['uri', 'start_line'])
		const tools = toolOfToolName([toolDef])
		const toolId = generateUuid()

		const xml = `<read_file>
<uri>/path/to/file.ts</uri>
<start_line></start_line>
</read_file>`

		const result = parserService.parseToolCall('read_file' as ToolName, toolId, xml, tools)

		assert.ok(result.toolCall, 'Should parse tool call with empty parameter')
		if ('name' in result.toolCall!) {
			assert.strictEqual(result.toolCall.rawParams.uri, '/path/to/file.ts')
			assert.strictEqual(result.toolCall.rawParams.start_line, '')
		}
	})

	test('Handle tool with no parameters', () => {
		const toolDef = createToolDef('simple_tool', [])
		const tools = toolOfToolName([toolDef])
		const toolId = generateUuid()

		const xml = `<simple_tool>
</simple_tool>`

		const result = parserService.parseToolCall('simple_tool' as ToolName, toolId, xml, tools)

		assert.ok(result.toolCall, 'Should parse tool call with no parameters')
		if ('name' in result.toolCall!) {
			assert.strictEqual(result.toolCall.isDone, true)
			assert.strictEqual(Object.keys(result.toolCall.rawParams).length, 0)
		}
	})

	test('Fail gracefully when tool definition not found', () => {
		const tools = toolOfToolName([])
		const toolId = generateUuid()

		const xml = `<unknown_tool>
<param>value</param>
</unknown_tool>`

		const result = parserService.parseToolCall('unknown_tool' as ToolName, toolId, xml, tools)

		assert.strictEqual(result.strategy, 'failed')
		assert.ok(result.error, 'Should have error message')
	})

	test('Track recovery actions', () => {
		const toolDef = createToolDef('edit_file', ['content'])
		const tools = toolOfToolName([toolDef])
		const toolId = generateUuid()

		const xml = `<edit_file>
<content>Text with & unescaped</content>
</edit_file>`

		const result = parserService.parseToolCall('edit_file' as ToolName, toolId, xml, tools)

		// Should track recovery actions if any were taken
		if (result.recoveryActions && result.recoveryActions.length > 0) {
			assert.ok(result.recoveryActions.some(a => a.includes('Escaped')), 'Should track character escaping')
		}
	})

	test('Handle streaming interruption (mid-tag)', () => {
		const toolDef = createToolDef('read_file', ['uri'])
		const tools = toolOfToolName([toolDef])
		const toolId = generateUuid()

		const xml = `<read_file>
<uri>/path/to/fi`

		const result = parserService.parseToolCall('read_file' as ToolName, toolId, xml, tools)

		// Should handle incomplete streaming gracefully
		assert.ok(result.toolCall === null || ('name' in result.toolCall! && result.toolCall!.isDone === false), 'Should handle incomplete streaming')
	})
})

