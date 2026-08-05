/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	createConverterAgentTools,
	validateFilingTargetRequest,
} from '../agentTools';
import { parseAvailableConversions } from '../protocol';
import type { ConvertResult } from '../types';

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
		html2pdf: {
			key: 'html2pdf',
			fidelity: 'browser-print',
			engine: 'chromium',
			available: true,
		},
		merge_pdfs: {
			key: 'merge_pdfs',
			fidelity: 'pdf-ops',
			engine: 'lopdf',
			available: true,
		},
	},
	aliases: {},
};

function toolText(result: vscode.LanguageModelToolResult): string {
	return result.content
		.map(part => part instanceof vscode.LanguageModelTextPart ? part.value : '')
		.join('');
}

function cancellationToken(): vscode.CancellationToken {
	return new vscode.CancellationTokenSource().token;
}

function mockService() {
	const available = parseAvailableConversions(mockSidecarResult);
	return {
		isSidecarAvailable: true,
		getAvailableConversions: () => available,
		convert: async (): Promise<ConvertResult> => ({
			success: true,
			output_path: '/workspace/out.pdf',
			fidelity: 'browser-print',
			engine: 'chromium',
		}),
		batchConvert: async () => ({
			success: true,
			results: [{ input: '/workspace/a.html', success: true, output_path: '/workspace/a.pdf' }],
			fidelity: 'browser-print' as const,
			engine: 'chromium',
		}),
		mergePdfs: async (): Promise<ConvertResult> => ({
			success: true,
			output_path: '/workspace/merged.pdf',
			fidelity: 'pdf-ops',
			engine: 'lopdf',
		}),
	};
}

suite('converter agentTools', () => {
	let tools: ReturnType<typeof createConverterAgentTools>;
	const folders = [{ uri: vscode.Uri.file('/workspace/case'), name: 'case', index: 0 }];

	suiteSetup(() => {
		(vscode.workspace as { workspaceFolders?: typeof folders }).workspaceFolders = folders;
		tools = createConverterAgentTools(() => mockService() as never);
	});

	suiteTeardown(() => {
		(vscode.workspace as { workspaceFolders?: undefined }).workspaceFolders = undefined;
	});

	test('validateFilingTargetRequest refuses unavailable filing exports', () => {
		const spec = parseAvailableConversions(mockSidecarResult).conversions.docx2pdf;
		const message = validateFilingTargetRequest('docx2pdf', spec, true, undefined);
		assert.ok(message?.includes('not available'));
		assert.ok(message?.includes('preview-fast'));
	});

	test('validateFilingTargetRequest requires confirm_filing when available', () => {
		const spec = parseAvailableConversions(mockSidecarResult).conversions.html2pdf;
		const missing = validateFilingTargetRequest('html2pdf', spec, undefined, undefined);
		assert.ok(missing?.includes('confirm_filing'));
		assert.strictEqual(validateFilingTargetRequest('html2pdf', spec, true, undefined), undefined);
	});

	test('validateFilingTargetRequest blocks preview-fast option for filing types', () => {
		const spec = parseAvailableConversions(mockSidecarResult).conversions.html2pdf;
		const message = validateFilingTargetRequest('html2pdf', spec, true, { engine: 'preview-fast' });
		assert.ok(message?.includes('preview-fast'));
	});

	test('convert invoke validates required arguments and filing rules', async () => {
		const token = cancellationToken();

		const missingInput = toolText(await tools.convert.invoke({ toolInvocationToken: undefined, input: {
			input: '',
			output: 'out.pdf',
			type: 'md2html',
		} }, token));
		const unavailableFiling = toolText(await tools.convert.invoke({ toolInvocationToken: undefined, input: {
			input: 'brief.docx',
			output: 'brief.pdf',
			type: 'docx2pdf',
			confirm_filing: true,
		} }, token));
		const missingConfirm = toolText(await tools.convert.invoke({ toolInvocationToken: undefined, input: {
			input: 'page.html',
			output: 'page.pdf',
			type: 'html2pdf',
		} }, token));
		const success = toolText(await tools.convert.invoke({ toolInvocationToken: undefined, input: {
			input: 'page.html',
			output: 'page.pdf',
			type: 'html2pdf',
			confirm_filing: true,
		} }, token));

		assert.deepStrictEqual(
			{
				missingInput: missingInput.startsWith('Error: "input" is required'),
				unavailableFiling: unavailableFiling.includes('not available') && unavailableFiling.includes('fidelity: office-fidelity'),
				missingConfirm: missingConfirm.includes('confirm_filing'),
				successHasFidelity: success.includes('fidelity: browser-print') && success.includes('engine: chromium'),
			},
			{
				missingInput: true,
				unavailableFiling: true,
				missingConfirm: true,
				successHasFidelity: true,
			},
		);
	});

	test('batchConvert and mergePdfs validate required arguments', async () => {
		const token = cancellationToken();

		const batchMissing = toolText(await tools.batchConvert.invoke({ toolInvocationToken: undefined, input: {
			inputs: [],
			type: 'md2html',
		} }, token));
		const mergeMissing = toolText(await tools.mergePdfs.invoke({ toolInvocationToken: undefined, input: {
			inputs: ['a.pdf'],
			output: '',
		} }, token));
		const mergeSuccess = toolText(await tools.mergePdfs.invoke({ toolInvocationToken: undefined, input: {
			inputs: ['a.pdf', 'b.pdf'],
			output: 'merged.pdf',
		} }, token));

		assert.strictEqual(batchMissing, 'Error: "inputs" is required (non-empty array of workspace paths).');
		assert.strictEqual(mergeMissing, 'Error: "output" is required (workspace-relative or absolute path).');
		assert.ok(mergeSuccess.includes('fidelity: pdf-ops'));
		assert.ok(mergeSuccess.includes('engine: lopdf'));
	});

	test('mutating tools expose confirmationMessages', async () => {
		const token = cancellationToken();
		const [convertConfirm, batchConfirm, mergeConfirm] = await Promise.all([
			tools.convert.prepareInvocation({
				input: { input: 'a.docx', output: 'a.pdf', type: 'docx2pdf' },
			}, token),
			tools.batchConvert.prepareInvocation({
				input: { inputs: ['a.html', 'b.html'], type: 'html2pdf' },
			}, token),
			tools.mergePdfs.prepareInvocation({
				input: { inputs: ['1.pdf', '2.pdf'], output: 'all.pdf' },
			}, token),
		]);

		assert.ok(convertConfirm.confirmationMessages?.title.includes('Court-Class'));
		assert.ok(batchConfirm.confirmationMessages?.title.includes('Court-Class'));
		assert.ok(mergeConfirm.confirmationMessages?.title === 'Merge PDFs');
	});
});
