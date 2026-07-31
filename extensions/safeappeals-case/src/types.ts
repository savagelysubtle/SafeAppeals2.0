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
	/** Field of study / subject / research field / work focus / tech stack. */
	focusArea: string;
	/** Preferred citation style (education / research), e.g. APA, McGill Guide. */
	citationStyle: string;
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
	// Verified against official sources July 2026. Deliberately omitted superseded
	// names Q-COMP, the AAT (now ART), and Victoria Accident Compensation
	// Conciliation Service (now WIC); Scotland Employment Injury Assistance is
	// absent because it has not commenced.
	'UK DWP IIDB',
	'UK FTT SSCS',
	'NI DfC IIDB',
	'NI Appeal Tribunal',
	'IE DSP OIB',
	'IE SWAO',
	'NSW icare',
	'NSW PIC',
	'VIC WorkSafe',
	'VIC WIC',
	'QLD WorkCover',
	'QLD WC Regulator',
	'QLD QIRC',
	'WA WorkCover',
	'WA WC Arbitration',
	'SA ReturnToWorkSA',
	'SA SAET',
	'TAS WorkSafe',
	'TASCAT Workers',
	'ACT WorkSafe',
	'ACT WC Arbitration',
	'NT WorkSafe',
	'NT Work Health Ct',
	'AU Comcare',
	'AU ART',
	'NZ ACC',
	'NZ ACC Appeals',
	'ZA Comp Fund',
	'ZA COIDA Tribunal',
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

/** Australian states and territories for profile location picks. */
export const AUSTRALIA_STATES = [
	'Australian Capital Territory',
	'New South Wales',
	'Northern Territory',
	'Queensland',
	'South Australia',
	'Tasmania',
	'Victoria',
	'Western Australia',
] as const;

/** UK nations for profile location picks. */
export const UK_NATIONS = [
	'England',
	'Northern Ireland',
	'Scotland',
	'Wales',
] as const;

/**
 * Subdivision list for countries that use a state/province/nation picker.
 * National schemes (Ireland, New Zealand, South Africa) return undefined so
 * callers fall through to free-text State / Province.
 */
export function subdivisionsForCountry(country: string): readonly string[] | undefined {
	if (country === 'Canada') {
		return CANADA_PROVINCES;
	}
	if (country === 'United States') {
		return US_STATES;
	}
	if (country === 'Australia') {
		return AUSTRALIA_STATES;
	}
	if (country === 'United Kingdom') {
		return UK_NATIONS;
	}
	return undefined;
}

/**
 * Maps a state/province/nation name to known compensation boards from
 * {@link JURISDICTIONS}. Subdivisions without an entry fall through to
 * {@link BOARDS_BY_COUNTRY} via {@link boardsFor}.
 *
 * 'AU Comcare' / 'AU ART' repeat in every Australian entry on purpose: Comcare
 * is the Commonwealth scheme covering federal employees in every state, and the
 * flat repetition is preferred over a second indirection layer.
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
	'England': ['UK DWP IIDB', 'UK FTT SSCS'],
	'Scotland': ['UK DWP IIDB', 'UK FTT SSCS'],
	'Wales': ['UK DWP IIDB', 'UK FTT SSCS'],
	'Northern Ireland': ['NI DfC IIDB', 'NI Appeal Tribunal'],
	'New South Wales': ['NSW icare', 'NSW PIC', 'AU Comcare', 'AU ART'],
	'Victoria': ['VIC WorkSafe', 'VIC WIC', 'AU Comcare', 'AU ART'],
	'Queensland': ['QLD WorkCover', 'QLD WC Regulator', 'QLD QIRC', 'AU Comcare', 'AU ART'],
	'Western Australia': ['WA WorkCover', 'WA WC Arbitration', 'AU Comcare', 'AU ART'],
	'South Australia': ['SA ReturnToWorkSA', 'SA SAET', 'AU Comcare', 'AU ART'],
	'Tasmania': ['TAS WorkSafe', 'TASCAT Workers', 'AU Comcare', 'AU ART'],
	'Australian Capital Territory': ['ACT WorkSafe', 'ACT WC Arbitration', 'AU Comcare', 'AU ART'],
	'Northern Territory': ['NT WorkSafe', 'NT Work Health Ct', 'AU Comcare', 'AU ART'],
};

/**
 * Boards offered when a country is chosen but no subdivision has been picked
 * (or the subdivision has no entry in {@link BOARDS_BY_STATE_PROVINCE}).
 */
export const BOARDS_BY_COUNTRY: Readonly<Record<string, readonly string[]>> = {
	'Canada': [
		'BC WCB',
		'Ontario WSIB',
		'Alberta WCB',
		'Quebec CNESST',
		'Manitoba WCB',
		'Saskatchewan WCB',
		'Nova Scotia WCB',
	],
	'United States': [
		'California DWC',
		'Texas DWC',
		'New York WCB',
		'Florida DWC',
		'Washington L&I',
	],
	'United Kingdom': [
		'UK DWP IIDB',
		'UK FTT SSCS',
		'NI DfC IIDB',
		'NI Appeal Tribunal',
	],
	'Ireland': [
		'IE DSP OIB',
		'IE SWAO',
	],
	'Australia': [
		'NSW icare',
		'NSW PIC',
		'VIC WorkSafe',
		'VIC WIC',
		'QLD WorkCover',
		'QLD WC Regulator',
		'QLD QIRC',
		'WA WorkCover',
		'WA WC Arbitration',
		'SA ReturnToWorkSA',
		'SA SAET',
		'TAS WorkSafe',
		'TASCAT Workers',
		'ACT WorkSafe',
		'ACT WC Arbitration',
		'NT WorkSafe',
		'NT Work Health Ct',
		'AU Comcare',
		'AU ART',
	],
	'New Zealand': [
		'NZ ACC',
		'NZ ACC Appeals',
	],
	'South Africa': [
		'ZA Comp Fund',
		'ZA COIDA Tribunal',
	],
};

/**
 * Resolves compensation boards for a country and optional subdivision.
 *
 * Order: subdivision map → country map → all {@link JURISDICTIONS} when
 * country is empty → empty list for Other / unrecognised countries.
 */
export function boardsFor(country: string, stateProvince: string): readonly string[] {
	if (stateProvince) {
		const bySubdivision = BOARDS_BY_STATE_PROVINCE[stateProvince];
		if (bySubdivision && bySubdivision.length > 0) {
			return bySubdivision;
		}
	}
	if (country) {
		const byCountry = BOARDS_BY_COUNTRY[country];
		if (byCountry && byCountry.length > 0) {
			return byCountry;
		}
		return [];
	}
	return JURISDICTIONS;
}
