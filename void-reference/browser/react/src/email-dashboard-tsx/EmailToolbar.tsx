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
	borderBottom: '1px solid var(--vscode-panel-border)',
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
	cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
	backgroundColor: 'var(--vscode-input-background)',
	color: 'var(--vscode-input-foreground)',
	border: '1px solid var(--vscode-input-border)',
	borderRadius: '8px',
};

const selectStyle: React.CSSProperties = {
	backgroundColor: 'var(--vscode-dropdown-background)',
	color: 'var(--vscode-dropdown-foreground)',
	border: '1px solid var(--vscode-dropdown-border)',
	borderRadius: '8px',
	cursor: 'pointer',
};

const textSecondaryStyle: React.CSSProperties = {
	color: 'var(--vscode-descriptionForeground)',
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
	onPriorityFilterChange,
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
			className="p-3 flex flex-wrap items-center gap-3"
			style={toolbarStyle}
		>
			{/* Import Button - Primary action */}
			<button
				onClick={onImportEmail}
				className="px-4 py-2 font-semibold flex items-center gap-2 transition-all"
				style={buttonPrimaryStyle}
				onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground)'}
				onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)'}
			>
				<i className="codicon codicon-add" />
				<span>Import</span>
			</button>

			{/* Divider */}
			<div className="w-px h-6" style={{ backgroundColor: 'var(--vscode-panel-border)' }} />

			{/* Search Box */}
			<form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] max-w-md">
				<div className="relative">
					<i
						className="codicon codicon-search absolute left-3 top-1/2 -translate-y-1/2"
						style={{ ...textSecondaryStyle, fontSize: '14px' }}
					/>
					<input
						type="text"
						value={localSearch}
						onChange={(e) => setLocalSearch(e.target.value)}
						onKeyDown={handleSearchKeyDown}
						placeholder="Search emails..."
						className="w-full pl-9 pr-4 py-2 text-sm outline-none transition-all"
						style={inputStyle}
						onFocus={(e) => e.currentTarget.style.borderColor = 'var(--vscode-focusBorder)'}
						onBlur={(e) => e.currentTarget.style.borderColor = 'var(--vscode-input-border)'}
					/>
				</div>
			</form>

			{/* Divider */}
			<div className="w-px h-6" style={{ backgroundColor: 'var(--vscode-panel-border)' }} />

			{/* Display Mode Toggle - Emails vs Threads */}
			<div className="flex items-center gap-2">
				<span className="text-xs" style={textSecondaryStyle}>Display:</span>
				<div
					className="flex items-center gap-1 p-1 rounded-lg"
					style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', border: '1px solid var(--vscode-panel-border)' }}
				>
					<button
						onClick={() => onDisplayModeChange('flat')}
						className="px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
						style={{
							backgroundColor: displayMode === 'flat' ? 'var(--vscode-button-background)' : 'transparent',
							color: displayMode === 'flat' ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)'
						}}
						title="Emails - Show individual emails"
					>
						<i className="codicon codicon-mail" style={{ fontSize: '12px' }} />
						<span>Emails</span>
					</button>
					<button
						onClick={() => onDisplayModeChange('threads')}
						className="px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
						style={{
							backgroundColor: displayMode === 'threads' ? 'var(--vscode-button-background)' : 'transparent',
							color: displayMode === 'threads' ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)'
						}}
						title="Threads - Group emails by conversation"
					>
						<i className="codicon codicon-list-tree" style={{ fontSize: '12px' }} />
						<span>Threads</span>
					</button>
				</div>
			</div>

			{/* View Mode Toggle - Only show in flat mode */}
			{displayMode === 'flat' && (
				<>
					<div className="flex items-center gap-2">
						<span className="text-xs" style={textSecondaryStyle}>View:</span>
						<div
							className="flex items-center gap-1 p-1 rounded-lg"
							style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', border: '1px solid var(--vscode-panel-border)' }}
						>
							<button
								onClick={() => onViewModeChange('list')}
								className="px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
								style={{
									backgroundColor: viewMode === 'list' ? 'var(--vscode-button-background)' : 'transparent',
									color: viewMode === 'list' ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)'
								}}
								title="List View - Shows full email preview with details"
							>
								<i className="codicon codicon-list-flat" style={{ fontSize: '12px' }} />
								<span>List</span>
							</button>
							<button
								onClick={() => onViewModeChange('compact')}
								className="px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
								style={{
									backgroundColor: viewMode === 'compact' ? 'var(--vscode-button-background)' : 'transparent',
									color: viewMode === 'compact' ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)'
								}}
								title="Compact View - Shows more emails with less detail"
							>
								<i className="codicon codicon-list-selection" style={{ fontSize: '12px' }} />
								<span>Compact</span>
							</button>
						</div>
					</div>
				</>
			)}

			{/* Sort Dropdown */}
			<div className="flex items-center gap-2">
				<label className="text-sm" style={textSecondaryStyle}>Sort:</label>
				<select
					value={sortField}
					onChange={(e) => onSortFieldChange(e.target.value as EmailSortField)}
					className="px-3 py-1.5 text-sm outline-none"
					style={selectStyle}
				>
					<option value="date">Date</option>
					<option value="from">From</option>
					<option value="subject">Subject</option>
				</select>
				<button
					onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
					className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors"
					style={buttonSecondaryStyle}
					title={sortDirection === 'asc' ? 'Oldest first - Click to show newest first' : 'Newest first - Click to show oldest first'}
				>
					<i
						className={`codicon codicon-arrow-${sortDirection === 'asc' ? 'up' : 'down'}`}
					/>
					<span>{sortDirection === 'asc' ? 'Oldest First' : 'Newest First'}</span>
				</button>
			</div>

			{/* Divider */}
			<div className="w-px h-6" style={{ backgroundColor: 'var(--vscode-panel-border)' }} />

			{/* Category Filter */}
			<div className="flex items-center gap-2">
				<select
					value={categoryFilter}
					onChange={(e) => onCategoryFilterChange(e.target.value as EmailCategory | 'all')}
					className="px-3 py-1.5 text-sm outline-none"
					style={selectStyle}
					title="Filter by category"
				>
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
			<div className="flex items-center gap-2">
				<select
					value={priorityFilter}
					onChange={(e) => onPriorityFilterChange(e.target.value as EmailPriority | 'all')}
					className="px-3 py-1.5 text-sm outline-none"
					style={selectStyle}
					title="Filter by priority"
				>
					<option value="all">All Priorities</option>
					<option value="urgent">🔴 Urgent</option>
					<option value="normal">🟡 Normal</option>
					<option value="low">🟢 Low</option>
				</select>
			</div>

			{/* Clear Filters Button - only show when filters are active */}
			{(categoryFilter !== 'all' || priorityFilter !== 'all') && (
				<button
					onClick={() => {
						onCategoryFilterChange('all');
						onPriorityFilterChange('all');
					}}
					className="px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-medium transition-all"
					style={{
						backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
						color: 'var(--vscode-charts-yellow)',
						border: '1px solid var(--vscode-inputValidation-warningBorder)',
						cursor: 'pointer',
					}}
					title="Clear all filters"
				>
					<i className="codicon codicon-close" style={{ fontSize: '10px' }} />
					<span>Clear</span>
				</button>
			)}

			{/* Filters Toggle */}
			<button
				onClick={onToggleFilters}
				className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
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
				}}
			>
				<i className="codicon codicon-filter" style={{ fontSize: '12px' }} />
				<span>Filters</span>
			</button>

			{/* Spacer */}
			<div className="flex-1" />

			{/* Email Count */}
			<span
				className="text-sm px-3 py-1 rounded-lg"
				style={{
					backgroundColor: 'var(--vscode-button-secondaryBackground)',
					color: 'var(--vscode-descriptionForeground)',
					border: '1px solid var(--vscode-panel-border)'
				}}
			>
				{emailCount} {displayMode === 'threads' ? 'thread' : 'email'}{emailCount !== 1 ? 's' : ''}
			</span>
		</div>
	);
};

