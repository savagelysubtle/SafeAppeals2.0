/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { CANADA_PROVINCES, JURISDICTIONS, US_STATES, UserProfile } from './types';

const SECTION = 'safeappeals.profile';

/**
 * `~/.copilot/instructions` is one of VS Code's built-in user-level
 * instructions locations (see DEFAULT_INSTRUCTIONS_SOURCE_FOLDERS in
 * promptFileLocations.ts). A `*.instructions.md` file there with
 * `applyTo: '**'` is injected into every chat request in every workspace —
 * the native "global rule" mechanism, no custom plumbing needed.
 */
const PROFILE_RULE_FILENAME = 'safeappeals-profile.instructions.md';

function profileRuleUri(): vscode.Uri {
	return vscode.Uri.file(path.join(os.homedir(), '.copilot', 'instructions', PROFILE_RULE_FILENAME));
}

/**
 * Renders the user-level instructions file for the profile. Must stay
 * byte-identical to welcomeOnboarding's `_writeProfileRule`.
 */
export function renderProfileRule(profile: UserProfile): string {
	const facts: string[] = [];
	if (profile.name) {
		facts.push(`- **Name:** ${profile.name}`);
	}
	if (profile.organization) {
		facts.push(`- **Firm / organization:** ${profile.organization}`);
	}
	if (profile.role) {
		facts.push(`- **Role:** ${profile.role}`);
	}
	if (profile.practiceArea) {
		facts.push(`- **Practice area:** ${profile.practiceArea}`);
	}
	if (profile.country) {
		facts.push(`- **Country:** ${profile.country}`);
	}
	if (profile.stateProvince) {
		facts.push(`- **State / province:** ${profile.stateProvince}`);
	}
	if (profile.city) {
		facts.push(`- **City:** ${profile.city}`);
	}
	if (profile.jurisdiction) {
		facts.push(`- **Compensation board / tribunal:** ${profile.jurisdiction}`);
	}
	// Keep this byte-compatible with welcomeOnboarding's `_writeProfileRule`
	// (provenance line + standing citation instruction). Both writers must
	// stay identical.
	return [
		'---',
		'description: \'Safe Appeals user profile — who the user is and how they practice\'',
		'applyTo: \'**\'',
		'---',
		'',
		'# About the Safe Appeals user',
		'',
		'This profile was set up during the Safe Appeals welcome onboarding',
		'(rerun "Safe Appeals Case: Set Up Profile" to change it).',
		'',
		...facts,
		'',
		'When drafting documents, correspondence, or appeals, write from this',
		'person\'s perspective and jurisdiction unless the case brief (AGENTS.md',
		'in the case folder) says otherwise. Case-specific facts always take',
		'precedence over this profile.',
		'',
		'Flag every legal citation you produce as *unverified* and tell the user',
		'to confirm it against a primary source before relying on it.',
		'',
	].join('\n');
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
 * settings. Returns true when the user completed the flow.
 */
export async function runProfileSetup(): Promise<boolean> {
	const existing = getProfile();
	const total = 8;

	const name = await vscode.window.showInputBox({
		title: `Safe Appeals Profile (1/${total}) — Your Name`,
		prompt: 'As it should appear in case briefs and drafted documents',
		value: existing.name,
		ignoreFocusOut: true,
	});
	if (name === undefined) {
		return false;
	}

	const organization = await vscode.window.showInputBox({
		title: `Safe Appeals Profile (2/${total}) — Firm / Organization`,
		prompt: 'Firm, union, or organization you work for — leave empty if self-represented',
		value: existing.organization,
		ignoreFocusOut: true,
	});
	if (organization === undefined) {
		return false;
	}

	const role = await vscode.window.showInputBox({
		title: `Safe Appeals Profile (3/${total}) — Your Role`,
		prompt: 'e.g. lawyer, paralegal, claimant advocate, self-represented worker',
		value: existing.role,
		ignoreFocusOut: true,
	});
	if (role === undefined) {
		return false;
	}

	const practiceArea = await vscode.window.showInputBox({
		title: `Safe Appeals Profile (4/${total}) — Practice Area`,
		prompt: 'Primary area of law you practice',
		value: existing.practiceArea || 'Workers\' Compensation',
		ignoreFocusOut: true,
	});
	if (practiceArea === undefined) {
		return false;
	}

	const country = await pickCountry(existing.country, `Safe Appeals Profile (5/${total}) — Country`);
	if (country === undefined) {
		return false;
	}

	const stateProvince = await pickStateProvince(country, existing.stateProvince, `Safe Appeals Profile (6/${total}) — State / Province`);
	if (stateProvince === undefined) {
		return false;
	}

	const city = await vscode.window.showInputBox({
		title: `Safe Appeals Profile (7/${total}) — City`,
		prompt: 'City where you primarily practice (optional)',
		value: existing.city,
		ignoreFocusOut: true,
	});
	if (city === undefined) {
		return false;
	}

	const jurisdiction = await pickJurisdiction(existing.jurisdiction, `Safe Appeals Profile (8/${total}) — Compensation Board / Tribunal`);
	if (jurisdiction === undefined) {
		return false;
	}

	const cfg = vscode.workspace.getConfiguration(SECTION);
	await cfg.update('name', name, vscode.ConfigurationTarget.Global);
	await cfg.update('organization', organization, vscode.ConfigurationTarget.Global);
	await cfg.update('role', role, vscode.ConfigurationTarget.Global);
	await cfg.update('practiceArea', practiceArea, vscode.ConfigurationTarget.Global);
	await cfg.update('country', country, vscode.ConfigurationTarget.Global);
	await cfg.update('stateProvince', stateProvince, vscode.ConfigurationTarget.Global);
	await cfg.update('city', city, vscode.ConfigurationTarget.Global);
	await cfg.update('jurisdiction', jurisdiction, vscode.ConfigurationTarget.Global);

	const profile: UserProfile = { name, organization, role, practiceArea, country, stateProvince, city, jurisdiction };
	try {
		await writeProfileRule(profile);
	} catch (error) {
		vscode.window.showWarningMessage(`Profile saved to settings, but the agent rule file could not be written: ${error instanceof Error ? error.message : String(error)}`);
		return true;
	}

	vscode.window.showInformationMessage('Safe Appeals profile saved. The agent now knows who you are in every workspace.');
	return true;
}

/**
 * Quick-pick for country: Canada, United States, Other (free text), or blank.
 */
async function pickCountry(current: string, title: string): Promise<string | undefined> {
	const notSpecified = '(Not specified)';
	const other = 'Other (type your own)…';
	const known = ['Canada', 'United States'] as const;
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
 * Quick-pick for state/province when country is Canada or the US; free text otherwise.
 */
async function pickStateProvince(country: string, current: string, title: string): Promise<string | undefined> {
	const subdivisions = country === 'Canada'
		? CANADA_PROVINCES
		: country === 'United States'
			? US_STATES
			: undefined;

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
