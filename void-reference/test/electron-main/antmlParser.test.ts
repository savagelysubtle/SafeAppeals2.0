/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Test suite for ANTML Parser
 *
 * Tests the parsing of Anthropic Tool Markup Language (ANTML) format:
 * <function_calls><invoke name="tool"><parameter name="param">value</parameter></invoke></function_calls>
 */

import * as assert from 'assert';
import { InternalToolInfo } from '../../common/prompt/prompts.js';
import { XMLParserService } from '../../electron-main/llmMessage/xmlParserService.js';

suite('ANTML Parser Tests', () => {
	let parserService: XMLParserService;
	let toolDefs: { [toolName: string]: InternalToolInfo | undefined };

	setup(() => {
		parserService = new XMLParserService();

		// Define test tools
		toolDefs = {
			'read_file': {
				name: 'read_file',
				description: 'Reads a file',
				params: {
					'uri': { description: 'File path' }
				}
			},
			'rag_search_reference': {
				name: 'rag_search_reference',
				description: 'Searches policy',
				params: {
					'query': { description: 'Search query' },
					'limit': { description: 'Result limit' }
				}
			},
			'edit_file': {
				name: 'edit_file',
				description: 'Edits a file',
				params: {
					'uri': { description: 'File path' },
					'search_replace_blocks': { description: 'Edit blocks' }
				}
			}
		};
	});

	test('should parse single tool call', () => {
		const xml = `<function_calls>
			<invoke name="read_file">
				<parameter name="uri">test.pdf</parameter>
			</invoke>
		</function_calls>`;

		const result = parserService.parseToolCall(undefined, 'test-id', xml, toolDefs);

		assert.strictEqual(result.strategy, 'antml', 'Should use ANTML strategy');
		assert.ok(result.toolCall, 'Should have tool call');

		if (result.toolCall && 'name' in result.toolCall) {
			assert.strictEqual(result.toolCall.name, 'read_file', 'Should parse tool name');
			assert.strictEqual(result.toolCall.rawParams.uri, 'test.pdf', 'Should parse parameter');
			assert.strictEqual(result.toolCall.isDone, true, 'Should mark as done');
		} else {
			assert.fail('Expected single tool call');
		}
	});

	test('should parse multiple tool calls in parallel', () => {
		const xml = `<function_calls>
			<invoke name="read_file">
				<parameter name="uri">file1.pdf</parameter>
			</invoke>
			<invoke name="read_file">
				<parameter name="uri">file2.pdf</parameter>
			</invoke>
		</function_calls>`;

		const result = parserService.parseToolCall(undefined, 'test-id', xml, toolDefs);

		assert.strictEqual(result.strategy, 'antml', 'Should use ANTML strategy');
		assert.ok(result.toolCall, 'Should have tool call');

		if (result.toolCall && 'toolCalls' in result.toolCall) {
			assert.strictEqual(result.toolCall.toolCalls.length, 2, 'Should have 2 tool calls');
			assert.strictEqual(result.toolCall.format, 'antml', 'Should mark as ANTML format');
			assert.strictEqual(result.toolCall.toolCalls[0].name, 'read_file', 'First tool should be read_file');
			assert.strictEqual(result.toolCall.toolCalls[1].name, 'read_file', 'Second tool should be read_file');
			assert.strictEqual(result.toolCall.toolCalls[0].rawParams.uri, 'file1.pdf', 'First tool param');
			assert.strictEqual(result.toolCall.toolCalls[1].rawParams.uri, 'file2.pdf', 'Second tool param');
		} else {
			assert.fail('Expected multiple tool calls');
		}
	});

	test('should parse multiple different tools', () => {
		const xml = `<function_calls>
			<invoke name="read_file">
				<parameter name="uri">test.pdf</parameter>
			</invoke>
			<invoke name="rag_search_reference">
				<parameter name="query">appeal requirements</parameter>
				<parameter name="limit">5</parameter>
			</invoke>
		</function_calls>`;

		const result = parserService.parseToolCall(undefined, 'test-id', xml, toolDefs);

		assert.ok(result.toolCall, 'Should have tool call');

		if (result.toolCall && 'toolCalls' in result.toolCall) {
			assert.strictEqual(result.toolCall.toolCalls.length, 2, 'Should have 2 tool calls');
			assert.strictEqual(result.toolCall.toolCalls[0].name, 'read_file', 'First tool');
			assert.strictEqual(result.toolCall.toolCalls[1].name, 'rag_search_reference', 'Second tool');
			assert.strictEqual(result.toolCall.toolCalls[1].rawParams.query, 'appeal requirements', 'Second tool query');
			assert.strictEqual(result.toolCall.toolCalls[1].rawParams.limit, '5', 'Second tool limit');
		} else {
			assert.fail('Expected multiple tool calls');
		}
	});

	test('should handle text before function_calls', () => {
		const xml = `I'll read those files for you.

		<function_calls>
			<invoke name="read_file">
				<parameter name="uri">test.pdf</parameter>
			</invoke>
		</function_calls>`;

		const result = parserService.parseToolCall(undefined, 'test-id', xml, toolDefs);

		assert.ok(result.toolCall, 'Should parse despite text before');
		assert.strictEqual(result.strategy, 'antml', 'Should use ANTML strategy');
	});

	test('should handle Windows paths with forward slashes', () => {
		const xml = `<function_calls>
			<invoke name="read_file">
				<parameter name="uri">d:/path/to/file.pdf</parameter>
			</invoke>
		</function_calls>`;

		const result = parserService.parseToolCall(undefined, 'test-id', xml, toolDefs);

		if (result.toolCall && 'name' in result.toolCall) {
			assert.strictEqual(result.toolCall.rawParams.uri, 'd:/path/to/file.pdf', 'Should handle forward slashes');
		} else {
			assert.fail('Expected single tool call');
		}
	});

	test('should handle Windows paths with escaped backslashes', () => {
		const xml = `<function_calls>
			<invoke name="read_file">
				<parameter name="uri">d:\\\\path\\\\to\\\\file.pdf</parameter>
			</invoke>
		</function_calls>`;

		const result = parserService.parseToolCall(undefined, 'test-id', xml, toolDefs);

		if (result.toolCall && 'name' in result.toolCall) {
			assert.ok(result.toolCall.rawParams.uri?.includes('path'), 'Should handle escaped backslashes');
		} else {
			assert.fail('Expected single tool call');
		}
	});

	test('should fail gracefully when no function_calls wrapper', () => {
		const xml = `<read_file>
			<parameter name="uri">test.pdf</parameter>
		</read_file>`;

		const result = parserService.parseToolCall(undefined, 'test-id', xml, toolDefs);

		assert.strictEqual(result.strategy, 'failed', 'Should fail without function_calls wrapper');
		assert.strictEqual(result.toolCall, null, 'Should not have tool call');
		assert.ok(result.error?.includes('No <function_calls>'), 'Should have descriptive error');
	});

	test('should skip unknown tools', () => {
		const xml = `<function_calls>
			<invoke name="unknown_tool">
				<parameter name="param">value</parameter>
			</invoke>
			<invoke name="read_file">
				<parameter name="uri">test.pdf</parameter>
			</invoke>
		</function_calls>`;

		const result = parserService.parseToolCall(undefined, 'test-id', xml, toolDefs);

		if (result.toolCall && 'name' in result.toolCall) {
			// Should only parse the known tool
			assert.strictEqual(result.toolCall.name, 'read_file', 'Should skip unknown tool');
		} else {
			assert.fail('Expected single tool call (unknown tool should be skipped)');
		}
	});

	test('should handle compact single-line format', () => {
		const xml = `<function_calls><invoke name="read_file"><parameter name="uri">test.pdf</parameter></invoke></function_calls>`;

		const result = parserService.parseToolCall(undefined, 'test-id', xml, toolDefs);

		assert.ok(result.toolCall, 'Should parse compact format');
		assert.strictEqual(result.strategy, 'antml', 'Should use ANTML strategy');
	});

	test('should handle parameters with special characters', () => {
		const xml = `<function_calls>
			<invoke name="rag_search_reference">
				<parameter name="query">workers' compensation &amp; appeals</parameter>
				<parameter name="limit">5</parameter>
			</invoke>
		</function_calls>`;

		const result = parserService.parseToolCall(undefined, 'test-id', xml, toolDefs);

		if (result.toolCall && 'name' in result.toolCall) {
			assert.ok(result.toolCall.rawParams.query?.includes('compensation'), 'Should handle special characters');
		} else {
			assert.fail('Expected single tool call');
		}
	});
});

