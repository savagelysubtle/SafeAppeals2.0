/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';
import { useAccessor } from '../util/services.js';

// Reusable style objects with VSCode CSS variables
const modalStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-sideBar-background)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '12px',
};

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: '8px',
};

const buttonPrimaryStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
};

const buttonSecondaryStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '8px',
};

const textPrimaryStyle: React.CSSProperties = {
  color: 'var(--vscode-editor-foreground)',
};

const textMutedStyle: React.CSSProperties = {
  color: 'var(--vscode-descriptionForeground)',
};

// File icons based on extension - using VSCode semantic colors
const FILE_ICONS: Record<string, { icon: string; colorVar: string }> = {
  pdf: { icon: 'file-pdf', colorVar: 'var(--vscode-charts-red)' },
  doc: { icon: 'file-text', colorVar: 'var(--vscode-charts-blue)' },
  docx: { icon: 'file-text', colorVar: 'var(--vscode-charts-blue)' },
  txt: { icon: 'file-text', colorVar: 'var(--vscode-descriptionForeground)' },
  jpg: { icon: 'file-media', colorVar: 'var(--vscode-charts-orange)' },
  jpeg: { icon: 'file-media', colorVar: 'var(--vscode-charts-orange)' },
  png: { icon: 'file-media', colorVar: 'var(--vscode-charts-orange)' },
  gif: { icon: 'file-media', colorVar: 'var(--vscode-charts-orange)' },
  default: { icon: 'file', colorVar: 'var(--vscode-descriptionForeground)' }
};

function getFileIcon(filename: string): { icon: string; colorVar: string } {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

function getFileName(uri: string): string {
  const parts = uri.split('/');
  return parts[parts.length - 1] || uri;
}

interface DocumentPickerProps {
  linkedDocuments: string[];
  onLink: (uri: string) => void;
  onUnlink: (uri: string) => void;
  onClose: () => void;
}

interface WorkspaceFile {
  uri: string;
  name: string;
  path: string;
}

export const DocumentPicker: React.FC<DocumentPickerProps> = ({
  linkedDocuments,
  onLink,
  onUnlink,
  onClose
}) => {
  const accessor = useAccessor();
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Get services once (these are stable references)
  const workspaceService = accessor.get('IWorkspaceContextService');
  const fileService = accessor.get('IFileService');

  // Load workspace files on mount only (empty dependency array)
  useEffect(() => {
    let cancelled = false;

    const loadFiles = async () => {
      setIsLoading(true);
      try {
        const folders = workspaceService.getWorkspace().folders;
        if (folders.length === 0) {
          setWorkspaceFiles([]);
          return;
        }

        const folderUri = folders[0].uri;
        const files: WorkspaceFile[] = [];

        // Recursive file listing (limited to common document types)
        const listDir = async (dirUri: any, depth: number = 0) => {
          if (depth > 3 || cancelled) return; // Limit depth to avoid huge lists

          try {
            const stat = await fileService.resolve(dirUri);
            if (stat.children) {
              for (const child of stat.children) {
                if (cancelled) return;
                if (child.isDirectory) {
                  // Skip common non-document directories
                  const name = child.name.toLowerCase();
                  if (['node_modules', '.git', '.vscode', 'out', 'dist', 'build'].includes(name)) {
                    continue;
                  }
                  await listDir(child.resource, depth + 1);
                } else {
                  // Include common document file types
                  const ext = child.name.split('.').pop()?.toLowerCase();
                  if (['pdf', 'doc', 'docx', 'txt', 'md', 'jpg', 'jpeg', 'png', 'gif', 'rtf', 'odt'].includes(ext || '')) {
                    files.push({
                      uri: child.resource.toString(),
                      name: child.name,
                      path: child.resource.path.replace(folderUri.path, '')
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.error('[DocumentPicker] Error listing directory:', e);
          }
        };

        await listDir(folderUri);
        if (!cancelled) {
          setWorkspaceFiles(files);
        }
      } catch (error) {
        console.error('[DocumentPicker] Error loading files:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadFiles();

    return () => {
      cancelled = true;
    };
  }, []); // Empty dependency array - run only on mount

  // Filter files by search query
  const filteredFiles = workspaceFiles.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLinked = (uri: string) => linkedDocuments.includes(uri);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl"
        style={{
          ...modalStyle,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)' }}
            >
              <i className="codicon codicon-file-symlink-file" style={{ color: 'var(--vscode-button-background)', fontSize: '16px' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={textPrimaryStyle}>
                Link Documents
              </h2>
              <p className="text-xs" style={textMutedStyle}>
                {linkedDocuments.length} linked • {workspaceFiles.length} available
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={buttonSecondaryStyle}
          >
            <i className="codicon codicon-close" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
          <div className="relative">
            <i
              className="codicon codicon-search absolute left-3 top-1/2 -translate-y-1/2"
              style={textMutedStyle}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Linked Documents Section */}
        {linkedDocuments.length > 0 && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--vscode-button-background)' }}>
              Linked Documents
            </div>
            <div className="space-y-1">
              {linkedDocuments.map(uri => {
                const fileName = getFileName(uri);
                const { icon, colorVar } = getFileIcon(fileName);
                return (
                  <div
                    key={uri}
                    className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)', border: '1px solid var(--vscode-panel-border)' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <i className={`codicon codicon-${icon}`} style={{ color: colorVar, fontSize: '14px' }} />
                      <span className="text-sm truncate" style={textPrimaryStyle}>{fileName}</span>
                    </div>
                    <button
                      onClick={() => onUnlink(uri)}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{ color: 'var(--vscode-errorForeground)' }}
                    >
                      Unlink
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* File List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 void-scrollbar">
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--vscode-disabledForeground)' }}>
            Workspace Documents
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div
                className="rounded-full h-6 w-6 border-2 animate-spin"
                style={{ borderColor: 'var(--vscode-button-background) transparent var(--vscode-button-background) transparent' }}
              />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-8" style={textMutedStyle}>
              {searchQuery ? 'No matching documents found' : 'No documents in workspace'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredFiles.map(file => {
                const { icon, colorVar } = getFileIcon(file.name);
                const linked = isLinked(file.uri);
                return (
                  <button
                    key={file.uri}
                    onClick={() => linked ? onUnlink(file.uri) : onLink(file.uri)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all"
                    style={{
                      backgroundColor: linked ? 'var(--vscode-button-secondaryBackground)' : 'transparent',
                      border: linked ? '1px solid var(--vscode-panel-border)' : '1px solid transparent'
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <i className={`codicon codicon-${icon}`} style={{ color: colorVar, fontSize: '14px' }} />
                      <div className="min-w-0">
                        <div className="text-sm truncate" style={textPrimaryStyle}>{file.name}</div>
                        <div className="text-xs truncate" style={{ color: 'var(--vscode-disabledForeground)' }}>{file.path}</div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {linked ? (
                        <i className="codicon codicon-check" style={{ color: 'var(--vscode-button-background)', fontSize: '14px' }} />
                      ) : (
                        <i className="codicon codicon-add" style={textMutedStyle} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex justify-end"
          style={{ borderTop: '1px solid var(--vscode-panel-border)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            style={buttonPrimaryStyle}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

