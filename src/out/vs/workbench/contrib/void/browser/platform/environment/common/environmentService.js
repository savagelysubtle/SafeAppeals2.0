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
import { toLocalISOString } from '../../../base/common/date.js';
import { memoize } from '../../../base/common/decorators.js';
import { FileAccess, Schemas } from '../../../base/common/network.js';
import { dirname, join, normalize, resolve } from '../../../base/common/path.js';
import { env } from '../../../base/common/process.js';
import { joinPath } from '../../../base/common/resources.js';
import { URI } from '../../../base/common/uri.js';
export const EXTENSION_IDENTIFIER_WITH_LOG_REGEX = /^([^.]+\..+)[:=](.+)$/;
let AbstractNativeEnvironmentService = (() => {
    let _instanceExtraInitializers = [];
    let _get_appRoot_decorators;
    let _get_userHome_decorators;
    let _get_userDataPath_decorators;
    let _get_appSettingsHome_decorators;
    let _get_tmpDir_decorators;
    let _get_cacheHome_decorators;
    let _get_stateResource_decorators;
    let _get_userRoamingDataHome_decorators;
    let _get_userDataSyncHome_decorators;
    let _get_sync_decorators;
    let _get_machineSettingsResource_decorators;
    let _get_workspaceStorageHome_decorators;
    let _get_localHistoryHome_decorators;
    let _get_keyboardLayoutResource_decorators;
    let _get_argvResource_decorators;
    let _get_isExtensionDevelopment_decorators;
    let _get_untitledWorkspacesHome_decorators;
    let _get_builtinExtensionsPath_decorators;
    let _get_extensionsPath_decorators;
    let _get_extensionDevelopmentLocationURI_decorators;
    let _get_extensionDevelopmentKind_decorators;
    let _get_extensionTestsLocationURI_decorators;
    let _get_debugExtensionHost_decorators;
    let _get_logLevel_decorators;
    let _get_extensionLogLevel_decorators;
    let _get_serviceMachineIdResource_decorators;
    let _get_disableTelemetry_decorators;
    let _get_disableWorkspaceTrust_decorators;
    let _get_useInMemorySecretStorage_decorators;
    let _get_policyFile_decorators;
    return class AbstractNativeEnvironmentService {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _get_appRoot_decorators = [memoize];
            _get_userHome_decorators = [memoize];
            _get_userDataPath_decorators = [memoize];
            _get_appSettingsHome_decorators = [memoize];
            _get_tmpDir_decorators = [memoize];
            _get_cacheHome_decorators = [memoize];
            _get_stateResource_decorators = [memoize];
            _get_userRoamingDataHome_decorators = [memoize];
            _get_userDataSyncHome_decorators = [memoize];
            _get_sync_decorators = [memoize];
            _get_machineSettingsResource_decorators = [memoize];
            _get_workspaceStorageHome_decorators = [memoize];
            _get_localHistoryHome_decorators = [memoize];
            _get_keyboardLayoutResource_decorators = [memoize];
            _get_argvResource_decorators = [memoize];
            _get_isExtensionDevelopment_decorators = [memoize];
            _get_untitledWorkspacesHome_decorators = [memoize];
            _get_builtinExtensionsPath_decorators = [memoize];
            _get_extensionsPath_decorators = [memoize];
            _get_extensionDevelopmentLocationURI_decorators = [memoize];
            _get_extensionDevelopmentKind_decorators = [memoize];
            _get_extensionTestsLocationURI_decorators = [memoize];
            _get_debugExtensionHost_decorators = [memoize];
            _get_logLevel_decorators = [memoize];
            _get_extensionLogLevel_decorators = [memoize];
            _get_serviceMachineIdResource_decorators = [memoize];
            _get_disableTelemetry_decorators = [memoize];
            _get_disableWorkspaceTrust_decorators = [memoize];
            _get_useInMemorySecretStorage_decorators = [memoize];
            _get_policyFile_decorators = [memoize];
            __esDecorate(this, null, _get_appRoot_decorators, { kind: "getter", name: "appRoot", static: false, private: false, access: { has: obj => "appRoot" in obj, get: obj => obj.appRoot }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_userHome_decorators, { kind: "getter", name: "userHome", static: false, private: false, access: { has: obj => "userHome" in obj, get: obj => obj.userHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_userDataPath_decorators, { kind: "getter", name: "userDataPath", static: false, private: false, access: { has: obj => "userDataPath" in obj, get: obj => obj.userDataPath }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_appSettingsHome_decorators, { kind: "getter", name: "appSettingsHome", static: false, private: false, access: { has: obj => "appSettingsHome" in obj, get: obj => obj.appSettingsHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_tmpDir_decorators, { kind: "getter", name: "tmpDir", static: false, private: false, access: { has: obj => "tmpDir" in obj, get: obj => obj.tmpDir }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_cacheHome_decorators, { kind: "getter", name: "cacheHome", static: false, private: false, access: { has: obj => "cacheHome" in obj, get: obj => obj.cacheHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_stateResource_decorators, { kind: "getter", name: "stateResource", static: false, private: false, access: { has: obj => "stateResource" in obj, get: obj => obj.stateResource }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_userRoamingDataHome_decorators, { kind: "getter", name: "userRoamingDataHome", static: false, private: false, access: { has: obj => "userRoamingDataHome" in obj, get: obj => obj.userRoamingDataHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_userDataSyncHome_decorators, { kind: "getter", name: "userDataSyncHome", static: false, private: false, access: { has: obj => "userDataSyncHome" in obj, get: obj => obj.userDataSyncHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_sync_decorators, { kind: "getter", name: "sync", static: false, private: false, access: { has: obj => "sync" in obj, get: obj => obj.sync }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_machineSettingsResource_decorators, { kind: "getter", name: "machineSettingsResource", static: false, private: false, access: { has: obj => "machineSettingsResource" in obj, get: obj => obj.machineSettingsResource }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_workspaceStorageHome_decorators, { kind: "getter", name: "workspaceStorageHome", static: false, private: false, access: { has: obj => "workspaceStorageHome" in obj, get: obj => obj.workspaceStorageHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_localHistoryHome_decorators, { kind: "getter", name: "localHistoryHome", static: false, private: false, access: { has: obj => "localHistoryHome" in obj, get: obj => obj.localHistoryHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_keyboardLayoutResource_decorators, { kind: "getter", name: "keyboardLayoutResource", static: false, private: false, access: { has: obj => "keyboardLayoutResource" in obj, get: obj => obj.keyboardLayoutResource }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_argvResource_decorators, { kind: "getter", name: "argvResource", static: false, private: false, access: { has: obj => "argvResource" in obj, get: obj => obj.argvResource }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_isExtensionDevelopment_decorators, { kind: "getter", name: "isExtensionDevelopment", static: false, private: false, access: { has: obj => "isExtensionDevelopment" in obj, get: obj => obj.isExtensionDevelopment }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_untitledWorkspacesHome_decorators, { kind: "getter", name: "untitledWorkspacesHome", static: false, private: false, access: { has: obj => "untitledWorkspacesHome" in obj, get: obj => obj.untitledWorkspacesHome }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_builtinExtensionsPath_decorators, { kind: "getter", name: "builtinExtensionsPath", static: false, private: false, access: { has: obj => "builtinExtensionsPath" in obj, get: obj => obj.builtinExtensionsPath }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_extensionsPath_decorators, { kind: "getter", name: "extensionsPath", static: false, private: false, access: { has: obj => "extensionsPath" in obj, get: obj => obj.extensionsPath }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_extensionDevelopmentLocationURI_decorators, { kind: "getter", name: "extensionDevelopmentLocationURI", static: false, private: false, access: { has: obj => "extensionDevelopmentLocationURI" in obj, get: obj => obj.extensionDevelopmentLocationURI }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_extensionDevelopmentKind_decorators, { kind: "getter", name: "extensionDevelopmentKind", static: false, private: false, access: { has: obj => "extensionDevelopmentKind" in obj, get: obj => obj.extensionDevelopmentKind }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_extensionTestsLocationURI_decorators, { kind: "getter", name: "extensionTestsLocationURI", static: false, private: false, access: { has: obj => "extensionTestsLocationURI" in obj, get: obj => obj.extensionTestsLocationURI }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_debugExtensionHost_decorators, { kind: "getter", name: "debugExtensionHost", static: false, private: false, access: { has: obj => "debugExtensionHost" in obj, get: obj => obj.debugExtensionHost }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_logLevel_decorators, { kind: "getter", name: "logLevel", static: false, private: false, access: { has: obj => "logLevel" in obj, get: obj => obj.logLevel }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_extensionLogLevel_decorators, { kind: "getter", name: "extensionLogLevel", static: false, private: false, access: { has: obj => "extensionLogLevel" in obj, get: obj => obj.extensionLogLevel }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_serviceMachineIdResource_decorators, { kind: "getter", name: "serviceMachineIdResource", static: false, private: false, access: { has: obj => "serviceMachineIdResource" in obj, get: obj => obj.serviceMachineIdResource }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_disableTelemetry_decorators, { kind: "getter", name: "disableTelemetry", static: false, private: false, access: { has: obj => "disableTelemetry" in obj, get: obj => obj.disableTelemetry }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_disableWorkspaceTrust_decorators, { kind: "getter", name: "disableWorkspaceTrust", static: false, private: false, access: { has: obj => "disableWorkspaceTrust" in obj, get: obj => obj.disableWorkspaceTrust }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_useInMemorySecretStorage_decorators, { kind: "getter", name: "useInMemorySecretStorage", static: false, private: false, access: { has: obj => "useInMemorySecretStorage" in obj, get: obj => obj.useInMemorySecretStorage }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _get_policyFile_decorators, { kind: "getter", name: "policyFile", static: false, private: false, access: { has: obj => "policyFile" in obj, get: obj => obj.policyFile }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        _args = __runInitializers(this, _instanceExtraInitializers);
        paths;
        productService;
        get appRoot() { return dirname(FileAccess.asFileUri('').fsPath); }
        get userHome() { return URI.file(this.paths.homeDir); }
        get userDataPath() { return this.paths.userDataDir; }
        get appSettingsHome() { return URI.file(join(this.userDataPath, 'User')); }
        get tmpDir() { return URI.file(this.paths.tmpDir); }
        get cacheHome() { return URI.file(this.userDataPath); }
        get stateResource() { return joinPath(this.appSettingsHome, 'globalStorage', 'storage.json'); }
        get userRoamingDataHome() { return this.appSettingsHome.with({ scheme: Schemas.vscodeUserData }); }
        get userDataSyncHome() { return joinPath(this.appSettingsHome, 'sync'); }
        get logsHome() {
            if (!this.args.logsPath) {
                const key = toLocalISOString(new Date()).replace(/-|:|\.\d+Z$/g, '');
                this.args.logsPath = join(this.userDataPath, 'logs', key);
            }
            return URI.file(this.args.logsPath);
        }
        get sync() { return this.args.sync; }
        get machineSettingsResource() { return joinPath(URI.file(join(this.userDataPath, 'Machine')), 'settings.json'); }
        get workspaceStorageHome() { return joinPath(this.appSettingsHome, 'workspaceStorage'); }
        get localHistoryHome() { return joinPath(this.appSettingsHome, 'History'); }
        get keyboardLayoutResource() { return joinPath(this.userRoamingDataHome, 'keyboardLayout.json'); }
        get argvResource() {
            const vscodePortable = env['VSCODE_PORTABLE'];
            if (vscodePortable) {
                return URI.file(join(vscodePortable, 'argv.json'));
            }
            return joinPath(this.userHome, this.productService.dataFolderName, 'argv.json');
        }
        get isExtensionDevelopment() { return !!this.args.extensionDevelopmentPath; }
        get untitledWorkspacesHome() { return URI.file(join(this.userDataPath, 'Workspaces')); }
        get builtinExtensionsPath() {
            const cliBuiltinExtensionsDir = this.args['builtin-extensions-dir'];
            if (cliBuiltinExtensionsDir) {
                return resolve(cliBuiltinExtensionsDir);
            }
            return normalize(join(FileAccess.asFileUri('').fsPath, '..', 'extensions'));
        }
        get extensionsDownloadLocation() {
            const cliExtensionsDownloadDir = this.args['extensions-download-dir'];
            if (cliExtensionsDownloadDir) {
                return URI.file(resolve(cliExtensionsDownloadDir));
            }
            return URI.file(join(this.userDataPath, 'CachedExtensionVSIXs'));
        }
        get extensionsPath() {
            const cliExtensionsDir = this.args['extensions-dir'];
            if (cliExtensionsDir) {
                return resolve(cliExtensionsDir);
            }
            const vscodeExtensions = env['VSCODE_EXTENSIONS'];
            if (vscodeExtensions) {
                return vscodeExtensions;
            }
            const vscodePortable = env['VSCODE_PORTABLE'];
            if (vscodePortable) {
                return join(vscodePortable, 'extensions');
            }
            return joinPath(this.userHome, this.productService.dataFolderName, 'extensions').fsPath;
        }
        get extensionDevelopmentLocationURI() {
            const extensionDevelopmentPaths = this.args.extensionDevelopmentPath;
            if (Array.isArray(extensionDevelopmentPaths)) {
                return extensionDevelopmentPaths.map(extensionDevelopmentPath => {
                    if (/^[^:/?#]+?:\/\//.test(extensionDevelopmentPath)) {
                        return URI.parse(extensionDevelopmentPath);
                    }
                    return URI.file(normalize(extensionDevelopmentPath));
                });
            }
            return undefined;
        }
        get extensionDevelopmentKind() {
            return this.args.extensionDevelopmentKind?.map(kind => kind === 'ui' || kind === 'workspace' || kind === 'web' ? kind : 'workspace');
        }
        get extensionTestsLocationURI() {
            const extensionTestsPath = this.args.extensionTestsPath;
            if (extensionTestsPath) {
                if (/^[^:/?#]+?:\/\//.test(extensionTestsPath)) {
                    return URI.parse(extensionTestsPath);
                }
                return URI.file(normalize(extensionTestsPath));
            }
            return undefined;
        }
        get disableExtensions() {
            if (this.args['disable-extensions']) {
                return true;
            }
            const disableExtensions = this.args['disable-extension'];
            if (disableExtensions) {
                if (typeof disableExtensions === 'string') {
                    return [disableExtensions];
                }
                if (Array.isArray(disableExtensions) && disableExtensions.length > 0) {
                    return disableExtensions;
                }
            }
            return false;
        }
        get debugExtensionHost() { return parseExtensionHostDebugPort(this.args, this.isBuilt); }
        get debugRenderer() { return !!this.args.debugRenderer; }
        get isBuilt() { return !env['VSCODE_DEV']; }
        get verbose() { return !!this.args.verbose; }
        get logLevel() { return this.args.log?.find(entry => !EXTENSION_IDENTIFIER_WITH_LOG_REGEX.test(entry)); }
        get extensionLogLevel() {
            const result = [];
            for (const entry of this.args.log || []) {
                const matches = EXTENSION_IDENTIFIER_WITH_LOG_REGEX.exec(entry);
                if (matches && matches[1] && matches[2]) {
                    result.push([matches[1], matches[2]]);
                }
            }
            return result.length ? result : undefined;
        }
        get serviceMachineIdResource() { return joinPath(URI.file(this.userDataPath), 'machineid'); }
        get crashReporterId() { return this.args['crash-reporter-id']; }
        get crashReporterDirectory() { return this.args['crash-reporter-directory']; }
        get disableTelemetry() { return !!this.args['disable-telemetry']; }
        get disableWorkspaceTrust() { return !!this.args['disable-workspace-trust']; }
        get useInMemorySecretStorage() { return !!this.args['use-inmemory-secretstorage']; }
        get policyFile() {
            if (this.args['__enable-file-policy']) {
                const vscodePortable = env['VSCODE_PORTABLE'];
                if (vscodePortable) {
                    return URI.file(join(vscodePortable, 'policy.json'));
                }
                return joinPath(this.userHome, this.productService.dataFolderName, 'policy.json');
            }
            return undefined;
        }
        get editSessionId() { return this.args['editSessionId']; }
        get continueOn() {
            return this.args['continueOn'];
        }
        set continueOn(value) {
            this.args['continueOn'] = value;
        }
        get args() { return this._args; }
        constructor(_args, paths, productService) {
            this._args = _args;
            this.paths = paths;
            this.productService = productService;
        }
    };
})();
export { AbstractNativeEnvironmentService };
export function parseExtensionHostDebugPort(args, isBuilt) {
    return parseDebugParams(args['inspect-extensions'], args['inspect-brk-extensions'], 5870, isBuilt, args.debugId, args.extensionEnvironment);
}
export function parseDebugParams(debugArg, debugBrkArg, defaultBuildPort, isBuilt, debugId, environmentString) {
    const portStr = debugBrkArg || debugArg;
    const port = Number(portStr) || (!isBuilt ? defaultBuildPort : null);
    const brk = port ? Boolean(!!debugBrkArg) : false;
    let env;
    if (environmentString) {
        try {
            env = JSON.parse(environmentString);
        }
        catch {
            // ignore
        }
    }
    return { port, break: brk, debugId, env };
}
