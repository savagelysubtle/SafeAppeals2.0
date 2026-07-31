/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
	CITATION_STYLE_LABEL,
	FOCUS_AREA_LABEL_BY_ROLE,
	getPersonaGroup,
	ORGANIZATION_LABEL_BY_GROUP,
	PROFILE_ROLES,
	ProfileFieldKey,
	ProfilePersonaGroup,
	ProfileRole,
	renderProfileRule,
	VISIBLE_FIELDS_BY_GROUP,
} from './profileRuleTemplate';
import { JURISDICTIONS, subdivisionsForCountry, UserProfile } from './types';

export { renderProfileRule } from './profileRuleTemplate';

const SECTION = 'safeappeals.profile';

/**
 * `~/.copilot/instructions` is one of VS Code's built-in user-level
 * instructions locations (see DEFAULT_INSTRUCTIONS_SOURCE_FOLDERS in
 * promptFileLocations.ts). A `*.instructions.md` file there with
 * `applyTo: '**'` is injected into every chat request in every workspace —
 * the native "global rule" mechanism, no custom plumbing needed.
 */
const PROFILE_RULE_FILENAME = 'safeappeals-profile.instructions.md';

/** All `safeappeals.profile.*` keys mirrored by {@link UserProfile}. */
const PROFILE_SETTING_KEYS: readonly ProfileFieldKey[] = [
	'name',
	'organization',
	'role',
	'practiceArea',
	'focusArea',
	'citationStyle',
	'country',
	'stateProvince',
	'city',
	'jurisdiction',
];

function profileRuleUri(): vscode.Uri {
	return vscode.Uri.file(path.join(os.homedir(), '.copilot', 'instructions', PROFILE_RULE_FILENAME));
}

async function writeProfileRule(profile: UserProfile): Promise<void> {
	const uri = profileRuleUri();
	await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
	await vscode.workspace.fs.writeFile(uri, Buffer.from(renderProfileRule(profile), 'utf8'));
}

export function getProfile(): UserProfile {
	const cfg = vscode.workspace.getConfiguration(SECTION);
	return {
		name: cfg.get<string>('name', ''),
		organization: cfg.get<string>('organization', ''),
		role: cfg.get<string>('role', ''),
		practiceArea: cfg.get<string>('practiceArea', ''),
		focusArea: cfg.get<string>('focusArea', ''),
		citationStyle: cfg.get<string>('citationStyle', ''),
		country: cfg.get<string>('country', ''),
		stateProvince: cfg.get<string>('stateProvince', ''),
		city: cfg.get<string>('city', ''),
		jurisdiction: cfg.get<string>('jurisdiction', ''),
	};
}

/**
 * Lets the user pick a compensation board from the known list or type a custom one.
 * Returns undefined on cancel.
 */
export async function pickJurisdiction(current: string, title: string): Promise<string | undefined> {
	const custom = 'Other (type your own)…';
	const items: vscode.QuickPickItem[] = [
		...JURISDICTIONS.map(j => ({ label: j, picked: j === current })),
		{ label: custom },
	];
	const picked = await vscode.window.showQuickPick(items, {
		title,
		placeHolder: current || 'e.g. BC WCB',
		ignoreFocusOut: true,
	});
	if (!picked) {
		return undefined;
	}
	if (picked.label !== custom) {
		return picked.label;
	}
	return vscode.window.showInputBox({
		title,
		prompt: 'Compensation board / tribunal',
		value: current,
		ignoreFocusOut: true,
	});
}

/**
 * Sequential quick-input flow collecting the global profile, saved to user
 * settings. Role is asked first so the remaining steps can follow that
 * persona group's visible fields. Returns true when the user completed the flow.
 */
