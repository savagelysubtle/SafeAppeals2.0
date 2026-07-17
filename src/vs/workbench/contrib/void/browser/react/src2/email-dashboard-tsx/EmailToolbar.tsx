/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { EmailCategory, EmailPriority } from '../../../../common/emailService.js';

// ============================================================================
// REUSABLE STYLES - VSCode Theme Variables
// ============================================================================

const toolbarStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-sideBar-background)',
  borderBottom: '1px solid var(--vscode-panel-border)'
};

const buttonPrimaryStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer'
};

const buttonSecondaryStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '8px',
  cursor: 'pointer'
};

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: '8px'
};

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-dropdown-background)',
  color: 'var(--vscode-dropdown-foreground)',
  border: '1px solid var(--vscode-dropdown-border)',
  borderRadius: '8px',
  cursor: 'pointer'
};

const textSecondaryStyle: React.CSSProperties = {
  color: 'var(--vscode-descriptionForeground)'
};

export type EmailViewMode = 'list' | 'compact';
export type EmailSortField = 'date' | 'from' | 'subject';
export type EmailSortDirection = 'asc' | 'desc';
export type EmailDisplayMode = 'flat' | 'threads';

interface EmailToolbarProps {
  onImportEmail: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: EmailViewMode;
  onViewModeChange: (mode: EmailViewMode) => void;
  displayMode: EmailDisplayMode;
  onDisplayModeChange: (mode: EmailDisplayMode) => void;
  sortField: EmailSortField;
  onSortFieldChange: (field: EmailSortField) => void;
  sortDirection: EmailSortDirection;
  onSortDirectionChange: (direction: EmailSortDirection) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  emailCount: number;
  // Classification filters
  categoryFilter: EmailCategory | 'all';
  onCategoryFilterChange: (category: EmailCategory | 'all') => void;
  priorityFilter: EmailPriority | 'all';
  onPriorityFilterChange: (priority: EmailPriority | 'all') => void;
}

