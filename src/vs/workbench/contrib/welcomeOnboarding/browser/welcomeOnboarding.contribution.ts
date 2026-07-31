/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Load styles for the remaining onboarding variant.
import './media/variationA.css';

import { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import product from '../../../../platform/product/common/product.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IOnboardingService } from '../common/onboardingService.js';
import { OnboardingVariationA } from './onboardingVariationA.js';

registerSingleton(IOnboardingService, OnboardingVariationA, InstantiationType.Delayed);

/**
 * SafeAppeals: the onboarding profile step persists to these settings. They are
 * registered here (not in the safeappeals-case extension) because the first-run
 * onboarding writes them before the extension host has registered extension
 * contributions, which made the writes fail as unregistered configurations.
 */
Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'safeappealsProfile',
	title: localize('safeappealsProfile.title', "Safe Appeals Profile"),
	type: 'object',
	properties: {
		'safeappeals.profile.name': {
			type: 'string',
			default: '',
			scope: ConfigurationScope.MACHINE,
			description: localize('safeappealsProfile.name', "Your name, as it should appear in case briefs and drafted documents."),
		},
		'safeappeals.profile.organization': {
			type: 'string',
			default: '',
			scope: ConfigurationScope.MACHINE,
			description: localize('safeappealsProfile.organization', "Firm, union, or organization you work for (leave empty if self-represented)."),
		},
		'safeappeals.profile.role': {
			type: 'string',
			default: '',
			scope: ConfigurationScope.MACHINE,
			description: localize('safeappealsProfile.role', "Your role, e.g. Lawyer, Paralegal, Advocate, Appeals Representative, Union Representative, Injured Worker, Representing Myself, Student, Teacher, Researcher, Office Worker, Software Developer."),
		},
		'safeappeals.profile.focusArea': {
			type: 'string',
			default: '',
			scope: ConfigurationScope.MACHINE,
			description: localize('safeappealsProfile.focusArea', "Your main focus — field of study, subject taught, research field, what you work on, or tech stack, depending on role."),
		},
		'safeappeals.profile.citationStyle': {
			type: 'string',
			default: '',
			scope: ConfigurationScope.MACHINE,
			description: localize('safeappealsProfile.citationStyle', "Preferred citation style for research and study output, e.g. APA, MLA, McGill Guide."),
		},
		'safeappeals.profile.practiceArea': {
			type: 'string',
			default: 'Workers\' Compensation',
			scope: ConfigurationScope.MACHINE,
			description: localize('safeappealsProfile.practiceArea', "Primary area of law you practice."),
		},
		'safeappeals.profile.country': {
			type: 'string',
			default: '',
			scope: ConfigurationScope.MACHINE,
			description: localize('safeappealsProfile.country', "Country where you primarily practice."),
		},
		'safeappeals.profile.stateProvince': {
			type: 'string',
			default: '',
			scope: ConfigurationScope.MACHINE,
			description: localize('safeappealsProfile.stateProvince', "State or province where you primarily practice."),
		},
		'safeappeals.profile.city': {
			type: 'string',
			default: '',
			scope: ConfigurationScope.MACHINE,
			description: localize('safeappealsProfile.city', "City where you primarily practice."),
		},
		'safeappeals.profile.jurisdiction': {
			type: 'string',
			default: '',
			scope: ConfigurationScope.MACHINE,
			description: localize('safeappealsProfile.jurisdiction', "Default compensation board or tribunal for new cases, e.g. BC WCB, Ontario WSIB, California DWC."),
		},
	},
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.welcomeOnboarding2026',
			title: localize2('welcomeOnboarding2026', "Welcome Onboarding 2026"),
			category: Categories.Developer,
			f1: true,
		});
	}

	run(accessor: ServicesAccessor): void {
		const onboardingService = accessor.get(IOnboardingService);
		onboardingService.show();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.restartWelcomeWalkthrough',
			title: localize2('restartWelcomeWalkthrough', "Restart Welcome Walkthrough"),
			category: Categories.Help,
			f1: true,
			menu: {
				id: MenuId.GlobalActivity,
				group: '5_welcome',
				order: 1,
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		const onboardingService = accessor.get(IOnboardingService);

		// Recreate the first-launch experience: open the welcome page that
		// startup would show, then place the onboarding overlay on top of it.
		await commandService.executeCommand('workbench.action.openWalkthrough');
		onboardingService.show();
	}
});

/**
 * Opens the AI-use disclosure page. Command ID is load-bearing for the
 * safeappeals-case walkthrough checklist (`howUsesAI` step).
 */
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'safeappeals.help.howUsesAI',
			title: localize2('safeappeals.help.howUsesAI', "How {0} Uses AI", product.nameLong),
			category: Categories.Help,
			f1: true,
			menu: {
				id: MenuId.MenubarHelpMenu,
				group: '1_welcome',
				order: 3,
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const openerService = accessor.get(IOpenerService);
		await openerService.open(URI.parse('https://safeappeals.com/docs/ai-assistant'));
	}
});
