/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from "react";
import {
	EVENT_CATEGORY_COLORS,
	EVENT_CATEGORY_LABELS,
	formatTimelineDate,
	isDeadlineOverdue,
	isDeadlineUpcoming,
	TimelineEvent,
} from "../../../../common/timeline/timelineTypes.js";
import { useAccessor } from "../util/services.js";

// Reusable style objects with VSCode CSS variables
const cardStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-input-background)",
	border: "1px solid var(--vscode-panel-border)",
	borderRadius: "12px",
};

const buttonSecondaryStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-button-secondaryBackground)",
	color: "var(--vscode-button-secondaryForeground)",
	border: "1px solid var(--vscode-panel-border)",
	borderRadius: "8px",
};

const textPrimaryStyle: React.CSSProperties = {
	color: "var(--vscode-editor-foreground)",
};

const textMutedStyle: React.CSSProperties = {
	color: "var(--vscode-descriptionForeground)",
};

// File icons based on extension - using VSCode semantic colors
const FILE_ICONS: Record<string, { icon: string; colorVar: string }> = {
	pdf: { icon: "file-pdf", colorVar: "var(--vscode-charts-red)" },
	doc: { icon: "file-text", colorVar: "var(--vscode-charts-blue)" },
	docx: { icon: "file-text", colorVar: "var(--vscode-charts-blue)" },
	txt: { icon: "file-text", colorVar: "var(--vscode-descriptionForeground)" },
	md: { icon: "markdown", colorVar: "var(--vscode-descriptionForeground)" },
	jpg: { icon: "file-media", colorVar: "var(--vscode-charts-orange)" },
	jpeg: { icon: "file-media", colorVar: "var(--vscode-charts-orange)" },
	png: { icon: "file-media", colorVar: "var(--vscode-charts-orange)" },
	default: { icon: "file", colorVar: "var(--vscode-descriptionForeground)" },
};

function getFileIcon(filename: string): { icon: string; colorVar: string } {
	const ext = filename.split(".").pop()?.toLowerCase() || "";
	return FILE_ICONS[ext] || FILE_ICONS.default;
}

function getFileName(uri: string): string {
	const parts = uri.split("/");
	return parts[parts.length - 1] || uri;
}

interface TimelineEventCardProps {
	event: TimelineEvent;
	onEdit: () => void;
	onDelete: () => void;
	onToggleSyncToCalendar?: () => void;
	isFirst: boolean;
	isLast: boolean;
}

