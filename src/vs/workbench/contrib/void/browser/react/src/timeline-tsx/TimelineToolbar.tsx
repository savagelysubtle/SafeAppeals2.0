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

// SafeAppeals brand colors
const BRAND_GREEN = "#22c55e";

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
		<div
			className="p-3 flex flex-wrap items-center gap-3"
			style={{
				backgroundColor: "#0f0f0f",
				borderBottom: `1px solid ${BRAND_GREEN}20`,
			}}
		>
			{/* Add Event Button - Green accent */}
			<button
				onClick={onAddEvent}
				className="px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all"
				style={{
					backgroundColor: BRAND_GREEN,
					color: "#0a0a0a",
					boxShadow: `0 2px 8px ${BRAND_GREEN}30`,
				}}
				onMouseEnter={(e) =>
					(e.currentTarget.style.backgroundColor = "#16a34a")
				}
				onMouseLeave={(e) =>
					(e.currentTarget.style.backgroundColor = BRAND_GREEN)
				}
			>
				<i className="codicon codicon-add" />
				<span>Add Event</span>
			</button>

			{/* Divider */}
			<div className="w-px h-6" style={{ backgroundColor: "#27272a" }} />

			{/* Display Mode Toggle (Timeline/Calendar) */}
			<div
				className="flex items-center gap-1 p-1 rounded-lg"
				style={{ backgroundColor: "#1a1a1a", border: "1px solid #27272a" }}
			>
				<button
					onClick={() => onDisplayModeChange("timeline")}
					className="px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
					style={{
						backgroundColor:
							displayMode === "timeline" ? BRAND_GREEN : "transparent",
						color: displayMode === "timeline" ? "#0a0a0a" : "#71717a",
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
							displayMode === "calendar" ? BRAND_GREEN : "transparent",
						color: displayMode === "calendar" ? "#0a0a0a" : "#71717a",
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
			<div className="w-px h-6" style={{ backgroundColor: "#27272a" }} />

			{/* View Mode Selector (Zoom Controls) - Only show in timeline mode */}
			{displayMode === "timeline" && (
				<>
					<div
						className="flex items-center gap-1 p-1 rounded-lg"
						style={{ backgroundColor: "#1a1a1a", border: "1px solid #27272a" }}
					>
						{(Object.keys(VIEW_MODE_LABELS) as TimelineViewMode[]).map(
							(mode) => (
								<button
									key={mode}
									onClick={() => onViewModeChange(mode)}
									className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
									style={{
										backgroundColor:
											viewMode === mode ? BRAND_GREEN : "transparent",
										color: viewMode === mode ? "#0a0a0a" : "#71717a",
									}}
									title={VIEW_MODE_LABELS[mode].label}
								>
									{VIEW_MODE_LABELS[mode].label}
								</button>
							)
						)}
					</div>
					<div className="w-px h-6" style={{ backgroundColor: "#27272a" }} />
				</>
			)}

			{/* Category Filter & Deadlines Toggle - Only show in timeline mode */}
			{displayMode === "timeline" && (
				<>
					{/* Category Filter */}
					<div className="flex items-center gap-2">
						<label className="text-sm" style={{ color: "#71717a" }}>
							Filter:
						</label>
						<select
							value={filterCategory}
							onChange={(e) =>
								onFilterChange(e.target.value as EventCategory | "all")
							}
							className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
							style={{
								backgroundColor: "#1a1a1a",
								color: "#fafafa",
								border: "1px solid #27272a",
							}}
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
								backgroundColor: showDeadlinesOnly ? BRAND_GREEN : "#27272a",
							}}
							onClick={() => onShowDeadlinesChange(!showDeadlinesOnly)}
						>
							<div
								className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
								style={{
									backgroundColor: "#fafafa",
									transform: showDeadlinesOnly
										? "translateX(14px)"
										: "translateX(2px)",
								}}
							/>
						</div>
						<span className="text-sm" style={{ color: "#a1a1aa" }}>
							Deadlines only
						</span>
					</label>
				</>
			)}

			{/* Spacer */}
			<div className="flex-1" />

			{/* Export Button */}
			<button
				onClick={onExport}
				className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
				style={{
					backgroundColor: "#1a1a1a",
					color: "#a1a1aa",
					border: "1px solid #27272a",
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.backgroundColor = "#27272a";
					e.currentTarget.style.color = "#fafafa";
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.backgroundColor = "#1a1a1a";
					e.currentTarget.style.color = "#a1a1aa";
				}}
				title="Export timeline to PDF"
			>
				<i className="codicon codicon-file-pdf" style={{ fontSize: "12px" }} />
				<span>Export PDF</span>
			</button>

			{/* Sync from Case Button */}
			<button
				onClick={onSyncFromCase}
				className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
				style={{
					backgroundColor: "#1a1a1a",
					color: "#a1a1aa",
					border: "1px solid #27272a",
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.backgroundColor = "#27272a";
					e.currentTarget.style.color = "#fafafa";
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.backgroundColor = "#1a1a1a";
					e.currentTarget.style.color = "#a1a1aa";
				}}
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
					backgroundColor: `${BRAND_GREEN}15`,
					color: BRAND_GREEN,
					border: `1px solid ${BRAND_GREEN}30`,
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
					className="p-2 rounded-lg transition-colors flex items-center justify-center"
					style={{
						backgroundColor: "#1a1a1a",
						border: "1px solid #27272a",
						minWidth: "36px",
						minHeight: "36px",
					}}
					onMouseEnter={(e) =>
						(e.currentTarget.style.backgroundColor = "#27272a")
					}
					onMouseLeave={(e) =>
						(e.currentTarget.style.backgroundColor = "#1a1a1a")
					}
					title="Notification Settings"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="#71717a"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<circle cx="8" cy="8" r="2" />
						<path d="M13.5 8a5.5 5.5 0 0 0-.15-1.28l1.45-1.12-1-1.73-1.73.5a5.5 5.5 0 0 0-1.1-.64L10.5 2h-2l-.47 1.73a5.5 5.5 0 0 0-1.1.64l-1.73-.5-1 1.73 1.45 1.12a5.5 5.5 0 0 0 0 2.56l-1.45 1.12 1 1.73 1.73-.5c.32.26.7.48 1.1.64L8.5 14h2l.47-1.73c.4-.16.78-.38 1.1-.64l1.73.5 1-1.73-1.45-1.12c.1-.42.15-.85.15-1.28z" />
					</svg>
				</button>
			)}

			{/* Event Count */}
			<span
				className="text-sm px-3 py-1 rounded-lg"
				style={{
					backgroundColor: "#1a1a1a",
					color: "#71717a",
					border: "1px solid #27272a",
				}}
			>
				{eventCount} event{eventCount !== 1 ? "s" : ""}
			</span>
		</div>
	);
};
