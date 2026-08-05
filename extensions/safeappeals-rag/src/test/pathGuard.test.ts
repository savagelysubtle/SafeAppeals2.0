/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	assertSourceUriInWorkspace,
	isPathInsideWorkspaceRoot,
} from '../pathGuard';

suite('pathGuard', () => {
	test('isPathInsideWorkspaceRoot accepts nested paths', () => {
		assert.strictEqual(
			isPathInsideWorkspaceRoot('/case/docs/a.pdf', ['/case']),
			true,
		);
		assert.strictEqual(
			isPathInsideWorkspaceRoot('/other/a.pdf', ['/case']),
			false,
		);
	});

	test('assertSourceUriInWorkspace fail-closed without roots', () => {
		assert.throws(
			() => assertSourceUriInWorkspace('file:///case/a.pdf', []),
			/workspace/,
		);
	});

	test('assertSourceUriInWorkspace accepts file URI inside root', () => {
		const fsPath = assertSourceUriInWorkspace('file:///case/docs/a.pdf', ['/case']);
		assert.ok(fsPath.includes('a.pdf'));
	});

	test('assertSourceUriInWorkspace rejects escape', () => {
		assert.throws(
			() => assertSourceUriInWorkspace('file:///etc/passwd', ['/case']),
			/outside the workspace/,
		);
	});
});
