/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';

export type DocketStatus = 'new' | 'analyzing' | 'ready' | 'filed' | 'error';

export interface Tag {
	id: string;
	name: string;
	type: 'entity' | 'category' | 'date' | 'custom';
	color?: string;
}

export interface EntityMatch {
	entityName: string;
	entityType: 'lawyer' | 'doctor' | 'adjudicator' | 'employer' | 'claimant' | 'caseManager' | 'reviewOfficer' | 'advocate';
	side: 'YourSide' | 'TheirSide' | 'Neutral';
	confidence: number;
}

export interface FileMetadata {
	uri: URI;
	name: string;
	extension: string;
	size: number;
	mimeType: string;
	preview?: string; // For images
	classification?: 'YourSide' | 'TheirSide' | 'Unknown'; // Manual classification
	classificationMethod?: 'manual' | 'keyword' | 'folder' | 'ai'; // How it was classified
}

export interface DocketItem extends FileMetadata {
	docketStatus: DocketStatus;
	aiConfidence?: number;
	entityMatches?: EntityMatch[];
	suggestedTags?: Tag[];
	suggestedFolder?: string;
	addedAt: string; // ISO timestamp
}

export interface AIClassificationContext {
	caseInfo: CaseInfo;
	file: FileMetadata;
}

export interface OrganizationTemplate {
	id: string;
	name: string;
	description: string;
	icon: string;
	rules: Rule[];
}

export interface Condition {
	field: 'extension' | 'name' | 'size' | 'mimeType';
	operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
	value: string | number;
}

export interface Rule {
	type: 'rename' | 'tag' | 'move' | 'classify';
	pattern?: string;
	conditions?: Condition[];
	action: RuleAction;
}

export interface RuleAction {
	tags?: string[];
	targetPath?: string;
	nameFormat?: string;
}

export interface FileChange {
	original: FileMetadata;
	proposed: {
		name: string;
		tags: string[];
		location?: URI;
	};
	confidence: number;
	reasoning: string;
}

export interface ProcessResult {
	success: boolean;
	file?: URI;
	error?: string;
}

export interface CaseParty {
	name: string;
	lawyers: string[];
	doctors: string[];
	advocate?: string[];
	caseManager?: string[];
	reviewOfficer?: string[];
	employerRepresentative?: string[];
	officials?: string[];
	medicalAdvisors?: string[];
}

export interface WCBInfo {
	adjudicators: string[];
	references: string[];
	organization?: string;
}

export interface TribunalInfo {
	name?: string;
	references: string[];
	adjudicators?: string[];
}

export interface CaseKeywords {
	yourSide: string[];
	theirSide: string[];
	medical: string[];
	legal: string[];
	evidence: string[];
	documents?: string[];
	[key: string]: string[] | undefined; // Allow dynamic keyword categories
}

export interface CaseInfo {
	caseNumber?: string;
	claimantName?: string;
	clientName?: string; // Alias for claimantName (for compatibility)
	injuryDate?: string;
	incidentDate?: string; // Alias for injuryDate (for compatibility)
	caseType: string;
	description?: string;
	parties?: {
		claimant?: CaseParty;
		employer?: CaseParty;
		wcb?: WCBInfo;
		tribunal?: TribunalInfo;
	};
	keywords: CaseKeywords;
}

/**
 * Legacy schema support - maps old field names to new ones
 */
export interface LegacyProjectInfo {
	caseNumber?: string;
	clientName?: string;
	caseType?: string;
	incidentDate?: string;
	description?: string;
}

export interface LegacyParties {
	yourSide?: {
		client?: string;
		treatingPhysicians?: string[];
		advocates?: string[];
		lawyers?: string[];
	};
	theirSide?: {
		opposing?: string;
		officials?: string[];
		medicalAdvisors?: string[];
		organization?: string;
		lawyers?: string[];
	};
	tribunal?: {
		name?: string;
		references?: string[];
	};
}

