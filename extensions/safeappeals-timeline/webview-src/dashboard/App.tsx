/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onHostMessage, postToHost } from '../shared/vscodeApi';
import {
	CaseTimeline,
	dateOnly,
	EVENT_CATEGORIES,
	EVENT_CATEGORY_COLORS,
	EVENT_CATEGORY_LABELS,
	EventCategory,
	formatTimelineDate,
	isDeadlineOverdue,
	isDeadlineUpcoming,
	JurisdictionOption,
	TimelineEvent,
	TimelineEventUpdates,
} from '../shared/types';

type FilterCategory = EventCategory | 'all';

const DEFAULT_REMINDER_DAYS = [7, 3, 1];
const REMINDER_DAY_OPTIONS = [30, 14, 7, 3, 1];

const CUSTOM_JURISDICTION_ID = '__custom__';

type EventEditorSaveData = TimelineEventUpdates & Pick<
	TimelineEvent,
	'date' | 'title' | 'category' | 'isDeadline' | 'linkedDocuments'
>;

function documentLabel(uri: string): string {
	const trimmed = uri.replace(/\\/g, '/');
	const parts = trimmed.split('/');
	return parts[parts.length - 1] || uri;
}

function EventEditorModal(props: {
	event: TimelineEvent | null;
	onSave: (data: EventEditorSaveData) => void;
	onCancel: () => void;
}): React.ReactElement {
	const { event, onSave, onCancel } = props;
	const [title, setTitle] = useState(event?.title ?? '');
	const [description, setDescription] = useState(event?.description ?? '');
	const [date, setDate] = useState(dateOnly(event?.date ?? new Date().toISOString()));
	const [endDate, setEndDate] = useState(dateOnly(event?.endDate ?? ''));
	const [category, setCategory] = useState<EventCategory>(event?.category ?? 'custom');
	const [isDeadline, setIsDeadline] = useState(event?.isDeadline ?? false);
	const [isComplete, setIsComplete] = useState(event?.isComplete ?? false);
	const [reminderDays, setReminderDays] = useState<number[]>(() => {
		if (event?.isDeadline) {
			return event.reminderDays ? [...event.reminderDays] : [...DEFAULT_REMINDER_DAYS];
		}
		return [...DEFAULT_REMINDER_DAYS];
	});
	const [syncToCalendar, setSyncToCalendar] = useState(event?.syncToCalendar ?? false);
	const [deadlineCategory, setDeadlineCategory] = useState(event?.deadlineCategory ?? '');
	const [linkedDocuments, setLinkedDocuments] = useState<string[]>(event?.linkedDocuments ?? []);

	const enableDeadline = (next: boolean) => {
		setIsDeadline(next);
		if (next) {
			setReminderDays(prev => (prev.length ? prev : [...DEFAULT_REMINDER_DAYS]));
		}
	};

	useEffect(() => {
		if (category === 'deadline') {
			setIsDeadline(true);
			setReminderDays(prev => (prev.length ? prev : [...DEFAULT_REMINDER_DAYS]));
		}
	}, [category]);

	useEffect(() => {
		const dispose = onHostMessage(msg => {
			if (msg.type !== 'documentsPicked') {
				return;
			}
			setLinkedDocuments(prev => {
				const merged = [...prev];
				for (const uri of msg.uris) {
					if (!merged.includes(uri)) {
						merged.push(uri);
					}
				}
				return merged;
			});
		});
		return dispose;
	}, []);

	const toggleReminderDay = (day: number) => {
		setReminderDays(prev => {
			if (prev.includes(day)) {
				return prev.filter(d => d !== day).sort((a, b) => b - a);
			}
			return [...prev, day].sort((a, b) => b - a);
		});
	};

	return (
		<div className="modal-backdrop" role="presentation" onClick={onCancel}>
			<div
				className="modal"
				role="dialog"
				aria-labelledby="event-editor-title"
				onClick={e => e.stopPropagation()}
			>
				<h2 id="event-editor-title">{event ? 'Edit Event' : 'Add Event'}</h2>
				<div className="modal-body">
					<label className="field-label">
						Title
						<input className="field" value={title} onChange={e => setTitle(e.target.value)} />
					</label>
					<div className="field-row">
						<label className="field-label">
							Date
							<input className="field" type="date" value={date} onChange={e => setDate(e.target.value)} />
						</label>
						<label className="field-label">
							End date
							<input
								className="field"
								type="date"
								value={endDate}
								onChange={e => setEndDate(e.target.value)}
							/>
						</label>
					</div>
					<label className="field-label">
						Category
						<select className="field" value={category} onChange={e => setCategory(e.target.value as EventCategory)}>
							{EVENT_CATEGORIES.map(c => (
								<option key={c} value={c}>{EVENT_CATEGORY_LABELS[c]}</option>
							))}
						</select>
					</label>
					<label className="field-label">
						Description
						<textarea
							className="field textarea"
							value={description}
							onChange={e => setDescription(e.target.value)}
						/>
					</label>
					<label className="check-row">
						<input
							type="checkbox"
							checked={isDeadline}
							onChange={e => enableDeadline(e.target.checked)}
						/>
						Track as deadline
					</label>
					{isDeadline && (
						<>
							<label className="check-row">
								<input
									type="checkbox"
									checked={isComplete}
									onChange={e => setIsComplete(e.target.checked)}
								/>
								Mark complete
							</label>
							<label className="field-label">
								Deadline category
								<input
									className="field"
									type="text"
									placeholder="e.g., Review, Appeal, Reconsideration"
									value={deadlineCategory}
									onChange={e => setDeadlineCategory(e.target.value)}
								/>
							</label>
							<div className="field-label">
								Reminder days before deadline
								<div className="chip-row" role="group" aria-label="Reminder days">
									{REMINDER_DAY_OPTIONS.map(day => {
										const selected = reminderDays.includes(day);
										return (
											<button
												key={day}
												type="button"
												className={`chip-toggle${selected ? ' selected' : ''}`}
												aria-pressed={selected}
												onClick={() => toggleReminderDay(day)}
											>
												{day}d
											</button>
										);
									})}
								</div>
							</div>
						</>
					)}
					<label className="check-row">
						<input
							type="checkbox"
							checked={syncToCalendar}
							onChange={e => setSyncToCalendar(e.target.checked)}
						/>
						Sync to calendar
					</label>
					<section className="linked-docs-editor" aria-label="Linked documents">
						<div className="linked-docs-header">
							<span className="field-label-text">Linked documents</span>
							<div className="linked-docs-actions">
								<button
									type="button"
									className="btn btn-secondary btn-sm"
									onClick={() => postToHost({ type: 'attachActiveDocument' })}
								>
									Attach current file
								</button>
								<button
									type="button"
									className="btn btn-primary btn-sm"
									onClick={() => postToHost({ type: 'pickDocuments' })}
								>
									Attach…
								</button>
							</div>
						</div>
						{linkedDocuments.length === 0 ? (
							<p className="linked-docs-empty">No documents linked yet.</p>
						) : (
							<ul className="linked-docs-list">
								{linkedDocuments.map(uri => (
									<li key={uri} className="linked-docs-item">
										<button
											type="button"
											className="linked-docs-open"
											title={uri}
											onClick={() => postToHost({ type: 'openDocument', uri })}
										>
											{documentLabel(uri)}
										</button>
										<button
											type="button"
											className="linked-docs-remove"
											aria-label={`Remove ${documentLabel(uri)}`}
											onClick={() => setLinkedDocuments(prev => prev.filter(d => d !== uri))}
										>
											×
										</button>
									</li>
								))}
							</ul>
						)}
					</section>
				</div>
				<div className="modal-actions">
					<button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
					<button
						type="button"
						className="btn btn-primary"
						disabled={!title.trim() || !date}
						onClick={() => onSave({
							date,
							// '' / null survive postMessage; undefined would be dropped and leave stale host values.
							endDate: endDate || '',
							title: title.trim(),
							description: description.trim(),
							category,
							isDeadline,
							isComplete: isDeadline ? isComplete : null,
							linkedDocuments,
							reminderDays: isDeadline
								? [...reminderDays].sort((a, b) => b - a)
								: null,
							source: event?.source ?? 'manual',
							syncToCalendar,
							deadlineCategory: deadlineCategory || '',
						})}
					>
						Save
					</button>
				</div>
			</div>
		</div>
	);
}

