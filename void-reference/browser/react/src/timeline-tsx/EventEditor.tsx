/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useState } from 'react';
import {
    EVENT_CATEGORY_COLORS,
    EVENT_CATEGORY_LABELS,
    EventCategory,
    JurisdictionConfig,
    TimelineEvent
} from '../../../../common/timeline/timelineTypes.js';
import { DocumentPicker } from './DocumentPicker.js';

// Reusable style objects with VSCode CSS variables
const modalStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-sideBar-background)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '12px',
};

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: '8px',
};

const buttonPrimaryStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
};

const buttonSecondaryStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '8px',
};

const labelStyle: React.CSSProperties = {
  color: 'var(--vscode-foreground)',
};

const labelMutedStyle: React.CSSProperties = {
  color: 'var(--vscode-descriptionForeground)',
};

// File icons based on extension - using VSCode semantic colors
const FILE_ICONS: Record<string, { icon: string; colorVar: string }> = {
  pdf: { icon: 'file-pdf', colorVar: 'var(--vscode-charts-red)' },
  doc: { icon: 'file-text', colorVar: 'var(--vscode-charts-blue)' },
  docx: { icon: 'file-text', colorVar: 'var(--vscode-charts-blue)' },
  txt: { icon: 'file-text', colorVar: 'var(--vscode-descriptionForeground)' },
  default: { icon: 'file', colorVar: 'var(--vscode-descriptionForeground)' }
};

