/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useCallback } from 'react';
import { useAccessor } from '../util/services.js';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

// File icons based on extension
const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  pdf: { icon: 'file-pdf', color: '#ef4444' },
  doc: { icon: 'file-text', color: '#3b82f6' },
  docx: { icon: 'file-text', color: '#3b82f6' },
  txt: { icon: 'file-text', color: '#6b7280' },
  jpg: { icon: 'file-media', color: '#f59e0b' },
  jpeg: { icon: 'file-media', color: '#f59e0b' },
  png: { icon: 'file-media', color: '#f59e0b' },
  gif: { icon: 'file-media', color: '#f59e0b' },
  default: { icon: 'file', color: '#64748b' }
};

function getFileIcon(filename: string): { icon: string; color: string } {
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

  // Load workspace files on mount
  useEffect(() => {
    const loadFiles = async () => {
      setIsLoading(true);
      try {
        // Get workspace files via the file service
        const workspaceService = accessor.get('IWorkspaceContextService');
        const fileService = accessor.get('IFileService');
        
        const folders = workspaceService.getWorkspace().folders;
        if (folders.length === 0) {
          setWorkspaceFiles([]);
          return;
        }

        const folderUri = folders[0].uri;
        const files: WorkspaceFile[] = [];

        // Recursive file listing (limited to common document types)
        const listDir = async (dirUri: any, depth: number = 0) => {
          if (depth > 3) return; // Limit depth to avoid huge lists
          
          try {
            const stat = await fileService.resolve(dirUri);
            if (stat.children) {
              for (const child of stat.children) {
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
        setWorkspaceFiles(files);
      } catch (error) {
        console.error('[DocumentPicker] Error loading files:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFiles();
  }, [accessor]);

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
          backgroundColor: '#0f0f0f',
          border: `1px solid ${BRAND_GREEN}30`,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px ${BRAND_GREEN}10`
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${BRAND_GREEN}20` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${BRAND_GREEN}15` }}
            >
              <i className="codicon codicon-file-symlink-file" style={{ color: BRAND_GREEN, fontSize: '16px' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: '#fafafa' }}>
                Link Documents
              </h2>
              <p className="text-xs" style={{ color: '#71717a' }}>
                {linkedDocuments.length} linked • {workspaceFiles.length} available
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#71717a' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f1f1f'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <i className="codicon codicon-close" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #27272a' }}>
          <div className="relative">
            <i 
              className="codicon codicon-search absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: '#71717a', fontSize: '14px' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #27272a',
                color: '#fafafa',
                outline: 'none'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = BRAND_GREEN}
              onBlur={(e) => e.currentTarget.style.borderColor = '#27272a'}
            />
          </div>
        </div>

        {/* Linked Documents Section */}
        {linkedDocuments.length > 0 && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #27272a' }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: BRAND_GREEN }}>
              Linked Documents
            </div>
            <div className="space-y-1">
              {linkedDocuments.map(uri => {
                const fileName = getFileName(uri);
                const { icon, color } = getFileIcon(fileName);
                return (
                  <div
                    key={uri}
                    className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ backgroundColor: `${BRAND_GREEN}10`, border: `1px solid ${BRAND_GREEN}30` }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <i className={`codicon codicon-${icon}`} style={{ color, fontSize: '14px' }} />
                      <span className="text-sm truncate" style={{ color: '#fafafa' }}>{fileName}</span>
                    </div>
                    <button
                      onClick={() => onUnlink(uri)}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{ color: '#ef4444' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ef444420'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#52525b' }}>
            Workspace Documents
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div
                className="rounded-full h-6 w-6 border-2 animate-spin"
                style={{ borderColor: `${BRAND_GREEN} transparent ${BRAND_GREEN} transparent` }}
              />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#71717a' }}>
              {searchQuery ? 'No matching documents found' : 'No documents in workspace'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredFiles.map(file => {
                const { icon, color } = getFileIcon(file.name);
                const linked = isLinked(file.uri);
                return (
                  <button
                    key={file.uri}
                    onClick={() => linked ? onUnlink(file.uri) : onLink(file.uri)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all"
                    style={{
                      backgroundColor: linked ? `${BRAND_GREEN}10` : 'transparent',
                      border: linked ? `1px solid ${BRAND_GREEN}30` : '1px solid transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (!linked) e.currentTarget.style.backgroundColor = '#1a1a1a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = linked ? `${BRAND_GREEN}10` : 'transparent';
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <i className={`codicon codicon-${icon}`} style={{ color, fontSize: '14px' }} />
                      <div className="min-w-0">
                        <div className="text-sm truncate" style={{ color: '#fafafa' }}>{file.name}</div>
                        <div className="text-xs truncate" style={{ color: '#52525b' }}>{file.path}</div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {linked ? (
                        <i className="codicon codicon-check" style={{ color: BRAND_GREEN, fontSize: '14px' }} />
                      ) : (
                        <i className="codicon codicon-add" style={{ color: '#71717a', fontSize: '14px' }} />
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
          style={{ borderTop: '1px solid #27272a' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            style={{
              backgroundColor: BRAND_GREEN,
              color: '#0a0a0a'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

