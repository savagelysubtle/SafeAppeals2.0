/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useMemo } from 'react';
import {
  CaseTimeline,
  TimelineEvent,
  EventCategory,
  EVENT_CATEGORY_COLORS,
  EVENT_CATEGORY_LABELS
} from '../../../../common/timeline/timelineTypes.js';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

// Appeal workflow stages
type AppealStage = 'initial' | 'submitted' | 'review' | 'decision' | 'appeal';

interface CaseSummaryProps {
  timeline: CaseTimeline;
  onEditEvent?: (event: TimelineEvent) => void;
}

interface KPICardProps {
  icon: string;
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
  isWarning?: boolean;
  onClick?: () => void;
}

const KPICard: React.FC<KPICardProps> = ({ icon, label, value, subtext, color = BRAND_GREEN, isWarning, onClick }) => (
  <div
    className={`flex flex-col p-3 rounded-lg transition-all ${onClick ? 'cursor-pointer hover:scale-105' : ''}`}
    style={{
      backgroundColor: isWarning ? '#7f1d1d20' : '#1a1a1a',
      border: `1px solid ${isWarning ? '#ef4444' : '#27272a'}`,
    }}
    onClick={onClick}
  >
    <div className="flex items-center gap-2 mb-1">
      <i className={`codicon codicon-${icon}`} style={{ color: isWarning ? '#ef4444' : color, fontSize: '14px' }} />
      <span className="text-xs font-medium" style={{ color: '#71717a' }}>{label}</span>
    </div>
    <div className="text-xl font-bold" style={{ color: isWarning ? '#ef4444' : '#fafafa' }}>{value}</div>
    {subtext && <span className="text-xs mt-0.5" style={{ color: '#52525b' }}>{subtext}</span>}
  </div>
);

