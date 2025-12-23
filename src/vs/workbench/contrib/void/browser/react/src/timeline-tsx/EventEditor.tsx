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
	JurisdictionConfig
} from '../../../../../../workbench/contrib/void/common/timeline/timelineTypes.js';

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
		event?.date
			? new Date(event.date).toISOString().split('T')[0]
			: new Date().toISOString().split('T')[0]
	);
	const [endDate, setEndDate] = useState(
		event?.endDate
			? new Date(event.endDate).toISOString().split('T')[0]
			: ''
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
			tags: tagsInput
				.split(',')
				.map(t => t.trim())
				.filter(t => t.length > 0),
			reminderDays: isDeadline
				? reminderDays
					.split(',')
					.map(d => parseInt(d.trim(), 10))
					.filter(d => !isNaN(d))
				: undefined
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
		'custom'
	];

	return (
		<div
			className="fixed inset-0 flex items-center justify-center z-50"
			style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
			onClick={onCancel}
		>
			<div
				className="w-full max-w-lg mx-4 rounded-lg shadow-xl overflow-hidden"
				style={{
					backgroundColor: 'var(--vscode-editorWidget-background)',
					border: '1px solid var(--vscode-editorWidget-border)'
				}}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div
					className="px-4 py-3 border-b flex items-center justify-between"
					style={{ borderColor: 'var(--vscode-editorWidget-border)' }}
				>
					<h2
						className="text-lg font-semibold"
						style={{ color: 'var(--vscode-foreground)' }}
					>
						{isEditing ? 'Edit Event' : 'Add Event'}
					</h2>
					<button
						onClick={onCancel}
						className="text-xl hover:opacity-70 transition-opacity"
						style={{ color: 'var(--vscode-foreground)' }}
					>
						×
					</button>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="p-4 space-y-4">
					{/* Title */}
					<div>
						<label
							className="block text-sm font-medium mb-1"
							style={{ color: 'var(--vscode-foreground)' }}
						>
							Title *
						</label>
						<input
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Event title..."
							required
							className="w-full px-3 py-2 rounded"
							style={{
								backgroundColor: 'var(--vscode-input-background)',
								color: 'var(--vscode-input-foreground)',
								border: '1px solid var(--vscode-input-border)'
							}}
						/>
					</div>

					{/* Date Row */}
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label
								className="block text-sm font-medium mb-1"
								style={{ color: 'var(--vscode-foreground)' }}
							>
								Date *
							</label>
							<input
								type="date"
								value={date}
								onChange={(e) => setDate(e.target.value)}
								required
								className="w-full px-3 py-2 rounded"
								style={{
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)'
								}}
							/>
						</div>
						<div>
							<label
								className="block text-sm font-medium mb-1"
								style={{ color: 'var(--vscode-foreground)' }}
							>
								End Date (optional)
							</label>
							<input
								type="date"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
								className="w-full px-3 py-2 rounded"
								style={{
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)'
								}}
							/>
						</div>
					</div>

					{/* Category */}
					<div>
						<label
							className="block text-sm font-medium mb-1"
							style={{ color: 'var(--vscode-foreground)' }}
						>
							Category
						</label>
						<div className="grid grid-cols-4 gap-2">
							{categories.map((cat) => (
								<button
									key={cat}
									type="button"
									onClick={() => setCategory(cat)}
									className="px-2 py-1.5 rounded text-xs font-medium transition-all"
									style={{
										backgroundColor: category === cat
											? EVENT_CATEGORY_COLORS[cat]
											: 'var(--vscode-button-secondaryBackground)',
										color: category === cat
											? '#ffffff'
											: 'var(--vscode-button-secondaryForeground)',
										border: category === cat
											? `2px solid ${EVENT_CATEGORY_COLORS[cat]}`
											: '2px solid transparent'
									}}
								>
									{EVENT_CATEGORY_LABELS[cat]}
								</button>
							))}
						</div>
					</div>

					{/* Description */}
					<div>
						<label
							className="block text-sm font-medium mb-1"
							style={{ color: 'var(--vscode-foreground)' }}
						>
							Description
						</label>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Optional description..."
							rows={3}
							className="w-full px-3 py-2 rounded resize-none"
							style={{
								backgroundColor: 'var(--vscode-input-background)',
								color: 'var(--vscode-input-foreground)',
								border: '1px solid var(--vscode-input-border)'
							}}
						/>
					</div>

					{/* Deadline Options */}
					<div className="space-y-3">
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								checked={isDeadline}
								onChange={(e) => setIsDeadline(e.target.checked)}
								className="rounded"
							/>
							<span style={{ color: 'var(--vscode-foreground)' }}>
								This is a deadline
							</span>
						</label>

						{isDeadline && (
							<>
								<label className="flex items-center gap-2 cursor-pointer ml-6">
									<input
										type="checkbox"
										checked={isComplete}
										onChange={(e) => setIsComplete(e.target.checked)}
										className="rounded"
									/>
									<span style={{ color: 'var(--vscode-foreground)' }}>
										Mark as complete
									</span>
								</label>

								<div className="ml-6">
									<label
										className="block text-sm font-medium mb-1"
										style={{ color: 'var(--vscode-descriptionForeground)' }}
									>
										Reminder days (comma-separated)
									</label>
									<input
										type="text"
										value={reminderDays}
										onChange={(e) => setReminderDays(e.target.value)}
										placeholder="7, 3, 1"
										className="w-full px-3 py-2 rounded text-sm"
										style={{
											backgroundColor: 'var(--vscode-input-background)',
											color: 'var(--vscode-input-foreground)',
											border: '1px solid var(--vscode-input-border)'
										}}
									/>
								</div>
							</>
						)}
					</div>

					{/* Tags */}
					<div>
						<label
							className="block text-sm font-medium mb-1"
							style={{ color: 'var(--vscode-foreground)' }}
						>
							Tags (comma-separated)
						</label>
						<input
							type="text"
							value={tagsInput}
							onChange={(e) => setTagsInput(e.target.value)}
							placeholder="important, appeal, urgent"
							className="w-full px-3 py-2 rounded"
							style={{
								backgroundColor: 'var(--vscode-input-background)',
								color: 'var(--vscode-input-foreground)',
								border: '1px solid var(--vscode-input-border)'
							}}
						/>
					</div>

					{/* Actions */}
					<div className="flex justify-end gap-3 pt-2">
						<button
							type="button"
							onClick={onCancel}
							className="px-4 py-2 rounded font-medium transition-colors"
							style={{
								backgroundColor: 'var(--vscode-button-secondaryBackground)',
								color: 'var(--vscode-button-secondaryForeground)'
							}}
						>
							Cancel
						</button>
						<button
							type="submit"
							className="px-4 py-2 rounded font-medium transition-colors"
							style={{
								backgroundColor: 'var(--vscode-button-background)',
								color: 'var(--vscode-button-foreground)'
							}}
						>
							{isEditing ? 'Save Changes' : 'Add Event'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