export interface LegacyFileOrgConfig {
	version?: string;
	workspaceType?: string;
	projectInfo?: LegacyProjectInfo;
	parties?: LegacyParties;
	keywords?: {
		yourSide?: string[];
		theirSide?: string[];
		documents?: string[];
	};
	organizationSettings?: {
		template?: string;
		preserveOriginalNames?: boolean;
		createBackup?: boolean;
	};
}

export interface FileOrgConfig {
	version: string;
	workspaceType?: 'legal' | 'research' | 'business' | string;
	// Legal workspace uses caseInfo (backward compatible)
	caseInfo?: CaseInfo;
	// Generic data storage for any workspace type
	// Stores projectInfo, parties, people, stakeholders, etc.
	[key: string]: unknown;
	organizationSettings: {
		selectedTemplate: string;
		preserveOriginalNames: boolean;
		createBackup: boolean;
		targetFolder: string;
		citationStyle?: string; // For research
		namingConvention?: string; // For business
	};
	createdAt: string;
	updatedAt: string;
}

/**
 * Generic workspace config that can hold any template's data
 * More flexible than FileOrgConfig for dynamic rendering
 */
export interface GenericWorkspaceConfig {
	version: string;
	workspaceType: 'legal' | 'research' | 'business';
	projectInfo?: Record<string, unknown>;
	parties?: Record<string, unknown>;
	people?: Record<string, unknown>;
	stakeholders?: Record<string, unknown>;
	sources?: Record<string, unknown>;
	categories?: Record<string, unknown>;
	keywords?: Record<string, string[]>;
	organizationSettings?: Record<string, unknown>;
	createdAt?: string;
	updatedAt?: string;
	// Allow any additional fields
	[key: string]: unknown;
}

/**
 * Detect workspace type from config structure
 */
export function detectWorkspaceType(config: Record<string, unknown>): 'legal' | 'research' | 'business' {
	// Check explicit workspaceType
	if (config.workspaceType && typeof config.workspaceType === 'string') {
		const type = config.workspaceType.toLowerCase();
		if (type === 'research') return 'research';
		if (type === 'business') return 'business';
		if (type === 'legal') return 'legal';
	}

	// Heuristic detection based on field presence
	if (config.people || config.sources || (config.projectInfo as Record<string, unknown>)?.researchQuestion) {
		return 'research';
	}
	if (config.stakeholders || config.categories || (config.projectInfo as Record<string, unknown>)?.deadline) {
		return 'business';
	}

	// Default to legal (original use case)
	return 'legal';
}

/**
 * Normalizes a config from any schema version (legacy or current) to a standardized format.
 * Supports legal, research, and business workspace types.
 * This allows the panel to handle JSON files created by AI or older versions.
 */
export function normalizeConfig(rawConfig: unknown): FileOrgConfig | null {
	if (!rawConfig || typeof rawConfig !== 'object') {
		return null;
	}

	const config = rawConfig as Record<string, unknown>;
	const workspaceType = detectWorkspaceType(config);

	// For legal workspaces, normalize to caseInfo format for backward compatibility
	if (workspaceType === 'legal') {
		// Check if it's already in the new format with caseInfo
		if (config.caseInfo && typeof config.caseInfo === 'object') {
			return ensureLegalFields(config as FileOrgConfig);
		}
		// Handle legacy format (projectInfo instead of caseInfo)
		if (config.projectInfo && typeof config.projectInfo === 'object') {
			return migrateLegacyConfig(config as unknown as LegacyFileOrgConfig);
		}
	}

	// For research and business, keep the generic structure
	return normalizeGenericConfig(config, workspaceType);
}

/**
 * Normalize research or business config (keeps generic structure)
 */
function normalizeGenericConfig(config: Record<string, unknown>, workspaceType: 'research' | 'business' | 'legal'): FileOrgConfig {
	const orgSettings = config.organizationSettings as Record<string, unknown> || {};

	return {
		version: (config.version as string) || '1.0',
		workspaceType,
		// Preserve all existing fields
		...config,
		organizationSettings: {
			selectedTemplate: (orgSettings.template as string) || (orgSettings.selectedTemplate as string) || workspaceType,
			preserveOriginalNames: (orgSettings.preserveOriginalNames as boolean) ?? true,
			createBackup: (orgSettings.createBackup as boolean) ?? true,
			targetFolder: (orgSettings.targetFolder as string) || './organized',
			citationStyle: orgSettings.citationStyle as string | undefined,
			namingConvention: orgSettings.namingConvention as string | undefined,
		},
		createdAt: (config.createdAt as string) || new Date().toISOString(),
		updatedAt: (config.updatedAt as string) || new Date().toISOString(),
	} as FileOrgConfig;
}

