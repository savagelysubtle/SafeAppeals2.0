/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { JURISDICTIONS } from '../types';

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

suite('jurisdictionsDrift', () => {
	test('PROFILE_JURISDICTIONS stays identical to extension JURISDICTIONS', () => {
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

		assert.deepStrictEqual(
			profileJurisdictions,
			[...JURISDICTIONS],
			`PROFILE_JURISDICTIONS and JURISDICTIONS have diverged. ` +
			`Onboarding copy: ${onboardingPath}. ` +
			`Canonical source of truth: ${canonicalPath} (extensions/safeappeals-case/src/types.ts JURISDICTIONS). ` +
			`Update the onboarding list to match the extension.`,
		);
	});
});
