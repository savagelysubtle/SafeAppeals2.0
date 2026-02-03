/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * SafeAppeals Cloud Types
 *
 * Types for the SafeAppeals Cloud credit-based LLM access service.
 * Users can purchase credits to access AI models without managing their own API keys.
 */

// ============================================
// AUTH TYPES
// ============================================

export type CloudAuthStatus = 'signed_out' | 'signing_in' | 'signed_in' | 'error'

export interface CloudUser {
	id: string
	email: string
	displayName: string | null
	avatarUrl: string | null
	createdAt: string
}

export interface CloudSession {
	accessToken: string
	refreshToken: string
	expiresAt: number // Unix timestamp
	user: CloudUser
	// Google provider tokens (for Calendar API access)
	googleProviderToken?: string
	googleProviderRefreshToken?: string
}

export interface CloudAuthState {
	status: CloudAuthStatus
	session: CloudSession | null
	error: string | null
}

// ============================================
// CREDITS TYPES
// ============================================

export interface CreditBalance {
	balance: number // in tokens
	unit: 'tokens'
}

export interface CreditPack {
	id: 'starter' | 'pro'
	name: string
	credits: number
	price: number
	currency: string
	description: string
	popular?: boolean
}

export interface CreditUsage {
	id: string
	model: string
	inputTokens: number
	outputTokens: number
	totalTokens: number
	latencyMs: number
	createdAt: string
}

// ============================================
// LLM TYPES
// ============================================

export interface CloudModel {
	id: string
	name: string
	provider: string
	contextWindow: number
}

export interface CloudChatRequest {
	model: string
	messages: CloudChatMessage[]
	maxTokens?: number
	temperature?: number
	stream?: boolean
	tools?: CloudTool[]
	toolChoice?: 'auto' | 'required' | 'none'
}

/**
 * Tool definition for cloud LLM requests (OpenAI/LiteLLM compatible format)
 */
export interface CloudTool {
	type: 'function'
	function: {
		name: string
		description: string
		parameters: {
			type: 'object'
			properties: { [paramName: string]: { type: string; description: string } }
			required?: string[]
		}
	}
}

export interface CloudChatMessage {
	role: 'system' | 'user' | 'assistant'
	content: string
}

export interface CloudChatResponse {
	id: string
	model: string
	choices: {
		message: CloudChatMessage
		finishReason: string
	}[]
	usage: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
	}
	voidUsage?: {
		creditsUsed: number
		creditsRemaining: number
	}
}

// ============================================
// API ERROR TYPES
// ============================================

export interface CloudApiError {
	code: CloudErrorCode
	message: string
	retryAfter?: number
	required?: number
	available?: number
	purchaseUrl?: string
}

export type CloudErrorCode =
	| 'UNAUTHORIZED'
	| 'INVALID_TOKEN'
	| 'REFRESH_FAILED'
	| 'INSUFFICIENT_CREDITS'
	| 'RATE_LIMITED'
	| 'INVALID_REQUEST'
	| 'LLM_ERROR'
	| 'DATABASE_ERROR'
	| 'CHECKOUT_FAILED'
	| 'INTERNAL_ERROR'

// ============================================
// SETTINGS TYPES
// ============================================

export interface VoidCloudSettings {
	enabled: boolean
	apiUrl: string
}

export const defaultVoidCloudSettings: VoidCloudSettings = {
	enabled: false,
	apiUrl: 'https://api.voidcloud.dev', // Will be replaced with actual URL
}

// ============================================
// SERVICE EVENTS
// ============================================

export interface CloudAuthChangeEvent {
	status: CloudAuthStatus
	user: CloudUser | null
}

export interface CloudBalanceChangeEvent {
	balance: number
	previousBalance: number
}

// ============================================
// CLOUD MODE - Per Provider
// ============================================

/**
 * Cloud mode allows users to use SafeAppeals Cloud credits instead of their own API keys
 * for specific providers. This is configured per-provider.
 */
export type CloudModeOfProvider = {
	[providerName: string]: boolean
}

export const defaultCloudModeOfProvider: CloudModeOfProvider = {
	// All providers default to BYOK mode (cloud mode off)
	// User can enable cloud mode per provider in settings
}

