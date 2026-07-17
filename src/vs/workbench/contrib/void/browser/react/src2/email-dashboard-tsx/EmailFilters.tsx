/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';

// ============================================================================
// REUSABLE STYLES - VSCode Theme Variables
// ============================================================================

const panelStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-sideBar-background)',
  borderBottom: '1px solid var(--vscode-panel-border)'
};

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-dropdown-background)',
  color: 'var(--vscode-dropdown-foreground)',
  border: '1px solid var(--vscode-dropdown-border)',
  borderRadius: '8px',
  cursor: 'pointer'
};

const buttonSecondaryStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '8px',
  cursor: 'pointer'
};

const textSecondaryStyle: React.CSSProperties = {
  color: 'var(--vscode-descriptionForeground)'
};

interface EmailFiltersProps {
  caseFolders: string[];
  selectedCaseFolder: string | 'all';
  onCaseFolderChange: (folder: string | 'all') => void;
}

// Extract the case name from a full path
function getCaseName(folderPath: string): string {
  const parts = folderPath.split('/').filter((p) => p);
  // Try to find the case name (usually after "cases")
  const casesIndex = parts.findIndex((p) => p.toLowerCase() === 'cases');
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
      className="void-px-4 void-py-3 void-flex void-flex-wrap void-items-center void-gap-4"
      style={panelStyle}>
      
			{/* Case Folder Filter */}
			<div className="void-flex void-items-center void-gap-2">
				<label className="void-text-sm void-font-medium" style={textSecondaryStyle}>
					Case Folder:
				</label>
				<select
          value={selectedCaseFolder}
          onChange={(e) => onCaseFolderChange(e.target.value)}
          className="void-px-3 void-py-1.5 void-text-sm void-outline-none void-min-w-[200px]"
          style={selectStyle}>
          
					<option value="all">All Cases</option>
					{caseFolders.map((folder) =>
          <option key={folder} value={folder}>
							{getCaseName(folder)}
						</option>
          )}
				</select>
			</div>

			{/* Quick Filters */}
			<div className="void-flex void-items-center void-gap-2">
				<span className="void-text-sm" style={textSecondaryStyle}>Quick:</span>
				<button
          onClick={() => onCaseFolderChange('all')}
          className="void-px-3 void-py-1 void-rounded-lg void-text-xs void-transition-all"
          style={{
            backgroundColor: selectedCaseFolder === 'all' ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-button-secondaryBackground)',
            color: selectedCaseFolder === 'all' ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-descriptionForeground)',
            border: selectedCaseFolder === 'all' ? '1px solid var(--vscode-focusBorder)' : '1px solid var(--vscode-panel-border)'
          }}>
          
					All
				</button>
			</div>

			{/* Clear Filters */}
			{selectedCaseFolder !== 'all' &&
      <button
        onClick={() => onCaseFolderChange('all')}
        className="void-ml-auto void-text-xs void-px-3 void-py-1.5 void-rounded-lg void-flex void-items-center void-gap-1.5 void-transition-all"
        style={buttonSecondaryStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
          e.currentTarget.style.color = 'var(--vscode-editor-foreground)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
          e.currentTarget.style.color = 'var(--vscode-button-secondaryForeground)';
        }}>
        
					<i className="void-codicon void-codicon-close" style={{ fontSize: '10px' }} />
					Clear Filters
				</button>
      }
		</div>);

};