/**
 * Ensures all required fields exist with defaults for legal workspace
 */
function ensureLegalFields(config: FileOrgConfig): FileOrgConfig {
	const caseInfo = config.caseInfo || {} as CaseInfo;

	// Normalize name fields (support both clientName and claimantName)
	const claimantName = caseInfo.claimantName || caseInfo.clientName || '';
	const injuryDate = caseInfo.injuryDate || caseInfo.incidentDate || '';

	return {
		version: config.version || '1.0',
		workspaceType: config.workspaceType || 'legal',
		caseInfo: {
			caseNumber: caseInfo.caseNumber || '',
			claimantName,
			injuryDate,
			caseType: caseInfo.caseType || 'Workers Compensation',
			description: caseInfo.description || '',
			parties: {
				claimant: {
					name: caseInfo.parties?.claimant?.name || claimantName,
					lawyers: caseInfo.parties?.claimant?.lawyers || [],
					doctors: caseInfo.parties?.claimant?.doctors || [],
					advocate: caseInfo.parties?.claimant?.advocate || [],
				},
				employer: caseInfo.parties?.employer ? {
					name: caseInfo.parties.employer.name || '',
					lawyers: caseInfo.parties.employer.lawyers || [],
					doctors: caseInfo.parties.employer.doctors || [],
					caseManager: caseInfo.parties.employer.caseManager || [],
					reviewOfficer: caseInfo.parties.employer.reviewOfficer || [],
					employerRepresentative: caseInfo.parties.employer.employerRepresentative || [],
					officials: caseInfo.parties.employer.officials || [],
					medicalAdvisors: caseInfo.parties.employer.medicalAdvisors || [],
				} : undefined,
				wcb: caseInfo.parties?.wcb ? {
					adjudicators: caseInfo.parties.wcb.adjudicators || [],
					references: caseInfo.parties.wcb.references || [],
					organization: caseInfo.parties.wcb.organization || '',
				} : undefined,
				tribunal: caseInfo.parties?.tribunal ? {
					name: caseInfo.parties.tribunal.name || '',
					references: caseInfo.parties.tribunal.references || [],
					adjudicators: caseInfo.parties.tribunal.adjudicators || [],
				} : undefined,
			},
			keywords: {
				yourSide: caseInfo.keywords?.yourSide || [],
				theirSide: caseInfo.keywords?.theirSide || [],
				medical: caseInfo.keywords?.medical || ['medical', 'doctor', 'physician', 'diagnosis', 'treatment', 'mri', 'xray'],
				legal: caseInfo.keywords?.legal || ['legal', 'court', 'decision', 'appeal', 'ruling', 'judgment'],
				evidence: caseInfo.keywords?.evidence || ['evidence', 'study', 'research', 'expert', 'report'],
				documents: caseInfo.keywords?.documents || [],
			},
		},
		organizationSettings: {
			selectedTemplate: config.organizationSettings?.selectedTemplate || 'workers-comp-full',
			preserveOriginalNames: config.organizationSettings?.preserveOriginalNames ?? true,
			createBackup: config.organizationSettings?.createBackup ?? true,
			targetFolder: config.organizationSettings?.targetFolder || './organized',
		},
		createdAt: config.createdAt || new Date().toISOString(),
		updatedAt: config.updatedAt || new Date().toISOString(),
	};
}

/**
 * Migrates legacy config format to current format
 */
