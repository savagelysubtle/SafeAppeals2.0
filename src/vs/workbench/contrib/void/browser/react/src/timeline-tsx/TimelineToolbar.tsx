/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import {
	EventCategory,
	EVENT_CATEGORY_LABELS,
	JurisdictionConfig
} from '../../../../../../workbench/contrib/void/common/timeline/timelineTypes.js';

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
		'custom'
	];

	return (
		<div
			className="p-3 border-b flex flex-wrap items-center gap-3"
			style={{
				backgroundColor: 'var(--vscode-sideBar-background)',
				borderColor: 'var(--vscode-sideBar-border)'
			}}
		>
			{/* Add Event Button */}
			<button
				onClick={onAddEvent}
				className="px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition-colors hover:opacity-90"
				style={{
					backgroundColor: 'var(--vscode-button-background)',
					color: 'var(--vscode-button-foreground)'
				}}
			>
				<span>➕</span>
				<span>Add Event</span>
			</button>

			{/* Divider */}
			<div
				className="w-px h-6"
				style={{ backgroundColor: 'var(--vscode-sideBar-border)' }}
			/>

			{/* Category Filter */}
			<div className="flex items-center gap-2">
				<label
					className="text-sm"
					style={{ color: 'var(--vscode-descriptionForeground)' }}
				>
					Filter:
				</label>
				<select
					value={filterCategory}
					onChange={(e) => onFilterChange(e.target.value as EventCategory | 'all')}
					className="px-2 py-1 rounded text-sm"
					style={{
						backgroundColor: 'var(--vscode-dropdown-background)',
						color: 'var(--vscode-dropdown-foreground)',
						border: '1px solid var(--vscode-dropdown-border)'
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
			<label className="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					checked={showDeadlinesOnly}
					onChange={(e) => onShowDeadlinesChange(e.target.checked)}
					className="rounded"
				/>
				<span
					className="text-sm"
					style={{ color: 'var(--vscode-foreground)' }}
				>
					Deadlines only
				</span>
			</label>

			{/* Spacer */}
			<div className="flex-1" />

			{/* Jurisdiction Badge */}
			{jurisdiction && (
				<span
					className="text-xs px-2 py-1 rounded"
					style={{
						backgroundColor: 'var(--vscode-badge-background)',
						color: 'var(--vscode-badge-foreground)'
					}}
				>
					📍 {jurisdiction.name}
				</span>
			)}

			{/* Event Count */}
			<span
				className="text-sm"
				style={{ color: 'var(--vscode-descriptionForeground)' }}
			>
				{eventCount} event{eventCount !== 1 ? 's' : ''}
			</span>
		</div>
	);
};

