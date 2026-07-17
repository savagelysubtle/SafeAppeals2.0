/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useMemo, useState } from 'react';
import {
  CaseTimeline,
  EVENT_CATEGORY_COLORS,
  EVENT_CATEGORY_LABELS,
  EventCategory,
  TimelineEvent } from
'../../../../common/timeline/timelineTypes.js';

// Reusable style objects with VSCode CSS variables
const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-button-secondaryBackground)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '8px'
};

const warningCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
  border: '1px solid var(--vscode-errorForeground)',
  borderRadius: '8px'
};

const textMutedStyle: React.CSSProperties = {
  color: 'var(--vscode-descriptionForeground)'
};

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

const KPICard: React.FC<KPICardProps> = ({ icon, label, value, subtext, color = 'var(--vscode-button-background)', isWarning, onClick }) =>
<div
  className={`void-flex void-flex-col void-p-3 void-rounded-lg void-transition-all ${onClick ? "void-cursor-pointer hover:void-scale-105" : ""}`}
  style={isWarning ? warningCardStyle : cardStyle}
  onClick={onClick}>
  
    <div className="void-flex void-items-center void-gap-2 void-mb-1">
      <i className={`void-codicon void-codicon-${icon}`} style={{ color: isWarning ? 'var(--vscode-errorForeground)' : color, fontSize: '14px' }} />
      <span className="void-text-xs void-font-medium" style={textMutedStyle}>{label}</span>
    </div>
    <div className="void-text-xl void-font-bold" style={{ color: isWarning ? 'var(--vscode-errorForeground)' : 'var(--vscode-editor-foreground)' }}>{value}</div>
    {subtext && <span className="void-text-xs void-mt-0.5" style={{ color: 'var(--vscode-disabledForeground)' }}>{subtext}</span>}
  </div>;


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

    const upcomingDeadlines = timeline.events.
    filter((e) => e.isDeadline && !e.isComplete).
    map((e) => ({ event: e, date: new Date(e.date) })).
    filter(({ date }) => date >= today).
    sort((a, b) => a.date.getTime() - b.date.getTime());

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

    return timeline.events.filter((e) =>
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
      custom: 0
    };

    timeline.events.forEach((event) => {
      counts[event.category] += event.linkedDocuments?.length || 0;
    });

    // Return only categories with documents
    return Object.entries(counts).
    filter(([_, count]) => count > 0).
    map(([category, count]) => ({
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
    const deadlines = timeline.events.filter((e) => e.isDeadline);
    const completed = deadlines.filter((e) => e.isComplete).length;
    return { completed, total: deadlines.length };
  }, [timeline.events]);

  // Determine appeal stage based on events
  const appealStage = useMemo((): {stage: AppealStage;label: string;} => {
    const hasDecision = timeline.events.some((e) => e.category === 'decision');
    const hasFiling = timeline.events.some((e) => e.category === 'filing');
    const hasHearing = timeline.events.some((e) => e.category === 'hearing');

    // Check for keywords in event titles/descriptions
    const hasAppeal = timeline.events.some((e) =>
    e.title.toLowerCase().includes('appeal') ||
    e.description?.toLowerCase().includes('appeal')
    );
    const hasReview = timeline.events.some((e) =>
    e.title.toLowerCase().includes('review') ||
    e.title.toLowerCase().includes('under review')
    );

    if (hasAppeal && hasDecision) return { stage: 'appeal', label: 'Appeal Filed' };
    if (hasDecision) return { stage: 'decision', label: 'Decision Received' };
    if (hasReview || hasHearing) return { stage: 'review', label: 'Under Review' };
    if (hasFiling) return { stage: 'submitted', label: 'Claim Submitted' };
    return { stage: 'initial', label: 'Initial Claim' };
  }, [timeline.events]);

  const stages: {id: AppealStage;label: string;icon: string;}[] = [
  { id: 'initial', label: 'Initial', icon: 'file' },
  { id: 'submitted', label: 'Submitted', icon: 'send' },
  { id: 'review', label: 'Review', icon: 'eye' },
  { id: 'decision', label: 'Decision', icon: 'law' }];


  const currentStageIndex = stages.findIndex((s) => s.id === appealStage.stage);

  if (isCollapsed) {
    return (
      <div
        className="void-flex void-items-center void-justify-between void-px-4 void-py-2 void-cursor-pointer void-transition-colors"
        style={{ backgroundColor: 'var(--vscode-sideBar-background)', borderBottom: '1px solid var(--vscode-panel-border)' }}
        onClick={() => setIsCollapsed(false)}>
        
        <div className="void-flex void-items-center void-gap-3">
          <i className="void-codicon void-codicon-graph" style={{ color: 'var(--vscode-button-background)' }} />
          <span className="void-font-medium" style={{ color: 'var(--vscode-editor-foreground)' }}>Case Summary</span>
          {daysSinceInjury !== null &&
          <span className="void-text-sm" style={textMutedStyle}>
              Day {daysSinceInjury}
            </span>
          }
          {overdueCount > 0 &&
          <span className="void-px-2 void-py-0.5 void-rounded void-text-xs void-font-medium" style={{ backgroundColor: 'var(--vscode-inputValidation-errorBackground)', color: 'var(--vscode-errorForeground)' }}>
              {overdueCount} overdue
            </span>
          }
        </div>
        <i className="void-codicon void-codicon-chevron-down" style={textMutedStyle} />
      </div>);

  }

  return (
    <div
      className="void-p-4"
      style={{ backgroundColor: 'var(--vscode-sideBar-background)', borderBottom: '1px solid var(--vscode-panel-border)' }}>
      
      {/* Header */}
      <div
        className="void-flex void-items-center void-justify-between void-mb-4 void-cursor-pointer"
        onClick={() => setIsCollapsed(true)}>
        
        <div className="void-flex void-items-center void-gap-2">
          <i className="void-codicon void-codicon-graph" style={{ color: 'var(--vscode-button-background)' }} />
          <h3 className="void-font-semibold" style={{ color: 'var(--vscode-editor-foreground)' }}>Case Summary</h3>
          {timeline.caseName &&
          <span className="void-text-sm" style={textMutedStyle}>— {timeline.caseName}</span>
          }
        </div>
        <i className="void-codicon void-codicon-chevron-up" style={textMutedStyle} />
      </div>

      {/* KPI Cards Grid - Always 2 columns in sidebar */}
      <div className="void-grid void-grid-cols-2 void-gap-3 void-mb-4">
        <KPICard
          icon="calendar"
          label="Days Since Injury"
          value={daysSinceInjury ?? '—'}
          subtext={timeline.injuryDate ? new Date(timeline.injuryDate).toLocaleDateString() : 'No injury date set'} />
        

        <KPICard
          icon="clock"
          label="Next Deadline"
          value={nextDeadline ? `${nextDeadline.days}d` : '—'}
          subtext={nextDeadline?.event.title || 'No upcoming deadlines'}
          isWarning={nextDeadline ? nextDeadline.days <= 3 : false}
          onClick={nextDeadline && onEditEvent ? () => onEditEvent(nextDeadline.event) : undefined} />
        

        <KPICard
          icon="file"
          label="Documents"
          value={totalDocuments}
          subtext={documentCounts.length > 0 ?
          documentCounts.slice(0, 2).map((d) => `${d.count} ${d.label}`).join(', ') :
          'No documents linked'
          } />
        

        <KPICard
          icon="tasklist"
          label="Tasks Complete"
          value={`${taskStats.completed}/${taskStats.total}`}
          subtext={taskStats.total === 0 ?
          'No deadlines set' :
          overdueCount > 0 ?
          `${overdueCount} overdue!` :
          'All on track'
          }
          isWarning={overdueCount > 0} />
        
      </div>

      {/* Appeal Status Tracker */}
      <div className="void-p-3 void-rounded-lg" style={cardStyle}>
        <div className="void-flex void-items-center void-gap-2 void-mb-3">
          <i className="void-codicon void-codicon-milestone" style={{ color: 'var(--vscode-button-background)' }} />
          <span className="void-text-sm void-font-medium" style={textMutedStyle}>Case Status</span>
          <span className="void-ml-auto void-text-xs void-px-2 void-py-0.5 void-rounded" style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-background)' }}>
            {appealStage.label}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="void-flex void-items-center void-gap-1">
          {stages.map((stage, index) => {
            const isActive = index <= currentStageIndex;
            const isCurrent = index === currentStageIndex;

            return (
              <React.Fragment key={stage.id}>
                {/* Stage Circle */}
                <div
                  className="void-flex void-items-center void-justify-center void-w-8 void-h-8 void-rounded-full void-transition-all"
                  style={{
                    backgroundColor: isActive ? 'var(--vscode-button-background)' : 'var(--vscode-panel-border)',
                    border: isCurrent ? '2px solid var(--vscode-button-background)' : 'none',
                    boxShadow: isCurrent ? '0 0 0 4px var(--vscode-button-secondaryBackground)' : 'none'
                  }}
                  title={stage.label}>
                  
                  <i
                    className={`void-codicon void-codicon-${stage.icon}`}
                    style={{ color: isActive ? 'var(--vscode-button-foreground)' : 'var(--vscode-disabledForeground)', fontSize: '12px' }} />
                  
                </div>

                {/* Connector Line (except after last) */}
                {index < stages.length - 1 &&
                <div
                  className="void-flex-1 void-h-1 void-rounded-full"
                  style={{
                    backgroundColor: index < currentStageIndex ? 'var(--vscode-button-background)' : 'var(--vscode-panel-border)'
                  }} />

                }
              </React.Fragment>);

          })}
        </div>

        {/* Stage Labels */}
        <div className="void-flex void-justify-between void-mt-2">
          {stages.map((stage, index) =>
          <span
            key={stage.id}
            className="void-text-xs"
            style={{
              color: index <= currentStageIndex ? 'var(--vscode-descriptionForeground)' : 'var(--vscode-disabledForeground)',
              width: index === 0 || index === stages.length - 1 ? 'auto' : 'auto',
              textAlign: index === 0 ? 'left' : index === stages.length - 1 ? 'right' : 'center'
            }}>
            
              {stage.label}
            </span>
          )}
        </div>
      </div>
    </div>);

};