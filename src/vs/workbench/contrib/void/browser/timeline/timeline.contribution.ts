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
import { TimelinePane } from './timelinePane.js';
import { Action2, registerAction2, MenuId } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { KeyMod, KeyCode } from '../../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';

// Import to trigger service registration
import './timelineService.js';

// ============================================================================
// View Container Registration
// ============================================================================

export const TIMELINE_VIEW_CONTAINER_ID = 'workbench.view.caseTimeline';
export const TIMELINE_VIEW_ID = TIMELINE_VIEW_CONTAINER_ID;

// Register view container in the Activity Bar (Sidebar)
const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const container = viewContainerRegistry.registerViewContainer({
	id: TIMELINE_VIEW_CONTAINER_ID,
	title: nls.localize2('caseTimelineContainer', 'Case Timeline'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [TIMELINE_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 6, // Position after File Organizer
	rejectAddedViews: true,
	icon: Codicon.calendar, // Calendar icon for timeline
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: false, isDefault: false });

// Register view
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: TIMELINE_VIEW_ID,
	hideByDefault: false,
	name: nls.localize2('caseTimeline', 'Case Timeline'),
	ctorDescriptor: new SyncDescriptor(TimelinePane),
	canToggleVisibility: true,
	canMoveView: true,
	weight: 100,
	order: 1,
}], container);

// ============================================================================
// Commands / Actions
// ============================================================================

class OpenTimelineAction extends Action2 {
	static readonly ID = 'void.openCaseTimeline';

	constructor() {
		super({
			id: OpenTimelineAction.ID,
			title: nls.localize2('openCaseTimeline', 'Open Case Timeline'),
			icon: Codicon.calendar,
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true, // Show in command palette
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyT,
				weight: KeybindingWeight.WorkbenchContrib
			},
			menu: [
				{
					id: MenuId.CommandPalette,
					when: undefined
				}
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		await viewsService.openView(TIMELINE_VIEW_ID, true);
	}
}

registerAction2(OpenTimelineAction);

// ============================================================================
// Add Timeline Event Action
// ============================================================================

class AddTimelineEventAction extends Action2 {
	static readonly ID = 'void.addTimelineEvent';

	constructor() {
		super({
			id: AddTimelineEventAction.ID,
			title: nls.localize2('addTimelineEvent', 'Add Timeline Event'),
			icon: Codicon.add,
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true,
			menu: [
				{
					id: MenuId.CommandPalette,
					when: undefined
				}
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		// Open the timeline view - the React component will handle showing the add event dialog
		const viewsService = accessor.get(IViewsService);
		await viewsService.openView(TIMELINE_VIEW_ID, true);
		// TODO: Trigger "add event" mode in the React component
	}
}

registerAction2(AddTimelineEventAction);

// ============================================================================
// Link Document to Event Action (for context menu)
// ============================================================================

class LinkDocumentToTimelineAction extends Action2 {
	static readonly ID = 'void.linkDocumentToTimeline';

	constructor() {
		super({
			id: LinkDocumentToTimelineAction.ID,
			title: nls.localize2('linkDocumentToTimeline', 'Link to Timeline Event...'),
			icon: Codicon.link,
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true,
			menu: [
				{
					id: MenuId.ExplorerContext,
					group: '8_void',
					order: 3
				}
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		// TODO: Show picker to select which event to link the document to
		const viewsService = accessor.get(IViewsService);
		await viewsService.openView(TIMELINE_VIEW_ID, true);
	}
}

registerAction2(LinkDocumentToTimelineAction);

