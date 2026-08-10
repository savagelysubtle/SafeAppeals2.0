/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * The user's global profile, stored in `safeappeals.profile.*` settings
 * (machine scope) and mirrored into the global Copilot instructions rule.
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
	/**
	 * Compensation board / tribunal slug (canonical id, e.g. `bc-wcb`) or a
	 * custom free-text value — never a province or state name alone.
	 */
	jurisdiction: string;
	/** Operating system for platform-appropriate commands and file paths. */
	operatingSystem: string;
}

/**
 * Canonical jurisdiction IDs (void-reference slugs). Timeline statute calc and
 * profile storage use these ids; {@link JURISDICTION_LABELS} supplies UI copy.
 *
 * Verified against official sources July 2026. Deliberately omitted superseded
 * names Q-COMP, the AAT (now ART), and Victoria Accident Compensation
 * Conciliation Service (now WIC); Scotland Employment Injury Assistance is
 * absent because it has not commenced.
 */
export const JURISDICTIONS = [
	'bc-wcb',
	'ontario-wsib',
	'alberta-wcb',
	'quebec-cnesst',
	'manitoba-wcb',
	'saskatchewan-wcb',
	'nova-scotia-wcb',
	'california-dwc',
	'texas-dwc',
	'new-york-wcb',
	'florida-dwc',
	'washington-lni',
	'uk-dwp-iidb',
	'uk-ftt-sscs',
	'ni-dfc-iidb',
	'ni-appeal-tribunal',
	'ie-dsp-oib',
	'ie-swao',
	'nsw-icare',
	'nsw-pic',
	'vic-worksafe',
	'vic-wic',
	'qld-workcover',
	'qld-wc-regulator',
	'qld-qirc',
	'wa-workcover',
	'wa-wc-arbitration',
	'sa-returntoworksa',
	'sa-saet',
	'tas-worksafe',
	'tascat-workers',
	'act-worksafe',
	'act-wc-arbitration',
	'nt-worksafe',
	'nt-work-health-ct',
	'au-comcare',
	'au-art',
	'nz-acc',
	'nz-acc-appeals',
	'za-comp-fund',
	'za-coida-tribunal',
] as const;

export type JurisdictionId = typeof JURISDICTIONS[number];

/** Display labels for {@link JURISDICTIONS} (UI / profile rule prose). */
export const JURISDICTION_LABELS: Readonly<Record<JurisdictionId, string>> = {
	'bc-wcb': 'BC WCB',
	'ontario-wsib': 'Ontario WSIB',
	'alberta-wcb': 'Alberta WCB',
	'quebec-cnesst': 'Quebec CNESST',
	'manitoba-wcb': 'Manitoba WCB',
	'saskatchewan-wcb': 'Saskatchewan WCB',
	'nova-scotia-wcb': 'Nova Scotia WCB',
	'california-dwc': 'California DWC',
	'texas-dwc': 'Texas DWC',
	'new-york-wcb': 'New York WCB',
	'florida-dwc': 'Florida DWC',
	'washington-lni': 'Washington L&I',
	'uk-dwp-iidb': 'UK DWP IIDB',
	'uk-ftt-sscs': 'UK FTT SSCS',
	'ni-dfc-iidb': 'NI DfC IIDB',
	'ni-appeal-tribunal': 'NI Appeal Tribunal',
	'ie-dsp-oib': 'IE DSP OIB',
	'ie-swao': 'IE SWAO',
	'nsw-icare': 'NSW icare',
	'nsw-pic': 'NSW PIC',
	'vic-worksafe': 'VIC WorkSafe',
	'vic-wic': 'VIC WIC',
	'qld-workcover': 'QLD WorkCover',
	'qld-wc-regulator': 'QLD WC Regulator',
	'qld-qirc': 'QLD QIRC',
	'wa-workcover': 'WA WorkCover',
	'wa-wc-arbitration': 'WA WC Arbitration',
	'sa-returntoworksa': 'SA ReturnToWorkSA',
	'sa-saet': 'SA SAET',
	'tas-worksafe': 'TAS WorkSafe',
	'tascat-workers': 'TASCAT Workers',
	'act-worksafe': 'ACT WorkSafe',
	'act-wc-arbitration': 'ACT WC Arbitration',
	'nt-worksafe': 'NT WorkSafe',
	'nt-work-health-ct': 'NT Work Health Ct',
	'au-comcare': 'AU Comcare',
	'au-art': 'AU ART',
	'nz-acc': 'NZ ACC',
	'nz-acc-appeals': 'NZ ACC Appeals',
	'za-comp-fund': 'ZA Comp Fund',
	'za-coida-tribunal': 'ZA COIDA Tribunal',
};

