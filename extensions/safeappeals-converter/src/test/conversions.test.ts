/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	getConversionSpec,
	isSidecarProgressNotification,
	isSidecarResponse,
	parseAvailableConversions,
	resolveConversionKey,
	unavailableConversionMessage,
} from '../protocol';

/** Mock sidecar payload matching rust/converter get_available_conversions shape. */
const mockSidecarResult = {
	conversions: {
		md2html: {
			key: 'md2html',
			fidelity: 'semantic',
			engine: 'comrak',
			available: true,
		},
		docx2pdf: {
			key: 'docx2pdf',
			fidelity: 'office-fidelity',
			engine: 'libreoffice',
			available: false,
			install_hint: 'Install LibreOffice (soffice) for office-fidelity conversions.',
		},
		merge_pdfs: {
			key: 'merge_pdfs',
			fidelity: 'pdf-ops',
			engine: 'lopdf',
			available: true,
		},
	},
	aliases: {
		pdf2ocr: 'pdf2ocr_layer',
	},
};

suite('parseAvailableConversions', () => {
	test('parses conversions and aliases from mock sidecar response', () => {
		const parsed = parseAvailableConversions(mockSidecarResult);
		assert.strictEqual(Object.keys(parsed.conversions).length, 3);
		assert.strictEqual(parsed.conversions.md2html.available, true);
		assert.strictEqual(parsed.conversions.docx2pdf.fidelity, 'office-fidelity');
		assert.strictEqual(parsed.conversions.docx2pdf.install_hint?.includes('LibreOffice'), true);
		assert.strictEqual(parsed.aliases.pdf2ocr, 'pdf2ocr_layer');
	});

	test('returns empty maps for invalid payload', () => {
		assert.deepStrictEqual(parseAvailableConversions(null), { conversions: {}, aliases: {} });
		assert.deepStrictEqual(parseAvailableConversions('bad'), { conversions: {}, aliases: {} });
	});

	test('resolveConversionKey applies aliases', () => {
		const parsed = parseAvailableConversions(mockSidecarResult);
		assert.strictEqual(resolveConversionKey('pdf2ocr', parsed), 'pdf2ocr_layer');
		assert.strictEqual(resolveConversionKey('md2html', parsed), 'md2html');
	});

	test('getConversionSpec finds spec by key', () => {
		const parsed = parseAvailableConversions(mockSidecarResult);
		const spec = getConversionSpec('merge_pdfs', parsed);
		assert.ok(spec);
		assert.strictEqual(spec!.engine, 'lopdf');
		assert.strictEqual(spec!.available, true);
	});

	test('unavailableConversionMessage returns install_hint when unavailable', () => {
		const parsed = parseAvailableConversions(mockSidecarResult);
		const message = unavailableConversionMessage('docx2pdf', parsed);
		assert.ok(message);
		assert.match(message!, /LibreOffice/);
	});

	test('unavailableConversionMessage returns undefined when available', () => {
		const parsed = parseAvailableConversions(mockSidecarResult);
		assert.strictEqual(unavailableConversionMessage('md2html', parsed), undefined);
	});

	test('isSidecarResponse detects success envelope', () => {
		assert.strictEqual(isSidecarResponse({ id: '1', result: { ok: true } }), true);
		assert.strictEqual(isSidecarResponse({ id: '1', error: { code: 'X', message: 'y' } }), false);
	});

	test('isSidecarProgressNotification detects progress lines', () => {
		assert.strictEqual(
			isSidecarProgressNotification({
				method: 'progress',
				params: { job_id: 'j1', progress: 50, message: 'half', type: 'single_progress' },
			}),
			true,
		);
		assert.strictEqual(isSidecarProgressNotification({ method: 'ping' }), false);
	});
});
