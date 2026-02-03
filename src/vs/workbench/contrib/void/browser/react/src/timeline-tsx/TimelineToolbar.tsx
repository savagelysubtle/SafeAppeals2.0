/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from "react";
import {
	EVENT_CATEGORY_LABELS,
	EventCategory,
	JurisdictionConfig,
	TimelineEvent,
} from "../../../../common/timeline/timelineTypes.js";
import { NotificationCenter } from "./NotificationCenter.js";
import type { DisplayMode, TimelineViewMode } from "./TimelineDashboard.js";

// Reusable style objects with VSCode CSS variables
const toolbarStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-sideBar-background)",
	borderBottom: "1px solid var(--vscode-panel-border)",
};

const buttonPrimaryStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-button-background)",
	color: "var(--vscode-button-foreground)",
	border: "none",
	borderRadius: "8px",
	cursor: "pointer",
};

const buttonSecondaryStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-button-secondaryBackground)",
	color: "var(--vscode-button-secondaryForeground)",
	border: "1px solid var(--vscode-panel-border)",
	borderRadius: "8px",
};

const selectStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-input-background)",
	color: "var(--vscode-input-foreground)",
	border: "1px solid var(--vscode-input-border)",
	borderRadius: "8px",
};

const textMutedStyle: React.CSSProperties = {
	color: "var(--vscode-descriptionForeground)",
};

// View mode labels
const VIEW_MODE_LABELS: Record<
	TimelineViewMode,
	{ label: string; icon: string }
> = {
	all: { label: "All Time", icon: "codicon-list-flat" },
	year: { label: "This Year", icon: "codicon-calendar" },
	month: { label: "This Month", icon: "codicon-calendar" },
	week: { label: "This Week", icon: "codicon-watch" },
};

interface TimelineToolbarProps {
	onAddEvent: () => void;
	onExport: () => void;
	onExportIcs?: () => void;
	calendarEventCount?: number;
	// Google Calendar integration
	googleCalendarConnected?: boolean;
	onConnectGoogleCalendar?: () => void;
	onDisconnectGoogleCalendar?: () => void;
	onSyncToGoogleCalendar?: () => void;
	isSyncing?: boolean;
	// Outlook Calendar integration
	outlookCalendarConnected?: boolean;
	onConnectOutlookCalendar?: () => void;
	onDisconnectOutlookCalendar?: () => void;
	onSyncToOutlookCalendar?: () => void;
	isOutlookSyncing?: boolean;
	onSyncFromCase: () => void;
	filterCategory: EventCategory | "all";
	onFilterChange: (category: EventCategory | "all") => void;
	showDeadlinesOnly: boolean;
	onShowDeadlinesChange: (show: boolean) => void;
	jurisdiction?: JurisdictionConfig;
	onJurisdictionClick: () => void;
	eventCount: number;
	viewMode: TimelineViewMode;
	onViewModeChange: (mode: TimelineViewMode) => void;
	displayMode: DisplayMode;
	onDisplayModeChange: (mode: DisplayMode) => void;
	onEditEvent?: (event: TimelineEvent) => void;
	onOpenNotificationSettings?: () => void;
}

