/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { onboardingScenarioRegistry } from '../common/onboardingRegistry.js';
import { IOnboardingScenarioService } from '../common/onboardingScenarioService.js';
import {
	clearApprovalPromptMocks,
	createSampleCaseTourScenario,
	SAMPLE_CASE_TOUR_COMMAND_ID,
	SAMPLE_CASE_TOUR_ID,
	showApprovalPromptMock,
} from './sampleCaseTour.js';

/**
 * Registers the Safe Appeals sample-case spotlight scenario. The approval mock
 * is tracked inside {@link showApprovalPromptMock} / {@link clearApprovalPromptMocks}.
 */
class SampleCaseTourContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.onboarding.sampleCaseTour';

	constructor(
		@ICommandService commandService: ICommandService,
	) {
		super();
		this._register(onboardingScenarioRegistry.register(createSampleCaseTourScenario(commandService, {
			show: () => showApprovalPromptMock(),
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
		clearApprovalPromptMocks();
		const onboarding = accessor.get(IOnboardingScenarioService);
		try {
			await onboarding.runScenario(SAMPLE_CASE_TOUR_ID);
		} finally {
			clearApprovalPromptMocks();
		}
	}
});
