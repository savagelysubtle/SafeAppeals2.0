/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ILLMMessageService } from '../../common/sendLLMMessageService.js';
import { IVoidSettingsService } from '../../common/voidSettingsService.js';
import { CaseInfo, extractEntitiesFromCaseInfo } from './caseConfig.js';
import { EntityMatch, FileChange, FileMetadata } from './types.js';

export interface AIClassificationResult {
	suggestedName: string;
	tags: string[];
	confidence: number;
	reasoning: string;
	projectName?: string;
	fileType?: string;
	version?: string;
	side?: 'YourSide' | 'TheirSide' | 'Neutral';
	category?: 'Medical' | 'Legal' | 'Correspondence' | 'Evidence' | 'Decision' | 'Other';
	entityMatches?: EntityMatch[];
	suggestedFolder?: string;
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

	async classifyFileWithContext(file: FileMetadata, caseInfo: CaseInfo): Promise<AIClassificationResult | null> {
		const prompt = this.buildContextAwarePrompt(file, caseInfo);

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
						content: 'You are a legal file organization assistant specializing in workers compensation cases. Analyze files in the context of the provided case information and classify them intelligently. Respond ONLY with valid JSON.'
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
				logging: { loggingName: 'file-organizer-classify-context' },
				onText: ({ fullText }) => {
					fullResponse = fullText;
				},
				onFinalMessage: () => {
					const result = this.parseContextAwareResponse(fullResponse, file, caseInfo);
					resolve(result);
				},
				onError: ({ message }) => {
					console.error('AI classification with context error:', message);
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

	private buildContextAwarePrompt(file: FileMetadata, caseInfo: CaseInfo): string {
		const entities = extractEntitiesFromCaseInfo(caseInfo);

		// Build entity lists grouped by side
		const yourSideEntities = entities.filter(e => e.side === 'YourSide');
		const theirSideEntities = entities.filter(e => e.side === 'TheirSide');
		const neutralEntities = entities.filter(e => e.side === 'Neutral');

		// Build entity sections
		const buildEntityList = (entityList: typeof entities) => {
			const byType: Record<string, string[]> = {};
			entityList.forEach(e => {
				if (!byType[e.type]) {
					byType[e.type] = [];
				}
				byType[e.type].push(e.name);
			});

			return Object.entries(byType)
				.map(([type, names]) => `  ${type}s: ${names.join(', ')}`)
				.join('\n');
		};

		const yourSideSection = yourSideEntities.length > 0 ? `
Your Side (Claimant):
${buildEntityList(yourSideEntities)}` : '';

		const theirSideSection = theirSideEntities.length > 0 ? `
Their Side (Employer/WCB/Defense):
${buildEntityList(theirSideEntities)}` : '';

		const neutralSection = neutralEntities.length > 0 ? `
Neutral Parties:
${buildEntityList(neutralEntities)}` : '';

		return `You are classifying a file for a ${caseInfo.caseType} case.

## CASE CONTEXT
${caseInfo.caseNumber ? `Case Number: ${caseInfo.caseNumber}` : ''}
${caseInfo.claimantName ? `Claimant: ${caseInfo.claimantName}` : ''}
${caseInfo.injuryDate ? `Injury Date: ${caseInfo.injuryDate}` : ''}
${caseInfo.description ? `Description: ${caseInfo.description}` : ''}

## KNOWN ENTITIES${yourSideSection}${theirSideSection}${neutralSection}

## KEYWORDS
Your Side: ${caseInfo.keywords.yourSide.join(', ')}
Their Side: ${caseInfo.keywords.theirSide.join(', ')}
Medical: ${caseInfo.keywords.medical.join(', ')}
Legal: ${caseInfo.keywords.legal.join(', ')}
Evidence: ${caseInfo.keywords.evidence.join(', ')}

## FILE TO CLASSIFY
- Filename: ${file.name}
- Extension: ${file.extension}
- Size: ${file.size} bytes

## TASK
Analyze this file and determine:
1. Which side it belongs to (YourSide, TheirSide, or Neutral)
2. What category it falls into (Medical, Legal, Correspondence, Evidence, Decision, Other)
3. If any known entities are mentioned in the filename (e.g., doctor names, lawyer names)
4. Appropriate tags for organization
5. Suggested folder path

Respond ONLY with valid JSON in this exact format:
{
  "side": "YourSide" | "TheirSide" | "Neutral",
  "category": "Medical" | "Legal" | "Correspondence" | "Evidence" | "Decision" | "Other",
  "entityMatches": [
    {
      "entityName": "Dr. Smith",
      "entityType": "doctor",
      "side": "YourSide",
      "confidence": 0.95
    }
  ],
  "suggestedTags": ["medical", "treating-physician", "dr-smith"],
  "suggestedFolder": "Medical/YourSide",
  "suggestedName": "${file.name}",
  "confidence": 0.85,
  "reasoning": "File appears to be a medical report from Dr. Smith, who is listed as a treating physician for the claimant."
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

	private parseContextAwareResponse(response: string, file: FileMetadata, caseInfo: CaseInfo): AIClassificationResult | null {
		try {
			// Try to extract JSON from the response
			const jsonMatch = response.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				console.warn('No JSON found in AI response');
				return this.createFallbackClassification(file);
			}

			const parsed = JSON.parse(jsonMatch[0]);

			// Validate the response structure
			if (!parsed.side || !parsed.category) {
				console.warn('Invalid AI response structure - missing required fields');
				return this.createFallbackClassification(file);
			}

			// Ensure the suggested name has the correct extension
			let suggestedName = parsed.suggestedName || file.name;
			if (!suggestedName.endsWith('.' + file.extension)) {
				suggestedName = suggestedName.replace(/\.[^.]*$/, '') + '.' + file.extension;
			}

			return {
				suggestedName,
				tags: parsed.suggestedTags || [],
				confidence: parsed.confidence || 0.7,
				reasoning: parsed.reasoning || 'AI-generated classification with case context',
				side: parsed.side,
				category: parsed.category,
				entityMatches: parsed.entityMatches || [],
				suggestedFolder: parsed.suggestedFolder
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
			reasoning: 'Fallback classification (AI unavailable)',
			side: 'Neutral',
			category: 'Other'
		};
	}
}

