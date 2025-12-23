/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useCallback } from 'react';
import { useAccessor, useIsDark } from '../util/services.js';
import {
	CaseTimeline,
	TimelineEvent,
	EventCategory,
	EVENT_CATEGORY_LABELS,
	EVENT_CATEGORY_COLORS,
	JurisdictionConfig,
	formatTimelineDate,
	isDeadlineOverdue,
	isDeadlineUpcoming
} from '../../../../../../workbench/contrib/void/common/timeline/timelineTypes.js';
import { TimelineEventCard } from './TimelineEventCard.js';
import { EventEditor } from './EventEditor.js';
import { TimelineToolbar } from './TimelineToolbar.js';
import { DeadlineWarnings } from './DeadlineWarnings.js';

export const TimelineDashboard: React.FC = () => {
	const accessor = useAccessor();
	const timelineService = accessor.get('ITimelineService');
	const isDark = useIsDark();

	const [timeline, setTimeline] = useState<CaseTimeline | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [showEventEditor, setShowEventEditor] = useState(false);
	const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
	const [filterCategory, setFilterCategory] = useState<EventCategory | 'all'>('all');
	const [showDeadlinesOnly, setShowDeadlinesOnly] = useState(false);

	// Load timeline on mount
	useEffect(() => {
		const loadData = async () => {
			setIsLoading(true);
			try {
				const loaded = await timelineService.loadTimeline();
				setTimeline(loaded);
			} catch (error) {
				console.error('[TimelineDashboard] Failed to load timeline:', error);
			} finally {
				setIsLoading(false);
			}
		};
		loadData();

		// Subscribe to timeline changes
		const disposable = timelineService.onDidChangeTimeline((newTimeline) => {
			setTimeline(newTimeline);
		});

		return () => disposable.dispose();
	}, [timelineService]);

	const handleAddEvent = useCallback(() => {
		setEditingEvent(null);
		setShowEventEditor(true);
	}, []);

	const handleEditEvent = useCallback((event: TimelineEvent) => {
		setEditingEvent(event);
		setShowEventEditor(true);
	}, []);

	const handleDeleteEvent = useCallback(async (eventId: string) => {
		try {
			await timelineService.deleteEvent(eventId);
		} catch (error) {
			console.error('[TimelineDashboard] Failed to delete event:', error);
		}
	}, [timelineService]);

	const handleSaveEvent = useCallback(async (eventData: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
		try {
			if (editingEvent) {
				await timelineService.updateEvent(editingEvent.id, eventData);
			} else {
				await timelineService.addEvent(eventData);
			}
			setShowEventEditor(false);
			setEditingEvent(null);
		} catch (error) {
			console.error('[TimelineDashboard] Failed to save event:', error);
		}
	}, [timelineService, editingEvent]);

	const handleCancelEdit = useCallback(() => {
		setShowEventEditor(false);
		setEditingEvent(null);
	}, []);

	const handleCreateTimeline = useCallback(async () => {
		try {
			// Create a new timeline with default settings
			await timelineService.addEvent({
				date: new Date().toISOString(),
				title: 'Timeline Created',
				description: 'Case timeline initialized',
				category: 'custom',
				linkedDocuments: [],
				isDeadline: false
			});
		} catch (error) {
			console.error('[TimelineDashboard] Failed to create timeline:', error);
		}
	}, [timelineService]);

	// Filter and sort events
	const filteredEvents = React.useMemo(() => {
		if (!timeline) return [];

		let events = [...timeline.events];

		// Filter by category
		if (filterCategory !== 'all') {
			events = events.filter(e => e.category === filterCategory);
		}

		// Filter deadlines only
		if (showDeadlinesOnly) {
			events = events.filter(e => e.isDeadline);
		}

		// Sort by date (ascending)
		events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

		return events;
	}, [timeline, filterCategory, showDeadlinesOnly]);

	// Get deadline warnings
	const upcomingDeadlines = React.useMemo(() => {
		return timelineService.getUpcomingDeadlines(7);
	}, [timeline, timelineService]);

	const overdueDeadlines = React.useMemo(() => {
		return timelineService.getOverdueDeadlines();
	}, [timeline, timelineService]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full p-8">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
					<p style={{ color: 'var(--vscode-descriptionForeground)' }}>Loading timeline...</p>
				</div>
			</div>
		);
	}

	if (!timeline) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8">
				<div className="text-center max-w-md">
					<div className="text-6xl mb-4">📅</div>
					<h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--vscode-foreground)' }}>
						No Timeline Found
					</h2>
					<p className="mb-6" style={{ color: 'var(--vscode-descriptionForeground)' }}>
						Create a case timeline to track important events, deadlines, and documents.
					</p>
					<button
						onClick={handleCreateTimeline}
						className="px-6 py-3 rounded-lg font-medium transition-colors"
						style={{
							backgroundColor: 'var(--vscode-button-background)',
							color: 'var(--vscode-button-foreground)'
						}}
					>
						Create Timeline
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col" style={{ backgroundColor: 'var(--vscode-editor-background)' }}>
			{/* Deadline Warnings */}
			{(overdueDeadlines.length > 0 || upcomingDeadlines.length > 0) && (
				<DeadlineWarnings
					overdueDeadlines={overdueDeadlines}
					upcomingDeadlines={upcomingDeadlines}
					onClickEvent={handleEditEvent}
				/>
			)}

			{/* Toolbar */}
			<TimelineToolbar
				onAddEvent={handleAddEvent}
				filterCategory={filterCategory}
				onFilterChange={setFilterCategory}
				showDeadlinesOnly={showDeadlinesOnly}
				onShowDeadlinesChange={setShowDeadlinesOnly}
				jurisdiction={timelineService.getJurisdiction(timeline.jurisdiction)}
				eventCount={timeline.events.length}
			/>

			{/* Timeline */}
			<div className="flex-1 overflow-y-auto p-4">
				{filteredEvents.length === 0 ? (
					<div className="text-center py-12">
						<p style={{ color: 'var(--vscode-descriptionForeground)' }}>
							{timeline.events.length === 0
								? 'No events yet. Click "Add Event" to get started.'
								: 'No events match the current filter.'}
						</p>
					</div>
				) : (
					<div className="relative">
						{/* Timeline line */}
						<div
							className="absolute left-6 top-0 bottom-0 w-0.5"
							style={{ backgroundColor: 'var(--vscode-editorWidget-border)' }}
						/>

						{/* Events */}
						<div className="space-y-4">
							{filteredEvents.map((event, index) => (
								<TimelineEventCard
									key={event.id}
									event={event}
									onEdit={() => handleEditEvent(event)}
									onDelete={() => handleDeleteEvent(event.id)}
									isFirst={index === 0}
									isLast={index === filteredEvents.length - 1}
								/>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Event Editor Modal */}
			{showEventEditor && (
				<EventEditor
					event={editingEvent}
					jurisdictions={timelineService.getJurisdictions()}
					currentJurisdiction={timeline.jurisdiction}
					onSave={handleSaveEvent}
					onCancel={handleCancelEdit}
				/>
			)}
		</div>
	);
};

