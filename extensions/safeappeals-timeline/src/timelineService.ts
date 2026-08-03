/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { generateIcsContent, getCalendarEventCount, shouldSyncToCalendar } from './icsGenerator';
import {
	calculateStatuteDeadline as calculateStatuteDeadlineFromConfig,
	DEFAULT_JURISDICTIONS,
	getJurisdictionById,
} from './jurisdictionConfig';
import {
	createEmptyTimeline,
	loadTimelineFromDisk,
	saveTimelineToDisk,
} from './timelineStore';
import {
	applyTimelineEventUpdates,
	CaseTimeline,
	EventCategory,
	generateEventId,
	isDeadlineOverdue,
	isDeadlineUpcoming,
	JurisdictionConfig,
	TimelineEvent,
	TimelineEventUpdates,
} from './timelineTypes';
import { normalizeJurisdictionId } from './types';

export type TimelineEventInput = TimelineEventUpdates & {
	date: string;
	title: string;
	category: EventCategory;
	isDeadline: boolean;
	linkedDocuments: string[];
};

/**
 * Workspace-scoped timeline engine. Persists under `.safeAppeals/timeline.json`.
 * Does not read or write AGENTS.md.
 */
export class TimelineService {
	private _timeline: CaseTimeline | null = null;
	private readonly _onDidChangeTimeline = new vscode.EventEmitter<CaseTimeline | null>();
	readonly onDidChangeTimeline = this._onDidChangeTimeline.event;

	constructor(private readonly workspaceFolder?: vscode.WorkspaceFolder) { }

	dispose(): void {
		this._onDidChangeTimeline.dispose();
	}

	getTimeline(): CaseTimeline | null {
		return this._timeline;
	}

	async loadTimeline(): Promise<CaseTimeline | null> {
		this._timeline = await loadTimelineFromDisk(this.workspaceFolder);
		return this._timeline;
	}

	async ensureTimeline(): Promise<CaseTimeline> {
		if (this._timeline) {
			return this._timeline;
		}
		const loaded = await this.loadTimeline();
		if (loaded) {
			return loaded;
		}
		const profileJurisdiction = vscode.workspace
			.getConfiguration('safeappeals.profile')
			.get<string>('jurisdiction', '');
		const jurisdictionId = normalizeJurisdictionId(profileJurisdiction) || 'bc-wcb';
		this._timeline = createEmptyTimeline(jurisdictionId);
		await this.saveTimeline(this._timeline);
		return this._timeline;
	}

	async saveTimeline(timeline: CaseTimeline): Promise<void> {
		const normalized: CaseTimeline = {
			...timeline,
			version: 1,
			jurisdictionId: normalizeJurisdictionId(timeline.jurisdictionId) || timeline.jurisdictionId,
			events: [...timeline.events],
		};
		await saveTimelineToDisk(normalized, this.workspaceFolder);
		this._timeline = normalized;
		this._onDidChangeTimeline.fire(this._timeline);
	}

	async addEvent(eventData: TimelineEventInput): Promise<TimelineEvent> {
		const timeline = await this.ensureTimeline();
		const now = new Date().toISOString();
		const base: TimelineEvent = {
			id: generateEventId(),
			date: eventData.date,
			title: eventData.title,
			category: eventData.category,
			isDeadline: eventData.isDeadline,
			linkedDocuments: eventData.linkedDocuments ? [...eventData.linkedDocuments] : [],
			createdAt: now,
			updatedAt: now,
		};
		const event = applyTimelineEventUpdates(base, eventData);

		let injuryDate = timeline.injuryDate;
		let nextEvents = [...timeline.events, event];

		if (event.category === 'injury') {
			injuryDate = event.date.includes('T') ? event.date.slice(0, 10) : event.date;
			const hasStatute = nextEvents.some(e => e.source === 'statute' && e.isDeadline);
			if (!hasStatute) {
				const statute = this.buildStatuteDeadlineEvent(event.date, timeline.jurisdictionId);
				if (statute) {
					nextEvents.push(statute);
				}
			}
		}

		if (event.category === 'decision') {
			const generated = this.generateDeadlinesFromDecision(event);
			nextEvents = [...nextEvents, ...generated];
		}

		await this.saveTimeline({
			...timeline,
			injuryDate,
			events: nextEvents,
		});
		return event;
	}

