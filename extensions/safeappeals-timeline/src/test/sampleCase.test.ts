/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import { renderProfileRule } from '../profileRuleTemplate';
import {
	asFileUri,
	LEGACY_SAMPLE_PATHS,
	openSampleCase,
	resetSampleCaseFileSchemeUpgradeForTests,
	SAMPLE_AGENTS_MD,
	SAMPLE_AGENTS_README_MD,
	SAMPLE_AGENTS_README_RELATIVE_PATH,
	SAMPLE_CASE_IDENTITY,
	SAMPLE_CASE_SETTINGS,
	SAMPLE_CODE_WORKSPACE,
	SAMPLE_CODE_WORKSPACE_FILENAME,
	SAMPLE_CONTENT_RELATIVE_PATHS,
	SAMPLE_CORE_REFERENCES_README,
	SAMPLE_GITIGNORE,
	SAMPLE_README,
	SAMPLE_SAFE_APPEALS_SETTINGS_JSON,
	SAMPLE_SKILL_MD,
	SAMPLE_SKILL_RELATIVE_PATH,
	SAMPLE_SKILLS_README_MD,
	SAMPLE_SKILLS_README_RELATIVE_PATH,
	sampleCaseNeedsFileSchemeUpgrade,
	TRUST_SAFE_APPEALS_SAMPLE_CASE_COMMAND_ID,
	trustSampleCaseFolder,
	upgradeSampleCaseToFileSchemeIfNeeded,
} from '../sampleCase';
import { UserProfile } from '../types';

