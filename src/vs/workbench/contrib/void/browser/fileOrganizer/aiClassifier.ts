/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IVoidSettingsService } from '../../common/voidSettingsService.js';
import { ICloudLLMRouterService } from '../cloudLLMRouterService.js';
import { CaseInfo, extractEntitiesFromCaseInfo } from './caseConfig.js';
import { EntityMatch, FileChange, FileMetadata } from './types.js';

/**
 * Minimum confidence score required for auto-classification.
 * Below this threshold, files are marked as "needs review".
 */
export const CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.7;

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
	/** Whether this is a foundational/authoritative document for Core_References */
	isCoreReference?: boolean;
	/** Reason why this qualifies as a core reference */
	coreReferenceReason?: string;
	/** Whether confidence is below threshold and needs manual review */
	needsReview?: boolean;
}

export class AIFileClassifier {
	constructor(
		private readonly cloudLLMRouterService: ICloudLLMRouterService,
		private readonly voidSettingsService: IVoidSettingsService
	) { }

	/**
	 * Pre-filter: Extract entity matches from filename using string/regex matching
	 * This reduces LLM calls when entities are obvious from the filename.
	 * @returns Array of matched entities or empty if no matches found
	 */
	private preFilterEntityMatches(filename: string, caseInfo: CaseInfo): EntityMatch[] {
		const matches: EntityMatch[] = [];
		const entities = extractEntitiesFromCaseInfo(caseInfo);
		const normalizedFilename = filename.toLowerCase().replace(/[_\-\.]/g, ' ');

		for (const entity of entities) {
			// Normalize entity name for comparison
			const normalizedName = entity.name.toLowerCase();
			const nameParts = normalizedName.split(/\s+/);

			// Check if entity name appears in filename
			// Match full name OR last name (for doctors/lawyers)
			const lastName = nameParts[nameParts.length - 1];
			const fullNameMatch = normalizedFilename.includes(normalizedName.replace(/\s+/g, ' '));
			const lastNameMatch = nameParts.length > 1 && normalizedFilename.includes(lastName);

			if (fullNameMatch || lastNameMatch) {
				matches.push({
					entityName: entity.name,
					entityType: entity.type,
					side: entity.side,
					confidence: fullNameMatch ? 0.95 : 0.85 // Higher confidence for full name match
				});
				console.log(`[AIClassifier PreFilter] Found entity "${entity.name}" (${entity.side}) in filename "${filename}"`);
			}
		}

		return matches;
	}

	/**
	 * Quick classification based on pre-filter results alone (no LLM call needed)
	 * Returns null if pre-filter doesn't provide enough confidence
	 */
	private quickClassifyFromPreFilter(
		file: FileMetadata,
		preFilterMatches: EntityMatch[]
	): AIClassificationResult | null {
		if (preFilterMatches.length === 0) {
			return null; // No matches, need LLM
		}

		// Find the highest-confidence match
		const bestMatch = preFilterMatches.reduce((best, current) =>
			current.confidence > best.confidence ? current : best
		);

		// Only quick-classify if we have high confidence
		if (bestMatch.confidence < 0.9) {
			return null; // Not confident enough, defer to LLM
		}

		// Determine category and folder based on entity type
		let category: 'Medical' | 'Legal' | 'Correspondence' | 'Evidence' | 'Decision' | 'Other' = 'Other';
		let suggestedFolder: string;

		if (bestMatch.entityType === 'doctor') {
			category = 'Medical';
			suggestedFolder = bestMatch.side === 'TheirSide'
				? '02_Their_Side/IME_Reports'
				: '01_Your_Side/Medical_Treating';
		} else if (bestMatch.entityType === 'lawyer') {
			category = 'Legal';
			suggestedFolder = bestMatch.side === 'TheirSide'
				? '02_Their_Side/Employer_Defense'
				: '01_Your_Side/Legal_Representation';
		} else {
			return null; // Unfamiliar entity type, defer to LLM
		}

		console.log(`[AIClassifier QuickClassify] Classified "${file.name}" as ${bestMatch.side}/${category} via pre-filter (no LLM call)`);

		return {
			suggestedName: file.name,
			tags: [bestMatch.entityType, bestMatch.entityName.toLowerCase().replace(/\s+/g, '-')],
			confidence: bestMatch.confidence,
			reasoning: `Pre-filter match: ${bestMatch.entityName} is a known ${bestMatch.side} ${bestMatch.entityType}`,
			side: bestMatch.side,
			category,
			entityMatches: preFilterMatches,
			suggestedFolder,
			needsReview: false,
		};
	}

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

