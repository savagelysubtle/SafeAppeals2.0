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
  isDeadlineUpcoming } from
'../../../../common/timeline/timelineTypes.js';
import { TimelineEventCard } from './TimelineEventCard.js';
import { EventEditor } from './EventEditor.js';
import { TimelineToolbar } from './TimelineToolbar.js';
import { DeadlineWarnings } from './DeadlineWarnings.js';
import { JurisdictionSelector } from './JurisdictionSelector.js';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

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
  const [isFirstEventCreation, setIsFirstEventCreation] = useState(false);
  const [showJurisdictionSelector, setShowJurisdictionSelector] = useState(false);

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
    setIsFirstEventCreation(false);
    setShowEventEditor(true);
  }, []);

  const handleEditEvent = useCallback((event: TimelineEvent) => {
    setEditingEvent(event);
    setIsFirstEventCreation(false);
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
      setIsFirstEventCreation(false);
    } catch (error) {
      console.error('[TimelineDashboard] Failed to save event:', error);
    }
  }, [timelineService, editingEvent]);

  const handleCancelEdit = useCallback(() => {
    setShowEventEditor(false);
    setEditingEvent(null);
    setIsFirstEventCreation(false);
  }, []);

  const handleCreateTimeline = useCallback(() => {
    // Instead of auto-creating a "Timeline Created" event,
    // open the event editor to let user create their first event
    setEditingEvent(null);
    setIsFirstEventCreation(true);
    setShowEventEditor(true);
  }, []);

  const handleJurisdictionChange = useCallback(async (jurisdictionId: string) => {
    try {
      await timelineService.setJurisdiction(jurisdictionId);
    } catch (error) {
      console.error('[TimelineDashboard] Failed to change jurisdiction:', error);
    }
  }, [timelineService]);

  const handleJurisdictionClick = useCallback(() => {
    setShowJurisdictionSelector(true);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const htmlBytes = await timelineService.exportToPDF();
      const html = new TextDecoder().decode(htmlBytes);

      // Create a Blob and download it
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timeline-${timeline?.caseId || 'export'}-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('[TimelineDashboard] Timeline exported successfully');
    } catch (error) {
      console.error('[TimelineDashboard] Failed to export timeline:', error);
    }
  }, [timelineService, timeline]);

  // Filter and sort events
  const filteredEvents = React.useMemo(() => {
    if (!timeline) return [];

    let events = [...timeline.events];

    // Filter by category
    if (filterCategory !== 'all') {
      events = events.filter((e) => e.category === filterCategory);
    }

    // Filter deadlines only
    if (showDeadlinesOnly) {
      events = events.filter((e) => e.isDeadline);
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
      <div className="flex items-center justify-center h-full p-8" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="text-center">
          <div
            className="rounded-full h-10 w-10 border-2 mx-auto mb-4 animate-spin"
            style={{ borderColor: `${BRAND_GREEN} transparent ${BRAND_GREEN} transparent` }}
          />
          <p style={{ color: '#a1a1aa' }}>Loading timeline...</p>
        </div>
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="text-center max-w-md">
          {/* SafeAppeals Logo/Icon */}
          <div
            className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: `${BRAND_GREEN}15`, border: `2px solid ${BRAND_GREEN}30` }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={BRAND_GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <path d="M9 16l2 2 4-4"/>
            </svg>
          </div>

          <h2 className="text-2xl font-bold mb-3" style={{ color: '#fafafa' }}>
            Create Your Case Timeline
          </h2>
          <p className="mb-8 text-base" style={{ color: '#a1a1aa' }}>
            Track important events, deadlines, and documents for your workers' compensation case.
          </p>

          <button
            onClick={handleCreateTimeline}
            className="px-8 py-3 rounded-lg font-semibold text-base transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: BRAND_GREEN,
              color: '#0a0a0a',
              boxShadow: `0 4px 14px ${BRAND_GREEN}40`
            }}
          >
            <span className="flex items-center gap-2">
              <i className="codicon codicon-add" />
              Add First Event
            </span>
          </button>

          <p className="mt-6 text-sm" style={{ color: '#71717a' }}>
            Start by adding your injury date or initial incident
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#0a0a0a' }}>
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
        onExport={handleExport}
        filterCategory={filterCategory}
        onFilterChange={setFilterCategory}
        showDeadlinesOnly={showDeadlinesOnly}
        onShowDeadlinesChange={setShowDeadlinesOnly}
        jurisdiction={timelineService.getJurisdiction(timeline.jurisdiction)}
        onJurisdictionClick={handleJurisdictionClick}
        eventCount={timeline.events.length}
      />

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: '#71717a' }}>
              {timeline.events.length === 0
                ? 'No events yet. Click "Add Event" to get started.'
                : 'No events match the current filter.'}
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line - green accent */}
            <div
              className="absolute left-6 top-0 bottom-0 w-0.5"
              style={{ background: `linear-gradient(to bottom, ${BRAND_GREEN}, ${BRAND_GREEN}40)` }}
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
          isFirstEvent={isFirstEventCreation}
        />
      )}

      {/* Jurisdiction Selector Modal */}
      {showJurisdictionSelector && (
        <JurisdictionSelector
          jurisdictions={timelineService.getJurisdictions()}
          currentJurisdiction={timelineService.getJurisdiction(timeline.jurisdiction)}
          onSelect={handleJurisdictionChange}
          onClose={() => setShowJurisdictionSelector(false)}
        />
      )}
    </div>
  );
};