	async updateEvent(id: string, updates: TimelineEventUpdates): Promise<TimelineEvent> {
		const timeline = await this.ensureTimeline();
		const index = timeline.events.findIndex(e => e.id === id);
		if (index === -1) {
			throw new Error(`Event not found: ${id}`);
		}
		const updated = applyTimelineEventUpdates(timeline.events[index], updates);
		const events = timeline.events.map((e, i) => (i === index ? updated : e));
		let injuryDate = timeline.injuryDate;
		if (updated.category === 'injury' && updates.date) {
			injuryDate = updates.date.includes('T') ? updates.date.slice(0, 10) : updates.date;
		}
		await this.saveTimeline({
			...timeline,
			injuryDate,
			events,
		});
		return updated;
	}

	async deleteEvent(id: string): Promise<void> {
		const timeline = await this.ensureTimeline();
		if (!timeline.events.some(e => e.id === id)) {
			throw new Error(`Event not found: ${id}`);
		}
		await this.saveTimeline({
			...timeline,
			events: timeline.events.filter(e => e.id !== id),
		});
	}

	getEventsSorted(ascending: boolean = true): TimelineEvent[] {
		if (!this._timeline) {
			return [];
		}
		return [...this._timeline.events].sort((a, b) => {
			const dateA = new Date(a.date).getTime();
			const dateB = new Date(b.date).getTime();
			return ascending ? dateA - dateB : dateB - dateA;
		});
	}

	getEventsByCategory(category: EventCategory): TimelineEvent[] {
		if (!this._timeline) {
			return [];
		}
		return this._timeline.events.filter(e => e.category === category);
	}

	calculateStatuteDeadline(injuryDate: Date, jurisdictionId: string): Date {
		return calculateStatuteDeadlineFromConfig(injuryDate, normalizeJurisdictionId(jurisdictionId));
	}

	getUpcomingDeadlines(daysAhead: number = 30): TimelineEvent[] {
		if (!this._timeline) {
			return [];
		}
		return this._timeline.events.filter(e => isDeadlineUpcoming(e, daysAhead));
	}

	getOverdueDeadlines(): TimelineEvent[] {
		if (!this._timeline) {
			return [];
		}
		return this._timeline.events.filter(e => isDeadlineOverdue(e));
	}

	generateDeadlinesFromDecision(decisionEvent: TimelineEvent): TimelineEvent[] {
		const timeline = this._timeline;
		if (!timeline) {
			return [];
		}
		const jurisdiction = getJurisdictionById(normalizeJurisdictionId(timeline.jurisdictionId));
		if (!jurisdiction) {
			return [];
		}
		const decisionDate = new Date(decisionEvent.date);
		if (isNaN(decisionDate.getTime())) {
			return [];
		}
		const now = new Date().toISOString();
		const deadlines: TimelineEvent[] = [];
		for (const rule of jurisdiction.deadlineRules) {
			if (rule.triggerEvent !== 'decision') {
				continue;
			}
			const deadlineDate = new Date(decisionDate);
			deadlineDate.setDate(deadlineDate.getDate() + rule.daysFromTrigger);
			deadlines.push({
				id: generateEventId(),
				date: toDateOnly(deadlineDate),
				title: rule.name,
				description: rule.description,
				category: 'deadline',
				linkedDocuments: [],
				isDeadline: true,
				reminderDays: [7, 3, 1],
				isComplete: false,
				source: `decision-rule:${rule.id}`,
				createdAt: now,
				updatedAt: now,
			});
		}
		return deadlines;
	}

	async linkDocument(eventId: string, documentUri: string): Promise<TimelineEvent> {
		const timeline = await this.ensureTimeline();
		const event = timeline.events.find(e => e.id === eventId);
		if (!event) {
			throw new Error(`Event not found: ${eventId}`);
		}
		if (!event.linkedDocuments.includes(documentUri)) {
			return this.updateEvent(eventId, {
				linkedDocuments: [...event.linkedDocuments, documentUri],
			});
		}
		return event;
	}

	async unlinkDocument(eventId: string, documentUri: string): Promise<TimelineEvent> {
		const timeline = await this.ensureTimeline();
		const event = timeline.events.find(e => e.id === eventId);
		if (!event) {
			throw new Error(`Event not found: ${eventId}`);
		}
		return this.updateEvent(eventId, {
			linkedDocuments: event.linkedDocuments.filter(d => d !== documentUri),
		});
	}

