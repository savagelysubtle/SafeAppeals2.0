/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IActionViewItemService } from '../../../../platform/actions/browser/actionViewItemService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { registerBrowserTitleBarOnboardingTarget, watchPrivateSearchStatusBarTarget } from './sampleCaseTourTargets.js';

/**
 * Marks onboarding spotlight targets that live outside dedicated view contributions
 * (e.g. the Private Search status bar item contributed by safeappeals-rag, and the
 * Integrated Browser title-bar control).
 */
class SampleCaseTourTargetsContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.onboarding.sampleCaseTourTargets';

	constructor(
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IActionViewItemService actionViewItemService: IActionViewItemService,
	) {
		super();
		this._register(watchPrivateSearchStatusBarTarget(layoutService));
		this._register(registerBrowserTitleBarOnboardingTarget(actionViewItemService));
	}
}

registerWorkbenchContribution2(SampleCaseTourTargetsContribution.ID, SampleCaseTourTargetsContribution, WorkbenchPhase.AfterRestored);
