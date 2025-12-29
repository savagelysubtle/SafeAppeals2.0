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
import { EmailDashboardPane } from './emailDashboardPane.js';
import { Action2, registerAction2, MenuId } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { KeyMod, KeyCode } from '../../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';

// ---------- Register view container ----------

export const EMAIL_DASHBOARD_VIEW_CONTAINER_ID = 'workbench.view.emailDashboard';
export const EMAIL_DASHBOARD_VIEW_ID = EMAIL_DASHBOARD_VIEW_CONTAINER_ID;

// Register view container in the Activity Bar (Sidebar)
const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const container = viewContainerRegistry.registerViewContainer({
	id: EMAIL_DASHBOARD_VIEW_CONTAINER_ID,
	title: nls.localize2('emailDashboardContainer', 'Email Dashboard'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [EMAIL_DASHBOARD_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 7, // Position in activity bar (after File Organizer and Timeline)
	rejectAddedViews: true,
	icon: Codicon.mail, // Icon for the activity bar button
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: false, isDefault: false });

// Register view
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: EMAIL_DASHBOARD_VIEW_ID,
	hideByDefault: false,
	name: nls.localize2('emailDashboard', 'Email Dashboard'),
	ctorDescriptor: new SyncDescriptor(EmailDashboardPane),
	canToggleVisibility: true,
	canMoveView: true,
	weight: 100,
	order: 1,
}], container);

// ---------- Register command to open email dashboard ----------

class OpenEmailDashboardAction extends Action2 {
	static readonly ID = 'void.openEmailDashboard';

	constructor() {
		super({
			id: OpenEmailDashboardAction.ID,
			title: nls.localize2('openEmailDashboard', 'Open Email Dashboard'),
			icon: Codicon.mail,
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true, // Show in command palette
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyE,
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
					order: 3
				}
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		await viewsService.openView(EMAIL_DASHBOARD_VIEW_ID, true);
	}
}

registerAction2(OpenEmailDashboardAction);

