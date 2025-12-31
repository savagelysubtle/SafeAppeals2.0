/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from 'react';
import { Email } from '../../../../common/emailService.js';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

interface EmailCardProps {
	email: Email;
	onClick: () => void;
	onDelete: () => void;
	onDraftReply: () => void;
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
		'#d946ef', '#ec4899', '#f43f5e'
	];
	let hash = 0;
	for (let i = 0; i < email.length; i++) {
		hash = ((hash << 5) - hash) + email.charCodeAt(i);
		hash = hash & hash;
	}
	return colors[Math.abs(hash) % colors.length];
}

export const EmailCard: React.FC<EmailCardProps> = ({ email, onClick, onDelete, onDraftReply }) => {
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [isDrafting, setIsDrafting] = useState(false);

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
			await onDraftReply();
		} finally {
			setIsDrafting(false);
		}
	};

	const avatarColor = getAvatarColor(email.from);
	const initials = getInitials(email.from);
	const fromName = email.from.split('<')[0].trim() || email.from;

	return (
		<div
			className="rounded-xl transition-all duration-200 cursor-pointer group"
			style={{
				backgroundColor: '#111111',
				border: `1px solid ${isHovered ? BRAND_GREEN : '#27272a'}`,
				boxShadow: isHovered ? `0 4px 12px ${BRAND_GREEN}10` : 'none'
			}}
			onClick={onClick}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className="p-4 flex items-start gap-4">
				{/* Avatar */}
				<div
					className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold"
					style={{ backgroundColor: avatarColor, color: '#fafafa' }}
				>
					{initials}
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-start justify-between gap-3">
						<div className="flex-1 min-w-0">
							{/* From + Date Row */}
							<div className="flex items-center gap-2 mb-1">
								<span className="font-semibold text-sm truncate" style={{ color: '#fafafa' }}>
									{fromName}
								</span>
								{email.isDraft && (
									<span
										className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
										style={{
											backgroundColor: '#f59e0b20',
											color: '#f59e0b',
											border: '1px solid #f59e0b30'
										}}
									>
										Draft
									</span>
								)}
								{email.attachments.length > 0 && (
									<i
										className="codicon codicon-file-symlink-file"
										style={{ color: '#71717a', fontSize: '12px' }}
										title={`${email.attachments.length} attachment${email.attachments.length !== 1 ? 's' : ''}`}
									/>
								)}
							</div>

							{/* Subject */}
							<h3 className="font-medium text-sm mb-1 truncate" style={{ color: '#e4e4e7' }}>
								{email.subject}
							</h3>

							{/* Preview */}
							<p
								className="text-xs line-clamp-2"
								style={{ color: '#71717a' }}
							>
								{email.bodyText.substring(0, 150)}...
							</p>
						</div>

						{/* Right Side - Date & Actions */}
						<div className="flex flex-col items-end gap-2">
							<span className="text-xs whitespace-nowrap" style={{ color: '#71717a' }}>
								{formatEmailDate(email.date)}
							</span>

							{/* Action Buttons */}
							<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
								{/* Draft Reply Button */}
								<button
									onClick={handleDraftReply}
									disabled={isDrafting}
									className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
									style={{
										backgroundColor: isDrafting ? BRAND_GREEN : '#1a1a1a',
										border: `1px solid ${isDrafting ? BRAND_GREEN : '#27272a'}`,
										color: isDrafting ? '#0a0a0a' : '#a1a1aa',
										opacity: isDrafting ? 0.7 : 1,
										cursor: isDrafting ? 'wait' : 'pointer'
									}}
									onMouseEnter={(e) => {
										if (!isDrafting) {
											e.currentTarget.style.backgroundColor = BRAND_GREEN;
											e.currentTarget.style.borderColor = BRAND_GREEN;
											e.currentTarget.style.color = '#0a0a0a';
										}
									}}
									onMouseLeave={(e) => {
										if (!isDrafting) {
											e.currentTarget.style.backgroundColor = '#1a1a1a';
											e.currentTarget.style.borderColor = '#27272a';
											e.currentTarget.style.color = '#a1a1aa';
										}
									}}
									title={isDrafting ? 'Generating draft...' : 'Draft Reply (AI)'}
								>
									<i className={`codicon ${isDrafting ? 'codicon-loading codicon-modifier-spin' : 'codicon-reply'}`} style={{ fontSize: '12px' }} />
								</button>

								{/* Open Button */}
								<button
									onClick={(e) => {
										e.stopPropagation();
										onClick();
									}}
									className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
									style={{
										backgroundColor: '#1a1a1a',
										border: '1px solid #27272a',
										color: '#a1a1aa'
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor = BRAND_GREEN;
										e.currentTarget.style.borderColor = BRAND_GREEN;
										e.currentTarget.style.color = '#0a0a0a';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = '#1a1a1a';
										e.currentTarget.style.borderColor = '#27272a';
										e.currentTarget.style.color = '#a1a1aa';
									}}
									title="Open email"
								>
									<i className="codicon codicon-go-to-file" style={{ fontSize: '12px' }} />
								</button>

								{/* Delete Button */}
								<button
									onClick={handleDelete}
									className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
									style={{
										backgroundColor: confirmDelete ? '#ef4444' : '#1a1a1a',
										border: `1px solid ${confirmDelete ? '#ef4444' : '#27272a'}`,
										color: confirmDelete ? '#fafafa' : '#a1a1aa'
									}}
									onMouseEnter={(e) => {
										if (!confirmDelete) {
											e.currentTarget.style.backgroundColor = '#ef444420';
											e.currentTarget.style.borderColor = '#ef4444';
											e.currentTarget.style.color = '#ef4444';
										}
									}}
									onMouseLeave={(e) => {
										if (!confirmDelete) {
											e.currentTarget.style.backgroundColor = '#1a1a1a';
											e.currentTarget.style.borderColor = '#27272a';
											e.currentTarget.style.color = '#a1a1aa';
										}
									}}
									title={confirmDelete ? 'Click again to confirm' : 'Delete email'}
								>
									<i className={`codicon ${confirmDelete ? 'codicon-check' : 'codicon-trash'}`} style={{ fontSize: '12px' }} />
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* File Type Badge */}
			<div
				className="px-4 pb-3 flex items-center gap-2"
				style={{ borderTop: '1px solid #1f1f1f' }}
			>
				<span
					className="inline-flex items-center rounded px-2 py-0.5 text-xs"
					style={{
						backgroundColor: email.fileType === 'eml' ? '#3b82f620' : '#ef444420',
						color: email.fileType === 'eml' ? '#3b82f6' : '#ef4444'
					}}
				>
					<i
						className={`codicon ${email.fileType === 'eml' ? 'codicon-mail' : 'codicon-file-pdf'} mr-1`}
						style={{ fontSize: '10px' }}
					/>
					{email.fileType.toUpperCase()}
				</span>
				<span className="text-xs truncate" style={{ color: '#52525b' }}>
					{email.caseFolderPath.split('/').pop()}
				</span>
			</div>
		</div>
	);
};

