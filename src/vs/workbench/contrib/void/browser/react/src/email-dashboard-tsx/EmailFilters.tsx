/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

interface EmailFiltersProps {
	caseFolders: string[];
	selectedCaseFolder: string | 'all';
	onCaseFolderChange: (folder: string | 'all') => void;
}

// Extract the case name from a full path
function getCaseName(folderPath: string): string {
	const parts = folderPath.split('/').filter(p => p);
	// Try to find the case name (usually after "cases")
	const casesIndex = parts.findIndex(p => p.toLowerCase() === 'cases');
	if (casesIndex !== -1 && casesIndex + 1 < parts.length) {
		return parts[casesIndex + 1];
	}
	// Fallback to last meaningful part
	return parts[parts.length - 1] || folderPath;
}

export const EmailFilters: React.FC<EmailFiltersProps> = ({
	caseFolders,
	selectedCaseFolder,
	onCaseFolderChange
}) => {
	return (
		<div
			className="px-4 py-3 flex flex-wrap items-center gap-4"
			style={{
				backgroundColor: '#0f0f0f',
				borderBottom: '1px solid #27272a'
			}}
		>
			{/* Case Folder Filter */}
			<div className="flex items-center gap-2">
				<label className="text-sm font-medium" style={{ color: '#a1a1aa' }}>
					Case Folder:
				</label>
				<select
					value={selectedCaseFolder}
					onChange={(e) => onCaseFolderChange(e.target.value)}
					className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer min-w-[200px]"
					style={{
						backgroundColor: '#1a1a1a',
						color: '#fafafa',
						border: '1px solid #27272a'
					}}
				>
					<option value="all">All Cases</option>
					{caseFolders.map((folder) => (
						<option key={folder} value={folder}>
							{getCaseName(folder)}
						</option>
					))}
				</select>
			</div>

			{/* Quick Filters */}
			<div className="flex items-center gap-2">
				<span className="text-sm" style={{ color: '#71717a' }}>Quick:</span>
				<button
					onClick={() => onCaseFolderChange('all')}
					className="px-3 py-1 rounded-lg text-xs transition-all"
					style={{
						backgroundColor: selectedCaseFolder === 'all' ? `${BRAND_GREEN}15` : '#1a1a1a',
						color: selectedCaseFolder === 'all' ? BRAND_GREEN : '#a1a1aa',
						border: `1px solid ${selectedCaseFolder === 'all' ? `${BRAND_GREEN}30` : '#27272a'}`
					}}
				>
					All
				</button>
			</div>

			{/* Clear Filters */}
			{selectedCaseFolder !== 'all' && (
				<button
					onClick={() => onCaseFolderChange('all')}
					className="ml-auto text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
					style={{
						backgroundColor: '#1a1a1a',
						color: '#a1a1aa',
						border: '1px solid #27272a'
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = '#27272a';
						e.currentTarget.style.color = '#fafafa';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = '#1a1a1a';
						e.currentTarget.style.color = '#a1a1aa';
					}}
				>
					<i className="codicon codicon-close" style={{ fontSize: '10px' }} />
					Clear Filters
				</button>
			)}
		</div>
	);
};

