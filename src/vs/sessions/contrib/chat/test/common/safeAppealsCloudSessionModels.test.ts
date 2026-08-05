/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { ILanguageModelChatMetadata, ILanguageModelsService, SAFEAPPEALS_CLOUD_VENDOR_ID } from '../../../../../workbench/contrib/chat/common/languageModels.js';
import {
	getSafeAppealsCloudUserSelectableModels,
	isSafeAppealsCloudPathActive,
	mergeSessionModelsWithSafeAppealsCloud,
} from '../../common/safeAppealsCloudSessionModels.js';

function createMetadata(overrides: Partial<ILanguageModelChatMetadata>): ILanguageModelChatMetadata {
	return {
		extension: new ExtensionIdentifier('test.ext'),
		name: 'Test Model',
		id: 'test-model',
		vendor: SAFEAPPEALS_CLOUD_VENDOR_ID,
		version: '1',
		family: 'test',
		maxInputTokens: 8192,
		maxOutputTokens: 4096,
		isDefaultForLocation: {},
		...overrides,
	};
}

function createLanguageModelsService(models: Record<string, ILanguageModelChatMetadata>, vendors: readonly { vendor: string }[] = [{ vendor: SAFEAPPEALS_CLOUD_VENDOR_ID }]): ILanguageModelsService {
	const onDidChangeLanguageModels = new Emitter<void>();
	const onDidChangeLanguageModelVendors = new Emitter<readonly string[]>();
	return {
		_serviceBrand: undefined,
		onDidChangeLanguageModels: onDidChangeLanguageModels.event,
		onDidChangeLanguageModelVendors: onDidChangeLanguageModelVendors.event,
		getLanguageModelIds: () => Object.keys(models),
		lookupLanguageModel: (id: string) => models[id],
		getVendors: () => vendors.map(v => ({ vendor: v.vendor, displayName: v.vendor, isDefault: false })),
	} as unknown as ILanguageModelsService;
}

suite('safeAppealsCloudSessionModels', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('isSafeAppealsCloudPathActive is true when cloud vendor is registered', () => {
		const service = createLanguageModelsService({}, [{ vendor: SAFEAPPEALS_CLOUD_VENDOR_ID }]);
		assert.strictEqual(isSafeAppealsCloudPathActive(service), true);
	});

	test('getSafeAppealsCloudUserSelectableModels returns general-purpose cloud models only', () => {
		const service = createLanguageModelsService({
			'cloud/general': createMetadata({ id: 'general', name: 'Cloud General' }),
			'cloud/hidden': createMetadata({ id: 'hidden', name: 'Hidden', isUserSelectable: false }),
			'cloud/agent': createMetadata({ id: 'agent', name: 'Agent', targetChatSessionType: 'copilotcli' }),
			'ollama/local': createMetadata({ id: 'local', vendor: 'ollama', name: 'Local' }),
		});
		const models = getSafeAppealsCloudUserSelectableModels(service);
		assert.deepStrictEqual(models.map((m: { identifier: string }) => m.identifier), ['cloud/general']);
	});

	test('mergeSessionModelsWithSafeAppealsCloud adds cloud models for copilotcli sessions', () => {
		const service = createLanguageModelsService({
			'cloud/general': createMetadata({ id: 'general', name: 'Cloud General' }),
			'agent-host-copilotcli/auto': createMetadata({
				id: 'auto',
				vendor: 'agent-host-copilotcli',
				name: 'Auto',
				targetChatSessionType: 'copilotcli',
			}),
		});
		const sessionModels = [{
			identifier: 'agent-host-copilotcli/auto',
			metadata: service.lookupLanguageModel('agent-host-copilotcli/auto')!,
		}];
		const merged = mergeSessionModelsWithSafeAppealsCloud(sessionModels, service, 'copilotcli');
		assert.deepStrictEqual(merged.map((m: { identifier: string }) => m.identifier), [
			'agent-host-copilotcli/auto',
			'cloud/general',
		]);
	});

	test('mergeSessionModelsWithSafeAppealsCloud leaves non-copilotcli sessions unchanged', () => {
		const service = createLanguageModelsService({
			'cloud/general': createMetadata({ id: 'general', name: 'Cloud General' }),
		});
		const merged = mergeSessionModelsWithSafeAppealsCloud([], service, 'claude');
		assert.deepStrictEqual(merged, []);
	});
});
