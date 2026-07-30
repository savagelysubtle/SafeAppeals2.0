/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The user's global profile, stored in `safeappeals.profile.*` settings
 * (machine scope) and injected into each case brief.
 */
export interface UserProfile {
	name: string;
	organization: string;
	role: string;
	practiceArea: string;
	country: string;
	stateProvince: string;
	city: string;
	/** Compensation board / tribunal (not the province). */
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
 *
 * `UserProfile.jurisdiction` / case `jurisdiction` store a board from this
 * list (or a custom value) — never a province or state name alone.
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

/** Canadian provinces and territories for profile location picks. */
export const CANADA_PROVINCES = [
	'Alberta',
	'British Columbia',
	'Manitoba',
	'New Brunswick',
	'Newfoundland and Labrador',
	'Northwest Territories',
	'Nova Scotia',
	'Nunavut',
	'Ontario',
	'Prince Edward Island',
	'Quebec',
	'Saskatchewan',
	'Yukon',
] as const;

/** US states and District of Columbia for profile location picks. */
export const US_STATES = [
	'Alabama',
	'Alaska',
	'Arizona',
	'Arkansas',
	'California',
	'Colorado',
	'Connecticut',
	'Delaware',
	'District of Columbia',
	'Florida',
	'Georgia',
	'Hawaii',
	'Idaho',
	'Illinois',
	'Indiana',
	'Iowa',
	'Kansas',
	'Kentucky',
	'Louisiana',
	'Maine',
	'Maryland',
	'Massachusetts',
	'Michigan',
	'Minnesota',
	'Mississippi',
	'Missouri',
	'Montana',
	'Nebraska',
	'Nevada',
	'New Hampshire',
	'New Jersey',
	'New Mexico',
	'New York',
	'North Carolina',
	'North Dakota',
	'Ohio',
	'Oklahoma',
	'Oregon',
	'Pennsylvania',
	'Rhode Island',
	'South Carolina',
	'South Dakota',
	'Tennessee',
	'Texas',
	'Utah',
	'Vermont',
	'Virginia',
	'Washington',
	'West Virginia',
	'Wisconsin',
	'Wyoming',
] as const;

/**
 * Maps a state/province name to known compensation boards from {@link JURISDICTIONS}.
 * Provinces/states without an entry yield no filter (callers should show the full list).
 */
export const BOARDS_BY_STATE_PROVINCE: Readonly<Record<string, readonly string[]>> = {
	'British Columbia': ['BC WCB'],
	'Ontario': ['Ontario WSIB'],
	'Alberta': ['Alberta WCB'],
	'Quebec': ['Quebec CNESST'],
	'Manitoba': ['Manitoba WCB'],
	'Saskatchewan': ['Saskatchewan WCB'],
	'Nova Scotia': ['Nova Scotia WCB'],
	'California': ['California DWC'],
	'Texas': ['Texas DWC'],
	'New York': ['New York WCB'],
	'Florida': ['Florida DWC'],
	'Washington': ['Washington L&I'],
};

/**
 * Returns boards for a state/province. When none match, returns the full
 * {@link JURISDICTIONS} list so the picker is never empty.
 */
export function boardsForStateProvince(stateProvince: string): readonly string[] {
	const matched = stateProvince ? BOARDS_BY_STATE_PROVINCE[stateProvince] : undefined;
	if (matched && matched.length > 0) {
		return matched;
	}
	return JURISDICTIONS;
}
