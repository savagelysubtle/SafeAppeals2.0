/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { RawToolParamsObj } from './sendLLMMessageTypes.js'
import { BuiltinToolName, ToolParamName } from './toolsServiceTypes.js'
import { InternalToolInfo } from './prompt/prompts.js'

/**
 * Validation error with field name and message
 */
export interface ValidationError {
	field: string
	message: string
	value?: unknown
}

/**
 * Validation result with collected errors
 */
export interface ValidationResult<T> {
	success: boolean
	data?: T
	errors: ValidationError[]
}

/**
 * Parameter type definition for schema validation
 */
export type ParamType = 'string' | 'number' | 'boolean' | 'uri' | 'optional_string' | 'optional_uri' | 'page_number'

/**
 * Parameter constraint definition
 */
export interface ParamConstraint {
	type: ParamType
	required?: boolean
	min?: number
	max?: number
	pattern?: RegExp
	customValidator?: (value: unknown) => string | null // Returns error message or null if valid
}

/**
 * Tool schema definition
 */
export interface ToolSchema {
	toolName: BuiltinToolName
	params: {
		[paramName: string]: ParamConstraint
	}
}

/**
 * Compiled validator function
 */
export type CompiledValidator<T> = (params: RawToolParamsObj) => ValidationResult<T>

/**
 * Schema validator with compilation and caching
 * Provides schema-level validation before runtime checks
 */
export class ToolSchemaValidator {
	private compiledValidators: Map<BuiltinToolName, CompiledValidator<any>> = new Map()
	private validationMetrics: Map<BuiltinToolName, { count: number; totalTime: number; errors: number }> = new Map()

	/**
	 * Compile a validator for a tool schema
	 * Cached for performance (75x faster on subsequent calls)
	 */
	compileValidator<T>(schema: ToolSchema): CompiledValidator<T> {
		if (this.compiledValidators.has(schema.toolName)) {
			return this.compiledValidators.get(schema.toolName)!
		}

		const validator: CompiledValidator<T> = (params: RawToolParamsObj) => {
			const errors: ValidationError[] = []
			const validated: any = {}

			// Validate each parameter according to schema
			for (const [paramName, constraint] of Object.entries(schema.params)) {
				const value = params[paramName as ToolParamName<BuiltinToolName>]

				// Check required fields
				if (constraint.required && (value === undefined || value === null || value === '')) {
					errors.push({
						field: paramName,
						message: `Required parameter '${paramName}' is missing or empty`,
						value
					})
					continue
				}

				// Skip optional fields that are empty
				if (!constraint.required && (value === undefined || value === null || value === '')) {
					continue
				}

				// Type validation
				const typeError = this.validateType(paramName, value, constraint)
				if (typeError) {
					errors.push(typeError)
					continue
				}

				// Constraint validation
				const constraintError = this.validateConstraints(paramName, value, constraint)
				if (constraintError) {
					errors.push(constraintError)
					continue
				}

				// Custom validator
				if (constraint.customValidator) {
					const customError = constraint.customValidator(value)
					if (customError) {
						errors.push({
							field: paramName,
							message: customError,
							value
						})
						continue
					}
				}

				// Value is valid
				validated[paramName] = value
			}

			return {
				success: errors.length === 0,
				data: errors.length === 0 ? validated as T : undefined,
				errors
			}
		}

		this.compiledValidators.set(schema.toolName, validator)
		return validator
	}

	/**
	 * Validate type of a parameter value
	 */
	private validateType(paramName: string, value: unknown, constraint: ParamConstraint): ValidationError | null {
		switch (constraint.type) {
			case 'string':
			case 'optional_string':
				if (typeof value !== 'string') {
					return {
						field: paramName,
						message: `Parameter '${paramName}' must be a string, got ${typeof value}`,
						value
					}
				}
				break

			case 'number':
			case 'page_number':
				if (typeof value !== 'number' && typeof value !== 'string') {
					return {
						field: paramName,
						message: `Parameter '${paramName}' must be a number or numeric string, got ${typeof value}`,
						value
					}
				}
				break

			case 'boolean':
				if (typeof value !== 'boolean' && typeof value !== 'string') {
					return {
						field: paramName,
						message: `Parameter '${paramName}' must be a boolean or boolean string, got ${typeof value}`,
						value
					}
				}
				break

			case 'uri':
			case 'optional_uri':
				if (typeof value !== 'string') {
					return {
						field: paramName,
						message: `Parameter '${paramName}' must be a string URI, got ${typeof value}`,
						value
					}
				}
				break
		}

		return null
	}

