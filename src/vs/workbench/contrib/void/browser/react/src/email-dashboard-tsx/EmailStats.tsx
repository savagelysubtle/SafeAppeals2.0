/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';

// ============================================================================
// REUSABLE STYLES - VSCode Theme Variables
// ============================================================================

const statsBarStyle: React.CSSProperties = {
	backgroundColor: 'var(--vscode-input-background)',
	borderBottom: '1px solid var(--vscode-panel-border)',
};

const statCardStyle: React.CSSProperties = {
	backgroundColor: 'var(--vscode-button-secondaryBackground)',
	border: '1px solid var(--vscode-panel-border)',
	borderRadius: '8px',
};

const textPrimaryStyle: React.CSSProperties = {
	color: 'var(--vscode-editor-foreground)',
};

const textSecondaryStyle: React.CSSProperties = {
	color: 'var(--vscode-descriptionForeground)',
};

// ============================================================================
// TYPES
// ============================================================================

export interface EmailStatsData {
	totalEmails: number;
	draftCount: number;
	caseFolders: number;
	needsReply: number;
}

interface StatCardProps {
	icon: string;
	label: string;
	value: number;
	accentColor?: string;
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, accentColor }) => {
	return (
		<div
			className="flex items-center gap-3 px-4 py-2 transition-all"
			style={statCardStyle}
		>
			<i
				className={`codicon ${icon}`}
				style={{
					color: accentColor || 'var(--vscode-charts-blue)',
					fontSize: '16px',
				}}
			/>
			<div className="flex flex-col">
				<span
					className="text-lg font-semibold leading-tight"
					style={textPrimaryStyle}
				>
					{value}
				</span>
				<span
					className="text-xs"
					style={textSecondaryStyle}
				>
					{label}
				</span>
			</div>
		</div>
	);
};

// ============================================================================
// EMAIL STATS COMPONENT
// ============================================================================

interface EmailStatsProps {
	stats: EmailStatsData;
}

export const EmailStats: React.FC<EmailStatsProps> = ({ stats }) => {
	return (
		<div
			className="flex items-center gap-4 p-3"
			style={statsBarStyle}
		>
			<StatCard
				icon="codicon-mail"
				label="Total Emails"
				value={stats.totalEmails}
				accentColor="var(--vscode-charts-blue)"
			/>
			<StatCard
				icon="codicon-edit"
				label="Drafts"
				value={stats.draftCount}
				accentColor="var(--vscode-charts-yellow)"
			/>
			<StatCard
				icon="codicon-folder"
				label="Cases"
				value={stats.caseFolders}
				accentColor="var(--vscode-charts-green)"
			/>
			<StatCard
				icon="codicon-bell"
				label="Needs Reply"
				value={stats.needsReply}
				accentColor="var(--vscode-charts-orange)"
			/>
		</div>
	);
};
