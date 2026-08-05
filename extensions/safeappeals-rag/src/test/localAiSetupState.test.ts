/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	GETTING_STARTED_PRIVATE_SEARCH_WALKTHROUGH,
	isLocalAiSetupCompleted,
	LOCAL_AI_SETUP_COMPLETED_SETTING,
	markLocalAiSetupCompleted,
	SETUP_LOCAL_SEARCH_COMMAND,
} from '../localAiSetupCompletion';
import {
	advanceFromEducate,
	advanceFromScan,
	applyOcrResult,
	applyScanResult,
	applySearchPackResult,
	buildDoneSummary,
	createInitialSession,
	formatFriendlyHwSummary,
	skipToDone,
} from '../localAiSetupState';
import type { HwSnapshot } from '../types';

const eligibleSnapshot: HwSnapshot = {
	platform: 'linux',
	arch: 'x64',
	osRelease: '6.8.0',
	cpuModel: 'Test CPU',
	cpuCount: 16,
	totalRamMb: 32_768,
	freeRamMb: 16_384,
	diskFreeMb: 100_000,
	gpuVramMb: 12_288,
	gpuName: 'Test GPU',
	probedAt: 1,
};

suite('localAiSetupState', () => {
	test('friendly HW summary uses Ready for scanned PDFs when eligible', () => {
		const summary = formatFriendlyHwSummary(eligibleSnapshot, { eligible: true, reasons: [] });
		assert.deepStrictEqual(
			{ verdict: summary.verdict, verdictLabel: summary.verdictLabel },
			{ verdict: 'ready-for-scanned', verdictLabel: 'Ready for scanned PDFs' },
		);
		assert.ok(!/CUDA/i.test(summary.verdictLabel));
		assert.ok(!/CUDA/i.test(summary.reasonLine));
	});

	test('friendly HW summary uses Text PDFs only when ineligible', () => {
		const summary = formatFriendlyHwSummary(
			{ ...eligibleSnapshot, gpuVramMb: undefined, gpuName: undefined },
			{ eligible: false, reasons: ['Graphics memory unknown; needs at least 8192 MB'] },
		);
		assert.strictEqual(summary.verdict, 'text-pdfs-only');
		assert.strictEqual(summary.verdictLabel, 'Text PDFs only');
		assert.ok(summary.reasonLine.length > 0);
	});

	test('beat flow educate → scan → searchPack → ocr → done', () => {
		let session = createInitialSession();
		assert.strictEqual(session.beat, 'educate');

		session = applyScanResult(
			advanceFromEducate(session),
			eligibleSnapshot,
			{ eligible: true, reasons: [] },
		);
		assert.strictEqual(session.beat, 'scan');
		assert.strictEqual(session.ocrEligible, true);

		session = advanceFromScan(session);
		assert.strictEqual(session.beat, 'searchPack');

		session = applySearchPackResult(session, 'installed');
		assert.strictEqual(session.beat, 'ocr');

		session = applyOcrResult(session, 'skipped');
		assert.strictEqual(session.beat, 'done');

		const done = buildDoneSummary(session);
		assert.ok(done.searchPackLine.includes('installed'));
		assert.ok(done.ocrLine.includes('skipped'));
	});

	test('search pack failure stays on searchPack beat', () => {
		let session = createInitialSession();
		session = { ...session, beat: 'searchPack' };
		session = applySearchPackResult(session, 'failed', 'no downloadUrl');
		assert.strictEqual(session.beat, 'searchPack');
		assert.strictEqual(session.searchPack, 'failed');
		assert.strictEqual(session.searchPackError, 'no downloadUrl');
	});

	test('skipToDone marks pending choices skipped', () => {
		const session = skipToDone(createInitialSession());
		assert.strictEqual(session.beat, 'done');
		assert.strictEqual(session.searchPack, 'skipped');
		assert.strictEqual(session.ocr, 'ineligible');
	});

	test('ineligible OCR advances with calm ineligible choice', () => {
		let session = createInitialSession();
		session = applyScanResult(session, eligibleSnapshot, {
			eligible: false,
			reasons: ['not enough graphics memory'],
		});
		session = advanceFromScan(session);
		session = applySearchPackResult(session, 'skipped');
		assert.strictEqual(session.ocr, 'ineligible');
		session = applyOcrResult(session, 'ineligible');
		assert.strictEqual(session.beat, 'done');
		assert.ok(buildDoneSummary(session).ocrLine.includes('not offered'));
	});
});

suite('localAiSetupCompletion', () => {
	test('command id is stable', () => {
		assert.strictEqual(SETUP_LOCAL_SEARCH_COMMAND, 'safeappeals-rag.setupLocalSearch');
		assert.strictEqual(LOCAL_AI_SETUP_COMPLETED_SETTING, 'safeappeals.rag.localAiSetup.completed');
		assert.deepStrictEqual(GETTING_STARTED_PRIVATE_SEARCH_WALKTHROUGH, {
			category: 'safeappeals.safeappeals-timeline#safeappealsTimelineSetup',
			step: 'privateSearch',
		});
	});

	test('markLocalAiSetupCompleted writes machine setting', async () => {
		assert.strictEqual(isLocalAiSetupCompleted(), false);
		await markLocalAiSetupCompleted();
		assert.strictEqual(isLocalAiSetupCompleted(), true);
	});
});
