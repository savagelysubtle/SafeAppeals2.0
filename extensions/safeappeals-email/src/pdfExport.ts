/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs';
import PDFDocument from 'pdfkit';
import type { EmailMessage } from './types';

export interface PdfLabels {
	readonly noSubject: string;
	readonly from: string;
	readonly to: string;
	readonly cc: string;
	readonly bcc: string;
	readonly date: string;
	readonly messageBody: string;
	readonly empty: string;
	readonly attachments: string;
}

export interface PdfDocumentLike {
	fontSize(size: number): PdfDocumentLike;
	font(name: string): PdfDocumentLike;
	text(text: string, options?: { readonly continued?: boolean; readonly underline?: boolean; readonly paragraphGap?: number }): PdfDocumentLike;
	moveDown(lines?: number): PdfDocumentLike;
	addPage(): PdfDocumentLike;
	pipe(stream: NodeJS.WritableStream): NodeJS.WritableStream;
	end(): void;
	once(event: 'error', listener: (error: Error) => void): PdfDocumentLike;
}

export function sanitizePdfFilename(name: string): string {
	const safe = name
		.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
		.replace(/\s+/g, ' ')
		.replace(/[. ]+$/g, '')
		.trim()
		.slice(0, 200);
	return /[\p{L}\p{N}]/u.test(safe) ? safe : 'email';
}

export function generateEmailPdf(
	message: EmailMessage,
	filePath: string,
	labels: PdfLabels,
	createDocument: () => PdfDocumentLike = () => new PDFDocument({ margin: 50 }),
	createStream: (target: string) => NodeJS.WritableStream = target => fs.createWriteStream(target),
): Promise<void> {
	return new Promise((resolve, reject) => {
		const doc = createDocument();
		const stream = createStream(filePath);
		let settled = false;
		const finish = (error?: Error) => {
			if (settled) {
				return;
			}
			settled = true;
			error ? reject(error) : resolve();
		};
		stream.once('finish', () => finish());
		stream.once('error', error => finish(error instanceof Error ? error : new Error(String(error))));
		doc.once('error', error => finish(error instanceof Error ? error : new Error(String(error))));
		doc.pipe(stream);

		doc.fontSize(18).font('Helvetica-Bold').text(message.subject || labels.noSubject);
		doc.moveDown(0.5);
		doc.fontSize(10).font('Helvetica');
		const metadata = [
			{ label: labels.from, value: message.from },
			{ label: labels.to, value: message.to },
		];
		if (message.cc) {
			metadata.push({ label: labels.cc, value: message.cc });
		}
		if (message.bcc) {
			metadata.push({ label: labels.bcc, value: message.bcc });
		}
		metadata.push({ label: labels.date, value: new Date(message.date).toLocaleString() });
		for (const item of metadata) {
			doc.font('Helvetica-Bold').text(`${item.label}: `, { continued: true });
			doc.font('Helvetica').text(item.value);
		}
		doc.moveDown();
		doc.fontSize(12).font('Helvetica-Bold').text(labels.messageBody, { underline: true });
		doc.moveDown(0.5);
		doc.fontSize(10).font('Helvetica').text(message.bodyText || labels.empty, { paragraphGap: 6 });

		if (message.attachments?.length) {
			doc.addPage();
			doc.fontSize(12).font('Helvetica-Bold').text(labels.attachments, { underline: true });
			doc.moveDown(0.5);
			doc.fontSize(10).font('Helvetica');
			for (const attachment of message.attachments) {
				const size = attachment.size ? ` (${formatFileSize(attachment.size)})` : '';
				doc.text(`• ${attachment.filename}${size} [${attachment.contentType}]`);
			}
		}
		doc.end();
	});
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
