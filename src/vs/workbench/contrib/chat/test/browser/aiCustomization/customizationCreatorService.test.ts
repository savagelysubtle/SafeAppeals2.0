/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IAICustomizationWorkspaceService } from '../../../common/aiCustomizationWorkspaceService.js';
import { PromptFileSource, PromptsType } from '../../../common/promptSyntax/promptTypes.js';
import { IResolvedPromptSourceFolder, SAFE_APPEALS_AGENTS_SOURCE_FOLDER, SAFE_APPEALS_USER_AGENTS_SOURCE_FOLDER } from '../../../common/promptSyntax/config/promptFileLocations.js';
import { IPromptsService, PromptsStorage } from '../../../common/promptSyntax/service/promptsService.js';
import { resolveUserTargetDirectory, resolveWorkspaceTargetDirectory } from '../../../browser/aiCustomization/customizationCreatorService.js';
import { filterResolvedFoldersForCreatePicker, getAgentCatalogSourceBadge } from '../../../browser/aiCustomization/promptsServiceCustomizationItemProvider.js';

suite('customizationCreatorService', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	function createMockWorkspaceService(projectRoot?: URI): Pick<IAICustomizationWorkspaceService, 'getActiveProjectRoot'> {
		return {
			getActiveProjectRoot: () => projectRoot,
		};
	}

	function createMockPromptsService(resolvedFolders: readonly IResolvedPromptSourceFolder[]): Pick<IPromptsService, 'getResolvedSourceFolders'> {
		return {
			getResolvedSourceFolders: () => Promise.resolve(resolvedFolders),
		};
	}

	suite('resolveWorkspaceTargetDirectory', () => {

		test('returns .safeAppeals/agents for workspace agent create', () => {
			const projectRoot = URI.file('/workspace/project');
			const result = resolveWorkspaceTargetDirectory(
				createMockWorkspaceService(projectRoot) as IAICustomizationWorkspaceService,
				PromptsType.agent,
			);
			assert.strictEqual(result?.path, `/workspace/project/${SAFE_APPEALS_AGENTS_SOURCE_FOLDER}`);
		});

		test('returns undefined when no active project root', () => {
			const result = resolveWorkspaceTargetDirectory(
				createMockWorkspaceService() as IAICustomizationWorkspaceService,
				PromptsType.agent,
			);
			assert.strictEqual(result, undefined);
		});
	});

	suite('resolveUserTargetDirectory', () => {

		test('returns first user folder from getResolvedSourceFolders for agents', async () => {
			const safeAppealsUser = URI.file('/home/user/.safeAppeals/agents');
			const result = await resolveUserTargetDirectory(
				createMockPromptsService([
					{
						uri: URI.file('/workspace/.safeAppeals/agents'),
						searchRoot: URI.file('/workspace/.safeAppeals/agents'),
						filePattern: undefined,
						source: PromptFileSource.SafeAppealsWorkspace,
						storage: PromptsStorage.local,
						displayPath: SAFE_APPEALS_AGENTS_SOURCE_FOLDER,
						isDefault: true,
					},
					{
						uri: safeAppealsUser,
						searchRoot: safeAppealsUser,
						filePattern: undefined,
						source: PromptFileSource.SafeAppealsPersonal,
						storage: PromptsStorage.user,
						displayPath: SAFE_APPEALS_USER_AGENTS_SOURCE_FOLDER,
						isDefault: true,
					},
					{
						uri: URI.file('/home/user/.copilot/agents'),
						searchRoot: URI.file('/home/user/.copilot/agents'),
						filePattern: undefined,
						source: PromptFileSource.CopilotPersonal,
						storage: PromptsStorage.user,
						displayPath: '~/.copilot/agents',
						isDefault: true,
					},
				]) as IPromptsService,
				PromptsType.agent,
			);
			assert.strictEqual(result?.path, '/home/user/.safeAppeals/agents');
		});

		test('returns undefined when no user folder exists', async () => {
			const result = await resolveUserTargetDirectory(
				createMockPromptsService([
					{
						uri: URI.file('/workspace/.safeAppeals/agents'),
						searchRoot: URI.file('/workspace/.safeAppeals/agents'),
						filePattern: undefined,
						source: PromptFileSource.SafeAppealsWorkspace,
						storage: PromptsStorage.local,
						displayPath: SAFE_APPEALS_AGENTS_SOURCE_FOLDER,
						isDefault: true,
					},
				]) as IPromptsService,
				PromptsType.agent,
			);
			assert.strictEqual(result, undefined);
		});
	});

	suite('filterResolvedFoldersForCreatePicker', () => {

		const workspaceSkill: IResolvedPromptSourceFolder = {
			uri: URI.file('/workspace/.github/skills'),
			searchRoot: URI.file('/workspace/.github/skills'),
			filePattern: undefined,
			source: PromptFileSource.GitHubWorkspace,
			storage: PromptsStorage.local,
			displayPath: '.github/skills',
			isDefault: true,
		};
		const userSkill: IResolvedPromptSourceFolder = {
			uri: URI.file('/home/user/.copilot/skills'),
			searchRoot: URI.file('/home/user/.copilot/skills'),
			filePattern: undefined,
			source: PromptFileSource.CopilotPersonal,
			storage: PromptsStorage.user,
			displayPath: '~/.copilot/skills',
			isDefault: true,
		};
		const workspaceAgent: IResolvedPromptSourceFolder = {
			uri: URI.file('/workspace/.safeAppeals/agents'),
			searchRoot: URI.file('/workspace/.safeAppeals/agents'),
			filePattern: undefined,
			source: PromptFileSource.SafeAppealsWorkspace,
			storage: PromptsStorage.local,
			displayPath: SAFE_APPEALS_AGENTS_SOURCE_FOLDER,
			isDefault: true,
		};
		const userAgent: IResolvedPromptSourceFolder = {
			uri: URI.file('/home/user/.safeAppeals/agents'),
			searchRoot: URI.file('/home/user/.safeAppeals/agents'),
			filePattern: undefined,
			source: PromptFileSource.SafeAppealsPersonal,
			storage: PromptsStorage.user,
			displayPath: SAFE_APPEALS_USER_AGENTS_SOURCE_FOLDER,
			isDefault: true,
		};

		test('omits user skill folders from create picker', () => {
			assert.deepStrictEqual(
				filterResolvedFoldersForCreatePicker(PromptsType.skill, [workspaceSkill, userSkill]).map(f => f.displayPath),
				['.github/skills'],
			);
		});

		test('keeps SafeAppeals user and workspace agent create targets', () => {
			assert.deepStrictEqual(
				filterResolvedFoldersForCreatePicker(PromptsType.agent, [workspaceAgent, userAgent]).map(f => f.displayPath),
				[SAFE_APPEALS_AGENTS_SOURCE_FOLDER, SAFE_APPEALS_USER_AGENTS_SOURCE_FOLDER],
			);
		});
	});

	suite('getAgentCatalogSourceBadge', () => {
		test('badges compatibility agents and leaves SafeAppeals agents unmarked', () => {
			const compat = getAgentCatalogSourceBadge(URI.file('/workspace/.github/agents/reviewer.agent.md'));
			assert.deepStrictEqual(
				{
					compatBadge: compat?.badge,
					hasCompatTooltip: typeof compat?.badgeTooltip === 'string' && compat.badgeTooltip.includes('compatibility'),
					safeAppeals: getAgentCatalogSourceBadge(URI.file('/workspace/.safeAppeals/agents/research.agent.md')),
				},
				{
					compatBadge: 'Compat',
					hasCompatTooltip: true,
					safeAppeals: undefined,
				},
			);
		});
	});
});
