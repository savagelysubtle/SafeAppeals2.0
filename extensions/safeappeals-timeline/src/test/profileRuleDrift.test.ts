/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Relative path from this compiled test (`out/test/`) to the workbench copy
 * that must stay byte-identical to the extension canonical template.
 */
const WORKBENCH_RELATIVE_PATH = path.join(
	'..', '..', '..', '..',
	'src', 'vs', 'workbench', 'contrib', 'welcomeOnboarding', 'common',
	'profileRuleTemplate.ts',
);

/** Canonical list lives in the extension; path is for failure messages only. */
const CANONICAL_RELATIVE_PATH = path.join('..', '..', 'src', 'profileRuleTemplate.ts');

suite('profileRuleDrift', () => {
	test('workbench profileRuleTemplate.ts stays byte-identical to extension copy', () => {
		const workbenchPath = path.resolve(__dirname, WORKBENCH_RELATIVE_PATH);
		const canonicalPath = path.resolve(__dirname, CANONICAL_RELATIVE_PATH);

		if (!fs.existsSync(workbenchPath)) {
			assert.fail(
				`Workbench profileRuleTemplate.ts is missing at ${workbenchPath}. ` +
				`The drift guard cannot pass silently — restore the file or update the path.`,
			);
		}
		if (!fs.existsSync(canonicalPath)) {
			assert.fail(
				`Extension profileRuleTemplate.ts is missing at ${canonicalPath}. ` +
				`The drift guard cannot pass silently — restore the file or update the path.`,
			);
		}

		const workbenchSource = fs.readFileSync(workbenchPath, 'utf8');
		const canonicalSource = fs.readFileSync(canonicalPath, 'utf8');

		assert.strictEqual(
			workbenchSource,
			canonicalSource,
			`Workbench profileRuleTemplate.ts has diverged from the extension copy. ` +
			`Workbench: ${workbenchPath}. ` +
			`Canonical: ${canonicalPath}. ` +
			`Keep both files byte-identical (edit one, paste the other).`,
		);
	});
});
