/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAccessor } from '../util/services.js';
import { DraftStatus } from '../../../../common/emailService.js';
import { DraftStatusBadge } from './DraftStatusBadge.js';
import { DraftVersionHistory } from './DraftVersionHistory.js';
import './DraftEditor.css';

// Note: We use a simple contenteditable div instead of Tiptap here
// because the sidebar context has Trusted Types enabled which blocks
// Tiptap's DOMParser.parseFromString calls. The DOCX viewer uses Tiptap
// because it runs in a webview with different CSP rules.

interface DraftEditorProps {
	emailId: string;
	initialContent?: string;
	onSave?: (content: string) => void;
	onClose?: () => void;
}

export const DraftEditor: React.FC<DraftEditorProps> = ({
	emailId,
	initialContent = '',
	onSave,
	onClose
}) => {
	const accessor = useAccessor();
	const editorContainerRef = useRef<HTMLDivElement>(null);
	const autoSaveTimeoutRef = useRef<number | null>(null);

	const [isSaving, setIsSaving] = useState(false);
	const [lastSaved, setLastSaved] = useState<Date | null>(null);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [showVersionHistory, setShowVersionHistory] = useState(false);
	const [draftStatus, setDraftStatus] = useState<DraftStatus>('draft');
	const [draftId, setDraftId] = useState<string | null>(null);
	const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

	// Convert HTML to plain text for display (CSP blocks innerHTML in sidebar context)
	const htmlToText = (html: string): string => {
		// Simple HTML to text conversion - strip tags but preserve structure
		return html
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<\/p>/gi, '\n\n')
			.replace(/<\/div>/gi, '\n')
			.replace(/<\/li>/gi, '\n')
			.replace(/<[^>]*>/g, '')
			.replace(/&nbsp;/g, ' ')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&amp;/g, '&')
			.replace(/&quot;/g, '"')
			.trim();
	};

	// Get displayable content (as plain text due to CSP restrictions)
	const displayContent = htmlToText(initialContent || '');

	// Setup input listener for content changes
	useEffect(() => {
		if (!editorContainerRef.current) return;

		const handleInput = () => {
			handleContentChange();
		};

		editorContainerRef.current.addEventListener('input', handleInput);
		console.log('[DraftEditor] Plain text editor initialized');

		return () => {
			if (editorContainerRef.current) {
				editorContainerRef.current.removeEventListener('input', handleInput);
			}
			if (autoSaveTimeoutRef.current) {
				clearTimeout(autoSaveTimeoutRef.current);
			}
		};
	}, []);

	// Handle content change with debounced auto-save
	const handleContentChange = useCallback(() => {
		setHasUnsavedChanges(true);

		// Clear existing timeout
		if (autoSaveTimeoutRef.current) {
			clearTimeout(autoSaveTimeoutRef.current);
		}

		// Set new auto-save timeout (2 seconds)
		autoSaveTimeoutRef.current = window.setTimeout(() => {
			handleSave(false); // Auto-save (silent)
		}, 2000);
	}, [emailId]);

	// Load draft on mount to get draft ID and status
	useEffect(() => {
		const loadDraftInfo = async () => {
			try {
				const emailDraftService = accessor.get('IEmailDraftService');
				const draft = await emailDraftService.getDraft(emailId);

				if (draft) {
					setDraftId(draft.id);
					setDraftStatus(draft.status);
				}
			} catch (error) {
				console.error('[DraftEditor] Failed to load draft info:', error);
			}
		};

		loadDraftInfo();
	}, [emailId, accessor]);

	// Save draft to service
	const handleSave = useCallback(async (showNotification = true) => {
		setIsSaving(true);

		try {
			const emailDraftService = accessor.get('IEmailDraftService');
			const notificationService = accessor.get('INotificationService');

			// Get content from contenteditable - wrap in <p> tags for HTML format
			const rawContent = editorContainerRef.current?.innerText || '';
			const content = rawContent.split('\n\n').filter(p => p.trim()).map(p => `<p>${p.trim()}</p>`).join('\n');

			// Save draft
			const savedDraft = await emailDraftService.saveDraft(emailId, content);

			// Update draft ID and status if this is the first save
			if (!draftId) {
				setDraftId(savedDraft.id);
				setDraftStatus(savedDraft.status);
			}

			setLastSaved(new Date());
			setHasUnsavedChanges(false);

			if (showNotification) {
				notificationService.info('Draft saved successfully');
			}

			// Notify parent
			if (onSave) {
				onSave(content);
			}
		} catch (error) {
			console.error('[DraftEditor] Failed to save draft:', error);
			const notificationService = accessor.get('INotificationService');
			notificationService.error(`Failed to save draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			setIsSaving(false);
		}
	}, [emailId, accessor, onSave, draftId]);

	// Handle status change
	const handleStatusChange = useCallback(async (newStatus: DraftStatus) => {
		if (!draftId) {
			const notificationService = accessor.get('INotificationService');
			notificationService.warn('Please save the draft before changing status');
			return;
		}

		setIsUpdatingStatus(true);

		try {
			const emailDraftService = accessor.get('IEmailDraftService');
			const notificationService = accessor.get('INotificationService');

			await emailDraftService.updateDraftStatus(draftId, newStatus);

			setDraftStatus(newStatus);
			notificationService.info(`Draft status updated to ${newStatus}`);
		} catch (error) {
			console.error('[DraftEditor] Failed to update draft status:', error);
			const notificationService = accessor.get('INotificationService');
			notificationService.error(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			setIsUpdatingStatus(false);
		}
	}, [draftId, accessor]);

	// Get next status button label and action
	const getNextStatusAction = (): { label: string; nextStatus: DraftStatus } | null => {
		switch (draftStatus) {
			case 'draft':
				return { label: 'Mark as Reviewed', nextStatus: 'reviewed' };
			case 'reviewed':
				return { label: 'Mark Ready to Send', nextStatus: 'ready' };
			case 'ready':
				return null; // Will integrate with send in Phase 3
			case 'sent':
				return null; // Already sent
			default:
				return null;
		}
	};

	const nextStatusAction = getNextStatusAction();

	// Toolbar button handlers using execCommand (works with contenteditable)
	const toggleBold = () => { editorContainerRef.current?.focus(); document.execCommand('bold'); };
	const toggleItalic = () => { editorContainerRef.current?.focus(); document.execCommand('italic'); };
	const toggleUnderline = () => { editorContainerRef.current?.focus(); document.execCommand('underline'); };
	const toggleBulletList = () => { editorContainerRef.current?.focus(); document.execCommand('insertUnorderedList'); };
	const toggleOrderedList = () => { editorContainerRef.current?.focus(); document.execCommand('insertOrderedList'); };
	const setHeading = (level: 1 | 2 | 3 | 4) => { editorContainerRef.current?.focus(); document.execCommand('formatBlock', false, `h${level}`); };
	const setParagraph = () => { editorContainerRef.current?.focus(); document.execCommand('formatBlock', false, 'p'); };

	// Handle restore from version history
	const handleRestoreVersion = useCallback((content: string) => {
		// Set content as plain text in the editor
		if (editorContainerRef.current) {
			editorContainerRef.current.innerText = htmlToText(content);
		}

		// Mark as unsaved and trigger auto-save
		setHasUnsavedChanges(true);
		handleContentChange();

		// Close history panel
		setShowVersionHistory(false);
	}, [handleContentChange]);

	// Format last saved time
	const formatLastSaved = (date: Date | null): string => {
		if (!date) return 'Never';
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);

		if (seconds < 10) return 'Just now';
		if (seconds < 60) return `${seconds} seconds ago`;
		if (minutes === 1) return '1 minute ago';
		if (minutes < 60) return `${minutes} minutes ago`;
		return date.toLocaleTimeString();
	};

	return (
		<div className="draft-editor-container">
			{/* Header */}
			<div className="draft-editor-header">
				<div className="draft-editor-title">
					<i className="codicon codicon-edit" />
					<span>Draft Reply</span>
					{hasUnsavedChanges && (
						<span className="draft-editor-unsaved">•</span>
					)}
					{/* Status Badge */}
					{draftId && (
						<div style={{ marginLeft: '12px' }}>
							<DraftStatusBadge
								status={draftStatus}
								draftId={draftId}
								onStatusChange={handleStatusChange}
							/>
						</div>
					)}
				</div>
				<div className="draft-editor-header-actions">
					{/* Status progression button */}
					{nextStatusAction && draftId && (
						<button
							onClick={() => handleStatusChange(nextStatusAction.nextStatus)}
							disabled={isUpdatingStatus || hasUnsavedChanges}
							className="draft-editor-status-btn"
							title={hasUnsavedChanges ? 'Save changes before updating status' : nextStatusAction.label}
							style={{
								backgroundColor: 'var(--vscode-button-background)',
								color: 'var(--vscode-button-foreground)',
								border: '1px solid var(--vscode-button-border)',
								borderRadius: '6px',
								padding: '6px 12px',
								fontSize: '12px',
								fontWeight: '500',
								cursor: isUpdatingStatus || hasUnsavedChanges ? 'not-allowed' : 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: '6px',
								opacity: isUpdatingStatus || hasUnsavedChanges ? 0.6 : 1,
							}}
						>
							<i className={`codicon ${isUpdatingStatus ? 'codicon-loading codicon-modifier-spin' : 'codicon-arrow-right'}`} />
							<span>{nextStatusAction.label}</span>
						</button>
					)}
					<span className="draft-editor-last-saved">
						{isSaving ? 'Saving...' : `Saved ${formatLastSaved(lastSaved)}`}
					</span>
					<button
						onClick={() => setShowVersionHistory(!showVersionHistory)}
						className="draft-editor-history-btn"
						title="Version history"
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '6px',
							padding: '6px 12px',
							fontSize: '12px',
							backgroundColor: showVersionHistory ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
							color: showVersionHistory ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
							border: '1px solid var(--vscode-button-border)',
							borderRadius: '6px',
							cursor: 'pointer',
						}}
					>
						<i className="codicon codicon-history" />
						<span>History</span>
					</button>
					<button
						onClick={() => handleSave(true)}
						disabled={isSaving || !hasUnsavedChanges}
						className="draft-editor-save-btn"
						title="Save draft (Ctrl+S)"
					>
						<i className={`codicon ${isSaving ? 'codicon-loading codicon-modifier-spin' : 'codicon-save'}`} />
						<span>Save</span>
					</button>
					{onClose && (
						<button
							onClick={onClose}
							className="draft-editor-close-btn"
							title="Close editor"
						>
							<i className="codicon codicon-close" />
						</button>
					)}
				</div>
			</div>

			{/* Toolbar */}
			<div className="draft-editor-toolbar">
				{/* Text formatting */}
				<div className="draft-editor-toolbar-group">
					<button onClick={setParagraph} title="Normal text" className="draft-editor-toolbar-btn">
						<i className="codicon codicon-symbol-text" />
					</button>
					<button onClick={() => setHeading(1)} title="Heading 1" className="draft-editor-toolbar-btn">
						<span style={{ fontWeight: 'bold' }}>H1</span>
					</button>
					<button onClick={() => setHeading(2)} title="Heading 2" className="draft-editor-toolbar-btn">
						<span style={{ fontWeight: 'bold' }}>H2</span>
					</button>
					<button onClick={() => setHeading(3)} title="Heading 3" className="draft-editor-toolbar-btn">
						<span style={{ fontWeight: 'bold' }}>H3</span>
					</button>
				</div>

				<div className="draft-editor-toolbar-divider" />

				{/* Style formatting */}
				<div className="draft-editor-toolbar-group">
					<button onClick={toggleBold} title="Bold (Ctrl+B)" className="draft-editor-toolbar-btn">
						<i className="codicon codicon-bold" />
					</button>
					<button onClick={toggleItalic} title="Italic (Ctrl+I)" className="draft-editor-toolbar-btn">
						<i className="codicon codicon-italic" />
					</button>
					<button onClick={toggleUnderline} title="Underline (Ctrl+U)" className="draft-editor-toolbar-btn">
						<i className="codicon codicon-underline" />
					</button>
				</div>

				<div className="draft-editor-toolbar-divider" />

				{/* Lists */}
				<div className="draft-editor-toolbar-group">
					<button onClick={toggleBulletList} title="Bullet list" className="draft-editor-toolbar-btn">
						<i className="codicon codicon-list-unordered" />
					</button>
					<button onClick={toggleOrderedList} title="Numbered list" className="draft-editor-toolbar-btn">
						<i className="codicon codicon-list-ordered" />
					</button>
				</div>
			</div>

			{/* Editor content area - plain text due to CSP/Trusted Types restrictions */}
			<div
				ref={editorContainerRef}
				contentEditable
				suppressContentEditableWarning
				className="draft-editor-content-wrapper void-scrollbar draft-editor-content"
				spellCheck
				style={{
					minHeight: '200px',
					padding: '12px',
					outline: 'none',
					lineHeight: '1.6',
					whiteSpace: 'pre-wrap',
					fontFamily: 'inherit',
				}}
			>
				{displayContent}
			</div>

			{/* Version History Panel */}
			{showVersionHistory && (
				<DraftVersionHistory
					emailId={emailId}
					currentContent={editorContainerRef.current?.innerText || displayContent}
					onRestore={handleRestoreVersion}
					onClose={() => setShowVersionHistory(false)}
				/>
			)}
		</div>
	);
};
