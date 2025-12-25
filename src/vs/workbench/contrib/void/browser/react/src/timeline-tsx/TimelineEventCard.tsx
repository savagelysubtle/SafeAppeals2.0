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
'../../../../common/timeline/timelineTypes.js';
import { useAccessor } from '../util/services.js';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

// File icons based on extension
const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  pdf: { icon: 'file-pdf', color: '#ef4444' },
  doc: { icon: 'file-text', color: '#3b82f6' },
  docx: { icon: 'file-text', color: '#3b82f6' },
  txt: { icon: 'file-text', color: '#6b7280' },
  md: { icon: 'markdown', color: '#6b7280' },
  jpg: { icon: 'file-media', color: '#f59e0b' },
  jpeg: { icon: 'file-media', color: '#f59e0b' },
  png: { icon: 'file-media', color: '#f59e0b' },
  default: { icon: 'file', color: '#64748b' }
};

function getFileIcon(filename: string): { icon: string; color: string } {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

function getFileName(uri: string): string {
  const parts = uri.split('/');
  return parts[parts.length - 1] || uri;
}

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
  const accessor = useAccessor();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categoryColor = EVENT_CATEGORY_COLORS[event.category];

  const handleOpenDocument = async (uriString: string) => {
    try {
      const editorService = accessor.get('IEditorService');
      const URI = accessor.get('URI');
      const uri = URI.parse(uriString);
      await editorService.openEditor({ resource: uri });
    } catch (error) {
      console.error('[TimelineEventCard] Failed to open document:', error);
    }
  };
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

  // Determine border color based on status
  const getBorderColor = () => {
    if (isOverdue) return '#ef4444';
    if (isUpcoming) return '#f59e0b';
    if (isFirst) return BRAND_GREEN;
    return '#27272a';
  };

  return (
    <div className="relative pl-12 group mb-4">
      {/* Drag Handle - shown on group hover via CSS (no React state to avoid re-renders) */}
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-8 rounded cursor-grab active:cursor-grabbing flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-60 transition-opacity"
        style={{ backgroundColor: '#27272a' }}
        title="Drag to reorder (coming soon)"
      >
        <div className="w-1 h-1 rounded-full" style={{ backgroundColor: '#71717a' }} />
        <div className="w-1 h-1 rounded-full" style={{ backgroundColor: '#71717a' }} />
        <div className="w-1 h-1 rounded-full" style={{ backgroundColor: '#71717a' }} />
      </div>

      {/* Timeline Dot - green for first event */}
      <div
        className="absolute left-4 w-4 h-4 rounded-full border-2 transform -translate-x-1/2 z-10 mt-5"
        style={{
          backgroundColor: isFirst ? BRAND_GREEN : categoryColor,
          borderColor: '#0a0a0a',
          boxShadow: isOverdue
            ? '0 0 0 3px rgba(239, 68, 68, 0.3)'
            : isUpcoming
            ? '0 0 0 3px rgba(245, 158, 11, 0.3)'
            : isFirst
            ? `0 0 0 3px ${BRAND_GREEN}30`
            : 'none'
        }}
      />

      {/* Card */}
      <div
        className="rounded-xl transition-all duration-200"
        style={{
          backgroundColor: '#111111',
          border: `1px solid ${getBorderColor()}`,
          boxShadow: isFirst ? `0 4px 12px ${BRAND_GREEN}10` : 'none'
        }}
      >
        {/* Card Header */}
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              {/* Top row: Category badge + Status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Category Badge */}
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: `${categoryColor}20`,
                    color: categoryColor,
                    border: `1px solid ${categoryColor}30`
                  }}
                >
                  {categoryLabel}
                </span>

                {/* First Event Badge */}
                {isFirst && (
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: `${BRAND_GREEN}15`,
                      color: BRAND_GREEN,
                      border: `1px solid ${BRAND_GREEN}30`
                    }}
                  >
                    <i className="codicon codicon-star-full mr-1" style={{ fontSize: '10px' }} />
                    First Event
                  </span>
                )}

                {/* Status Badges */}
                {event.isDeadline && (
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: isOverdue ? '#ef444420' : isUpcoming ? '#f59e0b20' : '#3b82f620',
                      color: isOverdue ? '#ef4444' : isUpcoming ? '#f59e0b' : '#3b82f6',
                      border: `1px solid ${isOverdue ? '#ef444430' : isUpcoming ? '#f59e0b30' : '#3b82f630'}`
                    }}
                  >
                    <i className={`codicon ${isOverdue ? 'codicon-warning' : 'codicon-clock'} mr-1`} style={{ fontSize: '10px' }} />
                    {isOverdue ? 'Overdue' : isUpcoming ? 'Due Soon' : 'Deadline'}
                  </span>
                )}

                {event.isComplete && (
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: `${BRAND_GREEN}15`,
                      color: BRAND_GREEN,
                      border: `1px solid ${BRAND_GREEN}30`
                    }}
                  >
                    <i className="codicon codicon-check mr-1" style={{ fontSize: '10px' }} />
                    Complete
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="font-semibold text-base" style={{ color: '#fafafa' }}>
                {event.title}
              </h3>

              {/* Date */}
              <p className="text-sm" style={{ color: '#71717a' }}>
                <i className="codicon codicon-calendar mr-1.5" style={{ fontSize: '12px' }} />
                {formatTimelineDate(event.date)}
                {event.endDate && ` → ${formatTimelineDate(event.endDate)}`}
              </p>
            </div>

            {/* Action Buttons - Always visible, not just on hover */}
            <div className="flex items-center gap-1 ml-3">
              {/* Edit Button */}
              <button
                onClick={onEdit}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #27272a',
                  color: '#a1a1aa'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = BRAND_GREEN;
                  e.currentTarget.style.borderColor = BRAND_GREEN;
                  e.currentTarget.style.color = '#0a0a0a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1a1a1a';
                  e.currentTarget.style.borderColor = '#27272a';
                  e.currentTarget.style.color = '#a1a1aa';
                }}
                title="Edit event"
              >
                <i className="codicon codicon-edit" style={{ fontSize: '14px' }} />
              </button>

              {/* Delete Button */}
              <button
                onClick={handleDelete}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                style={{
                  backgroundColor: confirmDelete ? '#ef4444' : '#1a1a1a',
                  border: `1px solid ${confirmDelete ? '#ef4444' : '#27272a'}`,
                  color: confirmDelete ? '#fafafa' : '#a1a1aa'
                }}
                onMouseEnter={(e) => {
                  if (!confirmDelete) {
                    e.currentTarget.style.backgroundColor = '#ef444420';
                    e.currentTarget.style.borderColor = '#ef4444';
                    e.currentTarget.style.color = '#ef4444';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!confirmDelete) {
                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                    e.currentTarget.style.borderColor = '#27272a';
                    e.currentTarget.style.color = '#a1a1aa';
                  }
                }}
                title={confirmDelete ? 'Click again to confirm' : 'Delete event'}
              >
                <i className={`codicon ${confirmDelete ? 'codicon-check' : 'codicon-trash'}`} style={{ fontSize: '14px' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Card Content */}
        {(event.description || event.linkedDocuments.length > 0 || (event.tags && event.tags.length > 0)) && (
          <div
            className="px-4 pb-4 pt-0"
            style={{ borderTop: '1px solid #1f1f1f' }}
          >
            <div className="pt-3">
              {/* Description */}
              {event.description && (
                <p className="text-sm mb-3 whitespace-pre-wrap" style={{ color: '#a1a1aa' }}>
                  {event.description}
                </p>
              )}

              {/* Linked Docs */}
              {event.linkedDocuments.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <i className="codicon codicon-file-symlink-file" style={{ color: BRAND_GREEN, fontSize: '12px' }} />
                    <span className="text-xs font-medium" style={{ color: '#71717a' }}>
                      Linked Documents ({event.linkedDocuments.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {event.linkedDocuments.map((docUri, idx) => {
                      const fileName = getFileName(docUri);
                      const { icon, color } = getFileIcon(fileName);
                      return (
                        <button
                          key={idx}
                          onClick={() => handleOpenDocument(docUri)}
                          className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs cursor-pointer transition-all"
                          style={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #27272a',
                            color: '#a1a1aa'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = `${BRAND_GREEN}15`;
                            e.currentTarget.style.borderColor = `${BRAND_GREEN}40`;
                            e.currentTarget.style.color = '#fafafa';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#1a1a1a';
                            e.currentTarget.style.borderColor = '#27272a';
                            e.currentTarget.style.color = '#a1a1aa';
                          }}
                          title={`Open ${fileName}`}
                        >
                          <i className={`codicon codicon-${icon} mr-1.5`} style={{ color, fontSize: '12px' }} />
                          {fileName}
                          <i className="codicon codicon-link-external ml-1.5" style={{ fontSize: '10px', opacity: 0.5 }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tags */}
              {event.tags && event.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs"
                      style={{ color: '#52525b' }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
