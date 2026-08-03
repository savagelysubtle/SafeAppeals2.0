/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
	BOARDS_BY_COUNTRY,
	BOARDS_BY_STATE_PROVINCE,
	JURISDICTION_DISPLAY_ALIASES,
	JURISDICTION_LABELS,
	JURISDICTIONS,
} from '../types';

/**
 * Relative path from this compiled test (`out/test/`) to the workbench onboarding
 * file that mirrors `JURISDICTIONS`.
 */
const ONBOARDING_RELATIVE_PATH = path.join(
	'..', '..', '..', '..',
	'src', 'vs', 'workbench', 'contrib', 'welcomeOnboarding', 'browser',
	'onboardingVariationA.ts',
);

/** Canonical list lives in the extension; path is for failure messages only. */
const CANONICAL_RELATIVE_PATH = path.join('..', '..', 'src', 'types.ts');

/**
 * Parses `PROFILE_JURISDICTIONS` string entries from the workbench source text.
 *
 * We intentionally read the workbench file as text rather than importing it:
 * VS Code layering forbids the extension (and its tests) from importing workbench
 * modules. Importing would also pull the whole browser contribution graph into
 * the extension-host test runner.
 */
function extractProfileJurisdictions(source: string, filePath: string): string[] {
	const arrayMatch = /const PROFILE_JURISDICTIONS\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(source);
	if (!arrayMatch) {
		assert.fail(
			`Could not locate PROFILE_JURISDICTIONS array in ${filePath}. ` +
			`The drift guard cannot pass silently — fix the parser or restore the array.`,
		);
	}

	const entries = [...arrayMatch[1].matchAll(/'((?:\\'|[^'])*)'/g)].map(match =>
		match[1].replace(/\\'/g, "'"),
	);
	if (entries.length === 0) {
		assert.fail(
			`PROFILE_JURISDICTIONS in ${filePath} matched but contained no string entries. ` +
			`The drift guard cannot pass silently — fix the parser or restore the array.`,
		);
	}
	return entries;
}

/**
 * Parses a `const NAME: … = { … };` string→string[] map from workbench source text.
 */
function extractProfileStringArrayMap(
	source: string,
	constName: string,
	filePath: string,
): Record<string, string[]> {
	const declMatch = new RegExp(
		`const ${constName}\\s*(?::\\s*[^=]+)?=\\s*\\{([\\s\\S]*?)\\n\\};`,
	).exec(source);
	if (!declMatch) {
		assert.fail(
			`Could not locate ${constName} map in ${filePath}. ` +
			`The drift guard cannot pass silently — fix the parser or restore the map.`,
		);
	}

	const result: Record<string, string[]> = {};
	const entryRegex = /'((?:\\'|[^'])*)'\s*:\s*\[([^\]]*)\]/g;
	let match: RegExpExecArray | null;
	while ((match = entryRegex.exec(declMatch[1])) !== null) {
		const key = match[1].replace(/\\'/g, "'");
		const values = [...match[2].matchAll(/'((?:\\'|[^'])*)'/g)].map(valueMatch =>
			valueMatch[1].replace(/\\'/g, "'"),
		);
		result[key] = values;
	}
	if (Object.keys(result).length === 0) {
		assert.fail(
			`${constName} in ${filePath} matched but contained no entries. ` +
			`The drift guard cannot pass silently — fix the parser or restore the map.`,
		);
	}
	return result;
}

/**
 * Parses a `const NAME: … = { … };` string→string map from workbench source text.
 */
function extractProfileStringMap(
	source: string,
	constName: string,
	filePath: string,
): Record<string, string> {
	const declMatch = new RegExp(
		`const ${constName}\\s*(?::\\s*[^=]+)?=\\s*\\{([\\s\\S]*?)\\n\\};`,
	).exec(source);
	if (!declMatch) {
		assert.fail(
			`Could not locate ${constName} map in ${filePath}. ` +
			`The drift guard cannot pass silently — fix the parser or restore the map.`,
		);
	}

	const result: Record<string, string> = {};
	const entryRegex = /'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)'/g;
	let match: RegExpExecArray | null;
	while ((match = entryRegex.exec(declMatch[1])) !== null) {
		const key = match[1].replace(/\\'/g, "'");
		const value = match[2].replace(/\\'/g, "'");
		result[key] = value;
	}
	if (Object.keys(result).length === 0) {
		assert.fail(
			`${constName} in ${filePath} matched but contained no entries. ` +
			`The drift guard cannot pass silently — fix the parser or restore the map.`,
		);
	}
	return result;
}

suite('jurisdictionsDrift', () => {
	test('PROFILE_* jurisdiction mirrors stay identical to extension types', () => {
		const onboardingPath = path.resolve(__dirname, ONBOARDING_RELATIVE_PATH);
		const canonicalPath = path.resolve(__dirname, CANONICAL_RELATIVE_PATH);

		if (!fs.existsSync(onboardingPath)) {
			assert.fail(
				`Onboarding jurisdictions file is missing at ${onboardingPath}. ` +
				`The drift guard cannot pass silently — restore the file or update the path.`,
			);
		}

		const source = fs.readFileSync(onboardingPath, 'utf8');
		const profileJurisdictions = extractProfileJurisdictions(source, onboardingPath);
		const profileBoardsByStateProvince = extractProfileStringArrayMap(
			source, 'PROFILE_BOARDS_BY_STATE_PROVINCE', onboardingPath,
		);
		const profileBoardsByCountry = extractProfileStringArrayMap(
			source, 'PROFILE_BOARDS_BY_COUNTRY', onboardingPath,
		);
		const profileLabels = extractProfileStringMap(
			source, 'PROFILE_JURISDICTION_LABELS', onboardingPath,
		);
		const profileAliases = extractProfileStringMap(
			source, 'PROFILE_JURISDICTION_ALIASES', onboardingPath,
		);

		// Onboarding aliases are allowed to be a subset of extension display aliases;
		// every mirrored key must still match the extension value.
		const expectedAliases = Object.fromEntries(
			Object.keys(profileAliases).map(key => [key, JURISDICTION_DISPLAY_ALIASES[key]]),
		);

		assert.deepStrictEqual(
			{
				jurisdictions: profileJurisdictions,
				boardsByStateProvince: profileBoardsByStateProvince,
				boardsByCountry: profileBoardsByCountry,
				labels: profileLabels,
				aliases: profileAliases,
			},
			{
				jurisdictions: [...JURISDICTIONS],
				boardsByStateProvince: { ...BOARDS_BY_STATE_PROVINCE },
				boardsByCountry: { ...BOARDS_BY_COUNTRY },
				labels: { ...JURISDICTION_LABELS },
				aliases: expectedAliases,
			},
			`Workbench PROFILE_* jurisdiction mirrors have diverged from the extension. ` +
			`Onboarding copy: ${onboardingPath}. ` +
			`Canonical source of truth: ${canonicalPath} (extensions/safeappeals-timeline/src/types.ts). ` +
			`Update the onboarding mirrors to match the extension.`,
		);
	});
});
