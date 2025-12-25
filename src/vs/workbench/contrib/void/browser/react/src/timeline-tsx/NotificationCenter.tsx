/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useCallback } from 'react';
import { useAccessor } from '../util/services.js';
import {
  TimelineNotification,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_ICONS,
  TimelineEvent,
  formatTimelineDate
} from '../../../../common/timeline/timelineTypes.js';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

const SEVERITY_COLORS = {
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6'
};

const SEVERITY_BG = {
  error: '#7f1d1d',
  warning: '#78350f',
  info: '#1e3a5a'
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
      className={`p-3 rounded-lg mb-2 transition-all ${notification.isRead ? 'opacity-60' : ''}`}
      style={{
        backgroundColor: `${SEVERITY_BG[notification.severity]}40`,
        border: `1px solid ${SEVERITY_COLORS[notification.severity]}40`
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${SEVERITY_COLORS[notification.severity]}20` }}
        >
          <i
            className={`codicon codicon-${NOTIFICATION_TYPE_ICONS[notification.type]}`}
            style={{ color: SEVERITY_COLORS[notification.severity], fontSize: '14px' }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium" style={{ color: SEVERITY_COLORS[notification.severity] }}>
              {notification.title}
            </span>
            {!notification.isRead && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: BRAND_GREEN }}
                title="Unread"
              />
            )}
          </div>
          <p
            className="text-sm cursor-pointer hover:underline"
            style={{ color: '#e4e4e7' }}
            onClick={onClickEvent}
          >
            {notification.message}
          </p>
          <span className="text-xs" style={{ color: '#71717a' }}>
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
              <i className="codicon codicon-check" style={{ color: '#71717a', fontSize: '12px' }} />
            </button>
          )}
          <button
            onClick={() => setShowSnoozeOptions(!showSnoozeOptions)}
            className="p-1.5 rounded transition-colors hover:bg-white/10"
            title="Snooze"
          >
            <i className="codicon codicon-clock" style={{ color: '#71717a', fontSize: '12px' }} />
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded transition-colors hover:bg-white/10"
            title="Dismiss"
          >
            <i className="codicon codicon-close" style={{ color: '#71717a', fontSize: '12px' }} />
          </button>
        </div>
      </div>

      {/* Snooze Options */}
      {showSnoozeOptions && (
        <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid #27272a' }}>
          <span className="text-xs" style={{ color: '#71717a' }}>Snooze for:</span>
          {[1, 3, 7].map(days => (
            <button
              key={days}
              onClick={() => {
                onSnooze(days);
                setShowSnoozeOptions(false);
              }}
              className="px-2 py-0.5 rounded text-xs transition-colors"
              style={{ backgroundColor: '#27272a', color: '#a1a1aa' }}
            >
              {days}d
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ onEditEvent }) => {
  const accessor = useAccessor();
  const timelineService = accessor.get('ITimelineService');

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<TimelineNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

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

  const handleMarkRead = useCallback(async (id: string) => {
    await timelineService.markAsRead(id);
  }, [timelineService]);

  const handleMarkAllRead = useCallback(async () => {
    await timelineService.markAllAsRead();
  }, [timelineService]);

  const handleDismiss = useCallback(async (id: string) => {
    await timelineService.dismissNotification(id);
  }, [timelineService]);

  const handleSnooze = useCallback(async (id: string, days: number) => {
    await timelineService.snoozeNotification(id, days);
  }, [timelineService]);

  const handleClickEvent = useCallback((notification: TimelineNotification) => {
    if (notification.eventId && onEditEvent) {
      const timeline = timelineService.getTimeline();
      const event = timeline?.events.find(e => e.id === notification.eventId);
      if (event) {
        onEditEvent(event);
        setIsOpen(false);
      }
    }
  }, [timelineService, onEditEvent]);

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg transition-colors flex items-center justify-center"
        style={{
          backgroundColor: isOpen ? `${BRAND_GREEN}20` : '#1a1a1a',
          border: isOpen ? `1px solid ${BRAND_GREEN}40` : '1px solid #27272a',
          minWidth: '36px',
          minHeight: '36px'
        }}
        title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        {/* Bell SVG Icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke={unreadCount > 0 ? BRAND_GREEN : '#71717a'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 14c1.1 0 2-.9 2-2H6c0 1.1.9 2 2 2z" />
          <path d="M12 7c0-2.2-1.8-4-4-4S4 4.8 4 7c0 3-1.5 4.5-2 5h12c-.5-.5-2-2-2-5z" />
        </svg>
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: '#ef4444', color: 'white' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-lg shadow-xl z-50"
          style={{
            backgroundColor: '#0f0f0f',
            border: '1px solid #27272a'
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-3 sticky top-0"
            style={{ backgroundColor: '#0f0f0f', borderBottom: '1px solid #27272a' }}
          >
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={BRAND_GREEN} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 14c1.1 0 2-.9 2-2H6c0 1.1.9 2 2 2z" />
                <path d="M12 7c0-2.2-1.8-4-4-4S4 4.8 4 7c0 3-1.5 4.5-2 5h12c-.5-.5-2-2-2-5z" />
              </svg>
              <span className="font-semibold" style={{ color: '#fafafa' }}>Notifications</span>
              {unreadCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded text-xs font-medium"
                  style={{ backgroundColor: `${BRAND_GREEN}20`, color: BRAND_GREEN }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ color: BRAND_GREEN }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="p-3">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="#52525b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                  <path d="M8 14c1.1 0 2-.9 2-2H6c0 1.1.9 2 2 2z" />
                  <path d="M12 7c0-2.2-1.8-4-4-4S4 4.8 4 7c0 3-1.5 4.5-2 5h12c-.5-.5-2-2-2-5z" />
                  <line x1="2" y1="2" x2="14" y2="14" />
                </svg>
                <p className="mt-2 text-sm" style={{ color: '#71717a' }}>
                  No notifications
                </p>
              </div>
            ) : (
              notifications.map(notification => (
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
    </div>
  );
};

