/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { refineServiceDecorator } from '../../../../platform/instantiation/common/instantiation.js';
export const FOLDER_CONFIG_FOLDER_NAME = '.vscode';
export const FOLDER_SETTINGS_NAME = 'settings';
export const FOLDER_SETTINGS_PATH = `${FOLDER_CONFIG_FOLDER_NAME}/${FOLDER_SETTINGS_NAME}.json`;
export const defaultSettingsSchemaId = 'vscode://schemas/settings/default';
export const userSettingsSchemaId = 'vscode://schemas/settings/user';
export const profileSettingsSchemaId = 'vscode://schemas/settings/profile';
export const machineSettingsSchemaId = 'vscode://schemas/settings/machine';
export const workspaceSettingsSchemaId = 'vscode://schemas/settings/workspace';
export const folderSettingsSchemaId = 'vscode://schemas/settings/folder';
export const launchSchemaId = 'vscode://schemas/launch';
export const tasksSchemaId = 'vscode://schemas/tasks';
export const mcpSchemaId = 'vscode://schemas/mcp';
export const APPLICATION_SCOPES = [1 /* ConfigurationScope.APPLICATION */, 3 /* ConfigurationScope.APPLICATION_MACHINE */];
export const PROFILE_SCOPES = [2 /* ConfigurationScope.MACHINE */, 4 /* ConfigurationScope.WINDOW */, 5 /* ConfigurationScope.RESOURCE */, 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */, 7 /* ConfigurationScope.MACHINE_OVERRIDABLE */];
export const LOCAL_MACHINE_PROFILE_SCOPES = [4 /* ConfigurationScope.WINDOW */, 5 /* ConfigurationScope.RESOURCE */, 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */];
export const LOCAL_MACHINE_SCOPES = [1 /* ConfigurationScope.APPLICATION */, ...LOCAL_MACHINE_PROFILE_SCOPES];
export const REMOTE_MACHINE_SCOPES = [2 /* ConfigurationScope.MACHINE */, 3 /* ConfigurationScope.APPLICATION_MACHINE */, 4 /* ConfigurationScope.WINDOW */, 5 /* ConfigurationScope.RESOURCE */, 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */, 7 /* ConfigurationScope.MACHINE_OVERRIDABLE */];
export const WORKSPACE_SCOPES = [4 /* ConfigurationScope.WINDOW */, 5 /* ConfigurationScope.RESOURCE */, 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */, 7 /* ConfigurationScope.MACHINE_OVERRIDABLE */];
export const FOLDER_SCOPES = [5 /* ConfigurationScope.RESOURCE */, 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */, 7 /* ConfigurationScope.MACHINE_OVERRIDABLE */];
export const TASKS_CONFIGURATION_KEY = 'tasks';
export const LAUNCH_CONFIGURATION_KEY = 'launch';
export const MCP_CONFIGURATION_KEY = 'mcp';
export const WORKSPACE_STANDALONE_CONFIGURATIONS = Object.create(null);
WORKSPACE_STANDALONE_CONFIGURATIONS[TASKS_CONFIGURATION_KEY] = `${FOLDER_CONFIG_FOLDER_NAME}/${TASKS_CONFIGURATION_KEY}.json`;
WORKSPACE_STANDALONE_CONFIGURATIONS[LAUNCH_CONFIGURATION_KEY] = `${FOLDER_CONFIG_FOLDER_NAME}/${LAUNCH_CONFIGURATION_KEY}.json`;
WORKSPACE_STANDALONE_CONFIGURATIONS[MCP_CONFIGURATION_KEY] = `${FOLDER_CONFIG_FOLDER_NAME}/${MCP_CONFIGURATION_KEY}.json`;
export const USER_STANDALONE_CONFIGURATIONS = Object.create(null);
USER_STANDALONE_CONFIGURATIONS[TASKS_CONFIGURATION_KEY] = `${TASKS_CONFIGURATION_KEY}.json`;
USER_STANDALONE_CONFIGURATIONS[MCP_CONFIGURATION_KEY] = `${MCP_CONFIGURATION_KEY}.json`;
export const IWorkbenchConfigurationService = refineServiceDecorator(IConfigurationService);
export const TASKS_DEFAULT = '{\n\t\"version\": \"2.0.0\",\n\t\"tasks\": []\n}';
export const APPLY_ALL_PROFILES_SETTING = 'workbench.settings.applyToAllProfiles';
