/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import JSZip from 'jszip';
import {
	applyDocxOpsHeadless,
	buildParagraphXml,
	escapeXml,
	findTrailingBodySectPrStart,
	insertBeforeBodyEnd,
	isSectPrTagBoundary,
	REPLACE_SELECTION_REQUIRES_EDITOR,
	replaceBodyContent,
	resolveReplaceSelectionRange,
} from '../docx/docxXmlEdit';
import { extractTextFromDocxBytes } from '../docx/docxTextExtract';
import { createDocxBuffer } from '../docx/docxWriter';

/** Fixture: mid-document sectPr inside pPr + trailing body-level sectPr. */
function midDocSectPrFixture(): string {
	return (
		'<?xml version="1.0" encoding="UTF-8"?>' +
		'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
		'<w:body>' +
		'<w:p><w:r><w:t>KeepMeOld</w:t></w:r></w:p>' +
		'<w:p><w:pPr><w:sectPr><w:pgSz w:w="12240"/></w:sectPr></w:pPr>' +
		'<w:r><w:t>AfterMidSect</w:t></w:r></w:p>' +
		'<w:p><w:r><w:t>AlsoOld</w:t></w:r></w:p>' +
		'<w:sectPr><w:pgSz w:w="12240"/><w:pgMar w:top="1440"/></w:sectPr>' +
		'</w:body></w:document>'
	);
}

