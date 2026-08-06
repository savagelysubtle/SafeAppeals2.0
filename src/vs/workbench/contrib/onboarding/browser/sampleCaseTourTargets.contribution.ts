/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { watchPrivateSearchStatusBarTarget } from './sampleCaseTourTargets.js';

/**
 * Marks onboarding spotlight targets that live outside dedicated view contributions
 * (e.g. the Private Search status bar item contributed by safeappeals-rag).
 */
class SampleCaseTourTargetsContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.onboarding.sampleCaseTourTargets';

	constructor(
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
	) {
		super();
		this._register(watchPrivateSearchStatusBarTarget(layoutService));
	}
}

registerWorkbenchContribution2(SampleCaseTourTargetsContribution.ID, SampleCaseTourTargetsContribution, WorkbenchPhase.AfterRestored);
