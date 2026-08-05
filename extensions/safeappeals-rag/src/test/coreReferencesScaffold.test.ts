/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	CORE_REFERENCES_README_TEMPLATE,
	ROOT_AGENTS_MD_TEMPLATE,
	scaffoldCoreReferences,
} from '../coreReferencesScaffold';
import { CORE_REFERENCES_FOLDER } from '../types';

suite('coreReferencesScaffold', () => {
	const files = new Map<string, string>();
	const dirs = new Set<string>();
	let originalFs: typeof vscode.workspace.fs;

	setup(() => {
		files.clear();
		dirs.clear();
		originalFs = vscode.workspace.fs;
		Object.defineProperty(vscode.workspace, 'fs', {
			configurable: true,
			value: {
				...originalFs,
				createDirectory: async (uri: vscode.Uri) => {
					dirs.add(uri.fsPath);
				},
				readFile: async (uri: vscode.Uri) => {
					const text = files.get(uri.fsPath);
					if (text === undefined) {
						throw new Error(`ENOENT: ${uri.fsPath}`);
					}
					return Buffer.from(text, 'utf8');
				},
				writeFile: async (uri: vscode.Uri, content: Uint8Array) => {
					files.set(uri.fsPath, Buffer.from(content).toString('utf8'));
				},
			},
		});
	});

	teardown(() => {
		Object.defineProperty(vscode.workspace, 'fs', {
			configurable: true,
			value: originalFs,
		});
	});

	test('creates core_references folder, root AGENTS.md, and README.md', async () => {
		const root = vscode.Uri.file('/workspace/case');
		const result = await scaffoldCoreReferences(root);

		assert.deepStrictEqual(
			{
				folder: result.folderUri.fsPath,
				agents: result.agentsMdUri.fsPath,
				readme: result.readmeUri.fsPath,
				createdAgentsMd: result.createdAgentsMd,
				createdReadme: result.createdReadme,
				dirs: [...dirs],
				agentsText: files.get(result.agentsMdUri.fsPath),
				readmeText: files.get(result.readmeUri.fsPath),
			},
			{
				folder: `/workspace/case/${CORE_REFERENCES_FOLDER}`,
				agents: '/workspace/case/AGENTS.md',
				readme: `/workspace/case/${CORE_REFERENCES_FOLDER}/README.md`,
				createdAgentsMd: true,
				createdReadme: true,
				dirs: [`/workspace/case/${CORE_REFERENCES_FOLDER}`],
				agentsText: ROOT_AGENTS_MD_TEMPLATE,
				readmeText: CORE_REFERENCES_README_TEMPLATE,
			},
		);
	});

	test('is idempotent and preserves existing AGENTS.md', async () => {
		const root = vscode.Uri.file('/workspace/case');
		const agentsPath = '/workspace/case/AGENTS.md';
		const readmePath = `/workspace/case/${CORE_REFERENCES_FOLDER}/README.md`;
		const customAgents = '# My existing case brief\n\nDo not overwrite.\n';
		const customReadme = '# Custom readme\n';

		files.set(agentsPath, customAgents);
		files.set(readmePath, customReadme);
		dirs.add(`/workspace/case/${CORE_REFERENCES_FOLDER}`);

		const first = await scaffoldCoreReferences(root);
		const second = await scaffoldCoreReferences(root);

		assert.deepStrictEqual(
			{
				firstCreated: { agents: first.createdAgentsMd, readme: first.createdReadme },
				secondCreated: { agents: second.createdAgentsMd, readme: second.createdReadme },
				agentsText: files.get(agentsPath),
				readmeText: files.get(readmePath),
			},
			{
				firstCreated: { agents: false, readme: false },
				secondCreated: { agents: false, readme: false },
				agentsText: customAgents,
				readmeText: customReadme,
			},
		);
	});

	test('writes missing AGENTS.md without replacing existing README', async () => {
		const root = vscode.Uri.file('/workspace/case');
		const readmePath = `/workspace/case/${CORE_REFERENCES_FOLDER}/README.md`;
		const customReadme = '# Keep me\n';
		files.set(readmePath, customReadme);

		const result = await scaffoldCoreReferences(root);

		assert.deepStrictEqual(
			{
				createdAgentsMd: result.createdAgentsMd,
				createdReadme: result.createdReadme,
				agentsText: files.get('/workspace/case/AGENTS.md'),
				readmeText: files.get(readmePath),
			},
			{
				createdAgentsMd: true,
				createdReadme: false,
				agentsText: ROOT_AGENTS_MD_TEMPLATE,
				readmeText: customReadme,
			},
		);
	});
});
