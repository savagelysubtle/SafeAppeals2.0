/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ILLMMessageService } from '../../common/sendLLMMessageService.js';
import { IVoidSettingsService } from '../../common/voidSettingsService.js';
import { FileChange, FileMetadata } from './types.js';

export interface AIClassificationResult {
	suggestedName: string;
	tags: string[];
	confidence: number;
	reasoning: string;
	projectName?: string;
	fileType?: string;
	version?: string;
}

export class AIFileClassifier {
	constructor(
		private readonly llmMessageService: ILLMMessageService,
		private readonly voidSettingsService: IVoidSettingsService
	) { }

	async classifyFile(file: FileMetadata): Promise<AIClassificationResult | null> {
		const prompt = this.buildClassificationPrompt(file);

		return new Promise((resolve) => {
			let fullResponse = '';

			const modelSelection = this.voidSettingsService.state.modelSelectionOfFeature['Chat'];

			if (!modelSelection) {
				resolve(null);
				return;
			}

			const modelSelectionOptions = this.voidSettingsService.state.optionsOfModelSelection['Chat'][modelSelection.providerName]?.[modelSelection.modelName];
			const overridesOfModel = this.voidSettingsService.state.overridesOfModel;

			this.llmMessageService.sendLLMMessage({
				messagesType: 'chatMessages',
				messages: [
					{
						role: 'system',
						content: 'You are a file organization assistant. Analyze file names and suggest appropriate naming and tagging. Respond ONLY with valid JSON.'
					},
					{
						role: 'user',
						content: prompt
					}
				],
				separateSystemMessage: undefined,
				chatMode: null,
				modelSelection,
				modelSelectionOptions,
				overridesOfModel,
				logging: { loggingName: 'file-organizer-classify' },
				onText: ({ fullText }) => {
					fullResponse = fullText;
				},
				onFinalMessage: () => {
					const result = this.parseAIResponse(fullResponse, file);
					resolve(result);
				},
				onError: ({ message }) => {
					console.error('AI classification error:', message);
					resolve(null);
				},
				onAbort: () => {
					resolve(null);
				}
			});
		});
	}

	async classifyFiles(files: FileMetadata[]): Promise<FileChange[]> {
		const changes: FileChange[] = [];

		for (const file of files) {
			const classification = await this.classifyFile(file);

			if (classification) {
				changes.push({
					original: file,
					proposed: {
						name: classification.suggestedName,
						tags: classification.tags,
						location: file.uri
					},
					confidence: classification.confidence,
					reasoning: classification.reasoning
				});
			}
		}

		return changes;
	}

	private buildClassificationPrompt(file: FileMetadata): string {
		return `Analyze this file and suggest:
1. An appropriate filename following the convention: ProjectName_FileType_Version (e.g., AppRedesign_Wireframe_v2.fig)
2. 3-5 relevant tags
3. Project name (extracted from filename)
4. File type (Wireframe, Mockup, Prototype, Design, Document, etc.)
5. Version number (v1, v2, etc.)

File information:
- Current name: ${file.name}
- Extension: ${file.extension}
- Size: ${file.size} bytes

Respond ONLY with valid JSON in this exact format:
{
  "suggestedName": "ProjectName_FileType_Version.ext",
  "tags": ["tag1", "tag2", "tag3"],
  "projectName": "ProjectName",
  "fileType": "FileType",
  "version": "v1",
  "confidence": 0.85,
  "reasoning": "Brief explanation"
}`;
	}

	private parseAIResponse(response: string, file: FileMetadata): AIClassificationResult | null {
		try {
			// Try to extract JSON from the response
			const jsonMatch = response.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				console.warn('No JSON found in AI response');
				return this.createFallbackClassification(file);
			}

			const parsed = JSON.parse(jsonMatch[0]);

			// Validate the response structure
			if (!parsed.suggestedName || !Array.isArray(parsed.tags)) {
				console.warn('Invalid AI response structure');
				return this.createFallbackClassification(file);
			}

			// Ensure the suggested name has the correct extension
			if (!parsed.suggestedName.endsWith('.' + file.extension)) {
				parsed.suggestedName = parsed.suggestedName.replace(/\.[^.]*$/, '') + '.' + file.extension;
			}

			return {
				suggestedName: parsed.suggestedName,
				tags: parsed.tags || [],
				confidence: parsed.confidence || 0.7,
				reasoning: parsed.reasoning || 'AI-generated classification',
				projectName: parsed.projectName,
				fileType: parsed.fileType,
				version: parsed.version
			};
		} catch (error) {
			console.error('Failed to parse AI response:', error);
			return this.createFallbackClassification(file);
		}
	}

	private createFallbackClassification(file: FileMetadata): AIClassificationResult {
		// Create a reasonable fallback classification
		const tags = [file.extension];

		// Add tags based on file type
		if (['fig', 'sketch', 'xd'].includes(file.extension)) {
			tags.push('design');
		} else if (['pdf', 'docx', 'doc'].includes(file.extension)) {
			tags.push('document');
		} else if (['png', 'jpg', 'jpeg', 'svg'].includes(file.extension)) {
			tags.push('image');
		}

		return {
			suggestedName: file.name,
			tags,
			confidence: 0.5,
			reasoning: 'Fallback classification (AI unavailable)'
		};
	}
}

