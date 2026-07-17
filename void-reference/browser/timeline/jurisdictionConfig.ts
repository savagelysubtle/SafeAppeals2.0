/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { JurisdictionConfig } from '../../common/timeline/timelineTypes.js';

/**
 * Default jurisdiction configurations for workers' compensation appeals
 * These define statute of limitations and deadline rules by region
 */
export const DEFAULT_JURISDICTIONS: JurisdictionConfig[] = [
	// ============================================================================
	// CANADA
	// ============================================================================
	{
		id: 'bc-wcb',
		name: 'British Columbia WorkSafeBC',
		region: 'CA-BC',
		statuteOfLimitationsDays: 90,
		deadlineRules: [
			{
				id: 'bc-review-division',
				name: 'Review Division Appeal',
				daysFromTrigger: 90,
				triggerEvent: 'decision',
				description: 'Appeal a WorkSafeBC decision to the Review Division within 90 days'
			},
			{
				id: 'bc-wcat',
				name: 'WCAT Appeal',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal a Review Division decision to WCAT within 30 days'
			},
			{
				id: 'bc-reconsideration',
				name: 'Reconsideration Request',
				daysFromTrigger: 75,
				triggerEvent: 'decision',
				description: 'Request reconsideration before Review Division deadline'
			}
		]
	},
	{
		id: 'ontario-wsib',
		name: 'Ontario WSIB',
		region: 'CA-ON',
		statuteOfLimitationsDays: 30,
		deadlineRules: [
			{
				id: 'on-aro',
				name: 'ARO Review',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Request Appeals Resolution Officer review within 30 days'
			},
			{
				id: 'on-wsiat',
				name: 'WSIAT Appeal',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal ARO decision to WSIAT within 30 days'
			}
		]
	},
	{
		id: 'alberta-wcb',
		name: 'Alberta WCB',
		region: 'CA-AB',
		statuteOfLimitationsDays: 60,
		deadlineRules: [
			{
				id: 'ab-drdrb',
				name: 'DRDRB Review',
				daysFromTrigger: 60,
				triggerEvent: 'decision',
				description: 'Request Dispute Resolution and Decision Review Body review'
			},
			{
				id: 'ab-appeals-commission',
				name: 'Appeals Commission',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal to Appeals Commission within 30 days'
			}
		]
	},
	{
		id: 'quebec-cnesst',
		name: 'Quebec CNESST',
		region: 'CA-QC',
		statuteOfLimitationsDays: 30,
		deadlineRules: [
			{
				id: 'qc-review',
				name: 'Administrative Review',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Request administrative review of CNESST decision'
			},
			{
				id: 'qc-tat',
				name: 'TAT Appeal',
				daysFromTrigger: 45,
				triggerEvent: 'decision',
				description: 'Appeal to Tribunal administratif du travail'
			}
		]
	},
	{
		id: 'manitoba-wcb',
		name: 'Manitoba WCB',
		region: 'CA-MB',
		statuteOfLimitationsDays: 30,
		deadlineRules: [
			{
				id: 'mb-review-office',
				name: 'Review Office',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Request Review Office review within 30 days'
			},
			{
				id: 'mb-appeal-commission',
				name: 'Appeal Commission',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal to Appeal Commission'
			}
		]
	},
	{
		id: 'saskatchewan-wcb',
		name: 'Saskatchewan WCB',
		region: 'CA-SK',
		statuteOfLimitationsDays: 60,
		deadlineRules: [
			{
				id: 'sk-board-review',
				name: 'Board Review',
				daysFromTrigger: 60,
				triggerEvent: 'decision',
				description: 'Request Board review of decision'
			}
		]
	},
	{
		id: 'nova-scotia-wcb',
		name: 'Nova Scotia WCB',
		region: 'CA-NS',
		statuteOfLimitationsDays: 30,
		deadlineRules: [
			{
				id: 'ns-iro',
				name: 'Internal Review',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Request internal review of decision'
			},
			{
				id: 'ns-wcat',
				name: 'WCAT Appeal',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal to Workers Compensation Appeals Tribunal'
			}
		]
	},
	// ============================================================================
	// USA - Major States
	// ============================================================================
	{
		id: 'california-dwc',
		name: 'California DWC',
		region: 'US-CA',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'ca-petition',
				name: 'Petition for Reconsideration',
				daysFromTrigger: 20,
				triggerEvent: 'decision',
				description: 'File petition for reconsideration within 20 days'
			},
			{
				id: 'ca-appeal',
				name: 'Appeal to Court',
				daysFromTrigger: 45,
				triggerEvent: 'decision',
				description: 'Appeal WCAB decision to Court of Appeal'
			}
		]
	},
	{
		id: 'texas-dwc',
		name: 'Texas DWC',
		region: 'US-TX',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'tx-contested-case',
				name: 'Contested Case Hearing',
				daysFromTrigger: 20,
				triggerEvent: 'decision',
				description: 'Request contested case hearing'
			},
			{
				id: 'tx-appeals-panel',
				name: 'Appeals Panel Review',
				daysFromTrigger: 15,
				triggerEvent: 'decision',
				description: 'Request Appeals Panel review'
			}
		]
	},
	{
		id: 'new-york-wcb',
		name: 'New York WCB',
		region: 'US-NY',
		statuteOfLimitationsDays: 730, // 2 years
		deadlineRules: [
			{
				id: 'ny-review',
				name: 'Application for Review',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'File application for Board review'
			},
			{
				id: 'ny-appeal',
				name: 'Appeal to Court',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal Board decision to Appellate Division'
			}
		]
	},
	{
		id: 'florida-dwc',
		name: 'Florida DWC',
		region: 'US-FL',
		statuteOfLimitationsDays: 730, // 2 years
		deadlineRules: [
			{
				id: 'fl-petition',
				name: 'Petition for Benefits',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'File petition for benefits with Judge of Compensation Claims'
			}
		]
	},
	{
		id: 'washington-lni',
		name: 'Washington L&I',
		region: 'US-WA',
		statuteOfLimitationsDays: 60,
		deadlineRules: [
			{
				id: 'wa-protest',
				name: 'Protest Decision',
				daysFromTrigger: 60,
				triggerEvent: 'decision',
				description: 'Protest L&I decision within 60 days'
			},
			{
				id: 'wa-biia',
				name: 'BIIA Appeal',
				daysFromTrigger: 60,
				triggerEvent: 'decision',
				description: 'Appeal to Board of Industrial Insurance Appeals'
			}
		]
	},
	// ============================================================================
	// CUSTOM / OTHER
	// ============================================================================
	{
		id: 'custom',
		name: 'Custom Jurisdiction',
		region: 'CUSTOM',
		statuteOfLimitationsDays: 90,
		deadlineRules: []
	}
];

/**
 * Get jurisdiction by ID
 */
export function getJurisdictionById(id: string): JurisdictionConfig | undefined {
	return DEFAULT_JURISDICTIONS.find(j => j.id === id);
}

/**
 * Get jurisdictions by region prefix (e.g., 'CA' for Canada, 'US' for USA)
 */
export function getJurisdictionsByRegion(regionPrefix: string): JurisdictionConfig[] {
	return DEFAULT_JURISDICTIONS.filter(j => j.region.startsWith(regionPrefix));
}

/**
 * Group jurisdictions by country
 */
export function getJurisdictionsGrouped(): Record<string, JurisdictionConfig[]> {
	return {
		'Canada': getJurisdictionsByRegion('CA'),
		'United States': getJurisdictionsByRegion('US'),
		'Other': DEFAULT_JURISDICTIONS.filter(j => j.region === 'CUSTOM')
	};
}

