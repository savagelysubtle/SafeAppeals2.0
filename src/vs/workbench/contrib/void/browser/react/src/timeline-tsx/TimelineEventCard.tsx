/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import {
  TimelineEvent,
  EVENT_CATEGORY_LABELS,
  EVENT_CATEGORY_COLORS,
  formatTimelineDate,
  isDeadlineOverdue,
  isDeadlineUpcoming } from
'../../../../../../workbench/contrib/void/common/timeline/timelineTypes.js';

interface TimelineEventCardProps {
  event: TimelineEvent;
  onEdit: () => void;
  onDelete: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export const TimelineEventCard: React.FC<TimelineEventCardProps> = ({
  event,
  onEdit,
  onDelete,
  isFirst,
  isLast
}) => {
  const [showActions, setShowActions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categoryColor = EVENT_CATEGORY_COLORS[event.category];
  const categoryLabel = EVENT_CATEGORY_LABELS[event.category];

  const isOverdue = isDeadlineOverdue(event);
  const isUpcoming = isDeadlineUpcoming(event, 7);

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div
      className="void-relative void-pl-12 void-group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setConfirmDelete(false);
      }}>
      
			{/* Timeline dot */}
			<div
        className="void-absolute void-left-4 void-w-5 void-h-5 void-rounded-full void-border-2 void-transform -void-translate-x-1/2"
        style={{
          backgroundColor: categoryColor,
          borderColor: 'var(--vscode-editor-background)',
          boxShadow: isOverdue ?
          '0 0 0 3px rgba(239, 68, 68, 0.4)' :
          isUpcoming ?
          '0 0 0 3px rgba(245, 158, 11, 0.4)' :
          'none'
        }} />
      

			{/* Event card */}
			<div
        className="void-rounded-lg void-p-4 void-transition-all"
        style={{
          backgroundColor: 'var(--vscode-editorWidget-background)',
          border: `1px solid ${isOverdue ?
          'var(--vscode-inputValidation-errorBorder)' :
          isUpcoming ?
          'var(--vscode-inputValidation-warningBorder)' :
          'var(--vscode-editorWidget-border)'}`

        }}>
        
				{/* Header */}
				<div className="void-flex void-items-start void-justify-between void-gap-2">
					<div className="void-flex-1 void-min-w-0">
						{/* Category badge */}
						<div className="void-flex void-items-center void-gap-2 void-mb-1">
							<span
                className="void-text-xs void-px-2 void-py-0.5 void-rounded-full void-font-medium"
                style={{
                  backgroundColor: `${categoryColor}20`,
                  color: categoryColor
                }}>
                
								{categoryLabel}
							</span>
							{event.isDeadline &&
              <span
                className="void-text-xs void-px-2 void-py-0.5 void-rounded-full void-font-medium"
                style={{
                  backgroundColor: isOverdue ?
                  'rgba(239, 68, 68, 0.2)' :
                  isUpcoming ?
                  'rgba(245, 158, 11, 0.2)' :
                  'rgba(59, 130, 246, 0.2)',
                  color: isOverdue ?
                  '#ef4444' :
                  isUpcoming ?
                  '#f59e0b' :
                  '#3b82f6'
                }}>
                
									{isOverdue ? '⚠️ Overdue' : isUpcoming ? '⏰ Due Soon' : '📅 Deadline'}
								</span>
              }
							{event.isComplete &&
              <span
                className="void-text-xs void-px-2 void-py-0.5 void-rounded-full void-font-medium"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: '#10b981'
                }}>
                
									✓ Complete
								</span>
              }
						</div>

						{/* Title */}
						<h3
              className="void-font-semibold void-text-base void-truncate"
              style={{ color: 'var(--vscode-foreground)' }}>
              
							{event.title}
						</h3>

						{/* Date */}
						<p
              className="void-text-sm"
              style={{ color: 'var(--vscode-descriptionForeground)' }}>
              
							{formatTimelineDate(event.date)}
							{event.endDate && ` - ${formatTimelineDate(event.endDate)}`}
						</p>
					</div>

					{/* Actions */}
					{showActions &&
          <div className="void-flex void-items-center void-gap-1">
							<button
              onClick={onEdit}
              className="void-p-1.5 void-rounded hover:void-bg-opacity-80 void-transition-colors"
              style={{
                backgroundColor: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)'
              }}
              title="Edit event">
              
								✏️
							</button>
							<button
              onClick={handleDelete}
              className="void-p-1.5 void-rounded hover:void-bg-opacity-80 void-transition-colors"
              style={{
                backgroundColor: confirmDelete ?
                'var(--vscode-inputValidation-errorBackground)' :
                'var(--vscode-button-secondaryBackground)',
                color: confirmDelete ?
                'var(--vscode-inputValidation-errorForeground)' :
                'var(--vscode-button-secondaryForeground)'
              }}
              title={confirmDelete ? 'Click again to confirm' : 'Delete event'}>
              
								{confirmDelete ? '❌' : '🗑️'}
							</button>
						</div>
          }
				</div>

				{/* Description */}
				{event.description &&
        <p
          className="void-mt-2 void-text-sm"
          style={{ color: 'var(--vscode-foreground)', opacity: 0.9 }}>
          
						{event.description}
					</p>
        }

				{/* Linked documents */}
				{event.linkedDocuments.length > 0 &&
        <div className="void-mt-3 void-flex void-flex-wrap void-gap-1">
						{event.linkedDocuments.map((docUri, index) => {
            const fileName = docUri.split('/').pop() || docUri;
            return (
              <span
                key={index}
                className="void-text-xs void-px-2 void-py-1 void-rounded void-flex void-items-center void-gap-1"
                style={{
                  backgroundColor: 'var(--vscode-badge-background)',
                  color: 'var(--vscode-badge-foreground)'
                }}>
                
									📄 {fileName}
								</span>);

          })}
					</div>
        }

				{/* Tags */}
				{event.tags && event.tags.length > 0 &&
        <div className="void-mt-2 void-flex void-flex-wrap void-gap-1">
						{event.tags.map((tag, index) =>
          <span
            key={index}
            className="void-text-xs void-px-2 void-py-0.5 void-rounded"
            style={{
              backgroundColor: 'var(--vscode-textLink-activeForeground)',
              color: 'var(--vscode-editor-background)',
              opacity: 0.8
            }}>
            
								#{tag}
							</span>
          )}
					</div>
        }
			</div>
		</div>);

};