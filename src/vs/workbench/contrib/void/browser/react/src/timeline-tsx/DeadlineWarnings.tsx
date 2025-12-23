/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import {
  TimelineEvent,
  formatTimelineDate,
  daysBetween } from
'../../../../common/timeline/timelineTypes.js';

interface DeadlineWarningsProps {
  overdueDeadlines: TimelineEvent[];
  upcomingDeadlines: TimelineEvent[];
  onClickEvent: (event: TimelineEvent) => void;
}

export const DeadlineWarnings: React.FC<DeadlineWarningsProps> = ({
  overdueDeadlines,
  upcomingDeadlines,
  onClickEvent
}) => {
  if (overdueDeadlines.length === 0 && upcomingDeadlines.length === 0) {
    return null;
  }

  return (
    <div className="p-3 space-y-2" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Overdue Deadlines */}
      {overdueDeadlines.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#1a0a0a',
            border: '1px solid #ef444430'
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#ef444420' }}
            >
              <i className="codicon codicon-warning" style={{ color: '#ef4444', fontSize: '16px' }} />
            </div>
            <span className="font-semibold" style={{ color: '#ef4444' }}>
              {overdueDeadlines.length} Overdue Deadline{overdueDeadlines.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1">
            {overdueDeadlines.slice(0, 3).map((deadline) => {
              const daysOverdue = daysBetween(new Date(deadline.date), new Date());
              return (
                <button
                  key={deadline.id}
                  onClick={() => onClickEvent(deadline)}
                  className="w-full text-left px-3 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#fafafa' }}>
                      {deadline.title}
                    </span>
                    <span className="text-xs font-medium" style={{ color: '#ef4444' }}>
                      {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                    </span>
                  </div>
                </button>
              );
            })}
            {overdueDeadlines.length > 3 && (
              <p className="text-xs pl-3 pt-1" style={{ color: '#71717a' }}>
                +{overdueDeadlines.length - 3} more overdue
              </p>
            )}
          </div>
        </div>
      )}

      {/* Upcoming Deadlines */}
      {upcomingDeadlines.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: '#1a1505',
            border: '1px solid #f59e0b30'
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#f59e0b20' }}
            >
              <i className="codicon codicon-clock" style={{ color: '#f59e0b', fontSize: '16px' }} />
            </div>
            <span className="font-semibold" style={{ color: '#f59e0b' }}>
              {upcomingDeadlines.length} Upcoming Deadline{upcomingDeadlines.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1">
            {upcomingDeadlines.slice(0, 3).map((deadline) => {
              const daysUntil = daysBetween(new Date(), new Date(deadline.date));
              const getUrgencyColor = () => {
                if (daysUntil <= 1) return '#ef4444';
                if (daysUntil <= 3) return '#f59e0b';
                return '#71717a';
              };
              return (
                <button
                  key={deadline.id}
                  onClick={() => onClickEvent(deadline)}
                  className="w-full text-left px-3 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#fafafa' }}>
                      {deadline.title}
                    </span>
                    <span className="text-xs font-medium" style={{ color: getUrgencyColor() }}>
                      {daysUntil === 0 ? 'Due today!' :
                       daysUntil === 1 ? 'Due tomorrow' :
                       `${daysUntil} days left`}
                    </span>
                  </div>
                </button>
              );
            })}
            {upcomingDeadlines.length > 3 && (
              <p className="text-xs pl-3 pt-1" style={{ color: '#71717a' }}>
                +{upcomingDeadlines.length - 3} more upcoming
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
