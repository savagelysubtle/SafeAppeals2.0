/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { deepClone } from '../../../../base/common/objects.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { defaultProviderSettings, getModelCapabilities } from './modelCapabilities.js';
import { VOID_SETTINGS_STORAGE_KEY } from './storageKeys.js';
import { defaultSettingsOfProvider, providerNames, modelSelectionsEqual, featureNames, defaultGlobalSettings, defaultOverridesOfModel } from './voidSettingsTypes.js';
const _modelsWithSwappedInNewModels = (options) => {
    const { existingModels, models, type } = options;
    const existingModelsMap = {};
    for (const existingModel of existingModels) {
        existingModelsMap[existingModel.modelName] = existingModel;
    }
    const newDefaultModels = models.map((modelName, i) => ({ modelName, type, isHidden: !!existingModelsMap[modelName]?.isHidden, }));
    return [
        ...newDefaultModels, // swap out all the models of this type for the new models of this type
        ...existingModels.filter(m => {
            const keep = m.type !== type;
            return keep;
        })
    ];
};
export const modelFilterOfFeatureName = {
    'Autocomplete': { filter: (o, opts) => getModelCapabilities(o.providerName, o.modelName, opts.overridesOfModel).supportsFIM, emptyMessage: { message: 'No models support FIM', priority: 'always' } },
    'Chat': { filter: o => true, emptyMessage: null, },
    'Ctrl+K': { filter: o => true, emptyMessage: null, },
    'Apply': { filter: o => true, emptyMessage: null, },
    'SCM': { filter: o => true, emptyMessage: null, },
};
const _stateWithMergedDefaultModels = (state) => {
    let newSettingsOfProvider = state.settingsOfProvider;
    // recompute default models
    for (const providerName of providerNames) {
        const defaultModels = defaultSettingsOfProvider[providerName]?.models ?? [];
        const currentModels = newSettingsOfProvider[providerName]?.models ?? [];
        const defaultModelNames = defaultModels.map(m => m.modelName);
        const newModels = _modelsWithSwappedInNewModels({ existingModels: currentModels, models: defaultModelNames, type: 'default' });
        newSettingsOfProvider = {
            ...newSettingsOfProvider,
            [providerName]: {
                ...newSettingsOfProvider[providerName],
                models: newModels,
            },
        };
    }
    return {
        ...state,
        settingsOfProvider: newSettingsOfProvider,
    };
};
const _validatedModelState = (state) => {
    let newSettingsOfProvider = state.settingsOfProvider;
    // recompute _didFillInProviderSettings
    for (const providerName of providerNames) {
        const settingsAtProvider = newSettingsOfProvider[providerName];
        const didFillInProviderSettings = Object.keys(defaultProviderSettings[providerName]).every(key => !!settingsAtProvider[key]);
        if (didFillInProviderSettings === settingsAtProvider._didFillInProviderSettings)
            continue;
        newSettingsOfProvider = {
            ...newSettingsOfProvider,
            [providerName]: {
                ...settingsAtProvider,
                _didFillInProviderSettings: didFillInProviderSettings,
            },
        };
    }
    // update model options
    let newModelOptions = [];
    for (const providerName of providerNames) {
        const providerTitle = providerName; // displayInfoOfProviderName(providerName).title.toLowerCase() // looks better lowercase, best practice to not use raw providerName
        if (!newSettingsOfProvider[providerName]._didFillInProviderSettings)
            continue; // if disabled, don't display model options
        for (const { modelName, isHidden } of newSettingsOfProvider[providerName].models) {
            if (isHidden)
                continue;
            newModelOptions.push({ name: `${modelName} (${providerTitle})`, selection: { providerName, modelName } });
        }
    }
    // now that model options are updated, make sure the selection is valid
    // if the user-selected model is no longer in the list, update the selection for each feature that needs it to something relevant (the 0th model available, or null)
    let newModelSelectionOfFeature = state.modelSelectionOfFeature;
    for (const featureName of featureNames) {
        const { filter } = modelFilterOfFeatureName[featureName];
        const filterOpts = { chatMode: state.globalSettings.chatMode, overridesOfModel: state.overridesOfModel };
        const modelOptionsForThisFeature = newModelOptions.filter((o) => filter(o.selection, filterOpts));
        const modelSelectionAtFeature = newModelSelectionOfFeature[featureName];
        const selnIdx = modelSelectionAtFeature === null ? -1 : modelOptionsForThisFeature.findIndex(m => modelSelectionsEqual(m.selection, modelSelectionAtFeature));
        if (selnIdx !== -1)
            continue; // no longer in list, so update to 1st in list or null
        newModelSelectionOfFeature = {
            ...newModelSelectionOfFeature,
            [featureName]: modelOptionsForThisFeature.length === 0 ? null : modelOptionsForThisFeature[0].selection
        };
    }
    const newState = {
        ...state,
        settingsOfProvider: newSettingsOfProvider,
        modelSelectionOfFeature: newModelSelectionOfFeature,
        overridesOfModel: state.overridesOfModel,
        _modelOptions: newModelOptions,
    };
    return newState;
};
const defaultState = () => {
    const d = {
        settingsOfProvider: deepClone(defaultSettingsOfProvider),
        modelSelectionOfFeature: { 'Chat': null, 'Ctrl+K': null, 'Autocomplete': null, 'Apply': null, 'SCM': null },
        globalSettings: deepClone(defaultGlobalSettings),
        optionsOfModelSelection: { 'Chat': {}, 'Ctrl+K': {}, 'Autocomplete': {}, 'Apply': {}, 'SCM': {} },
        overridesOfModel: deepClone(defaultOverridesOfModel),
        _modelOptions: [], // computed later
        mcpUserStateOfName: {},
    };
    return d;
};
export const IVoidSettingsService = createDecorator('VoidSettingsService');
class VoidSettingsService extends Disposable {
    _storageService;
    _encryptionService;
    _metricsService;
    _serviceBrand;
    _onDidChangeState = new Emitter();
    onDidChangeState = this._onDidChangeState.event; // this is primarily for use in react, so react can listen + update on state changes
    state;
    _resolver;
    waitForInitState; // await this if you need a valid state initially
    constructor(_storageService, _encryptionService, _metricsService) {
        super();
        this._storageService = _storageService;
        this._encryptionService = _encryptionService;
        this._metricsService = _metricsService;
        // at the start, we haven't read the partial config yet, but we need to set state to something
        this.state = defaultState();
        let resolver = () => { };
        this.waitForInitState = new Promise((res, rej) => resolver = res);
        this._resolver = resolver;
        this.readAndInitializeState();
    }
    dangerousSetState = async (newState) => {
        this.state = _validatedModelState(newState);
        await this._storeState();
        this._onDidChangeState.fire();
        this._onUpdate_syncApplyToChat();
        this._onUpdate_syncSCMToChat();
    };
    async resetState() {
        await this.dangerousSetState(defaultState());
    }
    async readAndInitializeState() {
        let readS;
        try {
            readS = await this._readState();
            // 1.0.3 addition, remove when enough users have had this code run
            if (readS.globalSettings.includeToolLintErrors === undefined)
                readS.globalSettings.includeToolLintErrors = true;
            // autoapprove is now an obj not a boolean (1.2.5)
            if (typeof readS.globalSettings.autoApprove === 'boolean')
                readS.globalSettings.autoApprove = {};
            // 1.3.5 add source control feature
            if (readS.modelSelectionOfFeature && !readS.modelSelectionOfFeature['SCM']) {
                readS.modelSelectionOfFeature['SCM'] = deepClone(readS.modelSelectionOfFeature['Chat']);
                readS.optionsOfModelSelection['SCM'] = deepClone(readS.optionsOfModelSelection['Chat']);
            }
            // add disableSystemMessage feature
            if (readS.globalSettings.disableSystemMessage === undefined)
                readS.globalSettings.disableSystemMessage = false;
            // add autoAcceptLLMChanges feature
            if (readS.globalSettings.autoAcceptLLMChanges === undefined)
                readS.globalSettings.autoAcceptLLMChanges = false;
        }
        catch (e) {
            readS = defaultState();
        }
        // the stored data structure might be outdated, so we need to update it here
        try {
            readS = {
                ...defaultState(),
                ...readS,
                // no idea why this was here, seems like a bug
                // ...defaultSettingsOfProvider,
                // ...readS.settingsOfProvider,
            };
            for (const providerName of providerNames) {
                readS.settingsOfProvider[providerName] = {
                    ...defaultSettingsOfProvider[providerName],
                    ...readS.settingsOfProvider[providerName],
                };
                // conversion from 1.0.3 to 1.2.5 (can remove this when enough people update)
                for (const m of readS.settingsOfProvider[providerName].models) {
                    if (!m.type) {
                        const old = m;
                        if (old.isAutodetected)
                            m.type = 'autodetected';
                        else if (old.isDefault)
                            m.type = 'default';
                        else
                            m.type = 'custom';
                    }
                }
                // remove when enough people have had it run (default is now {})
                if (providerName === 'openAICompatible' && !readS.settingsOfProvider[providerName].headersJSON) {
                    readS.settingsOfProvider[providerName].headersJSON = '{}';
                }
            }
        }
        catch (e) {
            readS = defaultState();
        }
        this.state = readS;
        this.state = _stateWithMergedDefaultModels(this.state);
        this.state = _validatedModelState(this.state);
        this._resolver();
        this._onDidChangeState.fire();
    }
    async _readState() {
        const encryptedState = this._storageService.get(VOID_SETTINGS_STORAGE_KEY, -1 /* StorageScope.APPLICATION */);
        if (!encryptedState)
            return defaultState();
        const stateStr = await this._encryptionService.decrypt(encryptedState);
        const state = JSON.parse(stateStr);
        return state;
    }
    async _storeState() {
        const state = this.state;
        const encryptedState = await this._encryptionService.encrypt(JSON.stringify(state));
        this._storageService.store(VOID_SETTINGS_STORAGE_KEY, encryptedState, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
    }
    setSettingOfProvider = async (providerName, settingName, newVal) => {
        const newModelSelectionOfFeature = this.state.modelSelectionOfFeature;
        const newOptionsOfModelSelection = this.state.optionsOfModelSelection;
        const newSettingsOfProvider = {
            ...this.state.settingsOfProvider,
            [providerName]: {
                ...this.state.settingsOfProvider[providerName],
                [settingName]: newVal,
            }
        };
        const newGlobalSettings = this.state.globalSettings;
        const newOverridesOfModel = this.state.overridesOfModel;
        const newMCPUserStateOfName = this.state.mcpUserStateOfName;
        const newState = {
            modelSelectionOfFeature: newModelSelectionOfFeature,
            optionsOfModelSelection: newOptionsOfModelSelection,
            settingsOfProvider: newSettingsOfProvider,
            globalSettings: newGlobalSettings,
            overridesOfModel: newOverridesOfModel,
            mcpUserStateOfName: newMCPUserStateOfName,
        };
        this.state = _validatedModelState(newState);
        await this._storeState();
        this._onDidChangeState.fire();
    };
    _onUpdate_syncApplyToChat() {
        // if sync is turned on, sync (call this whenever Chat model or !!sync changes)
        this.setModelSelectionOfFeature('Apply', deepClone(this.state.modelSelectionOfFeature['Chat']));
    }
    _onUpdate_syncSCMToChat() {
        this.setModelSelectionOfFeature('SCM', deepClone(this.state.modelSelectionOfFeature['Chat']));
    }
    setGlobalSetting = async (settingName, newVal) => {
        const newState = {
            ...this.state,
            globalSettings: {
                ...this.state.globalSettings,
                [settingName]: newVal
            }
        };
        this.state = _validatedModelState(newState);
        await this._storeState();
        this._onDidChangeState.fire();
        // hooks
        if (this.state.globalSettings.syncApplyToChat)
            this._onUpdate_syncApplyToChat();
        if (this.state.globalSettings.syncSCMToChat)
            this._onUpdate_syncSCMToChat();
    };
    setModelSelectionOfFeature = async (featureName, newVal) => {
        const newState = {
            ...this.state,
            modelSelectionOfFeature: {
                ...this.state.modelSelectionOfFeature,
                [featureName]: newVal
            }
        };
        this.state = _validatedModelState(newState);
        await this._storeState();
        this._onDidChangeState.fire();
        // hooks
        if (featureName === 'Chat') {
            // When Chat model changes, update synced features
            this._onUpdate_syncApplyToChat();
            this._onUpdate_syncSCMToChat();
        }
    };
    setOptionsOfModelSelection = async (featureName, providerName, modelName, newVal) => {
        const newState = {
            ...this.state,
            optionsOfModelSelection: {
                ...this.state.optionsOfModelSelection,
                [featureName]: {
                    ...this.state.optionsOfModelSelection[featureName],
                    [providerName]: {
                        ...this.state.optionsOfModelSelection[featureName][providerName],
                        [modelName]: {
                            ...this.state.optionsOfModelSelection[featureName][providerName]?.[modelName],
                            ...newVal
                        }
                    }
                }
            }
        };
        this.state = _validatedModelState(newState);
        await this._storeState();
        this._onDidChangeState.fire();
    };
    setOverridesOfModel = async (providerName, modelName, overrides) => {
        const newState = {
            ...this.state,
            overridesOfModel: {
                ...this.state.overridesOfModel,
                [providerName]: {
                    ...this.state.overridesOfModel[providerName],
                    [modelName]: overrides === undefined ? undefined : {
                        ...this.state.overridesOfModel[providerName][modelName],
                        ...overrides
                    },
                }
            }
        };
        this.state = _validatedModelState(newState);
        await this._storeState();
        this._onDidChangeState.fire();
        this._metricsService.capture('Update Model Overrides', { providerName, modelName, overrides });
    };
    setAutodetectedModels(providerName, autodetectedModelNames, logging) {
        const { models } = this.state.settingsOfProvider[providerName];
        const oldModelNames = models.map(m => m.modelName);
        const newModels = _modelsWithSwappedInNewModels({ existingModels: models, models: autodetectedModelNames, type: 'autodetected' });
        this.setSettingOfProvider(providerName, 'models', newModels);
        // if the models changed, log it
        const new_names = newModels.map(m => m.modelName);
        if (!(oldModelNames.length === new_names.length
            && oldModelNames.every((_, i) => oldModelNames[i] === new_names[i]))) {
            this._metricsService.capture('Autodetect Models', { providerName, newModels: newModels, ...logging });
        }
    }
    toggleModelHidden(providerName, modelName) {
        const { models } = this.state.settingsOfProvider[providerName];
        const modelIdx = models.findIndex(m => m.modelName === modelName);
        if (modelIdx === -1)
            return;
        const newIsHidden = !models[modelIdx].isHidden;
        const newModels = [
            ...models.slice(0, modelIdx),
            { ...models[modelIdx], isHidden: newIsHidden },
            ...models.slice(modelIdx + 1, Infinity)
        ];
        this.setSettingOfProvider(providerName, 'models', newModels);
        this._metricsService.capture('Toggle Model Hidden', { providerName, modelName, newIsHidden });
    }
    addModel(providerName, modelName) {
        const { models } = this.state.settingsOfProvider[providerName];
        const existingIdx = models.findIndex(m => m.modelName === modelName);
        if (existingIdx !== -1)
            return; // if exists, do nothing
        const newModels = [
            ...models,
            { modelName, type: 'custom', isHidden: false }
        ];
        this.setSettingOfProvider(providerName, 'models', newModels);
        this._metricsService.capture('Add Model', { providerName, modelName });
    }
    deleteModel(providerName, modelName) {
        const { models } = this.state.settingsOfProvider[providerName];
        const delIdx = models.findIndex(m => m.modelName === modelName);
        if (delIdx === -1)
            return false;
        const newModels = [
            ...models.slice(0, delIdx), // delete the idx
            ...models.slice(delIdx + 1, Infinity)
        ];
        this.setSettingOfProvider(providerName, 'models', newModels);
        this._metricsService.capture('Delete Model', { providerName, modelName });
        return true;
    }
    // MCP Server State
    _setMCPUserStateOfName = async (newStates) => {
        const newState = {
            ...this.state,
            mcpUserStateOfName: {
                ...this.state.mcpUserStateOfName,
                ...newStates
            }
        };
        this.state = _validatedModelState(newState);
        await this._storeState();
        this._onDidChangeState.fire();
        this._metricsService.capture('Set MCP Server States', { newStates });
    };
    addMCPUserStateOfNames = async (newMCPStates) => {
        const { mcpUserStateOfName: mcpServerStates } = this.state;
        const newMCPServerStates = {
            ...mcpServerStates,
            ...newMCPStates,
        };
        await this._setMCPUserStateOfName(newMCPServerStates);
        this._metricsService.capture('Add MCP Servers', { servers: Object.keys(newMCPStates).join(', ') });
    };
    removeMCPUserStateOfNames = async (serverNames) => {
        const { mcpUserStateOfName: mcpServerStates } = this.state;
        const newMCPServerStates = {
            ...mcpServerStates,
        };
        serverNames.forEach(serverName => {
            if (serverName in newMCPServerStates) {
                delete newMCPServerStates[serverName];
            }
        });
        await this._setMCPUserStateOfName(newMCPServerStates);
        this._metricsService.capture('Remove MCP Servers', { servers: serverNames.join(', ') });
    };
    setMCPServerState = async (serverName, state) => {
        const { mcpUserStateOfName } = this.state;
        const newMCPServerStates = {
            ...mcpUserStateOfName,
            [serverName]: state,
        };
        await this._setMCPUserStateOfName(newMCPServerStates);
        this._metricsService.capture('Update MCP Server State', { serverName, state });
    };
}
registerSingleton(IVoidSettingsService, VoidSettingsService, 0 /* InstantiationType.Eager */);
