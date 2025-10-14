/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import * as vscode from 'vscode';
import { Logger } from '../logger';

export interface AIRequest {
	action: 'summarize' | 'grammar' | 'improve' | 'translate';
	content: string;
	options?: Record<string, any>;
}

export interface AIResponse {
	success: boolean;
	result?: string;
	error?: string;
	metadata?: Record<string, any>;
}

export interface SpellCheckRequest {
	content: string;
	language?: string;
}

export interface SpellCheckResponse {
	success: boolean;
	errors?: Array<{
		word: string;
		start: number;
		end: number;
		suggestions: string[];
	}>;
	error?: string;
}

export class AIDispatcher {
	private readonly logger: Logger;
	private readonly aiProviders = new Map<string, (request: AIRequest) => Promise<AIResponse>>();
	private readonly spellCheckProviders = new Map<string, (request: SpellCheckRequest) => Promise<SpellCheckResponse>>();

	constructor(logger: Logger) {
		this.logger = logger;
		this.setupDefaultProviders();
	}

	/**
	 * Setup default AI providers
	 */
	private setupDefaultProviders(): void {
		// Default AI provider (placeholder)
		this.registerAIProvider('default', async (request: AIRequest): Promise<AIResponse> => {
			this.logger.info(`AI request: ${request.action}`);

			// Simulate AI processing
			await new Promise(resolve => setTimeout(resolve, 1000));

			switch (request.action) {
				case 'summarize':
					return {
						success: true,
						result: `Summary: ${request.content.substring(0, 100)}...`,
						metadata: { wordCount: 0 }
					};
				case 'grammar':
					return {
						success: true,
						result: request.content, // No changes for demo
						metadata: { issuesFound: 0 }
					};
				case 'improve':
					return {
						success: true,
						result: request.content, // No changes for demo
						metadata: { improvements: 0 }
					};
				case 'translate':
					return {
						success: true,
						result: request.content, // No translation for demo
						metadata: { targetLanguage: request.options?.targetLanguage || 'en' }
					};
				default:
					return {
						success: false,
						error: `Unknown AI action: ${request.action}`
					};
			}
		});

		// Default spell check provider
		this.registerSpellCheckProvider('default', async (request: SpellCheckRequest): Promise<SpellCheckResponse> => {
			this.logger.info('Spell check request');

			// Simple spell check simulation
			const words = request.content.split(/\s+/);
			const errors: Array<{ word: string; start: number; end: number; suggestions: string[] }> = [];

			// Check for common misspellings
			const commonMisspellings = new Map([
				['teh', 'the'],
				['adn', 'and'],
				['recieve', 'receive'],
				['seperate', 'separate'],
				['occured', 'occurred']
			]);

			let currentPos = 0;
			for (const word of words) {
				const cleanWord = word.replace(/[^\w]/g, '');
				if (commonMisspellings.has(cleanWord.toLowerCase())) {
					errors.push({
						word: cleanWord,
						start: currentPos,
						end: currentPos + cleanWord.length,
						suggestions: [commonMisspellings.get(cleanWord.toLowerCase())!]
					});
				}
				currentPos += word.length + 1; // +1 for space
			}

			return {
				success: true,
				errors
			};
		});
	}

	/**
	 * Register an AI provider
	 */
	registerAIProvider(name: string, provider: (request: AIRequest) => Promise<AIResponse>): void {
		this.aiProviders.set(name, provider);
		this.logger.info(`Registered AI provider: ${name}`);
	}

	/**
	 * Register a spell check provider
	 */
	registerSpellCheckProvider(name: string, provider: (request: SpellCheckRequest) => Promise<SpellCheckResponse>): void {
		this.spellCheckProviders.set(name, provider);
		this.logger.info(`Registered spell check provider: ${name}`);
	}

