/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ToolName } from './tools/toolsServiceTypes.js'
import { ParseStrategy } from '../electron-main/llmMessage/xmlParserService.js'

export interface XMLParserMetrics {
	totalParses: number
	successfulParses: number
	failedParses: number
	strategyCounts: Map<ParseStrategy, number>
	recoveryActionCounts: Map<string, number>
	averageParseTime: number
	totalParseTime: number
	toolCallCounts: Map<ToolName, number>
	errorCounts: Map<string, number>
}

export class XMLParserTelemetry {
	private metrics: XMLParserMetrics = {
		totalParses: 0,
		successfulParses: 0,
		failedParses: 0,
		strategyCounts: new Map(),
		recoveryActionCounts: new Map(),
		averageParseTime: 0,
		totalParseTime: 0,
		toolCallCounts: new Map(),
		errorCounts: new Map()
	}

	private parseTimes: number[] = []

	/**
	 * Record a parse attempt
	 */
	recordParse(
		toolName: ToolName,
		strategy: ParseStrategy,
		success: boolean,
		duration: number,
		recoveryActions?: string[],
		error?: string
	): void {
		this.metrics.totalParses++
		this.parseTimes.push(duration)
		this.metrics.totalParseTime += duration
		this.metrics.averageParseTime = this.metrics.totalParseTime / this.metrics.totalParses

		if (success) {
			this.metrics.successfulParses++
		} else {
			this.metrics.failedParses++
		}

		// Track strategy usage
		const strategyCount = this.metrics.strategyCounts.get(strategy) || 0
		this.metrics.strategyCounts.set(strategy, strategyCount + 1)

		// Track tool usage
		const toolCount = this.metrics.toolCallCounts.get(toolName) || 0
		this.metrics.toolCallCounts.set(toolName, toolCount + 1)

		// Track recovery actions
		if (recoveryActions) {
			for (const action of recoveryActions) {
				const actionType = action.split(':')[0] || action // Extract action type
				const actionCount = this.metrics.recoveryActionCounts.get(actionType) || 0
				this.metrics.recoveryActionCounts.set(actionType, actionCount + 1)
			}
		}

		// Track errors
		if (error) {
			const errorType = error.split(':')[0] || error // Extract error type
			const errorCount = this.metrics.errorCounts.get(errorType) || 0
			this.metrics.errorCounts.set(errorType, errorCount + 1)
		}
	}

	/**
	 * Get current metrics
	 */
	getMetrics(): XMLParserMetrics {
		return {
			...this.metrics,
			strategyCounts: new Map(this.metrics.strategyCounts),
			recoveryActionCounts: new Map(this.metrics.recoveryActionCounts),
			toolCallCounts: new Map(this.metrics.toolCallCounts),
			errorCounts: new Map(this.metrics.errorCounts)
		}
	}

	/**
	 * Get success rate percentage
	 */
	getSuccessRate(): number {
		if (this.metrics.totalParses === 0) return 0
		return (this.metrics.successfulParses / this.metrics.totalParses) * 100
	}

	/**
	 * Get percentile parse time (p50, p95, p99)
	 */
	getPercentileTimes(): { p50: number; p95: number; p99: number } {
		if (this.parseTimes.length === 0) {
			return { p50: 0, p95: 0, p99: 0 }
		}

		const sorted = [...this.parseTimes].sort((a, b) => a - b)
		const p50 = sorted[Math.floor(sorted.length * 0.5)]
		const p95 = sorted[Math.floor(sorted.length * 0.95)]
		const p99 = sorted[Math.floor(sorted.length * 0.99)]

		return { p50, p95, p99 }
	}

	/**
	 * Get summary report
	 */
	getSummary(): string {
		const successRate = this.getSuccessRate()
		const percentiles = this.getPercentileTimes()

		const strategyBreakdown = Array.from(this.metrics.strategyCounts.entries())
			.map(([strategy, count]) => `${strategy}: ${count}`)
			.join(', ')

		return `XML Parser Metrics:
- Total Parses: ${this.metrics.totalParses}
- Success Rate: ${successRate.toFixed(2)}%
- Average Parse Time: ${this.metrics.averageParseTime.toFixed(2)}ms
- Parse Time Percentiles: p50=${percentiles.p50.toFixed(2)}ms, p95=${percentiles.p95.toFixed(2)}ms, p99=${percentiles.p99.toFixed(2)}ms
- Strategy Breakdown: ${strategyBreakdown}
- Recovery Actions: ${Array.from(this.metrics.recoveryActionCounts.entries()).map(([a, c]) => `${a}:${c}`).join(', ')}`
	}

	/**
	 * Reset metrics (useful for testing)
	 */
	reset(): void {
		this.metrics = {
			totalParses: 0,
			successfulParses: 0,
			failedParses: 0,
			strategyCounts: new Map(),
			recoveryActionCounts: new Map(),
			averageParseTime: 0,
			totalParseTime: 0,
			toolCallCounts: new Map(),
			errorCounts: new Map()
		}
		this.parseTimes = []
	}
}

// Singleton instance
let telemetryInstance: XMLParserTelemetry | null = null

export function getXMLParserTelemetry(): XMLParserTelemetry {
	if (!telemetryInstance) {
		telemetryInstance = new XMLParserTelemetry()
	}
	return telemetryInstance
}

