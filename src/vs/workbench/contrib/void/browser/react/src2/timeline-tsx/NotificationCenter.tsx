/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  NOTIFICATION_TYPE_ICONS,
  TimelineEvent,
  TimelineNotification,
  formatTimelineDate } from
"../../../../common/timeline/timelineTypes.js";
import { useAccessor } from "../util/services.js";

// Reusable style objects with VSCode CSS variables
const buttonSecondaryStyle: React.CSSProperties = {
  backgroundColor: "var(--vscode-button-secondaryBackground)",
  color: "var(--vscode-button-secondaryForeground)",
  border: "1px solid var(--vscode-panel-border)",
  borderRadius: "8px"
};

const textMutedStyle: React.CSSProperties = {
  color: "var(--vscode-descriptionForeground)"
};

// Severity-specific VSCode colors
const SEVERITY_COLORS = {
  error: "var(--vscode-errorForeground)",
  warning: "var(--vscode-editorWarning-foreground)",
  info: "var(--vscode-editorInfo-foreground)"
};

const SEVERITY_BG = {
  error: "var(--vscode-inputValidation-errorBackground)",
  warning: "var(--vscode-inputValidation-warningBackground)",
  info: "var(--vscode-inputValidation-infoBackground)"
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
  onClickEvent
}) => {
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);

  return (
    <div
      className={`void-p-3 void-rounded-lg void-mb-2 void-transition-all ${notification.isRead ? "void-opacity-60" : ""}`}
      style={{
        backgroundColor: SEVERITY_BG[notification.severity],
        border: `1px solid ${notification.severity === "error" ? "var(--vscode-inputValidation-errorBorder)" : notification.severity === "warning" ? "var(--vscode-inputValidation-warningBorder)" : "var(--vscode-inputValidation-infoBorder)"}`
      }}>
      
			<div className="void-flex void-items-start void-gap-3">
				{/* Icon */}
				<div
          className="void-w-8 void-h-8 void-rounded-full void-flex void-items-center void-justify-center void-shrink-0"
          style={{ backgroundColor: SEVERITY_BG[notification.severity] }}>
          
					<i
            className={`void-codicon void-codicon-${NOTIFICATION_TYPE_ICONS[notification.type]}`}
            style={{
              color: SEVERITY_COLORS[notification.severity],
              fontSize: "14px"
            }} />
          
				</div>

				{/* Content */}
				<div className="void-flex-1 void-min-w-0">
					<div className="void-flex void-items-center void-gap-2 void-mb-1">
						<span
              className="void-text-xs void-font-medium"
              style={{ color: SEVERITY_COLORS[notification.severity] }}>
              
							{notification.title}
						</span>
						{!notification.isRead &&
            <span
              className="void-w-2 void-h-2 void-rounded-full"
              style={{ backgroundColor: "var(--vscode-button-background)" }}
              title="Unread" />

            }
					</div>
					<p
            className="void-text-sm void-cursor-pointer hover:void-underline"
            style={{ color: "var(--vscode-foreground)" }}
            onClick={onClickEvent}>
            
						{notification.message}
					</p>
					<span className="void-text-xs" style={textMutedStyle}>
						{formatTimelineDate(notification.createdAt)}
					</span>
				</div>

				{/* Actions */}
				<div className="void-flex void-items-center void-gap-1 void-shrink-0">
					{!notification.isRead &&
          <button
            onClick={onMarkRead}
            className="void-p-1.5 void-rounded void-transition-colors hover:void-bg-white/10"
            title="Mark as read">
            
							<i className="void-codicon void-codicon-check" style={textMutedStyle} />
						</button>
          }
					<button
            onClick={() => setShowSnoozeOptions(!showSnoozeOptions)}
            className="void-p-1.5 void-rounded void-transition-colors hover:void-bg-white/10"
            title="Snooze">
            
						<i className="void-codicon void-codicon-clock" style={textMutedStyle} />
					</button>
					<button
            onClick={onDismiss}
            className="void-p-1.5 void-rounded void-transition-colors hover:void-bg-white/10"
            title="Dismiss">
            
						<i className="void-codicon void-codicon-close" style={textMutedStyle} />
					</button>
				</div>
			</div>

			{/* Snooze Options */}
			{showSnoozeOptions &&
      <div
        className="void-flex void-items-center void-gap-2 void-mt-2 void-pt-2"
        style={{ borderTop: "1px solid var(--vscode-panel-border)" }}>
        
					<span className="void-text-xs" style={textMutedStyle}>
						Snooze for:
					</span>
					{[1, 3, 7].map((days) =>
        <button
          key={days}
          onClick={() => {
            onSnooze(days);
            setShowSnoozeOptions(false);
          }}
          className="void-px-2 void-py-0.5 void-rounded void-text-xs void-transition-colors"
          style={buttonSecondaryStyle}>
          
							{days}d
						</button>
        )}
				</div>
      }
		</div>);

};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  onEditEvent
}) => {
  const accessor = useAccessor();
  const timelineService = accessor.get("ITimelineService");

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<TimelineNotification[]>(
    []
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
    [timelineService]
  );

  const handleMarkAllRead = useCallback(async () => {
    await timelineService.markAllAsRead();
  }, [timelineService]);

  const handleDismiss = useCallback(
    async (id: string) => {
      await timelineService.dismissNotification(id);
    },
    [timelineService]
  );

  const handleSnooze = useCallback(
    async (id: string, days: number) => {
      await timelineService.snoozeNotification(id, days);
    },
    [timelineService]
  );

  const handleClickEvent = useCallback(
    (notification: TimelineNotification) => {
      if (notification.eventId && onEditEvent) {
        const timeline = timelineService.getTimeline();
        const event = timeline?.events.find(
          (e) => e.id === notification.eventId
        );
        if (event) {
          onEditEvent(event);
          setIsOpen(false);
        }
      }
    },
    [timelineService, onEditEvent]
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
      containerRect.width < window.innerWidth - 100)
      {
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
      wouldOverflowRight
    });

    if (!wouldOverflowLeft) {
      // Default: Position dropdown with right edge aligned to button's right edge
      // (dropdown extends to the left from the button)
      return {
        top,
        right: window.innerWidth - rect.right,
        left: undefined
      };
    } else if (!wouldOverflowRight) {
      // Not enough space on left, flip to left-aligned
      // (dropdown extends to the right from the button)
      return {
        top,
        left: rect.left,
        right: undefined
      };
    } else {
      // No space on either side, align within container bounds
      // Prefer right-aligned within the container
      return {
        top,
        right: window.innerWidth - rightBoundary + 8,
        left: undefined
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
        className="void-relative void-text-xs void-px-3 void-py-1.5 void-rounded-lg void-transition-colors void-flex void-items-center void-gap-2 void-cursor-pointer"
        style={buttonSecondaryStyle}
        title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}>
        
				<span>Alerts</span>
				{/* Unread Badge */}
				{unreadCount > 0 &&
        <span
          className="void-min-w-[18px] void-h-[18px] void-rounded-full void-flex void-items-center void-justify-center void-text-xs void-font-bold"
          style={{
            backgroundColor: "var(--vscode-errorForeground)",
            color: "white"
          }}>
          
						{unreadCount > 9 ? "9+" : unreadCount}
					</span>
        }
			</button>

			{/* Dropdown - Fixed position to stay visible above all panels */}
			{isOpen &&
      <div
        id="notification-dropdown"
        className="void-fixed void-w-80 void-max-h-96 void-overflow-y-auto void-rounded-lg void-shadow-xl void-void-scrollbar"
        style={{
          backgroundColor: "var(--vscode-sideBar-background)",
          border: "1px solid var(--vscode-panel-border)",
          top: dropdownPosition.top,
          // Use either left or right positioning based on available space
          ...(dropdownPosition.left !== undefined ?
          { left: dropdownPosition.left } :
          { right: dropdownPosition.right }),
          zIndex: 10000 // High z-index to appear above VSCode panels
        }}>
        
					{/* Header */}
					<div
          className="void-flex void-items-center void-justify-between void-p-3 void-sticky void-top-0"
          style={{
            backgroundColor: "var(--vscode-sideBar-background)",
            borderBottom: "1px solid var(--vscode-panel-border)"
          }}>
          
						<div className="void-flex void-items-center void-gap-2">
							<i
              className="void-codicon void-codicon-bell"
              style={{
                color: "var(--vscode-button-background)",
                fontSize: "16px"
              }} />
            
							<span
              className="void-font-semibold"
              style={{ color: "var(--vscode-editor-foreground)" }}>
              
								Notifications
							</span>
							{unreadCount > 0 &&
            <span
              className="void-px-1.5 void-py-0.5 void-rounded void-text-xs void-font-medium"
              style={{
                backgroundColor: "var(--vscode-button-secondaryBackground)",
                color: "var(--vscode-button-background)"
              }}>
              
									{unreadCount} new
								</span>
            }
						</div>
						{unreadCount > 0 &&
          <button
            onClick={handleMarkAllRead}
            className="void-text-xs void-px-2 void-py-1 void-rounded void-transition-colors"
            style={{ color: "var(--vscode-button-background)" }}>
            
								Mark all read
							</button>
          }
					</div>

					{/* Notifications List */}
					<div className="void-p-3">
						{notifications.length === 0 ?
          <div className="void-text-center void-py-8">
								<i
              className="void-codicon void-codicon-bell-slash"
              style={{
                color: "var(--vscode-disabledForeground)",
                fontSize: "32px"
              }} />
            
								<p className="void-mt-2 void-text-sm" style={textMutedStyle}>
									No notifications
								</p>
							</div> :

          notifications.map((notification) =>
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkRead={() => handleMarkRead(notification.id)}
            onDismiss={() => handleDismiss(notification.id)}
            onSnooze={(days) => handleSnooze(notification.id, days)}
            onClickEvent={() => handleClickEvent(notification)} />

          )
          }
					</div>
				</div>
      }
		</>);

};