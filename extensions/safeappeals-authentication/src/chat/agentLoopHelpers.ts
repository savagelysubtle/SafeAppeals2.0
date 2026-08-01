/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Soft cap on model → tool → model rounds for a single chat request. */
export const MAX_AGENT_ITERATIONS = 25;

export type AgentLoopStopReason = 'done' | 'maxIterations' | 'cancelled';

export type AgentLoopDecision =
	| { kind: 'continue' }
	| { kind: 'stop'; reason: AgentLoopStopReason };

/**
 * Pure control for the agent loop — continues while the model requested tools
 * and we have not hit the iteration cap or cancellation.
 */
export function nextAgentLoopDecision(options: {
	iteration: number;
	maxIterations: number;
	toolCallCount: number;
	cancelled: boolean;
}): AgentLoopDecision {
	if (options.cancelled) {
		return { kind: 'stop', reason: 'cancelled' };
	}
	if (options.iteration >= options.maxIterations) {
		return { kind: 'stop', reason: 'maxIterations' };
	}
	if (options.toolCallCount <= 0) {
		return { kind: 'stop', reason: 'done' };
	}
	return { kind: 'continue' };
}