export const CaseSummary: React.FC<CaseSummaryProps> = ({ timeline, onEditEvent }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Calculate days since injury
  const daysSinceInjury = useMemo(() => {
    if (!timeline.injuryDate) return null;
    const injury = new Date(timeline.injuryDate);
    const today = new Date();
    const diffTime = today.getTime() - injury.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [timeline.injuryDate]);

  // Calculate days until next deadline
  const nextDeadline = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingDeadlines = timeline.events
      .filter(e => e.isDeadline && !e.isComplete)
      .map(e => ({ event: e, date: new Date(e.date) }))
      .filter(({ date }) => date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (upcomingDeadlines.length === 0) return null;

    const next = upcomingDeadlines[0];
    const diffTime = next.date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return { days: diffDays, event: next.event };
  }, [timeline.events]);

  // Calculate overdue deadlines count
  const overdueCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return timeline.events.filter(e =>
      e.isDeadline && !e.isComplete && new Date(e.date) < today
    ).length;
  }, [timeline.events]);

  // Document counts by category
  const documentCounts = useMemo(() => {
    const counts: Record<EventCategory, number> = {
      injury: 0,
      medical: 0,
      hearing: 0,
      decision: 0,
      deadline: 0,
      filing: 0,
      correspondence: 0,
      custom: 0,
    };

    timeline.events.forEach(event => {
      counts[event.category] += event.linkedDocuments?.length || 0;
    });

    // Return only categories with documents
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([category, count]) => ({
        category: category as EventCategory,
        count,
        color: EVENT_CATEGORY_COLORS[category as EventCategory],
        label: EVENT_CATEGORY_LABELS[category as EventCategory]
      }));
  }, [timeline.events]);

  const totalDocuments = useMemo(() => {
    return timeline.events.reduce((sum, e) => sum + (e.linkedDocuments?.length || 0), 0);
  }, [timeline.events]);

  // Task completion (deadlines)
  const taskStats = useMemo(() => {
    const deadlines = timeline.events.filter(e => e.isDeadline);
    const completed = deadlines.filter(e => e.isComplete).length;
    return { completed, total: deadlines.length };
  }, [timeline.events]);

  // Determine appeal stage based on events
  const appealStage = useMemo((): { stage: AppealStage; label: string } => {
    const hasDecision = timeline.events.some(e => e.category === 'decision');
    const hasFiling = timeline.events.some(e => e.category === 'filing');
    const hasHearing = timeline.events.some(e => e.category === 'hearing');

    // Check for keywords in event titles/descriptions
    const hasAppeal = timeline.events.some(e =>
      e.title.toLowerCase().includes('appeal') ||
      (e.description?.toLowerCase().includes('appeal'))
    );
    const hasReview = timeline.events.some(e =>
      e.title.toLowerCase().includes('review') ||
      e.title.toLowerCase().includes('under review')
    );

    if (hasAppeal && hasDecision) return { stage: 'appeal', label: 'Appeal Filed' };
    if (hasDecision) return { stage: 'decision', label: 'Decision Received' };
    if (hasReview || hasHearing) return { stage: 'review', label: 'Under Review' };
    if (hasFiling) return { stage: 'submitted', label: 'Claim Submitted' };
    return { stage: 'initial', label: 'Initial Claim' };
  }, [timeline.events]);

  const stages: { id: AppealStage; label: string; icon: string }[] = [
    { id: 'initial', label: 'Initial', icon: 'file' },
    { id: 'submitted', label: 'Submitted', icon: 'send' },
    { id: 'review', label: 'Review', icon: 'eye' },
    { id: 'decision', label: 'Decision', icon: 'law' },
  ];

  const currentStageIndex = stages.findIndex(s => s.id === appealStage.stage);

  if (isCollapsed) {
    return (
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer transition-colors"
        style={{ backgroundColor: '#0f0f0f', borderBottom: `1px solid ${BRAND_GREEN}20` }}
        onClick={() => setIsCollapsed(false)}
      >
        <div className="flex items-center gap-3">
          <i className="codicon codicon-graph" style={{ color: BRAND_GREEN }} />
          <span className="font-medium" style={{ color: '#fafafa' }}>Case Summary</span>
          {daysSinceInjury !== null && (
            <span className="text-sm" style={{ color: '#71717a' }}>
              Day {daysSinceInjury}
            </span>
          )}
          {overdueCount > 0 && (
            <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: '#7f1d1d', color: '#fca5a5' }}>
              {overdueCount} overdue
            </span>
          )}
        </div>
        <i className="codicon codicon-chevron-down" style={{ color: '#71717a' }} />
      </div>
    );
  }

  return (
    <div
      className="p-4"
      style={{ backgroundColor: '#0f0f0f', borderBottom: `1px solid ${BRAND_GREEN}20` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => setIsCollapsed(true)}
      >
        <div className="flex items-center gap-2">
          <i className="codicon codicon-graph" style={{ color: BRAND_GREEN }} />
          <h3 className="font-semibold" style={{ color: '#fafafa' }}>Case Summary</h3>
          {timeline.caseName && (
            <span className="text-sm" style={{ color: '#71717a' }}>— {timeline.caseName}</span>
          )}
        </div>
        <i className="codicon codicon-chevron-up" style={{ color: '#71717a' }} />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KPICard
          icon="calendar"
          label="Days Since Injury"
          value={daysSinceInjury ?? '—'}
          subtext={timeline.injuryDate ? new Date(timeline.injuryDate).toLocaleDateString() : 'No injury date set'}
        />

        <KPICard
          icon="clock"
          label="Next Deadline"
          value={nextDeadline ? `${nextDeadline.days}d` : '—'}
          subtext={nextDeadline?.event.title || 'No upcoming deadlines'}
          isWarning={nextDeadline ? nextDeadline.days <= 3 : false}
          onClick={nextDeadline && onEditEvent ? () => onEditEvent(nextDeadline.event) : undefined}
        />

        <KPICard
          icon="file"
          label="Documents"
          value={totalDocuments}
          subtext={documentCounts.length > 0
            ? documentCounts.slice(0, 2).map(d => `${d.count} ${d.label}`).join(', ')
            : 'No documents linked'
          }
        />

        <KPICard
          icon="tasklist"
          label="Tasks Complete"
          value={`${taskStats.completed}/${taskStats.total}`}
          subtext={taskStats.total === 0
            ? 'No deadlines set'
            : overdueCount > 0
              ? `${overdueCount} overdue!`
              : 'All on track'
          }
          isWarning={overdueCount > 0}
        />
      </div>

      {/* Appeal Status Tracker */}
      <div className="p-3 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #27272a' }}>
        <div className="flex items-center gap-2 mb-3">
          <i className="codicon codicon-milestone" style={{ color: BRAND_GREEN }} />
          <span className="text-sm font-medium" style={{ color: '#a1a1aa' }}>Case Status</span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded" style={{ backgroundColor: `${BRAND_GREEN}20`, color: BRAND_GREEN }}>
            {appealStage.label}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-1">
          {stages.map((stage, index) => {
            const isActive = index <= currentStageIndex;
            const isCurrent = index === currentStageIndex;

            return (
              <React.Fragment key={stage.id}>
                {/* Stage Circle */}
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-full transition-all"
                  style={{
                    backgroundColor: isActive ? BRAND_GREEN : '#27272a',
                    border: isCurrent ? `2px solid ${BRAND_GREEN}` : 'none',
                    boxShadow: isCurrent ? `0 0 0 4px ${BRAND_GREEN}20` : 'none'
                  }}
                  title={stage.label}
                >
                  <i
                    className={`codicon codicon-${stage.icon}`}
                    style={{ color: isActive ? '#0a0a0a' : '#52525b', fontSize: '12px' }}
                  />
                </div>

                {/* Connector Line (except after last) */}
                {index < stages.length - 1 && (
                  <div
                    className="flex-1 h-1 rounded-full"
                    style={{
                      backgroundColor: index < currentStageIndex ? BRAND_GREEN : '#27272a'
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Stage Labels */}
        <div className="flex justify-between mt-2">
          {stages.map((stage, index) => (
            <span
              key={stage.id}
              className="text-xs"
              style={{
                color: index <= currentStageIndex ? '#a1a1aa' : '#52525b',
                width: index === 0 || index === stages.length - 1 ? 'auto' : 'auto',
                textAlign: index === 0 ? 'left' : index === stages.length - 1 ? 'right' : 'center'
              }}
            >
              {stage.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

