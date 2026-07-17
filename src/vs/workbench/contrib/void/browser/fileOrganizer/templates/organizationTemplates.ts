/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { OrganizationTemplate } from '../types.js';

export const ORGANIZATION_TEMPLATES: OrganizationTemplate[] = [
	{
		id: 'workers-comp-full',
		name: 'Workers Compensation - Full Case',
		description: 'Complete organization for workers comp case files with medical, legal, and correspondence',
		icon: '$(law)',
		rules: [
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'medical' }
				],
				action: {
					tags: ['medical', 'case-document'],
					targetPath: 'Medical'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'doctor' }
				],
				action: {
					tags: ['medical', 'physician', 'case-document'],
					targetPath: 'Medical'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'legal' }
				],
				action: {
					tags: ['legal', 'case-document'],
					targetPath: 'Legal'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'court' }
				],
				action: {
					tags: ['legal', 'court', 'case-document'],
					targetPath: 'Legal'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'decision' }
				],
				action: {
					tags: ['decision', 'ruling', 'case-document'],
					targetPath: 'Decisions'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'correspondence' }
				],
				action: {
					tags: ['correspondence', 'communication'],
					targetPath: 'Correspondence'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'evidence' }
				],
				action: {
					tags: ['evidence', 'case-document'],
					targetPath: 'Evidence'
				}
			},
			{
				type: 'rename',
				pattern: '{Description}',
				conditions: [],
				action: {
					nameFormat: '{Description}'
				}
			}
		]
	},
	{
		id: 'medical-reports',
		name: 'Medical Reports Only',
		description: 'Focus on organizing medical documentation with detailed categories',
		icon: '$(pulse)',
		rules: [
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'initial' }
				],
				action: {
					tags: ['medical', 'initial-report']
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'treatment' }
				],
				action: {
					tags: ['medical', 'treatment-record']
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'diagnostic' }
				],
				action: {
					tags: ['medical', 'diagnostic']
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'mri' }
				],
				action: {
					tags: ['medical', 'diagnostic', 'mri']
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'xray' }
				],
				action: {
					tags: ['medical', 'diagnostic', 'xray']
				}
			},
			{
				type: 'rename',
				pattern: '{Description}',
				conditions: [],
				action: {
					nameFormat: '{Description}'
				}
			}
		]
	},
	{
		id: 'legal-documents',
		name: 'Legal Documents Only',
		description: 'Organize legal filings, court documents, and attorney correspondence',
		icon: '$(briefcase)',
		rules: [
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'filing' }
				],
				action: {
					tags: ['legal', 'court-filing']
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'motion' }
				],
				action: {
					tags: ['legal', 'motion']
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'judgment' }
				],
				action: {
					tags: ['legal', 'judgment']
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'attorney' }
				],
				action: {
					tags: ['legal', 'attorney-correspondence']
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'appeal' }
				],
				action: {
					tags: ['legal', 'appeal']
				}
			},
			{
				type: 'rename',
				pattern: '{Description}',
				conditions: [],
				action: {
					nameFormat: '{Description}'
				}
			}
		]
	},
	{
		id: 'correspondence',
		name: 'Correspondence & Communications',
		description: 'Organize emails, letters, and communications by sender/recipient',
		icon: '$(mail)',
		rules: [
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'insurance' }
				],
				action: {
					tags: ['correspondence', 'insurance']
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'employer' }
				],
				action: {
					tags: ['correspondence', 'employer']
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'wcb' }
				],
				action: {
					tags: ['correspondence', 'wcb', 'government']
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'extension', operator: 'equals', value: 'eml' }
				],
				action: {
					tags: ['correspondence', 'email']
				}
			},
			{
				type: 'rename',
				pattern: '{Description}',
				conditions: [],
				action: {
					nameFormat: '{Description}'
				}
			}
		]
	},
	{
		id: 'your-side-their-side',
		name: 'Your Side vs Their Side',
		description: 'Organize by source: Your documents vs Employer/WCB/Other party documents',
		icon: '$(symbol-namespace)',
		rules: [
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'your' }
				],
				action: {
					tags: ['your-side', 'claimant'],
					targetPath: 'YourSide'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'my' }
				],
				action: {
					tags: ['your-side', 'claimant'],
					targetPath: 'YourSide'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'personal' }
				],
				action: {
					tags: ['your-side', 'claimant', 'personal'],
					targetPath: 'YourSide'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'employer' }
				],
				action: {
					tags: ['their-side', 'employer'],
					targetPath: 'TheirSide'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'wcb' }
				],
				action: {
					tags: ['their-side', 'wcb', 'government'],
					targetPath: 'TheirSide'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'ime' }
				],
				action: {
					tags: ['their-side', 'ime', 'independent-medical-exam'],
					targetPath: 'TheirSide'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'defense' }
				],
				action: {
					tags: ['their-side', 'defense'],
					targetPath: 'TheirSide'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'review officer' }
				],
				action: {
					tags: ['their-side', 'review-officer', 'wcb'],
					targetPath: 'TheirSide'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'treating' }
				],
				action: {
					tags: ['your-side', 'treating-physician'],
					targetPath: 'YourSide'
				}
			},
			{
				type: 'tag',
				conditions: [
					{ field: 'name', operator: 'contains', value: 'claimant' }
				],
				action: {
					tags: ['your-side', 'claimant'],
					targetPath: 'YourSide'
				}
			},
			{
				type: 'rename',
				pattern: '{Description}',
				conditions: [],
				action: {
					nameFormat: '{Description}'
				}
			}
		]
	},
	{
		id: 'chronological',
		name: 'Chronological Organization',
		description: 'Organize all case documents by date for timeline tracking',
		icon: '$(calendar)',
		rules: [
			{
				type: 'rename',
				pattern: '{Description}',
				conditions: [],
				action: {
					nameFormat: '{Description}'
				}
			},
			{
				type: 'tag',
				conditions: [],
				action: {
					tags: ['chronological', 'dated']
				}
			}
		]
	},
	{
		id: 'quick-sort-ai',
		name: 'Quick Sort - AI Assisted',
		description: 'Fast automated sorting using AI to detect document types',
		icon: '$(sparkle)',
		rules: [
			{
				type: 'tag',
				conditions: [],
				action: {
					tags: ['ai-sorted', 'auto-categorized']
				}
			},
			{
				type: 'rename',
				pattern: '{Description}',
				conditions: [],
				action: {
					nameFormat: '{Description}'
				}
			}
		]
	},
	{
		id: 'custom',
		name: 'Custom',
		description: 'Start with a blank template and create your own rules',
		icon: '$(edit)',
		rules: []
	}
];

export function getTemplateById(id: string): OrganizationTemplate | undefined {
	return ORGANIZATION_TEMPLATES.find(t => t.id === id);
}

export function getDefaultTemplate(): OrganizationTemplate {
	return ORGANIZATION_TEMPLATES[0];
}


