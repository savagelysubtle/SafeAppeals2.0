/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { calculateStatuteDeadline } from '../jurisdictionConfig';
import { TimelineService } from '../timelineService';
import {
	createEmptyTimeline,
	parseTimelineDocument,
	serializeTimeline,
} from '../timelineStore';
import { applyTimelineEventUpdates, generateEventId } from '../timelineTypes';
import { jurisdictionLabel, normalizeJurisdictionId } from '../types';

suite('timelineEngine', () => {
	test('statute deadline and store round-trip', () => {
		const injury = new Date(2024, 2, 1); // local Mar 1, 2024
		const bcDeadline = calculateStatuteDeadline(injury, 'bc-wcb');
		const ontarioDeadline = calculateStatuteDeadline(injury, 'ontario-wsib');
		const aliased = calculateStatuteDeadline(injury, normalizeJurisdictionId('BC WCB'));

		const timeline = createEmptyTimeline('BC WCB');
		timeline.injuryDate = '2024-03-01';
		timeline.events = [
			{
				id: generateEventId(),
				date: '2024-03-01',
				title: 'Date of injury',
				category: 'injury',
				isDeadline: false,
				linkedDocuments: [],
				source: 'injury',
				createdAt: '2024-03-01T00:00:00.000Z',
				updatedAt: '2024-03-01T00:00:00.000Z',
			},
			{
				id: generateEventId(),
				date: '2024-05-30',
				title: 'Statute of limitations',
				category: 'deadline',
				isDeadline: true,
				isComplete: false,
				linkedDocuments: [],
				reminderDays: [30, 14, 7],
				source: 'statute',
				createdAt: '2024-03-01T00:00:00.000Z',
				updatedAt: '2024-03-01T00:00:00.000Z',
			},
		];

		const serialized = serializeTimeline(timeline);
		const parsed = parseTimelineDocument(JSON.parse(serialized));
		const legacyParsed = parseTimelineDocument({
			version: '1.0',
			jurisdiction: 'Ontario WSIB',
			injuryDate: '2024-01-15',
			events: [
				{
					id: 'evt_legacy',
					date: '2024-01-15',
					title: 'Injury',
					category: 'injury',
					isDeadline: false,
					linkedDocuments: [],
				},
			],
			notificationsEnabled: true,
		});

		assert.deepStrictEqual({
			normalize: {
				slug: normalizeJurisdictionId('bc-wcb'),
				alias: normalizeJurisdictionId('BC WCB'),
				label: jurisdictionLabel('bc-wcb'),
			},
			statuteDays: {
				bc: Math.round((bcDeadline.getTime() - injury.getTime()) / (24 * 60 * 60 * 1000)),
				ontario: Math.round((ontarioDeadline.getTime() - injury.getTime()) / (24 * 60 * 60 * 1000)),
				aliasedMatchesBc: aliased.getTime() === bcDeadline.getTime(),
			},
			roundTrip: {
				jurisdictionId: parsed.jurisdictionId,
				injuryDate: parsed.injuryDate,
				eventCount: parsed.events.length,
				notificationsEnabled: parsed.notificationsEnabled,
				version: parsed.version,
				firstCategory: parsed.events[0]?.category,
				deadlineSource: parsed.events[1]?.source,
			},
			legacy: {
				jurisdictionId: legacyParsed.jurisdictionId,
				injuryDate: legacyParsed.injuryDate,
				eventCount: legacyParsed.events.length,
				firstId: legacyParsed.events[0]?.id,
			},
		}, {
			normalize: {
				slug: 'bc-wcb',
				alias: 'bc-wcb',
				label: 'BC WCB',
			},
			statuteDays: {
				bc: 90,
				ontario: 30,
				aliasedMatchesBc: true,
			},
			roundTrip: {
				jurisdictionId: 'bc-wcb',
				injuryDate: '2024-03-01',
				eventCount: 2,
				notificationsEnabled: true,
				version: 1,
				firstCategory: 'injury',
				deadlineSource: 'statute',
			},
			legacy: {
				jurisdictionId: 'ontario-wsib',
				injuryDate: '2024-01-15',
				eventCount: 1,
				firstId: 'evt_legacy',
			},
		});
	});
});

suite('timelineService updateEvent clears', () => {
	let tempDir: string;
	let service: TimelineService;

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-timeline-clear-'));
		const folder: vscode.WorkspaceFolder = {
			uri: vscode.Uri.file(tempDir),
			name: path.basename(tempDir),
			index: 0,
		};
		service = new TimelineService(folder);
	});

	suiteTeardown(async () => {
		service.dispose();
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	test('updateEvent with endDate "" clears previous endDate; deadline off clears reminderDays/isComplete', async () => {
		const created = await service.addEvent({
			date: '2025-02-01',
			endDate: '2025-02-10',
			title: 'Hearing window',
			category: 'hearing',
			isDeadline: true,
			isComplete: true,
			linkedDocuments: [],
			reminderDays: [7, 3, 1],
			source: 'manual',
		});

		const clearedEnd = await service.updateEvent(created.id, { endDate: '' });
		const clearedDeadline = await service.updateEvent(created.id, { isDeadline: false });
		const pureClear = applyTimelineEventUpdates({
			id: 'pure',
			date: '2025-01-01',
			endDate: '2025-01-05',
			title: 'Pure',
			category: 'custom',
			isDeadline: true,
			isComplete: false,
			linkedDocuments: [],
			reminderDays: [14, 7],
			createdAt: '2025-01-01T00:00:00.000Z',
			updatedAt: '2025-01-01T00:00:00.000Z',
		}, {
			endDate: null,
			isDeadline: false,
			reminderDays: null,
			isComplete: null,
		});

		assert.deepStrictEqual({
			afterEndClear: {
				endDate: clearedEnd.endDate,
				stillDeadline: clearedEnd.isDeadline,
				reminderDays: clearedEnd.reminderDays,
				isComplete: clearedEnd.isComplete,
			},
			afterDeadlineOff: {
				endDate: clearedDeadline.endDate,
				isDeadline: clearedDeadline.isDeadline,
				reminderDays: clearedDeadline.reminderDays,
				isComplete: clearedDeadline.isComplete,
			},
			pure: {
				endDate: pureClear.endDate,
				isDeadline: pureClear.isDeadline,
				reminderDays: pureClear.reminderDays,
				isComplete: pureClear.isComplete,
			},
		}, {
			afterEndClear: {
				endDate: undefined,
				stillDeadline: true,
				reminderDays: [7, 3, 1],
				isComplete: true,
			},
			afterDeadlineOff: {
				endDate: undefined,
				isDeadline: false,
				reminderDays: undefined,
				isComplete: undefined,
			},
			pure: {
				endDate: undefined,
				isDeadline: false,
				reminderDays: undefined,
				isComplete: undefined,
			},
		});
	});
});
