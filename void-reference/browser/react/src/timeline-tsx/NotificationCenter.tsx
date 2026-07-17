/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	NOTIFICATION_TYPE_ICONS,
	TimelineEvent,
	TimelineNotification,
	formatTimelineDate,
} from "../../../../common/timeline/timelineTypes.js";
import { useAccessor } from "../util/services.js";

// Reusable style objects with VSCode CSS variables
const buttonSecondaryStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-button-secondaryBackground)",
	color: "var(--vscode-button-secondaryForeground)",
	border: "1px solid var(--vscode-panel-border)",
	borderRadius: "8px",
};

const textMutedStyle: React.CSSProperties = {
	color: "var(--vscode-descriptionForeground)",
};

// Severity-specific VSCode colors
const SEVERITY_COLORS = {
	error: "var(--vscode-errorForeground)",
	warning: "var(--vscode-editorWarning-foreground)",
	info: "var(--vscode-editorInfo-foreground)",
};

const SEVERITY_BG = {
	error: "var(--vscode-inputValidation-errorBackground)",
	warning: "var(--vscode-inputValidation-warningBackground)",
	info: "var(--vscode-inputValidation-infoBackground)",
};

interface NotificationCenterProps {
	onEditEvent?: (event: TimelineEvent) => void;
}

interface NotificationItemProps {
	notification: TimelineNotification;
	onMarkRead: () => void;
	onDismiss: () => void;
	onSnooze: (days: number) => void;
	onClickEvent?: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
	notification,
	onMarkRead,
	onDismiss,
	onSnooze,
	onClickEvent,
}) => {
	const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);

	return (
		<div
			className={`p-3 rounded-lg mb-2 transition-all ${notification.isRead ? "opacity-60" : ""}`}
			style={{
				backgroundColor: SEVERITY_BG[notification.severity],
				border: `1px solid ${notification.severity === "error" ? "var(--vscode-inputValidation-errorBorder)" : notification.severity === "warning" ? "var(--vscode-inputValidation-warningBorder)" : "var(--vscode-inputValidation-infoBorder)"}`,
			}}
		>
			<div className="flex items-start gap-3">
				{/* Icon */}
				<div
					className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
					style={{ backgroundColor: SEVERITY_BG[notification.severity] }}
				>
					<i
						className={`codicon codicon-${NOTIFICATION_TYPE_ICONS[notification.type]}`}
						style={{
							color: SEVERITY_COLORS[notification.severity],
							fontSize: "14px",
						}}
					/>
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span
							className="text-xs font-medium"
							style={{ color: SEVERITY_COLORS[notification.severity] }}
						>
							{notification.title}
						</span>
						{!notification.isRead && (
							<span
								className="w-2 h-2 rounded-full"
								style={{ backgroundColor: "var(--vscode-button-background)" }}
								title="Unread"
							/>
						)}
					</div>
					<p
						className="text-sm cursor-pointer hover:underline"
						style={{ color: "var(--vscode-foreground)" }}
						onClick={onClickEvent}
					>
						{notification.message}
					</p>
					<span className="text-xs" style={textMutedStyle}>
						{formatTimelineDate(notification.createdAt)}
					</span>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-1 shrink-0">
					{!notification.isRead && (
						<button
							onClick={onMarkRead}
							className="p-1.5 rounded transition-colors hover:bg-white/10"
							title="Mark as read"
						>
							<i className="codicon codicon-check" style={textMutedStyle} />
						</button>
					)}
					<button
						onClick={() => setShowSnoozeOptions(!showSnoozeOptions)}
						className="p-1.5 rounded transition-colors hover:bg-white/10"
						title="Snooze"
					>
						<i className="codicon codicon-clock" style={textMutedStyle} />
					</button>
					<button
						onClick={onDismiss}
						className="p-1.5 rounded transition-colors hover:bg-white/10"
						title="Dismiss"
					>
						<i className="codicon codicon-close" style={textMutedStyle} />
					</button>
				</div>
			</div>

			{/* Snooze Options */}
			{showSnoozeOptions && (
				<div
					className="flex items-center gap-2 mt-2 pt-2"
					style={{ borderTop: "1px solid var(--vscode-panel-border)" }}
				>
					<span className="text-xs" style={textMutedStyle}>
						Snooze for:
					</span>
					{[1, 3, 7].map((days) => (
						<button
							key={days}
							onClick={() => {
								onSnooze(days);
								setShowSnoozeOptions(false);
							}}
							className="px-2 py-0.5 rounded text-xs transition-colors"
							style={buttonSecondaryStyle}
						>
							{days}d
						</button>
					))}
				</div>
			)}
		</div>
	);
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
	onEditEvent,
}) => {
	const accessor = useAccessor();
	const timelineService = accessor.get("ITimelineService");

	const [isOpen, setIsOpen] = useState(false);
	const [notifications, setNotifications] = useState<TimelineNotification[]>(
		[],
	);
	const [unreadCount, setUnreadCount] = useState(0);
	const [dropdownPosition, setDropdownPosition] = useState<{
		top: number;
		left?: number;
		right?: number;
	}>({ top: 0, right: 0 });
	const buttonRef = useRef<HTMLButtonElement>(null);

	const DROPDOWN_WIDTH = 320; // w-80 = 20rem = 320px

	// Load notifications
	useEffect(() => {
		const loadNotifications = () => {
			const notifs = timelineService.getNotifications();
			setNotifications(notifs);
			setUnreadCount(timelineService.getUnreadCount());
		};

		loadNotifications();

		// Subscribe to notification changes
		const disposable = timelineService.onDidChangeNotifications(() => {
			loadNotifications();
		});

		return () => disposable.dispose();
	}, [timelineService]);

	const handleMarkRead = useCallback(
		async (id: string) => {
			await timelineService.markAsRead(id);
		},
		[timelineService],
	);

	const handleMarkAllRead = useCallback(async () => {
		await timelineService.markAllAsRead();
	}, [timelineService]);

	const handleDismiss = useCallback(
		async (id: string) => {
			await timelineService.dismissNotification(id);
		},
		[timelineService],
	);

	const handleSnooze = useCallback(
		async (id: string, days: number) => {
			await timelineService.snoozeNotification(id, days);
		},
		[timelineService],
	);

	const handleClickEvent = useCallback(
		(notification: TimelineNotification) => {
			if (notification.eventId && onEditEvent) {
				const timeline = timelineService.getTimeline();
				const event = timeline?.events.find(
					(e) => e.id === notification.eventId,
				);
				if (event) {
					onEditEvent(event);
					setIsOpen(false);
				}
			}
		},
		[timelineService, onEditEvent],
	);

	// Calculate dropdown position when opening, respecting panel boundaries
	const calculatePosition = useCallback(() => {
		if (!buttonRef.current) return { top: 0, right: 0 };

		const rect = buttonRef.current.getBoundingClientRect();
		const top = rect.bottom + 8; // 8px gap below button

		// Find the content panel's left boundary by walking up to find a container
		// that has a left edge > 0 (meaning there's a panel to its left)
		let leftBoundary = 0;
		let rightBoundary = window.innerWidth;

		// Walk up DOM to find the content container (the panel our button is in)
		let container: HTMLElement | null = buttonRef.current.parentElement;
		while (container && container !== document.body) {
			const containerRect = container.getBoundingClientRect();

			// Check if this container has significant left offset (panel to its left)
			// and is narrower than the viewport (not the full window)
			if (
				containerRect.left > 50 &&
				containerRect.width < window.innerWidth - 100
			) {
				leftBoundary = containerRect.left;
				rightBoundary = containerRect.right;
				break;
			}

			// Check for flex-row parent with multiple children (split panel layout)
			const style = window.getComputedStyle(container);
			if (style.display === "flex" && style.flexDirection === "row") {
				// Check if there are sibling panels
				const children = Array.from(container.children) as HTMLElement[];
				if (children.length > 1) {
					// Find which child contains our button
					for (let i = 0; i < children.length; i++) {
						if (children[i].contains(buttonRef.current)) {
							// This child is our content panel - use its boundaries
							const childRect = children[i].getBoundingClientRect();
							leftBoundary = childRect.left;
							rightBoundary = childRect.right;
							break;
						}
					}
					if (leftBoundary > 0) break;
				}
			}

			container = container.parentElement;
		}

		// Calculate if dropdown would overflow the boundaries
		// When right-aligned (right edge at button's right edge), left edge is:
		const dropdownLeftEdge = rect.right - DROPDOWN_WIDTH;
		const wouldOverflowLeft = dropdownLeftEdge < leftBoundary + 8; // 8px margin

		// When left-aligned (left edge at button's left edge), right edge is:
		const dropdownRightEdge = rect.left + DROPDOWN_WIDTH;
		const wouldOverflowRight = dropdownRightEdge > rightBoundary - 8;

		// Debug: Log the values to help troubleshoot
		console.log("[NotificationCenter] Position calc:", {
			buttonLeft: rect.left,
			buttonRight: rect.right,
			leftBoundary,
			rightBoundary,
			dropdownWidth: DROPDOWN_WIDTH,
			dropdownLeftEdge,
			dropdownRightEdge,
			wouldOverflowLeft,
			wouldOverflowRight,
		});

		if (!wouldOverflowLeft) {
			// Default: Position dropdown with right edge aligned to button's right edge
			// (dropdown extends to the left from the button)
			return {
				top,
				right: window.innerWidth - rect.right,
				left: undefined,
			};
		} else if (!wouldOverflowRight) {
			// Not enough space on left, flip to left-aligned
			// (dropdown extends to the right from the button)
			return {
				top,
				left: rect.left,
				right: undefined,
			};
		} else {
			// No space on either side, align within container bounds
			// Prefer right-aligned within the container
			return {
				top,
				right: window.innerWidth - rightBoundary + 8,
				left: undefined,
			};
		}
	}, []);

	const handleToggle = useCallback(() => {
		if (!isOpen) {
			setDropdownPosition(calculatePosition());
		}
		setIsOpen(!isOpen);
	}, [isOpen, calculatePosition]);

	// Update position on scroll/resize when open
	useEffect(() => {
		if (!isOpen || !buttonRef.current) return;

		const updatePosition = () => {
			setDropdownPosition(calculatePosition());
		};

		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);

		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [isOpen, calculatePosition]);

	// Close dropdown when clicking outside
	useEffect(() => {
		if (!isOpen) return;

		const handleClickOutside = (e: MouseEvent) => {
			if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
				const dropdown = document.getElementById("notification-dropdown");
				if (dropdown && !dropdown.contains(e.target as Node)) {
					setIsOpen(false);
				}
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	return (
		<>
			{/* Notifications Button */}
			<button
				ref={buttonRef}
				onClick={handleToggle}
				className="relative text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
				style={buttonSecondaryStyle}
				title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
			>
				<span>Alerts</span>
				{/* Unread Badge */}
				{unreadCount > 0 && (
					<span
						className="min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-xs font-bold"
						style={{
							backgroundColor: "var(--vscode-errorForeground)",
							color: "white",
						}}
					>
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
				)}
			</button>

			{/* Dropdown - Fixed position to stay visible above all panels */}
			{isOpen && (
				<div
					id="notification-dropdown"
					className="fixed w-80 max-h-96 overflow-y-auto rounded-lg shadow-xl void-scrollbar"
					style={{
						backgroundColor: "var(--vscode-sideBar-background)",
						border: "1px solid var(--vscode-panel-border)",
						top: dropdownPosition.top,
						// Use either left or right positioning based on available space
						...(dropdownPosition.left !== undefined
							? { left: dropdownPosition.left }
							: { right: dropdownPosition.right }),
						zIndex: 10000, // High z-index to appear above VSCode panels
					}}
				>
					{/* Header */}
					<div
						className="flex items-center justify-between p-3 sticky top-0"
						style={{
							backgroundColor: "var(--vscode-sideBar-background)",
							borderBottom: "1px solid var(--vscode-panel-border)",
						}}
					>
						<div className="flex items-center gap-2">
							<i
								className="codicon codicon-bell"
								style={{
									color: "var(--vscode-button-background)",
									fontSize: "16px",
								}}
							/>
							<span
								className="font-semibold"
								style={{ color: "var(--vscode-editor-foreground)" }}
							>
								Notifications
							</span>
							{unreadCount > 0 && (
								<span
									className="px-1.5 py-0.5 rounded text-xs font-medium"
									style={{
										backgroundColor: "var(--vscode-button-secondaryBackground)",
										color: "var(--vscode-button-background)",
									}}
								>
									{unreadCount} new
								</span>
							)}
						</div>
						{unreadCount > 0 && (
							<button
								onClick={handleMarkAllRead}
								className="text-xs px-2 py-1 rounded transition-colors"
								style={{ color: "var(--vscode-button-background)" }}
							>
								Mark all read
							</button>
						)}
					</div>

					{/* Notifications List */}
					<div className="p-3">
						{notifications.length === 0 ? (
							<div className="text-center py-8">
								<i
									className="codicon codicon-bell-slash"
									style={{
										color: "var(--vscode-disabledForeground)",
										fontSize: "32px",
									}}
								/>
								<p className="mt-2 text-sm" style={textMutedStyle}>
									No notifications
								</p>
							</div>
						) : (
							notifications.map((notification) => (
								<NotificationItem
									key={notification.id}
									notification={notification}
									onMarkRead={() => handleMarkRead(notification.id)}
									onDismiss={() => handleDismiss(notification.id)}
									onSnooze={(days) => handleSnooze(notification.id, days)}
									onClickEvent={() => handleClickEvent(notification)}
								/>
							))
						)}
					</div>
				</div>
			)}
		</>
	);
};