/**
 * Maps legacy display-name profile values (and void-style long names) to
 * canonical slugs. Custom free-text boards are returned unchanged.
 */
export const JURISDICTION_DISPLAY_ALIASES: Readonly<Record<string, JurisdictionId>> = {
	'BC WCB': 'bc-wcb',
	'British Columbia WCB': 'bc-wcb',
	'British Columbia WorkSafeBC': 'bc-wcb',
	'WorkSafeBC': 'bc-wcb',
	'Ontario WSIB': 'ontario-wsib',
	'Alberta WCB': 'alberta-wcb',
	'Quebec CNESST': 'quebec-cnesst',
	'Manitoba WCB': 'manitoba-wcb',
	'Saskatchewan WCB': 'saskatchewan-wcb',
	'Nova Scotia WCB': 'nova-scotia-wcb',
	'California DWC': 'california-dwc',
	'Texas DWC': 'texas-dwc',
	'New York WCB': 'new-york-wcb',
	'Florida DWC': 'florida-dwc',
	'Washington L&I': 'washington-lni',
	'Washington LNI': 'washington-lni',
	'UK DWP IIDB': 'uk-dwp-iidb',
	'UK FTT SSCS': 'uk-ftt-sscs',
	'NI DfC IIDB': 'ni-dfc-iidb',
	'NI Appeal Tribunal': 'ni-appeal-tribunal',
	'IE DSP OIB': 'ie-dsp-oib',
	'IE SWAO': 'ie-swao',
	'NSW icare': 'nsw-icare',
	'NSW PIC': 'nsw-pic',
	'VIC WorkSafe': 'vic-worksafe',
	'VIC WIC': 'vic-wic',
	'QLD WorkCover': 'qld-workcover',
	'QLD WC Regulator': 'qld-wc-regulator',
	'QLD QIRC': 'qld-qirc',
	'WA WorkCover': 'wa-workcover',
	'WA WC Arbitration': 'wa-wc-arbitration',
	'SA ReturnToWorkSA': 'sa-returntoworksa',
	'SA SAET': 'sa-saet',
	'TAS WorkSafe': 'tas-worksafe',
	'TASCAT Workers': 'tascat-workers',
	'ACT WorkSafe': 'act-worksafe',
	'ACT WC Arbitration': 'act-wc-arbitration',
	'NT WorkSafe': 'nt-worksafe',
	'NT Work Health Ct': 'nt-work-health-ct',
	'AU Comcare': 'au-comcare',
	'AU ART': 'au-art',
	'NZ ACC': 'nz-acc',
	'NZ ACC Appeals': 'nz-acc-appeals',
	'ZA Comp Fund': 'za-comp-fund',
	'ZA COIDA Tribunal': 'za-coida-tribunal',
};

const JURISDICTION_ID_SET: ReadonlySet<string> = new Set<string>(JURISDICTIONS);

const LABEL_TO_ID: ReadonlyMap<string, JurisdictionId> = (() => {
	const map = new Map<string, JurisdictionId>();
	for (const id of JURISDICTIONS) {
		map.set(JURISDICTION_LABELS[id], id);
	}
	return map;
})();

/**
 * Normalizes a stored or UI jurisdiction value to a canonical slug when known.
 * Unknown / custom values are trimmed and returned as-is.
 */
export function normalizeJurisdictionId(value: string | undefined | null): string {
	const trimmed = value?.trim() ?? '';
	if (!trimmed) {
		return '';
	}
	if (JURISDICTION_ID_SET.has(trimmed)) {
		return trimmed;
	}
	const fromAlias = JURISDICTION_DISPLAY_ALIASES[trimmed];
	if (fromAlias) {
		return fromAlias;
	}
	const fromLabel = LABEL_TO_ID.get(trimmed);
	if (fromLabel) {
		return fromLabel;
	}
	return trimmed;
}

