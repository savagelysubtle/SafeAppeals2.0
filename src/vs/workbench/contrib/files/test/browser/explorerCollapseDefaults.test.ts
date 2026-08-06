/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shouldCollapseExplorerItemByDefault } from '../../browser/views/explorerCollapseDefaults.js';

suite('Files - ExplorerCollapseDefaults', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('shouldCollapseExplorerItemByDefault', () => {
		assert.deepStrictEqual({
			expandByDefault: shouldCollapseExplorerItemByDefault({ hasNests: false }, {
				fileNestingExpand: false,
				showingFilterResults: false,
				expandFoldersByDefault: true,
			}),
			legacyCollapsed: shouldCollapseExplorerItemByDefault({ hasNests: false }, {
				fileNestingExpand: false,
				showingFilterResults: false,
				expandFoldersByDefault: false,
			}),
			filterResults: shouldCollapseExplorerItemByDefault({ hasNests: false }, {
				fileNestingExpand: false,
				showingFilterResults: true,
				expandFoldersByDefault: false,
			}),
			fileNestExpand: shouldCollapseExplorerItemByDefault({ hasNests: true }, {
				fileNestingExpand: true,
				showingFilterResults: false,
				expandFoldersByDefault: false,
			}),
		}, {
			expandByDefault: false,
			legacyCollapsed: true,
			filterResults: false,
			fileNestExpand: false,
		});
	});

	test('cold restore re-applies expand-by-default (no collapse memory in helper)', () => {
		// Contract: the helper is stateless. On reload every reveal asks again with
		// expandFoldersByDefault: true, so a folder the user collapsed last session
		// still starts expanded — there is no "wasCollapsed" input to honor.
		const afterUserCollapsedThenReload = shouldCollapseExplorerItemByDefault({ hasNests: false }, {
			fileNestingExpand: false,
			showingFilterResults: false,
			expandFoldersByDefault: true,
		});
		assert.strictEqual(afterUserCollapsedThenReload, false);

		const upstreamOptOut = shouldCollapseExplorerItemByDefault({ hasNests: false }, {
			fileNestingExpand: false,
			showingFilterResults: false,
			expandFoldersByDefault: false,
		});
		assert.strictEqual(upstreamOptOut, true);
	});
});
