/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { buildDocumentChatOpenOptions } from '../documentChatOpenOptions';

suite('buildDocumentChatOpenOptions', () => {
	test('attach mode keeps query light and uses attachPaste/attachFiles', () => {
		const opts = buildDocumentChatOpenOptions(
			{
				uri: 'file:///workspace/brief.docx',
				text: 'Selected paragraph one.\nSelected paragraph two.',
				kind: 'docx',
			},
			'attach',
			{ uriLabel: 'brief.docx', fileName: 'brief.docx' },
		);

		assert.deepStrictEqual(
			{
				query: opts.query,
				isPartialQuery: opts.isPartialQuery,
				queryHasSelectionBody: opts.query.includes('Selected paragraph'),
				attachFiles: opts.attachFiles,
				pasteCode: opts.attachPaste?.[0]?.code,
				pasteFileName: opts.attachPaste?.[0]?.fileName,
				pastedLines: opts.attachPaste?.[0]?.pastedLines,
				copiedFromUri: opts.attachPaste?.[0]?.copiedFrom?.uri,
				copiedFromEndLine: opts.attachPaste?.[0]?.copiedFrom?.range.endLineNumber,
			},
			{
				query: '',
				isPartialQuery: true,
				queryHasSelectionBody: false,
				attachFiles: ['file:///workspace/brief.docx'],
				pasteCode: 'Selected paragraph one.\nSelected paragraph two.',
				pasteFileName: 'brief.docx',
				pastedLines: '2 lines',
				copiedFromUri: 'file:///workspace/brief.docx',
				copiedFromEndLine: 2,
			},
		);
	});

	test('edit mode puts instructions in query and selection in attachPaste', () => {
		const opts = buildDocumentChatOpenOptions(
			{
				uri: 'file:///workspace/sheet.xlsx',
				text: 'A1\tB1',
				kind: 'xlsx',
				sheet: 'Sheet1',
				range: 'A1:B1',
				instructions: 'Bold the header row',
			},
			'edit',
			{ uriLabel: 'sheet.xlsx', fileName: 'sheet.xlsx' },
		);

		assert.deepStrictEqual(
			{
				queryHasInstructions: opts.query.includes('Bold the header row'),
				queryHasSelectionDump: opts.query.includes('A1\tB1'),
				querySaysOpenOrClosed: opts.query.includes('open or closed'),
				queryAvoidsMustStayOpen: !opts.query.includes('must stay open'),
				attachFiles: opts.attachFiles,
				pasteCode: opts.attachPaste?.[0]?.code,
				pasteNameHasRange: opts.attachPaste?.[0]?.name.includes('Sheet1!A1:B1') === true,
			},
			{
				queryHasInstructions: true,
				queryHasSelectionDump: false,
				querySaysOpenOrClosed: true,
				queryAvoidsMustStayOpen: true,
				attachFiles: ['file:///workspace/sheet.xlsx'],
				pasteCode: 'A1\tB1',
				pasteNameHasRange: true,
			},
		);
	});

	test('docx edit mode notes selection needs open editor; other edits open or closed', () => {
		const opts = buildDocumentChatOpenOptions(
			{
				uri: 'file:///workspace/brief.docx',
				text: 'Selected paragraph',
				kind: 'docx',
			},
			'edit',
			{ uriLabel: 'brief.docx', fileName: 'brief.docx' },
		);

		assert.deepStrictEqual(
			{
				hasUseLastSelection: opts.query.includes('useLastSelection=true'),
				mentionsSelectionNeedsOpen: opts.query.includes('selection edits need the editor open'),
				mentionsOpenOrClosed: opts.query.includes('open or closed'),
				avoidsMustStayOpen: !opts.query.includes('must stay open'),
			},
			{
				hasUseLastSelection: true,
				mentionsSelectionNeedsOpen: true,
				mentionsOpenOrClosed: true,
				avoidsMustStayOpen: true,
			},
		);
	});
});
