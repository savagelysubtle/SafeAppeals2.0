/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import {
  TimelineEvent,
  daysBetween } from
'../../../../common/timeline/timelineTypes.js';

// Reusable style objects with VSCode CSS variables
const textPrimaryStyle: React.CSSProperties = {
  color: 'var(--vscode-editor-foreground)'
};

const textMutedStyle: React.CSSProperties = {
  color: 'var(--vscode-descriptionForeground)'
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
    <div className="void-p-3 void-space-y-2" style={{ backgroundColor: 'var(--vscode-editor-background)' }}>
			{/* Overdue Deadlines */}
      {overdueDeadlines.length > 0 &&
      <div
        className="void-rounded-xl void-p-4"
        style={{
          backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
          border: '1px solid var(--vscode-inputValidation-errorBorder)'
        }}>
        
          <div className="void-flex void-items-center void-gap-2 void-mb-3">
            <div
            className="void-w-8 void-h-8 void-rounded-lg void-flex void-items-center void-justify-center"
            style={{ backgroundColor: 'var(--vscode-inputValidation-errorBackground)' }}>
            
              <i className="void-codicon void-codicon-warning" style={{ color: 'var(--vscode-errorForeground)', fontSize: '16px' }} />
            </div>
            <span className="void-font-semibold" style={{ color: 'var(--vscode-errorForeground)' }}>
							{overdueDeadlines.length} Overdue Deadline{overdueDeadlines.length !== 1 ? 's' : ''}
						</span>
					</div>
          <div className="void-space-y-1">
						{overdueDeadlines.slice(0, 3).map((deadline) => {
            const daysOverdue = daysBetween(new Date(deadline.date), new Date());
            return (
              <button
                key={deadline.id}
                onClick={() => onClickEvent(deadline)}
                className="void-w-full void-text-left void-px-3 void-py-2 void-rounded-lg void-transition-colors"
                style={{ backgroundColor: 'transparent' }}>
                
                  <div className="void-flex void-items-center void-justify-between">
                    <span style={textPrimaryStyle}>
											{deadline.title}
										</span>
                    <span className="void-text-xs void-font-medium" style={{ color: 'var(--vscode-errorForeground)' }}>
											{daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
										</span>
									</div>
                </button>);

          })}
            {overdueDeadlines.length > 3 &&
          <p className="void-text-xs void-pl-3 void-pt-1" style={textMutedStyle}>
								+{overdueDeadlines.length - 3} more overdue
							</p>
          }
					</div>
				</div>
      }

			{/* Upcoming Deadlines */}
      {upcomingDeadlines.length > 0 &&
      <div
        className="void-rounded-xl void-p-4"
        style={{
          backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
          border: '1px solid var(--vscode-inputValidation-warningBorder)'
        }}>
        
          <div className="void-flex void-items-center void-gap-2 void-mb-3">
            <div
            className="void-w-8 void-h-8 void-rounded-lg void-flex void-items-center void-justify-center"
            style={{ backgroundColor: 'var(--vscode-inputValidation-warningBackground)' }}>
            
              <i className="void-codicon void-codicon-clock" style={{ color: 'var(--vscode-editorWarning-foreground)', fontSize: '16px' }} />
            </div>
            <span className="void-font-semibold" style={{ color: 'var(--vscode-editorWarning-foreground)' }}>
							{upcomingDeadlines.length} Upcoming Deadline{upcomingDeadlines.length !== 1 ? 's' : ''}
						</span>
					</div>
          <div className="void-space-y-1">
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
                className="void-w-full void-text-left void-px-3 void-py-2 void-rounded-lg void-transition-colors"
                style={{ backgroundColor: 'transparent' }}>
                
                  <div className="void-flex void-items-center void-justify-between">
                    <span style={textPrimaryStyle}>
											{deadline.title}
										</span>
                    <span className="void-text-xs void-font-medium" style={{ color: getUrgencyColor() }}>
                      {daysUntil === 0 ? 'Due today!' :
                    daysUntil === 1 ? 'Due tomorrow' :
                    `${daysUntil} days left`}
										</span>
									</div>
                </button>);

          })}
            {upcomingDeadlines.length > 3 &&
          <p className="void-text-xs void-pl-3 void-pt-1" style={textMutedStyle}>
								+{upcomingDeadlines.length - 3} more upcoming
							</p>
          }
					</div>
				</div>
      }
    </div>);

};