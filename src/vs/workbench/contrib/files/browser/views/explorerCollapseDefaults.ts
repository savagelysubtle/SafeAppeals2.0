/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Whether a newly revealed Explorer item should start collapsed.
 *
 * When `expandFoldersByDefault` is true, folders expand on reveal. This is the
 * cold-open / reload contract: each new reveal uses this helper, so a reload
 * re-applies expand-by-default (intentionally collapsed folders may reopen).
 * Set `explorer.expandFoldersByDefault` to false for upstream collapse-by-default.
 */
export function shouldCollapseExplorerItemByDefault(
	item: { hasNests: boolean },
	options: { fileNestingExpand: boolean; showingFilterResults: boolean; expandFoldersByDefault: boolean }
): boolean {
	if (options.showingFilterResults) {
		return false;
	}
	if (item.hasNests && options.fileNestingExpand) {
		return false;
	}
	if (options.expandFoldersByDefault) {
		return false;
	}
	return true;
}
