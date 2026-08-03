/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { createTimelineAgentTools } from '../agentTools';
import { TimelineService } from '../timelineService';

function toolText(result: vscode.LanguageModelToolResult): string {
	return result.content
		.map(part => part instanceof vscode.LanguageModelTextPart ? part.value : '')
		.join('');
}

function cancellationToken(): vscode.CancellationToken {
	return new vscode.CancellationTokenSource().token;
}

suite('timeline agentTools', () => {
	let tempDir: string;
	let service: TimelineService;
	let tools: ReturnType<typeof createTimelineAgentTools>;

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-timeline-tools-'));
		const folder: vscode.WorkspaceFolder = {
			uri: vscode.Uri.file(tempDir),
			name: path.basename(tempDir),
			index: 0,
		};
		service = new TimelineService(folder);
		tools = createTimelineAgentTools(() => service);
	});

	suiteTeardown(async () => {
		service.dispose();
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	test('mutating tools expose confirmationMessages; add/get/delete/link invoke path', async () => {
		const token = cancellationToken();

		const [addConfirm, updateConfirm, deleteConfirm, linkConfirm] = await Promise.all([
			tools.addEvent.prepareInvocation({
				input: { date: '2024-06-01', title: 'Hearing notice', category: 'hearing' },
			}, token),
			tools.updateEvent.prepareInvocation({
				input: { event_id: 'evt-1', title: 'Updated' },
			}, token),
			tools.deleteEvent.prepareInvocation({
				input: { event_id: 'evt-1' },
			}, token),
			tools.linkDocument.prepareInvocation({
				input: { event_id: 'evt-1', document_uri: 'docs/notice.pdf' },
			}, token),
		]);

		const addResult = await tools.addEvent.invoke({
			toolInvocationToken: undefined,
			input: { date: '2024-06-01', title: 'Hearing notice', category: 'hearing' },
		}, token);
		const addText = toolText(addResult);
		const eventId = /id: (\S+)/.exec(addText)?.[1] ?? '';

		const getAfterAdd = toolText(await tools.getEvents.invoke({
			toolInvocationToken: undefined,
			input: {},
		}, token));
		const linkResult = toolText(await tools.linkDocument.invoke({
			toolInvocationToken: undefined,
			input: { event_id: eventId, document_uri: 'docs/notice.pdf' },
		}, token));
		const deleteResult = toolText(await tools.deleteEvent.invoke({
			toolInvocationToken: undefined,
			input: { event_id: eventId },
		}, token));
		const getAfterDelete = toolText(await tools.getEvents.invoke({
			toolInvocationToken: undefined,
			input: {},
		}, token));

		assert.deepStrictEqual(
			{
				confirmations: {
					add: addConfirm.confirmationMessages,
					update: updateConfirm.confirmationMessages,
					delete: deleteConfirm.confirmationMessages,
					link: linkConfirm.confirmationMessages,
				},
				invoke: {
					added: addText.startsWith('Added timeline event.') && addText.includes('Hearing notice'),
					eventIdPresent: eventId.length > 0,
					getHasTitle: getAfterAdd.includes('Hearing notice'),
					linked: linkResult.includes('docs/notice.pdf'),
					deleted: deleteResult === `Deleted timeline event ${eventId}.`,
					getEmptyAfterDelete: getAfterDelete === 'No timeline events matched.',
				},
			},
			{
				confirmations: {
					add: {
						title: 'Add Timeline Event',
						message: 'Add event to .safeAppeals/timeline.json:\n2024-06-01 — Hearing notice',
					},
					update: {
						title: 'Update Timeline Event',
						message: 'Update event evt-1 in .safeAppeals/timeline.json',
					},
					delete: {
						title: 'Delete Timeline Event',
						message: 'Permanently delete event evt-1 from .safeAppeals/timeline.json',
					},
					link: {
						title: 'Link Document to Timeline',
						message: 'Link document to event evt-1:\ndocs/notice.pdf',
					},
				},
				invoke: {
					added: true,
					eventIdPresent: true,
					getHasTitle: true,
					linked: true,
					deleted: true,
					getEmptyAfterDelete: true,
				},
			},
		);
	});
});