	/**
	 * Process AI request
	 */
	async processAIRequest(request: AIRequest, providerName: string = 'default'): Promise<AIResponse> {
		try {
			const provider = this.aiProviders.get(providerName);
			if (!provider) {
				return {
					success: false,
					error: `AI provider '${providerName}' not found`
				};
			}

			this.logger.info(`Processing AI request with provider: ${providerName}`);

			const response = await provider(request);

			this.logger.info(`AI request completed`);

			return response;
		} catch (error) {
			this.logger.error('AI request failed:', error);
			return {
				success: false,
				error: `AI request failed: ${error}`
			};
		}
	}

	/**
	 * Process spell check request
	 */
	async processSpellCheckRequest(request: SpellCheckRequest, providerName: string = 'default'): Promise<SpellCheckResponse> {
		try {
			const provider = this.spellCheckProviders.get(providerName);
			if (!provider) {
				return {
					success: false,
					error: `Spell check provider '${providerName}' not found`
				};
			}

			this.logger.info(`Processing spell check request with provider: ${providerName}`);

			const response = await provider(request);

			this.logger.info(`Spell check request completed`);

			return response;
		} catch (error) {
			this.logger.error('Spell check request failed:', error);
			return {
				success: false,
				error: `Spell check request failed: ${error}`
			};
		}
	}

	/**
	 * Get available AI providers
	 */
	getAIProviders(): string[] {
		return Array.from(this.aiProviders.keys());
	}

	/**
	 * Get available spell check providers
	 */
	getSpellCheckProviders(): string[] {
		return Array.from(this.spellCheckProviders.keys());
	}

	/**
	 * Remove AI provider
	 */
	removeAIProvider(name: string): boolean {
		return this.aiProviders.delete(name);
	}

	/**
	 * Remove spell check provider
	 */
	removeSpellCheckProvider(name: string): boolean {
		return this.spellCheckProviders.delete(name);
	}

	/**
	 * Check if AI provider exists
	 */
	hasAIProvider(name: string): boolean {
		return this.aiProviders.has(name);
	}

	/**
	 * Check if spell check provider exists
	 */
	hasSpellCheckProvider(name: string): boolean {
		return this.spellCheckProviders.has(name);
	}

	/**
	 * Get AI provider info
	 */
	getAIProviderInfo(name: string): { name: string; available: boolean } {
		return {
			name,
			available: this.aiProviders.has(name)
		};
	}

	/**
	 * Get spell check provider info
	 */
	getSpellCheckProviderInfo(name: string): { name: string; available: boolean } {
		return {
			name,
			available: this.spellCheckProviders.has(name)
		};
	}

	/**
	 * Test AI provider
	 */
	async testAIProvider(name: string): Promise<{ success: boolean; error?: string }> {
		try {
			const provider = this.aiProviders.get(name);
			if (!provider) {
				return { success: false, error: `Provider '${name}' not found` };
			}

			const testRequest: AIRequest = {
				action: 'summarize',
				content: 'This is a test request.',
				options: {}
			};

			const response = await provider(testRequest);
			return { success: response.success, error: response.error };
		} catch (error) {
			return { success: false, error: `Test failed: ${error}` };
		}
	}

	/**
	 * Test spell check provider
	 */
	async testSpellCheckProvider(name: string): Promise<{ success: boolean; error?: string }> {
		try {
			const provider = this.spellCheckProviders.get(name);
			if (!provider) {
				return { success: false, error: `Provider '${name}' not found` };
			}

			const testRequest: SpellCheckRequest = {
				content: 'This is a test with teh word misspelled.',
				language: 'en'
			};

			const response = await provider(testRequest);
			return { success: response.success, error: response.error };
		} catch (error) {
			return { success: false, error: `Test failed: ${error}` };
		}
	}

	/**
	 * Dispose the AI dispatcher
	 */
	dispose(): void {
		this.logger.info('Disposing AI dispatcher');
		this.aiProviders.clear();
		this.spellCheckProviders.clear();
	}
}
