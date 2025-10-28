/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Schemas } from '../../../../base/common/network.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { memoize } from '../../../../base/common/decorators.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { parseLineAndColumnAware } from '../../../../base/common/extpath.js';
import { LogLevelToString } from '../../../../platform/log/common/log.js';
import { isUndefined } from '../../../../base/common/types.js';
import { refineServiceDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { EXTENSION_IDENTIFIER_WITH_LOG_REGEX } from '../../../../platform/environment/common/environmentService.js';
export const IBrowserWorkbenchEnvironmentService = refineServiceDecorator(IEnvironmentService);
let BrowserWorkbenchEnvironmentService = (() => {
    let _instanceExtraInitializers = [];
    let _get_remoteAuthority_decorators;
    let _get_expectsResolverExtension_decorators;
    let _get_isBuilt_decorators;
    let _get_logLevel_decorators;
    let _get_windowLogsPath_decorators;
    let _get_logFile_decorators;
    let _get_userRoamingDataHome_decorators;
    let _get_argvResource_decorators;
    let _get_cacheHome_decorators;
    let _get_workspaceStorageHome_decorators;
    let _get_localHistoryHome_decorators;
    let _get_stateResource_decorators;
    let _get_userDataSyncHome_decorators;
    let _get_sync_decorators;
    let _get_keyboardLayoutResource_decorators;
    let _get_untitledWorkspacesHome_decorators;
    let _get_serviceMachineIdResource_decorators;
    let _get_extHostLogsPath_decorators;
    let _get_debugExtensionHost_decorators;
    let _get_isExtensionDevelopment_decorators;
    let _get_extensionDevelopmentLocationURI_decorators;
    let _get_extensionDevelopmentLocationKind_decorators;
    let _get_extensionTestsLocationURI_decorators;
    let _get_extensionEnabledProposedApi_decorators;
    let _get_debugRenderer_decorators;
    let _get_enableSmokeTestDriver_decorators;
    let _get_disableExtensions_decorators;
    let _get_enableExtensions_decorators;
    let _get_webviewExternalEndpoint_decorators;
    let _get_extensionTelemetryLogResource_decorators;
    let _get_disableTelemetry_decorators;
    let _get_verbose_decorators;
    let _get_logExtensionHostCommunication_decorators;
    let _get_skipReleaseNotes_decorators;
    let _get_skipWelcome_decorators;
    let _get_disableWorkspaceTrust_decorators;
    let _get_profile_decorators;
    let _get_editSessionId_decorators;
    let _get_filesToOpenOrCreate_decorators;
    let _get_filesToDiff_decorators;
    let _get_filesToMerge_decorators;
    return class BrowserWorkbenchEnvironmentService {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _get_remoteAuthority_decorators = [memoize];
            _get_expectsResolverExtension_decorators = [memoize];
            _get_isBuilt_decorators = [memoize];
            _get_logLevel_decorators = [memoize];
            _get_windowLogsPath_decorators = [memoize];
            _get_logFile_decorators = [memoize];
            _get_userRoamingDataHome_decorators = [memoize];
            _get_argvResource_decorators = [memoize];
            _get_cacheHome_decorators = [memoize];
            _get_workspaceStorageHome_decorators = [memoize];
            _get_localHistoryHome_decorators = [memoize];
            _get_stateResource_decorators = [memoize];
            _get_userDataSyncHome_decorators = [memoize];
            _get_sync_decorators = [memoize];
            _get_keyboardLayoutResource_decorators = [memoize];
            _get_untitledWorkspacesHome_decorators = [memoize];
            _get_serviceMachineIdResource_decorators = [memoize];
            _get_extHostLogsPath_decorators = [memoize];
            _get_debugExtensionHost_decorators = [memoize];
            _get_isExtensionDevelopment_decorators = [memoize];
            _get_extensionDevelopmentLocationURI_decorators = [memoize];
            _get_extensionDevelopmentLocationKind_decorators = [memoize];
            _get_extensionTestsLocationURI_decorators = [memoize];
            _get_extensionEnabledProposedApi_decorators = [memoize];
            _get_debugRenderer_decorators = [memoize];
            _get_enableSmokeTestDriver_decorators = [memoize];
            _get_disableExtensions_decorators = [memoize];
            _get_enableExtensions_decorators = [memoize];
            _get_webviewExternalEndpoint_decorators = [memoize];
            _get_extensionTelemetryLogResource_decorators = [memoize];
            _get_disableTelemetry_decorators = [memoize];
            _get_verbose_decorators = [memoize];
            _get_logExtensionHostCommunication_decorators = [memoize];
            _get_skipReleaseNotes_decorators = [memoize];
            _get_skipWelcome_decorators = [memoize];
            _get_disableWorkspaceTrust_decorators = [memoize];
            _get_profile_decorators = [memoize];
            _get_editSessionId_decorators = [memoize];
            _get_filesToOpenOrCreate_decorators = [memoize];
            _get_filesToDiff_decorators = [memoize];
            _get_filesToMerge_decorators = [memoize];
            __esDecorate(this, null, _get_remoteAuthority_decorators, { kind: "getter", name: "remoteAuthority", static: false, private: false, access: { has: obj => "remoteAuthority" in obj, get: obj => obj.remoteAuthority }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_expectsResolverExtension_decorators, { kind: "getter", name: "expectsResolverExtension", static: false, private: false, access: { has: obj => "expectsResolverExtension" in obj, get: obj => obj.expectsResolverExtension }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_isBuilt_decorators, { kind: "getter", name: "isBuilt", static: false, private: false, access: { has: obj => "isBuilt" in obj, get: obj => obj.isBuilt }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_logLevel_decorators, { kind: "getter", name: "logLevel", static: false, private: false, access: { has: obj => "logLevel" in obj, get: obj => obj.logLevel }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_windowLogsPath_decorators, { kind: "getter", name: "windowLogsPath", static: false, private: false, access: { has: obj => "windowLogsPath" in obj, get: obj => obj.windowLogsPath }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_logFile_decorators, { kind: "getter", name: "logFile", static: false, private: false, access: { has: obj => "logFile" in obj, get: obj => obj.logFile }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_userRoamingDataHome_decorators, { kind: "getter", name: "userRoamingDataHome", static: false, private: false, access: { has: obj => "userRoamingDataHome" in obj, get: obj => obj.userRoamingDataHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_argvResource_decorators, { kind: "getter", name: "argvResource", static: false, private: false, access: { has: obj => "argvResource" in obj, get: obj => obj.argvResource }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_cacheHome_decorators, { kind: "getter", name: "cacheHome", static: false, private: false, access: { has: obj => "cacheHome" in obj, get: obj => obj.cacheHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_workspaceStorageHome_decorators, { kind: "getter", name: "workspaceStorageHome", static: false, private: false, access: { has: obj => "workspaceStorageHome" in obj, get: obj => obj.workspaceStorageHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_localHistoryHome_decorators, { kind: "getter", name: "localHistoryHome", static: false, private: false, access: { has: obj => "localHistoryHome" in obj, get: obj => obj.localHistoryHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_stateResource_decorators, { kind: "getter", name: "stateResource", static: false, private: false, access: { has: obj => "stateResource" in obj, get: obj => obj.stateResource }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_userDataSyncHome_decorators, { kind: "getter", name: "userDataSyncHome", static: false, private: false, access: { has: obj => "userDataSyncHome" in obj, get: obj => obj.userDataSyncHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_sync_decorators, { kind: "getter", name: "sync", static: false, private: false, access: { has: obj => "sync" in obj, get: obj => obj.sync }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_keyboardLayoutResource_decorators, { kind: "getter", name: "keyboardLayoutResource", static: false, private: false, access: { has: obj => "keyboardLayoutResource" in obj, get: obj => obj.keyboardLayoutResource }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_untitledWorkspacesHome_decorators, { kind: "getter", name: "untitledWorkspacesHome", static: false, private: false, access: { has: obj => "untitledWorkspacesHome" in obj, get: obj => obj.untitledWorkspacesHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_serviceMachineIdResource_decorators, { kind: "getter", name: "serviceMachineIdResource", static: false, private: false, access: { has: obj => "serviceMachineIdResource" in obj, get: obj => obj.serviceMachineIdResource }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_extHostLogsPath_decorators, { kind: "getter", name: "extHostLogsPath", static: false, private: false, access: { has: obj => "extHostLogsPath" in obj, get: obj => obj.extHostLogsPath }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_debugExtensionHost_decorators, { kind: "getter", name: "debugExtensionHost", static: false, private: false, access: { has: obj => "debugExtensionHost" in obj, get: obj => obj.debugExtensionHost }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_isExtensionDevelopment_decorators, { kind: "getter", name: "isExtensionDevelopment", static: false, private: false, access: { has: obj => "isExtensionDevelopment" in obj, get: obj => obj.isExtensionDevelopment }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_extensionDevelopmentLocationURI_decorators, { kind: "getter", name: "extensionDevelopmentLocationURI", static: false, private: false, access: { has: obj => "extensionDevelopmentLocationURI" in obj, get: obj => obj.extensionDevelopmentLocationURI }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_extensionDevelopmentLocationKind_decorators, { kind: "getter", name: "extensionDevelopmentLocationKind", static: false, private: false, access: { has: obj => "extensionDevelopmentLocationKind" in obj, get: obj => obj.extensionDevelopmentLocationKind }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_extensionTestsLocationURI_decorators, { kind: "getter", name: "extensionTestsLocationURI", static: false, private: false, access: { has: obj => "extensionTestsLocationURI" in obj, get: obj => obj.extensionTestsLocationURI }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_extensionEnabledProposedApi_decorators, { kind: "getter", name: "extensionEnabledProposedApi", static: false, private: false, access: { has: obj => "extensionEnabledProposedApi" in obj, get: obj => obj.extensionEnabledProposedApi }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_debugRenderer_decorators, { kind: "getter", name: "debugRenderer", static: false, private: false, access: { has: obj => "debugRenderer" in obj, get: obj => obj.debugRenderer }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_enableSmokeTestDriver_decorators, { kind: "getter", name: "enableSmokeTestDriver", static: false, private: false, access: { has: obj => "enableSmokeTestDriver" in obj, get: obj => obj.enableSmokeTestDriver }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_disableExtensions_decorators, { kind: "getter", name: "disableExtensions", static: false, private: false, access: { has: obj => "disableExtensions" in obj, get: obj => obj.disableExtensions }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_enableExtensions_decorators, { kind: "getter", name: "enableExtensions", static: false, private: false, access: { has: obj => "enableExtensions" in obj, get: obj => obj.enableExtensions }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_webviewExternalEndpoint_decorators, { kind: "getter", name: "webviewExternalEndpoint", static: false, private: false, access: { has: obj => "webviewExternalEndpoint" in obj, get: obj => obj.webviewExternalEndpoint }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_extensionTelemetryLogResource_decorators, { kind: "getter", name: "extensionTelemetryLogResource", static: false, private: false, access: { has: obj => "extensionTelemetryLogResource" in obj, get: obj => obj.extensionTelemetryLogResource }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_disableTelemetry_decorators, { kind: "getter", name: "disableTelemetry", static: false, private: false, access: { has: obj => "disableTelemetry" in obj, get: obj => obj.disableTelemetry }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_verbose_decorators, { kind: "getter", name: "verbose", static: false, private: false, access: { has: obj => "verbose" in obj, get: obj => obj.verbose }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_logExtensionHostCommunication_decorators, { kind: "getter", name: "logExtensionHostCommunication", static: false, private: false, access: { has: obj => "logExtensionHostCommunication" in obj, get: obj => obj.logExtensionHostCommunication }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_skipReleaseNotes_decorators, { kind: "getter", name: "skipReleaseNotes", static: false, private: false, access: { has: obj => "skipReleaseNotes" in obj, get: obj => obj.skipReleaseNotes }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_skipWelcome_decorators, { kind: "getter", name: "skipWelcome", static: false, private: false, access: { has: obj => "skipWelcome" in obj, get: obj => obj.skipWelcome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_disableWorkspaceTrust_decorators, { kind: "getter", name: "disableWorkspaceTrust", static: false, private: false, access: { has: obj => "disableWorkspaceTrust" in obj, get: obj => obj.disableWorkspaceTrust }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_profile_decorators, { kind: "getter", name: "profile", static: false, private: false, access: { has: obj => "profile" in obj, get: obj => obj.profile }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_editSessionId_decorators, { kind: "getter", name: "editSessionId", static: false, private: false, access: { has: obj => "editSessionId" in obj, get: obj => obj.editSessionId }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_filesToOpenOrCreate_decorators, { kind: "getter", name: "filesToOpenOrCreate", static: false, private: false, access: { has: obj => "filesToOpenOrCreate" in obj, get: obj => obj.filesToOpenOrCreate }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_filesToDiff_decorators, { kind: "getter", name: "filesToDiff", static: false, private: false, access: { has: obj => "filesToDiff" in obj, get: obj => obj.filesToDiff }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_filesToMerge_decorators, { kind: "getter", name: "filesToMerge", static: false, private: false, access: { has: obj => "filesToMerge" in obj, get: obj => obj.filesToMerge }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        workspaceId = __runInitializers(this, _instanceExtraInitializers);
        logsHome;
        options;
        productService;
        get remoteAuthority() { return this.options.remoteAuthority; }
        get expectsResolverExtension() {
            return !!this.options.remoteAuthority?.includes('+') && !this.options.webSocketFactory;
        }
        get isBuilt() { return !!this.productService.commit; }
        get logLevel() {
            const logLevelFromPayload = this.payload?.get('logLevel');
            if (logLevelFromPayload) {
                return logLevelFromPayload.split(',').find(entry => !EXTENSION_IDENTIFIER_WITH_LOG_REGEX.test(entry));
            }
            return this.options.developmentOptions?.logLevel !== undefined ? LogLevelToString(this.options.developmentOptions?.logLevel) : undefined;
        }
        get extensionLogLevel() {
            const logLevelFromPayload = this.payload?.get('logLevel');
            if (logLevelFromPayload) {
                const result = [];
                for (const entry of logLevelFromPayload.split(',')) {
                    const matches = EXTENSION_IDENTIFIER_WITH_LOG_REGEX.exec(entry);
                    if (matches && matches[1] && matches[2]) {
                        result.push([matches[1], matches[2]]);
                    }
                }
                return result.length ? result : undefined;
            }
            return this.options.developmentOptions?.extensionLogLevel !== undefined ? this.options.developmentOptions?.extensionLogLevel.map(([extension, logLevel]) => ([extension, LogLevelToString(logLevel)])) : undefined;
        }
        get profDurationMarkers() {
            const profDurationMarkersFromPayload = this.payload?.get('profDurationMarkers');
            if (profDurationMarkersFromPayload) {
                const result = [];
                for (const entry of profDurationMarkersFromPayload.split(',')) {
                    result.push(entry);
                }
                return result.length === 2 ? result : undefined;
            }
            return undefined;
        }
        get windowLogsPath() { return this.logsHome; }
        get logFile() { return joinPath(this.windowLogsPath, 'window.log'); }
        get userRoamingDataHome() { return URI.file('/User').with({ scheme: Schemas.vscodeUserData }); }
        get argvResource() { return joinPath(this.userRoamingDataHome, 'argv.json'); }
        get cacheHome() { return joinPath(this.userRoamingDataHome, 'caches'); }
        get workspaceStorageHome() { return joinPath(this.userRoamingDataHome, 'workspaceStorage'); }
        get localHistoryHome() { return joinPath(this.userRoamingDataHome, 'History'); }
        get stateResource() { return joinPath(this.userRoamingDataHome, 'State', 'storage.json'); }
        /**
         * In Web every workspace can potentially have scoped user-data
         * and/or extensions and if Sync state is shared then it can make
         * Sync error prone - say removing extensions from another workspace.
         * Hence scope Sync state per workspace. Sync scoped to a workspace
         * is capable of handling opening same workspace in multiple windows.
         */
        get userDataSyncHome() { return joinPath(this.userRoamingDataHome, 'sync', this.workspaceId); }
        get sync() { return undefined; }
        get keyboardLayoutResource() { return joinPath(this.userRoamingDataHome, 'keyboardLayout.json'); }
        get untitledWorkspacesHome() { return joinPath(this.userRoamingDataHome, 'Workspaces'); }
        get serviceMachineIdResource() { return joinPath(this.userRoamingDataHome, 'machineid'); }
        get extHostLogsPath() { return joinPath(this.logsHome, 'exthost'); }
        extensionHostDebugEnvironment = undefined;
        get debugExtensionHost() {
            if (!this.extensionHostDebugEnvironment) {
                this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
            }
            return this.extensionHostDebugEnvironment.params;
        }
        get isExtensionDevelopment() {
            if (!this.extensionHostDebugEnvironment) {
                this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
            }
            return this.extensionHostDebugEnvironment.isExtensionDevelopment;
        }
        get extensionDevelopmentLocationURI() {
            if (!this.extensionHostDebugEnvironment) {
                this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
            }
            return this.extensionHostDebugEnvironment.extensionDevelopmentLocationURI;
        }
        get extensionDevelopmentLocationKind() {
            if (!this.extensionHostDebugEnvironment) {
                this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
            }
            return this.extensionHostDebugEnvironment.extensionDevelopmentKind;
        }
        get extensionTestsLocationURI() {
            if (!this.extensionHostDebugEnvironment) {
                this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
            }
            return this.extensionHostDebugEnvironment.extensionTestsLocationURI;
        }
        get extensionEnabledProposedApi() {
            if (!this.extensionHostDebugEnvironment) {
                this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
            }
            return this.extensionHostDebugEnvironment.extensionEnabledProposedApi;
        }
        get debugRenderer() {
            if (!this.extensionHostDebugEnvironment) {
                this.extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
            }
            return this.extensionHostDebugEnvironment.debugRenderer;
        }
        get enableSmokeTestDriver() { return this.options.developmentOptions?.enableSmokeTestDriver; }
        get disableExtensions() { return this.payload?.get('disableExtensions') === 'true'; }
        get enableExtensions() { return this.options.enabledExtensions; }
        get webviewExternalEndpoint() {
            const endpoint = this.options.webviewEndpoint
                || this.productService.webviewContentExternalBaseUrlTemplate
                || 'https://{{uuid}}.vscode-cdn.net/{{quality}}/{{commit}}/out/vs/workbench/contrib/webview/browser/pre/';
            const webviewExternalEndpointCommit = this.payload?.get('webviewExternalEndpointCommit');
            return endpoint
                .replace('{{commit}}', webviewExternalEndpointCommit ?? this.productService.commit ?? 'ef65ac1ba57f57f2a3961bfe94aa20481caca4c6')
                .replace('{{quality}}', (webviewExternalEndpointCommit ? 'insider' : this.productService.quality) ?? 'insider');
        }
        get extensionTelemetryLogResource() { return joinPath(this.logsHome, 'extensionTelemetry.log'); }
        get disableTelemetry() { return false; }
        get verbose() { return this.payload?.get('verbose') === 'true'; }
        get logExtensionHostCommunication() { return this.payload?.get('logExtensionHostCommunication') === 'true'; }
        get skipReleaseNotes() { return this.payload?.get('skipReleaseNotes') === 'true'; }
        get skipWelcome() { return this.payload?.get('skipWelcome') === 'true'; }
        get disableWorkspaceTrust() { return !this.options.enableWorkspaceTrust; }
        get profile() { return this.payload?.get('profile'); }
        get editSessionId() { return this.options.editSessionId; }
        payload;
        constructor(workspaceId, logsHome, options, productService) {
            this.workspaceId = workspaceId;
            this.logsHome = logsHome;
            this.options = options;
            this.productService = productService;
            if (options.workspaceProvider && Array.isArray(options.workspaceProvider.payload)) {
                try {
                    this.payload = new Map(options.workspaceProvider.payload);
                }
                catch (error) {
                    onUnexpectedError(error); // possible invalid payload for map
                }
            }
        }
        resolveExtensionHostDebugEnvironment() {
            const extensionHostDebugEnvironment = {
                params: {
                    port: null,
                    break: false
                },
                debugRenderer: false,
                isExtensionDevelopment: false,
                extensionDevelopmentLocationURI: undefined,
                extensionDevelopmentKind: undefined
            };
            // Fill in selected extra environmental properties
            if (this.payload) {
                for (const [key, value] of this.payload) {
                    switch (key) {
                        case 'extensionDevelopmentPath':
                            if (!extensionHostDebugEnvironment.extensionDevelopmentLocationURI) {
                                extensionHostDebugEnvironment.extensionDevelopmentLocationURI = [];
                            }
                            extensionHostDebugEnvironment.extensionDevelopmentLocationURI.push(URI.parse(value));
                            extensionHostDebugEnvironment.isExtensionDevelopment = true;
                            break;
                        case 'extensionDevelopmentKind':
                            extensionHostDebugEnvironment.extensionDevelopmentKind = [value];
                            break;
                        case 'extensionTestsPath':
                            extensionHostDebugEnvironment.extensionTestsLocationURI = URI.parse(value);
                            break;
                        case 'debugRenderer':
                            extensionHostDebugEnvironment.debugRenderer = value === 'true';
                            break;
                        case 'debugId':
                            extensionHostDebugEnvironment.params.debugId = value;
                            break;
                        case 'inspect-brk-extensions':
                            extensionHostDebugEnvironment.params.port = parseInt(value);
                            extensionHostDebugEnvironment.params.break = true;
                            break;
                        case 'inspect-extensions':
                            extensionHostDebugEnvironment.params.port = parseInt(value);
                            break;
                        case 'enableProposedApi':
                            extensionHostDebugEnvironment.extensionEnabledProposedApi = [];
                            break;
                    }
                }
            }
            const developmentOptions = this.options.developmentOptions;
            if (developmentOptions && !extensionHostDebugEnvironment.isExtensionDevelopment) {
                if (developmentOptions.extensions?.length) {
                    extensionHostDebugEnvironment.extensionDevelopmentLocationURI = developmentOptions.extensions.map(e => URI.revive(e));
                    extensionHostDebugEnvironment.isExtensionDevelopment = true;
                }
                if (developmentOptions.extensionTestsPath) {
                    extensionHostDebugEnvironment.extensionTestsLocationURI = URI.revive(developmentOptions.extensionTestsPath);
                }
            }
            return extensionHostDebugEnvironment;
        }
        get filesToOpenOrCreate() {
            if (this.payload) {
                const fileToOpen = this.payload.get('openFile');
                if (fileToOpen) {
                    const fileUri = URI.parse(fileToOpen);
                    // Support: --goto parameter to open on line/col
                    if (this.payload.has('gotoLineMode')) {
                        const pathColumnAware = parseLineAndColumnAware(fileUri.path);
                        return [{
                                fileUri: fileUri.with({ path: pathColumnAware.path }),
                                options: {
                                    selection: !isUndefined(pathColumnAware.line) ? { startLineNumber: pathColumnAware.line, startColumn: pathColumnAware.column || 1 } : undefined
                                }
                            }];
                    }
                    return [{ fileUri }];
                }
            }
            return undefined;
        }
        get filesToDiff() {
            if (this.payload) {
                const fileToDiffPrimary = this.payload.get('diffFilePrimary');
                const fileToDiffSecondary = this.payload.get('diffFileSecondary');
                if (fileToDiffPrimary && fileToDiffSecondary) {
                    return [
                        { fileUri: URI.parse(fileToDiffSecondary) },
                        { fileUri: URI.parse(fileToDiffPrimary) }
                    ];
                }
            }
            return undefined;
        }
        get filesToMerge() {
            if (this.payload) {
                const fileToMerge1 = this.payload.get('mergeFile1');
                const fileToMerge2 = this.payload.get('mergeFile2');
                const fileToMergeBase = this.payload.get('mergeFileBase');
                const fileToMergeResult = this.payload.get('mergeFileResult');
                if (fileToMerge1 && fileToMerge2 && fileToMergeBase && fileToMergeResult) {
                    return [
                        { fileUri: URI.parse(fileToMerge1) },
                        { fileUri: URI.parse(fileToMerge2) },
                        { fileUri: URI.parse(fileToMergeBase) },
                        { fileUri: URI.parse(fileToMergeResult) }
                    ];
                }
            }
            return undefined;
        }
    };
})();
export { BrowserWorkbenchEnvironmentService };