suite('sampleCase', () => {
	test('sampleCaseNeedsFileSchemeUpgrade detects sticky vscode-userdata sample', () => {
		const storageRoot = '/home/user/.config/SafeAppeals/globalStorage/safeappeals.safeappeals-timeline';
		const sampleRoot = `${storageRoot}/sample-case`;
		const workspacePath = `${sampleRoot}/sample_case.code-workspace`;
		assert.deepStrictEqual({
			userdataWorkspace: sampleCaseNeedsFileSchemeUpgrade({
				sampleRootFsPath: sampleRoot,
				sampleWorkspaceFsPath: workspacePath,
				workspaceFile: { fsPath: workspacePath, scheme: 'vscode-userdata' },
				folders: [{ fsPath: sampleRoot, scheme: 'vscode-userdata' }],
			}),
			fileWorkspace: sampleCaseNeedsFileSchemeUpgrade({
				sampleRootFsPath: sampleRoot,
				sampleWorkspaceFsPath: workspacePath,
				workspaceFile: { fsPath: workspacePath, scheme: 'file' },
				folders: [{ fsPath: sampleRoot, scheme: 'file' }],
			}),
			unrelatedWorkspace: sampleCaseNeedsFileSchemeUpgrade({
				sampleRootFsPath: sampleRoot,
				sampleWorkspaceFsPath: workspacePath,
				workspaceFile: { fsPath: '/tmp/other.code-workspace', scheme: 'vscode-userdata' },
				folders: [{ fsPath: '/tmp/other', scheme: 'vscode-userdata' }],
			}),
			emptyWindow: sampleCaseNeedsFileSchemeUpgrade({
				sampleRootFsPath: sampleRoot,
				sampleWorkspaceFsPath: workspacePath,
				workspaceFile: undefined,
				folders: undefined,
			}),
		}, {
			userdataWorkspace: true,
			fileWorkspace: false,
			unrelatedWorkspace: false,
			emptyWindow: false,
		});
	});

	test('upgradeSampleCaseToFileSchemeIfNeeded offers reopen once; does not auto-openFolder', async () => {
		resetSampleCaseFileSchemeUpgradeForTests();
		const originalExecuteCommand = vscode.commands.executeCommand;
		const originalShowInformationMessage = vscode.window.showInformationMessage;
		const originalWorkspaceFile = vscode.workspace.workspaceFile;
		const originalFolders = vscode.workspace.workspaceFolders;
		const commandSequence: string[] = [];
		let offerCount = 0;
		vscode.commands.executeCommand = (async (command: string) => {
			commandSequence.push(command);
			return undefined;
		}) as typeof vscode.commands.executeCommand;
		vscode.window.showInformationMessage = (async (...args: unknown[]) => {
			offerCount += 1;
			assert.strictEqual(args[1], 'Reopen Sample Case');
			// Dismiss — activate must not upgrade without an explicit click.
			return undefined;
		}) as typeof vscode.window.showInformationMessage;

		const storageRoot = '/home/user/.config/SafeAppeals/globalStorage/safeappeals.safeappeals-timeline';
		const sampleRoot = `${storageRoot}/sample-case`;
		const workspacePath = `${sampleRoot}/sample_case.code-workspace`;
		try {
			(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile =
				vscode.Uri.parse(`vscode-userdata:${workspacePath}`);
			(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = [{
				uri: vscode.Uri.parse(`vscode-userdata:${sampleRoot}`),
				name: 'sample-case',
				index: 0,
			}];

			const context = {
				globalStorageUri: vscode.Uri.parse(`vscode-userdata:${storageRoot}`),
			} as vscode.ExtensionContext;

			const first = await upgradeSampleCaseToFileSchemeIfNeeded(context);
			const second = await upgradeSampleCaseToFileSchemeIfNeeded(context);

			assert.deepStrictEqual({
				first,
				second,
				offerCount,
				commands: commandSequence,
			}, {
				first: undefined,
				second: undefined,
				offerCount: 1,
				commands: [],
			});
		} finally {
			resetSampleCaseFileSchemeUpgradeForTests();
			vscode.commands.executeCommand = originalExecuteCommand;
			vscode.window.showInformationMessage = originalShowInformationMessage;
			(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile = originalWorkspaceFile;
			(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = originalFolders;
		}
	});

	test('upgradeSampleCaseToFileSchemeIfNeeded runs openSampleCase only when user clicks Reopen', async () => {
		resetSampleCaseFileSchemeUpgradeForTests();
		const originalExecuteCommand = vscode.commands.executeCommand;
		const originalShowInformationMessage = vscode.window.showInformationMessage;
		const originalWorkspaceFile = vscode.workspace.workspaceFile;
		const originalFolders = vscode.workspace.workspaceFolders;
		const commandSequence: string[] = [];
		vscode.commands.executeCommand = (async (command: string) => {
			commandSequence.push(command);
			return undefined;
		}) as typeof vscode.commands.executeCommand;
		vscode.window.showInformationMessage = (async () => 'Reopen Sample Case') as typeof vscode.window.showInformationMessage;

		const storageRoot = '/home/user/.config/SafeAppeals/globalStorage/safeappeals.safeappeals-timeline';
		const sampleRoot = `${storageRoot}/sample-case`;
		const workspacePath = `${sampleRoot}/sample_case.code-workspace`;
		try {
			(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile =
				vscode.Uri.parse(`vscode-userdata:${workspacePath}`);
			(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = [{
				uri: vscode.Uri.parse(`vscode-userdata:${sampleRoot}`),
				name: 'sample-case',
				index: 0,
			}];

			const context = {
				globalStorageUri: vscode.Uri.parse(`vscode-userdata:${storageRoot}`),
			} as vscode.ExtensionContext;

			const result = await upgradeSampleCaseToFileSchemeIfNeeded(context);

			assert.deepStrictEqual({
				reloading: result?.reloading,
				commands: commandSequence,
			}, {
				reloading: true,
				commands: [
					TRUST_SAFE_APPEALS_SAMPLE_CASE_COMMAND_ID,
					'workbench.action.closeFolder',
					'vscode.openFolder',
				],
			});
		} finally {
			resetSampleCaseFileSchemeUpgradeForTests();
			vscode.commands.executeCommand = originalExecuteCommand;
			vscode.window.showInformationMessage = originalShowInformationMessage;
			(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile = originalWorkspaceFile;
			(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = originalFolders;
		}
	});

	test('upgradeSampleCaseToFileSchemeIfNeeded no-ops when already file://', async () => {
		resetSampleCaseFileSchemeUpgradeForTests();
		const originalExecuteCommand = vscode.commands.executeCommand;
		const originalShowInformationMessage = vscode.window.showInformationMessage;
		const originalWorkspaceFile = vscode.workspace.workspaceFile;
		const originalFolders = vscode.workspace.workspaceFolders;
		let openFolderCount = 0;
		let offerCount = 0;
		vscode.commands.executeCommand = (async (command: string) => {
			if (command === 'vscode.openFolder') {
				openFolderCount += 1;
			}
			return undefined;
		}) as typeof vscode.commands.executeCommand;
		vscode.window.showInformationMessage = (async () => {
			offerCount += 1;
			return undefined;
		}) as typeof vscode.window.showInformationMessage;

		const storageRoot = '/home/user/.config/SafeAppeals/globalStorage/safeappeals.safeappeals-timeline';
		const sampleRoot = `${storageRoot}/sample-case`;
		const workspacePath = `${sampleRoot}/sample_case.code-workspace`;
		try {
			(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile =
				vscode.Uri.file(workspacePath);
			(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = [{
				uri: vscode.Uri.file(sampleRoot),
				name: 'sample-case',
				index: 0,
			}];

			const context = {
				globalStorageUri: vscode.Uri.parse(`vscode-userdata:${storageRoot}`),
			} as vscode.ExtensionContext;

			const result = await upgradeSampleCaseToFileSchemeIfNeeded(context);

			assert.deepStrictEqual({
				result,
				openFolderCount,
				offerCount,
			}, {
				result: undefined,
				openFolderCount: 0,
				offerCount: 0,
			});
		} finally {
			resetSampleCaseFileSchemeUpgradeForTests();
			vscode.commands.executeCommand = originalExecuteCommand;
			vscode.window.showInformationMessage = originalShowInformationMessage;
			(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile = originalWorkspaceFile;
			(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = originalFolders;
		}
	});

	test('asFileUri converts non-file schemes to file:// via fsPath', () => {
		const diskPath = '/home/user/.config/SafeAppeals/globalStorage/safeappeals.safeappeals-timeline/sample-case/sample_case.code-workspace';
		const userdata = vscode.Uri.parse(`vscode-userdata:${diskPath}`);
		const alreadyFile = vscode.Uri.file(diskPath);
		const converted = asFileUri(userdata);
		assert.deepStrictEqual({
			userdataScheme: userdata.scheme,
			convertedScheme: converted.scheme,
			convertedFsPath: converted.fsPath,
			idempotent: asFileUri(alreadyFile).scheme === 'file' && asFileUri(alreadyFile).fsPath === diskPath,
		}, {
			userdataScheme: 'vscode-userdata',
			convertedScheme: 'file',
			convertedFsPath: diskPath,
			idempotent: true,
		});
	});

	test('openSampleCase passes file:// URI to vscode.openFolder', async () => {
		const originalExecuteCommand = vscode.commands.executeCommand;
		const openFolderUris: Array<{ scheme: string }> = [];
		const trustCommands: string[] = [];
		vscode.commands.executeCommand = (async (command: string, ...args: unknown[]) => {
			if (command === TRUST_SAFE_APPEALS_SAMPLE_CASE_COMMAND_ID) {
				trustCommands.push(command);
			}
			if (command === 'vscode.openFolder') {
				openFolderUris.push(args[0] as { scheme: string });
			}
			return undefined;
		}) as typeof vscode.commands.executeCommand;

		try {
			const storageRoot = '/home/user/.config/SafeAppeals/globalStorage/safeappeals.safeappeals-timeline';
			const context = {
				globalStorageUri: vscode.Uri.parse(`vscode-userdata:${storageRoot}`),
			} as vscode.ExtensionContext;

			const result = await openSampleCase(context);

			assert.deepStrictEqual({
				callCount: openFolderUris.length,
				scheme: openFolderUris[0]?.scheme,
				reloading: result.reloading,
				trustBeforeOpen: trustCommands,
			}, {
				callCount: 1,
				scheme: 'file',
				reloading: true,
				trustBeforeOpen: [TRUST_SAFE_APPEALS_SAMPLE_CASE_COMMAND_ID],
			});
		} finally {
			vscode.commands.executeCommand = originalExecuteCommand;
		}
	});

	test('trustSampleCaseFolder invokes _workbench.trust.safeAppealsSampleCase with no URI args', async () => {
		const originalExecuteCommand = vscode.commands.executeCommand;
		let trusted: { command: string; argCount: number } | undefined;
		vscode.commands.executeCommand = (async (command: string, ...args: unknown[]) => {
			if (command === TRUST_SAFE_APPEALS_SAMPLE_CASE_COMMAND_ID) {
				trusted = { command, argCount: args.length };
			}
			return undefined;
		}) as typeof vscode.commands.executeCommand;

		try {
			await trustSampleCaseFolder();
			assert.deepStrictEqual(trusted, {
				command: TRUST_SAFE_APPEALS_SAMPLE_CASE_COMMAND_ID,
				argCount: 0,
			});
		} finally {
			vscode.commands.executeCommand = originalExecuteCommand;
		}
	});

	test('openSampleCase upgrades already-open vscode-userdata workspace to file://', async () => {
		const originalExecuteCommand = vscode.commands.executeCommand;
		const originalWorkspaceFile = vscode.workspace.workspaceFile;
		const originalFolders = vscode.workspace.workspaceFolders;
		const commandSequence: Array<{
			command: string;
			scheme?: string;
			forceReuseWindow?: boolean;
			forceNewWindow?: boolean;
		}> = [];
		vscode.commands.executeCommand = (async (command: string, ...args: unknown[]) => {
			if (command === TRUST_SAFE_APPEALS_SAMPLE_CASE_COMMAND_ID) {
				commandSequence.push({ command });
				return undefined;
			}
			if (command === 'workbench.action.closeFolder') {
				commandSequence.push({ command });
				return undefined;
			}
			if (command === 'vscode.openFolder') {
				const uri = args[0] as { scheme: string };
				const opts = args[1] as { forceReuseWindow?: boolean; forceNewWindow?: boolean } | undefined;
				commandSequence.push({
					command,
					scheme: uri.scheme,
					forceReuseWindow: opts?.forceReuseWindow,
					forceNewWindow: opts?.forceNewWindow,
				});
			}
			return undefined;
		}) as typeof vscode.commands.executeCommand;

		const storageRoot = '/home/user/.config/SafeAppeals/globalStorage/safeappeals.safeappeals-timeline';
		const sampleRoot = `${storageRoot}/sample-case`;
		const workspacePath = `${sampleRoot}/sample_case.code-workspace`;
		try {
			(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile =
				vscode.Uri.parse(`vscode-userdata:${workspacePath}`);
			(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = [{
				uri: vscode.Uri.parse(`vscode-userdata:${sampleRoot}`),
				name: 'sample-case',
				index: 0,
			}];

			const context = {
				globalStorageUri: vscode.Uri.parse(`vscode-userdata:${storageRoot}`),
			} as vscode.ExtensionContext;

			const result = await openSampleCase(context);

			// Trust then closeFolder — same-fsPath openFolder alone no-ops on scheme-only change.
			assert.deepStrictEqual({
				commandSequence,
				reloading: result.reloading,
			}, {
				commandSequence: [
					{ command: TRUST_SAFE_APPEALS_SAMPLE_CASE_COMMAND_ID },
					{ command: 'workbench.action.closeFolder' },
					{
						command: 'vscode.openFolder',
						scheme: 'file',
						forceReuseWindow: true,
						forceNewWindow: undefined,
					},
				],
				reloading: true,
			});
		} finally {
			vscode.commands.executeCommand = originalExecuteCommand;
			(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile = originalWorkspaceFile;
			(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = originalFolders;
		}
	});

	test('openSampleCase already open as file:// skips openFolder', async () => {
		const originalExecuteCommand = vscode.commands.executeCommand;
		const originalWorkspaceFile = vscode.workspace.workspaceFile;
		const originalFolders = vscode.workspace.workspaceFolders;
		let openFolderCount = 0;
		vscode.commands.executeCommand = (async (command: string) => {
			if (command === 'vscode.openFolder') {
				openFolderCount += 1;
			}
			return undefined;
		}) as typeof vscode.commands.executeCommand;

		const storageRoot = '/home/user/.config/SafeAppeals/globalStorage/safeappeals.safeappeals-timeline';
		const sampleRoot = `${storageRoot}/sample-case`;
		const workspacePath = `${sampleRoot}/sample_case.code-workspace`;
		try {
			(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile =
				vscode.Uri.file(workspacePath);
			(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = [{
				uri: vscode.Uri.file(sampleRoot),
				name: 'sample-case',
				index: 0,
			}];

			const context = {
				globalStorageUri: vscode.Uri.parse(`vscode-userdata:${storageRoot}`),
			} as vscode.ExtensionContext;

			const result = await openSampleCase(context);

			assert.deepStrictEqual({
				openFolderCount,
				reloading: result.reloading,
			}, {
				openFolderCount: 0,
				reloading: false,
			});
		} finally {
			vscode.commands.executeCommand = originalExecuteCommand;
			(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile = originalWorkspaceFile;
			(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = originalFolders;
		}
	});

	test('SAMPLE_CONTENT_RELATIVE_PATHS pins openSampleCase write paths', () => {
		assert.deepStrictEqual([...SAMPLE_CONTENT_RELATIVE_PATHS], [
			'sample_readme.md',
			'.gitignore',
			'sample_case.code-workspace',
			'.safeAppeals/settings.json',
			'medical_reports/sample_physician_note.md',
			'correspondence/sample_acknowledgement.md',
			'decisions_and_orders/sample_decision_summary.md',
			'personal_notes/sample_practice_notes.md',
			'core_references/sample_policy_excerpt.md',
			'.safeAppeals/skills/README.md',
			'.safeAppeals/skills/summarize-case/SKILL.md',
			'.safeAppeals/agents/README.md',
		]);
		const contentPaths: readonly string[] = SAMPLE_CONTENT_RELATIVE_PATHS;
		assert.deepStrictEqual({
			shipsLocalResearchAgent: contentPaths.includes('.safeAppeals/agents/research.agent.md'),
			shipsLocalCaseSummaryAgent: contentPaths.includes('.safeAppeals/agents/case-summary.agent.md'),
			anyLocalAgentMd: contentPaths.some(p => p.startsWith('.safeAppeals/agents/') && p.endsWith('.agent.md')),
		}, {
			shipsLocalResearchAgent: false,
			shipsLocalCaseSummaryAgent: false,
			anyLocalAgentMd: false,
		});
	});

	test('sample gitignore, workspace file, and skill stay aligned', () => {
		assert.deepStrictEqual({
			gitignoreBlanketSafeAppeals: SAMPLE_GITIGNORE.split('\n').includes('.safeAppeals/'),
			gitignoreHasOrgLog: SAMPLE_GITIGNORE.includes('.safeAppeals/organization_log.json'),
			gitignoreHasUndoPlan: SAMPLE_GITIGNORE.includes('.safeAppeals/undo_plan.json'),
			gitignoreHasToSortOriginals: SAMPLE_GITIGNORE.includes('to_sort/_originals/'),
			gitignoreIgnoresVscode: SAMPLE_GITIGNORE.includes('.vscode/'),
			workspaceFilename: SAMPLE_CODE_WORKSPACE_FILENAME,
			workspaceHasNestedAgents: SAMPLE_CODE_WORKSPACE.includes('chat.useNestedAgentsMdFiles'),
			workspaceHasSafeAppealsSkills: SAMPLE_CODE_WORKSPACE.includes('.safeAppeals/skills'),
			workspaceHasSafeAppealsAgents: SAMPLE_CODE_WORKSPACE.includes('.safeAppeals/agents'),
			workspaceHasSampleName: SAMPLE_CODE_WORKSPACE.includes('Sample Case (Practice)'),
			workspaceSettingsMatchFolder: SAMPLE_CODE_WORKSPACE.includes('"chat.useNestedAgentsMdFiles": true'),
			folderSettingsPathPinned: SAMPLE_CONTENT_RELATIVE_PATHS.includes('.safeAppeals/settings.json'),
			folderSettingsMatchWorkspace: SAMPLE_SAFE_APPEALS_SETTINGS_JSON.includes('"chat.useNestedAgentsMdFiles": true'),
			agentSkillsLocations: SAMPLE_CASE_SETTINGS['chat.agentSkillsLocations'],
			settingsEnableSafeAppealsSkills: SAMPLE_CASE_SETTINGS['chat.agentSkillsLocations']['.safeAppeals/skills'],
			agentFilesLocations: SAMPLE_CASE_SETTINGS['chat.agentFilesLocations'],
			settingsEnableSafeAppealsAgents: SAMPLE_CASE_SETTINGS['chat.agentFilesLocations']['.safeAppeals/agents'],
			settingsEnableGlobalSafeAppealsAgents: SAMPLE_CASE_SETTINGS['chat.agentFilesLocations']['~/.safeAppeals/agents'],
			legacyCleansGithubSkills: LEGACY_SAMPLE_PATHS.includes('.github/skills'),
			legacyCleansVscode: LEGACY_SAMPLE_PATHS.includes('.vscode'),
			legacyCleansLocalResearchAgent: LEGACY_SAMPLE_PATHS.includes('.safeAppeals/agents/research.agent.md'),
			legacyCleansLocalCaseSummaryAgent: LEGACY_SAMPLE_PATHS.includes('.safeAppeals/agents/case-summary.agent.md'),
			readmeMentionsGitignore: SAMPLE_README.includes('.gitignore'),
			readmeMentionsWorkspace: SAMPLE_README.includes(SAMPLE_CODE_WORKSPACE_FILENAME),
			readmeMentionsSafeAppealsSettings: SAMPLE_README.includes('.safeAppeals/settings.json'),
			readmeWarnsAgainstRemotePush: SAMPLE_README.includes('never push'),
			readmeMentionsPrivacyPolicy: SAMPLE_README.includes('privacy policy'),
			skillPath: SAMPLE_SKILL_RELATIVE_PATH,
			skillName: SAMPLE_SKILL_MD.includes('name: summarize-case'),
			skillIsSample: SAMPLE_SKILL_MD.includes('fictional data only'),
			skillsReadmePath: SAMPLE_SKILLS_README_RELATIVE_PATH,
			skillsReadmeMentionsLocal: SAMPLE_SKILLS_README_MD.includes('.safeAppeals/skills/<name>/SKILL.md'),
			skillsReadmeMentionsPersonalRoots: SAMPLE_SKILLS_README_MD.includes('~/.agents/skills')
				&& SAMPLE_SKILLS_README_MD.includes('~/.copilot/skills')
				&& SAMPLE_SKILLS_README_MD.includes('~/.claude/skills'),
			skillsReadmeClarifiesNoGlobalSafeAppealsSkills: SAMPLE_SKILLS_README_MD.includes('no `~/.safeAppeals/skills`'),
			skillsReadmePointsToCustomizations: SAMPLE_SKILLS_README_MD.includes('Agent Customizations → Skills'),
			readmeMentionsSkills: SAMPLE_README.includes('.safeAppeals/skills'),
			readmeMentionsSkillFile: SAMPLE_README.includes(SAMPLE_SKILL_RELATIVE_PATH),
			readmeMentionsSkillsReadme: SAMPLE_README.includes(SAMPLE_SKILLS_README_RELATIVE_PATH),
			readmeMentionsSlash: SAMPLE_README.includes('/summarize-case'),
			agentsReadmePath: SAMPLE_AGENTS_README_RELATIVE_PATH,
			agentsReadmeMentionsLocal: SAMPLE_AGENTS_README_MD.includes('.safeAppeals/agents/*.agent.md'),
			agentsReadmeMentionsGlobal: SAMPLE_AGENTS_README_MD.includes('~/.safeAppeals/agents'),
			agentsReadmePointsToCustomizations: SAMPLE_AGENTS_README_MD.includes('Agent Customizations → Agents'),
			readmeMentionsAgents: SAMPLE_README.includes('.safeAppeals/agents'),
			readmeMentionsGlobalStarters: SAMPLE_README.includes('~/.safeAppeals/agents'),
			readmeOmitsLocalResearchAgentFile: !SAMPLE_README.includes('.safeAppeals/agents/research.agent.md'),
			readmeOmitsLocalCaseSummaryAgentFile: !SAMPLE_README.includes('.safeAppeals/agents/case-summary.agent.md'),
			noVscodeSettingsPath: !SAMPLE_CONTENT_RELATIVE_PATHS.some(p => p.startsWith('.vscode/')),
		}, {
			gitignoreBlanketSafeAppeals: false,
			gitignoreHasOrgLog: true,
			gitignoreHasUndoPlan: true,
			gitignoreHasToSortOriginals: true,
			gitignoreIgnoresVscode: false,
			workspaceFilename: 'sample_case.code-workspace',
			workspaceHasNestedAgents: true,
			workspaceHasSafeAppealsSkills: true,
			workspaceHasSafeAppealsAgents: true,
			workspaceHasSampleName: true,
			workspaceSettingsMatchFolder: true,
			folderSettingsPathPinned: true,
			folderSettingsMatchWorkspace: true,
			agentSkillsLocations: {
				'.agents/skills': true,
				'.github/skills': true,
				'.claude/skills': true,
				'~/.agents/skills': true,
				'~/.copilot/skills': true,
				'~/.claude/skills': true,
				'.safeAppeals/skills': true,
			},
			settingsEnableSafeAppealsSkills: true,
			agentFilesLocations: {
				'.safeAppeals/agents': true,
				'~/.safeAppeals/agents': true,
				'.github/agents': true,
				'.claude/agents': true,
				'~/.copilot/agents': true,
				'~/.claude/agents': true,
			},
			settingsEnableSafeAppealsAgents: true,
			settingsEnableGlobalSafeAppealsAgents: true,
			legacyCleansGithubSkills: true,
			legacyCleansVscode: true,
			legacyCleansLocalResearchAgent: true,
			legacyCleansLocalCaseSummaryAgent: true,
			readmeMentionsGitignore: true,
			readmeMentionsWorkspace: true,
			readmeMentionsSafeAppealsSettings: true,
			readmeWarnsAgainstRemotePush: true,
			readmeMentionsPrivacyPolicy: true,
			skillPath: '.safeAppeals/skills/summarize-case/SKILL.md',
			skillName: true,
			skillIsSample: true,
			skillsReadmePath: '.safeAppeals/skills/README.md',
			skillsReadmeMentionsLocal: true,
			skillsReadmeMentionsPersonalRoots: true,
			skillsReadmeClarifiesNoGlobalSafeAppealsSkills: true,
			skillsReadmePointsToCustomizations: true,
			readmeMentionsSkills: true,
			readmeMentionsSkillFile: true,
			readmeMentionsSkillsReadme: true,
			readmeMentionsSlash: true,
			agentsReadmePath: '.safeAppeals/agents/README.md',
			agentsReadmeMentionsLocal: true,
			agentsReadmeMentionsGlobal: true,
			agentsReadmePointsToCustomizations: true,
			readmeMentionsAgents: true,
			readmeMentionsGlobalStarters: true,
			readmeOmitsLocalResearchAgentFile: true,
			readmeOmitsLocalCaseSummaryAgentFile: true,
			noVscodeSettingsPath: true,
		});
	});

	test('SAMPLE_CASE_IDENTITY keeps unmistakably fictional markers', () => {
		assert.deepStrictEqual(SAMPLE_CASE_IDENTITY, {
			caseName: '[SAMPLE — NOT A REAL CASE] Fictional Worker v. Demo Employer Co.',
			claimNumber: 'SAMPLE-0000-NOT-REAL',
			clientName: 'Alex Sampleton (FICTIONAL — practice data only)',
			opposingParty: 'Demo Employer Co. (FICTIONAL)',
			opposingRepresentative: 'Jordan Example, Esq. (FICTIONAL)',
		});
	});

	test('SAMPLE_AGENTS_MD is plain prose without managed twin markers', () => {
		assert.deepStrictEqual({
			hasManagedBegin: SAMPLE_AGENTS_MD.includes('safeappeals-case:begin'),
			hasManagedEnd: SAMPLE_AGENTS_MD.includes('safeappeals-case:end'),
			mentionsCaseJson: SAMPLE_AGENTS_MD.includes('case.json'),
			hasSampleMarker: SAMPLE_AGENTS_MD.includes('SAMPLE PRACTICE DATA ONLY'),
			hasClaimNumber: SAMPLE_AGENTS_MD.includes(SAMPLE_CASE_IDENTITY.claimNumber),
			mentionsCoreReferences: SAMPLE_AGENTS_MD.includes('core_references'),
			hasNotesForAgent: SAMPLE_AGENTS_MD.includes('## Notes for the agent'),
			warnsNeverPush: SAMPLE_AGENTS_MD.includes('Never push') || SAMPLE_AGENTS_MD.includes('never push'),
		}, {
			hasManagedBegin: false,
			hasManagedEnd: false,
			mentionsCaseJson: false,
			hasSampleMarker: true,
			hasClaimNumber: true,
			mentionsCoreReferences: true,
			hasNotesForAgent: true,
			warnsNeverPush: true,
		});
	});

	test('SAMPLE_AGENTS_MD mentions snake_case sample folders', () => {
		assert.deepStrictEqual({
			mentionsMedicalReports: SAMPLE_AGENTS_MD.includes('medical_reports'),
			mentionsCorrespondence: SAMPLE_AGENTS_MD.includes('correspondence'),
			mentionsDecisionsAndOrders: SAMPLE_AGENTS_MD.includes('decisions_and_orders'),
			mentionsPersonalNotes: SAMPLE_AGENTS_MD.includes('personal_notes'),
			noLegacyMedicalReports: !SAMPLE_AGENTS_MD.includes('Medical_Reports'),
			noLegacyDecisionsAndOrders: !SAMPLE_AGENTS_MD.includes('Decisions_and_Orders'),
		}, {
			mentionsMedicalReports: true,
			mentionsCorrespondence: true,
			mentionsDecisionsAndOrders: true,
			mentionsPersonalNotes: true,
			noLegacyMedicalReports: true,
			noLegacyDecisionsAndOrders: true,
		});
	});

	test('SAMPLE_CORE_REFERENCES_README explains shared vs case-specific files', () => {
		assert.deepStrictEqual({
			hasPutHere: SAMPLE_CORE_REFERENCES_README.includes('## Put here'),
			hasDoNot: SAMPLE_CORE_REFERENCES_README.includes('## Do not put here'),
			mentionsStatutes: SAMPLE_CORE_REFERENCES_README.includes('Statutes and regulations'),
			mentionsMedical: SAMPLE_CORE_REFERENCES_README.includes('medical records'),
			pointsToAgentsMd: SAMPLE_CORE_REFERENCES_README.includes('AGENTS.md'),
		}, {
			hasPutHere: true,
			hasDoNot: true,
			mentionsStatutes: true,
			mentionsMedical: true,
			pointsToAgentsMd: true,
		});
	});
});

suite('renderProfileRule', () => {
	test('pins persona-group profile instructions snapshots', () => {
		const emptyProfile: UserProfile = {
			name: '',
			organization: '',
			role: '',
			practiceArea: '',
			focusArea: '',
			citationStyle: '',
			country: '',
			stateProvince: '',
			city: '',
			jurisdiction: '',
			operatingSystem: '',
		};

		assert.deepStrictEqual({
			legal: renderProfileRule({
				name: 'Alex Advocate',
				organization: 'Sample Legal LLP',
				role: 'Lawyer',
				practiceArea: 'Workers\' Compensation',
				country: 'Canada',
				stateProvince: 'British Columbia',
				city: 'Vancouver',
				jurisdiction: 'BC WCB',
			}),
			self: renderProfileRule({
				name: 'Sam Worker',
				role: 'Injured Worker',
				country: 'Canada',
				stateProvince: 'Ontario',
				city: 'Toronto',
				jurisdiction: 'Ontario WSIB',
			}),
			educationStudent: renderProfileRule({
				name: 'Casey Student',
				organization: 'UBC',
				role: 'Student',
				focusArea: 'Labour Law',
				citationStyle: 'McGill Guide',
				country: 'Canada',
				stateProvince: 'British Columbia',
			}),
			educationTeacher: renderProfileRule({
				name: 'Taylor Teacher',
				organization: 'Metro High',
				role: 'Teacher',
				focusArea: 'Civics / Grade 11',
				citationStyle: 'APA',
				country: 'Canada',
				stateProvince: 'Ontario',
			}),
			research: renderProfileRule({
				name: 'Riley Researcher',
				organization: 'Institute',
				role: 'Researcher',
				focusArea: 'Occupational health',
				citationStyle: 'APA',
				country: 'Canada',
				stateProvince: 'Alberta',
			}),
			office: renderProfileRule({
				name: 'Owen Office',
				organization: 'Acme Corp',
				role: 'Office Worker',
				focusArea: 'Claims intake',
			}),
			developer: renderProfileRule({
				name: 'Dana Dev',
				organization: 'SafeAppeals',
				role: 'Software Developer',
				focusArea: 'TypeScript / Electron',
			}),
			empty: renderProfileRule(emptyProfile),
			unknownRole: renderProfileRule({
				name: 'Pat Custom',
				organization: 'Custom Org',
				role: 'Claims adjuster',
				practiceArea: 'Disability',
				country: 'Canada',
				stateProvince: 'BC',
				city: 'Victoria',
				jurisdiction: 'BC WCB',
			}),
		}, {
			legal: [
				'---',
				'description: \'Safe Appeals user profile — who the user is and how they work\'',
				'applyTo: \'**\'',
				'---',
				'',
				'# About the Safe Appeals user',
				'',
				'This profile was set up during the Safe Appeals welcome onboarding',
				'(rerun "Safe Appeals Timeline: Set Up Profile" to change it).',
				'',
				'- **Name:** Alex Advocate',
				'- **Firm / organization:** Sample Legal LLP',
				'- **Role:** Lawyer',
				'- **Practice area:** Workers\' Compensation',
				'- **Country:** Canada',
				'- **State / province:** British Columbia',
				'- **City:** Vancouver',
				'- **Compensation board / tribunal:** BC WCB',
				'',
				'When drafting documents, correspondence, or appeals, write from this',
				'person\'s perspective and jurisdiction unless the case brief (AGENTS.md',
				'in the case folder) says otherwise. Case-specific facts always take',
				'precedence over this profile.',
				'',
				'## Research & citations — all work, legal or business',
				'',
				'- End every research answer with a **Sources** section: one markdown link per source, each on its own line.',
				'- Cite with a pinpoint, not just a link: section, paragraph, or page (e.g. "s. 5(1)", "para. 32", "p. 14"). Never cite a bare homepage.',
				'- Prefer primary and official sources (legislation, tribunal decisions, board policy manuals, government sites, vendor documentation) over blogs and summaries.',
				'- Never invent a citation, quote, case name, figure, or deadline. If you cannot find a source, say so plainly instead of guessing.',
				'- Mark any citation you did not open and read in this session as **[unverified]**, and tell the user to confirm it against the original before relying on it.',
				'- Treat deadlines and limitation periods as unverified until the user confirms them against the board or tribunal\'s official source.',
				'- Quote exactly and sparingly; paraphrase everything else and attribute it.',
				'- When a source can change over time (rates, policies, forms, deadlines), note the date you accessed it.',
				'- Match the citation style already used in the user\'s documents; do not impose one.',
				'',
				'## Working with this user',
				'',
				'Write for a legal professional: formal register, jurisdiction-correct citation format with pinpoint paragraphs, and assume the user will verify every authority on a primary database before filing.',
				'',
			].join('\n'),
			self: [
				'---',
				'description: \'Safe Appeals user profile — who the user is and how they work\'',
				'applyTo: \'**\'',
				'---',
				'',
				'# About the Safe Appeals user',
				'',
				'This profile was set up during the Safe Appeals welcome onboarding',
				'(rerun "Safe Appeals Timeline: Set Up Profile" to change it).',
				'',
				'- **Name:** Sam Worker',
				'- **Role:** Injured Worker',
				'- **Country:** Canada',
				'- **State / province:** Ontario',
				'- **City:** Toronto',
				'- **Compensation board / tribunal:** Ontario WSIB',
				'',
				'When drafting documents, correspondence, or appeals, write from this',
				'person\'s perspective and jurisdiction unless the case brief (AGENTS.md',
				'in the case folder) says otherwise. Case-specific facts always take',
				'precedence over this profile.',
				'',
				'## Research & citations — all work, legal or business',
				'',
				'- End every research answer with a **Sources** section: one markdown link per source, each on its own line.',
				'- Cite with a pinpoint, not just a link: section, paragraph, or page (e.g. "s. 5(1)", "para. 32", "p. 14"). Never cite a bare homepage.',
				'- Prefer primary and official sources (legislation, tribunal decisions, board policy manuals, government sites, vendor documentation) over blogs and summaries.',
				'- Never invent a citation, quote, case name, figure, or deadline. If you cannot find a source, say so plainly instead of guessing.',
				'- Mark any citation you did not open and read in this session as **[unverified]**, and tell the user to confirm it against the original before relying on it.',
				'- Treat deadlines and limitation periods as unverified until the user confirms them against the board or tribunal\'s official source.',
				'- Quote exactly and sparingly; paraphrase everything else and attribute it.',
				'- When a source can change over time (rates, policies, forms, deadlines), note the date you accessed it.',
				'- Match the citation style already used in the user\'s documents; do not impose one.',
				'',
				'## Working with this user',
				'',
				'Write in plain language and define legal terms on first use. When research turns up a statute, policy, decision, or ground that appears to favor the user, propose it as a candidate argument with sources and pinpoints, and explain why it may help — then require the user to verify it against primary materials before relying on it. This is a research and drafting aid, not a substitute for the user\'s judgment or a lawyer.',
				'',
			].join('\n'),
			educationStudent: [
				'---',
				'description: \'Safe Appeals user profile — who the user is and how they work\'',
				'applyTo: \'**\'',
				'---',
				'',
				'# About the Safe Appeals user',
				'',
				'This profile was set up during the Safe Appeals welcome onboarding',
				'(rerun "Safe Appeals Timeline: Set Up Profile" to change it).',
				'',
				'- **Name:** Casey Student',
				'- **School / institution:** UBC',
				'- **Role:** Student',
				'- **Field of study:** Labour Law',
				'- **Citation style:** McGill Guide',
				'- **Country:** Canada',
				'- **State / province:** British Columbia',
				'',
				'Frame answers and drafts for this person\'s work and background unless the current workspace or task says otherwise.',
				'',
				'## Research & citations — all work, legal or business',
				'',
				'- End every research answer with a **Sources** section: one markdown link per source, each on its own line.',
				'- Cite with a pinpoint, not just a link: section, paragraph, or page (e.g. "s. 5(1)", "para. 32", "p. 14"). Never cite a bare homepage.',
				'- Prefer primary and official sources (legislation, tribunal decisions, board policy manuals, government sites, vendor documentation) over blogs and summaries.',
				'- Never invent a citation, quote, case name, figure, or deadline. If you cannot find a source, say so plainly instead of guessing.',
				'- Mark any citation you did not open and read in this session as **[unverified]**, and tell the user to confirm it against the original before relying on it.',
				'- Treat deadlines and limitation periods as unverified until the user confirms them against the board or tribunal\'s official source.',
				'- Quote exactly and sparingly; paraphrase everything else and attribute it.',
				'- When a source can change over time (rates, policies, forms, deadlines), note the date you accessed it.',
				'- Match the citation style already used in the user\'s documents; do not impose one.',
				'',
				'## Working with this user',
				'',
				'Explain the reasoning, not just the answer, and cite so every claim can be traced to its source; flag the primary materials the user should read themselves.',
				'',
			].join('\n'),
			educationTeacher: [
				'---',
				'description: \'Safe Appeals user profile — who the user is and how they work\'',
				'applyTo: \'**\'',
				'---',
				'',
				'# About the Safe Appeals user',
				'',
				'This profile was set up during the Safe Appeals welcome onboarding',
				'(rerun "Safe Appeals Timeline: Set Up Profile" to change it).',
				'',
				'- **Name:** Taylor Teacher',
				'- **School / institution:** Metro High',
				'- **Role:** Teacher',
				'- **Subject / level:** Civics / Grade 11',
				'- **Citation style:** APA',
				'- **Country:** Canada',
				'- **State / province:** Ontario',
				'',
				'Frame answers and drafts for this person\'s work and background unless the current workspace or task says otherwise.',
				'',
				'## Research & citations — all work, legal or business',
				'',
				'- End every research answer with a **Sources** section: one markdown link per source, each on its own line.',
				'- Cite with a pinpoint, not just a link: section, paragraph, or page (e.g. "s. 5(1)", "para. 32", "p. 14"). Never cite a bare homepage.',
				'- Prefer primary and official sources (legislation, tribunal decisions, board policy manuals, government sites, vendor documentation) over blogs and summaries.',
				'- Never invent a citation, quote, case name, figure, or deadline. If you cannot find a source, say so plainly instead of guessing.',
				'- Mark any citation you did not open and read in this session as **[unverified]**, and tell the user to confirm it against the original before relying on it.',
				'- Treat deadlines and limitation periods as unverified until the user confirms them against the board or tribunal\'s official source.',
				'- Quote exactly and sparingly; paraphrase everything else and attribute it.',
				'- When a source can change over time (rates, policies, forms, deadlines), note the date you accessed it.',
				'- Match the citation style already used in the user\'s documents; do not impose one.',
				'',
				'## Working with this user',
				'',
				'Explain concepts at the level of the class being taught, and cite source materials with page or section pinpoints so they can go straight into handouts and slides. Support drafting lessons, assignments, rubrics, and exemplars — but when asked to complete a student\'s assessed work, produce marking guidance and worked examples instead of a finished submission.',
				'',
			].join('\n'),
			research: [
				'---',
				'description: \'Safe Appeals user profile — who the user is and how they work\'',
				'applyTo: \'**\'',
				'---',
				'',
				'# About the Safe Appeals user',
				'',
				'This profile was set up during the Safe Appeals welcome onboarding',
				'(rerun "Safe Appeals Timeline: Set Up Profile" to change it).',
				'',
				'- **Name:** Riley Researcher',
				'- **Institution / affiliation:** Institute',
				'- **Role:** Researcher',
				'- **Research field:** Occupational health',
				'- **Citation style:** APA',
				'- **Country:** Canada',
				'- **State / province:** Alberta',
				'',
				'Frame answers and drafts for this person\'s work and background unless the current workspace or task says otherwise.',
				'',
				'## Research & citations — all work, legal or business',
				'',
				'- End every research answer with a **Sources** section: one markdown link per source, each on its own line.',
				'- Cite with a pinpoint, not just a link: section, paragraph, or page (e.g. "s. 5(1)", "para. 32", "p. 14"). Never cite a bare homepage.',
				'- Prefer primary and official sources (legislation, tribunal decisions, board policy manuals, government sites, vendor documentation) over blogs and summaries.',
				'- Never invent a citation, quote, case name, figure, or deadline. If you cannot find a source, say so plainly instead of guessing.',
				'- Mark any citation you did not open and read in this session as **[unverified]**, and tell the user to confirm it against the original before relying on it.',
				'- Treat deadlines and limitation periods as unverified until the user confirms them against the board or tribunal\'s official source.',
				'- Quote exactly and sparingly; paraphrase everything else and attribute it.',
				'- When a source can change over time (rates, policies, forms, deadlines), note the date you accessed it.',
				'- Match the citation style already used in the user\'s documents; do not impose one.',
				'',
				'## Working with this user',
				'',
				'Cite academically (author, year, pinpoint) and prefer peer-reviewed or primary sources; keep findings clearly separate from your own synthesis.',
				'',
			].join('\n'),
			office: [
				'---',
				'description: \'Safe Appeals user profile — who the user is and how they work\'',
				'applyTo: \'**\'',
				'---',
				'',
				'# About the Safe Appeals user',
				'',
				'This profile was set up during the Safe Appeals welcome onboarding',
				'(rerun "Safe Appeals Timeline: Set Up Profile" to change it).',
				'',
				'- **Name:** Owen Office',
				'- **Company / organization:** Acme Corp',
				'- **Role:** Office Worker',
				'- **Works on:** Claims intake',
				'',
				'Frame answers and drafts for this person\'s work and background unless the current workspace or task says otherwise.',
				'',
				'## Research & citations — all work, legal or business',
				'',
				'- End every research answer with a **Sources** section: one markdown link per source, each on its own line.',
				'- Cite with a pinpoint, not just a link: section, paragraph, or page (e.g. "s. 5(1)", "para. 32", "p. 14"). Never cite a bare homepage.',
				'- Prefer primary and official sources (legislation, tribunal decisions, board policy manuals, government sites, vendor documentation) over blogs and summaries.',
				'- Never invent a citation, quote, case name, figure, or deadline. If you cannot find a source, say so plainly instead of guessing.',
				'- Mark any citation you did not open and read in this session as **[unverified]**, and tell the user to confirm it against the original before relying on it.',
				'- Treat deadlines and limitation periods as unverified until the user confirms them against the board or tribunal\'s official source.',
				'- Quote exactly and sparingly; paraphrase everything else and attribute it.',
				'- When a source can change over time (rates, policies, forms, deadlines), note the date you accessed it.',
				'- Match the citation style already used in the user\'s documents; do not impose one.',
				'',
				'## Working with this user',
				'',
				'Keep drafts concise and action-oriented; cite internal documents by title and section, external claims by link, and flag every figure — rates, dates, amounts — as needing confirmation before it leaves the building.',
				'',
			].join('\n'),
			developer: [
				'---',
				'description: \'Safe Appeals user profile — who the user is and how they work\'',
				'applyTo: \'**\'',
				'---',
				'',
				'# About the Safe Appeals user',
				'',
				'This profile was set up during the Safe Appeals welcome onboarding',
				'(rerun "Safe Appeals Timeline: Set Up Profile" to change it).',
				'',
				'- **Name:** Dana Dev',
				'- **Company / team:** SafeAppeals',
				'- **Role:** Software Developer',
				'- **Languages / stack:** TypeScript / Electron',
				'',
				'Frame answers and drafts for this person\'s work and background unless the current workspace or task says otherwise.',
				'',
				'## Research & citations — all work, legal or business',
				'',
				'- End every research answer with a **Sources** section: one markdown link per source, each on its own line.',
				'- Cite with a pinpoint, not just a link: section, paragraph, or page (e.g. "s. 5(1)", "para. 32", "p. 14"). Never cite a bare homepage.',
				'- Prefer primary and official sources (legislation, tribunal decisions, board policy manuals, government sites, vendor documentation) over blogs and summaries.',
				'- Never invent a citation, quote, case name, figure, or deadline. If you cannot find a source, say so plainly instead of guessing.',
				'- Mark any citation you did not open and read in this session as **[unverified]**, and tell the user to confirm it against the original before relying on it.',
				'- Treat deadlines and limitation periods as unverified until the user confirms them against the board or tribunal\'s official source.',
				'- Quote exactly and sparingly; paraphrase everything else and attribute it.',
				'- When a source can change over time (rates, policies, forms, deadlines), note the date you accessed it.',
				'- Match the citation style already used in the user\'s documents; do not impose one.',
				'',
				'## Working with this user',
				'',
				'Link the exact documentation page and version, prefer official docs and changelogs over tutorials, and verify library claims against what\'s actually installed in the project.',
				'',
			].join('\n'),
			empty: [
				'---',
				'description: \'Safe Appeals user profile — who the user is and how they work\'',
				'applyTo: \'**\'',
				'---',
				'',
				'# About the Safe Appeals user',
				'',
				'This profile was set up during the Safe Appeals welcome onboarding',
				'(rerun "Safe Appeals Timeline: Set Up Profile" to change it).',
				'',
				'When drafting documents, correspondence, or appeals, write from this',
				'person\'s perspective and jurisdiction unless the case brief (AGENTS.md',
				'in the case folder) says otherwise. Case-specific facts always take',
				'precedence over this profile.',
				'',
				'## Research & citations — all work, legal or business',
				'',
				'- End every research answer with a **Sources** section: one markdown link per source, each on its own line.',
				'- Cite with a pinpoint, not just a link: section, paragraph, or page (e.g. "s. 5(1)", "para. 32", "p. 14"). Never cite a bare homepage.',
				'- Prefer primary and official sources (legislation, tribunal decisions, board policy manuals, government sites, vendor documentation) over blogs and summaries.',
				'- Never invent a citation, quote, case name, figure, or deadline. If you cannot find a source, say so plainly instead of guessing.',
				'- Mark any citation you did not open and read in this session as **[unverified]**, and tell the user to confirm it against the original before relying on it.',
				'- Treat deadlines and limitation periods as unverified until the user confirms them against the board or tribunal\'s official source.',
				'- Quote exactly and sparingly; paraphrase everything else and attribute it.',
				'- When a source can change over time (rates, policies, forms, deadlines), note the date you accessed it.',
				'- Match the citation style already used in the user\'s documents; do not impose one.',
				'',
			].join('\n'),
			unknownRole: [
				'---',
				'description: \'Safe Appeals user profile — who the user is and how they work\'',
				'applyTo: \'**\'',
				'---',
				'',
				'# About the Safe Appeals user',
				'',
				'This profile was set up during the Safe Appeals welcome onboarding',
				'(rerun "Safe Appeals Timeline: Set Up Profile" to change it).',
				'',
				'- **Name:** Pat Custom',
				'- **Firm / organization:** Custom Org',
				'- **Role:** Claims adjuster',
				'- **Practice area:** Disability',
				'- **Country:** Canada',
				'- **State / province:** BC',
				'- **City:** Victoria',
				'- **Compensation board / tribunal:** BC WCB',
				'',
				'When drafting documents, correspondence, or appeals, write from this',
				'person\'s perspective and jurisdiction unless the case brief (AGENTS.md',
				'in the case folder) says otherwise. Case-specific facts always take',
				'precedence over this profile.',
				'',
				'## Research & citations — all work, legal or business',
				'',
				'- End every research answer with a **Sources** section: one markdown link per source, each on its own line.',
				'- Cite with a pinpoint, not just a link: section, paragraph, or page (e.g. "s. 5(1)", "para. 32", "p. 14"). Never cite a bare homepage.',
				'- Prefer primary and official sources (legislation, tribunal decisions, board policy manuals, government sites, vendor documentation) over blogs and summaries.',
				'- Never invent a citation, quote, case name, figure, or deadline. If you cannot find a source, say so plainly instead of guessing.',
				'- Mark any citation you did not open and read in this session as **[unverified]**, and tell the user to confirm it against the original before relying on it.',
				'- Treat deadlines and limitation periods as unverified until the user confirms them against the board or tribunal\'s official source.',
				'- Quote exactly and sparingly; paraphrase everything else and attribute it.',
				'- When a source can change over time (rates, policies, forms, deadlines), note the date you accessed it.',
				'- Match the citation style already used in the user\'s documents; do not impose one.',
				'',
			].join('\n'),
		});
	});
});
