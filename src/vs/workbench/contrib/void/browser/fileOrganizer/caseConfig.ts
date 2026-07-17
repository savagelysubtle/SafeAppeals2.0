/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Case configuration file (.fileorg.json) types and utilities
 * This file is automatically loaded into AI context for better file organization
 */

// Re-export types from the central types file
export {
	CaseParty,
	WCBInfo,
	TribunalInfo,
	CaseKeywords,
	CaseInfo,
	FileOrgConfig,
	LegacyFileOrgConfig,
	LegacyProjectInfo,
	LegacyParties,
	normalizeConfig,
} from './types.js';

import { CaseInfo, FileOrgConfig, normalizeConfig } from './types.js';

export interface Entity {
	name: string;
	type: 'lawyer' | 'doctor' | 'adjudicator' | 'employer' | 'claimant' | 'caseManager' | 'reviewOfficer' | 'advocate';
	side: 'YourSide' | 'TheirSide' | 'Neutral';
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
 * Handles both legacy and current schema formats
 */
export function generateAIContextString(rawConfig: unknown): string {
	// Normalize the config to handle any schema version
	const config = normalizeConfig(rawConfig);
	if (!config) {
		return '# Case Information\n\nNo valid case configuration found.\n';
	}

	const { caseInfo, organizationSettings } = config;

	// Handle case where caseInfo might not exist (for research/business configs)
	if (!caseInfo) {
		return '# Project Configuration\n\nNo case information configured. This may be a research or business workspace.\n';
	}

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
			context += `### Claimant/Your Side\n`;
			context += `- Name: ${caseInfo.parties.claimant.name}\n`;
			if (caseInfo.parties.claimant.lawyers?.length) {
				context += `- Lawyers: ${caseInfo.parties.claimant.lawyers.join(', ')}\n`;
			}
			if (caseInfo.parties.claimant.doctors?.length) {
				context += `- Treating Physicians: ${caseInfo.parties.claimant.doctors.join(', ')}\n`;
			}
			if (caseInfo.parties.claimant.advocate?.length) {
				context += `- Advocate: ${caseInfo.parties.claimant.advocate.join(', ')}\n`;
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
			if (caseInfo.parties.employer.medicalAdvisors?.length) {
				context += `- Medical Advisors: ${caseInfo.parties.employer.medicalAdvisors.join(', ')}\n`;
			}
			if (caseInfo.parties.employer.caseManager?.length) {
				context += `- Case Manager: ${caseInfo.parties.employer.caseManager.join(', ')}\n`;
			}
			if (caseInfo.parties.employer.reviewOfficer?.length) {
				context += `- Review Officer: ${caseInfo.parties.employer.reviewOfficer.join(', ')}\n`;
			}
			if (caseInfo.parties.employer.employerRepresentative?.length) {
				context += `- Employer Representative: ${caseInfo.parties.employer.employerRepresentative.join(', ')}\n`;
			}
			if (caseInfo.parties.employer.officials?.length) {
				context += `- Officials: ${caseInfo.parties.employer.officials.join(', ')}\n`;
			}
		}

		if (caseInfo.parties.wcb) {
			context += `\n### WCB/Board\n`;
			if (caseInfo.parties.wcb.organization) {
				context += `- Organization: ${caseInfo.parties.wcb.organization}\n`;
			}
			if (caseInfo.parties.wcb.adjudicators?.length) {
				context += `- Adjudicators: ${caseInfo.parties.wcb.adjudicators.join(', ')}\n`;
			}
			if (caseInfo.parties.wcb.references?.length) {
				context += `- Reference Numbers: ${caseInfo.parties.wcb.references.join(', ')}\n`;
			}
		}

		if (caseInfo.parties.tribunal) {
			context += `\n### Tribunal/Appeal Board\n`;
			if (caseInfo.parties.tribunal.name) {
				context += `- Name: ${caseInfo.parties.tribunal.name}\n`;
			}
			if (caseInfo.parties.tribunal.references?.length) {
				context += `- Reference Numbers: ${caseInfo.parties.tribunal.references.join(', ')}\n`;
			}
			if (caseInfo.parties.tribunal.adjudicators?.length) {
				context += `- Adjudicators: ${caseInfo.parties.tribunal.adjudicators.join(', ')}\n`;
			}
		}
	}