export const TimelineToolbar: React.FC<TimelineToolbarProps> = ({
	onAddEvent,
	onExport,
	onExportIcs,
	calendarEventCount = 0,
	googleCalendarConnected = false,
	onConnectGoogleCalendar,
	onDisconnectGoogleCalendar,
	onSyncToGoogleCalendar,
	isSyncing = false,
	outlookCalendarConnected = false,
	onConnectOutlookCalendar,
	onDisconnectOutlookCalendar,
	onSyncToOutlookCalendar,
	isOutlookSyncing = false,
	onSyncFromCase,
	filterCategory,
	onFilterChange,
	showDeadlinesOnly,
	onShowDeadlinesChange,
	jurisdiction,
	onJurisdictionClick,
	eventCount,
	viewMode,
	onViewModeChange,
	displayMode,
	onDisplayModeChange,
	onEditEvent,
	onOpenNotificationSettings,
}) => {
	const categories: (EventCategory | "all")[] = [
		"all",
		"injury",
		"medical",
		"hearing",
		"decision",
		"deadline",
		"filing",
		"correspondence",
		"custom",
	];

	return (
		<div className="p-3 flex flex-wrap items-center gap-3" style={toolbarStyle}>
			{/* Add Event Button - Primary */}
			<button
				onClick={onAddEvent}
				className="px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all"
				style={buttonPrimaryStyle}
			>
				<i className="codicon codicon-add" />
				<span>Add Event</span>
			</button>

			{/* Divider */}
			<div
				className="w-px h-6"
				style={{ backgroundColor: "var(--vscode-panel-border)" }}
			/>

			{/* Display Mode Toggle (Timeline/Calendar) */}
			<div
				className="flex items-center gap-1 p-1 rounded-lg"
				style={buttonSecondaryStyle}
			>
				<button
					onClick={() => onDisplayModeChange("timeline")}
					className="px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
					style={{
						backgroundColor:
							displayMode === "timeline"
								? "var(--vscode-button-background)"
								: "transparent",
						color:
							displayMode === "timeline"
								? "var(--vscode-button-foreground)"
								: "var(--vscode-descriptionForeground)",
					}}
					title="Timeline View"
				>
					<i
						className="codicon codicon-list-tree"
						style={{ fontSize: "12px" }}
					/>
					<span>Timeline</span>
				</button>
				<button
					onClick={() => onDisplayModeChange("calendar")}
					className="px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
					style={{
						backgroundColor:
							displayMode === "calendar"
								? "var(--vscode-button-background)"
								: "transparent",
						color:
							displayMode === "calendar"
								? "var(--vscode-button-foreground)"
								: "var(--vscode-descriptionForeground)",
					}}
					title="Calendar View"
				>
					<i
						className="codicon codicon-calendar"
						style={{ fontSize: "12px" }}
					/>
					<span>Calendar</span>
				</button>
			</div>

			{/* Divider */}
			<div
				className="w-px h-6"
				style={{ backgroundColor: "var(--vscode-panel-border)" }}
			/>

			{/* View Mode Selector (Zoom Controls) - Only show in timeline mode */}
			{displayMode === "timeline" && (
				<>
					<div
						className="flex items-center gap-1 p-1 rounded-lg"
						style={buttonSecondaryStyle}
					>
						{(Object.keys(VIEW_MODE_LABELS) as TimelineViewMode[]).map(
							(mode) => (
								<button
									key={mode}
									onClick={() => onViewModeChange(mode)}
									className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
									style={{
										backgroundColor:
											viewMode === mode
												? "var(--vscode-button-background)"
												: "transparent",
										color:
											viewMode === mode
												? "var(--vscode-button-foreground)"
												: "var(--vscode-descriptionForeground)",
									}}
									title={VIEW_MODE_LABELS[mode].label}
								>
									{VIEW_MODE_LABELS[mode].label}
								</button>
							),
						)}
					</div>
					<div
						className="w-px h-6"
						style={{ backgroundColor: "var(--vscode-panel-border)" }}
					/>
				</>
			)}

			{/* Category Filter & Deadlines Toggle - Only show in timeline mode */}
			{displayMode === "timeline" && (
				<>
					{/* Category Filter */}
					<div className="flex items-center gap-2">
						<label className="text-sm" style={textMutedStyle}>
							Filter:
						</label>
						<select
							value={filterCategory}
							onChange={(e) =>
								onFilterChange(e.target.value as EventCategory | "all")
							}
							className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
							style={selectStyle}
						>
							{categories.map((cat) => (
								<option key={cat} value={cat}>
									{cat === "all"
										? "All Categories"
										: EVENT_CATEGORY_LABELS[cat]}
								</option>
							))}
						</select>
					</div>

					{/* Deadlines Only Toggle */}
					<label className="flex items-center gap-2 cursor-pointer select-none">
						<div
							className="relative w-8 h-5 rounded-full transition-colors cursor-pointer"
							style={{
								backgroundColor: showDeadlinesOnly
									? "var(--vscode-button-background)"
									: "var(--vscode-panel-border)",
							}}
							onClick={() => onShowDeadlinesChange(!showDeadlinesOnly)}
						>
							<div
								className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
								style={{
									backgroundColor: "var(--vscode-editor-foreground)",
									transform: showDeadlinesOnly
										? "translateX(14px)"
										: "translateX(2px)",
								}}
							/>
						</div>
						<span className="text-sm" style={textMutedStyle}>
							Deadlines only
						</span>
					</label>
				</>
			)}

			{/* Spacer */}
			<div className="flex-1" />

			{/* Export PDF Button */}
			<button
				onClick={onExport}
				className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
				style={buttonSecondaryStyle}
				title="Export timeline to PDF"
			>
				<i className="codicon codicon-file-pdf" style={{ fontSize: "12px" }} />
				<span>Export PDF</span>
			</button>

			{/* Export ICS Button */}
			{onExportIcs && (
				<button
					onClick={onExportIcs}
					disabled={calendarEventCount === 0}
					className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
					style={{
						...buttonSecondaryStyle,
						opacity: calendarEventCount === 0 ? 0.5 : 1,
						cursor: calendarEventCount === 0 ? "not-allowed" : "pointer",
					}}
					title={
						calendarEventCount === 0
							? "No events marked for calendar sync"
							: `Export ${calendarEventCount} event${calendarEventCount !== 1 ? "s" : ""} to calendar (.ics)`
					}
				>
					<i
						className="codicon codicon-calendar"
						style={{ fontSize: "12px" }}
					/>
					<span>
						Export .ics
						{calendarEventCount > 0 ? ` (${calendarEventCount})` : ""}
					</span>
				</button>
			)}

			{/* Google Calendar Integration */}
			{!googleCalendarConnected && onConnectGoogleCalendar && (
				<button
					onClick={onConnectGoogleCalendar}
					className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
					style={{
						...buttonSecondaryStyle,
						borderColor: "var(--vscode-charts-blue)",
					}}
					title="Connect to Google Calendar for live sync"
				>
					<i
						className="codicon codicon-plug"
						style={{ fontSize: "12px", color: "var(--vscode-charts-blue)" }}
					/>
					<span>Connect Google</span>
				</button>
			)}

			{googleCalendarConnected && (
				<div className="flex items-center gap-1">
					{/* Sync Now Button */}
					{onSyncToGoogleCalendar && (
						<button
							onClick={onSyncToGoogleCalendar}
							disabled={isSyncing || calendarEventCount === 0}
							className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
							style={{
								...buttonSecondaryStyle,
								borderColor: "var(--vscode-charts-green)",
								opacity: isSyncing || calendarEventCount === 0 ? 0.5 : 1,
								cursor:
									isSyncing || calendarEventCount === 0
										? "not-allowed"
										: "pointer",
							}}
							title={
								isSyncing
									? "Syncing..."
									: calendarEventCount === 0
										? "No events to sync"
										: `Sync ${calendarEventCount} event${calendarEventCount !== 1 ? "s" : ""} to Google Calendar`
							}
						>
							<i
								className={`codicon ${isSyncing ? "codicon-sync codicon-modifier-spin" : "codicon-cloud-upload"}`}
								style={{
									fontSize: "12px",
									color: "var(--vscode-charts-green)",
								}}
							/>
							<span>{isSyncing ? "Syncing..." : "Google"}</span>
						</button>
					)}
					{/* Disconnect Button */}
					{onDisconnectGoogleCalendar && (
						<button
							onClick={onDisconnectGoogleCalendar}
							className="text-xs px-2 py-1.5 rounded-lg flex items-center transition-all cursor-pointer"
							style={{
								...buttonSecondaryStyle,
								color: "var(--vscode-errorForeground)",
							}}
							title="Disconnect Google Calendar"
						>
							<span>Disconnect</span>
						</button>
					)}
				</div>
			)}

			{/* Outlook Calendar Integration */}
			{!outlookCalendarConnected && onConnectOutlookCalendar && (
				<button
					onClick={onConnectOutlookCalendar}
					className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
					style={{
						...buttonSecondaryStyle,
						borderColor: "var(--vscode-charts-orange)",
					}}
					title="Connect to Outlook Calendar for live sync"
				>
					<i
						className="codicon codicon-plug"
						style={{ fontSize: "12px", color: "var(--vscode-charts-orange)" }}
					/>
					<span>Connect Outlook</span>
				</button>
			)}

			{outlookCalendarConnected && (
				<div className="flex items-center gap-1">
					{/* Sync Now Button */}
					{onSyncToOutlookCalendar && (
						<button
							onClick={onSyncToOutlookCalendar}
							disabled={isOutlookSyncing || calendarEventCount === 0}
							className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
							style={{
								...buttonSecondaryStyle,
								borderColor: "var(--vscode-charts-orange)",
								opacity: isOutlookSyncing || calendarEventCount === 0 ? 0.5 : 1,
								cursor:
									isOutlookSyncing || calendarEventCount === 0
										? "not-allowed"
										: "pointer",
							}}
							title={
								isOutlookSyncing
									? "Syncing..."
									: calendarEventCount === 0
										? "No events to sync"
										: `Sync ${calendarEventCount} event${calendarEventCount !== 1 ? "s" : ""} to Outlook Calendar`
							}
						>
							<i
								className={`codicon ${isOutlookSyncing ? "codicon-sync codicon-modifier-spin" : "codicon-cloud-upload"}`}
								style={{
									fontSize: "12px",
									color: "var(--vscode-charts-orange)",
								}}
							/>
							<span>{isOutlookSyncing ? "Syncing..." : "Outlook"}</span>
						</button>
					)}
					{/* Disconnect Button */}
					{onDisconnectOutlookCalendar && (
						<button
							onClick={onDisconnectOutlookCalendar}
							className="text-xs px-2 py-1.5 rounded-lg flex items-center transition-all cursor-pointer"
							style={{
								...buttonSecondaryStyle,
								color: "var(--vscode-errorForeground)",
							}}
							title="Disconnect Outlook Calendar"
						>
							<span>Disconnect</span>
						</button>
					)}
				</div>
			)}

			{/* Sync from Case Button */}
			<button
				onClick={onSyncFromCase}
				className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
				style={buttonSecondaryStyle}
				title="Sync timeline with case configuration"
			>
				<i className="codicon codicon-sync" style={{ fontSize: "12px" }} />
				<span>Sync Case</span>
			</button>

			{/* Jurisdiction Selector Button */}
			<button
				onClick={onJurisdictionClick}
				className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
				style={{
					...buttonPrimaryStyle,
					padding: "6px 12px",
				}}
			>
				<i className="codicon codicon-law" style={{ fontSize: "12px" }} />
				<span>{jurisdiction?.name || "Select Jurisdiction"}</span>
				<i
					className="codicon codicon-chevron-down"
					style={{ fontSize: "12px" }}
				/>
			</button>

			{/* Notification Center */}
			<NotificationCenter onEditEvent={onEditEvent} />

			{/* Notification Settings Button */}
			{onOpenNotificationSettings && (
				<button
					onClick={onOpenNotificationSettings}
					className="text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
					style={buttonSecondaryStyle}
					title="Notification Settings"
				>
					<span>Alert Settings</span>
				</button>
			)}

			{/* Event Count */}
			<span
				className="text-sm px-3 py-1 rounded-lg"
				style={buttonSecondaryStyle}
			>
				{eventCount} event{eventCount !== 1 ? "s" : ""}
			</span>
		</div>
	);
};