suite('docxXmlEdit', () => {
	test('buildParagraphXml escapes and optional heading style', () => {
		assert.deepStrictEqual(
			{
				plain: buildParagraphXml('A & B'),
				heading: buildParagraphXml('Title', 2),
				strippedControls: escapeXml('A\u0000B\u0007C'),
			},
			{
				plain: '<w:p><w:r><w:t xml:space="preserve">A &amp; B</w:t></w:r></w:p>',
				heading: '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t xml:space="preserve">Title</w:t></w:r></w:p>',
				strippedControls: 'ABC',
			},
		);
	});

	test('insertBeforeBodyEnd keeps trailing sectPr', () => {
		const xml = (
			'<?xml version="1.0"?><w:document><w:body>' +
			'<w:p><w:r><w:t>Hi</w:t></w:r></w:p>' +
			'<w:sectPr><w:pgSz w:w="12240"/></w:sectPr></w:body></w:document>'
		);
		const out = insertBeforeBodyEnd(xml, '<w:p><w:r><w:t>More</w:t></w:r></w:p>');
		assert.ok(out.includes('More'));
		assert.ok(out.includes('<w:sectPr>'));
		assert.ok(out.indexOf('More') < out.lastIndexOf('<w:sectPr'));
	});

	test('trailing sectPr anchors past mid-document pPr sectPr', async () => {
		const xml = midDocSectPrFixture();
		assert.ok(isSectPrTagBoundary(xml, xml.indexOf('<w:sectPr')));
		assert.ok(!isSectPrTagBoundary('<w:sectPrChange w:id="1"/>', 0));

		const trailing = findTrailingBodySectPrStart(xml);
		assert.ok(trailing > 0);
		assert.ok(xml.slice(trailing).startsWith('<w:sectPr'));
		assert.strictEqual(trailing, xml.lastIndexOf('<w:sectPr'));

		const inserted = insertBeforeBodyEnd(xml, '<w:p><w:r><w:t>AppendedHere</w:t></w:r></w:p>');
		const midSectInPpr = inserted.indexOf('<w:pPr><w:sectPr>');
		const appendedAt = inserted.indexOf('AppendedHere');
		const trailingAt = findTrailingBodySectPrStart(inserted);
		assert.ok(midSectInPpr >= 0, 'mid-document pPr sectPr still present');
		assert.ok(appendedAt > midSectInPpr, 'append is after mid-document sectPr');
		assert.ok(appendedAt < trailingAt, 'append is before trailing body sectPr');
		assert.ok(!inserted.slice(midSectInPpr, midSectInPpr + 80).includes('AppendedHere'));

		const replaced = replaceBodyContent(
			xml,
			'<w:p><w:r><w:t>BrandNewOnly</w:t></w:r></w:p>',
		);
		assert.ok(replaced.includes('BrandNewOnly'));
		assert.ok(replaced.includes('<w:sectPr><w:pgSz w:w="12240"/><w:pgMar w:top="1440"/></w:sectPr>'));
		assert.ok(!replaced.includes('KeepMeOld'));
		assert.ok(!replaced.includes('AfterMidSect'));
		assert.ok(!replaced.includes('AlsoOld'));
		assert.ok(!replaced.includes('<w:pPr><w:sectPr>'), 'mid-document sectPr must not survive replaceAll');

		// Zip-level replaceAll must also drop every pre-replace paragraph.
		const zip = new JSZip();
		zip.file('word/document.xml', xml);
		zip.file('[Content_Types].xml', '<Types/>');
		const bytes = await zip.generateAsync({ type: 'uint8array' });
		const applied = await applyDocxOpsHeadless(bytes, [
			{ type: 'replaceAll', text: 'OnlyNew' },
		]);
		const text = await extractTextFromDocxBytes(applied.bytes);
		assert.ok(text.includes('OnlyNew'));
		assert.ok(!text.includes('KeepMeOld'));
		assert.ok(!text.includes('AfterMidSect'));
		assert.ok(!text.includes('AlsoOld'));
	});

	test('headless ops preserve non-document.xml zip parts', async () => {
		const bytes = await createDocxBuffer({
			title: 'Doc',
			body: 'Hello world',
		});
		const before = await JSZip.loadAsync(bytes);
		before.file('word/media/keep.bin', 'SECRET');
		const withExtra = await before.generateAsync({ type: 'uint8array' });

		const applied = await applyDocxOpsHeadless(withExtra, [
			{ type: 'appendParagraph', text: 'Tail paragraph' },
			{ type: 'appendHeading', text: 'Section', level: 1 },
			{ type: 'insertAtEnd', text: 'End' },
		]);
		assert.ok(applied.results.every(r => r.ok));

		const text = await extractTextFromDocxBytes(applied.bytes);
		assert.ok(text.includes('Hello world'));
		assert.ok(text.includes('Tail paragraph'));
		assert.ok(text.includes('Section'));
		assert.ok(text.includes('End'));

		const after = await JSZip.loadAsync(applied.bytes);
		const keep = await after.file('word/media/keep.bin')?.async('string');
		assert.strictEqual(keep, 'SECRET');
	});

	test('replaceAll and replaceSelection behavior', async () => {
		const bytes = await createDocxBuffer({ body: 'Original' });
		const replaced = await applyDocxOpsHeadless(bytes, [
			{ type: 'replaceAll', text: 'Brand new\n\nSecond' },
		]);
		const text = await extractTextFromDocxBytes(replaced.bytes);
		assert.ok(text.includes('Brand new'));
		assert.ok(text.includes('Second'));
		assert.ok(!text.includes('Original'));

		await assert.rejects(
			async () => applyDocxOpsHeadless(bytes, [
				{ type: 'replaceSelection', text: 'Nope' },
			]),
			/replaceSelection requires an open editor with a selection/,
		);

		// Multiple replaceSelection-only ops also fail closed (no silent success write).
		await assert.rejects(
			async () => applyDocxOpsHeadless(bytes, [
				{ type: 'replaceSelection', text: 'A' },
				{ type: 'replaceSelection', text: 'B' },
			]),
			/replaceSelection requires an open editor with a selection/,
		);

		// Mixed: any replaceSelection fails closed (do not partially apply other ops).
		await assert.rejects(
			async () => applyDocxOpsHeadless(bytes, [
				{ type: 'replaceSelection', text: 'Nope' },
				{ type: 'appendParagraph', text: 'TailOk' },
			]),
			/replaceSelection requires an open editor with a selection/,
		);
	});

	test('resolveReplaceSelectionRange prefers pending then live, fails closed', () => {
		assert.deepStrictEqual(
			{
				pendingWins: resolveReplaceSelectionRange({ from: 1, to: 5 }, { from: 10, to: 20 }),
				liveWhenNoPending: resolveReplaceSelectionRange(null, { from: 3, to: 7 }),
				liveWhenCollapsedPending: resolveReplaceSelectionRange({ from: 2, to: 2 }, { from: 8, to: 12 }),
				none: resolveReplaceSelectionRange(null, null),
				emptyLive: resolveReplaceSelectionRange(undefined, { from: 4, to: 4 }),
				errorConstant: REPLACE_SELECTION_REQUIRES_EDITOR,
			},
			{
				pendingWins: { from: 1, to: 5 },
				liveWhenNoPending: { from: 3, to: 7 },
				liveWhenCollapsedPending: { from: 8, to: 12 },
				none: null,
				emptyLive: null,
				errorConstant: 'replaceSelection requires an open editor with a selection',
			},
		);
	});
});
