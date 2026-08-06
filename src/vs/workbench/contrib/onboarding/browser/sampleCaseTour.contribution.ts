/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { onboardingScenarioRegistry } from '../common/onboardingRegistry.js';
import { IOnboardingScenarioService } from '../common/onboardingScenarioService.js';
import {
	createSampleCaseTourScenario,
	runSampleCaseTourCommand,
	SAMPLE_CASE_TOUR_COMMAND_ID,
	showApprovalPromptMock,
} from './sampleCaseTour.js';

/**
 * Registers the Safe Appeals sample-case spotlight scenario. The approval mock
 * is tracked inside {@link showApprovalPromptMock}.
 */
class SampleCaseTourContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.onboarding.sampleCaseTour';

	constructor(
		@ICommandService commandService: ICommandService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
	) {
		super();
		this._register(onboardingScenarioRegistry.register(createSampleCaseTourScenario(commandService, contextService, {
			show: () => showApprovalPromptMock(layoutService),
		})));
	}
}

registerWorkbenchContribution2(SampleCaseTourContribution.ID, SampleCaseTourContribution, WorkbenchPhase.AfterRestored);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: SAMPLE_CASE_TOUR_COMMAND_ID,
			title: localize2('safeappeals.sampleCaseTour.action', "Take the Sample Case Tour"),
			category: Categories.Help,
			f1: true,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await runSampleCaseTourCommand(
			accessor.get(IOnboardingScenarioService),
			accessor.get(IEditorService),
			accessor.get(ICommandService),
		);
	}
});
