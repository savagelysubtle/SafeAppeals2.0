/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Workspace Templates for Case Info / Project Configuration
 *
 * Supports three workspace types:
 * - Legal/Claims: Workers compensation, personal injury, etc.
 * - Research/Academic: Thesis, papers, research projects
 * - Business/Project: Client work, internal projects
 *
 * NOTE: This is a copy of the file from fileOrganizer/workspaceTemplates.ts
 * for use in React components. Keep in sync with the original.
 */

export type WorkspaceType = 'legal' | 'research' | 'business';

/**
 * Field definition for dynamic rendering
 */
export interface FieldDefinition {
	key: string;
	label: string;
	type: 'text' | 'textarea' | 'date' | 'select' | 'array' | 'group';
	placeholder?: string;
	description?: string;
	required?: boolean;
	options?: string[]; // For select type
	fields?: FieldDefinition[]; // For group type (nested fields)
}

/**
 * Section definition for UI grouping
 */
export interface SectionDefinition {
	id: string;
	title: string;
	icon?: string;
	description?: string;
	collapsible?: boolean;
	defaultCollapsed?: boolean;
	fields: FieldDefinition[];
}

/**
 * Complete template definition
 */
export interface WorkspaceTemplate {
	id: WorkspaceType;
	name: string;
	description: string;
	icon: string;
	sections: SectionDefinition[];
	defaultConfig: Record<string, unknown>;
	keywords: {
		categories: string[];
		defaults: Record<string, string[]>;
	};
}

// ============================================================================
// LEGAL / CLAIMS TEMPLATE
// ============================================================================

