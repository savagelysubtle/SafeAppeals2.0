/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import {
  TimelineEvent,
  EventCategory,
  EVENT_CATEGORY_LABELS,
  EVENT_CATEGORY_COLORS,
  JurisdictionConfig } from
'../../../../common/timeline/timelineTypes.js';
import { DocumentPicker } from './DocumentPicker.js';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';
const BRAND_GREEN_HOVER = '#16a34a';

// File icons based on extension
const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  pdf: { icon: 'file-pdf', color: '#ef4444' },
  doc: { icon: 'file-text', color: '#3b82f6' },
  docx: { icon: 'file-text', color: '#3b82f6' },
  txt: { icon: 'file-text', color: '#6b7280' },
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

interface EventEditorProps {
  event: TimelineEvent | null;
  jurisdictions: JurisdictionConfig[];
  currentJurisdiction: string;
  onSave: (eventData: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  isFirstEvent?: boolean;
}

export const EventEditor: React.FC<EventEditorProps> = ({
  event,
  jurisdictions,
  currentJurisdiction,
  onSave,
  onCancel,
  isFirstEvent = false
}) => {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  // Parse dates as local time to avoid timezone shifts
  const [date, setDate] = useState(() => {
    if (event?.date) {
      // Extract just YYYY-MM-DD from ISO string, treating as local date
      const d = new Date(event.date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [endDate, setEndDate] = useState(() => {
    if (event?.endDate) {
      const d = new Date(event.endDate);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return '';
  });
  const [category, setCategory] = useState<EventCategory>(event?.category || (isFirstEvent ? 'injury' : 'custom'));
  const [isDeadline, setIsDeadline] = useState(event?.isDeadline || false);
  const [isComplete, setIsComplete] = useState(event?.isComplete || false);
  const [tagsInput, setTagsInput] = useState(event?.tags?.join(', ') || '');
  const [reminderDays, setReminderDays] = useState(
    event?.reminderDays?.join(', ') || '7, 3, 1'
  );
  const [linkedDocuments, setLinkedDocuments] = useState<string[]>(event?.linkedDocuments || []);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);

  const isEditing = !!event;

  const handleLinkDocument = useCallback((uri: string) => {
    setLinkedDocuments(prev => [...prev, uri]);
  }, []);

  const handleUnlinkDocument = useCallback((uri: string) => {
    setLinkedDocuments(prev => prev.filter(d => d !== uri));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    // Create dates at noon local time to avoid timezone day-shift issues
    const [year, month, day] = date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day, 12, 0, 0);

    let localEndDate: Date | undefined;
    if (endDate) {
      const [ey, em, ed] = endDate.split('-').map(Number);
      localEndDate = new Date(ey, em - 1, ed, 12, 0, 0);
    }

    const eventData: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'> = {
      title: title.trim(),
      description: description.trim() || undefined,
      date: localDate.toISOString(),
      endDate: localEndDate ? localEndDate.toISOString() : undefined,
      category,
      isDeadline,
      isComplete: isDeadline ? isComplete : undefined,
      linkedDocuments,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      reminderDays: isDeadline ? reminderDays.split(',').map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n)) : undefined
    };

    onSave(eventData);
  };

  const categories: EventCategory[] = ['injury', 'medical', 'hearing', 'decision', 'deadline', 'filing', 'correspondence', 'custom'];

  return (
    // More opaque backdrop for better focus
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onCancel}
    >
      {/* Modal Card - solid black with green accents, fixed height */}
			<div
        className="w-full max-w-lg rounded-xl shadow-2xl transition-all duration-200 flex flex-col"
        style={{
          backgroundColor: '#0f0f0f',
          border: `1px solid ${BRAND_GREEN}30`,
          boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px ${BRAND_GREEN}10`,
          height: '680px',
          maxHeight: '90vh'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with green accent */}
				<div
          className="flex items-center justify-between px-6 py-4 rounded-t-xl"
          style={{ borderBottom: `1px solid ${BRAND_GREEN}20` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${BRAND_GREEN}15` }}
            >
              <i className="codicon codicon-calendar" style={{ color: BRAND_GREEN, fontSize: '18px' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: '#fafafa' }}>
                {isFirstEvent ? 'Add Your First Event' : isEditing ? 'Edit Event' : 'New Event'}
					</h2>
              {isFirstEvent && (
                <p className="text-xs" style={{ color: '#71717a' }}>
                  Start with your injury date or initial incident
                </p>
              )}
            </div>
          </div>
					<button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#71717a' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f1f1f'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <i className="codicon codicon-close" />
					</button>
				</div>

				{/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1" style={{ minHeight: 0 }}>
          {/* Scrollable content - always shows scrollbar */}
          <div
            className="p-6 space-y-5 overflow-y-auto flex-1"
            style={{
              minHeight: 0,
              scrollbarGutter: 'stable'
            }}
          >
					{/* Title */}
          <div className="grid gap-2">
            <label className="text-sm font-medium" style={{ color: '#e4e4e7' }}>
              Title <span style={{ color: BRAND_GREEN }}>*</span>
						</label>
						<input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter event title..."
              required
              autoFocus
              className="h-10 w-full rounded-lg px-3 text-sm transition-all outline-none"
              style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #27272a',
                color: '#fafafa'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = BRAND_GREEN}
              onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'}
            />
					</div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium" style={{ color: '#e4e4e7' }}>
                Date <span style={{ color: BRAND_GREEN }}>*</span>
							</label>
							<input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="h-10 w-full rounded-lg px-3 text-sm transition-all outline-none"
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #27272a',
                  color: '#fafafa',
                  colorScheme: 'dark'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = BRAND_GREEN}
                onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'}
              />
						</div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" style={{ color: '#a1a1aa' }}>
                End Date <span style={{ color: '#52525b' }}>(optional)</span>
							</label>
							<input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="h-10 w-full rounded-lg px-3 text-sm transition-all outline-none"
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #27272a',
                  color: '#fafafa',
                  colorScheme: 'dark'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = BRAND_GREEN}
                onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'}
              />
						</div>
					</div>

