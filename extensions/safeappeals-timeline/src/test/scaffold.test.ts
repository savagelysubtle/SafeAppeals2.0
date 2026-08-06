/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { renderFolderAgentsMd, STANDARD_FOLDERS, titleCaseFolderLabel } from '../scaffold';

suite('scaffold', () => {
	test('STANDARD_FOLDERS uses snake_case folder names', () => {
		assert.deepStrictEqual(
			STANDARD_FOLDERS.map(f => f.name),
			[
				'medical_reports',
				'correspondence',
				'decisions_and_orders',
				'evidence',
				'personal_notes',
				'to_sort',
			],
		);
	});

	test('nested AGENTS.md H1 title-cases snake_case folder names', () => {
		assert.deepStrictEqual({
			medicalReports: titleCaseFolderLabel('medical_reports'),
			decisionsAndOrders: titleCaseFolderLabel('decisions_and_orders'),
			toSort: titleCaseFolderLabel('to_sort'),
			h1: renderFolderAgentsMd('medical_reports', 'Brief.', 'Case A').split('\n')[0],
		}, {
			medicalReports: 'Medical Reports',
			decisionsAndOrders: 'Decisions And Orders',
			toSort: 'To Sort',
			h1: '# Medical Reports — Case A',
		});
	});
});
