/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'node:assert';
import { EventEmitter } from 'node:events';
import type { EmailMessage } from '../types';
import { generateEmailPdf, sanitizePdfFilename, type PdfDocumentLike, type PdfLabels } from '../pdfExport';

const labels: PdfLabels = {
	noSubject: 'NO SUBJECT', from: 'FROM', to: 'TO', cc: 'CC', bcc: 'BCC', date: 'DATE',
	messageBody: 'BODY', empty: 'EMPTY', attachments: 'ATTACHMENTS',
};

class FakeDocument extends EventEmitter implements PdfDocumentLike {
	readonly textValues: string[] = [];
	pageCount = 1;
	constructor(private readonly output: EventEmitter, private readonly failure?: Error) { super(); }
	fontSize(): this { return this; }
	font(): this { return this; }
	text(value: string): this { this.textValues.push(value); return this; }
	moveDown(): this { return this; }
	addPage(): this { this.pageCount += 1; return this; }
	pipe(stream: NodeJS.WritableStream): NodeJS.WritableStream { return stream; }
	end(): void {
		this.failure ? this.output.emit('error', this.failure) : this.output.emit('finish');
	}
}

function message(overrides: Partial<EmailMessage> = {}): EmailMessage {
	return {
		id: 'm1', accountId: 'a1', folder: 'INBOX', uid: 1, threadId: 't1', subject: 'Subject',
		from: 'sender@example.com', to: 'recipient@example.com', date: '2026-01-02T03:04:05Z',
		snippet: 'Body', bodyText: 'Complete body', bodyLoaded: true, isStarred: false,
		hasAttachments: false, attachments: [],
		...overrides,
	};
}

suite('PDF export', () => {
	test('sanitizes unsafe and empty filenames', () => {
		assert.deepStrictEqual(
			[sanitizePdfFilename('../CON: bad?. '), sanitizePdfFilename('\u0000   ')],
			['.._CON_ bad_', 'email'],
		);
	});

	test('writes localized metadata, complete body, and attachment listing', async () => {
		const output = new EventEmitter();
		const document = new FakeDocument(output);
		await generateEmailPdf(message({
			cc: 'copy@example.com', bcc: 'blind@example.com',
			attachments: [{ filename: 'brief.pdf', contentType: 'application/pdf', size: 2048 }],
		}), '/tmp/out.pdf', labels, () => document, () => output as NodeJS.WritableStream);
		assert.deepStrictEqual({ text: document.textValues, pages: document.pageCount }, {
			text: [
				'Subject', 'FROM: ', 'sender@example.com', 'TO: ', 'recipient@example.com',
				'CC: ', 'copy@example.com', 'BCC: ', 'blind@example.com', 'DATE: ',
				new Date('2026-01-02T03:04:05Z').toLocaleString(), 'BODY', 'Complete body',
				'ATTACHMENTS', '• brief.pdf (2.0 KB) [application/pdf]',
			],
			pages: 2,
		});
	});

	test('rejects output stream errors', async () => {
		const output = new EventEmitter();
		const document = new FakeDocument(output, new Error('disk full'));
		await assert.rejects(
			generateEmailPdf(message(), '/tmp/out.pdf', labels, () => document, () => output as NodeJS.WritableStream),
			/disk full/,
		);
	});
});
