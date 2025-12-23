/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import {
  EventCategory,
  EVENT_CATEGORY_LABELS,
  JurisdictionConfig } from
'../../../../common/timeline/timelineTypes.js';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

interface TimelineToolbarProps {
  onAddEvent: () => void;
  filterCategory: EventCategory | 'all';
  onFilterChange: (category: EventCategory | 'all') => void;
  showDeadlinesOnly: boolean;
  onShowDeadlinesChange: (show: boolean) => void;
  jurisdiction?: JurisdictionConfig;
  onJurisdictionClick: () => void;
  eventCount: number;
}

export const TimelineToolbar: React.FC<TimelineToolbarProps> = ({
  onAddEvent,
  filterCategory,
  onFilterChange,
  showDeadlinesOnly,
  onShowDeadlinesChange,
  jurisdiction,
  onJurisdictionClick,
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
    'custom'
  ];

  return (
    <div
      className="p-3 flex flex-wrap items-center gap-3"
      style={{
        backgroundColor: '#0f0f0f',
        borderBottom: `1px solid ${BRAND_GREEN}20`
      }}
    >
      {/* Add Event Button - Green accent */}
      <button
        onClick={onAddEvent}
        className="px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all"
        style={{
          backgroundColor: BRAND_GREEN,
          color: '#0a0a0a',
          boxShadow: `0 2px 8px ${BRAND_GREEN}30`
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = BRAND_GREEN}
      >
        <i className="codicon codicon-add" />
        <span>Add Event</span>
      </button>

      {/* Divider */}
      <div className="w-px h-6" style={{ backgroundColor: '#27272a' }} />

      {/* Category Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm" style={{ color: '#71717a' }}>
          Filter:
        </label>
        <select
          value={filterCategory}
          onChange={(e) => onFilterChange(e.target.value as EventCategory | 'all')}
          className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
          style={{
            backgroundColor: '#1a1a1a',
            color: '#fafafa',
            border: '1px solid #27272a'
          }}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : EVENT_CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      {/* Deadlines Only Toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          className="relative w-8 h-5 rounded-full transition-colors cursor-pointer"
          style={{ backgroundColor: showDeadlinesOnly ? BRAND_GREEN : '#27272a' }}
          onClick={() => onShowDeadlinesChange(!showDeadlinesOnly)}
        >
          <div
            className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
            style={{
              backgroundColor: '#fafafa',
              transform: showDeadlinesOnly ? 'translateX(14px)' : 'translateX(2px)'
            }}
          />
        </div>
        <span className="text-sm" style={{ color: '#a1a1aa' }}>
          Deadlines only
        </span>
      </label>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Jurisdiction Selector Button */}
      <button
        onClick={onJurisdictionClick}
        className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
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
        <i className="codicon codicon-law" style={{ fontSize: '12px' }} />
        <span>{jurisdiction?.name || 'Select Jurisdiction'}</span>
        <i className="codicon codicon-chevron-down" style={{ fontSize: '12px' }} />
      </button>

      {/* Event Count */}
      <span
        className="text-sm px-3 py-1 rounded-lg"
        style={{
          backgroundColor: '#1a1a1a',
          color: '#71717a',
          border: '1px solid #27272a'
        }}
      >
        {eventCount} event{eventCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
};
