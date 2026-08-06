/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { DEFAULT_AGENT_SOURCE_FOLDERS, getPromptFileType, getCleanPromptName, isInCompatAgentsFolder, isInSafeAppealsAgentsFolder, isPromptOrInstructionsFile, isSkillFilename, SAFE_APPEALS_AGENTS_SOURCE_FOLDER, SAFE_APPEALS_USER_AGENTS_SOURCE_FOLDER } from '../../../../common/promptSyntax/config/promptFileLocations.js';
import { PromptFileSource, PromptsType } from '../../../../common/promptSyntax/promptTypes.js';
import { PromptsStorage } from '../../../../common/promptSyntax/service/promptsService.js';

suite('promptFileLocations', function () {
	ensureNoDisposablesAreLeakedInTestSuite();

	suite('getPromptFileType', () => {
		test('.prompt.md files', () => {
			const uri = URI.file('/workspace/test.prompt.md');
			assert.strictEqual(getPromptFileType(uri), PromptsType.prompt);
		});

		test('.instructions.md files', () => {
			const uri = URI.file('/workspace/test.instructions.md');
			assert.strictEqual(getPromptFileType(uri), PromptsType.instructions);
		});

		test('.agent.md files', () => {
			const uri = URI.file('/workspace/test.agent.md');
			assert.strictEqual(getPromptFileType(uri), PromptsType.agent);
		});

		test('.chatmode.md files (legacy)', () => {
			const uri = URI.file('/workspace/test.chatmode.md');
			assert.strictEqual(getPromptFileType(uri), PromptsType.agent);
		});

		test('.md files in .github/agents/ folder should be recognized as agent files', () => {
			const uri = URI.file('/workspace/.github/agents/demonstrate.md');
			assert.strictEqual(getPromptFileType(uri), PromptsType.agent);
		});

		test('README.md in .github/agents/ should NOT be recognized as agent file', () => {
			const uri = URI.file('/workspace/.github/agents/README.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});

		test('.md files in .github/agents/ subfolder should NOT be recognized as agent files', () => {
			const uri = URI.file('/workspace/.github/agents/subfolder/test.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});

		test('.md files in .claude/agents/ subfolder should NOT be recognized as agent files', () => {
			const uri = URI.file('/workspace/.claude/agents/subfolder/test.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});

		test('.md files in ~/.copilot/agents/ subfolder should NOT be recognized as agent files', () => {
			const uri = URI.file('/home/user/.copilot/agents/subfolder/test.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});

		test('.md files in .claude/agents/ folder should be recognized as agent files', () => {
			const uri = URI.file('/workspace/.claude/agents/demonstrate.md');
			assert.strictEqual(getPromptFileType(uri), PromptsType.agent);
		});

		test('README.md in .claude/agents/ should NOT be recognized as agent file', () => {
			const uri = URI.file('/workspace/.claude/agents/README.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});

		test('.md files in ~/.copilot/agents/ folder should be recognized as agent files', () => {
			const uri = URI.file('/home/user/.copilot/agents/my-agent.md');
			assert.strictEqual(getPromptFileType(uri), PromptsType.agent);
		});

		test('README.md in ~/.copilot/agents/ should NOT be recognized as agent file', () => {
			const uri = URI.file('/home/user/.copilot/agents/README.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});

		test('.md files in .safeAppeals/agents/ folder should be recognized as agent files', () => {
			const uri = URI.file('/workspace/.safeAppeals/agents/demonstrate.md');
			assert.strictEqual(getPromptFileType(uri), PromptsType.agent);
		});

		test('README.md in .safeAppeals/agents/ should NOT be recognized as agent file', () => {
			const uri = URI.file('/workspace/.safeAppeals/agents/README.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});

		test('.md files in .safeAppeals/agents/ subfolder should NOT be recognized as agent files', () => {
			const uri = URI.file('/workspace/.safeAppeals/agents/subfolder/test.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});

		test('.md files in ~/.safeAppeals/agents/ folder should be recognized as agent files', () => {
			const uri = URI.file('/home/user/.safeAppeals/agents/my-agent.md');
			assert.strictEqual(getPromptFileType(uri), PromptsType.agent);
		});

		test('README.md in ~/.safeAppeals/agents/ should NOT be recognized as agent file', () => {
			const uri = URI.file('/home/user/.safeAppeals/agents/README.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});

		test('.md files in ~/.safeAppeals/agents/ subfolder should NOT be recognized as agent files', () => {
			const uri = URI.file('/home/user/.safeAppeals/agents/subfolder/test.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});

		test('.md files outside .github/agents/ should not be recognized as agent files', () => {
			const uri = URI.file('/workspace/test/foo.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});

		test('.md files in other .github/ subfolders should not be recognized as agent files', () => {
			const uri = URI.file('/workspace/.github/prompts/test.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});

		test('copilot-instructions.md should be recognized as instructions', () => {
			const uri = URI.file('/workspace/.github/copilot-instructions.md');
			assert.strictEqual(getPromptFileType(uri), PromptsType.instructions);
		});

		test('regular .md files should return undefined', () => {
			const uri = URI.file('/workspace/README.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});

		test('SKILL.md (uppercase) should be recognized as skill', () => {
			const uri = URI.file('/workspace/.github/skills/test/SKILL.md');
			assert.strictEqual(getPromptFileType(uri), PromptsType.skill);
		});

		test('skill.md (lowercase) should be recognized as skill', () => {
			const uri = URI.file('/workspace/.github/skills/test/skill.md');
			assert.strictEqual(getPromptFileType(uri), PromptsType.skill);
		});

		test('Skill.md (mixed case) should be recognized as skill', () => {
			const uri = URI.file('/workspace/.github/skills/test/Skill.md');
			assert.strictEqual(getPromptFileType(uri), PromptsType.skill);
		});

		// Note: getPromptFileType assumes the URI is from a valid prompt source folder.
		// Any .json file returns PromptsType.hook - the caller filters by folder.
		test('any .json file should be recognized as hook', () => {
			assert.strictEqual(getPromptFileType(URI.file('/workspace/.github/hooks/hooks.json')), PromptsType.hook);
			assert.strictEqual(getPromptFileType(URI.file('/workspace/.github/hooks/custom-hooks.json')), PromptsType.hook);
			assert.strictEqual(getPromptFileType(URI.file('/workspace/.claude/settings.json')), PromptsType.hook);
			assert.strictEqual(getPromptFileType(URI.file('/workspace/.claude/settings.local.json')), PromptsType.hook);
			assert.strictEqual(getPromptFileType(URI.file('/workspace/any/path/config.json')), PromptsType.hook);
		});

		test('.json files are case insensitive', () => {
			assert.strictEqual(getPromptFileType(URI.file('/workspace/.github/hooks/HOOKS.JSON')), PromptsType.hook);
			assert.strictEqual(getPromptFileType(URI.file('/workspace/.claude/SETTINGS.JSON')), PromptsType.hook);
		});

		test('non-json file in .github/hooks folder should NOT be recognized as hook', () => {
			const uri = URI.file('/workspace/.github/hooks/readme.md');
			assert.strictEqual(getPromptFileType(uri), undefined);
		});
	});

	suite('getCleanPromptName', () => {
		test('removes .prompt.md extension', () => {
			const uri = URI.file('/workspace/test.prompt.md');
			assert.strictEqual(getCleanPromptName(uri), 'test');
		});

		test('removes .instructions.md extension', () => {
			const uri = URI.file('/workspace/test.instructions.md');
			assert.strictEqual(getCleanPromptName(uri), 'test');
		});

		test('removes .agent.md extension', () => {
			const uri = URI.file('/workspace/test.agent.md');
			assert.strictEqual(getCleanPromptName(uri), 'test');
		});

		test('removes .chatmode.md extension (legacy)', () => {
			const uri = URI.file('/workspace/test.chatmode.md');
			assert.strictEqual(getCleanPromptName(uri), 'test');
		});

		test('removes .md extension for files in .github/agents/', () => {
			const uri = URI.file('/workspace/.github/agents/demonstrate.md');
			assert.strictEqual(getCleanPromptName(uri), 'demonstrate');
		});

		test('removes .md extension for files in .claude/agents/', () => {
			const uri = URI.file('/workspace/.claude/agents/claude-agent.md');
			assert.strictEqual(getCleanPromptName(uri), 'claude-agent');
		});

		test('removes .md extension for files in ~/.copilot/agents/', () => {
			const uri = URI.file('/home/user/.copilot/agents/my-agent.md');
			assert.strictEqual(getCleanPromptName(uri), 'my-agent');
		});

		test('removes .md extension for files in .safeAppeals/agents/', () => {
			const uri = URI.file('/workspace/.safeAppeals/agents/demonstrate.md');
			assert.strictEqual(getCleanPromptName(uri), 'demonstrate');
		});

		test('removes .md extension for files in ~/.safeAppeals/agents/', () => {
			const uri = URI.file('/home/user/.safeAppeals/agents/my-agent.md');
			assert.strictEqual(getCleanPromptName(uri), 'my-agent');
		});

		test('README.md in .github/agents/ should keep .md extension', () => {
			const uri = URI.file('/workspace/.github/agents/README.md');
			assert.strictEqual(getCleanPromptName(uri), 'README.md');
		});

		test('removes .md extension for copilot-instructions.md', () => {
			const uri = URI.file('/workspace/.github/copilot-instructions.md');
			assert.strictEqual(getCleanPromptName(uri), 'copilot-instructions');
		});

		test('keeps .md extension for regular files', () => {
			const uri = URI.file('/workspace/README.md');
			assert.strictEqual(getCleanPromptName(uri), 'README.md');
		});

		test('keeps full filename for files without known extensions', () => {
			const uri = URI.file('/workspace/test.txt');
			assert.strictEqual(getCleanPromptName(uri), 'test.txt');
		});

		test('returns folder name for SKILL.md (uppercase)', () => {
			const uri = URI.file('/workspace/.github/skills/test/SKILL.md');
			assert.strictEqual(getCleanPromptName(uri), 'test');
		});

		test('returns folder name for skill.md (lowercase)', () => {
			const uri = URI.file('/workspace/.github/skills/my-skill/skill.md');
			assert.strictEqual(getCleanPromptName(uri), 'my-skill');
		});

		test('returns folder name for Skill.md (mixed case)', () => {
			const uri = URI.file('/workspace/.github/skills/another-skill/Skill.md');
			assert.strictEqual(getCleanPromptName(uri), 'another-skill');
		});
	});

	suite('isPromptOrInstructionsFile', () => {
		test('SKILL.md files should return true', () => {
			assert.strictEqual(isPromptOrInstructionsFile(URI.file('/workspace/.github/skills/test/SKILL.md')), true);
		});

		test('skill.md (lowercase) should return true', () => {
			assert.strictEqual(isPromptOrInstructionsFile(URI.file('/workspace/.claude/skills/myskill/skill.md')), true);
		});

		test('Skill.md (mixed case) should return true', () => {
			assert.strictEqual(isPromptOrInstructionsFile(URI.file('/workspace/skills/Skill.md')), true);
		});

		test('regular .md files should return false', () => {
			assert.strictEqual(isPromptOrInstructionsFile(URI.file('/workspace/SKILL2.md')), false);
		});

		// Note: Any .json file returns true because getPromptFileType returns hook for all JSON.
		// The caller is responsible for only passing URIs from valid prompt source folders.
		test('any .json file should return true', () => {
			assert.strictEqual(isPromptOrInstructionsFile(URI.file('/workspace/.github/hooks/custom-hooks.json')), true);
			assert.strictEqual(isPromptOrInstructionsFile(URI.file('/workspace/.claude/settings.json')), true);
			assert.strictEqual(isPromptOrInstructionsFile(URI.file('/workspace/.claude/settings.local.json')), true);
			assert.strictEqual(isPromptOrInstructionsFile(URI.file('/workspace/settings.json')), true);
		});
	});

	suite('DEFAULT_AGENT_SOURCE_FOLDERS', () => {
		test('lists SafeAppeals product paths first', () => {
			assert.deepStrictEqual(
				DEFAULT_AGENT_SOURCE_FOLDERS.slice(0, 2),
				[
					{ path: SAFE_APPEALS_AGENTS_SOURCE_FOLDER, source: PromptFileSource.SafeAppealsWorkspace, storage: PromptsStorage.local },
					{ path: SAFE_APPEALS_USER_AGENTS_SOURCE_FOLDER, source: PromptFileSource.SafeAppealsPersonal, storage: PromptsStorage.user },
				],
			);
		});

		test('keeps compat agent folders after SafeAppeals entries', () => {
			assert.deepStrictEqual(
				DEFAULT_AGENT_SOURCE_FOLDERS.map(folder => folder.path),
				[
					'.safeAppeals/agents',
					'~/.safeAppeals/agents',
					'.github/agents',
					'.claude/agents',
					'~/.copilot/agents',
					'~/.claude/agents',
				],
			);
		});
	});

	suite('isInCompatAgentsFolder / isInSafeAppealsAgentsFolder', () => {
		test('classifies product vs compatibility agent folders', () => {
			assert.deepStrictEqual(
				{
					safeAppealsWorkspace: isInSafeAppealsAgentsFolder(URI.file('/workspace/.safeAppeals/agents/research.agent.md')),
					safeAppealsUser: isInSafeAppealsAgentsFolder(URI.file('/home/user/.safeAppeals/agents/research.agent.md')),
					githubCompat: isInCompatAgentsFolder(URI.file('/workspace/.github/agents/research.agent.md')),
					claudeCompat: isInCompatAgentsFolder(URI.file('/workspace/.claude/agents/research.agent.md')),
					copilotCompat: isInCompatAgentsFolder(URI.file('/home/user/.copilot/agents/research.agent.md')),
					safeAppealsNotCompat: isInCompatAgentsFolder(URI.file('/workspace/.safeAppeals/agents/research.agent.md')),
				},
				{
					safeAppealsWorkspace: true,
					safeAppealsUser: true,
					githubCompat: true,
					claudeCompat: true,
					copilotCompat: true,
					safeAppealsNotCompat: false,
				},
			);
		});
	});

	suite('isSkillFilename', () => {
		test('SKILL.md (uppercase) should return true', () => {
			assert.strictEqual(isSkillFilename('SKILL.md'), true);
		});

		test('skill.md (lowercase) should return true', () => {
			assert.strictEqual(isSkillFilename('skill.md'), true);
		});

		test('Skill.md (mixed case) should return true', () => {
			assert.strictEqual(isSkillFilename('Skill.md'), true);
		});

		test('other filenames should return false', () => {
			assert.strictEqual(isSkillFilename('README.md'), false);
			assert.strictEqual(isSkillFilename('SKILL.txt'), false);
			assert.strictEqual(isSkillFilename('my-skill.md'), false);
		});
	});
});
