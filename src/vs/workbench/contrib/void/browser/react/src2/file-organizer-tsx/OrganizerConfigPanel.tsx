/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import { FolderTemplate, FolderNode, OrganizerConfig } from '../../../fileOrganizer/types.js';
import { TemplateType, BUILT_IN_TEMPLATES } from './FilingCabinet.js';

interface OrganizerConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: OrganizerConfig;
  onSaveConfig: (config: OrganizerConfig) => void;
  customTemplates: FolderTemplate[];
  onSaveCustomTemplates: (templates: FolderTemplate[]) => void;
}

type ConfigTab = 'templates' | 'inbox' | 'behavior';

export const OrganizerConfigPanel: React.FC<OrganizerConfigPanelProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  customTemplates,
  onSaveCustomTemplates
}) => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('templates');
  const [editingTemplate, setEditingTemplate] = useState<FolderTemplate | null>(null);
  const [inboxPath, setInboxPath] = useState(config.customInboxPath || '');
  const [newTemplateName, setNewTemplateName] = useState('');

  // ============ STYLES ============
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: isOpen ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  };

  const panelStyle: React.CSSProperties = {
    backgroundColor: 'var(--vscode-editor-background)',
    border: '1px solid var(--vscode-panel-border)',
    borderRadius: '6px',
    width: '600px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--vscode-panel-border)'
  };

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: '4px',
    padding: '8px 16px',
    borderBottom: '1px solid var(--vscode-panel-border)',
    backgroundColor: 'var(--vscode-sideBar-background)'
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: isActive ?
    'var(--vscode-button-background)' :
    'transparent',
    color: isActive ?
    'var(--vscode-button-foreground)' :
    'var(--vscode-foreground)'
  });

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px'
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--vscode-descriptionForeground)',
    marginBottom: '6px',
    display: 'block'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    fontSize: '13px',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '4px',
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    outline: 'none'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)'
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)'
  };

  const templateCardStyle = (isSelected: boolean): React.CSSProperties => ({
    padding: '10px 12px',
    borderRadius: '4px',
    border: `1px solid ${isSelected ? 'var(--vscode-focusBorder)' : 'var(--vscode-panel-border)'}`,
    backgroundColor: isSelected ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
    marginBottom: '8px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  });

  // ============ HANDLERS ============
  const handleSaveInboxPath = useCallback(() => {
    onSaveConfig({
      ...config,
      customInboxPath: inboxPath || undefined,
      updatedAt: new Date().toISOString()
    });
  }, [config, inboxPath, onSaveConfig]);

  const handleCreateTemplate = useCallback(() => {
    if (!newTemplateName.trim()) return;

    const newTemplate: FolderTemplate = {
      id: `custom-${Date.now()}`,
      label: newTemplateName.trim(),
      isBuiltIn: false,
      folders: [
      { name: '01_Main', children: [] },
      { name: '02_Secondary', children: [] },
      { name: 'Core_References', children: [] }]

    };

    onSaveCustomTemplates([...customTemplates, newTemplate]);
    setNewTemplateName('');
    setEditingTemplate(newTemplate);
  }, [newTemplateName, customTemplates, onSaveCustomTemplates]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    onSaveCustomTemplates(customTemplates.filter((t) => t.id !== templateId));
    if (editingTemplate?.id === templateId) {
      setEditingTemplate(null);
    }
  }, [customTemplates, editingTemplate, onSaveCustomTemplates]);

  const handleUpdateFolder = useCallback((templateId: string, folderIndex: number, newName: string) => {
    const updated = customTemplates.map((t) => {
      if (t.id !== templateId) return t;
      const folders = [...t.folders];
      folders[folderIndex] = { ...folders[folderIndex], name: newName };
      return { ...t, folders };
    });
    onSaveCustomTemplates(updated);
  }, [customTemplates, onSaveCustomTemplates]);

  const handleAddFolder = useCallback((templateId: string) => {
    const updated = customTemplates.map((t) => {
      if (t.id !== templateId) return t;
      const newFolder: FolderNode = {
        name: `Folder_${t.folders.length + 1}`,
        children: []
      };
      return { ...t, folders: [...t.folders, newFolder] };
    });
    onSaveCustomTemplates(updated);
  }, [customTemplates, onSaveCustomTemplates]);

  const handleRemoveFolder = useCallback((templateId: string, folderIndex: number) => {
    const updated = customTemplates.map((t) => {
      if (t.id !== templateId) return t;
      const folders = t.folders.filter((_, i) => i !== folderIndex);
      return { ...t, folders };
    });
    onSaveCustomTemplates(updated);
  }, [customTemplates, onSaveCustomTemplates]);

  const handleAddSubfolder = useCallback((templateId: string, folderIndex: number) => {
    const updated = customTemplates.map((t) => {
      if (t.id !== templateId) return t;
      const folders = [...t.folders];
      const children = [...folders[folderIndex].children, `Subfolder_${folders[folderIndex].children.length + 1}`];
      folders[folderIndex] = { ...folders[folderIndex], children };
      return { ...t, folders };
    });
    onSaveCustomTemplates(updated);
  }, [customTemplates, onSaveCustomTemplates]);

  const handleUpdateSubfolder = useCallback((templateId: string, folderIndex: number, childIndex: number, newName: string) => {
    const updated = customTemplates.map((t) => {
      if (t.id !== templateId) return t;
      const folders = [...t.folders];
      const children = [...folders[folderIndex].children];
      children[childIndex] = newName;
      folders[folderIndex] = { ...folders[folderIndex], children };
      return { ...t, folders };
    });
    onSaveCustomTemplates(updated);
  }, [customTemplates, onSaveCustomTemplates]);

  const handleRemoveSubfolder = useCallback((templateId: string, folderIndex: number, childIndex: number) => {
    const updated = customTemplates.map((t) => {
      if (t.id !== templateId) return t;
      const folders = [...t.folders];
      const children = folders[folderIndex].children.filter((_, i) => i !== childIndex);
      folders[folderIndex] = { ...folders[folderIndex], children };
      return { ...t, folders };
    });
    onSaveCustomTemplates(updated);
  }, [customTemplates, onSaveCustomTemplates]);

  if (!isOpen) return null;

  // ============ RENDER ============
  return (
    <div style={overlayStyle} onClick={onClose}>
			<div style={panelStyle} onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div style={headerStyle}>
					<span style={{ fontWeight: 600, fontSize: '14px' }}>File Organizer Settings</span>
					<button
            style={{ ...secondaryButtonStyle, padding: '4px 8px' }}
            onClick={onClose}>
            
						Close
					</button>
				</div>

				{/* Tab Bar */}
				<div style={tabBarStyle}>
					<button style={tabStyle(activeTab === 'templates')} onClick={() => setActiveTab('templates')}>
						Folder Templates
					</button>
					<button style={tabStyle(activeTab === 'inbox')} onClick={() => setActiveTab('inbox')}>
						Inbox Settings
					</button>
					<button style={tabStyle(activeTab === 'behavior')} onClick={() => setActiveTab('behavior')}>
						Behavior
					</button>
				</div>

				{/* Content */}
				<div style={contentStyle} className="void-void-scrollbar">
					{/* Templates Tab */}
					{activeTab === 'templates' &&
          <>
							{/* Built-in Templates */}
							<div style={sectionStyle}>
								<label style={labelStyle}>Built-in Templates</label>
								{(['legal', 'research', 'business'] as TemplateType[]).map((t) =>
              <div key={t} style={templateCardStyle(config.selectedTemplateId === t)}>
										<span style={{ fontWeight: 500 }}>{BUILT_IN_TEMPLATES[t].label}</span>
										<span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
											{BUILT_IN_TEMPLATES[t].folders.length} folders
										</span>
									</div>
              )}
							</div>

							{/* Custom Templates */}
							<div style={sectionStyle}>
								<label style={labelStyle}>Custom Templates</label>
								{customTemplates.length === 0 ?
              <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginBottom: '12px' }}>
										No custom templates yet. Create one below.
									</div> :

              customTemplates.map((t) =>
              <div key={t.id} style={templateCardStyle(editingTemplate?.id === t.id)}>
											<span
                  style={{ fontWeight: 500, cursor: 'pointer' }}
                  onClick={() => setEditingTemplate(editingTemplate?.id === t.id ? null : t)}>
                  
												{t.label}
											</span>
											<div style={{ display: 'flex', gap: '4px' }}>
												<button
                    style={{ ...secondaryButtonStyle, padding: '2px 6px', fontSize: '11px' }}
                    onClick={() => setEditingTemplate(editingTemplate?.id === t.id ? null : t)}>
                    
													{editingTemplate?.id === t.id ? 'Done' : 'Edit'}
												</button>
												<button
                    style={{ ...secondaryButtonStyle, padding: '2px 6px', fontSize: '11px' }}
                    onClick={() => handleDeleteTemplate(t.id)}>
                    
													Delete
												</button>
											</div>
										</div>
              )
              }

								{/* Create New Template */}
								<div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
									<input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="New template name..."
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTemplate()} />
                
									<button style={buttonStyle} onClick={handleCreateTemplate}>
										Create
									</button>
								</div>
							</div>

							{/* Template Editor */}
							{editingTemplate &&
            <div style={{ ...sectionStyle, border: '1px solid var(--vscode-panel-border)', borderRadius: '4px', padding: '12px' }}>
									<label style={labelStyle}>Editing: {editingTemplate.label}</label>
									{editingTemplate.folders.map((folder, fIdx) =>
              <div key={fIdx} style={{ marginBottom: '12px' }}>
											<div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
												<span style={{ fontSize: '12px', opacity: 0.7 }}>📂</span>
												<input
                    style={{ ...inputStyle, flex: 1 }}
                    value={folder.name}
                    onChange={(e) => handleUpdateFolder(editingTemplate.id, fIdx, e.target.value)} />
                  
												<button
                    style={{ ...secondaryButtonStyle, padding: '2px 6px', fontSize: '10px' }}
                    onClick={() => handleAddSubfolder(editingTemplate.id, fIdx)}
                    title="Add subfolder">
                    
													+Sub
												</button>
												<button
                    style={{ ...secondaryButtonStyle, padding: '2px 6px', fontSize: '10px' }}
                    onClick={() => handleRemoveFolder(editingTemplate.id, fIdx)}
                    title="Remove folder">
                    
													X
												</button>
											</div>
											{/* Subfolders */}
											{folder.children.map((child, cIdx) =>
                <div key={cIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '24px', marginBottom: '4px' }}>
													<span style={{ fontSize: '11px', opacity: 0.5 }}>📄</span>
													<input
                    style={{ ...inputStyle, flex: 1, fontSize: '12px' }}
                    value={child}
                    onChange={(e) => handleUpdateSubfolder(editingTemplate.id, fIdx, cIdx, e.target.value)} />
                  
													<button
                    style={{ ...secondaryButtonStyle, padding: '2px 4px', fontSize: '10px' }}
                    onClick={() => handleRemoveSubfolder(editingTemplate.id, fIdx, cIdx)}>
                    
														X
													</button>
												</div>
                )}
										</div>
              )}
									<button
                style={{ ...buttonStyle, marginTop: '8px' }}
                onClick={() => handleAddFolder(editingTemplate.id)}>
                
										+ Add Folder
									</button>
								</div>
            }
						</>
          }

					{/* Inbox Tab */}
					{activeTab === 'inbox' &&
          <>
							<div style={sectionStyle}>
								<label style={labelStyle}>Custom Inbox Folder Path</label>
								<p style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginBottom: '8px' }}>
									Override the auto-detected "To Sort" folder. Leave empty to use auto-detect.
								</p>
								<div style={{ display: 'flex', gap: '8px' }}>
									<input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="e.g., ./Inbox or ./Documents/ToSort"
                  value={inboxPath}
                  onChange={(e) => setInboxPath(e.target.value)} />
                
									<button style={buttonStyle} onClick={handleSaveInboxPath}>
										Save
									</button>
								</div>
								{config.customInboxPath &&
              <div style={{ marginTop: '8px', fontSize: '11px' }}>
										<span style={{ color: 'var(--vscode-descriptionForeground)' }}>Current: </span>
										<strong>{config.customInboxPath}</strong>
										<button
                  style={{ ...secondaryButtonStyle, marginLeft: '8px', padding: '2px 6px', fontSize: '10px' }}
                  onClick={() => {
                    setInboxPath('');
                    onSaveConfig({ ...config, customInboxPath: undefined, updatedAt: new Date().toISOString() });
                  }}>
                  
											Clear
										</button>
									</div>
              }
							</div>
						</>
          }

					{/* Behavior Tab */}
					{activeTab === 'behavior' &&
          <>
							<div style={sectionStyle}>
								<label style={labelStyle}>Auto-Scan on Startup</label>
								<label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
									<input
                  type="checkbox"
                  checked={config.autoScanOnStartup}
                  onChange={(e) => onSaveConfig({
                    ...config,
                    autoScanOnStartup: e.target.checked,
                    updatedAt: new Date().toISOString()
                  })} />
                
									<span style={{ fontSize: '12px' }}>Automatically scan inbox folder when opening File Organizer</span>
								</label>
							</div>

							<div style={sectionStyle}>
								<label style={labelStyle}>Confidence Threshold: {(config.confidenceThreshold * 100).toFixed(0)}%</label>
								<p style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginBottom: '8px' }}>
									Minimum AI confidence required before suggesting a folder.
								</p>
								<input
                type="range"
                min="0"
                max="100"
                value={config.confidenceThreshold * 100}
                onChange={(e) => onSaveConfig({
                  ...config,
                  confidenceThreshold: parseInt(e.target.value, 10) / 100,
                  updatedAt: new Date().toISOString()
                })}
                style={{ width: '100%' }} />
              
							</div>
						</>
          }
				</div>
			</div>
		</div>);

};