	async setJurisdiction(jurisdictionId: string): Promise<void> {
		const timeline = await this.ensureTimeline();
		const normalized = normalizeJurisdictionId(jurisdictionId) || jurisdictionId;
		let events = timeline.events;
		if (timeline.injuryDate) {
			events = this.refreshStatuteDeadline(events, timeline.injuryDate, normalized);
		}
		await this.saveTimeline({
			...timeline,
			jurisdictionId: normalized,
			events,
		});
	}

	async setInjuryDate(injuryDate: string): Promise<void> {
		const timeline = await this.ensureTimeline();
		const dateOnly = injuryDate.includes('T') ? injuryDate.slice(0, 10) : injuryDate;
		let events = this.refreshStatuteDeadline(timeline.events, dateOnly, timeline.jurisdictionId);

		const hasInjury = events.some(e => e.category === 'injury');
		if (!hasInjury) {
			const now = new Date().toISOString();
			events = [
				...events,
				{
					id: generateEventId(),
					date: dateOnly,
					title: 'Date of injury',
					category: 'injury',
					isDeadline: false,
					linkedDocuments: [],
					source: 'injury',
					createdAt: now,
					updatedAt: now,
				},
			];
		}

		await this.saveTimeline({
			...timeline,
			injuryDate: dateOnly,
			events,
		});
	}

	async setNotificationsEnabled(enabled: boolean): Promise<void> {
		const timeline = await this.ensureTimeline();
		await this.saveTimeline({
			...timeline,
			notificationsEnabled: enabled,
		});
	}

	getJurisdictions(): JurisdictionConfig[] {
		return [...DEFAULT_JURISDICTIONS];
	}

	getJurisdiction(id: string): JurisdictionConfig | undefined {
		return getJurisdictionById(normalizeJurisdictionId(id));
	}

	exportToIcs(calendarTitle?: string): string {
		const timeline = this._timeline ?? createEmptyTimeline();
		const folder = this.workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];
		const workspaceId = folder?.name ?? 'workspace';
		return generateIcsContent(
			timeline.events,
			timeline,
			workspaceId,
			calendarTitle ?? folder?.name ?? 'Case Timeline',
		);
	}

	getEventsForCalendar(): TimelineEvent[] {
		if (!this._timeline) {
			return [];
		}
		return this._timeline.events.filter(shouldSyncToCalendar);
	}

	getCalendarEventCount(): number {
		if (!this._timeline) {
			return 0;
		}
		return getCalendarEventCount(this._timeline.events);
	}

	async toggleSyncToCalendar(eventId: string): Promise<void> {
		const timeline = await this.ensureTimeline();
		const event = timeline.events.find(e => e.id === eventId);
		if (!event) {
			throw new Error(`Event not found: ${eventId}`);
		}
		const current = event.syncToCalendar ?? event.isDeadline;
		await this.updateEvent(eventId, { syncToCalendar: !current });
	}

	private buildStatuteDeadlineEvent(injuryDate: string, jurisdictionId: string): TimelineEvent | undefined {
		const parsed = new Date(injuryDate);
		if (isNaN(parsed.getTime())) {
			return undefined;
		}
		const deadline = this.calculateStatuteDeadline(parsed, jurisdictionId);
		const jurisdiction = getJurisdictionById(normalizeJurisdictionId(jurisdictionId));
		const now = new Date().toISOString();
		return {
			id: generateEventId(),
			date: toDateOnly(deadline),
			title: 'Statute of limitations',
			description: jurisdiction
				? `${jurisdiction.name}: file within ${jurisdiction.statuteOfLimitationsDays} days of injury`
				: 'Statute of limitations deadline from injury date',
			category: 'deadline',
			isDeadline: true,
			isComplete: false,
			linkedDocuments: [],
			reminderDays: [30, 14, 7, 3, 1],
			source: 'statute',
			createdAt: now,
			updatedAt: now,
		};
	}

	private refreshStatuteDeadline(
		events: TimelineEvent[],
		injuryDate: string,
		jurisdictionId: string,
	): TimelineEvent[] {
		const withoutStatute = events.filter(e => !(e.source === 'statute' && e.isDeadline));
		const statute = this.buildStatuteDeadlineEvent(injuryDate, jurisdictionId);
		return statute ? [...withoutStatute, statute] : withoutStatute;
	}
}

function toDateOnly(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

