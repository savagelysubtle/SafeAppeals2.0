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
  TimelineEvent } from
"../../../../common/timeline/timelineTypes.js";
import { useAccessor } from "../util/services.js";

// Reusable style objects with VSCode CSS variables
const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--vscode-input-background)",
  border: "1px solid var(--vscode-panel-border)",
  borderRadius: "12px"
};

const buttonSecondaryStyle: React.CSSProperties = {
  backgroundColor: "var(--vscode-button-secondaryBackground)",
  color: "var(--vscode-button-secondaryForeground)",
  border: "1px solid var(--vscode-panel-border)",
  borderRadius: "8px"
};

const textPrimaryStyle: React.CSSProperties = {
  color: "var(--vscode-editor-foreground)"
};

const textMutedStyle: React.CSSProperties = {
  color: "var(--vscode-descriptionForeground)"
};

// File icons based on extension - using VSCode semantic colors
const FILE_ICONS: Record<string, {icon: string;colorVar: string;}> = {
  pdf: { icon: "file-pdf", colorVar: "var(--vscode-charts-red)" },
  doc: { icon: "file-text", colorVar: "var(--vscode-charts-blue)" },
  docx: { icon: "file-text", colorVar: "var(--vscode-charts-blue)" },
  txt: { icon: "file-text", colorVar: "var(--vscode-descriptionForeground)" },
  md: { icon: "markdown", colorVar: "var(--vscode-descriptionForeground)" },
  jpg: { icon: "file-media", colorVar: "var(--vscode-charts-orange)" },
  jpeg: { icon: "file-media", colorVar: "var(--vscode-charts-orange)" },
  png: { icon: "file-media", colorVar: "var(--vscode-charts-orange)" },
  default: { icon: "file", colorVar: "var(--vscode-descriptionForeground)" }
};

