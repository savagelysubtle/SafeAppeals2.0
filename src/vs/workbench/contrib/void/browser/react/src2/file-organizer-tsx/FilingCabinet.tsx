/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { FolderTemplate, FolderNode } from '../../../fileOrganizer/types.js';

// Template types - exported for use in DocketDashboard and OrganizerConfigPanel
export type TemplateType = 'legal' | 'research' | 'business';

// Built-in template folder structures - exported for config panel
export const BUILT_IN_TEMPLATES: Record<TemplateType, {label: string;folders: FolderNode[];}> = {
  legal: {
    label: 'Legal',
    folders: [
    { name: '01_Your_Side', children: ['Medical_Treating', 'Legal_Representation', 'Personal_Statements'] },
    { name: '02_Their_Side', children: ['IME_Reports', 'Employer_Defense', 'WCB_Decisions'] },
    { name: '03_Correspondence', children: ['Incoming', 'Outgoing'] },
    { name: '04_Timeline_Evidence', children: [] },
    { name: '05_Appeals', children: [] },
    { name: '06_Reference', children: ['Templates'] },
    { name: 'Core_References', children: [] }]

  },
  research: {
    label: 'Research',
    folders: [
    { name: '01_Literature', children: ['Primary_Sources', 'Secondary_Sources', 'References'] },
    { name: '02_Data', children: ['Raw', 'Processed', 'Analysis'] },
    { name: '03_Drafts', children: [] },
    { name: '04_Final', children: [] },
    { name: '05_Notes', children: [] },
    { name: 'Core_References', children: [] }]

  },
  business: {
    label: 'Business',
    folders: [
    { name: '01_Admin', children: ['Contracts', 'Invoices', 'Licenses'] },
    { name: '02_Planning', children: ['Requirements', 'Proposals'] },
    { name: '03_Working', children: [] },
    { name: '04_Deliverables', children: [] },
    { name: '05_Communications', children: ['Internal', 'External'] },
    { name: 'Archive', children: [] },
    { name: 'Core_References', children: [] }]

  }
};

interface FilingCabinetProps {
  destinationFolder?: string;
  selectedTemplate: TemplateType | string; // string for custom template IDs
  onTemplateChange: (template: TemplateType | string) => void;
  customTemplates?: FolderTemplate[];
  /** Called when user clicks a folder to manually override AI suggestion */
  onFolderSelect?: (folderPath: string) => void;
  /** Whether a file is selected (enables folder clicking) */
  canSelectFolder?: boolean;
}

