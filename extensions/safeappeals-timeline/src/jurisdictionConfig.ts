/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { JurisdictionConfig } from './timelineTypes';

/**
 * Statute-of-limitations days and post-decision deadline rules by jurisdiction.
 * Canada / major US entries ported from void-reference; remaining boards use
 * documented windows where known, otherwise a conservative default with empty
 * decision rules (agent / user add deadlines manually).
 */
export const DEFAULT_JURISDICTIONS: readonly JurisdictionConfig[] = [
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
				description: 'Appeal a WorkSafeBC decision to the Review Division within 90 days',
			},
			{
				id: 'bc-wcat',
				name: 'WCAT Appeal',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal a Review Division decision to WCAT within 30 days',
			},
			{
				id: 'bc-reconsideration',
				name: 'Reconsideration Request',
				daysFromTrigger: 75,
				triggerEvent: 'decision',
				description: 'Request reconsideration before Review Division deadline',
			},
		],
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
				description: 'Request Appeals Resolution Officer review within 30 days',
			},
			{
				id: 'on-wsiat',
				name: 'WSIAT Appeal',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal ARO decision to WSIAT within 30 days',
			},
		],
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
				description: 'Request Dispute Resolution and Decision Review Body review',
			},
			{
				id: 'ab-appeals-commission',
				name: 'Appeals Commission',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal to Appeals Commission within 30 days',
			},
		],
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
				description: 'Request administrative review of CNESST decision',
			},
			{
				id: 'qc-tat',
				name: 'TAT Appeal',
				daysFromTrigger: 45,
				triggerEvent: 'decision',
				description: 'Appeal to Tribunal administratif du travail',
			},
		],
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
				description: 'Request Review Office review within 30 days',
			},
			{
				id: 'mb-appeal-commission',
				name: 'Appeal Commission',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal to Appeal Commission',
			},
		],
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
				description: 'Request Board review of decision',
			},
		],
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
				description: 'Request internal review of decision',
			},
			{
				id: 'ns-wcat',
				name: 'WCAT Appeal',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal to Workers Compensation Appeals Tribunal',
			},
		],
	},
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
				description: 'File petition for reconsideration within 20 days',
			},
			{
				id: 'ca-appeal',
				name: 'Appeal to Court',
				daysFromTrigger: 45,
				triggerEvent: 'decision',
				description: 'Appeal WCAB decision to Court of Appeal',
			},
		],
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
				description: 'Request contested case hearing',
			},
			{
				id: 'tx-appeals-panel',
				name: 'Appeals Panel Review',
				daysFromTrigger: 15,
				triggerEvent: 'decision',
				description: 'Request Appeals Panel review',
			},
		],
	},
	{
		id: 'new-york-wcb',
		name: 'New York WCB',
		region: 'US-NY',
		statuteOfLimitationsDays: 730,
		deadlineRules: [
			{
				id: 'ny-review',
				name: 'Application for Review',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'File application for Board review',
			},
			{
				id: 'ny-appeal',
				name: 'Appeal to Court',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal Board decision to Appellate Division',
			},
		],
	},
	{
		id: 'florida-dwc',
		name: 'Florida DWC',
		region: 'US-FL',
		statuteOfLimitationsDays: 730,
		deadlineRules: [
			{
				id: 'fl-petition',
				name: 'Petition for Benefits',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'File petition for benefits with Judge of Compensation Claims',
			},
		],
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
				description: 'Protest L&I decision within 60 days',
			},
			{
				id: 'wa-biia',
				name: 'BIIA Appeal',
				daysFromTrigger: 60,
				triggerEvent: 'decision',
				description: 'Appeal to Board of Industrial Insurance Appeals',
			},
		],
	},
	{
		id: 'uk-dwp-iidb',
		name: 'UK DWP IIDB',
		region: 'UK-GB',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'uk-dwp-mr',
				name: 'Mandatory Reconsideration',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Request mandatory reconsideration of a DWP decision',
			},
		],
	},
	{
		id: 'uk-ftt-sscs',
		name: 'UK FTT SSCS',
		region: 'UK-GB',
		statuteOfLimitationsDays: 30,
		deadlineRules: [
			{
				id: 'uk-ftt-appeal',
				name: 'First-tier Tribunal Appeal',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal to the First-tier Tribunal (Social Security and Child Support)',
			},
		],
	},
	{
		id: 'ni-dfc-iidb',
		name: 'NI DfC IIDB',
		region: 'UK-NI',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'ni-dfc-mr',
				name: 'Mandatory Reconsideration',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Request mandatory reconsideration of a DfC decision',
			},
		],
	},
	{
		id: 'ni-appeal-tribunal',
		name: 'NI Appeal Tribunal',
		region: 'UK-NI',
		statuteOfLimitationsDays: 30,
		deadlineRules: [
			{
				id: 'ni-tribunal-appeal',
				name: 'Appeal Tribunal',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Appeal to the Appeal Tribunal',
			},
		],
	},
	{
		id: 'ie-dsp-oib',
		name: 'IE DSP OIB',
		region: 'IE',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'ie-dsp-review',
				name: 'DSP Review',
				daysFromTrigger: 21,
				triggerEvent: 'decision',
				description: 'Request review of an Occupational Injuries Benefit decision',
			},
		],
	},
	{
		id: 'ie-swao',
		name: 'IE SWAO',
		region: 'IE',
		statuteOfLimitationsDays: 21,
		deadlineRules: [
			{
				id: 'ie-swao-appeal',
				name: 'SWAO Appeal',
				daysFromTrigger: 21,
				triggerEvent: 'decision',
				description: 'Appeal to the Social Welfare Appeals Office',
			},
		],
	},
	{
		id: 'nsw-icare',
		name: 'NSW icare',
		region: 'AU-NSW',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'nsw-icare-dispute',
				name: 'Dispute Notice',
				daysFromTrigger: 28,
				triggerEvent: 'decision',
				description: 'Lodge a dispute against an insurer decision',
			},
		],
	},
	{
		id: 'nsw-pic',
		name: 'NSW PIC',
		region: 'AU-NSW',
		statuteOfLimitationsDays: 28,
		deadlineRules: [
			{
				id: 'nsw-pic-application',
				name: 'PIC Application',
				daysFromTrigger: 28,
				triggerEvent: 'decision',
				description: 'Apply to the Personal Injury Commission',
			},
		],
	},
	{
		id: 'vic-worksafe',
		name: 'VIC WorkSafe',
		region: 'AU-VIC',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'vic-worksafe-review',
				name: 'WorkSafe Review',
				daysFromTrigger: 60,
				triggerEvent: 'decision',
				description: 'Request review of a WorkSafe Victoria decision',
			},
		],
	},
	{
		id: 'vic-wic',
		name: 'VIC WIC',
		region: 'AU-VIC',
		statuteOfLimitationsDays: 60,
		deadlineRules: [
			{
				id: 'vic-wic-referral',
				name: 'WIC Conciliation',
				daysFromTrigger: 60,
				triggerEvent: 'decision',
				description: 'Refer a dispute to Workplace Injury Commission',
			},
		],
	},
	{
		id: 'qld-workcover',
		name: 'QLD WorkCover',
		region: 'AU-QLD',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'qld-workcover-review',
				name: 'WorkCover Review',
				daysFromTrigger: 90,
				triggerEvent: 'decision',
				description: 'Apply for review of a WorkCover decision',
			},
		],
	},
	{
		id: 'qld-wc-regulator',
		name: 'QLD WC Regulator',
		region: 'AU-QLD',
		statuteOfLimitationsDays: 90,
		deadlineRules: [
			{
				id: 'qld-regulator-review',
				name: 'Regulator Review',
				daysFromTrigger: 90,
				triggerEvent: 'decision',
				description: 'Apply to the Workers\' Compensation Regulator for review',
			},
		],
	},
	{
		id: 'qld-qirc',
		name: 'QLD QIRC',
		region: 'AU-QLD',
		statuteOfLimitationsDays: 21,
		deadlineRules: [
			{
				id: 'qld-qirc-appeal',
				name: 'QIRC Appeal',
				daysFromTrigger: 21,
				triggerEvent: 'decision',
				description: 'Appeal to the Queensland Industrial Relations Commission',
			},
		],
	},
	{
		id: 'wa-workcover',
		name: 'WA WorkCover',
		region: 'AU-WA',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'wa-workcover-dispute',
				name: 'Dispute Resolution',
				daysFromTrigger: 28,
				triggerEvent: 'decision',
				description: 'Lodge a dispute with WorkCover WA',
			},
		],
	},
	{
		id: 'wa-wc-arbitration',
		name: 'WA WC Arbitration',
		region: 'AU-WA',
		statuteOfLimitationsDays: 28,
		deadlineRules: [
			{
				id: 'wa-arbitration',
				name: 'Arbitration Application',
				daysFromTrigger: 28,
				triggerEvent: 'decision',
				description: 'Apply for workers\' compensation arbitration',
			},
		],
	},
	{
		id: 'sa-returntoworksa',
		name: 'SA ReturnToWorkSA',
		region: 'AU-SA',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'sa-rtw-review',
				name: 'Internal Review',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Request internal review of a ReturnToWorkSA decision',
			},
		],
	},
	{
		id: 'sa-saet',
		name: 'SA SAET',
		region: 'AU-SA',
		statuteOfLimitationsDays: 30,
		deadlineRules: [
			{
				id: 'sa-saet-application',
				name: 'SAET Application',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Apply to the South Australian Employment Tribunal',
			},
		],
	},
	{
		id: 'tas-worksafe',
		name: 'TAS WorkSafe',
		region: 'AU-TAS',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'tas-worksafe-dispute',
				name: 'Dispute Notice',
				daysFromTrigger: 60,
				triggerEvent: 'decision',
				description: 'Lodge a dispute against a workers compensation decision',
			},
		],
	},
	{
		id: 'tascat-workers',
		name: 'TASCAT Workers',
		region: 'AU-TAS',
		statuteOfLimitationsDays: 60,
		deadlineRules: [
			{
				id: 'tascat-application',
				name: 'TASCAT Application',
				daysFromTrigger: 60,
				triggerEvent: 'decision',
				description: 'Apply to TASCAT (Workers stream)',
			},
		],
	},
	{
		id: 'act-worksafe',
		name: 'ACT WorkSafe',
		region: 'AU-ACT',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'act-worksafe-dispute',
				name: 'Dispute Notice',
				daysFromTrigger: 28,
				triggerEvent: 'decision',
				description: 'Lodge a dispute against an insurer decision',
			},
		],
	},
	{
		id: 'act-wc-arbitration',
		name: 'ACT WC Arbitration',
		region: 'AU-ACT',
		statuteOfLimitationsDays: 28,
		deadlineRules: [
			{
				id: 'act-arbitration',
				name: 'Arbitration Application',
				daysFromTrigger: 28,
				triggerEvent: 'decision',
				description: 'Apply for workers\' compensation arbitration in the ACT',
			},
		],
	},
	{
		id: 'nt-worksafe',
		name: 'NT WorkSafe',
		region: 'AU-NT',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'nt-worksafe-dispute',
				name: 'Dispute Notice',
				daysFromTrigger: 90,
				triggerEvent: 'decision',
				description: 'Lodge a dispute against a workers compensation decision',
			},
		],
	},
	{
		id: 'nt-work-health-ct',
		name: 'NT Work Health Ct',
		region: 'AU-NT',
		statuteOfLimitationsDays: 90,
		deadlineRules: [
			{
				id: 'nt-whc-application',
				name: 'Work Health Court Application',
				daysFromTrigger: 90,
				triggerEvent: 'decision',
				description: 'Apply to the NT Work Health Court',
			},
		],
	},
	{
		id: 'au-comcare',
		name: 'AU Comcare',
		region: 'AU-CTH',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'au-comcare-reconsideration',
				name: 'Reconsideration',
				daysFromTrigger: 30,
				triggerEvent: 'decision',
				description: 'Request reconsideration of a Comcare determination',
			},
		],
	},
	{
		id: 'au-art',
		name: 'AU ART',
		region: 'AU-CTH',
		statuteOfLimitationsDays: 28,
		deadlineRules: [
			{
				id: 'au-art-application',
				name: 'ART Application',
				daysFromTrigger: 28,
				triggerEvent: 'decision',
				description: 'Apply to the Administrative Review Tribunal',
			},
		],
	},
	{
		id: 'nz-acc',
		name: 'NZ ACC',
		region: 'NZ',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'nz-acc-review',
				name: 'ACC Review',
				daysFromTrigger: 90,
				triggerEvent: 'decision',
				description: 'Apply for review of an ACC decision',
			},
		],
	},
	{
		id: 'nz-acc-appeals',
		name: 'NZ ACC Appeals',
		region: 'NZ',
		statuteOfLimitationsDays: 28,
		deadlineRules: [
			{
				id: 'nz-acc-district-court',
				name: 'District Court Appeal',
				daysFromTrigger: 28,
				triggerEvent: 'decision',
				description: 'Appeal an ACC review decision to the District Court',
			},
		],
	},
	{
		id: 'za-comp-fund',
		name: 'ZA Comp Fund',
		region: 'ZA',
		statuteOfLimitationsDays: 365,
		deadlineRules: [
			{
				id: 'za-comp-objection',
				name: 'Objection',
				daysFromTrigger: 90,
				triggerEvent: 'decision',
				description: 'Lodge an objection against a Compensation Fund decision',
			},
		],
	},
	{
		id: 'za-coida-tribunal',
		name: 'ZA COIDA Tribunal',
		region: 'ZA',
		statuteOfLimitationsDays: 90,
		deadlineRules: [
			{
				id: 'za-coida-appeal',
				name: 'COIDA Tribunal Appeal',
				daysFromTrigger: 90,
				triggerEvent: 'decision',
				description: 'Appeal to the COIDA Tribunal',
			},
		],
	},
];

export function getJurisdictionById(id: string): JurisdictionConfig | undefined {
	return DEFAULT_JURISDICTIONS.find(j => j.id === id);
}

export function getJurisdictionsByRegion(regionPrefix: string): JurisdictionConfig[] {
	return DEFAULT_JURISDICTIONS.filter(j => j.region.startsWith(regionPrefix));
}

/**
 * Pure statute-of-limitations calc (no vscode). Unknown jurisdictions default to 90 days.
 */
export function calculateStatuteDeadline(injuryDate: Date, jurisdictionId: string): Date {
	const jurisdiction = getJurisdictionById(jurisdictionId);
	const days = jurisdiction?.statuteOfLimitationsDays ?? 90;
	const deadline = new Date(injuryDate);
	deadline.setDate(deadline.getDate() + days);
	return deadline;
}
