/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { xmlToPlainText } from '../docx/docxTextExtract';

suite('docxTextExtract', () => {
	test('xmlToPlainText strips OOXML tags and decodes entities', () => {
		const xml = [
			'<?xml version="1.0"?>',
			'<w:document><w:body>',
			'<w:p><w:r><w:t>Hello &amp; Welcome</w:t></w:r></w:p>',
			'<w:p><w:r><w:t>Line two</w:t></w:r></w:p>',
			'</w:body></w:document>',
		].join('');
		assert.deepStrictEqual(xmlToPlainText(xml), 'Hello & Welcome\nLine two');
	});
});
