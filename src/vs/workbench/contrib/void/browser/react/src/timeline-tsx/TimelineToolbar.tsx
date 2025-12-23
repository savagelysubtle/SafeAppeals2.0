/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import {
  EventCategory,
  EVENT_CATEGORY_LABELS,
  JurisdictionConfig } from
'../../../../../../workbench/contrib/void/common/timeline/timelineTypes.js';

interface TimelineToolbarProps {
  onAddEvent: () => void;
  filterCategory: EventCategory | 'all';
  onFilterChange: (category: EventCategory | 'all') => void;
  showDeadlinesOnly: boolean;
  onShowDeadlinesChange: (show: boolean) => void;
  jurisdiction?: JurisdictionConfig;
  eventCount: number;
}

export const TimelineToolbar: React.FC<TimelineToolbarProps> = ({
  onAddEvent,
  filterCategory,
  onFilterChange,
  showDeadlinesOnly,
  onShowDeadlinesChange,
  jurisdiction,
  eventCount
}) => {
  const categories: (EventCategory | 'all')[] = [
  'all',
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
      className="void-p-3 void-border-b void-flex void-flex-wrap void-items-center void-gap-3"
      style={{
        backgroundColor: 'var(--vscode-sideBar-background)',
        borderColor: 'var(--vscode-sideBar-border)'
      }}>
      
			{/* Add Event Button */}
			<button
        onClick={onAddEvent}
        className="void-px-3 void-py-1.5 void-rounded void-font-medium void-flex void-items-center void-gap-1.5 void-transition-colors hover:void-opacity-90"
        style={{
          backgroundColor: 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)'
        }}>
        
				<span>➕</span>
				<span>Add Event</span>
			</button>

			{/* Divider */}
			<div
        className="void-w-px void-h-6"
        style={{ backgroundColor: 'var(--vscode-sideBar-border)' }} />
      

			{/* Category Filter */}
			<div className="void-flex void-items-center void-gap-2">
				<label
          className="void-text-sm"
          style={{ color: 'var(--vscode-descriptionForeground)' }}>
          
					Filter:
				</label>
				<select
          value={filterCategory}
          onChange={(e) => onFilterChange(e.target.value as EventCategory | 'all')}
          className="void-px-2 void-py-1 void-rounded void-text-sm"
          style={{
            backgroundColor: 'var(--vscode-dropdown-background)',
            color: 'var(--vscode-dropdown-foreground)',
            border: '1px solid var(--vscode-dropdown-border)'
          }}>
          
					{categories.map((cat) =>
          <option key={cat} value={cat}>
							{cat === 'all' ? 'All Categories' : EVENT_CATEGORY_LABELS[cat]}
						</option>
          )}
				</select>
			</div>

			{/* Deadlines Only Toggle */}
			<label className="void-flex void-items-center void-gap-2 void-cursor-pointer">
				<input
          type="checkbox"
          checked={showDeadlinesOnly}
          onChange={(e) => onShowDeadlinesChange(e.target.checked)}
          className="void-rounded" />
        
				<span
          className="void-text-sm"
          style={{ color: 'var(--vscode-foreground)' }}>
          
					Deadlines only
				</span>
			</label>

			{/* Spacer */}
			<div className="void-flex-1" />

			{/* Jurisdiction Badge */}
			{jurisdiction &&
      <span
        className="void-text-xs void-px-2 void-py-1 void-rounded"
        style={{
          backgroundColor: 'var(--vscode-badge-background)',
          color: 'var(--vscode-badge-foreground)'
        }}>
        
					📍 {jurisdiction.name}
				</span>
      }

			{/* Event Count */}
			<span
        className="void-text-sm"
        style={{ color: 'var(--vscode-descriptionForeground)' }}>
        
				{eventCount} event{eventCount !== 1 ? 's' : ''}
			</span>
		</div>);

};