export const TimelineEventCard: React.FC<TimelineEventCardProps> = ({
	event,
	onEdit,
	onDelete,
	onToggleSyncToCalendar,
	isFirst,
	isLast,
}) => {
	// Determine if event is synced to calendar (uses isDeadline as default)
	const isSyncedToCalendar = event.syncToCalendar ?? event.isDeadline;
	const accessor = useAccessor();
	const [confirmDelete, setConfirmDelete] = useState(false);

	const categoryColor = EVENT_CATEGORY_COLORS[event.category];

	const handleOpenDocument = async (uriString: string) => {
		try {
			const editorService = accessor.get("IEditorService");
			const URI = accessor.get("URI");
			const uri = URI.parse(uriString);
			await editorService.openEditor({ resource: uri });
		} catch (error) {
			console.error("[TimelineEventCard] Failed to open document:", error);
		}
	};
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

	// Determine border color based on status
	const getBorderColor = () => {
		if (isOverdue) return "var(--vscode-errorForeground)";
		if (isUpcoming) return "var(--vscode-editorWarning-foreground)";
		if (isFirst) return "var(--vscode-button-background)";
		return "var(--vscode-panel-border)";
	};

	return (
		<div className="relative pl-12 group mb-4">
			{/* Drag Handle - shown on group hover via CSS (no React state to avoid re-renders) */}
			<div
				className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-8 rounded cursor-grab active:cursor-grabbing flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-60 transition-opacity"
				style={{ backgroundColor: "var(--vscode-panel-border)" }}
				title="Drag to reorder (coming soon)"
			>
				<div
					className="w-1 h-1 rounded-full"
					style={{ backgroundColor: "var(--vscode-descriptionForeground)" }}
				/>
				<div
					className="w-1 h-1 rounded-full"
					style={{ backgroundColor: "var(--vscode-descriptionForeground)" }}
				/>
				<div
					className="w-1 h-1 rounded-full"
					style={{ backgroundColor: "var(--vscode-descriptionForeground)" }}
				/>
			</div>

			{/* Timeline Dot - accent for first event */}
			<div
				className="absolute left-4 w-4 h-4 rounded-full border-2 transform -translate-x-1/2 z-10 mt-5"
				style={{
					backgroundColor: isFirst
						? "var(--vscode-button-background)"
						: categoryColor,
					borderColor: "var(--vscode-editor-background)",
					boxShadow: isOverdue
						? "0 0 0 3px var(--vscode-inputValidation-errorBackground)"
						: isUpcoming
							? "0 0 0 3px var(--vscode-inputValidation-warningBackground)"
							: isFirst
								? "0 0 0 3px var(--vscode-button-secondaryBackground)"
								: "none",
				}}
			/>

			{/* Card */}
			<div
				className="rounded-xl transition-all duration-200"
				style={{
					backgroundColor: "var(--vscode-input-background)",
					border: `1px solid ${getBorderColor()}`,
				}}
			>
				{/* Card Header */}
				<div className="p-4">
					<div className="flex items-start justify-between">
						<div className="flex-1 space-y-2">
							{/* Top row: Category badge + Status badges */}
							<div className="flex items-center gap-2 flex-wrap">
								{/* Category Badge */}
								<span
									className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
									style={{
										backgroundColor: `${categoryColor}20`,
										color: categoryColor,
										border: `1px solid ${categoryColor}30`,
									}}
								>
									{categoryLabel}
								</span>

								{/* First Event Badge */}
								{isFirst && (
									<span
										className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
										style={{
											backgroundColor:
												"var(--vscode-button-secondaryBackground)",
											color: "var(--vscode-button-background)",
											border: "1px solid var(--vscode-panel-border)",
										}}
									>
										<i
											className="codicon codicon-star-full mr-1"
											style={{ fontSize: "10px" }}
										/>
										First Event
									</span>
								)}

								{/* Status Badges */}
								{event.isDeadline && (
									<span
										className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
										style={{
											backgroundColor: isOverdue
												? "var(--vscode-inputValidation-errorBackground)"
												: isUpcoming
													? "var(--vscode-inputValidation-warningBackground)"
													: "var(--vscode-inputValidation-infoBackground)",
											color: isOverdue
												? "var(--vscode-errorForeground)"
												: isUpcoming
													? "var(--vscode-editorWarning-foreground)"
													: "var(--vscode-editorInfo-foreground)",
											border: `1px solid ${
												isOverdue
													? "var(--vscode-inputValidation-errorBorder)"
													: isUpcoming
														? "var(--vscode-inputValidation-warningBorder)"
														: "var(--vscode-inputValidation-infoBorder)"
											}`,
										}}
									>
										<i
											className={`codicon ${isOverdue ? "codicon-warning" : "codicon-clock"} mr-1`}
											style={{ fontSize: "10px" }}
										/>
										{isOverdue
											? "Overdue"
											: isUpcoming
												? "Due Soon"
												: "Deadline"}
									</span>
								)}

								{event.isComplete && (
									<span
										className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
										style={{
											backgroundColor:
												"var(--vscode-button-secondaryBackground)",
											color: "var(--vscode-button-background)",
											border: "1px solid var(--vscode-panel-border)",
										}}
									>
										<i
											className="codicon codicon-check mr-1"
											style={{ fontSize: "10px" }}
										/>
										Complete
									</span>
								)}
							</div>

							{/* Title */}
							<h3 className="font-semibold text-base" style={textPrimaryStyle}>
								{event.title}
							</h3>

							{/* Date */}
							<p className="text-sm" style={textMutedStyle}>
								<i
									className="codicon codicon-calendar mr-1.5"
									style={{ fontSize: "12px" }}
								/>
								{formatTimelineDate(event.date)}
								{event.endDate && ` → ${formatTimelineDate(event.endDate)}`}
							</p>
						</div>

						{/* Action Buttons - Always visible, not just on hover */}
						<div className="flex items-center gap-1 ml-3">
							{/* Calendar Sync Toggle Button */}
							{onToggleSyncToCalendar && (
								<button
									onClick={onToggleSyncToCalendar}
									className="h-8 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all"
									style={{
										backgroundColor: isSyncedToCalendar
											? "var(--vscode-button-background)"
											: "var(--vscode-button-secondaryBackground)",
										color: isSyncedToCalendar
											? "var(--vscode-button-foreground)"
											: "var(--vscode-button-secondaryForeground)",
										border: isSyncedToCalendar
											? "1px solid var(--vscode-button-background)"
											: "1px solid var(--vscode-panel-border)",
										borderRadius: "8px",
									}}
									title={
										isSyncedToCalendar
											? "Synced to calendar - click to remove"
											: "Add to calendar export"
									}
								>
									<i
										className={`codicon ${isSyncedToCalendar ? "codicon-calendar" : "codicon-calendar"}`}
										style={{ fontSize: "12px" }}
									/>
									<span className="text-xs">
										{isSyncedToCalendar ? "On Cal" : "Add Cal"}
									</span>
								</button>
							)}

							{/* Edit Button */}
							<button
								onClick={onEdit}
								className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
								style={buttonSecondaryStyle}
								title="Edit event"
							>
								<i
									className="codicon codicon-edit"
									style={{ fontSize: "14px" }}
								/>
							</button>

							{/* Delete Button */}
							<button
								onClick={handleDelete}
								className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
								style={{
									backgroundColor: confirmDelete
										? "var(--vscode-errorForeground)"
										: "var(--vscode-button-secondaryBackground)",
									border: confirmDelete
										? "1px solid var(--vscode-errorForeground)"
										: "1px solid var(--vscode-panel-border)",
									color: confirmDelete
										? "var(--vscode-editor-background)"
										: "var(--vscode-button-secondaryForeground)",
									borderRadius: "8px",
								}}
								title={
									confirmDelete ? "Click again to confirm" : "Delete event"
								}
							>
								<i
									className={`codicon ${confirmDelete ? "codicon-check" : "codicon-trash"}`}
									style={{ fontSize: "14px" }}
								/>
							</button>
						</div>
					</div>
				</div>

				{/* Card Content */}
				{(event.description ||
					event.linkedDocuments.length > 0 ||
					(event.tags && event.tags.length > 0)) && (
					<div
						className="px-4 pb-4 pt-0"
						style={{ borderTop: "1px solid var(--vscode-panel-border)" }}
					>
						<div className="pt-3">
							{/* Description */}
							{event.description && (
								<p
									className="text-sm mb-3 whitespace-pre-wrap"
									style={textMutedStyle}
								>
									{event.description}
								</p>
							)}

							{/* Linked Docs */}
							{event.linkedDocuments.length > 0 && (
								<div className="mb-3">
									<div className="flex items-center gap-1.5 mb-2">
										<i
											className="codicon codicon-file-symlink-file"
											style={{
												color: "var(--vscode-button-background)",
												fontSize: "12px",
											}}
										/>
										<span
											className="text-xs font-medium"
											style={textMutedStyle}
										>
											Linked Documents ({event.linkedDocuments.length})
										</span>
									</div>
									<div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto void-scrollbar">
										{event.linkedDocuments.slice(0, 6).map((docUri, idx) => {
											const fileName = getFileName(docUri);
											const { icon, colorVar } = getFileIcon(fileName);
											return (
												<button
													key={idx}
													onClick={() => handleOpenDocument(docUri)}
													className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs cursor-pointer transition-all"
													style={buttonSecondaryStyle}
													title={`Open ${fileName}`}
												>
													<i
														className={`codicon codicon-${icon} mr-1.5`}
														style={{ color: colorVar, fontSize: "12px" }}
													/>
													{fileName}
													<i
														className="codicon codicon-link-external ml-1.5"
														style={{ fontSize: "10px", opacity: 0.5 }}
													/>
												</button>
											);
										})}
										{event.linkedDocuments.length > 6 && (
											<span
												className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs"
												style={buttonSecondaryStyle}
											>
												+{event.linkedDocuments.length - 6} more
											</span>
										)}
									</div>
								</div>
							)}

							{/* Tags */}
							{event.tags && event.tags.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{event.tags.map((tag, idx) => (
										<span
											key={idx}
											className="text-xs"
											style={{ color: "var(--vscode-disabledForeground)" }}
										>
											#{tag}
										</span>
									))}
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
