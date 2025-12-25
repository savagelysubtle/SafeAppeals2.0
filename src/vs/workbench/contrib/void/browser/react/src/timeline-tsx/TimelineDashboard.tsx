/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	CaseTimeline,
	EventCategory,
	TimelineEvent,
} from "../../../../common/timeline/timelineTypes.js";
import { useAccessor, useIsDark } from "../util/services.js";
import { CalendarView } from "./CalendarView.js";
import { CaseSummary } from "./CaseSummary.js";
import { DeadlineWarnings } from "./DeadlineWarnings.js";
import { EventEditor } from "./EventEditor.js";
import { JurisdictionSelector } from "./JurisdictionSelector.js";
import { NotificationPreferences } from "./NotificationPreferences.js";
import { TimelineEventCard } from "./TimelineEventCard.js";
import { TimelineToolbar } from "./TimelineToolbar.js";
import { TodayMarker } from "./TodayMarker.js";

// Zoom/view mode types
export type TimelineViewMode = "all" | "year" | "month" | "week";

// Display mode: timeline list vs calendar grid
export type DisplayMode = "timeline" | "calendar";

// SafeAppeals brand colors
const BRAND_GREEN = "#22c55e";

export const TimelineDashboard: React.FC = () => {
	const accessor = useAccessor();
	const timelineService = accessor.get("ITimelineService");
	const isDark = useIsDark();

	const [timeline, setTimeline] = useState<CaseTimeline | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [showEventEditor, setShowEventEditor] = useState(false);
	const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
	const [filterCategory, setFilterCategory] = useState<EventCategory | "all">(
		"all"
	);
	const [showDeadlinesOnly, setShowDeadlinesOnly] = useState(false);
	const [isFirstEventCreation, setIsFirstEventCreation] = useState(false);
	const [showJurisdictionSelector, setShowJurisdictionSelector] =
		useState(false);
	const [viewMode, setViewMode] = useState<TimelineViewMode>("all");
	const [displayMode, setDisplayMode] = useState<DisplayMode>("timeline");
	const [prefilledDate, setPrefilledDate] = useState<string | null>(null);
	const [showNotificationSettings, setShowNotificationSettings] =
		useState(false);

	// Load timeline on mount
	useEffect(() => {
		const loadData = async () => {
			setIsLoading(true);
			try {
				const loaded = await timelineService.loadTimeline();
				setTimeline(loaded);
			} catch (error) {
				console.error("[TimelineDashboard] Failed to load timeline:", error);
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
		setIsFirstEventCreation(false);
		setPrefilledDate(null);
		setShowEventEditor(true);
	}, []);

	const handleAddEventWithDate = useCallback((date: Date) => {
		setEditingEvent(null);
		setIsFirstEventCreation(false);
		setPrefilledDate(date.toISOString().split("T")[0]);
		setShowEventEditor(true);
	}, []);

	const handleEditEvent = useCallback((event: TimelineEvent) => {
		setEditingEvent(event);
		setIsFirstEventCreation(false);
		setShowEventEditor(true);
	}, []);

	const handleDeleteEvent = useCallback(
		async (eventId: string) => {
			try {
				await timelineService.deleteEvent(eventId);
			} catch (error) {
				console.error("[TimelineDashboard] Failed to delete event:", error);
			}
		},
		[timelineService]
	);

	const handleSaveEvent = useCallback(
		async (
			eventData: Omit<TimelineEvent, "id" | "createdAt" | "updatedAt">
		) => {
			try {
				if (editingEvent) {
					await timelineService.updateEvent(editingEvent.id, eventData);
				} else {
					await timelineService.addEvent(eventData);
				}
				setShowEventEditor(false);
				setEditingEvent(null);
				setIsFirstEventCreation(false);
			} catch (error) {
				console.error("[TimelineDashboard] Failed to save event:", error);
			}
		},
		[timelineService, editingEvent]
	);

	const handleCancelEdit = useCallback(() => {
		setShowEventEditor(false);
		setEditingEvent(null);
		setIsFirstEventCreation(false);
	}, []);

	const handleCreateTimeline = useCallback(async () => {
		try {
			// Create timeline pre-populated with case config data
			// This will also auto-create an injury event if injury date is available
			await timelineService.createTimelineWithCaseConfig();
			// Timeline will update via onDidChangeTimeline event
		} catch (error) {
			console.error("[TimelineDashboard] Failed to create timeline:", error);
			// Fallback: open event editor for manual creation
			setEditingEvent(null);
			setIsFirstEventCreation(true);
			setShowEventEditor(true);
		}
	}, [timelineService]);

	const handleSyncFromCase = useCallback(async () => {
		try {
			const synced = await timelineService.syncFromCaseConfig();
			if (!synced) {
				console.log("[TimelineDashboard] No case config to sync from");
			}
		} catch (error) {
			console.error(
				"[TimelineDashboard] Failed to sync from case config:",
				error
			);
		}
	}, [timelineService]);

	const handleJurisdictionChange = useCallback(
		async (jurisdictionId: string) => {
			try {
				await timelineService.setJurisdiction(jurisdictionId);
			} catch (error) {
				console.error(
					"[TimelineDashboard] Failed to change jurisdiction:",
					error
				);
			}
		},
		[timelineService]
	);

	const handleJurisdictionClick = useCallback(() => {
		setShowJurisdictionSelector(true);
	}, []);

	const handleExport = useCallback(async () => {
		try {
			const pdfBytes = await timelineService.exportToPDF();

			// Create a Blob and download as PDF
			// Wrap in new Uint8Array to ensure proper type for Blob constructor
			const blob = new Blob([new Uint8Array(pdfBytes)], {
				type: "application/pdf",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;

			// Build filename from available case info
			// Use caseName if available, otherwise extract last meaningful segment from caseId
			const rawId = timeline?.caseName || timeline?.caseId || "";

			// Extract last path segment if it looks like a path (contains any slashes)
			const segments = rawId.split(/[/\\]+/).filter((s) => s && s.length > 1);
			const baseName = segments.length > 0 ? segments[segments.length - 1] : "";

			// Sanitize for filename safety
			const sanitizedName =
				baseName
					.replace(/[\\/:*?"<>|]/g, "_")
					.replace(/\s+/g, "_")
					.replace(/_+/g, "_")
					.replace(/^_|_$/g, "")
					.substring(0, 50) || "export";

			const dateStamp = new Date().toISOString().split("T")[0];
			a.download = `Timeline_${sanitizedName}_${dateStamp}.pdf`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			console.log("[TimelineDashboard] Timeline exported as PDF successfully");
		} catch (error) {
			console.error("[TimelineDashboard] Failed to export timeline:", error);
		}
	}, [timelineService, timeline]);

	// Filter and sort events
	const filteredEvents = useMemo(() => {
		if (!timeline) return [];

		let events = [...timeline.events];

		// Filter by category
		if (filterCategory !== "all") {
			events = events.filter((e) => e.category === filterCategory);
		}

		// Filter deadlines only
		if (showDeadlinesOnly) {
			events = events.filter((e) => e.isDeadline);
		}

		// Filter by view mode (time range)
		if (viewMode !== "all") {
			const now = new Date();
			let startDate: Date;
			let endDate: Date = new Date(now.getFullYear() + 10, 11, 31); // Far future

			switch (viewMode) {
				case "week":
					// Show events from 1 week ago to 1 week ahead
					startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
					endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
					break;
				case "month":
					// Show events from this month (start of month to end of month)
					startDate = new Date(now.getFullYear(), now.getMonth(), 1);
					endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
					break;
				case "year":
					// Show events from this year
					startDate = new Date(now.getFullYear(), 0, 1);
					endDate = new Date(now.getFullYear(), 11, 31);
					break;
				default:
					startDate = new Date(0);
			}

			events = events.filter((e) => {
				const eventDate = new Date(e.date);
				return eventDate >= startDate && eventDate <= endDate;
			});
		}

		// Sort by date (ascending)
		events.sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
		);

		return events;
	}, [timeline, filterCategory, showDeadlinesOnly, viewMode]);

	// Calculate today marker position (no accessor dependency - uses filteredEvents which is stable)
	const todayMarkerIndex = useMemo(() => {
		if (filteredEvents.length === 0) return -1;

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Find where today falls in the sorted events
		for (let i = 0; i < filteredEvents.length; i++) {
			const eventDate = new Date(filteredEvents[i].date);
			eventDate.setHours(0, 0, 0, 0);

			if (eventDate > today) {
				return i; // Insert before this event
			}
		}

		// All events are in the past
		return filteredEvents.length;
	}, [filteredEvents]);

	// Check if today is within the timeline range
	const showTodayMarker = useMemo(() => {
		if (filteredEvents.length === 0) return false;

		const today = new Date();
		const firstEventDate = new Date(filteredEvents[0].date);
		const lastEventDate = new Date(
			filteredEvents[filteredEvents.length - 1].date
		);

		// Show marker if today is between first and last event (with some buffer)
		const bufferDays = 30;
		const bufferMs = bufferDays * 24 * 60 * 60 * 1000;

		return (
			today.getTime() >= firstEventDate.getTime() - bufferMs &&
			today.getTime() <= lastEventDate.getTime() + bufferMs
		);
	}, [filteredEvents]);

	// Get deadline warnings
	const upcomingDeadlines = React.useMemo(() => {
		return timelineService.getUpcomingDeadlines(7);
	}, [timeline, timelineService]);

	const overdueDeadlines = React.useMemo(() => {
		return timelineService.getOverdueDeadlines();
	}, [timeline, timelineService]);

	if (isLoading) {
		return (
			<div
				className="flex items-center justify-center h-full p-8"
				style={{ backgroundColor: "#0a0a0a" }}
			>
				<div className="text-center">
					<div
						className="rounded-full h-10 w-10 border-2 mx-auto mb-4 animate-spin"
						style={{
							borderColor: `${BRAND_GREEN} transparent ${BRAND_GREEN} transparent`,
						}}
					/>
					<p style={{ color: "#a1a1aa" }}>Loading timeline...</p>
				</div>
			</div>
		);
	}

	if (!timeline) {
		return (
			<div
				className="flex flex-col items-center justify-center h-full p-8"
				style={{ backgroundColor: "#0a0a0a" }}
			>
				<div className="text-center max-w-md">
					{/* SafeAppeals Logo/Icon */}
					<div
						className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
						style={{
							backgroundColor: `${BRAND_GREEN}15`,
							border: `2px solid ${BRAND_GREEN}30`,
						}}
					>
						<svg
							width="40"
							height="40"
							viewBox="0 0 24 24"
							fill="none"
							stroke={BRAND_GREEN}
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
							<line x1="16" y1="2" x2="16" y2="6" />
							<line x1="8" y1="2" x2="8" y2="6" />
							<line x1="3" y1="10" x2="21" y2="10" />
							<path d="M9 16l2 2 4-4" />
						</svg>
					</div>

					<h2 className="text-2xl font-bold mb-3" style={{ color: "#fafafa" }}>
						Create Your Case Timeline
					</h2>
					<p className="mb-8 text-base" style={{ color: "#a1a1aa" }}>
						Track important events, deadlines, and documents for your workers'
						compensation case.
					</p>

					<button
						onClick={handleCreateTimeline}
						className="px-8 py-3 rounded-lg font-semibold text-base transition-all duration-200 hover:scale-105"
						style={{
							backgroundColor: BRAND_GREEN,
							color: "#0a0a0a",
							boxShadow: `0 4px 14px ${BRAND_GREEN}40`,
						}}
					>
						<span className="flex items-center gap-2">
							<i className="codicon codicon-add" />
							Add First Event
						</span>
					</button>

					<p className="mt-6 text-sm" style={{ color: "#71717a" }}>
						Start by adding your injury date or initial incident
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			className="h-full flex flex-row"
			style={{ backgroundColor: "#0a0a0a" }}
		>
			{/* Left Panel - Summary & Stats */}
			<div className="flex flex-col w-[400px] min-w-[350px] border-r border-[#27272a] overflow-y-auto custom-scrollbar bg-[#0f0f0f]">
				{/* Case Summary Dashboard */}
				<CaseSummary timeline={timeline} onEditEvent={handleEditEvent} />

				{/* Deadline Warnings */}
				{(overdueDeadlines.length > 0 || upcomingDeadlines.length > 0) && (
					<DeadlineWarnings
						overdueDeadlines={overdueDeadlines}
						upcomingDeadlines={upcomingDeadlines}
						onClickEvent={handleEditEvent}
					/>
				)}
			</div>

			{/* Right Panel - Timeline/Calendar Content */}
			<div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0a0a]">
				{/* Toolbar */}
				<TimelineToolbar
					onAddEvent={handleAddEvent}
					onExport={handleExport}
					onSyncFromCase={handleSyncFromCase}
					filterCategory={filterCategory}
					onFilterChange={setFilterCategory}
					showDeadlinesOnly={showDeadlinesOnly}
					onShowDeadlinesChange={setShowDeadlinesOnly}
					jurisdiction={timelineService.getJurisdiction(timeline.jurisdiction)}
					onJurisdictionClick={handleJurisdictionClick}
					eventCount={timeline.events.length}
					viewMode={viewMode}
					onViewModeChange={setViewMode}
					displayMode={displayMode}
					onDisplayModeChange={setDisplayMode}
					onEditEvent={handleEditEvent}
					onOpenNotificationSettings={() => setShowNotificationSettings(true)}
				/>

				{/* Content Area - Timeline or Calendar */}
				{displayMode === "calendar" ? (
					<CalendarView
						events={timeline.events}
						onEventClick={handleEditEvent}
						onAddEvent={handleAddEventWithDate}
					/>
				) : (
					<div className="flex-1 overflow-y-auto p-4">
						{filteredEvents.length === 0 ? (
							<div className="text-center py-12">
								<p style={{ color: "#71717a" }}>
									{timeline.events.length === 0
										? 'No events yet. Click "Add Event" to get started.'
										: "No events match the current filter."}
								</p>
							</div>
						) : (
							<div className="relative max-w-4xl mx-auto">
								{/* Timeline line - green accent */}
								<div
									className="absolute left-6 top-0 bottom-0 w-0.5"
									style={{
										background: `linear-gradient(to bottom, ${BRAND_GREEN}, ${BRAND_GREEN}40)`,
									}}
								/>

								{/* Events with Today Marker */}
								<div className="space-y-4">
									{filteredEvents.map((event, index) => (
										<React.Fragment key={event.id}>
											{/* Insert Today Marker before this event if appropriate */}
											{showTodayMarker && todayMarkerIndex === index && (
												<TodayMarker />
											)}
											<TimelineEventCard
												event={event}
												onEdit={() => handleEditEvent(event)}
												onDelete={() => handleDeleteEvent(event.id)}
												isFirst={index === 0}
												isLast={index === filteredEvents.length - 1}
											/>
										</React.Fragment>
									))}
									{/* Insert Today Marker at end if all events are in the past */}
									{showTodayMarker &&
										todayMarkerIndex === filteredEvents.length && (
											<TodayMarker />
										)}
								</div>
							</div>
						)}
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
					isFirstEvent={isFirstEventCreation}
				/>
			)}

			{/* Jurisdiction Selector Modal */}
			{showJurisdictionSelector && (
				<JurisdictionSelector
					jurisdictions={timelineService.getJurisdictions()}
					currentJurisdiction={timelineService.getJurisdiction(
						timeline.jurisdiction
					)}
					onSelect={handleJurisdictionChange}
					onClose={() => setShowJurisdictionSelector(false)}
				/>
			)}

			{/* Notification Preferences Modal */}
			{showNotificationSettings && (
				<NotificationPreferences
					onClose={() => setShowNotificationSettings(false)}
				/>
			)}
		</div>
	);
};