			this.cloudLLMRouterService.sendLLMMessage({
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
				onFinalMessage: ({ fullText }) => {
					// Use fullText from onFinalMessage (for non-streaming cloud requests)
					// Fall back to accumulated fullResponse (for streaming requests)
					const responseText = fullText || fullResponse;
					const result = this.parseAIResponse(responseText, file);
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

	/**
	 * Classify a file with user feedback for correction
	 */
	async classifyFileWithFeedback(
		file: FileMetadata,
		caseInfo: CaseInfo,
		template: 'legal' | 'research' | 'business' = 'legal',
		feedback: string
	): Promise<AIClassificationResult | null> {
		const basePrompt = this.buildContextAwarePrompt(file, caseInfo, template);

		// Add feedback context to the prompt
		const promptWithFeedback = `${basePrompt}

## USER FEEDBACK - IMPORTANT CORRECTION
The previous classification was INCORRECT. The user has provided the following correction:

"${feedback}"

Please CAREFULLY consider this feedback and reclassify the file accordingly. The user's feedback should OVERRIDE your initial assumptions.

For example:
- If the user says "Dr. X is an IME doctor, not treating" → classify as TheirSide, put in 02_Their_Side/IME_Reports
- If the user says "This is from my lawyer, not theirs" → classify as YourSide, put in 01_Your_Side/Legal_Representation

Apply the correction and provide updated classification.`;

		return this._sendClassificationRequest(promptWithFeedback, template, file, caseInfo, 'file-organizer-reclassify-feedback');
	}

	async classifyFileWithContext(file: FileMetadata, caseInfo: CaseInfo, template: 'legal' | 'research' | 'business' = 'legal'): Promise<AIClassificationResult | null> {
		// OPTIMIZATION: Try pre-filter first to avoid LLM call for obvious entity matches
		if (template === 'legal') {
			const preFilterMatches = this.preFilterEntityMatches(file.name, caseInfo);
			const quickResult = this.quickClassifyFromPreFilter(file, preFilterMatches);
			if (quickResult) {
				return quickResult; // Skip LLM call entirely
			}
		}

		// Fall back to LLM classification
		const prompt = this.buildContextAwarePrompt(file, caseInfo, template);
		return this._sendClassificationRequest(prompt, template, file, caseInfo, 'file-organizer-classify-context');
	}

	private _sendClassificationRequest(
		prompt: string,
		template: 'legal' | 'research' | 'business',
		file: FileMetadata,
		caseInfo: CaseInfo,
		loggingName: string
	): Promise<AIClassificationResult | null> {

		// Template-specific system messages
		const systemMessages: Record<'legal' | 'research' | 'business', string> = {
			legal: 'You are a legal file organization assistant specializing in workers compensation cases. Analyze files in the context of the provided case information and classify them intelligently. Respond ONLY with valid JSON.',
			research: 'You are an academic research file organization assistant. Analyze files for research projects, identifying literature sources, data files, drafts, and reference materials. Respond ONLY with valid JSON.',
			business: 'You are a business document organization assistant. Analyze files for professional projects, identifying administrative documents, planning materials, deliverables, and communications. Respond ONLY with valid JSON.',
		};

		return new Promise((resolve) => {
			let fullResponse = '';

			const modelSelection = this.voidSettingsService.state.modelSelectionOfFeature['Chat'];

			if (!modelSelection) {
				resolve(null);
				return;
			}

			const modelSelectionOptions = this.voidSettingsService.state.optionsOfModelSelection['Chat'][modelSelection.providerName]?.[modelSelection.modelName];
			const overridesOfModel = this.voidSettingsService.state.overridesOfModel;

			this.cloudLLMRouterService.sendLLMMessage({
				messagesType: 'chatMessages',
				messages: [
					{
						role: 'system',
						content: systemMessages[template]
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
				logging: { loggingName },
				onText: ({ fullText }) => {
					fullResponse = fullText;
				},
				onFinalMessage: ({ fullText }) => {
					// Use fullText from onFinalMessage (for non-streaming cloud requests)
					// Fall back to accumulated fullResponse (for streaming requests)
					const responseText = fullText || fullResponse;
					const result = this.parseContextAwareResponse(responseText, file, caseInfo);
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

	private buildContextAwarePrompt(file: FileMetadata, caseInfo: CaseInfo, template: 'legal' | 'research' | 'business' = 'legal'): string {
		// Route to template-specific prompt builder
		switch (template) {
			case 'research':
				return this.buildResearchPrompt(file);
			case 'business':
				return this.buildBusinessPrompt(file);
			case 'legal':
			default:
				return this.buildLegalPrompt(file, caseInfo);
		}
	}

	private buildLegalPrompt(file: FileMetadata, caseInfo: CaseInfo): string {
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

## KNOWN ENTITIES - CRITICAL FOR CLASSIFICATION
${yourSideSection}
${theirSideSection}
${neutralSection}

**ENTITY MATCHING RULES (HIGHEST PRIORITY):**
- If a DOCTOR name from "Their Side" appears in the filename, the file belongs to **TheirSide** and should go to **02_Their_Side/IME_Reports**
- If a DOCTOR name from "Your Side" appears in the filename, the file belongs to **YourSide** and should go to **01_Your_Side/Medical_Treating**
- If a LAWYER name from either side appears, route accordingly
- Entity matches OVERRIDE any generic pattern matching - a doctor listed under "Their Side" is NEVER "Your Side" even if the word "medical" appears
- IME doctors (Independent Medical Examiners) are ALWAYS "Their Side" - they are hired by WCB/employer to evaluate, not treat

## KEYWORDS (Use if no entity match found)
Your Side: ${caseInfo.keywords.yourSide.join(', ')}
Their Side: ${caseInfo.keywords.theirSide.join(', ')}
Medical: ${caseInfo.keywords.medical.join(', ')}
Legal: ${caseInfo.keywords.legal.join(', ')}
Evidence: ${caseInfo.keywords.evidence.join(', ')}

## FILE TO CLASSIFY
- Filename: ${file.name}
- Extension: ${file.extension}
- Size: ${file.size} bytes

**STEP 1: Check for entity matches FIRST**
Look at the filename carefully. Does it contain any names from the KNOWN ENTITIES list above?
- If you find a name match, that determines the SIDE
- For doctors: Their Side doctors = IME, Your Side doctors = Treating

## AVAILABLE FOLDERS (Legal Template)
- 01_Your_Side/Medical_Treating ← For YOUR treating physicians
- 01_Your_Side/Legal_Representation
- 01_Your_Side/Personal_Statements
- 02_Their_Side/IME_Reports ← For THEIR doctors (IME, defense medical)
- 02_Their_Side/Employer_Defense
- 02_Their_Side/WCB_Decisions
- 03_Correspondence/Incoming
- 03_Correspondence/Outgoing
- 04_Timeline_Evidence
- 05_Appeals
- 06_Reference/Templates
- Core_References

## CORE_REFERENCES DETECTION
Identify if this file is a FOUNDATIONAL REFERENCE document. Core_References are:
- Official policy manuals (WCB policies, employer policies, insurance guidelines)
- Government regulations, statutes, or legal codes
- Seminal peer-reviewed research papers that establish key medical/legal principles
- Medical textbook excerpts or authoritative clinical guidelines (e.g., AMA Guides, DSM)
- Industry standards documents

CRITICAL: Core_References are RARE. Most case files do NOT belong here.

## FEW-SHOT EXAMPLES (Learn from these correct classifications)

**Example 1**: Filename "Dr_Kotze_IME_Report_2024-03-15.pdf"
→ Dr. Kotze is listed as TheirSide doctor (IME)
→ side: "TheirSide", category: "Medical", suggestedFolder: "02_Their_Side/IME_Reports"

**Example 2**: Filename "Dr_Smith_Treatment_Notes_Jan2024.pdf"
→ Dr. Smith is listed as YourSide doctor (treating physician)
→ side: "YourSide", category: "Medical", suggestedFolder: "01_Your_Side/Medical_Treating"

**Example 3**: Filename "WCB_Decision_2024-02-10.pdf"
→ Contains "WCB" and "Decision" keywords (Their Side keywords)
→ side: "TheirSide", category: "Decision", suggestedFolder: "02_Their_Side/WCB_Decisions"

**Example 4**: Filename "Personal_Statement_John_Doe.docx"
→ Contains claimant name and "Personal Statement"
→ side: "YourSide", category: "Evidence", suggestedFolder: "01_Your_Side/Personal_Statements"

**Example 5**: Filename "WCB_Policy_Manual_v2.1.pdf"
→ This is an OFFICIAL POLICY document (not case-specific)
→ isCoreReference: true, suggestedFolder: "Core_References"

## TASK
Analyze this file using this priority order:
1. **FIRST**: Check if any KNOWN ENTITY names appear in the filename - if yes, use that entity's side
2. **SECOND**: If no entity match, use keywords and file patterns
3. Determine category (Medical, Legal, Correspondence, Evidence, Decision, Other)
4. Generate appropriate tags
5. Select the correct folder path based on side determination
6. Check if this is a rare Core_Reference

Respond ONLY with valid JSON in this exact format:
{
  "side": "YourSide" | "TheirSide" | "Neutral",
  "category": "Medical" | "Legal" | "Correspondence" | "Evidence" | "Decision" | "Other",
  "entityMatches": [
    {
      "entityName": "Dr. Kotze",
      "entityType": "doctor",
      "side": "TheirSide",
      "confidence": 0.95
    }
  ],
  "suggestedTags": ["ime", "defense-medical", "dr-kotze"],
  "suggestedFolder": "02_Their_Side/IME_Reports",
  "suggestedName": "${file.name}",
  "confidence": 0.85,
  "reasoning": "File contains Dr. Kotze's name, who is listed as a TheirSide doctor (IME). IME doctors always belong to Their Side.",
  "isCoreReference": false,
  "coreReferenceReason": null
}

IMPORTANT: The example above shows proper handling of a "Their Side" doctor (IME).
If the doctor name matches a "Your Side" doctor, use:
- side: "YourSide"
- suggestedFolder: "01_Your_Side/Medical_Treating"
- reasoning should explain the entity match`;
	}

	private buildResearchPrompt(file: FileMetadata): string {
		return `You are classifying a file for a research project.

## FILE TO CLASSIFY
- Filename: ${file.name}
- Extension: ${file.extension}
- Size: ${file.size} bytes

## AVAILABLE FOLDERS (Research Template)
- 01_Literature/Primary_Sources
- 01_Literature/Secondary_Sources
- 01_Literature/References
- 02_Data/Raw
- 02_Data/Processed
- 02_Data/Analysis
- 03_Drafts
- 04_Final
- 05_Notes
- Core_References

## CORE_REFERENCES DETECTION
Identify if this file is a FOUNDATIONAL REFERENCE document. Core_References are:
- Seminal peer-reviewed papers that are foundational to the field
- Authoritative textbooks or methodology guides
- Key professor lectures or course materials
- Landmark studies frequently cited in the field

CRITICAL: Core_References are RARE. Most research files do NOT belong here.
Do NOT classify as Core_Reference:
- Your own drafts or notes
- Data files (raw or processed)
- Working documents
- Regular literature you're reviewing (put in 01_Literature)

Only set isCoreReference=true if the document is AUTHORITATIVE and would be a foundational reference for the entire research field.

## TASK
Analyze this file and determine:
1. What category it falls into (Literature, Data, Draft, Final, Notes, Reference)
2. The specific subcategory if applicable
3. Appropriate tags for organization
4. Suggested folder path from the AVAILABLE FOLDERS list
5. Whether this is a Core_Reference (foundational/authoritative document)

Respond ONLY with valid JSON in this exact format:
{
  "side": "Neutral",
  "category": "Literature" | "Data" | "Draft" | "Final" | "Notes" | "Reference",
  "entityMatches": [],
  "suggestedTags": ["research-paper", "methodology", "statistics"],
  "suggestedFolder": "01_Literature/Primary_Sources",
  "suggestedName": "${file.name}",
  "confidence": 0.85,
  "reasoning": "File appears to be a research paper based on the filename structure.",
  "isCoreReference": false,
  "coreReferenceReason": null
}`;
	}

	private buildBusinessPrompt(file: FileMetadata): string {
		return `You are classifying a file for a business project.

## FILE TO CLASSIFY
- Filename: ${file.name}
- Extension: ${file.extension}
- Size: ${file.size} bytes

## AVAILABLE FOLDERS (Business Template)
- 01_Admin/Contracts
- 01_Admin/Invoices
- 01_Admin/Licenses
- 02_Planning/Requirements
- 02_Planning/Proposals
- 03_Working
- 04_Deliverables
- 05_Communications/Internal
- 05_Communications/External
- Archive
- Core_References

## CORE_REFERENCES DETECTION
Identify if this file is a FOUNDATIONAL REFERENCE document. Core_References are:
- Company policies or employee handbooks
- Industry standards or compliance documents
- Client master service agreements or SOWs
- Regulatory requirements or certifications
- Standard operating procedures (SOPs)

CRITICAL: Core_References are RARE. Most business files do NOT belong here.
Do NOT classify as Core_Reference:
- Individual project invoices or contracts
- Regular communications or emails
- Working drafts or deliverables
- Meeting notes or agendas

Only set isCoreReference=true if the document is AUTHORITATIVE and applies across MULTIPLE projects.

## TASK
Analyze this file and determine:
1. What category it falls into (Admin, Planning, Working, Deliverable, Communication, Archive, Reference)
2. The specific subcategory if applicable
3. Appropriate tags for organization
4. Suggested folder path from the AVAILABLE FOLDERS list
5. Whether this is a Core_Reference (foundational/authoritative document)

Respond ONLY with valid JSON in this exact format:
{
  "side": "Neutral",
  "category": "Admin" | "Planning" | "Working" | "Deliverable" | "Communication" | "Archive" | "Reference",
  "entityMatches": [],
  "suggestedTags": ["contract", "client-xyz", "2024"],
  "suggestedFolder": "01_Admin/Contracts",
  "suggestedName": "${file.name}",
  "confidence": 0.85,
  "reasoning": "File appears to be a contract based on the filename.",
  "isCoreReference": false,
  "coreReferenceReason": null
}`;
	}

	private parseAIResponse(response: string, file: FileMetadata): AIClassificationResult | null {
		try {
			// DEBUG: Log what we received
			console.log('[AIClassifier] parseAIResponse received:', {
				responseLength: response?.length ?? 0,
				responseType: typeof response,
				responsePreview: response?.substring(0, 300) ?? 'EMPTY',
				hasOpenBrace: response?.includes('{') ?? false,
				hasCloseBrace: response?.includes('}') ?? false,
			});

			// Try to extract JSON from the response
			// Handle markdown code blocks (```json ... ```) that Gemini often uses
			let jsonText = response;

			// Remove markdown code block wrapper if present
			const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
			if (codeBlockMatch) {
				jsonText = codeBlockMatch[1].trim();
				console.log('[AIClassifier] Extracted JSON from markdown code block');
			}

			const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				console.warn('No JSON found in AI response. Full response:', response);
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
			// DEBUG: Log what we received
			console.log('[AIClassifier] parseContextAwareResponse received:', {
				responseLength: response?.length ?? 0,
				responseType: typeof response,
				responsePreview: response?.substring(0, 300) ?? 'EMPTY',
				hasOpenBrace: response?.includes('{') ?? false,
				hasCloseBrace: response?.includes('}') ?? false,
			});

			// Try to extract JSON from the response
			// Handle markdown code blocks (```json ... ```) that Gemini often uses
			let jsonText = response;

			// Remove markdown code block wrapper if present
			const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
			if (codeBlockMatch) {
				jsonText = codeBlockMatch[1].trim();
				console.log('[AIClassifier] Extracted JSON from markdown code block');
			}

			const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				console.warn('No JSON found in AI response. Full response:', response);
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

			// Handle Core_Reference detection
			const isCoreReference = parsed.isCoreReference === true;
			const coreReferenceReason = parsed.coreReferenceReason || undefined;

			// If it's a Core_Reference, override the suggested folder
			let suggestedFolder = parsed.suggestedFolder;
			if (isCoreReference && suggestedFolder !== 'Core_References') {
				console.log('[AIClassifier] Core_Reference detected, overriding folder to Core_References');
				suggestedFolder = 'Core_References';
			}

			// Parse confidence and enforce threshold
			const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.7;
			const needsReview = confidence < CLASSIFICATION_CONFIDENCE_THRESHOLD;

			if (needsReview) {
				console.log(`[AIClassifier] Low confidence (${confidence.toFixed(2)}) for "${file.name}" - marking for review`);
			}

			return {
				suggestedName,
				tags: parsed.suggestedTags || [],
				confidence,
				reasoning: parsed.reasoning || 'AI-generated classification with case context',
				side: parsed.side,
				category: parsed.category,
				entityMatches: parsed.entityMatches || [],
				suggestedFolder,
				isCoreReference,
				coreReferenceReason,
				needsReview,
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

