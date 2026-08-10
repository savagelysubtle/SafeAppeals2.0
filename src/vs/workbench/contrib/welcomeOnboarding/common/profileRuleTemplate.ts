/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Shared Safe Appeals profile-rule template (pure, import-free).
 *
 * IMPORTANT: `extensions/safeappeals-timeline/src/profileRuleTemplate.ts` and
 * `src/vs/workbench/contrib/welcomeOnboarding/common/profileRuleTemplate.ts`
 * MUST stay byte-identical. The drift test
 * `extensions/safeappeals-timeline/src/test/profileRuleDrift.test.ts` enforces
 * whole-file equality. Edit one copy and paste the other — do not diverge.
 */

/** Fields accepted when rendering the user-level profile instructions file. */
export interface ProfileRuleInput {
	name?: string;
	organization?: string;
	role?: string;
	practiceArea?: string;
	focusArea?: string;
	citationStyle?: string;
	country?: string;
	stateProvince?: string;
	city?: string;
	jurisdiction?: string;
	operatingSystem?: string;
}

/** Canonical role strings persisted to `safeappeals.profile.role` (ordered). */
export const PROFILE_ROLES = [
	'Lawyer',
	'Paralegal',
	'Advocate',
	'Appeals Representative',
	'Union Representative',
	'Injured Worker',
	'Representing Myself',
	'Student',
	'Teacher',
	'Researcher',
	'Office Worker',
	'Software Developer',
] as const;

export type ProfileRole = typeof PROFILE_ROLES[number];

/** Persona groups that drive visible fields, fact labels, and voice stubs. */
export type ProfilePersonaGroup =
	| 'legal'
	| 'self'
	| 'education'
	| 'research'
	| 'office'
	| 'developer';

/** Resolved group including the legacy/unknown bucket. */
export type ProfilePersonaGroupOrUnknown = ProfilePersonaGroup | 'unknown';

/** Keys on {@link ProfileRuleInput} that UI / writers may surface. */
export type ProfileFieldKey =
	| 'name'
	| 'organization'
	| 'role'
	| 'practiceArea'
	| 'focusArea'
	| 'citationStyle'
	| 'country'
	| 'stateProvince'
	| 'city'
	| 'jurisdiction'
	| 'operatingSystem';

/** One fact-bullet label used in the rendered rule when the value is non-empty. */
export interface ProfileFactBulletLabel {
	readonly key: ProfileFieldKey;
	readonly label: string;
}

/** Role → persona group (canonical roles only). */
export const ROLE_TO_GROUP: Readonly<Record<ProfileRole, ProfilePersonaGroup>> = {
	'Lawyer': 'legal',
	'Paralegal': 'legal',
	'Advocate': 'legal',
	'Appeals Representative': 'legal',
	'Union Representative': 'legal',
	'Injured Worker': 'self',
	'Representing Myself': 'self',
	'Student': 'education',
	'Teacher': 'education',
	'Researcher': 'research',
	'Office Worker': 'office',
	'Software Developer': 'developer',
};

/**
 * Visible profile field keys by persona group (for onboarding / setup UI).
 * Unknown / empty role keeps the legacy legal field set.
 */
export const VISIBLE_FIELDS_BY_GROUP: Readonly<Record<ProfilePersonaGroupOrUnknown, readonly ProfileFieldKey[]>> = {
	legal: ['name', 'organization', 'role', 'practiceArea', 'country', 'stateProvince', 'city', 'jurisdiction', 'operatingSystem'],
	self: ['name', 'role', 'country', 'stateProvince', 'city', 'jurisdiction', 'operatingSystem'],
	education: ['name', 'organization', 'role', 'focusArea', 'citationStyle', 'country', 'stateProvince', 'operatingSystem'],
	research: ['name', 'organization', 'role', 'focusArea', 'citationStyle', 'country', 'stateProvince', 'operatingSystem'],
	office: ['name', 'organization', 'role', 'focusArea', 'operatingSystem'],
	developer: ['name', 'organization', 'role', 'focusArea', 'operatingSystem'],
	unknown: ['name', 'organization', 'role', 'practiceArea', 'country', 'stateProvince', 'city', 'jurisdiction', 'operatingSystem'],
};

/** Organization field label hints for consumers (by group). */
export const ORGANIZATION_LABEL_BY_GROUP: Readonly<Record<ProfilePersonaGroup, string>> = {
	legal: 'Firm / organization',
	self: 'Firm / organization',
	education: 'School / institution',
	research: 'Institution / affiliation',
	office: 'Company / organization',
	developer: 'Company / team',
};

