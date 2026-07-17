/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import { Email, EmailCategory, EmailPriority, DraftStatus } from '../../../../common/emailService.js';
import { useAccessor } from '../util/services.js';
import { ReminderPicker } from './ReminderPicker.js';
import { DraftEditor } from './DraftEditor.js';

// ============================================================================
// REUSABLE STYLES - VSCode Theme Variables
// ============================================================================

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-input-background)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '12px'
};

const cardHoverStyle: React.CSSProperties = {
  ...cardStyle,
  border: '1px solid var(--vscode-focusBorder)'
};

const buttonSecondaryStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-button-secondaryBackground)',
  border: '1px solid var(--vscode-panel-border)',
  color: 'var(--vscode-descriptionForeground)',
  borderRadius: '8px',
  cursor: 'pointer'
};

const textPrimaryStyle: React.CSSProperties = {
  color: 'var(--vscode-editor-foreground)'
};

const textSecondaryStyle: React.CSSProperties = {
  color: 'var(--vscode-descriptionForeground)'
};

type EmailViewMode = 'list' | 'compact';

interface EmailCardProps {
  email: Email;
  viewMode?: EmailViewMode;
  onClick: () => void;
  onDelete: () => void;
  onDraftReply: () => Promise<string>; // Returns generated content
  onToggleStar: () => Promise<boolean>;
  onSetReminder: (date: Date | null) => Promise<void>;
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

// Category badge configuration
interface CategoryConfig {
  icon: string;
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

function getCategoryConfig(category: EmailCategory | undefined): CategoryConfig | null {
  if (!category) return null;

  const configs: Record<EmailCategory, CategoryConfig> = {
    'deadline': {
      icon: '⚠️',
      label: 'Deadline',
      bgColor: 'var(--vscode-inputValidation-errorBackground)',
      textColor: 'var(--vscode-charts-red)',
      borderColor: 'var(--vscode-inputValidation-errorBorder)'
    },
    'info-request': {
      icon: '📋',
      label: 'Info Request',
      bgColor: 'var(--vscode-inputValidation-infoBackground)',
      textColor: 'var(--vscode-charts-blue)',
      borderColor: 'var(--vscode-inputValidation-infoBorder)'
    },
    'decision': {
      icon: '📜',
      label: 'Decision',
      bgColor: 'var(--vscode-inputValidation-warningBackground)',
      textColor: 'var(--vscode-charts-orange)',
      borderColor: 'var(--vscode-inputValidation-warningBorder)'
    },
    'scheduling': {
      icon: '📅',
      label: 'Scheduling',
      bgColor: 'var(--vscode-inputValidation-infoBackground)',
      textColor: 'var(--vscode-charts-purple)',
      borderColor: 'var(--vscode-inputValidation-infoBorder)'
    },
    'evidence': {
      icon: '📁',
      label: 'Evidence',
      bgColor: 'var(--vscode-inputValidation-infoBackground)',
      textColor: 'var(--vscode-charts-green)',
      borderColor: 'var(--vscode-inputValidation-infoBorder)'
    },
    'general': {
      icon: '💬',
      label: 'General',
      bgColor: 'var(--vscode-button-secondaryBackground)',
      textColor: 'var(--vscode-descriptionForeground)',
      borderColor: 'var(--vscode-panel-border)'
    }
  };

  return configs[category];
}

// Priority badge configuration
interface PriorityConfig {
  icon: string;
  label: string;
  color: string;
}

function getPriorityConfig(priority: EmailPriority | undefined): PriorityConfig | null {
  if (!priority) return null;

  const configs: Record<EmailPriority, PriorityConfig> = {
    'urgent': { icon: '🔴', label: 'Urgent', color: 'var(--vscode-charts-red)' },
    'normal': { icon: '🟡', label: 'Normal', color: 'var(--vscode-charts-yellow)' },
    'low': { icon: '🟢', label: 'Low', color: 'var(--vscode-charts-green)' }
  };

  return configs[priority];
}

// Get draft status icon/color for mini indicator
function getDraftStatusIndicator(status: DraftStatus | undefined): {icon: string;color: string;label: string;} | null {
  if (!status) return null;

  const indicators: Record<DraftStatus, {icon: string;color: string;label: string;}> = {
    'draft': { icon: '✏️', color: 'var(--vscode-descriptionForeground)', label: 'Draft' },
    'reviewed': { icon: '👀', color: 'var(--vscode-charts-blue)', label: 'Reviewed' },
    'ready': { icon: '✅', color: 'var(--vscode-charts-green)', label: 'Ready to Send' },
    'sent': { icon: '📤', color: 'var(--vscode-charts-purple)', label: 'Sent' }
  };

  return indicators[status];
}

export const EmailCard: React.FC<EmailCardProps> = ({ email, viewMode = 'list', onClick, onDelete, onDraftReply, onToggleStar, onSetReminder }) => {
  const accessor = useAccessor();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isAddingToTimeline, setIsAddingToTimeline] = useState(false);
  const [isStarred, setIsStarred] = useState(email.isStarred ?? false);
  const [isTogglingStarred, setIsTogglingStarred] = useState(false);
  const [reminderDate, setReminderDate] = useState<Date | undefined>(email.reminderDate);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showDraftEditor, setShowDraftEditor] = useState(false);
  const [draftContent, setDraftContent] = useState<string | undefined>(undefined);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [draftStatus, setDraftStatus] = useState<DraftStatus | undefined>(undefined);
  const isCompact = viewMode === 'compact';

