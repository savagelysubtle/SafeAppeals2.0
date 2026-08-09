/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
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
	async function createMergeService(pageCountResult: Record<string, unknown>): Promise<{
		service: ConverterService;
		pdfPath: string;
		methods: string[];
	}> {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-converter-merge-'));
		const pdfPath = path.join(root, 'brief.pdf');
		await fs.writeFile(pdfPath, '%PDF');
		(vscode.workspace as { workspaceFolders?: vscode.WorkspaceFolder[] }).workspaceFolders = [{
			uri: vscode.Uri.file(root), name: 'ws', index: 0,
		}];
		const service = new ConverterService('/nonexistent/safeappeals-converter', () => { });
		const mutable = service as unknown as {
			cachedConversions: AvailableConversions;
			sidecar: { request: (method: string) => Promise<Record<string, unknown>> };
		};
		mutable.cachedConversions = parseAvailableConversions({
			conversions: { merge_pdfs_by_page: { key: 'merge_pdfs_by_page', fidelity: 'pdf-ops', engine: 'lopdf', available: true } },
			aliases: {},
		});
		const methods: string[] = [];
		mutable.sidecar.request = async method => {
			methods.push(method);
			return method === 'extract_pdf_pages' ? pageCountResult : { success: true };
		};
		return { service, pdfPath, methods };
	}

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

	test('extractPdfPages calls sidecar extract_pdf_pages RPC', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-converter-svc-'));
		const pdfPath = path.join(root, 'brief.pdf');
		await fs.writeFile(pdfPath, '%PDF');
		(vscode.workspace as { workspaceFolders?: vscode.WorkspaceFolder[] }).workspaceFolders = [{
			uri: vscode.Uri.file(root),
			name: 'ws',
			index: 0,
		}];

		const service = new ConverterService('/nonexistent/safeappeals-converter', () => { });
		let capturedMethod = '';
		const mutable = service as unknown as {
			sidecar: {
				isBinaryAvailable: boolean;
				request: (method: string, params: Record<string, unknown>) => Promise<unknown>;
			};
		};
		mutable.sidecar = {
			isBinaryAvailable: true,
			request: async (method, params) => {
				capturedMethod = method;
				assert.strictEqual(params.source, pdfPath);
				return {
					success: true,
					pages: [{ page: 1, text: 'Page one' }],
					page_count: 1,
				};
			},
		};

		const result = await service.extractPdfPages(pdfPath);
		assert.strictEqual(capturedMethod, 'extract_pdf_pages');
		assert.strictEqual(result.success, true);
		assert.strictEqual(result.pages?.length, 1);
		assert.strictEqual(result.pages?.[0]?.text, 'Page one');
	});

	test('extractPdfPages fails closed without sidecar binary', async () => {
		const service = new ConverterService('/nonexistent/safeappeals-converter', () => { });
		const result = await service.extractPdfPages('/workspace/brief.pdf');
		assert.strictEqual(result.success, false);
		assert.ok(result.error?.includes('sa-converter binary'));
	});

	test('mergePdfsByPage rejects pages beyond the source PDF before merge', async () => {
		const { service, pdfPath, methods } = await createMergeService({ success: true, page_count: 2, pages: [] });
		const result = await service.mergePdfsByPage({
			inputs: [{ path: pdfPath, pages: [3] }],
			output: path.join(path.dirname(pdfPath), 'merged.pdf'),
		});
		assert.deepStrictEqual({ success: result.success, error: result.error, methods }, {
			success: false,
			error: 'Page 3 exceeds the PDF page count of 2.',
			methods: ['extract_pdf_pages'],
		});
	});

	const emptyMergeCases: Array<[string, Array<{ path: string; pages: number[] }>]> = [
		['empty inputs', []],
		['empty page selections', [{ path: '/workspace/brief.pdf', pages: [] }]],
	];
	for (const [name, inputs] of emptyMergeCases) {
		test(`mergePdfsByPage rejects ${name} without calling the sidecar`, async () => {
			const service = new ConverterService('/nonexistent/safeappeals-converter', () => { });
			const mutable = service as unknown as {
				sidecar: { request: () => Promise<Record<string, unknown>> };
			};
			let requestCalled = false;
			mutable.sidecar.request = async () => {
				requestCalled = true;
				return { success: true };
			};
			const result = await service.mergePdfsByPage({ inputs: [...inputs], output: '/workspace/out.pdf' });
			assert.deepStrictEqual({ success: result.success, requestCalled }, { success: false, requestCalled: false });
		});
	}

	test('mergePdfsByPage propagates page-count extraction errors without merging', async () => {
		const { service, pdfPath, methods } = await createMergeService({ success: false, error: 'damaged PDF' });
		const result = await service.mergePdfsByPage({
			inputs: [{ path: pdfPath, pages: [1] }],
			output: path.join(path.dirname(pdfPath), 'merged.pdf'),
		});
		assert.deepStrictEqual({ success: result.success, error: result.error, methods }, {
			success: false,
			error: 'damaged PDF',
			methods: ['extract_pdf_pages'],
		});
	});

	test('mergePdfsByPage preserves input and page order in the successful RPC payload', async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-converter-order-'));
		const first = path.join(root, 'first.pdf');
		const second = path.join(root, 'second.pdf');
		await Promise.all([fs.writeFile(first, '%PDF'), fs.writeFile(second, '%PDF')]);
		(vscode.workspace as { workspaceFolders?: vscode.WorkspaceFolder[] }).workspaceFolders = [{
			uri: vscode.Uri.file(root), name: 'ws', index: 0,
		}];
		const service = new ConverterService('/nonexistent/safeappeals-converter', () => { });
		const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
		const mutable = service as unknown as {
			cachedConversions: AvailableConversions;
			sidecar: { request: (method: string, params: Record<string, unknown>) => Promise<Record<string, unknown>> };
		};
		mutable.cachedConversions = parseAvailableConversions({
			conversions: { merge_pdfs_by_page: { key: 'merge_pdfs_by_page', fidelity: 'pdf-ops', engine: 'lopdf', available: true } },
			aliases: {},
		});
		mutable.sidecar.request = async (method, params) => {
			calls.push({ method, params });
			return method === 'extract_pdf_pages'
				? { success: true, page_count: 5, pages: [] }
				: { success: true, output_path: path.join(root, 'merged.pdf') };
		};
		const output = path.join(root, 'merged.pdf');
		const result = await service.mergePdfsByPage({
			inputs: [{ path: second, pages: [3, 1] }, { path: first, pages: [4, 2] }],
			output,
		});
		assert.deepStrictEqual({ success: result.success, finalCall: calls.at(-1) }, {
			success: true,
			finalCall: {
				method: 'merge_pdfs_by_page',
				params: {
					inputs: [{ path: second, pages: [1, 3] }, { path: first, pages: [2, 4] }],
					output,
				},
			},
		});
	});
});
