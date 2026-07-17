/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { EmailCard } from './EmailCard.js';
import { Email } from '../../../../common/emailService.js';

// ============================================================================
// REUSABLE STYLES - VSCode Theme Variables
// ============================================================================

const threadContainerStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-input-background)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '12px'
};

const threadHeaderStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-sideBar-background)',
  borderBottom: '1px solid var(--vscode-panel-border)'
};

const textPrimaryStyle: React.CSSProperties = {
  color: 'var(--vscode-editor-foreground)'
};

const textSecondaryStyle: React.CSSProperties = {
  color: 'var(--vscode-descriptionForeground)'
};

export interface EmailThread {
  threadId: string;
  subject: string;
  emails: Email[];
  latestEmail: Email;
  participantCount: number;
  emailCount: number;
  hasUnread: boolean;
  latestDate: Date;
  status: 'needs-reply' | 'awaiting-response' | 'resolved' | 'active';
}

interface EmailThreadProps {
  thread: EmailThread;
  onEmailClick?: (email: Email) => void;
  onThreadCollapse?: (threadId: string, collapsed: boolean) => void;
  onDeleteEmail?: (emailId: string) => void;
  onDraftReply?: (email: Email) => Promise<string>;
  onToggleStar?: (emailId: string) => Promise<boolean>;
  onSetReminder?: (emailId: string, date: Date | null) => Promise<void>;
  onUpdateThreadStatus?: (threadId: string, status: 'needs-reply' | 'awaiting-response' | 'resolved' | 'active') => Promise<void>;
}

