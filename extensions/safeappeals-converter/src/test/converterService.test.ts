/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { ConverterService } from '../converterService';
import { parseAvailableConversions, unavailableConversionMessage } from '../protocol';
import type { AvailableConversions } from '../types';

const unavailableConversions: AvailableConversions = parseAvailableConversions({
	conversions: {
		docx2pdf: {
			key: 'docx2pdf',
			fidelity: 'office-fidelity',
			engine: 'libreoffice',
			available: false,
			install_hint: 'Install LibreOffice (soffice) for office-fidelity conversions.',
		},
		md2html: {
			key: 'md2html',
			fidelity: 'semantic',
			engine: 'comrak',
			available: true,
		},
	},
	aliases: {},
});

suite('converterService availability gate', () => {
	test('unavailableConversionMessage returns install_hint for disabled conversions', () => {
		const message = unavailableConversionMessage('docx2pdf', unavailableConversions);
		assert.strictEqual(message, 'Install LibreOffice (soffice) for office-fidelity conversions.');
	});

	test('unavailableConversionMessage returns undefined for available conversions', () => {
		assert.strictEqual(unavailableConversionMessage('md2html', unavailableConversions), undefined);
	});

	test('convert returns install_hint without calling sidecar when unavailable', async () => {
		const service = new ConverterService('/nonexistent/safeappeals-converter', () => { });
		const mutable = service as unknown as {
			cachedConversions: AvailableConversions;
			sidecar: { request: (...args: unknown[]) => Promise<unknown> };
		};
		mutable.cachedConversions = unavailableConversions;

		let requestCalled = false;
		mutable.sidecar.request = async () => {
			requestCalled = true;
			return { success: true };
		};

		const result = await service.convert({
			input: '/workspace/in.docx',
			output: '/workspace/out.pdf',
			type: 'docx2pdf',
		});

		assert.strictEqual(result.success, false);
		assert.strictEqual(result.error, 'Install LibreOffice (soffice) for office-fidelity conversions.');
		assert.strictEqual(requestCalled, false);
	});

	test('batchConvert returns install_hint without calling sidecar when unavailable', async () => {
		const service = new ConverterService('/nonexistent/safeappeals-converter', () => { });
		const mutable = service as unknown as {
			cachedConversions: AvailableConversions;
			sidecar: { request: (...args: unknown[]) => Promise<unknown> };
		};
		mutable.cachedConversions = unavailableConversions;

		let requestCalled = false;
		mutable.sidecar.request = async () => {
			requestCalled = true;
			return { success: true, results: [] };
		};

		const result = await service.batchConvert({
			inputs: ['/workspace/a.docx'],
			type: 'docx2pdf',
		});

		assert.strictEqual(result.success, false);
		assert.strictEqual(result.error, 'Install LibreOffice (soffice) for office-fidelity conversions.');
		assert.strictEqual(requestCalled, false);
	});
});