function DeadlineBanner(props: {
	events: TimelineEvent[];
	onSelect: (id: string) => void;
}): React.ReactElement | null {
	const overdue = props.events.filter(isDeadlineOverdue);
	const upcoming = props.events.filter(e => isDeadlineUpcoming(e, 7) && !isDeadlineOverdue(e));
	if (overdue.length === 0 && upcoming.length === 0) {
		return null;
	}
	return (
		<div className="deadline-banners">
			{overdue.map(e => (
				<button
					key={e.id}
					type="button"
					className="deadline-banner overdue"
					onClick={() => props.onSelect(e.id)}
				>
					<span className="deadline-kicker">Overdue</span>
					<span className="deadline-title">{e.title}</span>
					<span className="deadline-date">{formatTimelineDate(e.date)}</span>
				</button>
			))}
			{upcoming.map(e => (
				<button
					key={e.id}
					type="button"
					className="deadline-banner upcoming"
					onClick={() => props.onSelect(e.id)}
				>
					<span className="deadline-kicker">Due soon</span>
					<span className="deadline-title">{e.title}</span>
					<span className="deadline-date">{formatTimelineDate(e.date)}</span>
				</button>
			))}
		</div>
	);
}

function EventCard(props: {
	event: TimelineEvent;
	isFirst: boolean;
	isLast: boolean;
	selected: boolean;
	cardRef?: (el: HTMLDivElement | null) => void;
	onEdit: () => void;
	onDelete: () => void;
	onToggleComplete: () => void;
	onOpenDocument: (uri: string) => void;
	onSelect: () => void;
}): React.ReactElement {
	const { event } = props;
	const color = EVENT_CATEGORY_COLORS[event.category];
	const overdue = isDeadlineOverdue(event);
	return (
		<div
			ref={props.cardRef}
			className={`event-row${props.selected ? ' selected' : ''}${overdue ? ' overdue' : ''}${event.isComplete ? ' complete' : ''}`}
			onClick={props.onSelect}
		>
			<div className="rail">
				{!props.isFirst && <div className="rail-line top" />}
				<div className="rail-dot" style={{ background: color, boxShadow: overdue ? '0 0 0 2px var(--vscode-inputValidation-errorBorder)' : undefined }} />
				{!props.isLast && <div className="rail-line bottom" />}
			</div>
			<article className="event-card">
				<div className="event-card-main">
					<div className="event-meta">
						<span className="event-date">{formatTimelineDate(event.date)}</span>
						{event.isDeadline && <span className="pill deadline">Deadline</span>}
						{event.isComplete && <span className="pill complete">Complete</span>}
						{event.source && <span className="pill source">{event.source}</span>}
					</div>
					<h3 className="event-title">{event.title}</h3>
					<span className="category-chip" style={{ background: color }}>
						{EVENT_CATEGORY_LABELS[event.category]}
					</span>
					{event.description && (
						<p className="event-description">{event.description}</p>
					)}
					{event.linkedDocuments.length > 0 && (
						<ul className="linked-docs">
							{event.linkedDocuments.map(uri => (
								<li key={uri}>
									<button
										type="button"
										className="btn btn-secondary btn-sm"
										onClick={e => {
											e.stopPropagation();
											props.onOpenDocument(uri);
										}}
									>
										{uri.split('/').pop() || uri}
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
				<div className="event-actions" onClick={e => e.stopPropagation()}>
					{event.isDeadline && (
						<button type="button" className="btn btn-secondary" onClick={props.onToggleComplete}>
							{event.isComplete ? 'Reopen' : 'Complete'}
						</button>
					)}
					<button type="button" className="btn btn-secondary" onClick={props.onEdit}>Edit</button>
					<button type="button" className="btn btn-secondary" onClick={props.onDelete}>Delete</button>
				</div>
			</article>
		</div>
	);
}

export function App(): React.ReactElement {
	const [timeline, setTimeline] = useState<CaseTimeline | null>(null);
	const [jurisdictions, setJurisdictions] = useState<JurisdictionOption[]>([]);
	const [workspaceName, setWorkspaceName] = useState('Workspace');
	const [loading, setLoading] = useState(true);
	const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
	const [deadlinesOnly, setDeadlinesOnly] = useState(false);
	const [showEditor, setShowEditor] = useState(false);
	const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
	const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
	const [error, setError] = useState<string | undefined>();
	const [customJurisdiction, setCustomJurisdiction] = useState('');
	const [showCustomJurisdictionInput, setShowCustomJurisdictionInput] = useState(false);
	const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	const focusEvent = (eventId: string) => {
		setSelectedEventId(eventId);
	};

	useEffect(() => {
		const dispose = onHostMessage(msg => {
			if (msg.type === 'bootstrap') {
				setTimeline(msg.payload.timeline);
				setJurisdictions(msg.payload.jurisdictions);
				setWorkspaceName(msg.payload.workspaceName);
				setLoading(false);
			} else if (msg.type === 'timelineUpdated') {
				setTimeline(msg.timeline);
			} else if (msg.type === 'selectEvent') {
				focusEvent(msg.eventId);
			} else if (msg.type === 'error') {
				setError(msg.message);
			}
		});
		postToHost({ type: 'ready' });
		return dispose;
	}, []);

	const sortedEvents = useMemo(() => {
		const events = timeline?.events ?? [];
		return [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	}, [timeline]);

	const filteredEvents = useMemo(() => {
		return sortedEvents.filter(e => {
			if (filterCategory !== 'all' && e.category !== filterCategory) {
				return false;
			}
			if (deadlinesOnly && !e.isDeadline) {
				return false;
			}
			return true;
		});
	}, [sortedEvents, filterCategory, deadlinesOnly]);

	useEffect(() => {
		if (!selectedEventId || loading) {
			return;
		}
		const el = cardRefs.current.get(selectedEventId);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}, [selectedEventId, loading, filteredEvents.length]);

	const jurisdictionLabel = jurisdictions.find(j => j.id === timeline?.jurisdictionId)?.label
		?? timeline?.jurisdictionId
		?? 'Not set';

	const needsSetup = !timeline?.jurisdictionId || !timeline?.injuryDate;

	const handleJurisdictionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const value = e.target.value;
		if (value === CUSTOM_JURISDICTION_ID) {
			setShowCustomJurisdictionInput(true);
			setCustomJurisdiction('');
		} else {
			setShowCustomJurisdictionInput(false);
			postToHost({ type: 'setJurisdiction', jurisdictionId: value });
		}
	};

	const handleCustomJurisdictionSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const value = customJurisdiction.trim();
		if (value) {
			postToHost({ type: 'setJurisdiction', jurisdictionId: value });
			setShowCustomJurisdictionInput(false);
			setCustomJurisdiction('');
		}
	};

	if (loading) {
		return <div className="dashboard loading">Loading timeline…</div>;
	}

	return (
		<div className="dashboard">
			<header className="toolbar">
				<div className="toolbar-summary">
					<div className="toolbar-title">Case Timeline</div>
					<div className="toolbar-meta">
						{workspaceName} · {jurisdictionLabel}
						{timeline?.injuryDate ? ` · Injury ${formatTimelineDate(timeline.injuryDate)}` : ''}
					</div>
				</div>
				<div className="toolbar-actions">
					<select
						className="field field-inline"
						value={timeline?.jurisdictionId ?? ''}
						onChange={handleJurisdictionChange}
						aria-label="Jurisdiction"
					>
						{jurisdictions.map(j => (
							<option key={j.id} value={j.id}>{j.label}</option>
						))}
						<option value={CUSTOM_JURISDICTION_ID}>Other…</option>
					</select>
					{showCustomJurisdictionInput && (
						<form onSubmit={handleCustomJurisdictionSubmit} className="custom-jurisdiction-form">
							<input
								className="field field-inline"
								type="text"
								placeholder="Enter custom jurisdiction name"
								value={customJurisdiction}
								onChange={e => setCustomJurisdiction(e.target.value)}
								autoFocus
							/>
							<div className="form-actions">
								<button type="submit" className="btn btn-primary btn-sm">Save</button>
								<button
									type="button"
									className="btn btn-secondary btn-sm"
									onClick={() => { setShowCustomJurisdictionInput(false); setCustomJurisdiction(''); }}
								>
									Cancel
								</button>
							</div>
						</form>
					)}
					<select
						className="field field-inline"
						value={filterCategory}
						onChange={e => setFilterCategory(e.target.value as FilterCategory)}
						aria-label="Category filter"
					>
						<option value="all">All categories</option>
						{EVENT_CATEGORIES.map(c => (
							<option key={c} value={c}>{EVENT_CATEGORY_LABELS[c]}</option>
						))}
					</select>
					<label className="check-row toolbar-check">
						<input
							type="checkbox"
							checked={deadlinesOnly}
							onChange={e => setDeadlinesOnly(e.target.checked)}
						/>
						Deadlines only
					</label>
					<button
						type="button"
						className="btn btn-primary"
						onClick={() => { setEditingEvent(null); setShowEditor(true); }}
					>
						Add Event
					</button>
					<button type="button" className="btn btn-secondary" onClick={() => postToHost({ type: 'exportIcs' })}>
						Export ICS
					</button>
				</div>
			</header>

			{error && <div className="error-banner">{error}</div>}

			<div className="chronology">
				<DeadlineBanner events={sortedEvents} onSelect={focusEvent} />

				{needsSetup && (
					<div className="setup-hint">
						Set jurisdiction and injury date in the Timeline sidebar.
					</div>
				)}

				{filteredEvents.length === 0 ? (
					<div className="empty-state">
						<div className="empty-title">No chronology yet</div>
						<p>
							{needsSetup
								? 'Set jurisdiction and injury date in the Timeline sidebar to get started.'
								: 'Add an event to begin the case chronology, or use the Timeline sidebar for filters and setup.'}
						</p>
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => { setEditingEvent(null); setShowEditor(true); }}
						>
							Add Event
						</button>
					</div>
				) : (
					<div className="chronology-rail">
						{filteredEvents.map((event, index) => (
							<EventCard
								key={event.id}
								event={event}
								isFirst={index === 0}
								isLast={index === filteredEvents.length - 1}
								selected={selectedEventId === event.id}
								cardRef={el => {
									if (el) {
										cardRefs.current.set(event.id, el);
									} else {
										cardRefs.current.delete(event.id);
									}
								}}
								onSelect={() => setSelectedEventId(event.id)}
								onEdit={() => { setEditingEvent(event); setShowEditor(true); }}
								onDelete={() => postToHost({ type: 'deleteEvent', id: event.id })}
								onToggleComplete={() => postToHost({
									type: 'updateEvent',
									id: event.id,
									updates: { isComplete: !event.isComplete },
								})}
								onOpenDocument={uri => postToHost({ type: 'openDocument', uri })}
							/>
						))}
					</div>
				)}
			</div>

			{showEditor && (
				<EventEditorModal
					event={editingEvent}
					onCancel={() => { setShowEditor(false); setEditingEvent(null); }}
					onSave={data => {
						if (editingEvent) {
							postToHost({ type: 'updateEvent', id: editingEvent.id, updates: data });
						} else {
							postToHost({ type: 'addEvent', event: data });
						}
						setShowEditor(false);
						setEditingEvent(null);
					}}
				/>
			)}
		</div>
	);
}