export const FilingCabinet: React.FC<FilingCabinetProps> = ({
  destinationFolder,
  selectedTemplate,
  onTemplateChange,
  customTemplates = [],
  onFolderSelect,
  canSelectFolder = false
}) => {
  // Get folder structure from selected template (built-in or custom)
  const getTreeData = (): FolderNode[] => {
    // Check built-in templates first
    if (selectedTemplate in BUILT_IN_TEMPLATES) {
      return BUILT_IN_TEMPLATES[selectedTemplate as TemplateType].folders;
    }
    // Check custom templates
    const customTemplate = customTemplates.find((t) => t.id === selectedTemplate);
    if (customTemplate) {
      return customTemplate.folders;
    }
    // Fallback to legal
    return BUILT_IN_TEMPLATES.legal.folders;
  };

  const treeData = getTreeData();

  // Styles
  const columnStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: 'var(--vscode-sideBar-background)'
  };

  const headerStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid var(--vscode-panel-border)',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--vscode-descriptionForeground)',
    letterSpacing: '0.5px'
  };

  const treeStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0'
  };

  const folderStyle = (isActive: boolean, isClickable: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: isClickable ? 'pointer' : 'default',
    backgroundColor: isActive ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
    color: isActive ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit',
    transition: 'background-color 0.1s'
  });

  const childStyle = (isActive: boolean, isClickable: boolean): React.CSSProperties => ({
    padding: '3px 12px 3px 32px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    cursor: isClickable ? 'pointer' : 'default',
    backgroundColor: isActive ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
    color: isActive ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
    opacity: isActive ? 1 : 0.85,
    transition: 'background-color 0.1s'
  });

  const templateButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '3px 8px',
    fontSize: '10px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    backgroundColor: isActive ?
    'var(--vscode-button-background)' :
    'var(--vscode-button-secondaryBackground)',
    color: isActive ?
    'var(--vscode-button-foreground)' :
    'var(--vscode-button-secondaryForeground)',
    textTransform: 'none',
    letterSpacing: 'normal'
  });

  const builtInTemplates: TemplateType[] = ['legal', 'research', 'business'];

  return (
    <div style={columnStyle}>
			<div style={headerStyle}>
				<div style={{ marginBottom: '8px' }}>📁 Destination</div>
				<div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
					{/* Built-in templates */}
					{builtInTemplates.map((template) =>
          <button
            key={template}
            style={templateButtonStyle(selectedTemplate === template)}
            onClick={() => onTemplateChange(template)}
            title={`Switch to ${BUILT_IN_TEMPLATES[template].label} folder layout`}>
            
							{BUILT_IN_TEMPLATES[template].label}
						</button>
          )}
					{/* Custom templates */}
					{customTemplates.map((template) =>
          <button
            key={template.id}
            style={templateButtonStyle(selectedTemplate === template.id)}
            onClick={() => onTemplateChange(template.id)}
            title={`Switch to ${template.label} folder layout (custom)`}>
            
							{template.label}
						</button>
          )}
				</div>
			</div>

			<div style={treeStyle} className="void-void-scrollbar">
				{destinationFolder &&
        <div style={{
          padding: '8px 12px',
          fontSize: '11px',
          color: 'var(--vscode-descriptionForeground)',
          borderBottom: '1px solid var(--vscode-panel-border)',
          marginBottom: '4px'
        }}>
						Filing to: <strong style={{ color: 'var(--vscode-foreground)' }}>{destinationFolder}</strong>
					</div>
        }

				{treeData.map((folder, idx) => {
          const folderActive = destinationFolder?.startsWith(folder.name);
          const isClickable = canSelectFolder && !!onFolderSelect;

          // Handle folder click (for folders without children, file directly there)
          const handleFolderClick = () => {
            if (isClickable && folder.children.length === 0) {
              onFolderSelect(folder.name);
            }
          };

          return (
            <div key={idx}>
							<div
                style={folderStyle(!!folderActive && folder.children.length === 0, isClickable && folder.children.length === 0)}
                onClick={handleFolderClick}
                onMouseEnter={(e) => {
                  if (isClickable && folder.children.length === 0) {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!folderActive || folder.children.length > 0) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  } else {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-list-activeSelectionBackground)';
                  }
                }}
                title={isClickable && folder.children.length === 0 ? `Click to file here: ${folder.name}` : undefined}>
                
								<span style={{ opacity: 0.7 }}>📂</span>
								<span>{folder.name}</span>
								{folderActive && !folder.children.some((c) => destinationFolder === `${folder.name}/${c}`) &&
                <span style={{ marginLeft: 'auto', fontSize: '10px' }}>◀</span>
                }
							</div>
							{folder.children.map((child, cIdx) => {
                const fullPath = `${folder.name}/${child}`;
                const isActive = destinationFolder === fullPath;

                const handleChildClick = () => {
                  if (isClickable) {
                    onFolderSelect(fullPath);
                  }
                };

                return (
                  <div
                    key={cIdx}
                    style={childStyle(isActive, isClickable)}
                    onClick={handleChildClick}
                    onMouseEnter={(e) => {
                      if (isClickable) {
                        e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      } else {
                        e.currentTarget.style.backgroundColor = 'var(--vscode-list-activeSelectionBackground)';
                      }
                    }}
                    title={isClickable ? `Click to file here: ${fullPath}` : undefined}>
                    
										<span style={{ opacity: 0.5 }}>📄</span>
										<span>{child}</span>
										{isActive && <span style={{ marginLeft: 'auto', fontSize: '10px' }}>◀</span>}
									</div>);

              })}
						</div>);

        })}
			</div>
		</div>);

};