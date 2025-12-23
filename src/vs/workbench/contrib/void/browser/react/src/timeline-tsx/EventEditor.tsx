/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect } from 'react';
import {
  TimelineEvent,
  EventCategory,
  EVENT_CATEGORY_LABELS,
  EVENT_CATEGORY_COLORS,
  JurisdictionConfig } from
'../../../../../../workbench/contrib/void/common/timeline/timelineTypes.js';

interface EventEditorProps {
  event: TimelineEvent | null;
  jurisdictions: JurisdictionConfig[];
  currentJurisdiction: string;
  onSave: (eventData: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export const EventEditor: React.FC<EventEditorProps> = ({
  event,
  jurisdictions,
  currentJurisdiction,
  onSave,
  onCancel
}) => {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [date, setDate] = useState(
    event?.date ?
    new Date(event.date).toISOString().split('T')[0] :
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    event?.endDate ?
    new Date(event.endDate).toISOString().split('T')[0] :
    ''
  );
  const [category, setCategory] = useState<EventCategory>(event?.category || 'custom');
  const [isDeadline, setIsDeadline] = useState(event?.isDeadline || false);
  const [isComplete, setIsComplete] = useState(event?.isComplete || false);
  const [tagsInput, setTagsInput] = useState(event?.tags?.join(', ') || '');
  const [reminderDays, setReminderDays] = useState(
    event?.reminderDays?.join(', ') || '7, 3, 1'
  );

  const isEditing = !!event;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !date) {
      return;
    }

    const eventData: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'> = {
      title: title.trim(),
      description: description.trim() || undefined,
      date: new Date(date).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      category,
      isDeadline,
      isComplete: isDeadline ? isComplete : undefined,
      linkedDocuments: event?.linkedDocuments || [],
      tags: tagsInput.
      split(',').
      map((t) => t.trim()).
      filter((t) => t.length > 0),
      reminderDays: isDeadline ?
      reminderDays.
      split(',').
      map((d) => parseInt(d.trim(), 10)).
      filter((d) => !isNaN(d)) :
      undefined
    };