					{/* Category */}
          <div className="grid gap-2">
            <label className="text-sm font-medium" style={{ color: '#e4e4e7' }}>Category</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => {
                const isSelected = category === cat;
                const catColor = EVENT_CATEGORY_COLORS[cat];
                return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                      backgroundColor: isSelected ? catColor : '#1a1a1a',
                      color: isSelected ? '#0a0a0a' : '#a1a1aa',
                      border: `1px solid ${isSelected ? catColor : '#27272a'}`,
                      fontWeight: isSelected ? 600 : 500
                    }}
                  >
									{EVENT_CATEGORY_LABELS[cat]}
								</button>
                );
              })}
						</div>
					</div>

					{/* Description */}
          <div className="grid gap-2">
            <label className="text-sm font-medium" style={{ color: '#a1a1aa' }}>Description</label>
						<textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add details about this event..."
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm transition-all outline-none resize-none"
              style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #27272a',
                color: '#fafafa'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = BRAND_GREEN}
              onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'}
            />
					</div>

          {/* Deadline Toggle */}
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #27272a' }}
          >
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className="relative w-10 h-6 rounded-full transition-colors cursor-pointer"
                style={{ backgroundColor: isDeadline ? BRAND_GREEN : '#27272a' }}
                onClick={() => setIsDeadline(!isDeadline)}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full transition-transform"
                  style={{
                    backgroundColor: '#fafafa',
                    transform: isDeadline ? 'translateX(20px)' : 'translateX(4px)'
                  }}
                />
              </div>
              <div>
                <span className="text-sm font-medium" style={{ color: '#e4e4e7' }}>
								This is a deadline
							</span>
                <p className="text-xs" style={{ color: '#71717a' }}>
                  Get reminders before this date
                </p>
              </div>
						</label>

            {isDeadline && (
              <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid #27272a' }}>
                <label className="flex items-center gap-3 cursor-pointer">
									<input
                  type="checkbox"
                  checked={isComplete}
                    onChange={e => setIsComplete(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: BRAND_GREEN }}
                  />
                  <span className="text-sm" style={{ color: '#a1a1aa' }}>Mark as complete</span>
								</label>

                <div className="grid gap-2">
                  <label className="text-xs font-medium" style={{ color: '#71717a' }}>
                    Reminder days before deadline
									</label>
									<input
                  type="text"
                  value={reminderDays}
                    onChange={e => setReminderDays(e.target.value)}
                  placeholder="7, 3, 1"
                    className="h-9 w-full rounded-lg px-3 text-sm transition-all outline-none"
                  style={{
                      backgroundColor: '#0f0f0f',
                      border: '1px solid #27272a',
                      color: '#fafafa'
                    }}
                  />
                </div>
								</div>
            )}
					</div>

					{/* Tags */}
          <div className="grid gap-2">
            <label className="text-sm font-medium" style={{ color: '#a1a1aa' }}>Tags</label>
						<input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="important, appeal, urgent"
              className="h-10 w-full rounded-lg px-3 text-sm transition-all outline-none"
              style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #27272a',
                color: '#fafafa'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = BRAND_GREEN}
              onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'}
            />
            <p className="text-xs" style={{ color: '#52525b' }}>Separate tags with commas</p>
          </div>

          {/* Linked Documents */}
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #27272a' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <i className="codicon codicon-file-symlink-file" style={{ color: BRAND_GREEN, fontSize: '14px' }} />
                <span className="text-sm font-medium" style={{ color: '#e4e4e7' }}>
                  Linked Documents
                </span>
                {linkedDocuments.length > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${BRAND_GREEN}20`, color: BRAND_GREEN }}
                  >
                    {linkedDocuments.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowDocumentPicker(true)}
                className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                style={{
                  backgroundColor: `${BRAND_GREEN}15`,
                  color: BRAND_GREEN,
                  border: `1px solid ${BRAND_GREEN}30`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${BRAND_GREEN}25`;
                  e.currentTarget.style.borderColor = BRAND_GREEN;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = `${BRAND_GREEN}15`;
                  e.currentTarget.style.borderColor = `${BRAND_GREEN}30`;
                }}
              >
                <i className="codicon codicon-add" style={{ fontSize: '12px' }} />
                {linkedDocuments.length === 0 ? 'Link Documents' : 'Manage'}
              </button>
            </div>

            {linkedDocuments.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {linkedDocuments.slice(0, 5).map(uri => {
                  const fileName = getFileName(uri);
                  const { icon, color } = getFileIcon(fileName);
                  return (
                    <div
                      key={uri}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ backgroundColor: '#0f0f0f' }}
                    >
                      <i className={`codicon codicon-${icon}`} style={{ color, fontSize: '14px' }} />
                      <span className="text-sm truncate flex-1" style={{ color: '#a1a1aa' }}>
                        {fileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUnlinkDocument(uri)}
                        className="text-xs px-1.5 py-0.5 rounded transition-colors"
                        style={{ color: '#ef4444' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ef444420'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <i className="codicon codicon-close" style={{ fontSize: '12px' }} />
                      </button>
                    </div>
                  );
                })}
                {linkedDocuments.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowDocumentPicker(true)}
                    className="text-xs w-full py-1.5 rounded-lg"
                    style={{ color: '#71717a' }}
                  >
                    +{linkedDocuments.length - 5} more documents
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs" style={{ color: '#52525b' }}>
                Link related documents like medical records, decisions, or correspondence
              </p>
            )}
					</div>

          </div>

					{/* Actions - fixed footer */}
          <div
            className="flex justify-end gap-3 px-6 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid #27272a' }}
          >
						<button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #27272a',
                color: '#a1a1aa'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#27272a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
            >
							Cancel
						</button>
						<button
              type="submit"
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor: BRAND_GREEN,
                color: '#0a0a0a',
                boxShadow: `0 2px 8px ${BRAND_GREEN}30`
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = BRAND_GREEN_HOVER}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = BRAND_GREEN}
            >
              {isEditing ? 'Save Changes' : 'Create Event'}
						</button>
					</div>
				</form>
			</div>

      {/* Document Picker Modal */}
      {showDocumentPicker && (
        <DocumentPicker
          linkedDocuments={linkedDocuments}
          onLink={handleLinkDocument}
          onUnlink={handleUnlinkDocument}
          onClose={() => setShowDocumentPicker(false)}
        />
      )}
    </div>
  );
};
