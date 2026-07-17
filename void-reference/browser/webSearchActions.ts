/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { VOID_WEBSEARCH_CONFIGURE_API_KEY_ACTION_ID } from './actionIDs.js';

class ConfigureBraveSearchApiKeyAction extends Action2 {
	constructor() {
		super({
			id: VOID_WEBSEARCH_CONFIGURE_API_KEY_ACTION_ID,
			title: { value: 'Configure Brave Search API Key', original: 'Configure Brave Search API Key' },
			category: { value: 'SafeAppeals', original: 'SafeAppeals' },
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const voidSettingsService = accessor.get(IVoidSettingsService);

		const currentKey = voidSettingsService.state.globalSettings.braveSearchApiKey;

		const result = await quickInputService.input({
			title: 'Configure Brave Search API Key',
			prompt: 'Enter your Brave Search API key. Get one at https://brave.com/search/api/',
			value: currentKey,
			password: true,
			placeHolder: 'BSAxxxxxxxxxxxxxxxxxxxxxxxxxx',
			ignoreFocusLost: true,
		});

		if (result !== undefined) {
			// Update the setting
			voidSettingsService.setGlobalSetting('braveSearchApiKey', result);

			if (result) {
				notificationService.info('Brave Search API key configured successfully.');
			} else {
				notificationService.info('Brave Search API key cleared.');
			}
		}
	}
}

// Register all web search actions
registerAction2(ConfigureBraveSearchApiKeyAction);

