/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * Back-compat re-export. Prefer {@link FolderIndexWatcher}:
 * FS-watches `core_references/`, startup-scans the workspace (txt/md),
 * and reindexes on save. Scope `case_index` = non-core_references workspace files.
 */
export {
	FolderIndexWatcher as CoreReferencesWatcher,
	type FolderIndexWatcherDeps as CoreReferencesWatcherDeps,
	INDEX_DENY_DIR_NAMES,
	isUnderDeniedDir,
	walkWorkspaceIndexableFilesDefault,
} from './folderIndexWatcher';
