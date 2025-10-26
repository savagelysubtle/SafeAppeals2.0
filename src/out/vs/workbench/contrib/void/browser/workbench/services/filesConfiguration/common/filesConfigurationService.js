/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../nls.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { AutoSaveConfiguration, HotExitConfiguration, FILES_READONLY_INCLUDE_CONFIG, FILES_READONLY_EXCLUDE_CONFIG, hasReadonlyCapability } from '../../../../platform/files/common/files.js';
import { equals } from '../../../../base/common/objects.js';
import { isWeb } from '../../../../base/common/platform.js';
import { ResourceGlobMatcher } from '../../../common/resources.js';
import { GlobalIdleValue } from '../../../../base/common/async.js';
import { LRUCache, ResourceMap } from '../../../../base/common/map.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../common/editor.js';
import { MarkerSeverity } from '../../../../platform/markers/common/markers.js';
export const AutoSaveAfterShortDelayContext = new RawContextKey('autoSaveAfterShortDelayContext', false, true);
export const IFilesConfigurationService = createDecorator('filesConfigurationService');
export class FilesConfigurationService extends Disposable {
    configurationService;
    contextService;
    environmentService;
    uriIdentityService;
    fileService;
    markerService;
    textResourceConfigurationService;
    static DEFAULT_AUTO_SAVE_MODE = isWeb ? AutoSaveConfiguration.AFTER_DELAY : AutoSaveConfiguration.OFF;
    static DEFAULT_AUTO_SAVE_DELAY = 1000;
    static READONLY_MESSAGES = {
        providerReadonly: { value: localize('providerReadonly', "Editor is read-only because the file system of the file is read-only."), isTrusted: true },
        sessionReadonly: { value: localize({ key: 'sessionReadonly', comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change', '{Locked="](command:{0})"}'] }, "Editor is read-only because the file was set read-only in this session. [Click here](command:{0}) to set writeable.", 'workbench.action.files.setActiveEditorWriteableInSession'), isTrusted: true },
        configuredReadonly: { value: localize({ key: 'configuredReadonly', comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change', '{Locked="](command:{0})"}'] }, "Editor is read-only because the file was set read-only via settings. [Click here](command:{0}) to configure or [toggle for this session](command:{1}).", `workbench.action.openSettings?${encodeURIComponent('["files.readonly"]')}`, 'workbench.action.files.toggleActiveEditorReadonlyInSession'), isTrusted: true },
        fileLocked: { value: localize({ key: 'fileLocked', comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change', '{Locked="](command:{0})"}'] }, "Editor is read-only because of file permissions. [Click here](command:{0}) to set writeable anyway.", 'workbench.action.files.setActiveEditorWriteableInSession'), isTrusted: true },
        fileReadonly: { value: localize('fileReadonly', "Editor is read-only because the file is read-only."), isTrusted: true }
    };
    _onDidChangeAutoSaveConfiguration = this._register(new Emitter());
    onDidChangeAutoSaveConfiguration = this._onDidChangeAutoSaveConfiguration.event;
    _onDidChangeAutoSaveDisabled = this._register(new Emitter());
    onDidChangeAutoSaveDisabled = this._onDidChangeAutoSaveDisabled.event;
    _onDidChangeFilesAssociation = this._register(new Emitter());
    onDidChangeFilesAssociation = this._onDidChangeFilesAssociation.event;
    _onDidChangeReadonly = this._register(new Emitter());
    onDidChangeReadonly = this._onDidChangeReadonly.event;
    currentGlobalAutoSaveConfiguration;
    currentFilesAssociationConfiguration;
    currentHotExitConfiguration;
    autoSaveConfigurationCache = new LRUCache(1000);
    autoSaveAfterShortDelayOverrides = new ResourceMap();
    autoSaveDisabledOverrides = new ResourceMap();
    autoSaveAfterShortDelayContext;
    readonlyIncludeMatcher = this._register(new GlobalIdleValue(() => this.createReadonlyMatcher(FILES_READONLY_INCLUDE_CONFIG)));
    readonlyExcludeMatcher = this._register(new GlobalIdleValue(() => this.createReadonlyMatcher(FILES_READONLY_EXCLUDE_CONFIG)));
    configuredReadonlyFromPermissions;
    sessionReadonlyOverrides = new ResourceMap(resource => this.uriIdentityService.extUri.getComparisonKey(resource));
    constructor(contextKeyService, configurationService, contextService, environmentService, uriIdentityService, fileService, markerService, textResourceConfigurationService) {
        super();
        this.configurationService = configurationService;
        this.contextService = contextService;
        this.environmentService = environmentService;
        this.uriIdentityService = uriIdentityService;
        this.fileService = fileService;
        this.markerService = markerService;
        this.textResourceConfigurationService = textResourceConfigurationService;
        this.autoSaveAfterShortDelayContext = AutoSaveAfterShortDelayContext.bindTo(contextKeyService);
        const configuration = configurationService.getValue();
        this.currentGlobalAutoSaveConfiguration = this.computeAutoSaveConfiguration(undefined, configuration.files);
        this.currentFilesAssociationConfiguration = configuration?.files?.associations;
        this.currentHotExitConfiguration = configuration?.files?.hotExit || HotExitConfiguration.ON_EXIT;
        this.onFilesConfigurationChange(configuration, false);
        this.registerListeners();
    }
    createReadonlyMatcher(config) {
        const matcher = this._register(new ResourceGlobMatcher(resource => this.configurationService.getValue(config, { resource }), event => event.affectsConfiguration(config), this.contextService, this.configurationService));
        this._register(matcher.onExpressionChange(() => this._onDidChangeReadonly.fire()));
        return matcher;
    }
    isReadonly(resource, stat) {
        // if the entire file system provider is readonly, we respect that
        // and do not allow to change readonly. we take this as a hint that
        // the provider has no capabilities of writing.
        const provider = this.fileService.getProvider(resource.scheme);
        if (provider && hasReadonlyCapability(provider)) {
            return provider.readOnlyMessage ?? FilesConfigurationService.READONLY_MESSAGES.providerReadonly;
        }
        // session override always wins over the others
        const sessionReadonlyOverride = this.sessionReadonlyOverrides.get(resource);
        if (typeof sessionReadonlyOverride === 'boolean') {
            return sessionReadonlyOverride === true ? FilesConfigurationService.READONLY_MESSAGES.sessionReadonly : false;
        }
        if (this.uriIdentityService.extUri.isEqualOrParent(resource, this.environmentService.userRoamingDataHome) ||
            this.uriIdentityService.extUri.isEqual(resource, this.contextService.getWorkspace().configuration ?? undefined)) {
            return false; // explicitly exclude some paths from readonly that we need for configuration
        }
        // configured glob patterns win over stat information
        if (this.readonlyIncludeMatcher.value.matches(resource)) {
            return !this.readonlyExcludeMatcher.value.matches(resource) ? FilesConfigurationService.READONLY_MESSAGES.configuredReadonly : false;
        }
        // check if file is locked and configured to treat as readonly
        if (this.configuredReadonlyFromPermissions && stat?.locked) {
            return FilesConfigurationService.READONLY_MESSAGES.fileLocked;
        }
        // check if file is marked readonly from the file system provider
        if (stat?.readonly) {
            return FilesConfigurationService.READONLY_MESSAGES.fileReadonly;
        }
        return false;
    }
    async updateReadonly(resource, readonly) {
        if (readonly === 'toggle') {
            let stat = undefined;
            try {
                stat = await this.fileService.resolve(resource, { resolveMetadata: true });
            }
            catch (error) {
                // ignore
            }
            readonly = !this.isReadonly(resource, stat);
        }
        if (readonly === 'reset') {
            this.sessionReadonlyOverrides.delete(resource);
        }
        else {
            this.sessionReadonlyOverrides.set(resource, readonly);
        }
        this._onDidChangeReadonly.fire();
    }
    registerListeners() {
        // Files configuration changes
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('files')) {
                this.onFilesConfigurationChange(this.configurationService.getValue(), true);
            }
        }));
    }
    onFilesConfigurationChange(configuration, fromEvent) {
        // Auto Save
        this.currentGlobalAutoSaveConfiguration = this.computeAutoSaveConfiguration(undefined, configuration.files);
        this.autoSaveConfigurationCache.clear();
        this.autoSaveAfterShortDelayContext.set(this.getAutoSaveMode(undefined).mode === 1 /* AutoSaveMode.AFTER_SHORT_DELAY */);
        if (fromEvent) {
            this._onDidChangeAutoSaveConfiguration.fire();
        }
        // Check for change in files associations
        const filesAssociation = configuration?.files?.associations;
        if (!equals(this.currentFilesAssociationConfiguration, filesAssociation)) {
            this.currentFilesAssociationConfiguration = filesAssociation;
            if (fromEvent) {
                this._onDidChangeFilesAssociation.fire();
            }
        }
        // Hot exit
        const hotExitMode = configuration?.files?.hotExit;
        if (hotExitMode === HotExitConfiguration.OFF || hotExitMode === HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE) {
            this.currentHotExitConfiguration = hotExitMode;
        }
        else {
            this.currentHotExitConfiguration = HotExitConfiguration.ON_EXIT;
        }
        // Readonly
        const readonlyFromPermissions = Boolean(configuration?.files?.readonlyFromPermissions);
        if (readonlyFromPermissions !== Boolean(this.configuredReadonlyFromPermissions)) {
            this.configuredReadonlyFromPermissions = readonlyFromPermissions;
            if (fromEvent) {
                this._onDidChangeReadonly.fire();
            }
        }
    }
    getAutoSaveConfiguration(resourceOrEditor) {
        const resource = this.toResource(resourceOrEditor);
        if (resource) {
            let resourceAutoSaveConfiguration = this.autoSaveConfigurationCache.get(resource);
            if (!resourceAutoSaveConfiguration) {
                resourceAutoSaveConfiguration = this.computeAutoSaveConfiguration(resource, this.textResourceConfigurationService.getValue(resource, 'files'));
                this.autoSaveConfigurationCache.set(resource, resourceAutoSaveConfiguration);
            }
            return resourceAutoSaveConfiguration;
        }
        return this.currentGlobalAutoSaveConfiguration;
    }
    computeAutoSaveConfiguration(resource, filesConfiguration) {
        let autoSave;
        let autoSaveDelay;
        let autoSaveWorkspaceFilesOnly;
        let autoSaveWhenNoErrors;
        let isOutOfWorkspace;
        let isShortAutoSaveDelay;
        switch (filesConfiguration?.autoSave ?? FilesConfigurationService.DEFAULT_AUTO_SAVE_MODE) {
            case AutoSaveConfiguration.AFTER_DELAY: {
                autoSave = 'afterDelay';
                autoSaveDelay = typeof filesConfiguration?.autoSaveDelay === 'number' && filesConfiguration.autoSaveDelay >= 0 ? filesConfiguration.autoSaveDelay : FilesConfigurationService.DEFAULT_AUTO_SAVE_DELAY;
                isShortAutoSaveDelay = autoSaveDelay <= FilesConfigurationService.DEFAULT_AUTO_SAVE_DELAY;
                break;
            }
            case AutoSaveConfiguration.ON_FOCUS_CHANGE:
                autoSave = 'onFocusChange';
                break;
            case AutoSaveConfiguration.ON_WINDOW_CHANGE:
                autoSave = 'onWindowChange';
                break;
        }
        if (filesConfiguration?.autoSaveWorkspaceFilesOnly === true) {
            autoSaveWorkspaceFilesOnly = true;
            if (resource && !this.contextService.isInsideWorkspace(resource)) {
                isOutOfWorkspace = true;
                isShortAutoSaveDelay = undefined; // out of workspace file are not auto saved with this configuration
            }
        }
        if (filesConfiguration?.autoSaveWhenNoErrors === true) {
            autoSaveWhenNoErrors = true;
            isShortAutoSaveDelay = undefined; // this configuration disables short auto save delay
        }
        return {
            autoSave,
            autoSaveDelay,
            autoSaveWorkspaceFilesOnly,
            autoSaveWhenNoErrors,
            isOutOfWorkspace,
            isShortAutoSaveDelay
        };
    }
    toResource(resourceOrEditor) {
        if (resourceOrEditor instanceof EditorInput) {
            return EditorResourceAccessor.getOriginalUri(resourceOrEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
        }
        return resourceOrEditor;
    }
    hasShortAutoSaveDelay(resourceOrEditor) {
        const resource = this.toResource(resourceOrEditor);
        if (resource && this.autoSaveAfterShortDelayOverrides.has(resource)) {
            return true; // overridden to be enabled after short delay
        }
        if (this.getAutoSaveConfiguration(resource).isShortAutoSaveDelay) {
            return !resource || !this.autoSaveDisabledOverrides.has(resource);
        }
        return false;
    }
    getAutoSaveMode(resourceOrEditor, saveReason) {
        const resource = this.toResource(resourceOrEditor);
        if (resource && this.autoSaveAfterShortDelayOverrides.has(resource)) {
            return { mode: 1 /* AutoSaveMode.AFTER_SHORT_DELAY */ }; // overridden to be enabled after short delay
        }
        if (resource && this.autoSaveDisabledOverrides.has(resource)) {
            return { mode: 0 /* AutoSaveMode.OFF */, reason: 4 /* AutoSaveDisabledReason.DISABLED */ };
        }
        const autoSaveConfiguration = this.getAutoSaveConfiguration(resource);
        if (typeof autoSaveConfiguration.autoSave === 'undefined') {
            return { mode: 0 /* AutoSaveMode.OFF */, reason: 1 /* AutoSaveDisabledReason.SETTINGS */ };
        }
        if (typeof saveReason === 'number') {
            if ((autoSaveConfiguration.autoSave === 'afterDelay' && saveReason !== 2 /* SaveReason.AUTO */) ||
                (autoSaveConfiguration.autoSave === 'onFocusChange' && saveReason !== 3 /* SaveReason.FOCUS_CHANGE */ && saveReason !== 4 /* SaveReason.WINDOW_CHANGE */) ||
                (autoSaveConfiguration.autoSave === 'onWindowChange' && saveReason !== 4 /* SaveReason.WINDOW_CHANGE */)) {
                return { mode: 0 /* AutoSaveMode.OFF */, reason: 1 /* AutoSaveDisabledReason.SETTINGS */ };
            }
        }
        if (resource) {
            if (autoSaveConfiguration.autoSaveWorkspaceFilesOnly && autoSaveConfiguration.isOutOfWorkspace) {
                return { mode: 0 /* AutoSaveMode.OFF */, reason: 2 /* AutoSaveDisabledReason.OUT_OF_WORKSPACE */ };
            }
            if (autoSaveConfiguration.autoSaveWhenNoErrors && this.markerService.read({ resource, take: 1, severities: MarkerSeverity.Error }).length > 0) {
                return { mode: 0 /* AutoSaveMode.OFF */, reason: 3 /* AutoSaveDisabledReason.ERRORS */ };
            }
        }
        switch (autoSaveConfiguration.autoSave) {
            case 'afterDelay':
                if (typeof autoSaveConfiguration.autoSaveDelay === 'number' && autoSaveConfiguration.autoSaveDelay <= FilesConfigurationService.DEFAULT_AUTO_SAVE_DELAY) {
                    // Explicitly mark auto save configurations as long running
                    // if they are configured to not run when there are errors.
                    // The rationale here is that errors may come in after auto
                    // save has been scheduled and then further delay the auto
                    // save until resolved.
                    return { mode: autoSaveConfiguration.autoSaveWhenNoErrors ? 2 /* AutoSaveMode.AFTER_LONG_DELAY */ : 1 /* AutoSaveMode.AFTER_SHORT_DELAY */ };
                }
                return { mode: 2 /* AutoSaveMode.AFTER_LONG_DELAY */ };
            case 'onFocusChange':
                return { mode: 3 /* AutoSaveMode.ON_FOCUS_CHANGE */ };
            case 'onWindowChange':
                return { mode: 4 /* AutoSaveMode.ON_WINDOW_CHANGE */ };
        }
    }
    async toggleAutoSave() {
        const currentSetting = this.configurationService.getValue('files.autoSave');
        let newAutoSaveValue;
        if ([AutoSaveConfiguration.AFTER_DELAY, AutoSaveConfiguration.ON_FOCUS_CHANGE, AutoSaveConfiguration.ON_WINDOW_CHANGE].some(setting => setting === currentSetting)) {
            newAutoSaveValue = AutoSaveConfiguration.OFF;
        }
        else {
            newAutoSaveValue = AutoSaveConfiguration.AFTER_DELAY;
        }
        return this.configurationService.updateValue('files.autoSave', newAutoSaveValue);
    }
    enableAutoSaveAfterShortDelay(resourceOrEditor) {
        const resource = this.toResource(resourceOrEditor);
        if (!resource) {
            return Disposable.None;
        }
        const counter = this.autoSaveAfterShortDelayOverrides.get(resource) ?? 0;
        this.autoSaveAfterShortDelayOverrides.set(resource, counter + 1);
        return toDisposable(() => {
            const counter = this.autoSaveAfterShortDelayOverrides.get(resource) ?? 0;
            if (counter <= 1) {
                this.autoSaveAfterShortDelayOverrides.delete(resource);
            }
            else {
                this.autoSaveAfterShortDelayOverrides.set(resource, counter - 1);
            }
        });
    }
    disableAutoSave(resourceOrEditor) {
        const resource = this.toResource(resourceOrEditor);
        if (!resource) {
            return Disposable.None;
        }
        const counter = this.autoSaveDisabledOverrides.get(resource) ?? 0;
        this.autoSaveDisabledOverrides.set(resource, counter + 1);
        if (counter === 0) {
            this._onDidChangeAutoSaveDisabled.fire(resource);
        }
        return toDisposable(() => {
            const counter = this.autoSaveDisabledOverrides.get(resource) ?? 0;
            if (counter <= 1) {
                this.autoSaveDisabledOverrides.delete(resource);
                this._onDidChangeAutoSaveDisabled.fire(resource);
            }
            else {
                this.autoSaveDisabledOverrides.set(resource, counter - 1);
            }
        });
    }
    get isHotExitEnabled() {
        if (this.contextService.getWorkspace().transient) {
            // Transient workspace: hot exit is disabled because
            // transient workspaces are not restored upon restart
            return false;
        }
        return this.currentHotExitConfiguration !== HotExitConfiguration.OFF;
    }
    get hotExitConfiguration() {
        return this.currentHotExitConfiguration;
    }
    preventSaveConflicts(resource, language) {
        return this.configurationService.getValue('files.saveConflictResolution', { resource, overrideIdentifier: language }) !== 'overwriteFileOnDisk';
    }
}
registerSingleton(IFilesConfigurationService, FilesConfigurationService, 0 /* InstantiationType.Eager */);
