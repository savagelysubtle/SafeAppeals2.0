/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	resolveInstallMissingModelsPlan,
	runInstallMissingModels,
} from '../installMissingModels';
import { SEARCH_PACK_MODEL_IDS } from '../localAiSetupState';
import { fakeMlBridge } from '../mlBridge';
import type { MlBridge } from '../mlBridge';
import type { ConsentInstallOutcome } from '../types';
import { UNLIMITED_OCR_MODEL_ID } from '../types';

function mockMl(
	consentInstall: (modelId: string, userConsented: boolean) => Promise<ConsentInstallOutcome>,
): MlBridge {
	return {
		consentInstall,
	} as MlBridge;
}

suite('installMissingModels', () => {
	const originalShowWarning = vscode.window.showWarningMessage;
	const originalWithProgress = vscode.window.withProgress;

	teardown(() => {
		vscode.window.showWarningMessage = originalShowWarning;
		vscode.window.withProgress = originalWithProgress;
	});

	test('cancel consent does not call consentInstall or onReady', async () => {
		let consentCalls = 0;
		let onReadyCalls = 0;
		vscode.window.showWarningMessage = async () => vscode.l10n.t('Cancel');

		const summary = await runInstallMissingModels({
			ml: mockMl(async () => {
				consentCalls++;
				return { kind: 'installed', modelId: 'unused', version: '1.0.0' };
			}),
			onReady: async () => {
				onReadyCalls++;
			},
			log: () => { },
		});

		assert.deepStrictEqual(
			{ consentCalls, onReadyCalls, summary },
			{
				consentCalls: 0,
				onReadyCalls: 0,
				summary: { installed: [], alreadyReady: [], errors: [], warnings: [] },
			},
		);
	});

	test('confirm installs each Search pack model and calls onReady', async () => {
		const consentCalls: { modelId: string; userConsented: boolean }[] = [];
		let onReadyCalls = 0;
		vscode.window.showWarningMessage = async () => vscode.l10n.t('Install');
		vscode.window.withProgress = async (_options, task) =>
			task(
				{ report: () => { } },
				{ isCancellationRequested: false, onCancellationRequested: () => ({ dispose() { } }) },
			);

		const summary = await runInstallMissingModels({
			ml: mockMl(async (modelId, userConsented) => {
				consentCalls.push({ modelId, userConsented });
				return { kind: 'installed', modelId, version: '1.0.0' };
			}),
			onReady: async () => {
				onReadyCalls++;
			},
			log: () => { },
		});

		assert.deepStrictEqual(
			{
				consentCalls,
				onReadyCalls,
				installed: summary.installed,
				errors: summary.errors,
			},
			{
				consentCalls: SEARCH_PACK_MODEL_IDS.map(modelId => ({ modelId, userConsented: true })),
				onReadyCalls: 1,
				installed: [...SEARCH_PACK_MODEL_IDS],
				errors: [],
			},
		);
	});

	test('includes OCR in plan when eligible, pinned, and not ready', async () => {
		const ml = fakeMlBridge({
			artifactReady: false,
			evaluate: { eligible: true, reasons: [] },
		});
		const plan = await resolveInstallMissingModelsPlan(ml);
		assert.deepStrictEqual(
			{
				includeOcr: plan.includeOcr,
				searchPackDiskMb: plan.searchPackDiskMb,
				ocrDiskMb: plan.ocrDiskMb,
			},
			{
				includeOcr: true,
				searchPackDiskMb: 350,
				ocrDiskMb: 7000,
			},
		);
		assert.strictEqual(typeof plan.includeWhisper, 'boolean');
		assert.strictEqual(typeof plan.whisperDiskMb, 'number');
	});

	test('confirm installs OCR when eligible after Search pack', async () => {
		const consentCalls: string[] = [];
		vscode.window.showWarningMessage = async () => vscode.l10n.t('Install');
		vscode.window.withProgress = async (_options, task) =>
			task(
				{ report: () => { } },
				{ isCancellationRequested: false, onCancellationRequested: () => ({ dispose() { } }) },
			);

		const ml = fakeMlBridge({
			artifactReady: false,
			evaluate: { eligible: true, reasons: [] },
			consentInstall: async (modelId, userConsented) => {
				assert.strictEqual(userConsented, true);
				consentCalls.push(modelId);
				return { kind: 'installed', modelId, version: '1.0.0' };
			},
			ensureDocParseReady: async () => ({ ready: true }),
		});

		const summary = await runInstallMissingModels({
			ml,
			onReady: async () => { },
			log: () => { },
		});

		assert.deepStrictEqual(
			{
				consentCalls,
				installed: summary.installed,
				errors: summary.errors,
			},
			{
				consentCalls: [...SEARCH_PACK_MODEL_IDS, UNLIMITED_OCR_MODEL_ID],
				installed: [...SEARCH_PACK_MODEL_IDS, UNLIMITED_OCR_MODEL_ID],
				errors: [],
			},
		);
	});

	test('install error is recorded in summary', async () => {
		vscode.window.showWarningMessage = async () => vscode.l10n.t('Install');
		vscode.window.withProgress = async (_options, task) =>
			task(
				{ report: () => { } },
				{ isCancellationRequested: false, onCancellationRequested: () => ({ dispose() { } }) },
			);

		const summary = await runInstallMissingModels({
			ml: mockMl(async modelId => ({
				kind: 'error',
				modelId,
				message: 'network timeout',
			})),
			onReady: async () => { },
			log: () => { },
		});

		assert.deepStrictEqual(
			{
				installed: summary.installed,
				alreadyReady: summary.alreadyReady,
				errors: summary.errors,
			},
			{
				installed: [],
				alreadyReady: [],
				errors: SEARCH_PACK_MODEL_IDS.map(modelId => ({
					modelId,
					message: 'network timeout',
				})),
			},
		);
	});
});
