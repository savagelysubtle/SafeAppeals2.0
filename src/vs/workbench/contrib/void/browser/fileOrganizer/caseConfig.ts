/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Case configuration file (.fileorg.json) types and utilities
 * This file is automatically loaded into AI context for better file organization
 */

export interface CaseParty {
	name: string;
	lawyers?: string[];
	doctors?: string[];
}

export interface WCBInfo {
	adjudicators?: string[];
	references?: string[];
}

export interface CaseParties {
	claimant?: CaseParty;
	employer?: CaseParty;
	wcb?: WCBInfo;
}

export interface CaseKeywords {
	yourSide: string[];
	theirSide: string[];
	medical: string[];
	legal: string[];
	evidence: string[];
}

export interface CaseInfo {
	caseNumber?: string;
	claimantName?: string;
	injuryDate?: string;
	caseType: string;
	description?: string;
	parties?: CaseParties;
	keywords: CaseKeywords;
}

export interface OrganizationSettings {
	selectedTemplate: string;
	preserveOriginalNames: boolean;
	createBackup: boolean;
	targetFolder: string;
}

export interface FileOrgConfig {
	version: '1.0';
	caseInfo: CaseInfo;
	organizationSettings: OrganizationSettings;
	createdAt: string;
	updatedAt: string;
}

export const DEFAULT_CASE_CONFIG: FileOrgConfig = {
	version: '1.0',
	caseInfo: {
		caseType: 'Workers Compensation',
		keywords: {
			yourSide: ['claimant', 'treating', 'personal'],
			theirSide: ['employer', 'wcb', 'ime', 'defense'],
			medical: ['medical', 'doctor', 'physician', 'diagnosis', 'treatment', 'mri', 'xray'],
			legal: ['legal', 'court', 'decision', 'appeal', 'ruling', 'judgment'],
			evidence: ['evidence', 'study', 'research', 'expert', 'report']
		}
	},
	organizationSettings: {
		selectedTemplate: 'workers-comp-full',
		preserveOriginalNames: true,
		createBackup: true,
		targetFolder: './organized'
	},
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString()
};

/**
 * Generate AI context string from case config
 * This will be included in the AI's system prompt
 */
export function generateAIContextString(config: FileOrgConfig): string {
	const { caseInfo, organizationSettings } = config;

	let context = `# Case Information\n\n`;

	if (caseInfo.caseNumber) {
		context += `**Case Number:** ${caseInfo.caseNumber}\n`;
	}
	if (caseInfo.claimantName) {
		context += `**Claimant:** ${caseInfo.claimantName}\n`;
	}
	if (caseInfo.injuryDate) {
		context += `**Injury Date:** ${caseInfo.injuryDate}\n`;
	}
	context += `**Case Type:** ${caseInfo.caseType}\n`;

	if (caseInfo.description) {
		context += `\n**Description:** ${caseInfo.description}\n`;
	}

	// Parties information
	if (caseInfo.parties) {
		context += `\n## Parties Involved\n\n`;

		if (caseInfo.parties.claimant) {
			context += `### Claimant\n`;
			context += `- Name: ${caseInfo.parties.claimant.name}\n`;
			if (caseInfo.parties.claimant.lawyers?.length) {
				context += `- Lawyers: ${caseInfo.parties.claimant.lawyers.join(', ')}\n`;
			}
			if (caseInfo.parties.claimant.doctors?.length) {
				context += `- Treating Physicians: ${caseInfo.parties.claimant.doctors.join(', ')}\n`;
			}
		}

		if (caseInfo.parties.employer) {
			context += `\n### Employer/Defendant\n`;
			context += `- Name: ${caseInfo.parties.employer.name}\n`;
			if (caseInfo.parties.employer.lawyers?.length) {
				context += `- Defense Lawyers: ${caseInfo.parties.employer.lawyers.join(', ')}\n`;
			}
			if (caseInfo.parties.employer.doctors?.length) {
				context += `- IME Doctors: ${caseInfo.parties.employer.doctors.join(', ')}\n`;
			}
		}

		if (caseInfo.parties.wcb) {
			context += `\n### WCB/Board\n`;
			if (caseInfo.parties.wcb.adjudicators?.length) {
				context += `- Adjudicators: ${caseInfo.parties.wcb.adjudicators.join(', ')}\n`;
			}
			if (caseInfo.parties.wcb.references?.length) {
				context += `- Reference Numbers: ${caseInfo.parties.wcb.references.join(', ')}\n`;
			}
		}
	}

	// Keywords for classification
	context += `\n## Classification Keywords\n\n`;
	context += `**Your Side:** ${caseInfo.keywords.yourSide.join(', ')}\n`;
	context += `**Their Side:** ${caseInfo.keywords.theirSide.join(', ')}\n`;
	context += `**Medical:** ${caseInfo.keywords.medical.join(', ')}\n`;
	context += `**Legal:** ${caseInfo.keywords.legal.join(', ')}\n`;
	context += `**Evidence:** ${caseInfo.keywords.evidence.join(', ')}\n`;

	// Organization settings
	context += `\n## Organization Settings\n\n`;
	context += `**Template:** ${organizationSettings.selectedTemplate}\n`;
	context += `**Preserve Names:** ${organizationSettings.preserveOriginalNames ? 'Yes' : 'No'}\n`;
	context += `**Target Folder:** ${organizationSettings.targetFolder}\n`;

	return context;
}

/**
 * Check if a filename matches case keywords
 */
export function matchesKeywords(filename: string, keywords: string[]): boolean {
	const lowerFilename = filename.toLowerCase();
	return keywords.some(keyword => lowerFilename.includes(keyword.toLowerCase()));
}

/**
 * Classify a file based on case configuration
 */
export function classifyFileUsingCaseConfig(filename: string, config: FileOrgConfig): {
	side?: 'YourSide' | 'TheirSide';
	category?: 'Medical' | 'Legal' | 'Evidence';
} {
	const result: { side?: 'YourSide' | 'TheirSide'; category?: 'Medical' | 'Legal' | 'Evidence' } = {};

	// Check side classification
	if (matchesKeywords(filename, config.caseInfo.keywords.yourSide)) {
		result.side = 'YourSide';
	} else if (matchesKeywords(filename, config.caseInfo.keywords.theirSide)) {
		result.side = 'TheirSide';
	}

	// Check category classification
	if (matchesKeywords(filename, config.caseInfo.keywords.medical)) {
		result.category = 'Medical';
	} else if (matchesKeywords(filename, config.caseInfo.keywords.legal)) {
		result.category = 'Legal';
	} else if (matchesKeywords(filename, config.caseInfo.keywords.evidence)) {
		result.category = 'Evidence';
	}

	return result;
}