export const LEGAL_TEMPLATE: WorkspaceTemplate = {
	id: 'legal',
	name: 'Legal / Claims',
	description: 'Workers compensation, personal injury, disability claims, and legal cases',
	icon: '⚖️',
	sections: [
		{
			id: 'projectInfo',
			title: 'Case Information',
			icon: '📋',
			description: 'Basic case identification details',
			collapsible: true,
			fields: [
				{ key: 'clientName', label: 'Claimant/Client Name', type: 'text', placeholder: 'e.g., John Doe', required: true },
				{ key: 'caseNumber', label: 'Case Number', type: 'text', placeholder: 'e.g., WCB-2024-12345' },
				{ key: 'caseType', label: 'Case Type', type: 'select', options: ['Workers Compensation', 'Personal Injury', 'Disability Claim', 'Employment Dispute', 'Other'] },
				{ key: 'incidentDate', label: 'Incident/Injury Date', type: 'date' },
				{ key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description of the case...' },
			]
		},
		{
			id: 'yourSide',
			title: 'Your Side',
			icon: '👤',
			description: 'Claimant, treating physicians, advocates, and supporting parties',
			collapsible: true,
			fields: [
				{ key: 'parties.yourSide.client', label: 'Client', type: 'text', placeholder: 'Primary claimant name' },
				{ key: 'parties.yourSide.lawyers', label: 'Lawyers', type: 'array', placeholder: 'e.g., Jane Smith, Attorney' },
				{ key: 'parties.yourSide.experts', label: 'Treating Physicians/Experts', type: 'array', placeholder: 'e.g., Dr. Robert Johnson' },
				{ key: 'parties.yourSide.advocates', label: 'Advocates', type: 'array', placeholder: 'e.g., Workers Rights Group' },
			]
		},
		{
			id: 'theirSide',
			title: 'Their Side',
			icon: '🏢',
			description: 'Employer, insurer, defense counsel, and opposing parties',
			collapsible: true,
			fields: [
				{ key: 'parties.theirSide.opposing', label: 'Opposing Party', type: 'text', placeholder: 'e.g., ABC Warehouse Inc.' },
				{ key: 'parties.theirSide.lawyers', label: 'Defense Lawyers', type: 'array', placeholder: 'e.g., Defense Corp LLP' },
				{ key: 'parties.theirSide.experts', label: 'IME Doctors/Experts', type: 'array', placeholder: 'e.g., Dr. IME Examiner' },
				{ key: 'parties.theirSide.officials', label: 'Officials (Case Managers, Review Officers)', type: 'array', placeholder: 'e.g., Case Manager, Review Officer' },
			]
		},
		{
			id: 'tribunal',
			title: 'Tribunal / Board',
			icon: '🏛️',
			description: 'Appeal tribunal, review board, or court information',
			collapsible: true,
			defaultCollapsed: true,
			fields: [
				{ key: 'parties.tribunal.name', label: 'Tribunal/Board Name', type: 'text', placeholder: 'e.g., Workers Compensation Appeal Tribunal' },
				{ key: 'parties.tribunal.adjudicators', label: 'Adjudicators', type: 'array', placeholder: 'e.g., Adjudicator Williams' },
				{ key: 'parties.tribunal.references', label: 'Reference Numbers', type: 'array', placeholder: 'e.g., REF-2024-001' },
			]
		},
		{
			id: 'keywords',
			title: 'Classification Keywords',
			icon: '🏷️',
			description: 'Keywords for automatic file tagging and organization',
			collapsible: true,
			defaultCollapsed: true,
			fields: [
				{ key: 'keywords.yourSide', label: 'Your Side Keywords', type: 'array', placeholder: 'claimant, treating, advocate' },
				{ key: 'keywords.theirSide', label: 'Their Side Keywords', type: 'array', placeholder: 'employer, ime, defense' },
				{ key: 'keywords.documents', label: 'Document Keywords', type: 'array', placeholder: 'medical, legal, decision' },
			]
		},
	],
	defaultConfig: {
		version: '1.0',
		workspaceType: 'legal',
		projectInfo: {
			caseType: 'Workers Compensation',
		},
		parties: {
			yourSide: { client: '', lawyers: [], experts: [], advocates: [] },
			theirSide: { opposing: '', lawyers: [], experts: [], officials: [] },
			tribunal: { name: '', adjudicators: [], references: [] },
		},
		keywords: {
			yourSide: ['claimant', 'treating', 'advocate', 'therapy'],
			theirSide: ['employer', 'ime', 'defense', 'denial'],
			documents: ['medical', 'legal', 'decision', 'appeal'],
		},
		organizationSettings: {
			template: 'workers-comp-full',
			preserveOriginalNames: true,
			createBackup: true,
		},
	},
	keywords: {
		categories: ['yourSide', 'theirSide', 'documents'],
		defaults: {
			yourSide: ['claimant', 'treating', 'advocate', 'therapy'],
			theirSide: ['employer', 'ime', 'defense', 'denial'],
			documents: ['medical', 'legal', 'decision', 'appeal'],
		},
	},
};

// ============================================================================
// RESEARCH / ACADEMIC TEMPLATE
// ============================================================================

export const RESEARCH_TEMPLATE: WorkspaceTemplate = {
	id: 'research',
	name: 'Research / Academic',
	description: 'Thesis, dissertations, research papers, and academic projects',
	icon: '🎓',
	sections: [
		{
			id: 'projectInfo',
			title: 'Project Information',
			icon: '📚',
			description: 'Research project identification',
			collapsible: true,
			fields: [
				{ key: 'projectInfo.title', label: 'Project Title', type: 'text', placeholder: 'e.g., Impact of Remote Work on Employee Wellbeing', required: true },
				{ key: 'projectInfo.type', label: 'Project Type', type: 'select', options: ['Thesis', 'Dissertation', 'Research Paper', 'Literature Review', 'Case Study', 'Other'] },
				{ key: 'projectInfo.researchQuestion', label: 'Research Question', type: 'textarea', placeholder: 'What is your primary research question?' },
				{ key: 'projectInfo.targetDate', label: 'Target Completion Date', type: 'date' },
			]
		},
		{
			id: 'people',
			title: 'People',
			icon: '👥',
			description: 'Authors, supervisors, and collaborators',
			collapsible: true,
			fields: [
				{ key: 'people.author', label: 'Author/Researcher', type: 'text', placeholder: 'Your name', required: true },
				{ key: 'people.supervisor', label: 'Supervisor/Advisor', type: 'text', placeholder: 'e.g., Dr. Faculty Advisor' },
				{ key: 'people.collaborators', label: 'Collaborators', type: 'array', placeholder: 'e.g., Co-author, Research Assistant' },
				{ key: 'people.fundingBody', label: 'Funding Body', type: 'text', placeholder: 'e.g., University Research Grant' },
			]
		},
		{
			id: 'sources',
			title: 'Sources & Databases',
			icon: '📖',
			description: 'Primary sources, databases, and key references',
			collapsible: true,
			fields: [
				{ key: 'sources.primaryDatabases', label: 'Primary Databases', type: 'array', placeholder: 'e.g., PubMed, JSTOR, Google Scholar' },
				{ key: 'sources.keyAuthors', label: 'Key Authors', type: 'array', placeholder: 'e.g., Smith, J., Johnson, R.' },
				{ key: 'sources.sourceTypes', label: 'Source Types', type: 'array', placeholder: 'e.g., peer-reviewed, grey-literature' },
			]
		},
		{
			id: 'keywords',
			title: 'Keywords & Methodology',
			icon: '🏷️',
			description: 'Keywords for categorization and search',
			collapsible: true,
			fields: [
				{ key: 'keywords.primary', label: 'Primary Keywords', type: 'array', placeholder: 'Main research topics' },
				{ key: 'keywords.secondary', label: 'Secondary Keywords', type: 'array', placeholder: 'Related concepts' },
				{ key: 'keywords.methodology', label: 'Methodology Keywords', type: 'array', placeholder: 'e.g., qualitative, survey, thematic analysis' },
			]
		},
		{
			id: 'organization',
			title: 'Organization Settings',
			icon: '⚙️',
			description: 'File organization preferences',
			collapsible: true,
			defaultCollapsed: true,
			fields: [
				{ key: 'organizationSettings.citationStyle', label: 'Citation Style', type: 'select', options: ['APA7', 'APA6', 'MLA', 'Chicago', 'Harvard', 'IEEE', 'Vancouver'] },
				{ key: 'organizationSettings.template', label: 'Folder Template', type: 'select', options: ['thesis', 'research-paper', 'literature-review', 'custom'] },
			]
		},
	],
	defaultConfig: {
		version: '1.0',
		workspaceType: 'research',
		projectInfo: {
			type: 'Thesis',
		},
		people: {
			author: '',
			supervisor: '',
			collaborators: [],
			fundingBody: '',
		},
		sources: {
			primaryDatabases: [],
			keyAuthors: [],
			sourceTypes: ['peer-reviewed'],
		},
		keywords: {
			primary: [],
			secondary: [],
			methodology: [],
		},
		organizationSettings: {
			template: 'thesis',
			citationStyle: 'APA7',
			preserveOriginalNames: true,
		},
	},
	keywords: {
		categories: ['primary', 'secondary', 'methodology'],
		defaults: {
			primary: [],
			secondary: [],
			methodology: ['qualitative', 'quantitative', 'mixed-methods'],
		},
	},
};

// ============================================================================
// BUSINESS / PROJECT TEMPLATE
// ============================================================================

export const BUSINESS_TEMPLATE: WorkspaceTemplate = {
	id: 'business',
	name: 'Business / Project',
	description: 'Client projects, internal initiatives, and business deliverables',
	icon: '💼',
	sections: [
		{
			id: 'projectInfo',
			title: 'Project Information',
			icon: '📋',
			description: 'Project identification and scope',
			collapsible: true,
			fields: [
				{ key: 'projectInfo.name', label: 'Project Name', type: 'text', placeholder: 'e.g., Website Redesign - Acme Corp', required: true },
				{ key: 'projectInfo.type', label: 'Project Type', type: 'select', options: ['Client Deliverable', 'Internal Project', 'Product Development', 'Consulting', 'Other'] },
				{ key: 'projectInfo.description', label: 'Description', type: 'textarea', placeholder: 'Brief project description...' },
				{ key: 'projectInfo.deadline', label: 'Deadline', type: 'date' },
			]
		},
		{
			id: 'stakeholders',
			title: 'Stakeholders',
			icon: '👥',
			description: 'Clients, team members, and vendors',
			collapsible: true,
			fields: [
				{ key: 'stakeholders.client', label: 'Client/Company', type: 'text', placeholder: 'e.g., Acme Corporation' },
				{ key: 'stakeholders.clientContact', label: 'Client Contact', type: 'text', placeholder: 'e.g., Jane Client, Marketing Director' },
				{ key: 'stakeholders.projectLead', label: 'Project Lead', type: 'text', placeholder: 'Your name' },
				{ key: 'stakeholders.team', label: 'Team Members', type: 'array', placeholder: 'e.g., Designer, Developer' },
				{ key: 'stakeholders.vendors', label: 'Vendors', type: 'array', placeholder: 'e.g., Hosting Provider' },
			]
		},
		{
			id: 'categories',
			title: 'Document Categories',
			icon: '📁',
			description: 'Document types, confidentiality levels, and project phases',
			collapsible: true,
			fields: [
				{ key: 'categories.documentTypes', label: 'Document Types', type: 'array', placeholder: 'contracts, proposals, invoices' },
				{ key: 'categories.confidentiality', label: 'Confidentiality Levels', type: 'array', placeholder: 'client-confidential, internal, public' },
				{ key: 'categories.phases', label: 'Project Phases', type: 'array', placeholder: 'discovery, design, development, launch' },
			]
		},
		{
			id: 'keywords',
			title: 'Keywords & Tags',
			icon: '🏷️',
			description: 'Keywords for file organization',
			collapsible: true,
			fields: [
				{ key: 'keywords.project', label: 'Project Keywords', type: 'array', placeholder: 'Main project identifiers' },
				{ key: 'keywords.deliverables', label: 'Deliverable Keywords', type: 'array', placeholder: 'mockup, prototype, final' },
				{ key: 'keywords.status', label: 'Status Keywords', type: 'array', placeholder: 'draft, review, approved, archived' },
			]
		},
		{
			id: 'organization',
			title: 'Organization Settings',
			icon: '⚙️',
			description: 'File naming and organization preferences',
			collapsible: true,
			defaultCollapsed: true,
			fields: [
				{ key: 'organizationSettings.template', label: 'Folder Template', type: 'select', options: ['client-project', 'internal-project', 'product', 'custom'] },
				{ key: 'organizationSettings.namingConvention', label: 'Naming Convention', type: 'text', placeholder: 'e.g., YYYY-MM-DD_Type_Description' },
			]
		},
	],
	defaultConfig: {
		version: '1.0',
		workspaceType: 'business',
		projectInfo: {
			type: 'Client Deliverable',
		},
		stakeholders: {
			client: '',
			clientContact: '',
			projectLead: '',
			team: [],
			vendors: [],
		},
		categories: {
			documentTypes: ['contracts', 'proposals', 'wireframes', 'invoices'],
			confidentiality: ['client-confidential', 'internal', 'public'],
			phases: ['discovery', 'design', 'development', 'launch'],
		},
		keywords: {
			project: [],
			deliverables: ['mockup', 'prototype', 'final'],
			status: ['draft', 'review', 'approved', 'archived'],
		},
		organizationSettings: {
			template: 'client-project',
			preserveOriginalNames: false,
			namingConvention: 'YYYY-MM-DD_Type_Description',
		},
	},
	keywords: {
		categories: ['project', 'deliverables', 'status'],
		defaults: {
			project: [],
			deliverables: ['mockup', 'prototype', 'final'],
			status: ['draft', 'review', 'approved', 'archived'],
		},
	},
};

// ============================================================================
// TEMPLATE UTILITIES
// ============================================================================

/**
 * All available templates
 */
export const WORKSPACE_TEMPLATES: Record<WorkspaceType, WorkspaceTemplate> = {
	legal: LEGAL_TEMPLATE,
	research: RESEARCH_TEMPLATE,
	business: BUSINESS_TEMPLATE,
};

/**
 * Get template by workspace type
 */
export function getTemplate(workspaceType: WorkspaceType): WorkspaceTemplate {
	return WORKSPACE_TEMPLATES[workspaceType] || LEGAL_TEMPLATE;
}

/**
 * Get all template options for dropdown
 */
export function getTemplateOptions(): Array<{ id: WorkspaceType; name: string; icon: string }> {
	return Object.values(WORKSPACE_TEMPLATES).map(t => ({
		id: t.id,
		name: t.name,
		icon: t.icon,
	}));
}

/**
 * Detect workspace type from existing config
 */
export function detectWorkspaceType(config: Record<string, unknown>): WorkspaceType {
	// Check explicit workspaceType field
	if (config.workspaceType && typeof config.workspaceType === 'string') {
		const type = config.workspaceType as string;
		if (type in WORKSPACE_TEMPLATES) {
			return type as WorkspaceType;
		}
	}

	// Heuristic detection based on field presence
	if (config.parties || config.caseInfo) {
		return 'legal';
	}
	if (config.people || config.sources) {
		return 'research';
	}
	if (config.stakeholders || config.categories) {
		return 'business';
	}

	// Default to legal (original use case)
	return 'legal';
}

/**
 * Get a value from nested path like "parties.yourSide.client"
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split('.');
	let current: unknown = obj;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined;
		}
		if (typeof current === 'object') {
			current = (current as Record<string, unknown>)[part];
		} else {
			return undefined;
		}
	}

	return current;
}

/**
 * Set a value at nested path like "parties.yourSide.client"
 */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
	const parts = path.split('.');
	let current = obj;

	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (!(part in current) || typeof current[part] !== 'object') {
			current[part] = {};
		}
		current = current[part] as Record<string, unknown>;
	}

	current[parts[parts.length - 1]] = value;
}