/**
 * Focus-area field label hints for consumers (by role where the field applies).
 * Legal / self roles do not collect `focusArea`.
 */
export const FOCUS_AREA_LABEL_BY_ROLE: Readonly<Partial<Record<ProfileRole, string>>> = {
	'Student': 'Field of study',
	'Teacher': 'Subject / level',
	'Researcher': 'Research field',
	'Office Worker': 'Works on',
	'Software Developer': 'Languages / stack',
};

/** Citation-style field label (education / research). */
export const CITATION_STYLE_LABEL = 'Citation style';

/**
 * Shared Research & citations section (verbatim in every rendered profile rule).
 * Never claims the agent verified a citation.
 */
export const PROFILE_CITATIONS_SECTION = [
	'## Research & citations — all work, legal or business',
	'',
	'- End every research answer with a **Sources** section: one markdown link per source, each on its own line.',
	'- Cite with a pinpoint, not just a link: section, paragraph, or page (e.g. "s. 5(1)", "para. 32", "p. 14"). Never cite a bare homepage.',
	'- Prefer primary and official sources (legislation, tribunal decisions, board policy manuals, government sites, vendor documentation) over blogs and summaries.',
	'- Never invent a citation, quote, case name, figure, or deadline. If you cannot find a source, say so plainly instead of guessing.',
	'- Mark any citation you did not open and read in this session as **[unverified]**, and tell the user to confirm it against the original before relying on it.',
	'- Treat deadlines and limitation periods as unverified until the user confirms them against the board or tribunal\'s official source.',
	'- Quote exactly and sparingly; paraphrase everything else and attribute it.',
	'- When a source can change over time (rates, policies, forms, deadlines), note the date you accessed it.',
	'- Match the citation style already used in the user\'s documents; do not impose one.',
].join('\n');

const LEGAL_VOICE_STUB =
	'Write for a legal professional: formal register, jurisdiction-correct citation format with pinpoint paragraphs, and assume the user will verify every authority on a primary database before filing.';

const SELF_VOICE_STUB =
	'Write in plain language and define legal terms on first use. When research turns up a statute, policy, decision, or ground that appears to favor the user, propose it as a candidate argument with sources and pinpoints, and explain why it may help — then require the user to verify it against primary materials before relying on it. This is a research and drafting aid, not a substitute for the user\'s judgment or a lawyer.';

const STUDENT_VOICE_STUB =
	'Explain the reasoning, not just the answer, and cite so every claim can be traced to its source; flag the primary materials the user should read themselves.';

const TEACHER_VOICE_STUB =
	'Explain concepts at the level of the class being taught, and cite source materials with page or section pinpoints so they can go straight into handouts and slides. Support drafting lessons, assignments, rubrics, and exemplars — but when asked to complete a student\'s assessed work, produce marking guidance and worked examples instead of a finished submission.';

const RESEARCHER_VOICE_STUB =
	'Cite academically (author, year, pinpoint) and prefer peer-reviewed or primary sources; keep findings clearly separate from your own synthesis.';

const OFFICE_VOICE_STUB =
	'Keep drafts concise and action-oriented; cite internal documents by title and section, external claims by link, and flag every figure — rates, dates, amounts — as needing confirmation before it leaves the building.';

const DEVELOPER_VOICE_STUB =
	'Link the exact documentation page and version, prefer official docs and changelogs over tutorials, and verify library claims against what\'s actually installed in the project.';

/**
 * Voice stubs keyed by canonical role. Empty / unknown roles have no stub
 * (the "## Working with this user" section is omitted entirely).
 */
export const VOICE_STUB_BY_ROLE: Readonly<Record<ProfileRole, string>> = {
	'Lawyer': LEGAL_VOICE_STUB,
	'Paralegal': LEGAL_VOICE_STUB,
	'Advocate': LEGAL_VOICE_STUB,
	'Appeals Representative': LEGAL_VOICE_STUB,
	'Union Representative': LEGAL_VOICE_STUB,
	'Injured Worker': SELF_VOICE_STUB,
	'Representing Myself': SELF_VOICE_STUB,
	'Student': STUDENT_VOICE_STUB,
	'Teacher': TEACHER_VOICE_STUB,
	'Researcher': RESEARCHER_VOICE_STUB,
	'Office Worker': OFFICE_VOICE_STUB,
	'Software Developer': DEVELOPER_VOICE_STUB,
};

