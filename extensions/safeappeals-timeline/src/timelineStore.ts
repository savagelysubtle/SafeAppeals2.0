/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { randomBytes } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { normalizeJurisdictionId } from './types';
import {
	CaseTimeline,
	DEFAULT_CASE_TIMELINE,
	EVENT_CATEGORIES,
	EventCategory,
	TimelineEvent,
} from './timelineTypes';

export const TIMELINE_RELATIVE_PATH = path.join('.safeAppeals', 'timeline.json');

/**
 * Resolves `.safeAppeals/timeline.json` under the first workspace folder.
 */
export function getTimelineUri(workspaceFolder?: vscode.WorkspaceFolder): vscode.Uri | undefined {
	const folder = workspaceFolder ?? vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		return undefined;
	}
	return vscode.Uri.joinPath(folder.uri, '.safeAppeals', 'timeline.json');
}

function isEventCategory(value: unknown): value is EventCategory {
	return typeof value === 'string' && (EVENT_CATEGORIES as readonly string[]).includes(value);
}

function normalizeEvent(raw: unknown): TimelineEvent | undefined {
	if (!raw || typeof raw !== 'object') {
		return undefined;
	}
	const e = raw as Record<string, unknown>;
	if (typeof e.id !== 'string' || typeof e.date !== 'string' || typeof e.title !== 'string') {
		return undefined;
	}
	if (!isEventCategory(e.category)) {
		return undefined;
	}
	const linkedDocuments = Array.isArray(e.linkedDocuments)
		? e.linkedDocuments.filter((d): d is string => typeof d === 'string')
		: [];
	const reminderDays = Array.isArray(e.reminderDays)
		? e.reminderDays.filter((d): d is number => typeof d === 'number')
		: undefined;
	const now = new Date().toISOString();
	return {
		id: e.id,
		date: e.date,
		endDate: typeof e.endDate === 'string' ? e.endDate : undefined,
		title: e.title,
		description: typeof e.description === 'string' ? e.description : undefined,
		category: e.category,
		isDeadline: e.isDeadline === true,
		isComplete: e.isComplete === true ? true : e.isComplete === false ? false : undefined,
		linkedDocuments,
		reminderDays: reminderDays && reminderDays.length > 0 ? reminderDays : undefined,
		source: typeof e.source === 'string' ? e.source : undefined,
		createdAt: typeof e.createdAt === 'string' ? e.createdAt : now,
		updatedAt: typeof e.updatedAt === 'string' ? e.updatedAt : now,
		syncToCalendar: typeof e.syncToCalendar === 'boolean' ? e.syncToCalendar : undefined,
	};
}

/**
 * Parses and normalizes a timeline JSON document. Accepts legacy void-shaped
 * fields (`jurisdiction` → `jurisdictionId`, string version → 1).
 */
export function parseTimelineDocument(raw: unknown): CaseTimeline {
	const base: CaseTimeline = {
		...DEFAULT_CASE_TIMELINE,
		events: [],
	};
	if (!raw || typeof raw !== 'object') {
		return base;
	}
	const doc = raw as Record<string, unknown>;
	const jurisdictionRaw =
		typeof doc.jurisdictionId === 'string' ? doc.jurisdictionId
			: typeof doc.jurisdiction === 'string' ? doc.jurisdiction
				: base.jurisdictionId;
	const eventsRaw = Array.isArray(doc.events) ? doc.events : [];
	const events: TimelineEvent[] = [];
	for (const item of eventsRaw) {
		const event = normalizeEvent(item);
		if (event) {
			events.push(event);
		}
	}
	return {
		version: 1,
		jurisdictionId: normalizeJurisdictionId(jurisdictionRaw) || base.jurisdictionId,
		injuryDate: typeof doc.injuryDate === 'string' ? doc.injuryDate : undefined,
		events,
		notificationsEnabled: doc.notificationsEnabled !== false,
	};
}

export function serializeTimeline(timeline: CaseTimeline): string {
	const doc: CaseTimeline = {
		version: 1,
		jurisdictionId: normalizeJurisdictionId(timeline.jurisdictionId) || timeline.jurisdictionId,
		injuryDate: timeline.injuryDate,
		events: timeline.events,
		notificationsEnabled: timeline.notificationsEnabled,
	};
	return JSON.stringify(doc, null, '\t') + '\n';
}

async function writeFileAtomic(filePath: string, content: string): Promise<void> {
	const dir = path.dirname(filePath);
	await fs.mkdir(dir, { recursive: true, mode: 0o700 });
	const tmpPath = path.join(dir, `.${path.basename(filePath)}.${randomBytes(8).toString('hex')}.tmp`);
	try {
		await fs.writeFile(tmpPath, content, { encoding: 'utf8', mode: 0o600 });
		await fs.rename(tmpPath, filePath);
	} catch (error) {
		try {
			await fs.unlink(tmpPath);
		} catch {
			// ignore cleanup failures
		}
		throw error;
	}
}

/**
 * Loads `.safeAppeals/timeline.json` or returns null when missing / unreadable.
 */
export async function loadTimelineFromDisk(
	workspaceFolder?: vscode.WorkspaceFolder,
): Promise<CaseTimeline | null> {
	const uri = getTimelineUri(workspaceFolder);
	if (!uri) {
		return null;
	}
	if (uri.scheme === 'file') {
		try {
			const text = await fs.readFile(uri.fsPath, 'utf8');
			return parseTimelineDocument(JSON.parse(text));
		} catch (error) {
			const err = error as NodeJS.ErrnoException;
			if (err.code === 'ENOENT') {
				return null;
			}
			throw error;
		}
	}
	try {
		const bytes = await vscode.workspace.fs.readFile(uri);
		const text = Buffer.from(bytes).toString('utf8');
		return parseTimelineDocument(JSON.parse(text));
	} catch {
		return null;
	}
}

/**
 * Persists timeline JSON. Uses tmp+rename on file: workspaces; otherwise
 * vscode.workspace.fs.writeFile.
 */
export async function saveTimelineToDisk(
	timeline: CaseTimeline,
	workspaceFolder?: vscode.WorkspaceFolder,
): Promise<vscode.Uri> {
	const uri = getTimelineUri(workspaceFolder);
	if (!uri) {
		throw new Error('No workspace folder available for timeline storage.');
	}
	const content = serializeTimeline(timeline);
	if (uri.scheme === 'file') {
		await writeFileAtomic(uri.fsPath, content);
		return uri;
	}
	const dir = vscode.Uri.joinPath(uri, '..');
	await vscode.workspace.fs.createDirectory(dir);
	await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
	return uri;
}

/** Pure helpers for unit tests (no vscode workspace required). */
export function createEmptyTimeline(jurisdictionId = 'bc-wcb'): CaseTimeline {
	return {
		version: 1,
		jurisdictionId: normalizeJurisdictionId(jurisdictionId) || 'bc-wcb',
		events: [],
		notificationsEnabled: true,
	};
}