/**
 * Create a new config from template defaults
 */
export function createConfigFromTemplate(workspaceType: WorkspaceType): Record<string, unknown> {
	const template = getTemplate(workspaceType);
	return {
		...JSON.parse(JSON.stringify(template.defaultConfig)),
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationIssue {
	field: string;
	message: string;
	severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
	isValid: boolean;
	issues: ValidationIssue[];
}

/**
 * Validate a config against its template
 */
export function validateConfig(config: Record<string, unknown>, workspaceType: WorkspaceType): ValidationResult {
	const template = getTemplate(workspaceType);
	const issues: ValidationIssue[] = [];

	// Check version
	if (!config.version) {
		issues.push({ field: 'version', message: 'Missing version field', severity: 'warning' });
	}

	// Check workspaceType matches
	if (config.workspaceType && config.workspaceType !== workspaceType) {
		issues.push({
			field: 'workspaceType',
			message: `Workspace type mismatch: expected "${workspaceType}", found "${config.workspaceType}"`,
			severity: 'warning'
		});
	}

	// Check required fields from template
	for (const section of template.sections) {
		for (const field of section.fields) {
			if (field.required) {
				const value = getNestedValue(config, field.key);
				if (value === undefined || value === null || value === '') {
					issues.push({
						field: field.key,
						message: `Required field "${field.label}" is missing or empty`,
						severity: 'error'
					});
				}
			}

			// Validate date format for date fields
			if (field.type === 'date') {
				const value = getNestedValue(config, field.key);
				if (value && typeof value === 'string' && value.length > 0) {
					const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
					if (!dateRegex.test(value)) {
						issues.push({
							field: field.key,
							message: `Invalid date format for "${field.label}". Expected YYYY-MM-DD`,
							severity: 'warning'
						});
					}
				}
			}

			// Validate array fields have array values
			if (field.type === 'array') {
				const value = getNestedValue(config, field.key);
				if (value !== undefined && !Array.isArray(value)) {
					issues.push({
						field: field.key,
						message: `Field "${field.label}" should be an array`,
						severity: 'warning'
					});
				}
			}
		}
	}

	// Check for duplicate keywords
	const keywords = config.keywords as Record<string, string[]> | undefined;
	if (keywords) {
		const allKeywords: string[] = [];
		for (const [category, words] of Object.entries(keywords)) {
			if (Array.isArray(words)) {
				for (const word of words) {
					if (allKeywords.includes(word.toLowerCase())) {
						issues.push({
							field: `keywords.${category}`,
							message: `Duplicate keyword "${word}" found across categories`,
							severity: 'info'
						});
					}
					allKeywords.push(word.toLowerCase());
				}
			}
		}
	}

	return {
		isValid: issues.filter(i => i.severity === 'error').length === 0,
		issues
	};
}

/**
 * Generate an AI prompt to fix validation issues
 */
export function generateFixPrompt(config: Record<string, unknown>, issues: ValidationIssue[]): string {
	const workspaceType = (config.workspaceType as string) || 'legal';
	const template = getTemplate(workspaceType as WorkspaceType);

	let prompt = `Please help me fix the following issues with my ${template.name} configuration file (.fileorg.json):\n\n`;

	prompt += `**Issues Found:**\n`;
	for (const issue of issues) {
		const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
		prompt += `${icon} ${issue.message} (field: ${issue.field})\n`;
	}

	prompt += `\n**Current Configuration:**\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\`\n\n`;

	prompt += `**Expected Schema for ${template.name}:**\n`;
	prompt += `Workspace type: ${workspaceType}\n`;
	prompt += `Sections:\n`;
	for (const section of template.sections) {
		prompt += `- ${section.title}: ${section.fields.map(f => f.key).join(', ')}\n`;
	}

	prompt += `\nPlease update the configuration to fix these issues and ensure it follows the correct schema.`;

	return prompt;
}
