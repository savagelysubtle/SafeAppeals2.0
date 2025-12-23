/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { BrowserWindow } from 'electron';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Event } from '../../../../base/common/event.js';
import { CaseTimeline, TimelineEvent, JurisdictionConfig, formatTimelineDate } from '../common/timeline/timelineTypes.js';

/**
 * Channel identifier for timeline export IPC
 */
export const TIMELINE_EXPORT_CHANNEL_ID = 'void:timelineExport';

/**
 * Data sent from browser to main for PDF generation
 */
export interface TimelineExportData {
	timeline: CaseTimeline;
	jurisdiction: JurisdictionConfig | undefined;
}

/**
 * HTML template generator for timeline export
 */
function generateTimelineHTML(data: TimelineExportData): string {
	const { timeline, jurisdiction } = data;

	const sortedEvents = [...timeline.events].sort(
		(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
	);

	const eventsHTML = sortedEvents.map((event, idx) => `
		<div class="event ${event.isDeadline ? 'deadline' : ''} ${event.isComplete ? 'complete' : ''}">
			<div class="event-dot" style="background-color: ${getCategoryColor(event.category)};"></div>
			<div class="event-content">
				<div class="event-header">
					<span class="event-category" style="color: ${getCategoryColor(event.category)};">${getCategoryLabel(event.category)}</span>
					${event.isDeadline ? '<span class="deadline-badge">Deadline</span>' : ''}
					${event.isComplete ? '<span class="complete-badge">Complete</span>' : ''}
				</div>
				<h3 class="event-title">${escapeHtml(event.title)}</h3>
				<p class="event-date">${formatTimelineDate(event.date)}${event.endDate ? ` → ${formatTimelineDate(event.endDate)}` : ''}</p>
				${event.description ? `<p class="event-description">${escapeHtml(event.description)}</p>` : ''}
				${event.linkedDocuments.length > 0 ? `
					<div class="linked-docs">
						<span class="docs-label">Linked Documents:</span>
						${event.linkedDocuments.map(d => `<span class="doc">${getFileName(d)}</span>`).join('')}
					</div>
				` : ''}
				${event.tags && event.tags.length > 0 ? `
					<div class="tags">
						${event.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}
					</div>
				` : ''}
			</div>
		</div>
	`).join('');

	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>Case Timeline - ${escapeHtml(timeline.caseName || timeline.caseId)}</title>
	<style>
		* {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			background: #ffffff;
			color: #1a1a1a;
			line-height: 1.5;
			padding: 40px;
		}
		.header {
			border-bottom: 3px solid #22c55e;
			padding-bottom: 24px;
			margin-bottom: 32px;
		}
		.header h1 {
			font-size: 28px;
			font-weight: 700;
			color: #0a0a0a;
			margin-bottom: 8px;
		}
		.header .subtitle {
			font-size: 14px;
			color: #71717a;
		}
		.header .meta {
			display: flex;
			gap: 24px;
			margin-top: 16px;
			font-size: 13px;
		}
		.header .meta-item {
			display: flex;
			align-items: center;
			gap: 6px;
		}
		.header .meta-label {
			color: #71717a;
		}
		.header .meta-value {
			color: #1a1a1a;
			font-weight: 500;
		}
		.timeline {
			position: relative;
			padding-left: 24px;
		}
		.timeline::before {
			content: '';
			position: absolute;
			left: 8px;
			top: 0;
			bottom: 0;
			width: 2px;
			background: linear-gradient(to bottom, #22c55e, #22c55e40);
		}
		.event {
			position: relative;
			margin-bottom: 24px;
			padding: 16px 20px;
			background: #fafafa;
			border: 1px solid #e4e4e7;
			border-radius: 8px;
		}
		.event.deadline {
			border-left: 3px solid #ef4444;
		}
		.event.complete {
			opacity: 0.7;
		}
		.event-dot {
			position: absolute;
			left: -20px;
			top: 20px;
			width: 12px;
			height: 12px;
			border-radius: 50%;
			border: 2px solid #ffffff;
			box-shadow: 0 0 0 2px #e4e4e7;
		}
		.event-header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 8px;
		}
		.event-category {
			font-size: 11px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}
		.deadline-badge {
			font-size: 10px;
			background: #fef2f2;
			color: #ef4444;
			padding: 2px 6px;
			border-radius: 4px;
			font-weight: 600;
		}
		.complete-badge {
			font-size: 10px;
			background: #f0fdf4;
			color: #22c55e;
			padding: 2px 6px;
			border-radius: 4px;
			font-weight: 600;
		}
		.event-title {
			font-size: 16px;
			font-weight: 600;
			color: #0a0a0a;
			margin-bottom: 4px;
		}
		.event-date {
			font-size: 13px;
			color: #71717a;
			margin-bottom: 8px;
		}
		.event-description {
			font-size: 14px;
			color: #52525b;
			margin-bottom: 8px;
			white-space: pre-wrap;
		}
		.linked-docs {
			font-size: 12px;
			color: #71717a;
			margin-top: 12px;
			padding-top: 12px;
			border-top: 1px solid #e4e4e7;
		}
		.docs-label {
			font-weight: 500;
			margin-right: 8px;
		}
		.doc {
			display: inline-block;
			background: #f4f4f5;
			padding: 2px 8px;
			border-radius: 4px;
			margin-right: 4px;
			margin-bottom: 4px;
		}
		.tags {
			margin-top: 8px;
		}
		.tag {
			font-size: 12px;
			color: #71717a;
			margin-right: 8px;
		}
		.footer {
			margin-top: 40px;
			padding-top: 20px;
			border-top: 1px solid #e4e4e7;
			font-size: 12px;
			color: #a1a1aa;
			text-align: center;
		}
		@media print {
			body {
				padding: 20px;
			}
			.event {
				break-inside: avoid;
			}
		}
	</style>
</head>
<body>
	<div class="header">
		<h1>Case Timeline</h1>
		<p class="subtitle">${escapeHtml(timeline.caseName || 'Case ' + timeline.caseId)}</p>
		<div class="meta">
			${jurisdiction ? `
				<div class="meta-item">
					<span class="meta-label">Jurisdiction:</span>
					<span class="meta-value">${escapeHtml(jurisdiction.name)}</span>
				</div>
			` : ''}
			${timeline.injuryDate ? `
				<div class="meta-item">
					<span class="meta-label">Injury Date:</span>
					<span class="meta-value">${formatTimelineDate(timeline.injuryDate)}</span>
				</div>
			` : ''}
			<div class="meta-item">
				<span class="meta-label">Events:</span>
				<span class="meta-value">${timeline.events.length}</span>
			</div>
		</div>
	</div>

	<div class="timeline">
		${eventsHTML}
	</div>

	<div class="footer">
		Generated by SafeAppeals on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
	</div>
</body>
</html>
`;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function getFileName(uri: string): string {
	const parts = uri.split('/');
	return parts[parts.length - 1] || uri;
}

function getCategoryColor(category: string): string {
	const colors: Record<string, string> = {
		injury: '#ef4444',
		medical: '#3b82f6',
		hearing: '#8b5cf6',
		decision: '#f59e0b',
		deadline: '#dc2626',
		filing: '#10b981',
		correspondence: '#6b7280',
		custom: '#64748b'
	};
	return colors[category] || '#64748b';
}

function getCategoryLabel(category: string): string {
	const labels: Record<string, string> = {
		injury: 'Injury',
		medical: 'Medical',
		hearing: 'Hearing',
		decision: 'Decision',
		deadline: 'Deadline',
		filing: 'Filing',
		correspondence: 'Correspondence',
		custom: 'Custom'
	};
	return labels[category] || 'Custom';
}

/**
 * IPC Channel handler for timeline export operations
 */
export class TimelineExportChannel implements IServerChannel {
	constructor(
		@ILogService private readonly logService: ILogService
	) {}

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not supported: ${event}`);
	}

	async call(_: unknown, command: string, arg?: any): Promise<any> {
		switch (command) {
			case 'exportToPDF': {
				return this.exportToPDF(arg as TimelineExportData);
			}
			default:
				throw new Error(`Command not supported: ${command}`);
		}
	}

	private async exportToPDF(data: TimelineExportData): Promise<Uint8Array> {
		this.logService.info('[TimelineExportChannel] Starting PDF export');

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

			// Generate HTML content
			const html = generateTimelineHTML(data);

			// Load HTML into the window
			await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

			// Wait for content to render
			await new Promise(resolve => setTimeout(resolve, 500));

			// Generate PDF
			const pdfBuffer = await win.webContents.printToPDF({
				printBackground: true,
				landscape: false,
				pageSize: 'Letter',
				margins: {
					top: 0.5,
					bottom: 0.5,
					left: 0.5,
					right: 0.5
				}
			});

			// Cleanup
			win.close();

			this.logService.info('[TimelineExportChannel] PDF export complete', pdfBuffer.length);
			return new Uint8Array(pdfBuffer);

		} catch (error) {
			this.logService.error('[TimelineExportChannel] PDF export failed:', error);
			throw error;
		}
	}
}

