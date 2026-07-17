/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useMemo, useState } from 'react';
import {
  EVENT_CATEGORY_COLORS,
  TimelineEvent } from
'../../../../common/timeline/timelineTypes.js';

// Reusable style objects with VSCode CSS variables
const containerStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-editor-background)',
  color: 'var(--vscode-editor-foreground)'
};

const buttonSecondaryStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: 'none',
  borderRadius: '8px'
};

const textMutedStyle: React.CSSProperties = {
  color: 'var(--vscode-descriptionForeground)'
};

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
        className="void-grid void-grid-cols-7"
        style={{
          backgroundColor: 'var(--vscode-editor-background)',
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
        
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) =>
        <div
          key={day}
          className="void-text-center void-text-xs void-font-semibold void-py-2"
          style={{
            backgroundColor: 'var(--vscode-sideBar-background)',
            color: 'var(--vscode-descriptionForeground)',
            borderBottom: '1px solid var(--vscode-panel-border)',
            borderRight: '1px solid var(--vscode-panel-border)'
          }}>
          
            {day}
          </div>
        )}

        {/* Calendar cells */}
        {weeks.flat().map((day, idx) => {
          if (day === null) {
            return (
              <div
                key={`empty-${idx}`}
                className="void-min-h-[80px]"
                style={{
                  backgroundColor: 'var(--vscode-editor-background)',
                  borderRight: '1px solid var(--vscode-panel-border)',
                  borderBottom: '1px solid var(--vscode-panel-border)'
                }} />);


          }

          const cellDate = new Date(year, month, day);
          const dateKey = toDateString(cellDate);
          const dayEvents = eventsOfDate[dateKey] || [];
          const isToday = isSameDay(cellDate, today);

          return (
            <div
              key={dateKey}
              className="void-min-h-[80px] void-p-1 void-cursor-pointer void-transition-colors"
              style={{
                backgroundColor: isToday ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-sideBar-background)',
                borderRight: '1px solid var(--vscode-panel-border)',
                borderBottom: '1px solid var(--vscode-panel-border)',
                borderLeft: isToday ? '2px solid var(--vscode-button-background)' : 'none'
              }}
              onClick={() => onAddEvent(cellDate)}>
              
              {/* Day number */}
              <div className="void-flex void-items-center void-justify-between void-mb-1">
                <span
                  className={`void-text-xs void-font-medium ${isToday ? "void-px-1.5 void-py-0.5 void-rounded-full" : ""}`}
                  style={{
                    color: isToday ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)',
                    backgroundColor: isToday ? 'var(--vscode-button-background)' : 'transparent'
                  }}>
                  
                  {day}
                </span>
                {dayEvents.length > 0 &&
                <span
                  className="void-text-xs void-px-1 void-rounded"
                  style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-background)' }}>
                  
                    {dayEvents.length}
                  </span>
                }
              </div>

              {/* Events preview */}
              <div className="void-space-y-0.5">
                {dayEvents.slice(0, 3).map((event) =>
                <div
                  key={event.id}
                  className="void-text-xs void-truncate void-px-1 void-py-0.5 void-rounded void-cursor-pointer"
                  style={{
                    backgroundColor: `${EVENT_CATEGORY_COLORS[event.category]}20`,
                    color: EVENT_CATEGORY_COLORS[event.category],
                    borderLeft: `2px solid ${EVENT_CATEGORY_COLORS[event.category]}`
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(event);
                  }}
                  title={event.title}>
                  
                    {event.title}
                  </div>
                )}
                {dayEvents.length > 3 &&
                <div className="void-text-xs void-px-1" style={textMutedStyle}>
                    +{dayEvents.length - 3} more
                  </div>
                }
              </div>
            </div>);

        })}
      </div>);

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
        className="void-grid void-grid-cols-7"
        style={{
          backgroundColor: 'var(--vscode-editor-background)',
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
        
        {/* Day headers with date */}
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={toDateString(day)}
              className="void-text-center void-py-2"
              style={{
                backgroundColor: isToday ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-sideBar-background)',
                borderBottom: isToday ? '2px solid var(--vscode-button-background)' : '1px solid var(--vscode-panel-border)',
                borderRight: '1px solid var(--vscode-panel-border)'
              }}>
              
              <div className="void-text-xs void-font-semibold" style={textMutedStyle}>
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div
                className={`void-text-lg void-font-bold ${isToday ? "void-inline-flex void-items-center void-justify-center void-w-8 void-h-8 void-rounded-full" : ""}`}
                style={{
                  color: isToday ? 'var(--vscode-button-foreground)' : 'var(--vscode-editor-foreground)',
                  backgroundColor: isToday ? 'var(--vscode-button-background)' : 'transparent'
                }}>
                
                {day.getDate()}
              </div>
            </div>);

        })}

        {/* Event columns */}
        {weekDays.map((day) => {
          const dateKey = toDateString(day);
          const dayEvents = eventsOfDate[dateKey] || [];
          const isToday = isSameDay(day, today);

          return (
            <div
              key={`events-${dateKey}`}
              className="void-min-h-[300px] void-p-2 void-cursor-pointer void-transition-colors"
              style={{
                backgroundColor: isToday ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-sideBar-background)',
                borderRight: '1px solid var(--vscode-panel-border)'
              }}
              onClick={() => onAddEvent(day)}>
              
              <div className="void-space-y-1">
                {dayEvents.map((event) =>
                <div
                  key={event.id}
                  className="void-text-xs void-p-2 void-rounded-lg void-cursor-pointer void-transition-all hover:void-scale-[1.02]"
                  style={{
                    backgroundColor: `${EVENT_CATEGORY_COLORS[event.category]}15`,
                    border: `1px solid ${EVENT_CATEGORY_COLORS[event.category]}30`,
                    color: 'var(--vscode-editor-foreground)'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(event);
                  }}>
                  
                    <div className="void-font-medium void-truncate">{event.title}</div>
                    {event.description &&
                  <div className="void-text-xs void-mt-1 void-truncate" style={textMutedStyle}>
                        {event.description}
                      </div>
                  }
                  </div>
                )}
              </div>
            </div>);

        })}
      </div>);

  };

  // Month/Year label
  const headerLabel = viewMode === 'month' ?
  currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) :
  `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="void-flex void-flex-col void-h-full" style={containerStyle}>
      {/* Calendar Header */}
      <div
        className="void-flex void-items-center void-justify-between void-p-3"
        style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
        
        {/* Navigation */}
        <div className="void-flex void-items-center void-gap-2">
          <button
            onClick={goToPrevious}
            className="void-w-8 void-h-8 void-rounded-lg void-flex void-items-center void-justify-center void-transition-colors"
            style={buttonSecondaryStyle}>
            
            <i className="void-codicon void-codicon-chevron-left" />
          </button>
          <button
            onClick={goToToday}
            className="void-px-3 void-py-1.5 void-rounded-lg void-text-xs void-font-medium void-transition-colors"
            style={{
              backgroundColor: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)'
            }}>
            
            Today
          </button>
          <button
            onClick={goToNext}
            className="void-w-8 void-h-8 void-rounded-lg void-flex void-items-center void-justify-center void-transition-colors"
            style={buttonSecondaryStyle}>
            
            <i className="void-codicon void-codicon-chevron-right" />
          </button>
        </div>

        {/* Current period label */}
        <h2 className="void-text-lg void-font-semibold" style={{ color: 'var(--vscode-editor-foreground)' }}>
          {headerLabel}
        </h2>

        {/* View mode toggle */}
        <div className="void-flex void-items-center void-gap-1 void-p-1 void-rounded-lg" style={buttonSecondaryStyle}>
          <button
            onClick={() => setViewMode('month')}
            className="void-px-3 void-py-1.5 void-rounded-md void-text-xs void-font-medium void-transition-all"
            style={{
              backgroundColor: viewMode === 'month' ? 'var(--vscode-button-background)' : 'transparent',
              color: viewMode === 'month' ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)'
            }}>
            
            Month
          </button>
          <button
            onClick={() => setViewMode('week')}
            className="void-px-3 void-py-1.5 void-rounded-md void-text-xs void-font-medium void-transition-all"
            style={{
              backgroundColor: viewMode === 'week' ? 'var(--vscode-button-background)' : 'transparent',
              color: viewMode === 'week' ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)'
            }}>
            
            Week
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="void-flex-1 void-overflow-auto void-p-2 void-void-scrollbar">
        {viewMode === 'month' ? renderMonthView() : renderWeekView()}
      </div>
    </div>);

};