/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';
import { EmailDraft } from '../../../../common/emailService.js';
import { useAccessor } from '../util/services.js';

interface DraftVersionHistoryProps {
  emailId: string;
  currentContent: string;
  onRestore: (content: string) => void;
  onClose: () => void;
}

export const DraftVersionHistory: React.FC<DraftVersionHistoryProps> = ({
  emailId,
  currentContent,
  onRestore,
  onClose
}) => {
  const accessor = useAccessor();
  const [versions, setVersions] = useState<EmailDraft[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<EmailDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  // Load draft versions
  useEffect(() => {
    loadVersions();
  }, [emailId]);

  const loadVersions = async () => {
    setIsLoading(true);
    try {
      const emailDraftService = accessor.get('IEmailDraftService');
      const allVersions = await emailDraftService.getDraftVersions(emailId);
      setVersions(allVersions);

      // Auto-select latest version
      if (allVersions.length > 0) {
        setSelectedVersion(allVersions[0]);
      }
    } catch (error) {
      console.error('[DraftVersionHistory] Failed to load versions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Format timestamp for display
  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days === 0) {
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes < 1 ? 'Just now' : `${minutes}m ago`;
      }
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (days === 1) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Convert HTML to plain text for display (CSP blocks innerHTML in sidebar context)
  const htmlToText = (html: string): string => {
    return html.
    replace(/<br\s*\/?>/gi, '\n').
    replace(/<\/p>/gi, '\n\n').
    replace(/<\/div>/gi, '\n').
    replace(/<\/li>/gi, '\n').
    replace(/<[^>]*>/g, '').
    replace(/&nbsp;/g, ' ').
    replace(/&lt;/g, '<').
    replace(/&gt;/g, '>').
    replace(/&amp;/g, '&').
    replace(/&quot;/g, '"').
    trim();
  };

  // Get preview text from HTML content
  const getPreviewText = (htmlContent: string): string => {
    // Strip HTML tags and get first 50 characters
    const text = htmlToText(htmlContent);
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  };

  // Handle restore version
  const handleRestore = () => {
    if (!selectedVersion) return;

    // Check if restoring the current version
    const isCurrentVersion = versions.length > 0 && selectedVersion.id === versions[0].id;
    if (isCurrentVersion) {
      const notificationService = accessor.get('INotificationService');
      notificationService.info('This is already the current version');
      return;
    }

    setShowRestoreConfirm(true);
  };

  const confirmRestore = () => {
    if (!selectedVersion) return;

    onRestore(selectedVersion.content);
    setShowRestoreConfirm(false);

    const notificationService = accessor.get('INotificationService');
    notificationService.info(`Restored version ${selectedVersion.version}`);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div style={containerStyle}>
				<div style={headerStyle}>
					<div style={titleStyle}>
						<i className="void-codicon void-codicon-history" />
						<span>Version History</span>
					</div>
					<button
            onClick={onClose}
            style={closeButtonStyle}
            title="Close Version History">
            
						✕ Close
					</button>
				</div>
				<div style={loadingStyle}>
					<i className="void-codicon void-codicon-loading void-codicon-modifier-spin" />
					<span>Loading versions...</span>
				</div>
			</div>);

  }

  // Render empty state
  if (versions.length === 0) {
    return (
      <div style={containerStyle}>
				<div style={headerStyle}>
					<div style={titleStyle}>
						<i className="void-codicon void-codicon-history" />
						<span>Version History</span>
					</div>
					<button
            onClick={onClose}
            style={closeButtonStyle}
            title="Close Version History">
            
						✕ Close
					</button>
				</div>
				<div style={emptyStateStyle}>
					<i className="void-codicon void-codicon-info" />
					<span>No draft versions yet</span>
				</div>
			</div>);

  }

  return (
    <div style={containerStyle}>
			{/* Header */}
			<div style={headerStyle}>
				<div style={titleStyle}>
					<i className="void-codicon void-codicon-history" />
					<span>Version History</span>
					<span style={countBadgeStyle}>{versions.length}</span>
				</div>
				<button
          onClick={onClose}
          style={closeButtonStyle}
          title="Close Version History">
          
					✕ Close
				</button>
			</div>

			{/* Content area - split between list and preview */}
			<div style={contentStyle}>
				{/* Version list */}
				<div style={versionListStyle} className="void-void-scrollbar">
					{versions.map((version, index) => {
            const isSelected = selectedVersion?.id === version.id;
            const isCurrent = index === 0;

            return (
              <div
                key={version.id}
                style={{
                  ...versionItemStyle,
                  ...(isSelected ? versionItemSelectedStyle : {})
                }}
                onClick={() => setSelectedVersion(version)}>
                
								<div style={versionHeaderStyle}>
									<span style={versionNumberStyle}>
										Version {version.version}
									</span>
									{isCurrent &&
                  <span style={currentBadgeStyle}>Current</span>
                  }
								</div>
								<div style={versionTimeStyle}>
									{formatTimestamp(version.updatedAt)}
								</div>
								<div style={versionPreviewStyle}>
									{getPreviewText(version.content)}
								</div>
							</div>);

          })}
				</div>

				{/* Preview area */}
				<div style={previewAreaStyle}>
					{selectedVersion ?
          <>
							<div style={previewHeaderStyle}>
								<span>Preview - Version {selectedVersion.version}</span>
							</div>
							<div
              style={{ ...previewContentStyle, whiteSpace: 'pre-wrap' }}
              className="void-void-scrollbar">
              
								{htmlToText(selectedVersion.content)}
							</div>
							<div style={previewActionsStyle}>
								<button
                onClick={handleRestore}
                style={restoreButtonStyle}
                disabled={versions.length > 0 && selectedVersion.id === versions[0].id}>
                
									<i className="void-codicon void-codicon-debug-restart" />
									<span>Restore This Version</span>
								</button>
							</div>
						</> :

          <div style={emptyPreviewStyle}>
							<i className="void-codicon void-codicon-file" />
							<span>Select a version to preview</span>
						</div>
          }
				</div>
			</div>

			{/* Restore confirmation dialog */}
			{showRestoreConfirm &&
      <div style={modalOverlayStyle} onClick={() => setShowRestoreConfirm(false)}>
					<div style={modalStyle} onClick={(e) => e.stopPropagation()}>
						<div style={modalHeaderStyle}>
							<i className="void-codicon void-codicon-warning" style={{ color: 'var(--vscode-notificationsWarningIcon-foreground)' }} />
							<span>Restore Version?</span>
						</div>
						<div style={modalContentStyle}>
							<p>Are you sure you want to restore version {selectedVersion?.version}?</p>
							<p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
								This will replace the current draft content. Your current version will be saved automatically.
							</p>
						</div>
						<div style={modalActionsStyle}>
							<button
              onClick={() => setShowRestoreConfirm(false)}
              style={modalCancelButtonStyle}>
              
								Cancel
							</button>
							<button
              onClick={confirmRestore}
              style={modalConfirmButtonStyle}>
              
								<i className="void-codicon void-codicon-debug-restart" />
								<span>Restore</span>
							</button>
						</div>
					</div>
				</div>
      }
		</div>);

};

// ============================================================================
// STYLES
// ============================================================================

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  width: '600px',
  backgroundColor: 'var(--vscode-sideBar-background)',
  borderLeft: '1px solid var(--vscode-panel-border)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 100
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid var(--vscode-panel-border)',
  backgroundColor: 'var(--vscode-sideBarSectionHeader-background)'
};

const titleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--vscode-sideBarTitle-foreground)'
};

const countBadgeStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-badge-background)',
  color: 'var(--vscode-badge-foreground)',
  borderRadius: '10px',
  padding: '2px 8px',
  fontSize: '11px',
  fontWeight: 600
};

const closeButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  padding: '6px 12px',
  border: '1px solid var(--vscode-panel-border)',
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: 500
};

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden'
};

const versionListStyle: React.CSSProperties = {
  width: '250px',
  borderRight: '1px solid var(--vscode-panel-border)',
  overflowY: 'auto',
  backgroundColor: 'var(--vscode-sideBar-background)'
};

const versionItemStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--vscode-panel-border)',
  cursor: 'pointer',
  transition: 'background-color 0.1s'
};

const versionItemSelectedStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-list-activeSelectionBackground)'
};

const versionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '4px'
};

const versionNumberStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--vscode-editor-foreground)'
};

const currentBadgeStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--vscode-badge-foreground)',
  backgroundColor: 'var(--vscode-badge-background)',
  padding: '2px 6px',
  borderRadius: '8px'
};

const versionTimeStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--vscode-descriptionForeground)',
  marginBottom: '6px'
};

const versionPreviewStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--vscode-descriptionForeground)',
  lineHeight: '1.4',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical'
};

const previewAreaStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'var(--vscode-editor-background)'
};

const previewHeaderStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--vscode-panel-border)',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--vscode-editor-foreground)'
};

const previewContentStyle: React.CSSProperties = {
  flex: 1,
  padding: '16px',
  overflowY: 'auto',
  fontSize: '13px',
  lineHeight: '1.6',
  color: 'var(--vscode-editor-foreground)'
};

const previewActionsStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderTop: '1px solid var(--vscode-panel-border)',
  display: 'flex',
  justifyContent: 'flex-end'
};

const restoreButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 16px',
  backgroundColor: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 500
};

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  padding: '48px 16px',
  color: 'var(--vscode-descriptionForeground)',
  fontSize: '13px'
};

const emptyStateStyle: React.CSSProperties = {
  ...loadingStyle
};

const emptyPreviewStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  flex: 1,
  color: 'var(--vscode-descriptionForeground)',
  fontSize: '13px'
};

// Modal styles
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const modalStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-editorWidget-background)',
  border: '1px solid var(--vscode-editorWidget-border)',
  borderRadius: '8px',
  minWidth: '400px',
  maxWidth: '500px',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '16px',
  borderBottom: '1px solid var(--vscode-panel-border)',
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--vscode-editor-foreground)'
};

const modalContentStyle: React.CSSProperties = {
  padding: '16px',
  fontSize: '13px',
  lineHeight: '1.5',
  color: 'var(--vscode-editor-foreground)'
};

const modalActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  padding: '12px 16px',
  borderTop: '1px solid var(--vscode-panel-border)'
};

const modalCancelButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px'
};

const modalConfirmButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 16px',
  backgroundColor: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 500
};