const LEGAL_OR_UNKNOWN_FACT_LABELS: readonly ProfileFactBulletLabel[] = [
	{ key: 'name', label: 'Name' },
	{ key: 'organization', label: 'Firm / organization' },
	{ key: 'role', label: 'Role' },
	{ key: 'practiceArea', label: 'Practice area' },
	{ key: 'country', label: 'Country' },
	{ key: 'stateProvince', label: 'State / province' },
	{ key: 'city', label: 'City' },
	{ key: 'jurisdiction', label: 'Compensation board / tribunal' },
	{ key: 'operatingSystem', label: 'Operating System' },
];

const SELF_FACT_LABELS: readonly ProfileFactBulletLabel[] = [
	{ key: 'name', label: 'Name' },
	{ key: 'role', label: 'Role' },
	{ key: 'country', label: 'Country' },
	{ key: 'stateProvince', label: 'State / province' },
	{ key: 'city', label: 'City' },
	{ key: 'jurisdiction', label: 'Compensation board / tribunal' },
	{ key: 'operatingSystem', label: 'Operating System' },
];

const STUDENT_FACT_LABELS: readonly ProfileFactBulletLabel[] = [
	{ key: 'name', label: 'Name' },
	{ key: 'organization', label: 'School / institution' },
	{ key: 'role', label: 'Role' },
	{ key: 'focusArea', label: 'Field of study' },
	{ key: 'citationStyle', label: 'Citation style' },
	{ key: 'country', label: 'Country' },
	{ key: 'stateProvince', label: 'State / province' },
	{ key: 'operatingSystem', label: 'Operating System' },
];

const TEACHER_FACT_LABELS: readonly ProfileFactBulletLabel[] = [
	{ key: 'name', label: 'Name' },
	{ key: 'organization', label: 'School / institution' },
	{ key: 'role', label: 'Role' },
	{ key: 'focusArea', label: 'Subject / level' },
	{ key: 'citationStyle', label: 'Citation style' },
	{ key: 'country', label: 'Country' },
	{ key: 'stateProvince', label: 'State / province' },
	{ key: 'operatingSystem', label: 'Operating System' },
];

const RESEARCH_FACT_LABELS: readonly ProfileFactBulletLabel[] = [
	{ key: 'name', label: 'Name' },
	{ key: 'organization', label: 'Institution / affiliation' },
	{ key: 'role', label: 'Role' },
	{ key: 'focusArea', label: 'Research field' },
	{ key: 'citationStyle', label: 'Citation style' },
	{ key: 'country', label: 'Country' },
	{ key: 'stateProvince', label: 'State / province' },
	{ key: 'operatingSystem', label: 'Operating System' },
];

const OFFICE_FACT_LABELS: readonly ProfileFactBulletLabel[] = [
	{ key: 'name', label: 'Name' },
	{ key: 'organization', label: 'Company / organization' },
	{ key: 'role', label: 'Role' },
	{ key: 'focusArea', label: 'Works on' },
	{ key: 'operatingSystem', label: 'Operating System' },
];

const DEVELOPER_FACT_LABELS: readonly ProfileFactBulletLabel[] = [
	{ key: 'name', label: 'Name' },
	{ key: 'organization', label: 'Company / team' },
	{ key: 'role', label: 'Role' },
	{ key: 'focusArea', label: 'Languages / stack' },
	{ key: 'operatingSystem', label: 'Operating System' },
];

/**
 * Per-group fact-bullet labels for the rule (English). Education is split by
 * role because Student and Teacher use different focus-area labels.
 */
export const FACT_BULLET_LABELS_BY_GROUP: Readonly<{
	legal: readonly ProfileFactBulletLabel[];
	self: readonly ProfileFactBulletLabel[];
	educationStudent: readonly ProfileFactBulletLabel[];
	educationTeacher: readonly ProfileFactBulletLabel[];
	research: readonly ProfileFactBulletLabel[];
	office: readonly ProfileFactBulletLabel[];
	developer: readonly ProfileFactBulletLabel[];
	unknown: readonly ProfileFactBulletLabel[];
}> = {
	legal: LEGAL_OR_UNKNOWN_FACT_LABELS,
	self: SELF_FACT_LABELS,
	educationStudent: STUDENT_FACT_LABELS,
	educationTeacher: TEACHER_FACT_LABELS,
	research: RESEARCH_FACT_LABELS,
	office: OFFICE_FACT_LABELS,
	developer: DEVELOPER_FACT_LABELS,
	unknown: LEGAL_OR_UNKNOWN_FACT_LABELS,
};

