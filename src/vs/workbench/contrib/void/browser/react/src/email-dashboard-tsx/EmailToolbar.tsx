/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

export type EmailViewMode = 'list' | 'compact';
export type EmailSortField = 'date' | 'from' | 'subject';
export type EmailSortDirection = 'asc' | 'desc';

interface EmailToolbarProps {
	onImportEmail: () => void;
	searchQuery: string;
	onSearchChange: (query: string) => void;
	viewMode: EmailViewMode;
	onViewModeChange: (mode: EmailViewMode) => void;
	sortField: EmailSortField;
	onSortFieldChange: (field: EmailSortField) => void;
	sortDirection: EmailSortDirection;
	onSortDirectionChange: (direction: EmailSortDirection) => void;
	showFilters: boolean;
	onToggleFilters: () => void;
	emailCount: number;
}

export const EmailToolbar: React.FC<EmailToolbarProps> = ({
	onImportEmail,
	searchQuery,
	onSearchChange,
	viewMode,
	onViewModeChange,
	sortField,
	onSortFieldChange,
	sortDirection,
	onSortDirectionChange,
	showFilters,
	onToggleFilters,
	emailCount
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
			style={{
				backgroundColor: '#0f0f0f',
				borderBottom: `1px solid ${BRAND_GREEN}20`
			}}
		>
			{/* Import Button - Green accent */}
			<button
				onClick={onImportEmail}
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
				<span>Import</span>
			</button>

			{/* Divider */}
			<div className="w-px h-6" style={{ backgroundColor: '#27272a' }} />

			{/* Search Box */}
			<form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] max-w-md">
				<div className="relative">
					<i
						className="codicon codicon-search absolute left-3 top-1/2 -translate-y-1/2"
						style={{ color: '#71717a', fontSize: '14px' }}
					/>
					<input
						type="text"
						value={localSearch}
						onChange={(e) => setLocalSearch(e.target.value)}
						onKeyDown={handleSearchKeyDown}
						placeholder="Search emails..."
						className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all"
						style={{
							backgroundColor: '#1a1a1a',
							color: '#fafafa',
							border: '1px solid #27272a'
						}}
						onFocus={(e) => e.currentTarget.style.borderColor = BRAND_GREEN}
						onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'}
					/>
				</div>
			</form>

			{/* Divider */}
			<div className="w-px h-6" style={{ backgroundColor: '#27272a' }} />

			{/* View Mode Toggle */}
			<div
				className="flex items-center gap-1 p-1 rounded-lg"
				style={{ backgroundColor: '#1a1a1a', border: '1px solid #27272a' }}
			>
				<button
					onClick={() => onViewModeChange('list')}
					className="px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
					style={{
						backgroundColor: viewMode === 'list' ? BRAND_GREEN : 'transparent',
						color: viewMode === 'list' ? '#0a0a0a' : '#71717a'
					}}
					title="List View"
				>
					<i className="codicon codicon-list-flat" style={{ fontSize: '12px' }} />
				</button>
				<button
					onClick={() => onViewModeChange('compact')}
					className="px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
					style={{
						backgroundColor: viewMode === 'compact' ? BRAND_GREEN : 'transparent',
						color: viewMode === 'compact' ? '#0a0a0a' : '#71717a'
					}}
					title="Compact View"
				>
					<i className="codicon codicon-list-selection" style={{ fontSize: '12px' }} />
				</button>
			</div>

			{/* Sort Dropdown */}
			<div className="flex items-center gap-2">
				<label className="text-sm" style={{ color: '#71717a' }}>Sort:</label>
				<select
					value={sortField}
					onChange={(e) => onSortFieldChange(e.target.value as EmailSortField)}
					className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
					style={{
						backgroundColor: '#1a1a1a',
						color: '#fafafa',
						border: '1px solid #27272a'
					}}
				>
					<option value="date">Date</option>
					<option value="from">From</option>
					<option value="subject">Subject</option>
				</select>
				<button
					onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
					className="p-1.5 rounded-lg transition-colors"
					style={{
						backgroundColor: '#1a1a1a',
						border: '1px solid #27272a',
						color: '#a1a1aa'
					}}
					title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
				>
					<i
						className={`codicon codicon-arrow-${sortDirection === 'asc' ? 'up' : 'down'}`}
						style={{ fontSize: '12px' }}
					/>
				</button>
			</div>

			{/* Filters Toggle */}
			<button
				onClick={onToggleFilters}
				className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
				style={{
					backgroundColor: showFilters ? `${BRAND_GREEN}15` : '#1a1a1a',
					color: showFilters ? BRAND_GREEN : '#a1a1aa',
					border: `1px solid ${showFilters ? `${BRAND_GREEN}30` : '#27272a'}`
				}}
				onMouseEnter={(e) => {
					if (!showFilters) {
						e.currentTarget.style.backgroundColor = '#27272a';
						e.currentTarget.style.color = '#fafafa';
					}
				}}
				onMouseLeave={(e) => {
					if (!showFilters) {
						e.currentTarget.style.backgroundColor = '#1a1a1a';
						e.currentTarget.style.color = '#a1a1aa';
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
					backgroundColor: '#1a1a1a',
					color: '#71717a',
					border: '1px solid #27272a'
				}}
			>
				{emailCount} email{emailCount !== 1 ? 's' : ''}
			</span>
		</div>
	);
};

