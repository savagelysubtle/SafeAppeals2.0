/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../../base/common/codicons.js';
import { localize2 } from '../../../../../nls.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ViewPaneContainer } from '../../../../browser/parts/views/viewPaneContainer.js';
import { IViewContainersRegistry, IViewsRegistry, Extensions as ViewContainerExtensions, ViewContainerLocation } from '../../../../common/views.js';
import { CaseInfoPane } from './caseInfoPane.js';

// Register the Case Info view container
const VIEW_CONTAINER = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer(
	{
		id: 'workbench.view.caseInfo',
		title: localize2('caseInfo', "Case Info"),
		icon: Codicon.briefcase,
		order: 3, // Position in activity bar (after Explorer=0, Search=1, Source Control=2)
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, ['workbench.view.caseInfo', { mergeViewWithContainerWhenSingleView: true }]),
		storageId: 'workbench.view.caseInfo.state',
		hideIfEmpty: false,
	},
	ViewContainerLocation.Sidebar
);

// Register the Case Info view
Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews(
	[
		{
			id: 'workbench.view.caseInfo.main',
			name: localize2('caseInfo', "Case Info"),
			containerIcon: Codicon.briefcase,
			canToggleVisibility: false,
			canMoveView: false,
			ctorDescriptor: new SyncDescriptor(CaseInfoPane),
		}
	],
	VIEW_CONTAINER
);