// Format date for display
function formatEmailDate(date: Date): string {
  const now = new Date();
  const emailDate = new Date(date);

  // Check if same day
  if (emailDate.toDateString() === now.toDateString()) {
    return emailDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Check if within last week
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (emailDate > weekAgo) {
    return emailDate.toLocaleDateString([], { weekday: 'short' });
  }

  // Otherwise, show full date
  return emailDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// Get initials from email address
function getInitials(email: string): string {
  const name = email.split('@')[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Get a consistent color for an email address
function getAvatarColor(email: string): string {
  const colors = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f43f5e'];

  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i);
    hash = hash & hash;
  }
  return colors[Math.abs(hash) % colors.length];
}

// Get status badge config
function getStatusBadge(status: 'needs-reply' | 'awaiting-response' | 'resolved' | 'active') {
  switch (status) {
    case 'needs-reply':
      return {
        icon: 'codicon-reply',
        label: 'Needs Reply',
        color: '#ef4444', // Red
        bgColor: 'rgba(239, 68, 68, 0.1)'
      };
    case 'awaiting-response':
      return {
        icon: 'codicon-clock',
        label: 'Awaiting Response',
        color: '#f59e0b', // Yellow/Orange
        bgColor: 'rgba(245, 158, 11, 0.1)'
      };
    case 'resolved':
      return {
        icon: 'codicon-check',
        label: 'Resolved',
        color: '#22c55e', // Green
        bgColor: 'rgba(34, 197, 94, 0.1)'
      };
    case 'active':
      return {
        icon: 'codicon-circle-filled',
        label: 'Active',
        color: '#3b82f6', // Blue
        bgColor: 'rgba(59, 130, 246, 0.1)'
      };
  }
}

export const EmailThread: React.FC<EmailThreadProps> = ({
  thread,
  onEmailClick,
  onThreadCollapse,
  onDeleteEmail,
  onDraftReply,
  onToggleStar,
  onSetReminder,
  onUpdateThreadStatus
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const handleToggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onThreadCollapse?.(thread.threadId, newCollapsed);
  };

  const handleStatusChange = async (newStatus: 'needs-reply' | 'awaiting-response' | 'resolved' | 'active') => {
    if (onUpdateThreadStatus) {
      await onUpdateThreadStatus(thread.threadId, newStatus);
    }
    setShowStatusMenu(false);
  };

  // Get unique participants (remove duplicates)
  const uniqueParticipants = Array.from(
    new Set(thread.emails.map((e) => e.from))
  ).slice(0, 3); // Show max 3 participant avatars

  const statusBadge = getStatusBadge(thread.status);

  return (
    <div style={threadContainerStyle} className="void-overflow-hidden">
			{/* Thread Header - Clickable to expand/collapse */}
			<div
        onClick={handleToggleCollapse}
        className="void-cursor-pointer void-transition-all hover:void-bg-opacity-90"
        style={threadHeaderStyle}>
        
				<div className="void-p-4 void-flex void-items-center void-gap-4">
					{/* Expand/Collapse Icon */}
					<button
            className="void-flex-shrink-0 void-flex void-items-center void-justify-center void-transition-transform"
            style={{
              transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px'
            }}>
            
						<i
              className="void-codicon void-codicon-chevron-right"
              style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '16px' }} />
            
					</button>

					{/* Participant Avatars */}
					<div className="void-flex -void-space-x-2 void-flex-shrink-0">
						{uniqueParticipants.map((participant, idx) => {
              const avatarColor = getAvatarColor(participant);
              const initials = getInitials(participant);
              return (
                <div
                  key={idx}
                  className="void-w-8 void-h-8 void-rounded-full void-flex void-items-center void-justify-center void-text-xs void-font-semibold void-border-2"
                  style={{
                    backgroundColor: avatarColor,
                    color: 'var(--vscode-button-foreground)',
                    borderColor: 'var(--vscode-sideBar-background)',
                    zIndex: 10 - idx
                  }}
                  title={participant}>
                  
									{initials}
								</div>);

            })}
					</div>

					{/* Thread Info */}
					<div className="void-flex-1 void-min-w-0">
						<div className="void-flex void-items-center void-gap-2 void-mb-1">
							{/* Status Badge */}
							<div className="void-relative">
								<button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStatusMenu(!showStatusMenu);
                  }}
                  className="void-inline-flex void-items-center void-gap-1 void-rounded-full void-px-2 void-py-0.5 void-text-xs void-font-semibold void-transition-opacity hover:void-opacity-80"
                  style={{
                    backgroundColor: statusBadge.bgColor,
                    color: statusBadge.color,
                    border: `1px solid ${statusBadge.color}`
                  }}
                  title="Change thread status">
                  
									<i className={`void-codicon ${statusBadge.icon}`} style={{ fontSize: '11px' }} />
									{statusBadge.label}
								</button>
								{/* Status dropdown menu */}
								{showStatusMenu &&
                <div
                  className="void-absolute void-top-full void-left-0 void-mt-1 void-rounded void-shadow-lg void-z-50 void-overflow-hidden"
                  style={{
                    backgroundColor: 'var(--vscode-dropdown-background)',
                    border: '1px solid var(--vscode-dropdown-border)',
                    minWidth: '180px'
                  }}
                  onClick={(e) => e.stopPropagation()}>
                  
										{(['needs-reply', 'awaiting-response', 'resolved', 'active'] as const).map((status) => {
                    const badge = getStatusBadge(status);
                    return (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className="void-w-full void-flex void-items-center void-gap-2 void-px-3 void-py-2 void-text-sm void-transition-colors hover:void-bg-opacity-80"
                        style={{
                          backgroundColor: thread.status === status ?
                          'var(--vscode-list-activeSelectionBackground)' :
                          'transparent',
                          color: 'var(--vscode-dropdown-foreground)'
                        }}>
                        
													<i className={`void-codicon ${badge.icon}`} style={{ color: badge.color, fontSize: '14px' }} />
													<span>{badge.label}</span>
													{thread.status === status &&
                        <i className="void-codicon void-codicon-check void-ml-auto" style={{ fontSize: '12px' }} />
                        }
												</button>);

                  })}
									</div>
                }
							</div>
							<h3 className="void-font-semibold void-text-sm void-truncate" style={textPrimaryStyle}>
								{thread.subject}
							</h3>
							{/* Email Count Badge */}
							<span
                className="void-inline-flex void-items-center void-rounded-full void-px-2 void-py-0.5 void-text-xs void-font-semibold"
                style={{
                  backgroundColor: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)'
                }}>
                
								{thread.emailCount}
							</span>
						</div>
						<div className="void-flex void-items-center void-gap-3 void-text-xs" style={textSecondaryStyle}>
							<span className="void-flex void-items-center void-gap-1">
								<i className="void-codicon void-codicon-person" style={{ fontSize: '12px' }} />
								{thread.participantCount} participant{thread.participantCount !== 1 ? 's' : ''}
							</span>
							<span className="void-flex void-items-center void-gap-1">
								<i className="void-codicon void-codicon-mail" style={{ fontSize: '12px' }} />
								{thread.emailCount} email{thread.emailCount !== 1 ? 's' : ''}
							</span>
							<span className="void-flex void-items-center void-gap-1">
								<i className="void-codicon void-codicon-clock" style={{ fontSize: '12px' }} />
								Latest: {formatEmailDate(thread.latestDate)}
							</span>
						</div>
					</div>

					{/* Collapse/Expand Text */}
					<span className="void-text-xs void-flex-shrink-0" style={textSecondaryStyle}>
						{isCollapsed ? 'Click to expand' : 'Click to collapse'}
					</span>
				</div>
			</div>

			{/* Thread Body - Emails */}
			{!isCollapsed &&
      <div className="void-p-2">
					{thread.emails.map((email, index) => {
          const isLatest = email.id === thread.latestEmail.id;
          return (
            <div
              key={email.id}
              className="void-relative"
              style={{
                marginLeft: '24px', // Indentation for thread chain
                paddingTop: index === 0 ? '0' : '8px'
              }}>
              
								{/* Visual connector line */}
								{index > 0 &&
              <div
                style={{
                  position: 'absolute',
                  left: '-12px',
                  top: '-4px',
                  width: '1px',
                  height: 'calc(100% + 4px)',
                  backgroundColor: 'var(--vscode-panel-border)'
                }} />

              }
								{/* Connector dot */}
								<div
                style={{
                  position: 'absolute',
                  left: '-16px',
                  top: '20px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isLatest ?
                  'var(--vscode-button-background)' :
                  'var(--vscode-descriptionForeground)',
                  border: '2px solid var(--vscode-input-background)'
                }} />
              
								{/* Email Card with highlight for latest */}
								<div
                style={{
                  opacity: isLatest ? 1 : 0.85,
                  position: 'relative'
                }}>
                
									{isLatest &&
                <div
                  className="void-absolute -void-left-1 void-top-0 void-bottom-0 void-w-1 void-rounded"
                  style={{
                    backgroundColor: 'var(--vscode-button-background)'
                  }} />

                }
									<EmailCard
                  email={email}
                  viewMode="compact"
                  onClick={() => onEmailClick?.(email)}
                  onDelete={() => onDeleteEmail?.(email.id)}
                  onDraftReply={async () => {
                    if (onDraftReply) {
                      return await onDraftReply(email);
                    }
                    return '';
                  }}
                  onToggleStar={async () => {
                    if (onToggleStar) {
                      return await onToggleStar(email.id);
                    }
                    return email.isStarred ?? false;
                  }}
                  onSetReminder={async (date) => {
                    if (onSetReminder) {
                      await onSetReminder(email.id, date);
                    }
                  }} />
                
								</div>
							</div>);

        })}
				</div>
      }
		</div>);

};