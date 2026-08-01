/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as path from 'path';
import {
	isPathInsideWorkspaceRoot,
	normalizeUriPath,
	resolveRelativeToRoot,
} from '../workspacePath';

suite('workspacePath', () => {
	const root = path.resolve('/tmp/workspace-root');

	test('accepts paths inside the workspace root', () => {
		assert.deepStrictEqual(
			{
				inside: isPathInsideWorkspaceRoot(path.join(root, 'docs', 'a.docx'), [root]),
				relative: resolveRelativeToRoot('docs/a.docx', [root]),
				escape: resolveRelativeToRoot('../outside.docx', [root]),
				absoluteOutside: resolveRelativeToRoot('/etc/passwd', [root]),
			},
			{
				inside: true,
				relative: path.join(root, 'docs', 'a.docx'),
				escape: undefined,
				absoluteOutside: undefined,
			},
		);
	});

	test('normalizeUriPath collapses segments and rejects leading ..', () => {
		assert.deepStrictEqual(
			{
				ok: normalizeUriPath('/workspace/docs/a.docx'),
				collapsed: normalizeUriPath('/workspace/docs/../a.docx'),
				dotDot: normalizeUriPath('../secret'),
			},
			{
				ok: '/workspace/docs/a.docx',
				collapsed: '/workspace/a.docx',
				dotDot: undefined,
			},
		);
	});
});
