/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { buildSmartOutputPath, findSmartOutputPath, getPathDisplayName } from '../smartConvertPath';
import { getConversionTargetsForExtension } from '../conversionMap';

suite('smart conversion paths', () => {
	test('builds POSIX sibling paths for multi-dot and extensionless files', () => {
		assert.deepStrictEqual([
			buildSmartOutputPath('/cases/appeal.final.docx', 'pdf'),
			buildSmartOutputPath('/cases/README', 'pdf'),
		], ['/cases/appeal.final.pdf', '/cases/README.pdf']);
	});

	test('builds Windows sibling paths without duplicating the input path', () => {
		assert.deepStrictEqual([
			buildSmartOutputPath('C:\\Cases\\appeal.final.docx', 'pdf'),
			buildSmartOutputPath('C:\\Cases\\README', 'pdf', ' (1)'),
		], ['C:\\Cases\\appeal.final.pdf', 'C:\\Cases\\README (1).pdf']);
	});

	test('chooses the first available conflict suffix through an injectable probe', () => {
		const checked: string[] = [];
		const result = findSmartOutputPath('/cases/appeal.docx', 'pdf', candidate => {
			checked.push(candidate);
			return checked.length < 3;
		});
		assert.deepStrictEqual({ result, checked }, {
			result: '/cases/appeal (2).pdf',
			checked: ['/cases/appeal.pdf', '/cases/appeal (1).pdf', '/cases/appeal (2).pdf'],
		});
	});

	test('returns safe display names for Windows, POSIX, and hostile markup', () => {
		assert.deepStrictEqual([
			getPathDisplayName('C:\\Cases\\brief.pdf'),
			getPathDisplayName('/cases/<img src=x onerror=alert(1)>.pdf'),
		], ['brief.pdf', '<img src=x onerror=alert(1)>.pdf']);
	});

	test('offers only actionable smart-convert choices in registry order', () => {
		const targets = getConversionTargetsForExtension('DOCX', {
			conversions: {
				docx2pdf: { key: 'docx2pdf', fidelity: 'office-fidelity', engine: 'libreoffice', available: false, install_hint: 'Install LibreOffice' },
				docx2md: { key: 'docx2md', fidelity: 'semantic', engine: 'pandoc', available: true },
				docx2epub: { key: 'docx2epub', fidelity: 'semantic', engine: 'pandoc', available: false },
			},
			aliases: {},
		});
		assert.deepStrictEqual(targets.map(target => ({
			key: target.key,
			installHint: target.installHint,
		})), [
			{ key: 'docx2pdf', installHint: 'Install LibreOffice' },
			{ key: 'docx2md', installHint: undefined },
		]);
	});
});