function getFileIcon(filename: string): { icon: string; colorVar: string } {
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
      {/* Modal Card */}
			<div
        className="w-full max-w-lg rounded-xl shadow-2xl transition-all duration-200 flex flex-col"
        style={{
          ...modalStyle,
          height: '680px',
          maxHeight: '90vh'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
				<div
          className="flex items-center justify-between px-6 py-4 rounded-t-xl"
          style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)' }}
            >
              <i className="codicon codicon-calendar" style={{ color: 'var(--vscode-button-background)', fontSize: '18px' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--vscode-editor-foreground)' }}>
                {isFirstEvent ? 'Add Your First Event' : isEditing ? 'Edit Event' : 'New Event'}
					</h2>
              {isFirstEvent && (
                <p className="text-xs" style={labelMutedStyle}>
                  Start with your injury date or initial incident
                </p>
              )}
            </div>
          </div>
					<button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={buttonSecondaryStyle}
          >
            <i className="codicon codicon-close" />
					</button>
				</div>

				{/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1" style={{ minHeight: 0 }}>
          {/* Scrollable content - always shows scrollbar */}
          <div
            className="p-6 space-y-5 overflow-y-auto flex-1 void-scrollbar"
            style={{
              minHeight: 0,
              scrollbarGutter: 'stable'
            }}
          >
					{/* Title */}
          <div className="grid gap-2">
            <label className="text-sm font-medium" style={labelStyle}>
              Title <span style={{ color: 'var(--vscode-button-background)' }}>*</span>
						</label>
						<input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter event title..."
              required
              autoFocus
              className="h-10 w-full rounded-lg px-3 text-sm transition-all outline-none"
              style={inputStyle}
            />
					</div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium" style={labelStyle}>
                Date <span style={{ color: 'var(--vscode-button-background)' }}>*</span>
							</label>
							<input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="h-10 w-full rounded-lg px-3 text-sm transition-all outline-none"
                style={inputStyle}
              />
						</div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" style={labelMutedStyle}>
                End Date <span style={{ color: 'var(--vscode-disabledForeground)' }}>(optional)</span>
							</label>
							<input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="h-10 w-full rounded-lg px-3 text-sm transition-all outline-none"
                style={inputStyle}
              />
						</div>
					</div>

					{/* Category */}
          <div className="grid gap-2">
            <label className="text-sm font-medium" style={labelStyle}>Category</label>
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
                      backgroundColor: isSelected ? catColor : 'var(--vscode-button-secondaryBackground)',
                      color: isSelected ? 'var(--vscode-editor-background)' : 'var(--vscode-descriptionForeground)',
                      border: `1px solid ${isSelected ? catColor : 'var(--vscode-panel-border)'}`,
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
            <label className="text-sm font-medium" style={labelMutedStyle}>Description</label>
						<textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add details about this event..."
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm transition-all outline-none resize-none"
              style={inputStyle}
            />
					</div>

          {/* Deadline Toggle */}
          <div
            className="rounded-lg p-4"
            style={buttonSecondaryStyle}
          >
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className="relative w-10 h-6 rounded-full transition-colors cursor-pointer"
                style={{ backgroundColor: isDeadline ? 'var(--vscode-button-background)' : 'var(--vscode-panel-border)' }}
                onClick={() => setIsDeadline(!isDeadline)}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full transition-transform"
                  style={{
                    backgroundColor: 'var(--vscode-editor-foreground)',
                    transform: isDeadline ? 'translateX(20px)' : 'translateX(4px)'
                  }}
                />
              </div>
              <div>
                <span className="text-sm font-medium" style={labelStyle}>
								This is a deadline
							</span>
                <p className="text-xs" style={labelMutedStyle}>
                  Get reminders before this date
                </p>
              </div>
						</label>

            {isDeadline && (
              <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid var(--vscode-panel-border)' }}>
                <label className="flex items-center gap-3 cursor-pointer">
									<input
                  type="checkbox"
                  checked={isComplete}
                    onChange={e => setIsComplete(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: 'var(--vscode-button-background)' }}
                  />
                  <span className="text-sm" style={labelMutedStyle}>Mark as complete</span>
								</label>

                <div className="grid gap-2">
                  <label className="text-xs font-medium" style={labelMutedStyle}>
                    Reminder days before deadline
									</label>
									<input
                  type="text"
                  value={reminderDays}
                    onChange={e => setReminderDays(e.target.value)}
                  placeholder="7, 3, 1"
                    className="h-9 w-full rounded-lg px-3 text-sm transition-all outline-none"
                  style={inputStyle}
                  />
                </div>
								</div>
            )}
					</div>

					{/* Tags */}
          <div className="grid gap-2">
            <label className="text-sm font-medium" style={labelMutedStyle}>Tags</label>
						<input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="important, appeal, urgent"
              className="h-10 w-full rounded-lg px-3 text-sm transition-all outline-none"
              style={inputStyle}
            />
            <p className="text-xs" style={{ color: 'var(--vscode-disabledForeground)' }}>Separate tags with commas</p>
          </div>

          {/* Linked Documents */}
          <div
            className="rounded-lg p-4"
            style={buttonSecondaryStyle}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <i className="codicon codicon-file-symlink-file" style={{ color: 'var(--vscode-button-background)', fontSize: '14px' }} />
                <span className="text-sm font-medium" style={labelStyle}>
                  Linked Documents
                </span>
                {linkedDocuments.length > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-background)' }}
                  >
                    {linkedDocuments.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowDocumentPicker(true)}
                className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                style={buttonPrimaryStyle}
              >
                <i className="codicon codicon-add" style={{ fontSize: '12px' }} />
                {linkedDocuments.length === 0 ? 'Link Documents' : 'Manage'}
              </button>
            </div>

            {linkedDocuments.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto void-scrollbar">
                {linkedDocuments.slice(0, 5).map(uri => {
                  const fileName = getFileName(uri);
                  const { icon, colorVar } = getFileIcon(fileName);
                  return (
                    <div
                      key={uri}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ backgroundColor: 'var(--vscode-editor-background)' }}
                    >
                      <i className={`codicon codicon-${icon}`} style={{ color: colorVar, fontSize: '14px' }} />
                      <span className="text-sm truncate flex-1" style={labelMutedStyle}>
                        {fileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUnlinkDocument(uri)}
                        className="text-xs px-1.5 py-0.5 rounded transition-colors"
                        style={{ color: 'var(--vscode-errorForeground)' }}
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
                    style={labelMutedStyle}
                  >
                    +{linkedDocuments.length - 5} more documents
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--vscode-disabledForeground)' }}>
                Link related documents like medical records, decisions, or correspondence
              </p>
            )}
					</div>

          </div>

					{/* Actions - fixed footer */}
          <div
            className="flex justify-end gap-3 px-6 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid var(--vscode-panel-border)' }}
          >
						<button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={buttonSecondaryStyle}
            >
							Cancel
						</button>
						<button
              type="submit"
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={buttonPrimaryStyle}
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