function getFileIcon(filename: string): {icon: string;colorVar: string;} {
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
  isLast
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
    <div className="void-relative void-pl-12 void-group void-mb-4">
			{/* Drag Handle - shown on group hover via CSS (no React state to avoid re-renders) */}
			<div
        className="void-absolute void-left-0 void-top-1/2 -void-translate-y-1/2 void-w-3 void-h-8 void-rounded void-cursor-grab active:void-cursor-grabbing void-flex void-flex-col void-items-center void-justify-center void-gap-0.5 void-opacity-0 group-hover:void-opacity-60 void-transition-opacity"
        style={{ backgroundColor: "var(--vscode-panel-border)" }}
        title="Drag to reorder (coming soon)">
        
				<div
          className="void-w-1 void-h-1 void-rounded-full"
          style={{ backgroundColor: "var(--vscode-descriptionForeground)" }} />
        
				<div
          className="void-w-1 void-h-1 void-rounded-full"
          style={{ backgroundColor: "var(--vscode-descriptionForeground)" }} />
        
				<div
          className="void-w-1 void-h-1 void-rounded-full"
          style={{ backgroundColor: "var(--vscode-descriptionForeground)" }} />
        
			</div>

			{/* Timeline Dot - accent for first event */}
			<div
        className="void-absolute void-left-4 void-w-4 void-h-4 void-rounded-full void-border-2 void-transform -void-translate-x-1/2 void-z-10 void-mt-5"
        style={{
          backgroundColor: isFirst ?
          "var(--vscode-button-background)" :
          categoryColor,
          borderColor: "var(--vscode-editor-background)",
          boxShadow: isOverdue ?
          "0 0 0 3px var(--vscode-inputValidation-errorBackground)" :
          isUpcoming ?
          "0 0 0 3px var(--vscode-inputValidation-warningBackground)" :
          isFirst ?
          "0 0 0 3px var(--vscode-button-secondaryBackground)" :
          "none"
        }} />
      

			{/* Card */}
			<div
        className="void-rounded-xl void-transition-all void-duration-200"
        style={{
          backgroundColor: "var(--vscode-input-background)",
          border: `1px solid ${getBorderColor()}`
        }}>
        
				{/* Card Header */}
				<div className="void-p-4">
					<div className="void-flex void-items-start void-justify-between">
						<div className="void-flex-1 void-space-y-2">
							{/* Top row: Category badge + Status badges */}
							<div className="void-flex void-items-center void-gap-2 void-flex-wrap">
								{/* Category Badge */}
								<span
                  className="void-inline-flex void-items-center void-rounded-md void-px-2 void-py-0.5 void-text-xs void-font-semibold"
                  style={{
                    backgroundColor: `${categoryColor}20`,
                    color: categoryColor,
                    border: `1px solid ${categoryColor}30`
                  }}>
                  
									{categoryLabel}
								</span>

								{/* First Event Badge */}
								{isFirst &&
                <span
                  className="void-inline-flex void-items-center void-rounded-md void-px-2 void-py-0.5 void-text-xs void-font-semibold"
                  style={{
                    backgroundColor:
                    "var(--vscode-button-secondaryBackground)",
                    color: "var(--vscode-button-background)",
                    border: "1px solid var(--vscode-panel-border)"
                  }}>
                  
										<i
                    className="void-codicon void-codicon-star-full void-mr-1"
                    style={{ fontSize: "10px" }} />
                  
										First Event
									</span>
                }

								{/* Status Badges */}
								{event.isDeadline &&
                <span
                  className="void-inline-flex void-items-center void-rounded-md void-px-2 void-py-0.5 void-text-xs void-font-semibold"
                  style={{
                    backgroundColor: isOverdue ?
                    "var(--vscode-inputValidation-errorBackground)" :
                    isUpcoming ?
                    "var(--vscode-inputValidation-warningBackground)" :
                    "var(--vscode-inputValidation-infoBackground)",
                    color: isOverdue ?
                    "var(--vscode-errorForeground)" :
                    isUpcoming ?
                    "var(--vscode-editorWarning-foreground)" :
                    "var(--vscode-editorInfo-foreground)",
                    border: `1px solid ${
                    isOverdue ?
                    "var(--vscode-inputValidation-errorBorder)" :
                    isUpcoming ?
                    "var(--vscode-inputValidation-warningBorder)" :
                    "var(--vscode-inputValidation-infoBorder)"}`

                  }}>
                  
										<i
                    className={`void-codicon ${isOverdue ? "void-codicon-warning" : "void-codicon-clock"} void-mr-1`}
                    style={{ fontSize: "10px" }} />
                  
										{isOverdue ?
                  "Overdue" :
                  isUpcoming ?
                  "Due Soon" :
                  "Deadline"}
									</span>
                }

								{event.isComplete &&
                <span
                  className="void-inline-flex void-items-center void-rounded-md void-px-2 void-py-0.5 void-text-xs void-font-semibold"
                  style={{
                    backgroundColor:
                    "var(--vscode-button-secondaryBackground)",
                    color: "var(--vscode-button-background)",
                    border: "1px solid var(--vscode-panel-border)"
                  }}>
                  
										<i
                    className="void-codicon void-codicon-check void-mr-1"
                    style={{ fontSize: "10px" }} />
                  
										Complete
									</span>
                }
							</div>

							{/* Title */}
							<h3 className="void-font-semibold void-text-base" style={textPrimaryStyle}>
								{event.title}
							</h3>

							{/* Date */}
							<p className="void-text-sm" style={textMutedStyle}>
								<i
                  className="void-codicon void-codicon-calendar void-mr-1.5"
                  style={{ fontSize: "12px" }} />
                
								{formatTimelineDate(event.date)}
								{event.endDate && ` → ${formatTimelineDate(event.endDate)}`}
							</p>
						</div>

						{/* Action Buttons - Always visible, not just on hover */}
						<div className="void-flex void-items-center void-gap-1 void-ml-3">
							{/* Calendar Sync Toggle Button */}
							{onToggleSyncToCalendar &&
              <button
                onClick={onToggleSyncToCalendar}
                className="void-h-8 void-px-2 void-rounded-lg void-flex void-items-center void-justify-center void-gap-1.5 void-transition-all"
                style={{
                  backgroundColor: isSyncedToCalendar ?
                  "var(--vscode-button-background)" :
                  "var(--vscode-button-secondaryBackground)",
                  color: isSyncedToCalendar ?
                  "var(--vscode-button-foreground)" :
                  "var(--vscode-button-secondaryForeground)",
                  border: isSyncedToCalendar ?
                  "1px solid var(--vscode-button-background)" :
                  "1px solid var(--vscode-panel-border)",
                  borderRadius: "8px"
                }}
                title={
                isSyncedToCalendar ?
                "Synced to calendar - click to remove" :
                "Add to calendar export"
                }>
                
									<i
                  className={`void-codicon ${isSyncedToCalendar ? "void-codicon-calendar" : "void-codicon-calendar"}`}
                  style={{ fontSize: "12px" }} />
                
									<span className="void-text-xs">
										{isSyncedToCalendar ? "On Cal" : "Add Cal"}
									</span>
								</button>
              }

							{/* Edit Button */}
							<button
                onClick={onEdit}
                className="void-w-8 void-h-8 void-rounded-lg void-flex void-items-center void-justify-center void-transition-all"
                style={buttonSecondaryStyle}
                title="Edit event">
                
								<i
                  className="void-codicon void-codicon-edit"
                  style={{ fontSize: "14px" }} />
                
							</button>

							{/* Delete Button */}
							<button
                onClick={handleDelete}
                className="void-w-8 void-h-8 void-rounded-lg void-flex void-items-center void-justify-center void-transition-all"
                style={{
                  backgroundColor: confirmDelete ?
                  "var(--vscode-errorForeground)" :
                  "var(--vscode-button-secondaryBackground)",
                  border: confirmDelete ?
                  "1px solid var(--vscode-errorForeground)" :
                  "1px solid var(--vscode-panel-border)",
                  color: confirmDelete ?
                  "var(--vscode-editor-background)" :
                  "var(--vscode-button-secondaryForeground)",
                  borderRadius: "8px"
                }}
                title={
                confirmDelete ? "Click again to confirm" : "Delete event"
                }>
                
								<i
                  className={`void-codicon ${confirmDelete ? "void-codicon-check" : "void-codicon-trash"}`}
                  style={{ fontSize: "14px" }} />
                
							</button>
						</div>
					</div>
				</div>

				{/* Card Content */}
				{(event.description ||
        event.linkedDocuments.length > 0 ||
        event.tags && event.tags.length > 0) &&
        <div
          className="void-px-4 void-pb-4 void-pt-0"
          style={{ borderTop: "1px solid var(--vscode-panel-border)" }}>
          
						<div className="void-pt-3">
							{/* Description */}
							{event.description &&
            <p
              className="void-text-sm void-mb-3 void-whitespace-pre-wrap"
              style={textMutedStyle}>
              
									{event.description}
								</p>
            }

							{/* Linked Docs */}
							{event.linkedDocuments.length > 0 &&
            <div className="void-mb-3">
									<div className="void-flex void-items-center void-gap-1.5 void-mb-2">
										<i
                  className="void-codicon void-codicon-file-symlink-file"
                  style={{
                    color: "var(--vscode-button-background)",
                    fontSize: "12px"
                  }} />
                
										<span
                  className="void-text-xs void-font-medium"
                  style={textMutedStyle}>
                  
											Linked Documents ({event.linkedDocuments.length})
										</span>
									</div>
									<div className="void-flex void-flex-wrap void-gap-2 void-max-h-24 void-overflow-y-auto void-void-scrollbar">
										{event.linkedDocuments.slice(0, 6).map((docUri, idx) => {
                  const fileName = getFileName(docUri);
                  const { icon, colorVar } = getFileIcon(fileName);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleOpenDocument(docUri)}
                      className="void-inline-flex void-items-center void-rounded-lg void-px-2.5 void-py-1.5 void-text-xs void-cursor-pointer void-transition-all"
                      style={buttonSecondaryStyle}
                      title={`Open ${fileName}`}>
                      
													<i
                        className={`void-codicon void-codicon-${icon} void-mr-1.5`}
                        style={{ color: colorVar, fontSize: "12px" }} />
                      
													{fileName}
													<i
                        className="void-codicon void-codicon-link-external void-ml-1.5"
                        style={{ fontSize: "10px", opacity: 0.5 }} />
                      
												</button>);

                })}
										{event.linkedDocuments.length > 6 &&
                <span
                  className="void-inline-flex void-items-center void-rounded-lg void-px-2.5 void-py-1.5 void-text-xs"
                  style={buttonSecondaryStyle}>
                  
												+{event.linkedDocuments.length - 6} more
											</span>
                }
									</div>
								</div>
            }

							{/* Tags */}
							{event.tags && event.tags.length > 0 &&
            <div className="void-flex void-flex-wrap void-gap-2">
									{event.tags.map((tag, idx) =>
              <span
                key={idx}
                className="void-text-xs"
                style={{ color: "var(--vscode-disabledForeground)" }}>
                
											#{tag}
										</span>
              )}
								</div>
            }
						</div>
					</div>
        }
			</div>
		</div>);

};