	// Keywords for classification
	context += `\n## Classification Keywords\n\n`;
	context += `**Your Side:** ${caseInfo.keywords.yourSide?.join(', ') || ''}\n`;
	context += `**Their Side:** ${caseInfo.keywords.theirSide?.join(', ') || ''}\n`;
	context += `**Medical:** ${caseInfo.keywords.medical?.join(', ') || ''}\n`;
	context += `**Legal:** ${caseInfo.keywords.legal?.join(', ') || ''}\n`;
	context += `**Evidence:** ${caseInfo.keywords.evidence?.join(', ') || ''}\n`;
	if (caseInfo.keywords.documents?.length) {
		context += `**Documents:** ${caseInfo.keywords.documents.join(', ')}\n`;
	}

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

	// Handle case where caseInfo might not exist
	if (!config.caseInfo) {
		return result;
	}

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

/**
 * Extract all known entities from case info for AI context
 */
export function extractEntitiesFromCaseInfo(caseInfo: CaseInfo): Entity[] {
	const entities: Entity[] = [];

	if (!caseInfo.parties) {
		return entities;
	}

	// Claimant
	if (caseInfo.parties.claimant) {
		entities.push({
			name: caseInfo.parties.claimant.name,
			type: 'claimant',
			side: 'YourSide'
		});

		// Claimant's lawyers
		if (caseInfo.parties.claimant.lawyers) {
			entities.push(...caseInfo.parties.claimant.lawyers.map(name => ({
				name,
				type: 'lawyer' as const,
				side: 'YourSide' as const
			})));
		}

		// Treating physicians
		if (caseInfo.parties.claimant.doctors) {
			entities.push(...caseInfo.parties.claimant.doctors.map(name => ({
				name,
				type: 'doctor' as const,
				side: 'YourSide' as const
			})));
		}

		// Advocates
		if (caseInfo.parties.claimant.advocate) {
			entities.push(...caseInfo.parties.claimant.advocate.map(name => ({
				name,
				type: 'advocate' as const,
				side: 'YourSide' as const
			})));
		}
	}

	// Employer/Defendant
	if (caseInfo.parties.employer) {
		entities.push({
			name: caseInfo.parties.employer.name,
			type: 'employer',
			side: 'TheirSide'
		});

		// Defense lawyers
		if (caseInfo.parties.employer.lawyers) {
			entities.push(...caseInfo.parties.employer.lawyers.map(name => ({
				name,
				type: 'lawyer' as const,
				side: 'TheirSide' as const
			})));
		}

		// IME doctors
		if (caseInfo.parties.employer.doctors) {
			entities.push(...caseInfo.parties.employer.doctors.map(name => ({
				name,
				type: 'doctor' as const,
				side: 'TheirSide' as const
			})));
		}

		// Case managers
		if (caseInfo.parties.employer.caseManager) {
			entities.push(...caseInfo.parties.employer.caseManager.map(name => ({
				name,
				type: 'caseManager' as const,
				side: 'TheirSide' as const
			})));
		}

		// Review officers
		if (caseInfo.parties.employer.reviewOfficer) {
			entities.push(...caseInfo.parties.employer.reviewOfficer.map(name => ({
				name,
				type: 'reviewOfficer' as const,
				side: 'TheirSide' as const
			})));
		}
	}

	// WCB/Board adjudicators
	if (caseInfo.parties.wcb?.adjudicators) {
		entities.push(...caseInfo.parties.wcb.adjudicators.map(name => ({
			name,
			type: 'adjudicator' as const,
			side: 'Neutral' as const
		})));
	}

	return entities;
}