const LEGAL_PERSPECTIVE = [
	'When drafting documents, correspondence, or appeals, write from this',
	'person\'s perspective and jurisdiction unless the case brief (AGENTS.md',
	'in the case folder) says otherwise. Case-specific facts always take',
	'precedence over this profile.',
].join('\n');

const WORK_PERSPECTIVE =
	'Frame answers and drafts for this person\'s work and background unless the current workspace or task says otherwise.';

const PROFILE_ROLES_SET: ReadonlySet<string> = new Set<string>(PROFILE_ROLES);

/**
 * Resolves the persona group for a persisted role string.
 * Empty / unrecognized roles map to `unknown` (legacy legal field set, no voice).
 */
export function getPersonaGroup(role: string | undefined): ProfilePersonaGroupOrUnknown {
	const trimmedRole = trimValue(role);
	if (!trimmedRole || !PROFILE_ROLES_SET.has(trimmedRole)) {
		return 'unknown';
	}
	return ROLE_TO_GROUP[trimmedRole as ProfileRole];
}

/**
 * Fact-bullet labels for the given role (group-specific; education differs by role).
 */
export function factBulletLabelsFor(role: string | undefined): readonly ProfileFactBulletLabel[] {
	const trimmedRole = trimValue(role);
	const group = getPersonaGroup(trimmedRole);
	switch (group) {
		case 'legal':
			return FACT_BULLET_LABELS_BY_GROUP.legal;
		case 'self':
			return FACT_BULLET_LABELS_BY_GROUP.self;
		case 'education':
			return trimmedRole === 'Teacher'
				? FACT_BULLET_LABELS_BY_GROUP.educationTeacher
				: FACT_BULLET_LABELS_BY_GROUP.educationStudent;
		case 'research':
			return FACT_BULLET_LABELS_BY_GROUP.research;
		case 'office':
			return FACT_BULLET_LABELS_BY_GROUP.office;
		case 'developer':
			return FACT_BULLET_LABELS_BY_GROUP.developer;
		case 'unknown':
			return FACT_BULLET_LABELS_BY_GROUP.unknown;
	}
}

/**
 * Voice stub for a canonical role, or `undefined` when the working-with section
 * must be omitted (empty / unknown role).
 */
export function voiceStubFor(role: string | undefined): string | undefined {
	const trimmedRole = trimValue(role);
	if (!trimmedRole || !PROFILE_ROLES_SET.has(trimmedRole)) {
		return undefined;
	}
	return VOICE_STUB_BY_ROLE[trimmedRole as ProfileRole];
}

/**
 * Perspective paragraph for the given role's persona group.
 */
export function perspectiveFor(role: string | undefined): string {
	const group = getPersonaGroup(role);
	switch (group) {
		case 'education':
		case 'research':
		case 'office':
		case 'developer':
			return WORK_PERSPECTIVE;
		case 'legal':
		case 'self':
		case 'unknown':
			return LEGAL_PERSPECTIVE;
	}
}

/**
 * Builds the full `safeappeals-profile.instructions.md` body for a profile.
 * Trims values and omits empty fact bullets. Omits the voice section for
 * empty / unknown roles.
 */
export function renderProfileRule(profile: ProfileRuleInput): string {
	const role = trimValue(profile.role);
	const labels = factBulletLabelsFor(role);
	const facts: string[] = [];
	for (const { key, label } of labels) {
		const value = trimValue(profile[key]);
		if (value) {
			facts.push(`- **${label}:** ${value}`);
		}
	}

	const lines: string[] = [
		'---',
		'description: \'Safe Appeals user profile — who the user is and how they work\'',
		'applyTo: \'**\'',
		'---',
		'',
		'# About the Safe Appeals user',
		'',
		'This profile was set up during the Safe Appeals welcome onboarding',
		'(rerun "Safe Appeals Timeline: Set Up Profile" to change it).',
		'',
		...facts,
	];

	if (facts.length > 0) {
		lines.push('');
	}

	lines.push(
		perspectiveFor(role),
		'',
		PROFILE_CITATIONS_SECTION,
	);

	const voice = voiceStubFor(role);
	if (voice) {
		lines.push(
			'',
			'## Working with this user',
			'',
			voice,
		);
	}

	lines.push('');
	return lines.join('\n');
}

function trimValue(value: string | undefined): string {
	return value?.trim() ?? '';
}
