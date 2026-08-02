/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { chooseDocumentEditPath } from '../documentEditPath';

suite('chooseDocumentEditPath', () => {
	test('routes open/closed/ready/dirty combinations', () => {
		assert.deepStrictEqual(
			{
				closedStructured: chooseDocumentEditPath({
					isOpen: false, isReady: false, isDirty: false, opKind: 'structured',
				}),
				closedSelection: chooseDocumentEditPath({
					isOpen: false, isReady: false, isDirty: false, opKind: 'selection',
				}),
				closedOverwrite: chooseDocumentEditPath({
					isOpen: false, isReady: false, isDirty: false, opKind: 'overwrite',
				}),
				closedRead: chooseDocumentEditPath({
					isOpen: false, isReady: false, isDirty: false, opKind: 'read',
				}),
				openReadyStructured: chooseDocumentEditPath({
					isOpen: true, isReady: true, isDirty: false, opKind: 'structured',
				}),
				openReadyDirtyStructured: chooseDocumentEditPath({
					isOpen: true, isReady: true, isDirty: true, opKind: 'structured',
				}),
				openReadySelection: chooseDocumentEditPath({
					isOpen: true, isReady: true, isDirty: false, opKind: 'selection',
				}),
				openReadyOverwrite: chooseDocumentEditPath({
					isOpen: true, isReady: true, isDirty: false, opKind: 'overwrite',
				}),
				openReadyDirtyOverwrite: chooseDocumentEditPath({
					isOpen: true, isReady: true, isDirty: true, opKind: 'overwrite',
				}),
				openReadyRead: chooseDocumentEditPath({
					isOpen: true, isReady: true, isDirty: false, opKind: 'read',
				}),
				openNotReadyCleanStructured: chooseDocumentEditPath({
					isOpen: true, isReady: false, isDirty: false, opKind: 'structured',
				}),
				openNotReadyDirtyStructured: chooseDocumentEditPath({
					isOpen: true, isReady: false, isDirty: true, opKind: 'structured',
				}),
				openNotReadyCleanOverwrite: chooseDocumentEditPath({
					isOpen: true, isReady: false, isDirty: false, opKind: 'overwrite',
				}),
				openNotReadyDirtyOverwrite: chooseDocumentEditPath({
					isOpen: true, isReady: false, isDirty: true, opKind: 'overwrite',
				}),
				openNotReadySelection: chooseDocumentEditPath({
					isOpen: true, isReady: false, isDirty: false, opKind: 'selection',
				}),
				openNotReadyDirtyRead: chooseDocumentEditPath({
					isOpen: true, isReady: false, isDirty: true, opKind: 'read',
				}),
				openNotReadyCleanRead: chooseDocumentEditPath({
					isOpen: true, isReady: false, isDirty: false, opKind: 'read',
				}),
			},
			{
				closedStructured: 'headless',
				closedSelection: 'error',
				closedOverwrite: 'headless',
				closedRead: 'headless',
				openReadyStructured: 'open',
				openReadyDirtyStructured: 'open',
				openReadySelection: 'open',
				openReadyOverwrite: 'headless',
				openReadyDirtyOverwrite: 'error',
				openReadyRead: 'open',
				openNotReadyCleanStructured: 'headless',
				openNotReadyDirtyStructured: 'error',
				openNotReadyCleanOverwrite: 'headless',
				openNotReadyDirtyOverwrite: 'error',
				openNotReadySelection: 'error',
				openNotReadyDirtyRead: 'error',
				openNotReadyCleanRead: 'headless',
			},
		);
	});
});