  const handleAddToTimeline = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAddingToTimeline) return;
    setIsAddingToTimeline(true);
    try {
      const timelineService = accessor.get('ITimelineService');
      const notificationService = accessor.get('INotificationService');

      // Create a timeline event from the email
      const emailDate = new Date(email.date);
      const description = `Email from ${email.from}${email.bodyText ? `: ${email.bodyText.substring(0, 150)}...` : ''}`;

      await timelineService.addEvent({
        title: email.subject || 'Email',
        date: emailDate.toISOString(),
        description: description,
        category: 'correspondence',
        linkedDocuments: email.filePath ? [email.filePath] : [],
        isDeadline: false,
        tags: ['email']
      });

      notificationService.info('Email added to timeline');
    } catch (error) {
      console.error('Failed to add email to timeline:', error);
      try {
        const notificationService = accessor.get('INotificationService');
        notificationService.error(`Failed to add to timeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } catch {

        // Notification service unavailable
      }} finally {
      setIsAddingToTimeline(false);
    }
  }, [accessor, email, isAddingToTimeline]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleDraftReply = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDrafting) return;
    setIsDrafting(true);
    try {
      // Generate AI reply and get the content
      const generatedContent = await onDraftReply();

      // Open the inline DraftEditor with the generated content
      if (generatedContent) {
        setDraftContent(generatedContent);
        setShowDraftEditor(true);
      } else {
        // If no content returned, still open editor to load from service
        setShowDraftEditor(true);
        // Load from draft service
        try {
          const emailDraftService = accessor.get('IEmailDraftService');
          const draft = await emailDraftService.getDraft(email.id);
          if (draft) {
            setDraftContent(draft.content);
          }
        } catch (loadError) {
          console.error('[EmailCard] Failed to load draft after generation:', loadError);
        }
      }
    } finally {
      setIsDrafting(false);
    }
  };

  const handleToggleStar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTogglingStarred) return;

    // Optimistic update
    const previousState = isStarred;
    setIsStarred(!isStarred);
    setIsTogglingStarred(true);

    try {
      const newState = await onToggleStar();
      setIsStarred(newState);
    } catch {
      // Revert on error
      setIsStarred(previousState);
    } finally {
      setIsTogglingStarred(false);
    }
  };

  const handleReminderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowReminderPicker(true);
  };

  const handleSetReminder = async (date: Date | null) => {
    const previousDate = reminderDate;
    setReminderDate(date ?? undefined);

    try {
      await onSetReminder(date);
    } catch {
      // Revert on error
      setReminderDate(previousDate);
    }
  };

  const handleToggleDraftEditor = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (showDraftEditor) {
      // Close the editor
      setShowDraftEditor(false);
    } else {
      // Open the editor - load existing draft if available
      setIsLoadingDraft(true);
      try {
        const emailDraftService = accessor.get('IEmailDraftService');
        const draft = await emailDraftService.getDraft(email.id);

        if (draft) {
          setDraftContent(draft.content);
          setDraftStatus(draft.status);
        } else {
          // No draft exists, start with empty content
          setDraftContent('<p></p>');
          setDraftStatus(undefined);
        }

        setShowDraftEditor(true);
      } catch (error) {
        console.error('[EmailCard] Failed to load draft:', error);
        try {
          const notificationService = accessor.get('INotificationService');
          notificationService.error(`Failed to load draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } catch {

          // Notification service unavailable
        }} finally {
        setIsLoadingDraft(false);
      }
    }
  };

  const avatarColor = getAvatarColor(email.from);
  const initials = getInitials(email.from);
  const fromName = email.from.split('<')[0].trim() || email.from;

  // ============================================================================
  // COMPACT VIEW - Single row, minimal info
  // ============================================================================
  if (isCompact) {
    return (
      <div
        className="void-rounded-lg void-transition-all void-duration-200 void-cursor-pointer void-group"
        style={{
          ...cardStyle,
          borderRadius: '8px',
          border: isHovered ? '1px solid var(--vscode-focusBorder)' : '1px solid var(--vscode-panel-border)'
        }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}>
        
				<div className="void-px-3 void-py-2 void-flex void-items-center void-gap-3">
					{/* Star Button - Always visible */}
					<button
            onClick={handleToggleStar}
            disabled={isTogglingStarred}
            className="void-flex void-items-center void-justify-center void-transition-all"
            style={{
              background: 'none',
              border: 'none',
              cursor: isTogglingStarred ? 'wait' : 'pointer',
              padding: '2px',
              flexShrink: 0
            }}
            title={isStarred ? 'Unstar email' : 'Star email'}>
            
						<i
              className={`void-codicon ${isStarred ? "void-codicon-star-full" : "void-codicon-star-empty"}`}
              style={{
                color: isStarred ? 'var(--vscode-charts-yellow)' : 'var(--vscode-descriptionForeground)',
                fontSize: '14px',
                opacity: isTogglingStarred ? 0.5 : 1
              }} />
            
					</button>

					{/* Reminder Button - Always visible */}
					<div style={{ position: 'relative', flexShrink: 0 }}>
						<button
              onClick={handleReminderClick}
              className="void-flex void-items-center void-justify-center void-transition-all"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px'
              }}
              title={reminderDate ? `Reminder: ${reminderDate.toLocaleDateString()}` : 'Set reminder'}>
              
							<i
                className={`void-codicon ${reminderDate ? "void-codicon-bell-dot" : "void-codicon-bell"}`}
                style={{
                  color: reminderDate ? 'var(--vscode-charts-blue)' : 'var(--vscode-descriptionForeground)',
                  fontSize: '14px'
                }} />
              
						</button>
						{showReminderPicker &&
            <ReminderPicker
              currentDate={reminderDate}
              onSetReminder={handleSetReminder}
              onClose={() => setShowReminderPicker(false)} />

            }
					</div>

					{/* File Type Icon */}
					<i
            className={`void-codicon ${email.fileType === 'eml' ? "void-codicon-mail" : "void-codicon-file-pdf"}`}
            style={{
              color: email.fileType === 'eml' ? 'var(--vscode-charts-blue)' : 'var(--vscode-charts-red)',
              fontSize: '14px',
              flexShrink: 0
            }} />
          

					{/* From */}
					<span
            className="void-font-medium void-text-sm void-truncate"
            style={{ ...textPrimaryStyle, minWidth: '120px', maxWidth: '150px' }}>
            
						{fromName}
					</span>

					{/* Badges */}
					<div className="void-flex void-items-center void-gap-1 void-flex-shrink-0">
						{email.isDraft &&
            <span
              className="void-inline-flex void-items-center void-rounded void-px-1.5 void-py-0.5 void-text-xs void-font-medium"
              style={{
                backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
                color: 'var(--vscode-charts-yellow)'
              }}>
              
								Draft
							</span>
            }
						{/* Draft Status Indicator */}
						{draftStatus && getDraftStatusIndicator(draftStatus) && (() => {
              const indicator = getDraftStatusIndicator(draftStatus)!;
              return (
                <span
                  className="void-inline-flex void-items-center void-rounded void-px-1.5 void-py-0.5 void-text-xs"
                  style={{
                    backgroundColor: 'var(--vscode-button-secondaryBackground)',
                    color: indicator.color,
                    border: '1px solid var(--vscode-panel-border)'
                  }}
                  title={indicator.label}>
                  
									{indicator.icon}
								</span>);

            })()}
						{email.attachments.length > 0 &&
            <i
              className="void-codicon void-codicon-file-symlink-file"
              style={{ ...textSecondaryStyle, fontSize: '11px' }}
              title={`${email.attachments.length} attachment${email.attachments.length !== 1 ? 's' : ''}`} />

            }
						{/* Category Badge */}
						{email.category && getCategoryConfig(email.category) && (() => {
              const config = getCategoryConfig(email.category)!;
              return (
                <span
                  className="void-inline-flex void-items-center void-rounded void-px-1.5 void-py-0.5 void-text-xs"
                  style={{
                    backgroundColor: config.bgColor,
                    color: config.textColor,
                    border: `1px solid ${config.borderColor}`
                  }}
                  title={config.label}>
                  
									{config.icon}
								</span>);

            })()}
						{/* Priority indicator */}
						{email.priority && email.priority !== 'normal' && getPriorityConfig(email.priority) && (() => {
              const config = getPriorityConfig(email.priority)!;
              return (
                <span
                  title={`${config.label} priority`}
                  style={{ fontSize: '10px' }}>
                  
									{config.icon}
								</span>);

            })()}
					</div>

					{/* Subject */}
					<span
            className="void-text-sm void-truncate void-flex-1"
            style={textSecondaryStyle}>
            
						{email.subject}
					</span>

					{/* Date */}
					<span
            className="void-text-xs void-whitespace-nowrap void-flex-shrink-0"
            style={textSecondaryStyle}>
            
						{formatEmailDate(email.date)}
					</span>

					{/* Compact Action Buttons - with text labels */}
					<div className="void-flex void-items-center void-gap-2 void-opacity-0 group-hover:void-opacity-100 void-transition-opacity void-flex-shrink-0">
						<button
              onClick={handleToggleDraftEditor}
              disabled={isLoadingDraft}
              className="void-px-2 void-py-1 void-rounded void-flex void-items-center void-gap-1 void-text-xs void-transition-all"
              style={{
                backgroundColor: showDraftEditor ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
                color: showDraftEditor ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)',
                border: '1px solid var(--vscode-panel-border)',
                cursor: isLoadingDraft ? 'wait' : 'pointer'
              }}>
              
							<i className={`void-codicon ${isLoadingDraft ? "void-codicon-loading void-codicon-modifier-spin" : showDraftEditor ? "void-codicon-chevron-up" : "void-codicon-edit"}`} />
							<span>{isLoadingDraft ? 'Loading...' : showDraftEditor ? 'Close' : 'Draft'}</span>
						</button>
						<button
              onClick={handleDraftReply}
              disabled={isDrafting}
              className="void-px-2 void-py-1 void-rounded void-flex void-items-center void-gap-1 void-text-xs void-transition-all"
              style={{
                backgroundColor: isDrafting ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
                color: isDrafting ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)',
                border: '1px solid var(--vscode-panel-border)',
                cursor: isDrafting ? 'wait' : 'pointer'
              }}>
              
							<i className={`void-codicon ${isDrafting ? "void-codicon-loading void-codicon-modifier-spin" : "void-codicon-reply"}`} />
							<span>{isDrafting ? 'Drafting...' : 'Reply'}</span>
						</button>
						<button
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="void-px-2 void-py-1 void-rounded void-flex void-items-center void-gap-1 void-text-xs void-transition-all"
              style={{
                backgroundColor: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-descriptionForeground)',
                border: '1px solid var(--vscode-panel-border)'
              }}>
              
							<i className="void-codicon void-codicon-go-to-file" />
							<span>Open</span>
						</button>
						<button
              onClick={handleAddToTimeline}
              disabled={isAddingToTimeline}
              className="void-px-2 void-py-1 void-rounded void-flex void-items-center void-gap-1 void-text-xs void-transition-all"
              style={{
                backgroundColor: isAddingToTimeline ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
                color: isAddingToTimeline ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)',
                border: '1px solid var(--vscode-panel-border)',
                cursor: isAddingToTimeline ? 'wait' : 'pointer'
              }}>
              
							<i className={`void-codicon ${isAddingToTimeline ? "void-codicon-loading void-codicon-modifier-spin" : "void-codicon-calendar"}`} />
							<span>{isAddingToTimeline ? 'Adding...' : 'Timeline'}</span>
						</button>
						<button
              onClick={handleDelete}
              className="void-px-2 void-py-1 void-rounded void-flex void-items-center void-gap-1 void-text-xs void-transition-all"
              style={{
                backgroundColor: confirmDelete ? 'var(--vscode-charts-red)' : 'var(--vscode-button-secondaryBackground)',
                color: confirmDelete ? 'var(--vscode-editor-foreground)' : 'var(--vscode-descriptionForeground)',
                border: confirmDelete ? '1px solid var(--vscode-charts-red)' : '1px solid var(--vscode-panel-border)'
              }}>
              
							<i className={`void-codicon ${confirmDelete ? "void-codicon-check" : "void-codicon-trash"}`} />
							<span>{confirmDelete ? 'Confirm' : 'Delete'}</span>
						</button>
					</div>
				</div>
			</div>);

  }

  // ============================================================================
  // LIST VIEW - Full card with preview
  // ============================================================================
  return (
    <div
      className="void-rounded-xl void-transition-all void-duration-200 void-cursor-pointer void-group"
      style={isHovered ? cardHoverStyle : cardStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      
			<div className="void-p-4 void-flex void-items-start void-gap-4">
				{/* Star Button - Always visible */}
				<button
          onClick={handleToggleStar}
          disabled={isTogglingStarred}
          className="void-flex void-items-center void-justify-center void-transition-all void-flex-shrink-0 void-mt-1"
          style={{
            background: 'none',
            border: 'none',
            cursor: isTogglingStarred ? 'wait' : 'pointer',
            padding: '4px'
          }}
          title={isStarred ? 'Unstar email' : 'Star email'}>
          
					<i
            className={`void-codicon ${isStarred ? "void-codicon-star-full" : "void-codicon-star-empty"}`}
            style={{
              color: isStarred ? 'var(--vscode-charts-yellow)' : 'var(--vscode-descriptionForeground)',
              fontSize: '16px',
              opacity: isTogglingStarred ? 0.5 : 1
            }} />
          
				</button>

				{/* Reminder Button - Always visible */}
				<div style={{ position: 'relative', flexShrink: 0 }} className="void-mt-1">
					<button
            onClick={handleReminderClick}
            className="void-flex void-items-center void-justify-center void-transition-all"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px'
            }}
            title={reminderDate ? `Reminder: ${reminderDate.toLocaleDateString()}` : 'Set reminder'}>
            
						<i
              className={`void-codicon ${reminderDate ? "void-codicon-bell-dot" : "void-codicon-bell"}`}
              style={{
                color: reminderDate ? 'var(--vscode-charts-blue)' : 'var(--vscode-descriptionForeground)',
                fontSize: '16px'
              }} />
            
					</button>
					{showReminderPicker &&
          <ReminderPicker
            currentDate={reminderDate}
            onSetReminder={handleSetReminder}
            onClose={() => setShowReminderPicker(false)} />

          }
				</div>

				{/* Avatar - keep colorful for distinction */}
				<div
          className="void-w-10 void-h-10 void-rounded-full void-flex void-items-center void-justify-center void-flex-shrink-0 void-text-sm void-font-semibold"
          style={{ backgroundColor: avatarColor, color: 'var(--vscode-button-foreground)' }}>
          
					{initials}
				</div>

				{/* Content */}
				<div className="void-flex-1 void-min-w-0">
					<div className="void-flex void-items-start void-justify-between void-gap-3">
						<div className="void-flex-1 void-min-w-0">
							{/* From + Date Row */}
							<div className="void-flex void-items-center void-gap-2 void-mb-1">
								<span className="void-font-semibold void-text-sm void-truncate" style={textPrimaryStyle}>
									{fromName}
								</span>
								{email.isDraft &&
                <span
                  className="void-inline-flex void-items-center void-rounded-md void-px-2 void-py-0.5 void-text-xs void-font-semibold"
                  style={{
                    backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
                    color: 'var(--vscode-charts-yellow)',
                    border: '1px solid var(--vscode-inputValidation-warningBorder)'
                  }}>
                  
										Draft
									</span>
                }
								{/* Draft Status Indicator */}
								{draftStatus && getDraftStatusIndicator(draftStatus) && (() => {
                  const indicator = getDraftStatusIndicator(draftStatus)!;
                  return (
                    <span
                      className="void-inline-flex void-items-center void-rounded void-px-1.5 void-py-0.5 void-text-xs void-gap-1"
                      style={{
                        backgroundColor: 'var(--vscode-button-secondaryBackground)',
                        color: indicator.color,
                        border: '1px solid var(--vscode-panel-border)'
                      }}
                      title={indicator.label}>
                      
											<span>{indicator.icon}</span>
											<span style={{ fontSize: '10px' }}>{indicator.label}</span>
										</span>);

                })()}
								{email.attachments.length > 0 &&
                <i
                  className="void-codicon void-codicon-file-symlink-file"
                  style={{ ...textSecondaryStyle, fontSize: '12px' }}
                  title={`${email.attachments.length} attachment${email.attachments.length !== 1 ? 's' : ''}`} />

                }
							</div>

							{/* Subject */}
							<h3 className="void-font-medium void-text-sm void-mb-1 void-truncate" style={textPrimaryStyle}>
								{email.subject}
							</h3>

							{/* Preview */}
							<p
                className="void-text-xs void-line-clamp-2"
                style={textSecondaryStyle}>
                
								{email.bodyText.substring(0, 150)}...
							</p>
						</div>

						{/* Right Side - Date & Actions */}
						<div className="void-flex void-flex-col void-items-end void-gap-2">
							<span className="void-text-xs void-whitespace-nowrap" style={textSecondaryStyle}>
								{formatEmailDate(email.date)}
							</span>

							{/* Action Buttons - with text labels */}
							<div className="void-flex void-items-center void-gap-2 void-opacity-0 group-hover:void-opacity-100 void-transition-opacity">
								{/* Draft Editor Toggle Button */}
								<button
                  onClick={handleToggleDraftEditor}
                  disabled={isLoadingDraft}
                  className="void-px-3 void-py-1.5 void-rounded-lg void-flex void-items-center void-gap-1.5 void-text-xs void-font-medium void-transition-all"
                  style={{
                    backgroundColor: showDraftEditor ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
                    border: '1px solid var(--vscode-panel-border)',
                    color: showDraftEditor ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)',
                    cursor: isLoadingDraft ? 'wait' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoadingDraft && !showDraftEditor) {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
                      e.currentTarget.style.color = 'var(--vscode-button-foreground)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoadingDraft && !showDraftEditor) {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
                      e.currentTarget.style.color = 'var(--vscode-descriptionForeground)';
                    }
                  }}>
                  
									<i className={`void-codicon ${isLoadingDraft ? "void-codicon-loading void-codicon-modifier-spin" : showDraftEditor ? "void-codicon-chevron-up" : "void-codicon-edit"}`} />
									<span>{isLoadingDraft ? 'Loading...' : showDraftEditor ? 'Close Draft' : 'Draft'}</span>
								</button>

								{/* AI Reply Button */}
								<button
                  onClick={handleDraftReply}
                  disabled={isDrafting}
                  className="void-px-3 void-py-1.5 void-rounded-lg void-flex void-items-center void-gap-1.5 void-text-xs void-font-medium void-transition-all"
                  style={{
                    backgroundColor: isDrafting ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
                    border: '1px solid var(--vscode-panel-border)',
                    color: isDrafting ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)',
                    cursor: isDrafting ? 'wait' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isDrafting) {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
                      e.currentTarget.style.color = 'var(--vscode-button-foreground)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDrafting) {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
                      e.currentTarget.style.color = 'var(--vscode-descriptionForeground)';
                    }
                  }}>
                  
									<i className={`void-codicon ${isDrafting ? "void-codicon-loading void-codicon-modifier-spin" : "void-codicon-reply"}`} />
									<span>{isDrafting ? 'Drafting...' : 'AI Reply'}</span>
								</button>

								{/* Open Button */}
								<button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                  }}
                  className="void-px-3 void-py-1.5 void-rounded-lg void-flex void-items-center void-gap-1.5 void-text-xs void-font-medium void-transition-all"
                  style={{
                    backgroundColor: 'var(--vscode-button-secondaryBackground)',
                    border: '1px solid var(--vscode-panel-border)',
                    color: 'var(--vscode-descriptionForeground)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
                    e.currentTarget.style.color = 'var(--vscode-button-foreground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
                    e.currentTarget.style.color = 'var(--vscode-descriptionForeground)';
                  }}>
                  
									<i className="void-codicon void-codicon-go-to-file" />
									<span>Open</span>
								</button>

								{/* Add to Timeline Button */}
								<button
                  onClick={handleAddToTimeline}
                  disabled={isAddingToTimeline}
                  className="void-px-3 void-py-1.5 void-rounded-lg void-flex void-items-center void-gap-1.5 void-text-xs void-font-medium void-transition-all"
                  style={{
                    backgroundColor: isAddingToTimeline ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
                    border: '1px solid var(--vscode-panel-border)',
                    color: isAddingToTimeline ? 'var(--vscode-button-foreground)' : 'var(--vscode-descriptionForeground)',
                    cursor: isAddingToTimeline ? 'wait' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isAddingToTimeline) {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
                      e.currentTarget.style.color = 'var(--vscode-button-foreground)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isAddingToTimeline) {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
                      e.currentTarget.style.color = 'var(--vscode-descriptionForeground)';
                    }
                  }}>
                  
									<i className={`void-codicon ${isAddingToTimeline ? "void-codicon-loading void-codicon-modifier-spin" : "void-codicon-calendar"}`} />
									<span>{isAddingToTimeline ? 'Adding...' : 'Timeline'}</span>
								</button>

								{/* Delete Button */}
								<button
                  onClick={handleDelete}
                  className="void-px-3 void-py-1.5 void-rounded-lg void-flex void-items-center void-gap-1.5 void-text-xs void-font-medium void-transition-all"
                  style={{
                    backgroundColor: confirmDelete ? 'var(--vscode-charts-red)' : 'var(--vscode-button-secondaryBackground)',
                    border: confirmDelete ? '1px solid var(--vscode-charts-red)' : '1px solid var(--vscode-panel-border)',
                    color: confirmDelete ? 'var(--vscode-editor-foreground)' : 'var(--vscode-descriptionForeground)'
                  }}
                  onMouseEnter={(e) => {
                    if (!confirmDelete) {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-inputValidation-errorBackground)';
                      e.currentTarget.style.color = 'var(--vscode-charts-red)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!confirmDelete) {
                      e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
                      e.currentTarget.style.color = 'var(--vscode-descriptionForeground)';
                    }
                  }}>
                  
									<i className={`void-codicon ${confirmDelete ? "void-codicon-check" : "void-codicon-trash"}`} />
									<span>{confirmDelete ? 'Confirm?' : 'Delete'}</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* File Type Badge & Category/Priority */}
			<div
        className="void-px-4 void-pb-3 void-flex void-items-center void-gap-2"
        style={{ borderTop: '1px solid var(--vscode-panel-border)' }}>
        
				<span
          className="void-inline-flex void-items-center void-rounded void-px-2 void-py-0.5 void-text-xs"
          style={{
            backgroundColor: email.fileType === 'eml' ?
            'var(--vscode-inputValidation-infoBackground)' :
            'var(--vscode-inputValidation-errorBackground)',
            color: email.fileType === 'eml' ?
            'var(--vscode-charts-blue)' :
            'var(--vscode-charts-red)',
            border: email.fileType === 'eml' ?
            '1px solid var(--vscode-inputValidation-infoBorder)' :
            '1px solid var(--vscode-inputValidation-errorBorder)'
          }}>
          
					<i
            className={`void-codicon ${email.fileType === 'eml' ? "void-codicon-mail" : "void-codicon-file-pdf"} void-mr-1`}
            style={{ fontSize: '10px' }} />
          
					{email.fileType.toUpperCase()}
				</span>

				{/* Category Badge */}
				{email.category && getCategoryConfig(email.category) && (() => {
          const config = getCategoryConfig(email.category)!;
          return (
            <span
              className="void-inline-flex void-items-center void-rounded void-px-2 void-py-0.5 void-text-xs void-gap-1"
              style={{
                backgroundColor: config.bgColor,
                color: config.textColor,
                border: `1px solid ${config.borderColor}`
              }}>
              
							<span>{config.icon}</span>
							<span>{config.label}</span>
						</span>);

        })()}

				{/* Priority Badge */}
				{email.priority && getPriorityConfig(email.priority) && (() => {
          const config = getPriorityConfig(email.priority)!;
          return (
            <span
              className="void-inline-flex void-items-center void-rounded void-px-2 void-py-0.5 void-text-xs void-gap-1"
              style={{
                backgroundColor: email.priority === 'urgent' ?
                'var(--vscode-inputValidation-errorBackground)' :
                email.priority === 'low' ?
                'var(--vscode-inputValidation-infoBackground)' :
                'var(--vscode-button-secondaryBackground)',
                color: config.color,
                border: `1px solid ${email.priority === 'urgent' ?
                'var(--vscode-inputValidation-errorBorder)' :
                email.priority === 'low' ?
                'var(--vscode-inputValidation-infoBorder)' :
                'var(--vscode-panel-border)'}`
              }}>
              
							<span>{config.icon}</span>
							<span>{config.label}</span>
						</span>);

        })()}

				<span className="void-text-xs void-truncate" style={textSecondaryStyle}>
					{email.caseFolderPath.split('/').pop()}
				</span>
			</div>

			{/* Draft Editor Section - Expandable */}
			{showDraftEditor && draftContent !== undefined &&
      <div
        style={{
          borderTop: '1px solid var(--vscode-panel-border)',
          backgroundColor: 'var(--vscode-editor-background)',
          padding: '12px'
        }}>
        
					<div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
            paddingBottom: '8px',
            borderBottom: '1px solid var(--vscode-panel-border)'
          }}>
          
						<i
            className="void-codicon void-codicon-edit"
            style={{ color: 'var(--vscode-charts-blue)', fontSize: '14px' }} />
          
						<span
            style={{
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--vscode-editor-foreground)'
            }}>
            
							Reply Draft
						</span>
						<button
            onClick={handleToggleDraftEditor}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--vscode-descriptionForeground)'
            }}
            title="Collapse draft editor">
            
							<i className="void-codicon void-codicon-chevron-up" style={{ fontSize: '14px' }} />
						</button>
					</div>
					<DraftEditor
          emailId={email.id}
          initialContent={draftContent}
          onClose={() => setShowDraftEditor(false)} />
        
				</div>
      }
		</div>);

};