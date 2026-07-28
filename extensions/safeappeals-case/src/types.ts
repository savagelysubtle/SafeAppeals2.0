/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The user's global profile, stored in `safeappeals.profile.*` settings
 * (application scope) and injected into each case brief.
 */
export interface UserProfile {
	name: string;
	organization: string;
	role: string;
	practiceArea: string;
	jurisdiction: string;
}

/**
 * Structured case info persisted at `.safeAppeals/case.json` — the machine
 * readable twin of the AGENTS.md case brief. Consumed by timeline (statute
 * deadlines), file organizer (classification) and email (case linking).
 */
export interface CaseInfo {
	version: 1;
	caseName: string;
	claimNumber: string;
	caseType: string;
	jurisdiction: string;
	/** YYYY-MM-DD, empty when unknown */
	injuryDate: string;
	status: string;
	client: {
		name: string;
		contact: string;
	};
	opposing: {
		party: string;
		representative: string;
	};
	createdAt: string;
	updatedAt: string;
}

export const CASE_STATUSES = ['active', 'appeal filed', 'awaiting decision', 'closed'] as const;

/**
 * Jurisdictions carried over from the old timeline feature; slice 2 reuses
 * these for statute-of-limitations deadline calculation.
 */
export const JURISDICTIONS = [
	'BC WCB',
	'Ontario WSIB',
	'Alberta WCB',
	'Quebec CNESST',
	'Manitoba WCB',
	'Saskatchewan WCB',
	'Nova Scotia WCB',
	'California DWC',
	'Texas DWC',
	'New York WCB',
	'Florida DWC',
	'Washington L&I',
] as const;
