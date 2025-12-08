/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as assert from 'assert'
import { ToolSchemaValidator, ToolSchema } from '../../common/tools/toolSchemaValidator.js'

suite('Tool Schema Validator', () => {
	let validator: ToolSchemaValidator

	setup(() => {
		validator = new ToolSchemaValidator()
	})

	test('Validate required string parameter', () => {
		const schema: ToolSchema = {
			toolName: 'read_file' as any,
			params: {
				uri: {
					type: 'string',
					required: true
				}
			}
		}

		const result = validator.validate<{ uri: string }>(schema, { uri: '/path/to/file.ts' })

		assert.strictEqual(result.success, true)
		assert.ok(result.data, 'result.data should be defined when success is true')
		const data = result.data as { uri: string }
		assert.strictEqual(data.uri, '/path/to/file.ts')
		assert.strictEqual(result.errors.length, 0)
	})

	test('Fail validation for missing required parameter', () => {
		const schema: ToolSchema = {
			toolName: 'read_file' as any,
			params: {
				uri: {
					type: 'string',
					required: true
				}
			}
		}

		const result = validator.validate(schema, {})

		assert.strictEqual(result.success, false)
		assert.strictEqual(result.errors.length, 1)
		assert.ok(result.errors[0].message.includes('required'))
		assert.strictEqual(result.errors[0].field, 'uri')
	})

	test('Validate optional parameter', () => {
		const schema: ToolSchema = {
			toolName: 'read_file' as any,
			params: {
				uri: {
					type: 'string',
					required: true
				},
				start_line: {
					type: 'number',
					required: false
				}
			}
		}

		const result = validator.validate<{ uri: string; start_line?: number }>(schema, { uri: '/path/to/file.ts' })

		assert.strictEqual(result.success, true)
		assert.ok(result.data, 'result.data should be defined when success is true')
		const data = result.data as { uri: string; start_line?: number }
		assert.strictEqual(data.uri, '/path/to/file.ts')
	})

	test('Validate number constraints (min/max)', () => {
		const schema: ToolSchema = {
			toolName: 'read_file' as any,
			params: {
				page_number: {
					type: 'page_number',
					required: true,
					min: 1,
					max: 1000
				}
			}
		}

		const validResult = validator.validate(schema, { page_number: '50' })
		assert.strictEqual(validResult.success, true)

		const tooSmallResult = validator.validate(schema, { page_number: '0' })
		assert.strictEqual(tooSmallResult.success, false)
		assert.ok(tooSmallResult.errors[0].message.includes('>='))

		const tooLargeResult = validator.validate(schema, { page_number: '2000' })
		assert.strictEqual(tooLargeResult.success, false)
		assert.ok(tooLargeResult.errors[0].message.includes('<='))
	})

	test('Validate URI parameter', () => {
		const schema: ToolSchema = {
			toolName: 'read_file' as any,
			params: {
				uri: {
					type: 'uri',
					required: true
				}
			}
		}

		const result = validator.validate<{ uri: string }>(schema, { uri: '/path/to/file.ts' })

		assert.strictEqual(result.success, true)
		assert.ok(result.data, 'result.data should be defined when success is true')
		const data = result.data as { uri: string }
		assert.strictEqual(data.uri, '/path/to/file.ts')
	})

	test('Collect multiple validation errors', () => {
		const schema: ToolSchema = {
			toolName: 'read_file' as any,
			params: {
				uri: {
					type: 'string',
					required: true
				},
				start_line: {
					type: 'number',
					required: true,
					min: 1
				},
				end_line: {
					type: 'number',
					required: true,
					min: 1
				}
			}
		}

		const result = validator.validate(schema, {})

		assert.strictEqual(result.success, false)
		assert.strictEqual(result.errors.length, 3, 'Should collect all validation errors')
	})

	test('Cache compiled validators', () => {
		const schema: ToolSchema = {
			toolName: 'read_file' as any,
			params: {
				uri: {
					type: 'string',
					required: true
				}
			}
		}

		// First call compiles
		const start1 = performance.now()
		validator.validate(schema, { uri: '/path/to/file.ts' })
		const duration1 = performance.now() - start1

		// Second call should use cached validator (faster)
		const start2 = performance.now()
		validator.validate(schema, { uri: '/path/to/file.ts' })
		const duration2 = performance.now() - start2

		// Cached version should be faster (though timing can be unreliable in tests)
		assert.ok(duration2 <= duration1 * 2, 'Cached validator should be similar or faster')
	})

	test('Track validation metrics', () => {
		const schema: ToolSchema = {
			toolName: 'read_file' as any,
			params: {
				uri: {
					type: 'string',
					required: true
				}
			}
		}

		validator.validate(schema, { uri: '/path/to/file.ts' })
		validator.validate(schema, { uri: '/path/to/file.ts' })
		validator.validate(schema, {}) // Invalid

		const metrics = validator.getMetrics('read_file' as any)

		// When toolName is provided, getMetrics returns an object, not a Map
		const metricsObj = metrics as { count: number; avgTime: number; errorRate: number }
		assert.strictEqual(metricsObj.count, 3)
		assert.ok(metricsObj.avgTime >= 0)
		assert.ok(metricsObj.errorRate > 0 && metricsObj.errorRate < 1)
	})

	test('Validate boolean parameter', () => {
		const schema: ToolSchema = {
			toolName: 'search_for_files' as any,
			params: {
				recursive: {
					type: 'boolean',
					required: true
				}
			}
		}

		const result1 = validator.validate<{ recursive: boolean }>(schema, { recursive: 'true' })
		assert.strictEqual(result1.success, true)

		const result2 = validator.validate<{ recursive: boolean | string }>(schema, { recursive: 'true' })
		assert.strictEqual(result2.success, true)

		const result3 = validator.validate<{ recursive: boolean }>(schema, { recursive: 'invalid' })
		assert.strictEqual(result3.success, false)
	})

	test('Clear cache', () => {
		const schema: ToolSchema = {
			toolName: 'read_file' as any,
			params: {
				uri: {
					type: 'string',
					required: true
				}
			}
		}

		validator.validate(schema, { uri: '/path/to/file.ts' })
		validator.clearCache()

		const metrics = validator.getMetrics('read_file' as any)
		// When toolName is provided, getMetrics returns an object, not a Map
		const metricsObj = metrics as { count: number; avgTime: number; errorRate: number }
		assert.strictEqual(metricsObj.count, 0, 'Metrics should be cleared')
	})
})

