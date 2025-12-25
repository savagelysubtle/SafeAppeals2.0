/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useMemo } from 'react';
import {
  TimelineEvent,
  EVENT_CATEGORY_COLORS,
  formatTimelineDate
} from '../../../../common/timeline/timelineTypes.js';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

type CalendarViewMode = 'month' | 'week';

interface CalendarViewProps {
  events: TimelineEvent[];
  onEventClick: (event: TimelineEvent) => void;
  onAddEvent: (date: Date) => void;
}

// Helper to get days in month
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Helper to get first day of month (0 = Sunday)
function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// Helper to format date as YYYY-MM-DD
function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper to check if two dates are the same day
function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  onEventClick,
  onAddEvent
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const today = useMemo(() => new Date(), []);

  // Group events by date
  const eventsOfDate = useMemo(() => {
    const map: Record<string, TimelineEvent[]> = {};
    for (const event of events) {
      const dateKey = event.date.split('T')[0];
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(event);
    }
    return map;
  }, [events]);

  // Navigation
  const goToPrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000));
    }
  };

  const goToNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Render month view
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days: (number | null)[] = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    // Pad last week if needed
    const lastWeek = weeks[weeks.length - 1];
    while (lastWeek.length < 7) {
      lastWeek.push(null);
    }

    return (
      <div
        className="grid grid-cols-7"
        style={{
          backgroundColor: '#0a0a0a',
          border: '1px solid #27272a',
          borderRadius: '8px',
          overflow: 'hidden'
        }}
      >
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div
            key={day}
            className="text-center text-xs font-semibold py-2"
            style={{
              backgroundColor: '#0f0f0f',
              color: '#71717a',
              borderBottom: '1px solid #27272a',
              borderRight: '1px solid #1f1f1f'
            }}
          >
            {day}
          </div>
        ))}

        {/* Calendar cells */}
        {weeks.flat().map((day, idx) => {
          if (day === null) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[80px]"
                style={{
                  backgroundColor: '#0a0a0a',
                  borderRight: '1px solid #1f1f1f',
                  borderBottom: '1px solid #1f1f1f'
                }}
              />
            );
          }

          const cellDate = new Date(year, month, day);
          const dateKey = toDateString(cellDate);
          const dayEvents = eventsOfDate[dateKey] || [];
          const isToday = isSameDay(cellDate, today);

          return (
            <div
              key={dateKey}
              className="min-h-[80px] p-1 cursor-pointer transition-colors hover:bg-[#1a1a1a]"
              style={{
                backgroundColor: isToday ? `${BRAND_GREEN}10` : '#0f0f0f',
                borderRight: '1px solid #1f1f1f',
                borderBottom: '1px solid #1f1f1f',
                borderLeft: isToday ? `2px solid ${BRAND_GREEN}` : 'none'
              }}
              onClick={() => onAddEvent(cellDate)}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-medium ${isToday ? 'px-1.5 py-0.5 rounded-full' : ''}`}
                  style={{
                    color: isToday ? '#0a0a0a' : '#a1a1aa',
                    backgroundColor: isToday ? BRAND_GREEN : 'transparent'
                  }}
                >
                  {day}
                </span>
                {dayEvents.length > 0 && (
                  <span
                    className="text-xs px-1 rounded"
                    style={{ backgroundColor: `${BRAND_GREEN}20`, color: BRAND_GREEN }}
                  >
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Events preview */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    className="text-xs truncate px-1 py-0.5 rounded cursor-pointer"
                    style={{
                      backgroundColor: `${EVENT_CATEGORY_COLORS[event.category]}20`,
                      color: EVENT_CATEGORY_COLORS[event.category],
                      borderLeft: `2px solid ${EVENT_CATEGORY_COLORS[event.category]}`
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs px-1" style={{ color: '#71717a' }}>
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render week view
  const renderWeekView = () => {
    // Get start of week (Sunday)
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDays.push(day);
    }

    return (
      <div
        className="grid grid-cols-7"
        style={{
          backgroundColor: '#0a0a0a',
          border: '1px solid #27272a',
          borderRadius: '8px',
          overflow: 'hidden'
        }}
      >
        {/* Day headers with date */}
        {weekDays.map(day => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={toDateString(day)}
              className="text-center py-2"
              style={{
                backgroundColor: isToday ? `${BRAND_GREEN}15` : '#0f0f0f',
                borderBottom: isToday ? `2px solid ${BRAND_GREEN}` : '1px solid #27272a',
                borderRight: '1px solid #1f1f1f'
              }}
            >
              <div className="text-xs font-semibold" style={{ color: '#71717a' }}>
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div
                className={`text-lg font-bold ${isToday ? 'inline-flex items-center justify-center w-8 h-8 rounded-full' : ''}`}
                style={{
                  color: isToday ? '#0a0a0a' : '#fafafa',
                  backgroundColor: isToday ? BRAND_GREEN : 'transparent'
                }}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}

        {/* Event columns */}
        {weekDays.map(day => {
          const dateKey = toDateString(day);
          const dayEvents = eventsOfDate[dateKey] || [];
          const isToday = isSameDay(day, today);

          return (
            <div
              key={`events-${dateKey}`}
              className="min-h-[300px] p-2 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
              style={{
                backgroundColor: isToday ? `${BRAND_GREEN}05` : '#0f0f0f',
                borderRight: '1px solid #1f1f1f'
              }}
              onClick={() => onAddEvent(day)}
            >
              <div className="space-y-1">
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    className="text-xs p-2 rounded-lg cursor-pointer transition-all hover:scale-[1.02]"
                    style={{
                      backgroundColor: `${EVENT_CATEGORY_COLORS[event.category]}15`,
                      border: `1px solid ${EVENT_CATEGORY_COLORS[event.category]}30`,
                      color: '#fafafa'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    {event.description && (
                      <div className="text-xs mt-1 truncate" style={{ color: '#a1a1aa' }}>
                        {event.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Month/Year label
  const headerLabel = viewMode === 'month'
    ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Calendar Header */}
      <div
        className="flex items-center justify-between p-3"
        style={{ borderBottom: `1px solid ${BRAND_GREEN}20` }}
      >
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevious}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ backgroundColor: '#1a1a1a', color: '#a1a1aa' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
          >
            <i className="codicon codicon-chevron-left" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ backgroundColor: `${BRAND_GREEN}15`, color: BRAND_GREEN }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${BRAND_GREEN}25`}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${BRAND_GREEN}15`}
          >
            Today
          </button>
          <button
            onClick={goToNext}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ backgroundColor: '#1a1a1a', color: '#a1a1aa' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
          >
            <i className="codicon codicon-chevron-right" />
          </button>
        </div>

        {/* Current period label */}
        <h2 className="text-lg font-semibold" style={{ color: '#fafafa' }}>
          {headerLabel}
        </h2>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: '#1a1a1a' }}>
          <button
            onClick={() => setViewMode('month')}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              backgroundColor: viewMode === 'month' ? BRAND_GREEN : 'transparent',
              color: viewMode === 'month' ? '#0a0a0a' : '#71717a'
            }}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode('week')}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              backgroundColor: viewMode === 'week' ? BRAND_GREEN : 'transparent',
              color: viewMode === 'week' ? '#0a0a0a' : '#71717a'
            }}
          >
            Week
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-2">
        {viewMode === 'month' ? renderMonthView() : renderWeekView()}
      </div>
    </div>
  );
};

