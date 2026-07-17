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
import { FileConverterDashboardPane } from './fileConverterDashboardPane.js';
import { Action2, registerAction2, MenuId } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../editor/browser/editorExtensions.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { KeyMod, KeyCode } from '../../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';

// Import service to register it
import './fileConverterService.js';

// Import constants
import { FILE_CONVERTER_VIEW_CONTAINER_ID, FILE_CONVERTER_VIEW_ID } from './fileConverterConstants.js';

// Re-export for external use
export { FILE_CONVERTER_VIEW_CONTAINER_ID, FILE_CONVERTER_VIEW_ID };

// Register view container in the Activity Bar (Sidebar)
const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const container = viewContainerRegistry.registerViewContainer({
	id: FILE_CONVERTER_VIEW_CONTAINER_ID,
	title: nls.localize2('fileConverterContainer', 'File Converter'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [FILE_CONVERTER_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 6, // Position in activity bar (after File Organizer)
	rejectAddedViews: true,
	icon: Codicon.replace, // Icon for the activity bar button
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: false, isDefault: false });

// Register view
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: FILE_CONVERTER_VIEW_ID,
	hideByDefault: false,
	name: nls.localize2('fileConverter', 'Convert Files'),
	ctorDescriptor: new SyncDescriptor(FileConverterDashboardPane),
	canToggleVisibility: true,
	canMoveView: true,
	weight: 100,
	order: 1,
}], container);

// ---------- Register command to open file converter ----------

class OpenFileConverterDashboardAction extends Action2 {
	static readonly ID = 'void.openFileConverterDashboard';

	constructor() {
		super({
			id: OpenFileConverterDashboardAction.ID,
			title: nls.localize2('openFileConverterDashboard', 'Open File Converter Dashboard'),
			icon: Codicon.replace,
			category: nls.localize2('void', 'SafeAppeals'),
			f1: true, // Show in command palette
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC,
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
		await viewsService.openView(FILE_CONVERTER_VIEW_ID, true);
	}
}

registerAction2(OpenFileConverterDashboardAction);

// ---------- Register Convert File command ----------

class ConvertFileAction extends Action2 {
	static readonly ID = 'void.fileConverter.convert';

	constructor() {
		super({
			id: ConvertFileAction.ID,
			title: nls.localize2('convertFile', 'Convert File...'),
			icon: Codicon.arrowSwap,
			category: nls.localize2('fileConverter', 'File Converter'),
			f1: true, // Show in command palette
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
		await viewsService.openView(FILE_CONVERTER_VIEW_ID, true);
	}
}

registerAction2(ConvertFileAction);

// ---------- Register Batch Convert command ----------

class BatchConvertAction extends Action2 {
	static readonly ID = 'void.fileConverter.batchConvert';

	constructor() {
		super({
			id: BatchConvertAction.ID,
			title: nls.localize2('batchConvert', 'Batch Convert Files'),
			icon: Codicon.files,
			category: nls.localize2('fileConverter', 'File Converter'),
			f1: true, // Show in command palette
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
		await viewsService.openView(FILE_CONVERTER_VIEW_ID, true);
		// TODO: Set batch mode in the dashboard
	}
}

registerAction2(BatchConvertAction);

// ---------- Register Merge PDFs command ----------

class MergePDFsAction extends Action2 {
	static readonly ID = 'void.fileConverter.mergePDFs';

	constructor() {
		super({
			id: MergePDFsAction.ID,
			title: nls.localize2('mergePDFs', 'Merge PDFs'),
			icon: Codicon.merge,
			category: nls.localize2('fileConverter', 'File Converter'),
			f1: true, // Show in command palette
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
		await viewsService.openView(FILE_CONVERTER_VIEW_ID, true);
		// TODO: Set merge mode in the dashboard
	}
}

registerAction2(MergePDFsAction);