export const EmailToolbar: React.FC<EmailToolbarProps> = ({
  onImportEmail,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  displayMode,
  onDisplayModeChange,
  sortField,
  onSortFieldChange,
  sortDirection,
  onSortDirectionChange,
  showFilters,
  onToggleFilters,
  emailCount,
  categoryFilter,
  onCategoryFilterChange,
  priorityFilter,
  onPriorityFilterChange
}) => {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(localSearch);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearchChange(localSearch);
    }
  };

  return (
    <div
      className="void-p-3 void-flex void-flex-wrap void-items-center void-gap-3"
      style={toolbarStyle}>
      
			{/* Import Button - Primary action */}
			<button
        onClick={onImportEmail}
        className="void-px-4 void-py-2 void-font-semibold void-flex void-items-center void-gap-2 void-transition-all"
        style={buttonPrimaryStyle}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)'}>
        
				<i className="void-codicon void-codicon-add" />
				<span>Import</span>
			</button>

			{/* Divider */}
			<div className="void-w-px void-h-6" style={{ backgroundColor: 'var(--vscode-panel-border)' }} />

			{/* Search Box */}
			<form onSubmit={handleSearchSubmit} className="void-flex-1 void-min-w-[200px] void-max-w-md">
				<div className="void-relative">
					<i
            className="void-codicon void-codicon-search void-absolute void-left-3 void-top-1/2 -void-translate-y-1/2"
            style={{ ...textSecondaryStyle, fontSize: '14px' }} />
          
					<input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search emails..."
            className="void-w-full void-pl-9 void-pr-4 void-py-2 void-text-sm void-outline-none void-transition-all"
            style={inputStyle}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--vscode-focusBorder)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--vscode-input-border)'} />
          
				</div>
			</form>

			{/* Divider */}
			<div className="void-w-px void-h-6" style={{ backgroundColor: 'var(--vscode-panel-border)' }} />

			{/* Display Mode Toggle - Emails vs Threads */}
			<div className="void-flex void-items-center void-gap-2">
				<span className="void-text-xs" style={textSecondaryStyle}>Display:</span>
				<div
          className="void-flex void-items-center void-gap-1 void-p-1 void-rounded-lg"
          style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', border: '1px solid var(--vscode-panel-border)' }}>
          
					<button
            onClick={() => onDisplayModeChange('flat')}
            className="void-px-3 void-py-1 void-rounded-md void-text-xs void-font-medium void-transition-all void-flex void-items-center void-gap-1.5"
            style={{
              backgroundColor: displayMode === 'flat' ? 'var(--vscode-button-background)' : 'transparent',
              color: displayMode === 'flat' ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)'
            }}
            title="Emails - Show individual emails">
            
						<i className="void-codicon void-codicon-mail" style={{ fontSize: '12px' }} />
						<span>Emails</span>
					</button>
					<button
            onClick={() => onDisplayModeChange('threads')}
            className="void-px-3 void-py-1 void-rounded-md void-text-xs void-font-medium void-transition-all void-flex void-items-center void-gap-1.5"
            style={{
              backgroundColor: displayMode === 'threads' ? 'var(--vscode-button-background)' : 'transparent',
              color: displayMode === 'threads' ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)'
            }}
            title="Threads - Group emails by conversation">
            
						<i className="void-codicon void-codicon-list-tree" style={{ fontSize: '12px' }} />
						<span>Threads</span>
					</button>
				</div>
			</div>

			{/* View Mode Toggle - Only show in flat mode */}
			{displayMode === 'flat' &&
      <>
					<div className="void-flex void-items-center void-gap-2">
						<span className="void-text-xs" style={textSecondaryStyle}>View:</span>
						<div
            className="void-flex void-items-center void-gap-1 void-p-1 void-rounded-lg"
            style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', border: '1px solid var(--vscode-panel-border)' }}>
            
							<button
              onClick={() => onViewModeChange('list')}
              className="void-px-3 void-py-1 void-rounded-md void-text-xs void-font-medium void-transition-all void-flex void-items-center void-gap-1.5"
              style={{
                backgroundColor: viewMode === 'list' ? 'var(--vscode-button-background)' : 'transparent',
                color: viewMode === 'list' ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)'
              }}
              title="List View - Shows full email preview with details">
              
								<i className="void-codicon void-codicon-list-flat" style={{ fontSize: '12px' }} />
								<span>List</span>
							</button>
							<button
              onClick={() => onViewModeChange('compact')}
              className="void-px-3 void-py-1 void-rounded-md void-text-xs void-font-medium void-transition-all void-flex void-items-center void-gap-1.5"
              style={{
                backgroundColor: viewMode === 'compact' ? 'var(--vscode-button-background)' : 'transparent',
                color: viewMode === 'compact' ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)'
              }}
              title="Compact View - Shows more emails with less detail">
              
								<i className="void-codicon void-codicon-list-selection" style={{ fontSize: '12px' }} />
								<span>Compact</span>
							</button>
						</div>
					</div>
				</>
      }

			{/* Sort Dropdown */}
			<div className="void-flex void-items-center void-gap-2">
				<label className="void-text-sm" style={textSecondaryStyle}>Sort:</label>
				<select
          value={sortField}
          onChange={(e) => onSortFieldChange(e.target.value as EmailSortField)}
          className="void-px-3 void-py-1.5 void-text-sm void-outline-none"
          style={selectStyle}>
          
					<option value="date">Date</option>
					<option value="from">From</option>
					<option value="subject">Subject</option>
				</select>
				<button
          onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
          className="void-px-3 void-py-1.5 void-rounded-lg void-flex void-items-center void-gap-1.5 void-text-xs void-font-medium void-transition-colors"
          style={buttonSecondaryStyle}
          title={sortDirection === 'asc' ? 'Oldest first - Click to show newest first' : 'Newest first - Click to show oldest first'}>
          
					<i
            className={`void-codicon void-codicon-arrow-${sortDirection === 'asc' ? "void-up" : "void-down"}`} />
          
					<span>{sortDirection === 'asc' ? 'Oldest First' : 'Newest First'}</span>
				</button>
			</div>

			{/* Divider */}
			<div className="void-w-px void-h-6" style={{ backgroundColor: 'var(--vscode-panel-border)' }} />

			{/* Category Filter */}
			<div className="void-flex void-items-center void-gap-2">
				<select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value as EmailCategory | 'all')}
          className="void-px-3 void-py-1.5 void-text-sm void-outline-none"
          style={selectStyle}
          title="Filter by category">
          
					<option value="all">All Categories</option>
					<option value="deadline">⚠️ Deadlines</option>
					<option value="info-request">📋 Info Requests</option>
					<option value="decision">📜 Decisions</option>
					<option value="scheduling">📅 Scheduling</option>
					<option value="evidence">📁 Evidence</option>
					<option value="general">💬 General</option>
				</select>
			</div>

			{/* Priority Filter */}
			<div className="void-flex void-items-center void-gap-2">
				<select
          value={priorityFilter}
          onChange={(e) => onPriorityFilterChange(e.target.value as EmailPriority | 'all')}
          className="void-px-3 void-py-1.5 void-text-sm void-outline-none"
          style={selectStyle}
          title="Filter by priority">
          
					<option value="all">All Priorities</option>
					<option value="urgent">🔴 Urgent</option>
					<option value="normal">🟡 Normal</option>
					<option value="low">🟢 Low</option>
				</select>
			</div>

			{/* Clear Filters Button - only show when filters are active */}
			{(categoryFilter !== 'all' || priorityFilter !== 'all') &&
      <button
        onClick={() => {
          onCategoryFilterChange('all');
          onPriorityFilterChange('all');
        }}
        className="void-px-2 void-py-1 void-rounded-lg void-flex void-items-center void-gap-1 void-text-xs void-font-medium void-transition-all"
        style={{
          backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
          color: 'var(--vscode-charts-yellow)',
          border: '1px solid var(--vscode-inputValidation-warningBorder)',
          cursor: 'pointer'
        }}
        title="Clear all filters">
        
					<i className="void-codicon void-codicon-close" style={{ fontSize: '10px' }} />
					<span>Clear</span>
				</button>
      }

			{/* Filters Toggle */}
			<button
        onClick={onToggleFilters}
        className="void-text-xs void-px-3 void-py-1.5 void-rounded-lg void-flex void-items-center void-gap-2 void-transition-all void-cursor-pointer"
        style={{
          backgroundColor: showFilters ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-button-secondaryBackground)',
          color: showFilters ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-descriptionForeground)',
          border: showFilters ? '1px solid var(--vscode-focusBorder)' : '1px solid var(--vscode-panel-border)'
        }}
        onMouseEnter={(e) => {
          if (!showFilters) {
            e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
            e.currentTarget.style.color = 'var(--vscode-editor-foreground)';
          }
        }}
        onMouseLeave={(e) => {
          if (!showFilters) {
            e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
            e.currentTarget.style.color = 'var(--vscode-descriptionForeground)';
          }
        }}>
        
				<i className="void-codicon void-codicon-filter" style={{ fontSize: '12px' }} />
				<span>Filters</span>
			</button>

			{/* Spacer */}
			<div className="void-flex-1" />

			{/* Email Count */}
			<span
        className="void-text-sm void-px-3 void-py-1 void-rounded-lg"
        style={{
          backgroundColor: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-descriptionForeground)',
          border: '1px solid var(--vscode-panel-border)'
        }}>
        
				{emailCount} {displayMode === 'threads' ? 'thread' : 'email'}{emailCount !== 1 ? 's' : ''}
			</span>
		</div>);

};