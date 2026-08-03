/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import type { TimelineService } from './timelineService';
import { isEventCategory, TimelineEvent } from './timelineTypes';

export const TIMELINE_ADD_EVENT_TOOL = 'timeline_add_event';
export const TIMELINE_UPDATE_EVENT_TOOL = 'timeline_update_event';
export const TIMELINE_DELETE_EVENT_TOOL = 'timeline_delete_event';
export const TIMELINE_GET_EVENTS_TOOL = 'timeline_get_events';
export const TIMELINE_LINK_DOCUMENT_TOOL = 'timeline_link_document';
export const TIMELINE_GET_DEADLINES_TOOL = 'timeline_get_deadlines';

export const TIMELINE_TOOL_NAMES = [
	TIMELINE_ADD_EVENT_TOOL,
	TIMELINE_UPDATE_EVENT_TOOL,
	TIMELINE_DELETE_EVENT_TOOL,
	TIMELINE_GET_EVENTS_TOOL,
	TIMELINE_LINK_DOCUMENT_TOOL,
	TIMELINE_GET_DEADLINES_TOOL,
] as const;

interface AddEventInput {
	date: string;
	title: string;
	description?: string;
	category: string;
	is_deadline?: boolean;
	linked_documents?: string[];
}

interface UpdateEventInput {
	event_id: string;
	date?: string;
	title?: string;
	description?: string;
	category?: string;
	is_deadline?: boolean;
	is_complete?: boolean;
}

interface DeleteEventInput {
	event_id: string;
}

interface GetEventsInput {
	category?: string;
	start_date?: string;
	end_date?: string;
	is_deadline?: boolean;
	limit?: number;
}

interface LinkDocumentInput {
	event_id: string;
	document_uri: string;
}

interface GetDeadlinesInput {
	days_ahead?: number;
}

function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

function formatEvent(event: TimelineEvent): string {
	const parts = [
		`id: ${event.id}`,
		`date: ${event.date}`,
		`title: ${event.title}`,
		`category: ${event.category}`,
		`isDeadline: ${event.isDeadline}`,
	];
	if (event.isComplete !== undefined) {
		parts.push(`isComplete: ${event.isComplete}`);
	}
	if (event.description) {
		parts.push(`description: ${event.description}`);
	}
	if (event.source) {
		parts.push(`source: ${event.source}`);
	}
	if (event.linkedDocuments.length > 0) {
		parts.push(`linkedDocuments: ${event.linkedDocuments.join(', ')}`);
	}
	return parts.join('\n');
}

function resolveDocumentUri(documentUri: string): string | undefined {
	const trimmed = documentUri?.trim();
	if (!trimmed) {
		return undefined;
	}
	const folders = vscode.workspace.workspaceFolders ?? [];
	if (folders.length === 0) {
		return trimmed;
	}
	try {
		if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
			return vscode.Uri.parse(trimmed).toString();
		}
		if (trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)) {
			return vscode.Uri.file(path.resolve(trimmed)).toString();
		}
		return vscode.Uri.joinPath(folders[0].uri, trimmed).toString();
	} catch {
		return trimmed;
	}
}

