/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { buildSafeAppealsGitPrivacyRulesMessage } from '../chat/gitPrivacyRules';

suite('Git privacy rules message', () => {
	test('buildSafeAppealsGitPrivacyRulesMessage covers legal never-push and coding confirm-once', () => {
		const message = buildSafeAppealsGitPrivacyRulesMessage();
		assert.deepStrictEqual(
			{
				hasHeader: message.includes('Git privacy rules'),
				neverPush: message.includes('never push'),
				mentionsGitHub: message.includes('GitHub'),
				localCommit: message.includes('commit locally'),
				warnConfidential: message.includes('confidential documents would leave this computer'),
				explicitConfirmation: message.includes('explicit confirmation'),
				codingConfirmOnce: message.includes('confirm once'),
				codingMayPush: message.includes('you may push'),
			},
			{
				hasHeader: true,
				neverPush: true,
				mentionsGitHub: true,
				localCommit: true,
				warnConfidential: true,
				explicitConfirmation: true,
				codingConfirmOnce: true,
				codingMayPush: true,
			},
		);
	});
});
