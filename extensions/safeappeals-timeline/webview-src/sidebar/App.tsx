/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useMemo, useState } from 'react';
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
} from '../shared/types';

type FilterCategory = EventCategory | 'all';

const CUSTOM_JURISDICTION_ID = '__custom__';

export function App(): React.ReactElement {
	const [timeline, setTimeline] = useState<CaseTimeline | null>(null);
	const [jurisdictions, setJurisdictions] = useState<JurisdictionOption[]>([]);
	const [workspaceName, setWorkspaceName] = useState('Workspace');
	const [loading, setLoading] = useState(true);
	const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
	const [deadlinesOnly, setDeadlinesOnly] = useState(false);
	const [error, setError] = useState<string | undefined>();
	const [injuryDateDraft, setInjuryDateDraft] = useState('');
	const [injuryDateFocused, setInjuryDateFocused] = useState(false);
	const [injuryDateDirty, setInjuryDateDirty] = useState(false);
	const [customJurisdiction, setCustomJurisdiction] = useState('');
	const [showCustomJurisdictionInput, setShowCustomJurisdictionInput] = useState(false);

	useEffect(() => {
		const dispose = onHostMessage(msg => {
			if (msg.type === 'bootstrap') {
				setTimeline(msg.payload.timeline);
				setJurisdictions(msg.payload.jurisdictions);
				setWorkspaceName(msg.payload.workspaceName);
				setLoading(false);
			} else if (msg.type === 'timelineUpdated') {
				setTimeline(msg.timeline);
			} else if (msg.type === 'error') {
				setError(msg.message);
			}
		});
		postToHost({ type: 'ready' });
		return dispose;
	}, []);

	// Sync from host when not editing; keep local draft while focused/dirty so year typing is not reset.
	useEffect(() => {
		const saved = dateOnly(timeline?.injuryDate ?? '');
		if (!injuryDateFocused && !injuryDateDirty) {
			setInjuryDateDraft(saved);
			return;
		}
		if (injuryDateDirty && saved === injuryDateDraft) {
			setInjuryDateDirty(false);
		}
	}, [timeline?.injuryDate, injuryDateFocused, injuryDateDirty, injuryDateDraft]);

	const commitInjuryDate = () => {
		const next = injuryDateDraft.trim();
		const saved = dateOnly(timeline?.injuryDate ?? '');
		if (next && next !== saved) {
			postToHost({ type: 'setInjuryDate', injuryDate: next });
			return;
		}
		setInjuryDateDirty(false);
		setInjuryDateDraft(saved);
	};

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

	const overdue = useMemo(() => sortedEvents.filter(isDeadlineOverdue), [sortedEvents]);
	const upcoming = useMemo(
		() => sortedEvents.filter(e => isDeadlineUpcoming(e, 7) && !isDeadlineOverdue(e)),
		[sortedEvents],
	);

	const jurisdictionLabel = jurisdictions.find(j => j.id === timeline?.jurisdictionId)?.label
		?? timeline?.jurisdictionId
		?? 'Not set';

	if (loading) {
		return <div className="sidebar loading">Loading…</div>;
	}

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

	return (
		<div className="sidebar">
			<header className="sidebar-header">
				<div className="sidebar-title">Case Timeline</div>
				<div className="sidebar-meta">
					{workspaceName} · {jurisdictionLabel}
				</div>
				<button
					type="button"
					className="btn btn-primary btn-block"
					onClick={() => postToHost({ type: 'openTimeline' })}
				>
					Open Timeline
				</button>
			</header>

			{error && <div className="error-banner">{error}</div>}

			<div className="sidebar-body">
				<section className="section">
					<div className="section-label">Jurisdiction</div>
					<select
						className="field"
						value={timeline?.jurisdictionId ?? ''}
						onChange={handleJurisdictionChange}
					>
						{jurisdictions.map(j => (
							<option key={j.id} value={j.id}>{j.label}</option>
						))}
						<option value={CUSTOM_JURISDICTION_ID}>Other…</option>
					</select>
					{showCustomJurisdictionInput && (
						<form onSubmit={handleCustomJurisdictionSubmit} className="custom-jurisdiction-form">
							<input
								className="field"
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
					{timeline?.jurisdictionId && !showCustomJurisdictionInput && (
						<div className="hint">
							Statute: {jurisdictions.find(j => j.id === timeline.jurisdictionId)?.statuteOfLimitationsDays ?? '—'} days
						</div>
					)}
				</section>

				<section className="section">
					<div className="section-label">Injury date</div>
					<input
						className="field"
						type="date"
						value={injuryDateDraft}
						onFocus={() => setInjuryDateFocused(true)}
						onChange={e => {
							setInjuryDateDraft(e.target.value);
							setInjuryDateDirty(true);
						}}
						onBlur={() => {
							setInjuryDateFocused(false);
							commitInjuryDate();
						}}
					/>
				</section>

				<section className="section">
					<label className="check-row">
						<input
							type="checkbox"
							checked={timeline?.notificationsEnabled !== false}
							onChange={e => postToHost({ type: 'setNotificationsEnabled', enabled: e.target.checked })}
						/>
						Deadline notifications
					</label>
				</section>

				<section className="section">
					<div className="section-label">Filters</div>
					<select
						className="field"
						value={filterCategory}
						onChange={e => setFilterCategory(e.target.value as FilterCategory)}
					>
						<option value="all">All categories</option>
						{EVENT_CATEGORIES.map(c => (
							<option key={c} value={c}>{EVENT_CATEGORY_LABELS[c]}</option>
						))}
					</select>
					<label className="check-row">
						<input
							type="checkbox"
							checked={deadlinesOnly}
							onChange={e => setDeadlinesOnly(e.target.checked)}
						/>
						Deadlines only
					</label>
				</section>

				{(overdue.length > 0 || upcoming.length > 0) && (
					<section className="section">
						<div className="section-label">Deadlines</div>
						<ul className="compact-list">
							{overdue.map(e => (
								<li key={e.id}>
									<button
										type="button"
										className="compact-item overdue"
										onClick={() => postToHost({ type: 'selectEvent', eventId: e.id })}
									>
										<span className="compact-date">{formatTimelineDate(e.date)}</span>
										<span className="compact-title">{e.title}</span>
										<span className="badge badge-overdue">Overdue</span>
									</button>
								</li>
							))}
							{upcoming.map(e => (
								<li key={e.id}>
									<button
										type="button"
										className="compact-item upcoming"
										onClick={() => postToHost({ type: 'selectEvent', eventId: e.id })}
									>
										<span className="compact-date">{formatTimelineDate(e.date)}</span>
										<span className="compact-title">{e.title}</span>
										<span className="badge badge-upcoming">Soon</span>
									</button>
								</li>
							))}
						</ul>
					</section>
				)}

				<section className="section section-grow">
					<div className="section-label-row">
						<div className="section-label">Events</div>
						<span className="count">{filteredEvents.length}</span>
					</div>
					{filteredEvents.length === 0 ? (
						<div className="hint">No events match. Open Timeline to add one.</div>
					) : (
						<ul className="compact-list">
							{filteredEvents.map(e => (
								<li key={e.id}>
									<button
										type="button"
										className="compact-item"
										onClick={() => postToHost({ type: 'selectEvent', eventId: e.id })}
									>
										<span
											className="dot"
											style={{ background: EVENT_CATEGORY_COLORS[e.category] }}
										/>
										<span className="compact-date">{formatTimelineDate(e.date)}</span>
										<span className="compact-title">{e.title}</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</div>
	);
}