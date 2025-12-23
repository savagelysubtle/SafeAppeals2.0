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
	isDeadlineUpcoming
} from '../../../../../../workbench/contrib/void/common/timeline/timelineTypes.js';

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
	const [showActions, setShowActions] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const categoryColor = EVENT_CATEGORY_COLORS[event.category];
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

	return (
		<div
			className="relative pl-12 group"
			onMouseEnter={() => setShowActions(true)}
			onMouseLeave={() => {
				setShowActions(false);
				setConfirmDelete(false);
			}}
		>
			{/* Timeline dot */}
			<div
				className="absolute left-4 w-5 h-5 rounded-full border-2 transform -translate-x-1/2"
				style={{
					backgroundColor: categoryColor,
					borderColor: 'var(--vscode-editor-background)',
					boxShadow: isOverdue
						? '0 0 0 3px rgba(239, 68, 68, 0.4)'
						: isUpcoming
							? '0 0 0 3px rgba(245, 158, 11, 0.4)'
							: 'none'
				}}
			/>

			{/* Event card */}
			<div
				className="rounded-lg p-4 transition-all"
				style={{
					backgroundColor: 'var(--vscode-editorWidget-background)',
					border: `1px solid ${isOverdue
						? 'var(--vscode-inputValidation-errorBorder)'
						: isUpcoming
							? 'var(--vscode-inputValidation-warningBorder)'
							: 'var(--vscode-editorWidget-border)'
						}`
				}}
			>
				{/* Header */}
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						{/* Category badge */}
						<div className="flex items-center gap-2 mb-1">
							<span
								className="text-xs px-2 py-0.5 rounded-full font-medium"
								style={{
									backgroundColor: `${categoryColor}20`,
									color: categoryColor
								}}
							>
								{categoryLabel}
							</span>
							{event.isDeadline && (
								<span
									className="text-xs px-2 py-0.5 rounded-full font-medium"
									style={{
										backgroundColor: isOverdue
											? 'rgba(239, 68, 68, 0.2)'
											: isUpcoming
												? 'rgba(245, 158, 11, 0.2)'
												: 'rgba(59, 130, 246, 0.2)',
										color: isOverdue
											? '#ef4444'
											: isUpcoming
												? '#f59e0b'
												: '#3b82f6'
									}}
								>
									{isOverdue ? '⚠️ Overdue' : isUpcoming ? '⏰ Due Soon' : '📅 Deadline'}
								</span>
							)}
							{event.isComplete && (
								<span
									className="text-xs px-2 py-0.5 rounded-full font-medium"
									style={{
										backgroundColor: 'rgba(16, 185, 129, 0.2)',
										color: '#10b981'
									}}
								>
									✓ Complete
								</span>
							)}
						</div>

						{/* Title */}
						<h3
							className="font-semibold text-base truncate"
							style={{ color: 'var(--vscode-foreground)' }}
						>
							{event.title}
						</h3>

						{/* Date */}
						<p
							className="text-sm"
							style={{ color: 'var(--vscode-descriptionForeground)' }}
						>
							{formatTimelineDate(event.date)}
							{event.endDate && ` - ${formatTimelineDate(event.endDate)}`}
						</p>
					</div>

					{/* Actions */}
					{showActions && (
						<div className="flex items-center gap-1">
							<button
								onClick={onEdit}
								className="p-1.5 rounded hover:bg-opacity-80 transition-colors"
								style={{
									backgroundColor: 'var(--vscode-button-secondaryBackground)',
									color: 'var(--vscode-button-secondaryForeground)'
								}}
								title="Edit event"
							>
								✏️
							</button>
							<button
								onClick={handleDelete}
								className="p-1.5 rounded hover:bg-opacity-80 transition-colors"
								style={{
									backgroundColor: confirmDelete
										? 'var(--vscode-inputValidation-errorBackground)'
										: 'var(--vscode-button-secondaryBackground)',
									color: confirmDelete
										? 'var(--vscode-inputValidation-errorForeground)'
										: 'var(--vscode-button-secondaryForeground)'
								}}
								title={confirmDelete ? 'Click again to confirm' : 'Delete event'}
							>
								{confirmDelete ? '❌' : '🗑️'}
							</button>
						</div>
					)}
				</div>

				{/* Description */}
				{event.description && (
					<p
						className="mt-2 text-sm"
						style={{ color: 'var(--vscode-foreground)', opacity: 0.9 }}
					>
						{event.description}
					</p>
				)}

				{/* Linked documents */}
				{event.linkedDocuments.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-1">
						{event.linkedDocuments.map((docUri, index) => {
							const fileName = docUri.split('/').pop() || docUri;
							return (
								<span
									key={index}
									className="text-xs px-2 py-1 rounded flex items-center gap-1"
									style={{
										backgroundColor: 'var(--vscode-badge-background)',
										color: 'var(--vscode-badge-foreground)'
									}}
								>
									📄 {fileName}
								</span>
							);
						})}
					</div>
				)}

				{/* Tags */}
				{event.tags && event.tags.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-1">
						{event.tags.map((tag, index) => (
							<span
								key={index}
								className="text-xs px-2 py-0.5 rounded"
								style={{
									backgroundColor: 'var(--vscode-textLink-activeForeground)',
									color: 'var(--vscode-editor-background)',
									opacity: 0.8
								}}
							>
								#{tag}
							</span>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

