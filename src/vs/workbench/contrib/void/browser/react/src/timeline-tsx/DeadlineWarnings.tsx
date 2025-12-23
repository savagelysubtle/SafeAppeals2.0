/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import {
  TimelineEvent,
  formatTimelineDate,
  daysBetween } from
'../../../../../../workbench/contrib/void/common/timeline/timelineTypes.js';

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
    <div className="void-p-3 void-space-y-2">
			{/* Overdue Deadlines */}
			{overdueDeadlines.length > 0 &&
      <div
        className="void-rounded-lg void-p-3"
        style={{
          backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
          border: '1px solid var(--vscode-inputValidation-errorBorder)'
        }}>
        
					<div className="void-flex void-items-center void-gap-2 void-mb-2">
						<span className="void-text-lg">⚠️</span>
						<span
            className="void-font-semibold"
            style={{ color: 'var(--vscode-errorForeground)' }}>
            
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
                className="void-w-full void-text-left void-px-2 void-py-1 void-rounded hover:void-bg-black/10 void-transition-colors">
                
									<div className="void-flex void-items-center void-justify-between">
										<span style={{ color: 'var(--vscode-foreground)' }}>
											{deadline.title}
										</span>
										<span
                    className="void-text-xs"
                    style={{ color: 'var(--vscode-errorForeground)' }}>
                    
											{daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
										</span>
									</div>
								</button>);

          })}
						{overdueDeadlines.length > 3 &&
          <p
            className="void-text-xs void-pl-2"
            style={{ color: 'var(--vscode-descriptionForeground)' }}>
            
								+{overdueDeadlines.length - 3} more overdue
							</p>
          }
					</div>
				</div>
      }

			{/* Upcoming Deadlines */}
			{upcomingDeadlines.length > 0 &&
      <div
        className="void-rounded-lg void-p-3"
        style={{
          backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
          border: '1px solid var(--vscode-inputValidation-warningBorder)'
        }}>
        
					<div className="void-flex void-items-center void-gap-2 void-mb-2">
						<span className="void-text-lg">⏰</span>
						<span
            className="void-font-semibold"
            style={{ color: 'var(--vscode-editorWarning-foreground)' }}>
            
							{upcomingDeadlines.length} Upcoming Deadline{upcomingDeadlines.length !== 1 ? 's' : ''}
						</span>
					</div>
					<div className="void-space-y-1">
						{upcomingDeadlines.slice(0, 3).map((deadline) => {
            const daysUntil = daysBetween(new Date(), new Date(deadline.date));
            return (
              <button
                key={deadline.id}
                onClick={() => onClickEvent(deadline)}
                className="void-w-full void-text-left void-px-2 void-py-1 void-rounded hover:void-bg-black/10 void-transition-colors">
                
									<div className="void-flex void-items-center void-justify-between">
										<span style={{ color: 'var(--vscode-foreground)' }}>
											{deadline.title}
										</span>
										<span
                    className="void-text-xs"
                    style={{
                      color: daysUntil <= 1 ?
                      'var(--vscode-errorForeground)' :
                      daysUntil <= 3 ?
                      'var(--vscode-editorWarning-foreground)' :
                      'var(--vscode-descriptionForeground)'
                    }}>
                    
											{daysUntil === 0 ?
                    'Due today!' :
                    daysUntil === 1 ?
                    'Due tomorrow' :
                    `${daysUntil} days left`}
										</span>
									</div>
								</button>);

          })}
						{upcomingDeadlines.length > 3 &&
          <p
            className="void-text-xs void-pl-2"
            style={{ color: 'var(--vscode-descriptionForeground)' }}>
            
								+{upcomingDeadlines.length - 3} more upcoming
							</p>
          }
					</div>
				</div>
      }
		</div>);

};