/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import {
	assertPathInWorkspace,
	assertPathsInWorkspace,
	canonicalizePathForSandbox,
	getWorkspaceRootPaths,
	isPathInsideWorkspaceRoot,
	normalizeUriPath,
	resolveWorkspaceRelativePath,
} from '../pathGuard';

function workspaceFolder(fsPath: string): vscode.WorkspaceFolder {
	return {
		uri: { scheme: 'file', fsPath, path: fsPath, toString: () => `file://${fsPath}` } as vscode.Uri,
		name: path.basename(fsPath),
		index: 0,
	};
}

suite('pathGuard', () => {
	test('isPathInsideWorkspaceRoot accepts nested paths', () => {
		const root = '/workspace/case';
		assert.strictEqual(isPathInsideWorkspaceRoot('/workspace/case/docs/file.pdf', [root]), true);
		assert.strictEqual(isPathInsideWorkspaceRoot('/workspace/case', [root]), true);
		assert.strictEqual(isPathInsideWorkspaceRoot('/workspace/other/file.pdf', [root]), false);
	});

	test('isPathInsideWorkspaceRoot rejects sibling prefix bypass', () => {
		const root = path.resolve('/tmp/sa-converter-root-case');
		const sibling = `${root}-evil`;
		assert.strictEqual(isPathInsideWorkspaceRoot(path.join(sibling, 'secret.txt'), [root]), false);
	});

	test('normalizeUriPath rejects parent escapes', () => {
		assert.strictEqual(normalizeUriPath('../secret'), undefined);
		assert.strictEqual(normalizeUriPath('docs/file.md'), 'docs/file.md');
	});

	test('resolveWorkspaceRelativePath resolves relative paths inside workspace', () => {
		const folders = [workspaceFolder('/workspace/case')];
		const uri = resolveWorkspaceRelativePath('docs/brief.md', folders);
		assert.ok(uri);
		assert.strictEqual(uri!.fsPath, path.resolve('/workspace/case/docs/brief.md'));
	});

	test('resolveWorkspaceRelativePath rejects paths outside workspace', () => {
		const folders = [workspaceFolder('/workspace/case')];
		assert.strictEqual(resolveWorkspaceRelativePath('/etc/passwd', folders), undefined);
	});

	test('getWorkspaceRootPaths collects file scheme folders', () => {
		const roots = getWorkspaceRootPaths([
			workspaceFolder('/a'),
			workspaceFolder('/b'),
		]);
		assert.deepStrictEqual(roots, [path.resolve('/a'), path.resolve('/b')]);
	});

	test('assertPathInWorkspace allows real files in temp workspace', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-converter-guard-'));
		const filePath = path.join(root, 'input.md');
		await fs.writeFile(filePath, '# test');
		const folders = [workspaceFolder(root)];
		const resolved = await assertPathInWorkspace(filePath, folders);
		assert.strictEqual(resolved, filePath);
	});

	test('assertPathInWorkspace allows nonexistent nested Save-As output', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-converter-guard-'));
		const outputPath = path.join(root, 'nested', 'out.pdf');
		const folders = [workspaceFolder(root)];
		const resolved = await assertPathInWorkspace(outputPath, folders);
		assert.strictEqual(resolved, outputPath);
	});

	test('assertPathInWorkspace allows nonexistent Save-As output under workspace root', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-converter-guard-'));
		const outputPath = path.join(root, 'out.pdf');
		const folders = [workspaceFolder(root)];
		const resolved = await assertPathInWorkspace(outputPath, folders);
		assert.strictEqual(resolved, outputPath);
	});

	test('canonicalizePathForSandbox resolves nonexistent output via existing ancestor', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-converter-guard-'));
		const outputPath = path.join(root, 'nested', 'out.pdf');
		const canonical = await canonicalizePathForSandbox(outputPath);
		assert.strictEqual(canonical, outputPath);
	});

	test('assertPathsInWorkspace rejects paths outside workspace', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-converter-guard-'));
		const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-converter-out-'));
		const folders = [workspaceFolder(root)];
		await assert.rejects(
			() => assertPathsInWorkspace([path.join(outside, 'evil.md')], folders),
			/outside the workspace/,
		);
	});

	test('assertPathInWorkspace rejects symlink escape outside workspace', async function () {
		if (process.platform === 'win32') {
			this.skip();
		}
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-converter-guard-'));
		const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-converter-out-'));
		const secret = path.join(outside, 'secret.txt');
		await fs.writeFile(secret, 'secret');
		const link = path.join(root, 'link.txt');
		await fs.symlink(secret, link);
		const folders = [workspaceFolder(root)];
		await assert.rejects(
			() => assertPathInWorkspace(link, folders),
			/outside the workspace/,
		);
	});
});