export async function runProfileSetup(): Promise<boolean> {
	const existing = getProfile();

	const role = await pickRole(existing.role, 'Safe Appeals Profile — Your Role');
	if (role === undefined) {
		return false;
	}

	const group = getPersonaGroup(role);
	const visibleFields = VISIBLE_FIELDS_BY_GROUP[group];
	const remainingFields = visibleFields.filter(field => field !== 'role');
	const total = remainingFields.length;

	const collected: UserProfile = { ...existing, role };

	for (let i = 0; i < remainingFields.length; i++) {
		const field = remainingFields[i];
		const title = `Safe Appeals Profile (${i + 1}/${total}) — ${fieldStepTitle(field, group, role)}`;
		const value = await promptProfileField(field, collected, existing, title, group, role);
		if (value === undefined) {
			return false;
		}
		collected[field] = value;
	}

	const visibleSet = new Set<ProfileFieldKey>(visibleFields);
	const cfg = vscode.workspace.getConfiguration(SECTION);
	for (const key of PROFILE_SETTING_KEYS) {
		if (visibleSet.has(key)) {
			await cfg.update(key, collected[key], vscode.ConfigurationTarget.Global);
		}
	}

	try {
		await writeProfileRule(collected);
	} catch (error) {
		vscode.window.showWarningMessage(`Profile saved to settings, but the agent rule file could not be written: ${error instanceof Error ? error.message : String(error)}`);
		return true;
	}

	vscode.window.showInformationMessage('Safe Appeals profile saved. The agent now knows who you are in every workspace.');
	return true;
}

/**
 * Quick-pick for canonical roles, blank, or free-text Other.
 */
async function pickRole(current: string, title: string): Promise<string | undefined> {
	const notSpecified = '(Not specified)';
	const other = 'Other (type your own)…';
	const known = PROFILE_ROLES as readonly string[];
	const items: vscode.QuickPickItem[] = [
		{ label: notSpecified, description: 'Leave blank' },
		...PROFILE_ROLES.map(r => ({ label: r, picked: r === current })),
		{ label: other, picked: !!current && !known.includes(current) },
	];
	const picked = await vscode.window.showQuickPick(items, {
		title,
		placeHolder: current || 'e.g. Lawyer',
		ignoreFocusOut: true,
	});
	if (!picked) {
		return undefined;
	}
	if (picked.label === notSpecified) {
		return '';
	}
	if (picked.label !== other) {
		return picked.label;
	}
	const typed = await vscode.window.showInputBox({
		title,
		prompt: 'Your role',
		value: known.includes(current) ? '' : current,
		ignoreFocusOut: true,
	});
	return typed;
}

async function promptProfileField(
	field: ProfileFieldKey,
	collected: UserProfile,
	existing: UserProfile,
	title: string,
	group: ReturnType<typeof getPersonaGroup>,
	role: string,
): Promise<string | undefined> {
	switch (field) {
		case 'name':
			return vscode.window.showInputBox({
				title,
				prompt: 'As it should appear in case briefs and drafted documents',
				value: existing.name,
				ignoreFocusOut: true,
			});
		case 'organization':
			return vscode.window.showInputBox({
				title,
				prompt: organizationPrompt(group),
				value: existing.organization,
				ignoreFocusOut: true,
			});
		case 'practiceArea':
			return vscode.window.showInputBox({
				title,
				prompt: 'Primary area of law you practice',
				value: existing.practiceArea || 'Workers\' Compensation',
				ignoreFocusOut: true,
			});
		case 'focusArea':
			return vscode.window.showInputBox({
				title,
				prompt: focusAreaPrompt(role),
				value: existing.focusArea,
				ignoreFocusOut: true,
			});
		case 'citationStyle':
			return vscode.window.showInputBox({
				title,
				prompt: 'Preferred citation style, e.g. APA, MLA, McGill Guide',
				value: existing.citationStyle,
				ignoreFocusOut: true,
			});
		case 'country':
			return pickCountry(existing.country, title);
		case 'stateProvince':
			return pickStateProvince(collected.country, existing.stateProvince, title);
		case 'city':
			return vscode.window.showInputBox({
				title,
				prompt: 'City where you primarily practice (optional)',
				value: existing.city,
				ignoreFocusOut: true,
			});
		case 'jurisdiction':
			return pickJurisdiction(existing.jurisdiction, title);
		case 'role':
			return role;
	}
}

function fieldStepTitle(field: ProfileFieldKey, group: ReturnType<typeof getPersonaGroup>, role: string): string {
	switch (field) {
		case 'name':
			return 'Your Name';
		case 'organization':
			return titleCaseLabel(organizationLabel(group));
		case 'role':
			return 'Your Role';
		case 'practiceArea':
			return 'Practice Area';
		case 'focusArea':
			return titleCaseLabel(focusAreaLabel(role));
		case 'citationStyle':
			return titleCaseLabel(CITATION_STYLE_LABEL);
		case 'country':
			return 'Country';
		case 'stateProvince':
			return 'State / Province';
		case 'city':
			return 'City';
		case 'jurisdiction':
			return 'Compensation Board / Tribunal';
	}
}

