/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IViewContainersRegistry, IViewsRegistry, Extensions as ViewContainerExtensions, ViewContainerLocation, Extensions as ViewExtensions } from '../../../../common/views.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { ViewPaneContainer } from '../../../../browser/parts/views/viewPaneContainer.js';
import { Orientation } from '../../../../../base/browser/ui/sash/sash.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import * as nls from '../../../../../nls.js';
import { FileOrganizerDashboardPane } from './fileOrganizerDashboardPane.js';
import { Action2, registerAction2, MenuId } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { KeyMod, KeyCode } from '../../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { IFileOrganizerService, FileOrganizerService } from './fileOrganizerService.js';

// Register service
registerSingleton(IFileOrganizerService, FileOrganizerService, InstantiationType.Delayed);

// ---------- Register view container ----------

export const FILE_ORGANIZER_VIEW_CONTAINER_ID = 'workbench.view.fileOrganizer';
export const FILE_ORGANIZER_VIEW_ID = FILE_ORGANIZER_VIEW_CONTAINER_ID;

// Register view container in the Activity Bar (Sidebar)
const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const container = viewContainerRegistry.registerViewContainer({
	id: FILE_ORGANIZER_VIEW_CONTAINER_ID,
	title: nls.localize2('fileOrganizerContainer', 'File Organizer'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [FILE_ORGANIZER_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 5, // Position in activity bar (after Explorer, Search, Source Control, etc.)
	rejectAddedViews: true,
	icon: Codicon.fileSymlinkDirectory, // Icon for the activity bar button
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: false, isDefault: false });

// Register view
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: FILE_ORGANIZER_VIEW_ID,
	hideByDefault: false,
	name: nls.localize2('fileOrganizer', 'Organize Files'),
	ctorDescriptor: new SyncDescriptor(FileOrganizerDashboardPane),
	canToggleVisibility: true,
	canMoveView: true,
	weight: 100,
	order: 1,
}], container);

// ---------- Register command to open file organizer ----------

class OpenFileOrganizerDashboardAction extends Action2 {
	static readonly ID = 'void.openFileOrganizerDashboard';

	constructor() {
		super({
			id: OpenFileOrganizerDashboardAction.ID,
			title: nls.localize2('openFileOrganizerDashboard', 'Open File Organizer Dashboard'),
			icon: Codicon.folder,
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true, // Show in command palette
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyO,
				weight: KeybindingWeight.WorkbenchContrib
			},
			menu: [
				{
					id: MenuId.CommandPalette,
					when: undefined
				},
				{
					id: MenuId.ExplorerContext,
					group: '8_void',
					order: 2
				}
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		await viewsService.openView(FILE_ORGANIZER_VIEW_ID, true);
	}
}

registerAction2(OpenFileOrganizerDashboardAction);

