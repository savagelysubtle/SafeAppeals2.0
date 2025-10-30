/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';

export interface FileMetadata {
	uri: URI;
	name: string;
	extension: string;
	size: number;
	mimeType: string;
	preview?: string; // For images
	classification?: 'YourSide' | 'TheirSide' | 'Unknown'; // Manual classification
	classificationMethod?: 'manual' | 'keyword' | 'folder'; // How it was classified
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
	file: URI;
	error?: string;
}

export interface WizardState {
	currentStep: number;
	selectedFiles: URI[];
	selectedTemplate: OrganizationTemplate | null;
	customRules: Rule[];
	proposedChanges: FileChange[];
}