function organizationLabel(group: ReturnType<typeof getPersonaGroup>): string {
	if (group === 'unknown') {
		return ORGANIZATION_LABEL_BY_GROUP.legal;
	}
	return ORGANIZATION_LABEL_BY_GROUP[group as ProfilePersonaGroup];
}

function organizationPrompt(group: ReturnType<typeof getPersonaGroup>): string {
	switch (group) {
		case 'education':
			return 'School or institution — leave empty if not applicable';
		case 'research':
			return 'Institution or affiliation — leave empty if independent';
		case 'office':
			return 'Company or organization — leave empty if not applicable';
		case 'developer':
			return 'Company or team — leave empty if not applicable';
		case 'self':
		case 'legal':
		case 'unknown':
			return 'Firm, union, or organization you work for — leave empty if self-represented';
	}
}

function focusAreaLabel(role: string): string {
	if ((PROFILE_ROLES as readonly string[]).includes(role)) {
		const label = FOCUS_AREA_LABEL_BY_ROLE[role as ProfileRole];
		if (label) {
			return label;
		}
	}
	return 'Focus area';
}

function focusAreaPrompt(role: string): string {
	switch (role) {
		case 'Student':
			return 'Primary field of study';
		case 'Teacher':
			return 'Subject and level you teach';
		case 'Researcher':
			return 'Primary research field';
		case 'Office Worker':
			return 'What you primarily work on';
		case 'Software Developer':
			return 'Languages, frameworks, or stack you use most';
		default:
			return 'Your main focus area';
	}
}

function titleCaseLabel(label: string): string {
	return label.replace(/(^|[\s/])([a-z])/g, (_match, prefix: string, char: string) => `${prefix}${char.toUpperCase()}`);
}

/**
 * Quick-pick for country: known markets, Other (free text), or blank.
 */
async function pickCountry(current: string, title: string): Promise<string | undefined> {
	const notSpecified = '(Not specified)';
	const other = 'Other (type your own)…';
	// Canada/US first (primary markets), then alphabetical; Other is separate.
	const known = [
		'Canada',
		'United States',
		'Australia',
		'Ireland',
		'New Zealand',
		'South Africa',
		'United Kingdom',
	] as const;
	const items: vscode.QuickPickItem[] = [
		{ label: notSpecified, description: 'Leave blank' },
		...known.map(c => ({ label: c, picked: c === current })),
		{ label: other, picked: !!current && !(known as readonly string[]).includes(current) },
	];
	const picked = await vscode.window.showQuickPick(items, {
		title,
		placeHolder: current || 'e.g. Canada',
		ignoreFocusOut: true,
	});
	if (!picked) {
		return undefined;
	}
	if (picked.label === notSpecified) {
		return '';
	}
	if (picked.label !== other) {
		return picked.label;
	}
	const typed = await vscode.window.showInputBox({
		title,
		prompt: 'Country',
		value: (known as readonly string[]).includes(current) ? '' : current,
		ignoreFocusOut: true,
	});
	return typed;
}

/**
 * Quick-pick for state/province when the country has subdivisions; free text otherwise.
 */
async function pickStateProvince(country: string, current: string, title: string): Promise<string | undefined> {
	const subdivisions = subdivisionsForCountry(country);

	if (!subdivisions) {
		return vscode.window.showInputBox({
			title,
			prompt: 'State / province (optional)',
			value: current,
			ignoreFocusOut: true,
		});
	}

	const notSpecified = '(Not specified)';
	const other = 'Other (type your own)…';
	const items: vscode.QuickPickItem[] = [
		{ label: notSpecified, description: 'Leave blank' },
		...subdivisions.map(s => ({ label: s, picked: s === current })),
		{ label: other, picked: !!current && !(subdivisions as readonly string[]).includes(current) },
	];
	const picked = await vscode.window.showQuickPick(items, {
		title,
		placeHolder: current || 'e.g. British Columbia',
		ignoreFocusOut: true,
	});
	if (!picked) {
		return undefined;
	}
	if (picked.label === notSpecified) {
		return '';
	}
	if (picked.label !== other) {
		return picked.label;
	}
	const typed = await vscode.window.showInputBox({
		title,
		prompt: 'State / province',
		value: (subdivisions as readonly string[]).includes(current) ? '' : current,
		ignoreFocusOut: true,
	});
	return typed;
}
