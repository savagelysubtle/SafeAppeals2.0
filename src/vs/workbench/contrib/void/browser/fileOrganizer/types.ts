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
	entityType: 'lawyer' | 'doctor' | 'adjudicator' | 'employer' | 'claimant' | 'caseManager' | 'reviewOfficer';
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
}

export interface WCBInfo {
	adjudicators: string[];
	references: string[];
}

export interface CaseInfo {
	caseNumber?: string;
	claimantName?: string;
	injuryDate?: string;
	caseType: string;
	description?: string;
	parties: {
		claimant: CaseParty;
		employer?: CaseParty;
		wcb?: WCBInfo;
	};
	keywords: {
		yourSide: string[];
		theirSide: string[];
		medical: string[];
		legal: string[];
		evidence: string[];
	};
}

export interface FileOrgConfig {
	version: string;
	caseInfo: CaseInfo;
	organizationSettings: {
		selectedTemplate: string;
		preserveOriginalNames: boolean;
		createBackup: boolean;
		targetFolder: string;
	};
	createdAt: string;
	updatedAt: string;
}

export interface WizardState {
	currentStep: number;
	selectedFiles: URI[];
	selectedTemplate: OrganizationTemplate | null;
	customRules: Rule[];
	proposedChanges: FileChange[];
}

