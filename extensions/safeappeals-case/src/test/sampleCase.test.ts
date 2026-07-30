/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { renderProfileRule } from '../profile';
import { SAMPLE_CASE_IDENTITY } from '../sampleCase';
import { UserProfile } from '../types';

suite('sampleCase', () => {
	test('SAMPLE_CASE_IDENTITY keeps unmistakably fictional markers', () => {
		assert.deepStrictEqual(SAMPLE_CASE_IDENTITY, {
			caseName: '[SAMPLE — NOT A REAL CASE] Fictional Worker v. Demo Employer Co.',
			claimNumber: 'SAMPLE-0000-NOT-REAL',
			clientName: 'Alex Sampleton (FICTIONAL — practice data only)',
			opposingParty: 'Demo Employer Co. (FICTIONAL)',
			opposingRepresentative: 'Jordan Example, Esq. (FICTIONAL)',
		});
	});
});

suite('renderProfileRule', () => {
	test('pins fully-populated profile instructions output', () => {
		const profile: UserProfile = {
			name: 'Alex Advocate',
			organization: 'Sample Legal LLP',
			role: 'lawyer',
			practiceArea: 'Workers\' Compensation',
			country: 'Canada',
			stateProvince: 'British Columbia',
			city: 'Vancouver',
			jurisdiction: 'BC WCB',
		};
		assert.strictEqual(renderProfileRule(profile), [
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
			'- **Name:** Alex Advocate',
			'- **Firm / organization:** Sample Legal LLP',
			'- **Role:** lawyer',
			'- **Practice area:** Workers\' Compensation',
			'- **Country:** Canada',
			'- **State / province:** British Columbia',
			'- **City:** Vancouver',
			'- **Compensation board / tribunal:** BC WCB',
			'',
			'When drafting documents, correspondence, or appeals, write from this',
			'person\'s perspective and jurisdiction unless the case brief (AGENTS.md',
			'in the case folder) says otherwise. Case-specific facts always take',
			'precedence over this profile.',
			'',
			'Flag every legal citation you produce as *unverified* and tell the user',
			'to confirm it against a primary source before relying on it.',
			'',
		].join('\n'));
	});
});
