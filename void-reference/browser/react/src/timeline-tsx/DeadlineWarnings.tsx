/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import {
    TimelineEvent,
    daysBetween
} from '../../../../common/timeline/timelineTypes.js';

// Reusable style objects with VSCode CSS variables
const textPrimaryStyle: React.CSSProperties = {
  color: 'var(--vscode-editor-foreground)',
};

const textMutedStyle: React.CSSProperties = {
  color: 'var(--vscode-descriptionForeground)',
};

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
    <div className="p-3 space-y-2" style={{ backgroundColor: 'var(--vscode-editor-background)' }}>
			{/* Overdue Deadlines */}
      {overdueDeadlines.length > 0 && (
      <div
          className="rounded-xl p-4"
        style={{
            backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
            border: '1px solid var(--vscode-inputValidation-errorBorder)'
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--vscode-inputValidation-errorBackground)' }}
            >
              <i className="codicon codicon-warning" style={{ color: 'var(--vscode-errorForeground)', fontSize: '16px' }} />
            </div>
            <span className="font-semibold" style={{ color: 'var(--vscode-errorForeground)' }}>
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
                >
                  <div className="flex items-center justify-between">
                    <span style={textPrimaryStyle}>
											{deadline.title}
										</span>
                    <span className="text-xs font-medium" style={{ color: 'var(--vscode-errorForeground)' }}>
											{daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
										</span>
									</div>
                </button>
              );
          })}
            {overdueDeadlines.length > 3 && (
              <p className="text-xs pl-3 pt-1" style={textMutedStyle}>
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
            backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
            border: '1px solid var(--vscode-inputValidation-warningBorder)'
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--vscode-inputValidation-warningBackground)' }}
            >
              <i className="codicon codicon-clock" style={{ color: 'var(--vscode-editorWarning-foreground)', fontSize: '16px' }} />
            </div>
            <span className="font-semibold" style={{ color: 'var(--vscode-editorWarning-foreground)' }}>
							{upcomingDeadlines.length} Upcoming Deadline{upcomingDeadlines.length !== 1 ? 's' : ''}
						</span>
					</div>
          <div className="space-y-1">
						{upcomingDeadlines.slice(0, 3).map((deadline) => {
            const daysUntil = daysBetween(new Date(), new Date(deadline.date));
              const getUrgencyColor = () => {
                if (daysUntil <= 1) return 'var(--vscode-errorForeground)';
                if (daysUntil <= 3) return 'var(--vscode-editorWarning-foreground)';
                return 'var(--vscode-descriptionForeground)';
              };
            return (
              <button
                key={deadline.id}
                onClick={() => onClickEvent(deadline)}
                  className="w-full text-left px-3 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                >
                  <div className="flex items-center justify-between">
                    <span style={textPrimaryStyle}>
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
              <p className="text-xs pl-3 pt-1" style={textMutedStyle}>
								+{upcomingDeadlines.length - 3} more upcoming
							</p>
            )}
					</div>
				</div>
      )}
    </div>
  );
};