function migrateLegacyConfig(legacy: LegacyFileOrgConfig): FileOrgConfig {
	const projectInfo = legacy.projectInfo || {};
	const parties = legacy.parties || {};
	const keywords = legacy.keywords || {};
	const orgSettings = legacy.organizationSettings || {};

	// Build claimant party from yourSide
	const yourSide = parties.yourSide || {};
	const claimantParty: CaseParty = {
		name: yourSide.client || projectInfo.clientName || '',
		lawyers: yourSide.lawyers || [],
		doctors: yourSide.treatingPhysicians || [],
		advocate: yourSide.advocates || [],
	};

	// Build employer party from theirSide
	const theirSide = parties.theirSide || {};
	const employerParty: CaseParty | undefined = theirSide.opposing ? {
		name: theirSide.opposing,
		lawyers: theirSide.lawyers || [],
		doctors: theirSide.medicalAdvisors || [],
		officials: theirSide.officials || [],
		medicalAdvisors: theirSide.medicalAdvisors || [],
	} : undefined;

	// Build tribunal info
	const tribunalInfo: TribunalInfo | undefined = parties.tribunal ? {
		name: parties.tribunal.name || '',
		references: parties.tribunal.references || [],
	} : undefined;

	// Build WCB info from organization
	const wcbInfo: WCBInfo | undefined = theirSide.organization ? {
		adjudicators: [],
		references: [],
		organization: theirSide.organization,
	} : undefined;

	return {
		version: legacy.version || '1.0',
		workspaceType: legacy.workspaceType || 'legal',
		caseInfo: {
			caseNumber: projectInfo.caseNumber || '',
			claimantName: projectInfo.clientName || '',
			injuryDate: projectInfo.incidentDate || '',
			caseType: projectInfo.caseType || 'Workers Compensation',
			description: projectInfo.description || '',
			parties: {
				claimant: claimantParty,
				employer: employerParty,
				wcb: wcbInfo,
				tribunal: tribunalInfo,
			},
			keywords: {
				yourSide: keywords.yourSide || [],
				theirSide: keywords.theirSide || [],
				medical: ['medical', 'doctor', 'physician', 'diagnosis', 'treatment', 'mri', 'xray'],
				legal: ['legal', 'court', 'decision', 'appeal', 'ruling', 'judgment'],
				evidence: ['evidence', 'study', 'research', 'expert', 'report'],
				documents: keywords.documents || [],
			},
		},
		organizationSettings: {
			selectedTemplate: orgSettings.template || 'workers-comp-full',
			preserveOriginalNames: orgSettings.preserveOriginalNames ?? true,
			createBackup: orgSettings.createBackup ?? true,
			targetFolder: './organized',
		},
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

export interface WizardState {
	currentStep: number;
	selectedFiles: URI[];
	selectedTemplate: OrganizationTemplate | null;
	customRules: Rule[];
	proposedChanges: FileChange[];
}

// ============================================================================
// FOLDER TEMPLATE TYPES - For File Organizer Configuration
// ============================================================================

/**
 * A single folder node in a template structure
 */
export interface FolderNode {
	name: string;
	icon?: string;
	children: string[];
}

/**
 * A complete folder template (built-in or custom)
 */
export interface FolderTemplate {
	id: string;
	label: string;
	isBuiltIn: boolean;
	folders: FolderNode[];
}

/**
 * Built-in template type identifiers
 */
export type BuiltInTemplateType = 'legal' | 'research' | 'business';

/**
 * File Organizer configuration settings (persisted in .fileorg.json)
 */
export interface OrganizerConfig {
	// Template settings
	selectedTemplateId: string;
	customTemplates: FolderTemplate[];

	// Inbox settings
	customInboxPath?: string; // If set, overrides auto-detect

	// Behavior settings
	autoScanOnStartup: boolean;
	confidenceThreshold: number; // 0-1, for auto-filing	// Created/updated timestamps
	createdAt: string;
	updatedAt: string;
}/**
 * Default organizer configuration
 */
export const DEFAULT_ORGANIZER_CONFIG: OrganizerConfig = {
	selectedTemplateId: 'legal',
	customTemplates: [],
	customInboxPath: undefined,
	autoScanOnStartup: true,
	confidenceThreshold: 0.85,
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};