class TimelineAddEventTool implements vscode.LanguageModelTool<AddEventInput> {
	constructor(private readonly getService: () => TimelineService | undefined) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<AddEventInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const title = options.input?.title ?? '(untitled)';
		const date = options.input?.date ?? '(no date)';
		return {
			invocationMessage: `Adding timeline event: ${title}`,
			confirmationMessages: {
				title: 'Add Timeline Event',
				message: `Add event to .safeAppeals/timeline.json:\n${date} — ${title}`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<AddEventInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const service = this.getService();
		if (!service) {
			return textResult('Error: open a workspace folder to use timeline tools.');
		}
		const input = options.input;
		const date = input?.date?.trim() ?? '';
		const title = input?.title?.trim() ?? '';
		const category = input?.category?.trim() ?? '';
		if (!date) {
			return textResult('Error: "date" is required (ISO 8601).');
		}
		if (!title) {
			return textResult('Error: "title" is required.');
		}
		if (!isEventCategory(category)) {
			return textResult(
				`Error: "category" must be one of: injury, medical, hearing, decision, deadline, filing, correspondence, custom.`,
			);
		}
		try {
			const linked = (input.linked_documents ?? [])
				.map(d => resolveDocumentUri(d))
				.filter((d): d is string => !!d);
			const event = await service.addEvent({
				date,
				title,
				description: input.description?.trim() || undefined,
				category,
				isDeadline: input.is_deadline === true || category === 'deadline',
				linkedDocuments: linked,
				source: 'manual',
			});
			return textResult(`Added timeline event.\n${formatEvent(event)}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error adding event: ${message}`);
		}
	}
}

class TimelineUpdateEventTool implements vscode.LanguageModelTool<UpdateEventInput> {
	constructor(private readonly getService: () => TimelineService | undefined) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<UpdateEventInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const id = options.input?.event_id ?? '(unknown)';
		return {
			invocationMessage: `Updating timeline event ${id}`,
			confirmationMessages: {
				title: 'Update Timeline Event',
				message: `Update event ${id} in .safeAppeals/timeline.json`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<UpdateEventInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const service = this.getService();
		if (!service) {
			return textResult('Error: open a workspace folder to use timeline tools.');
		}
		const input = options.input;
		const eventId = input?.event_id?.trim() ?? '';
		if (!eventId) {
			return textResult('Error: "event_id" is required.');
		}
		if (input.category !== undefined && !isEventCategory(input.category)) {
			return textResult(
				`Error: "category" must be one of: injury, medical, hearing, decision, deadline, filing, correspondence, custom.`,
			);
		}
		try {
			await service.loadTimeline();
			const updates: Partial<TimelineEvent> = {};
			if (input.date !== undefined) {
				updates.date = input.date;
			}
			if (input.title !== undefined) {
				updates.title = input.title;
			}
			if (input.description !== undefined) {
				updates.description = input.description;
			}
			if (input.category !== undefined && isEventCategory(input.category)) {
				updates.category = input.category;
			}
			if (input.is_deadline !== undefined) {
				updates.isDeadline = input.is_deadline;
			}
			if (input.is_complete !== undefined) {
				updates.isComplete = input.is_complete;
			}
			const updated = await service.updateEvent(eventId, updates);
			return textResult(`Updated timeline event.\n${formatEvent(updated)}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error updating event: ${message}`);
		}
	}
}

class TimelineDeleteEventTool implements vscode.LanguageModelTool<DeleteEventInput> {
	constructor(private readonly getService: () => TimelineService | undefined) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<DeleteEventInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const id = options.input?.event_id ?? '(unknown)';
		return {
			invocationMessage: `Deleting timeline event ${id}`,
			confirmationMessages: {
				title: 'Delete Timeline Event',
				message: `Permanently delete event ${id} from .safeAppeals/timeline.json`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<DeleteEventInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const service = this.getService();
		if (!service) {
			return textResult('Error: open a workspace folder to use timeline tools.');
		}
		const eventId = options.input?.event_id?.trim() ?? '';
		if (!eventId) {
			return textResult('Error: "event_id" is required.');
		}
		try {
			await service.loadTimeline();
			await service.deleteEvent(eventId);
			return textResult(`Deleted timeline event ${eventId}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error deleting event: ${message}`);
		}
	}
}

class TimelineGetEventsTool implements vscode.LanguageModelTool<GetEventsInput> {
	constructor(private readonly getService: () => TimelineService | undefined) { }

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<GetEventsInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const service = this.getService();
		if (!service) {
			return textResult('Error: open a workspace folder to use timeline tools.');
		}
		try {
			await service.loadTimeline();
			const input = options.input ?? {};
			let events = service.getEventsSorted(true);
			if (input.category) {
				if (!isEventCategory(input.category)) {
					return textResult(
						`Error: "category" must be one of: injury, medical, hearing, decision, deadline, filing, correspondence, custom.`,
					);
				}
				events = events.filter(e => e.category === input.category);
			}
			if (input.start_date) {
				const start = new Date(input.start_date).getTime();
				events = events.filter(e => new Date(e.date).getTime() >= start);
			}
			if (input.end_date) {
				const end = new Date(input.end_date).getTime();
				events = events.filter(e => new Date(e.date).getTime() <= end);
			}
			if (input.is_deadline === true) {
				events = events.filter(e => e.isDeadline);
			} else if (input.is_deadline === false) {
				events = events.filter(e => !e.isDeadline);
			}
			const limit = typeof input.limit === 'number' && input.limit > 0 ? input.limit : 50;
			events = events.slice(0, limit);
			if (events.length === 0) {
				return textResult('No timeline events matched.');
			}
			return textResult(
				`Found ${events.length} event(s).\n\n` +
				events.map((e, i) => `[${i + 1}]\n${formatEvent(e)}`).join('\n\n'),
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error reading events: ${message}`);
		}
	}
}

class TimelineLinkDocumentTool implements vscode.LanguageModelTool<LinkDocumentInput> {
	constructor(private readonly getService: () => TimelineService | undefined) { }

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<LinkDocumentInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const id = options.input?.event_id ?? '(unknown)';
		const doc = options.input?.document_uri ?? '(unknown)';
		return {
			invocationMessage: `Linking document to timeline event ${id}`,
			confirmationMessages: {
				title: 'Link Document to Timeline',
				message: `Link document to event ${id}:\n${doc}`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<LinkDocumentInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const service = this.getService();
		if (!service) {
			return textResult('Error: open a workspace folder to use timeline tools.');
		}
		const eventId = options.input?.event_id?.trim() ?? '';
		const documentUri = resolveDocumentUri(options.input?.document_uri ?? '');
		if (!eventId) {
			return textResult('Error: "event_id" is required.');
		}
		if (!documentUri) {
			return textResult('Error: "document_uri" is required.');
		}
		try {
			await service.loadTimeline();
			const event = await service.linkDocument(eventId, documentUri);
			return textResult(`Linked document to event.\n${formatEvent(event)}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error linking document: ${message}`);
		}
	}
}

class TimelineGetDeadlinesTool implements vscode.LanguageModelTool<GetDeadlinesInput> {
	constructor(private readonly getService: () => TimelineService | undefined) { }

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<GetDeadlinesInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const service = this.getService();
		if (!service) {
			return textResult('Error: open a workspace folder to use timeline tools.');
		}
		try {
			await service.loadTimeline();
			const daysAhead = typeof options.input?.days_ahead === 'number' && options.input.days_ahead > 0
				? options.input.days_ahead
				: 30;
			const overdue = service.getOverdueDeadlines();
			const upcoming = service.getUpcomingDeadlines(daysAhead);
			const lines: string[] = [
				`Deadlines (overdue + upcoming within ${daysAhead} days)`,
				`Overdue: ${overdue.length}`,
				`Upcoming: ${upcoming.length}`,
			];
			if (overdue.length > 0) {
				lines.push('', '## Overdue', ...overdue.map(e => formatEvent(e)));
			}
			if (upcoming.length > 0) {
				lines.push('', '## Upcoming', ...upcoming.map(e => formatEvent(e)));
			}
			if (overdue.length === 0 && upcoming.length === 0) {
				lines.push('', 'No overdue or upcoming deadlines.');
			}
			return textResult(lines.join('\n'));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error reading deadlines: ${message}`);
		}
	}
}

/**
 * Build timeline LM tool instances (exported for unit tests).
 */
export function createTimelineAgentTools(getService: () => TimelineService | undefined) {
	return {
		addEvent: new TimelineAddEventTool(getService),
		updateEvent: new TimelineUpdateEventTool(getService),
		deleteEvent: new TimelineDeleteEventTool(getService),
		getEvents: new TimelineGetEventsTool(getService),
		linkDocument: new TimelineLinkDocumentTool(getService),
		getDeadlines: new TimelineGetDeadlinesTool(getService),
	};
}

/**
 * Register the six void-compatible timeline LM tools.
 */
export function registerAgentTools(
	context: vscode.ExtensionContext,
	getService: () => TimelineService | undefined,
): void {
	const tools = createTimelineAgentTools(getService);
	context.subscriptions.push(
		vscode.lm.registerTool(TIMELINE_ADD_EVENT_TOOL, tools.addEvent),
		vscode.lm.registerTool(TIMELINE_UPDATE_EVENT_TOOL, tools.updateEvent),
		vscode.lm.registerTool(TIMELINE_DELETE_EVENT_TOOL, tools.deleteEvent),
		vscode.lm.registerTool(TIMELINE_GET_EVENTS_TOOL, tools.getEvents),
		vscode.lm.registerTool(TIMELINE_LINK_DOCUMENT_TOOL, tools.linkDocument),
		vscode.lm.registerTool(TIMELINE_GET_DEADLINES_TOOL, tools.getDeadlines),
	);
}