/** Display label for a slug, or the raw value for custom boards. */
export function jurisdictionLabel(value: string | undefined | null): string {
	const normalized = normalizeJurisdictionId(value);
	if (!normalized) {
		return '';
	}
	if (JURISDICTION_ID_SET.has(normalized)) {
		return JURISDICTION_LABELS[normalized as JurisdictionId];
	}
	return normalized;
}

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
 * 'au-comcare' / 'au-art' repeat in every Australian entry on purpose: Comcare
 * is the Commonwealth scheme covering federal employees in every state, and the
 * flat repetition is preferred over a second indirection layer.
 */
export const BOARDS_BY_STATE_PROVINCE: Readonly<Record<string, readonly string[]>> = {
	'British Columbia': ['bc-wcb'],
	'Ontario': ['ontario-wsib'],
	'Alberta': ['alberta-wcb'],
	'Quebec': ['quebec-cnesst'],
	'Manitoba': ['manitoba-wcb'],
	'Saskatchewan': ['saskatchewan-wcb'],
	'Nova Scotia': ['nova-scotia-wcb'],
	'California': ['california-dwc'],
	'Texas': ['texas-dwc'],
	'New York': ['new-york-wcb'],
	'Florida': ['florida-dwc'],
	'Washington': ['washington-lni'],
	'England': ['uk-dwp-iidb', 'uk-ftt-sscs'],
	'Scotland': ['uk-dwp-iidb', 'uk-ftt-sscs'],
	'Wales': ['uk-dwp-iidb', 'uk-ftt-sscs'],
	'Northern Ireland': ['ni-dfc-iidb', 'ni-appeal-tribunal'],
	'New South Wales': ['nsw-icare', 'nsw-pic', 'au-comcare', 'au-art'],
	'Victoria': ['vic-worksafe', 'vic-wic', 'au-comcare', 'au-art'],
	'Queensland': ['qld-workcover', 'qld-wc-regulator', 'qld-qirc', 'au-comcare', 'au-art'],
	'Western Australia': ['wa-workcover', 'wa-wc-arbitration', 'au-comcare', 'au-art'],
	'South Australia': ['sa-returntoworksa', 'sa-saet', 'au-comcare', 'au-art'],
	'Tasmania': ['tas-worksafe', 'tascat-workers', 'au-comcare', 'au-art'],
	'Australian Capital Territory': ['act-worksafe', 'act-wc-arbitration', 'au-comcare', 'au-art'],
	'Northern Territory': ['nt-worksafe', 'nt-work-health-ct', 'au-comcare', 'au-art'],
};

/**
 * Boards offered when a country is chosen but no subdivision has been picked
 * (or the subdivision has no entry in {@link BOARDS_BY_STATE_PROVINCE}).
 */
export const BOARDS_BY_COUNTRY: Readonly<Record<string, readonly string[]>> = {
	'Canada': [
		'bc-wcb',
		'ontario-wsib',
		'alberta-wcb',
		'quebec-cnesst',
		'manitoba-wcb',
		'saskatchewan-wcb',
		'nova-scotia-wcb',
	],
	'United States': [
		'california-dwc',
		'texas-dwc',
		'new-york-wcb',
		'florida-dwc',
		'washington-lni',
	],
	'United Kingdom': [
		'uk-dwp-iidb',
		'uk-ftt-sscs',
		'ni-dfc-iidb',
		'ni-appeal-tribunal',
	],
	'Ireland': [
		'ie-dsp-oib',
		'ie-swao',
	],
	'Australia': [
		'nsw-icare',
		'nsw-pic',
		'vic-worksafe',
		'vic-wic',
		'qld-workcover',
		'qld-wc-regulator',
		'qld-qirc',
		'wa-workcover',
		'wa-wc-arbitration',
		'sa-returntoworksa',
		'sa-saet',
		'tas-worksafe',
		'tascat-workers',
		'act-worksafe',
		'act-wc-arbitration',
		'nt-worksafe',
		'nt-work-health-ct',
		'au-comcare',
		'au-art',
	],
	'New Zealand': [
		'nz-acc',
		'nz-acc-appeals',
	],
	'South Africa': [
		'za-comp-fund',
		'za-coida-tribunal',
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
