/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BrowserWindow } from 'electron';
import { Event } from '../../../../base/common/event.js';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { ILogService } from '../../../../platform/log/common/log.js';

/**
 * Channel identifier for document export IPC
 */
export const DOCUMENT_EXPORT_CHANNEL_ID = 'void:documentExport';

/**
 * Data sent from browser to main for PDF generation
 */
export interface DocumentExportData {
	html: string;
	title?: string;
	pageSize?: 'Letter' | 'Legal' | 'Tabloid' | 'Ledger' | 'A3' | 'A4' | 'A5';
	landscape?: boolean;
}

/**
 * IPC Channel handler for document export operations
 */
export class DocumentExportChannel implements IServerChannel {
	constructor(
		@ILogService private readonly logService: ILogService
	) { }

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not supported: ${event}`);
	}

	async call(_: unknown, command: string, arg?: any): Promise<any> {
		switch (command) {
			case 'exportToPDF': {
				return this.exportToPDF(arg as DocumentExportData);
			}
			default:
				throw new Error(`Command not supported: ${command}`);
		}
	}

	/**
	 * Export document HTML to PDF.
	 * Returns base64-encoded PDF data for reliable IPC transfer.
	 * (VSCode pattern: binary data is base64 encoded for IPC, see ipc.cp.ts)
	 */
	private async exportToPDF(data: DocumentExportData): Promise<string> {
		this.logService.info('[DocumentExportChannel] Starting PDF export');

		try {
			// Create a hidden browser window for rendering
			const win = new BrowserWindow({
				show: false,
				width: 800,
				height: 600,
				webPreferences: {
					offscreen: true
				}
			});

			this.logService.info('[DocumentExportChannel] Loading HTML content...');

			// Load HTML into the window - loadURL() already waits for load to complete
			await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(data.html)}`);

			// Additional delay to ensure CSS/fonts are fully applied
			await new Promise<void>((resolve) => setTimeout(resolve, 500));

			this.logService.info('[DocumentExportChannel] Generating PDF...');

			// Generate PDF
			const pdfBuffer = await win.webContents.printToPDF({
				printBackground: true,
				landscape: data.landscape || false,
				pageSize: data.pageSize || 'Letter',
				margins: {
					top: 0.5,
					bottom: 0.5,
					left: 0.5,
					right: 0.5
				}
			});

			// Cleanup
			win.close();

			this.logService.info('[DocumentExportChannel] PDF export complete, size:', pdfBuffer.length);

			// Return as base64 string for reliable IPC transfer
			// This is the VSCode pattern - binary data doesn't survive IPC as typed arrays
			return Buffer.from(pdfBuffer).toString('base64');

		} catch (error) {
			this.logService.error('[DocumentExportChannel] PDF export failed:', error);
			throw error;
		}
	}
}

