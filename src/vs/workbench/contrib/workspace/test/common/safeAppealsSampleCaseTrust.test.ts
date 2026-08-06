/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	resolveSafeAppealsSampleCaseTrustUri,
	SAFEAPPEALS_SAMPLE_CASE_DIR,
	SAFEAPPEALS_TIMELINE_EXTENSION_STORAGE_ID,
	TRUST_SAFE_APPEALS_SAMPLE_CASE_COMMAND_ID,
} from '../../common/workspace.js';

suite('SafeAppeals sample case trust', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('command id is sample-case specific (not a general trust.uris API)', () => {
		assert.strictEqual(TRUST_SAFE_APPEALS_SAMPLE_CASE_COMMAND_ID, '_workbench.trust.safeAppealsSampleCase');
	});

	test('resolveSafeAppealsSampleCaseTrustUri pins timeline globalStorage sample-case as file://', () => {
		const globalStorageHome = URI.parse('vscode-userdata:/home/user/.config/SafeAppeals/User/globalStorage');
		const resolved = resolveSafeAppealsSampleCaseTrustUri(globalStorageHome);

		assert.deepStrictEqual({
			scheme: resolved.scheme,
			fsPath: resolved.fsPath,
		}, {
			scheme: 'file',
			fsPath: `/home/user/.config/SafeAppeals/User/globalStorage/${SAFEAPPEALS_TIMELINE_EXTENSION_STORAGE_ID}/${SAFEAPPEALS_SAMPLE_CASE_DIR}`,
		});
	});

	test('resolveSafeAppealsSampleCaseTrustUri keeps file:// globalStorage as file://', () => {
		const globalStorageHome = URI.file('/var/data/globalStorage');
		const resolved = resolveSafeAppealsSampleCaseTrustUri(globalStorageHome);

		assert.deepStrictEqual({
			scheme: resolved.scheme,
			fsPath: resolved.fsPath,
		}, {
			scheme: 'file',
			fsPath: `/var/data/globalStorage/${SAFEAPPEALS_TIMELINE_EXTENSION_STORAGE_ID}/${SAFEAPPEALS_SAMPLE_CASE_DIR}`,
		});
	});

	test('resolveSafeAppealsSampleCaseTrustUri never trusts arbitrary caller paths', () => {
		const globalStorageHome = URI.file('/var/data/globalStorage');
		const resolved = resolveSafeAppealsSampleCaseTrustUri(globalStorageHome);
		const attackerPath = '/home/attacker/evil';

		assert.strictEqual(resolved.fsPath.includes(attackerPath), false);
		assert.strictEqual(resolved.fsPath.endsWith(`/${SAFEAPPEALS_SAMPLE_CASE_DIR}`), true);
		assert.strictEqual(resolved.fsPath.includes(SAFEAPPEALS_TIMELINE_EXTENSION_STORAGE_ID), true);
	});
});