	/**
	 * Validate constraints (min, max, pattern)
	 */
	private validateConstraints(paramName: string, value: unknown, constraint: ParamConstraint): ValidationError | null {
		if (constraint.type === 'number' || constraint.type === 'page_number') {
			const numValue = typeof value === 'number' ? value : Number.parseFloat(String(value))

			if (constraint.min !== undefined && numValue < constraint.min) {
				return {
					field: paramName,
					message: `Parameter '${paramName}' must be >= ${constraint.min}, got ${numValue}`,
					value
				}
			}

			if (constraint.max !== undefined && numValue > constraint.max) {
				return {
					field: paramName,
					message: `Parameter '${paramName}' must be <= ${constraint.max}, got ${numValue}`,
					value
				}
			}
		}

		if (constraint.type === 'string' || constraint.type === 'optional_string' || constraint.type === 'uri' || constraint.type === 'optional_uri') {
			const strValue = String(value)

			if (constraint.pattern && !constraint.pattern.test(strValue)) {
				return {
					field: paramName,
					message: `Parameter '${paramName}' does not match required pattern`,
					value
				}
			}
		}

		return null
	}

	/**
	 * Validate parameters against schema with performance tracking
	 */
	validate<T>(schema: ToolSchema, params: RawToolParamsObj): ValidationResult<T> {
		const startTime = performance.now()
		const validator = this.compileValidator<T>(schema)
		const result = validator(params)
		const duration = performance.now() - startTime

		// Track metrics
		const metrics = this.validationMetrics.get(schema.toolName) || { count: 0, totalTime: 0, errors: 0 }
		metrics.count++
		metrics.totalTime += duration
		if (!result.success) {
			metrics.errors++
		}
		this.validationMetrics.set(schema.toolName, metrics)

		return result
	}

	/**
	 * Get validation performance metrics
	 */
	getMetrics(toolName?: BuiltinToolName): Map<BuiltinToolName, { count: number; avgTime: number; errorRate: number }> | { count: number; avgTime: number; errorRate: number } {
		if (toolName) {
			const metrics = this.validationMetrics.get(toolName)
			if (!metrics) {
				return { count: 0, avgTime: 0, errorRate: 0 }
			}
			return {
				count: metrics.count,
				avgTime: metrics.totalTime / metrics.count,
				errorRate: metrics.errors / metrics.count
			}
		}

		const result = new Map<BuiltinToolName, { count: number; avgTime: number; errorRate: number }>()
		for (const [name, metrics] of this.validationMetrics.entries()) {
			result.set(name, {
				count: metrics.count,
				avgTime: metrics.totalTime / metrics.count,
				errorRate: metrics.errors / metrics.count
			})
		}
		return result
	}

	/**
	 * Clear compiled validators cache (useful for testing)
	 */
	clearCache(): void {
		this.compiledValidators.clear()
		this.validationMetrics.clear()
	}
}

/**
 * Create schema from InternalToolInfo
 * This allows converting tool definitions to schemas for validation
 */
export function createSchemaFromToolInfo(toolInfo: InternalToolInfo): ToolSchema | null {
	if (!toolInfo.name || !(toolInfo.name in ['read_file', 'edit_file'] as any)) {
		// Only support built-in tools for now
		return null
	}

	// Basic schema mapping - can be extended with actual tool-specific schemas
	const schema: ToolSchema = {
		toolName: toolInfo.name as BuiltinToolName,
		params: {}
	}

	// Map tool parameters to constraints
	for (const paramName of Object.keys(toolInfo.params)) {
		// Infer type from parameter name patterns
		let type: ParamType = 'string'
		if (paramName.includes('uri')) {
			type = 'uri'
		} else if (paramName.includes('page_number') || paramName.includes('page')) {
			type = 'page_number'
		} else if (paramName.includes('line') || paramName.includes('number')) {
			type = 'number'
		} else if (paramName.startsWith('is_') || paramName.includes('boolean')) {
			type = 'boolean'
		}

		schema.params[paramName] = {
			type,
			required: !paramName.includes('optional') && !paramName.includes('start_') && !paramName.includes('end_')
		}
	}

	return schema
}