    onSave(eventData);
  };

  const categories: EventCategory[] = [
  'injury',
  'medical',
  'hearing',
  'decision',
  'deadline',
  'filing',
  'correspondence',
  'custom'];


  return (
    <div
      className="void-fixed void-inset-0 void-flex void-items-center void-justify-center void-z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onCancel}>
      
			<div
        className="void-w-full void-max-w-lg void-mx-4 void-rounded-lg void-shadow-xl void-overflow-hidden"
        style={{
          backgroundColor: 'var(--vscode-editorWidget-background)',
          border: '1px solid var(--vscode-editorWidget-border)'
        }}
        onClick={(e) => e.stopPropagation()}>
        
				{/* Header */}
				<div
          className="void-px-4 void-py-3 void-border-b void-flex void-items-center void-justify-between"
          style={{ borderColor: 'var(--vscode-editorWidget-border)' }}>
          
					<h2
            className="void-text-lg void-font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}>
            
						{isEditing ? 'Edit Event' : 'Add Event'}
					</h2>
					<button
            onClick={onCancel}
            className="void-text-xl hover:void-opacity-70 void-transition-opacity"
            style={{ color: 'var(--vscode-foreground)' }}>
            
						×
					</button>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="void-p-4 void-space-y-4">
					{/* Title */}
					<div>
						<label
              className="void-block void-text-sm void-font-medium void-mb-1"
              style={{ color: 'var(--vscode-foreground)' }}>
              
							Title *
						</label>
						<input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title..."
              required
              className="void-w-full void-px-3 void-py-2 void-rounded"
              style={{
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)'
              }} />
            
					</div>

					{/* Date Row */}
					<div className="void-grid void-grid-cols-2 void-gap-4">
						<div>
							<label
                className="void-block void-text-sm void-font-medium void-mb-1"
                style={{ color: 'var(--vscode-foreground)' }}>
                
								Date *
							</label>
							<input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="void-w-full void-px-3 void-py-2 void-rounded"
                style={{
                  backgroundColor: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)'
                }} />
              
						</div>
						<div>
							<label
                className="void-block void-text-sm void-font-medium void-mb-1"
                style={{ color: 'var(--vscode-foreground)' }}>
                
								End Date (optional)
							</label>
							<input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="void-w-full void-px-3 void-py-2 void-rounded"
                style={{
                  backgroundColor: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)'
                }} />
              
						</div>
					</div>

					{/* Category */}
					<div>
						<label
              className="void-block void-text-sm void-font-medium void-mb-1"
              style={{ color: 'var(--vscode-foreground)' }}>
              
							Category
						</label>
						<div className="void-grid void-grid-cols-4 void-gap-2">
							{categories.map((cat) =>
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className="void-px-2 void-py-1.5 void-rounded void-text-xs void-font-medium void-transition-all"
                style={{
                  backgroundColor: category === cat ?
                  EVENT_CATEGORY_COLORS[cat] :
                  'var(--vscode-button-secondaryBackground)',
                  color: category === cat ?
                  '#ffffff' :
                  'var(--vscode-button-secondaryForeground)',
                  border: category === cat ?
                  `2px solid ${EVENT_CATEGORY_COLORS[cat]}` :
                  '2px solid transparent'
                }}>
                
									{EVENT_CATEGORY_LABELS[cat]}
								</button>
              )}
						</div>
					</div>

					{/* Description */}
					<div>
						<label
              className="void-block void-text-sm void-font-medium void-mb-1"
              style={{ color: 'var(--vscode-foreground)' }}>
              
							Description
						</label>
						<textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="void-w-full void-px-3 void-py-2 void-rounded void-resize-none"
              style={{
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)'
              }} />
            
					</div>

					{/* Deadline Options */}
					<div className="void-space-y-3">
						<label className="void-flex void-items-center void-gap-2 void-cursor-pointer">
							<input
                type="checkbox"
                checked={isDeadline}
                onChange={(e) => setIsDeadline(e.target.checked)}
                className="void-rounded" />
              
							<span style={{ color: 'var(--vscode-foreground)' }}>
								This is a deadline
							</span>
						</label>

						{isDeadline &&
            <>
								<label className="void-flex void-items-center void-gap-2 void-cursor-pointer void-ml-6">
									<input
                  type="checkbox"
                  checked={isComplete}
                  onChange={(e) => setIsComplete(e.target.checked)}
                  className="void-rounded" />
                
									<span style={{ color: 'var(--vscode-foreground)' }}>
										Mark as complete
									</span>
								</label>

								<div className="void-ml-6">
									<label
                  className="void-block void-text-sm void-font-medium void-mb-1"
                  style={{ color: 'var(--vscode-descriptionForeground)' }}>
                  
										Reminder days (comma-separated)
									</label>
									<input
                  type="text"
                  value={reminderDays}
                  onChange={(e) => setReminderDays(e.target.value)}
                  placeholder="7, 3, 1"
                  className="void-w-full void-px-3 void-py-2 void-rounded void-text-sm"
                  style={{
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)'
                  }} />
                
								</div>
							</>
            }
					</div>

					{/* Tags */}
					<div>
						<label
              className="void-block void-text-sm void-font-medium void-mb-1"
              style={{ color: 'var(--vscode-foreground)' }}>
              
							Tags (comma-separated)
						</label>
						<input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="important, appeal, urgent"
              className="void-w-full void-px-3 void-py-2 void-rounded"
              style={{
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)'
              }} />
            
					</div>

					{/* Actions */}
					<div className="void-flex void-justify-end void-gap-3 void-pt-2">
						<button
              type="button"
              onClick={onCancel}
              className="void-px-4 void-py-2 void-rounded void-font-medium void-transition-colors"
              style={{
                backgroundColor: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)'
              }}>
              
							Cancel
						</button>
						<button
              type="submit"
              className="void-px-4 void-py-2 void-rounded void-font-medium void-transition-colors"
              style={{
                backgroundColor: 'var(--vscode-button-background)',
                color: 'var(--vscode-button-foreground)'
              }}>
              
							{isEditing ? 'Save Changes' : 'Add Event'}
						</button>
					</div>
				</form>
			</div>
		</div>);

};