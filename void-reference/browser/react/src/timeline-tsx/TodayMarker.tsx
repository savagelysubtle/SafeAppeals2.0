/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { formatTimelineDate } from '../../../../common/timeline/timelineTypes.js';

interface TodayMarkerProps {
  position?: 'before' | 'after' | 'between';
}

export const TodayMarker: React.FC<TodayMarkerProps> = ({ position = 'between' }) => {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="relative pl-12 my-4">
      {/* Today indicator dot - pulsing animation */}
      <div
        className="absolute left-4 w-5 h-5 rounded-full transform -translate-x-1/2 z-20 flex items-center justify-center"
        style={{
          backgroundColor: 'var(--vscode-button-background)',
          boxShadow: '0 0 0 4px var(--vscode-button-secondaryBackground)',
        }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: 'var(--vscode-editor-background)' }}
        />
      </div>

      {/* Today line */}
      <div
        className="flex items-center gap-3 py-2 px-4 rounded-lg"
        style={{
          backgroundColor: 'var(--vscode-button-secondaryBackground)',
          border: '1px dashed var(--vscode-panel-border)'
        }}
      >
        <div
          className="flex items-center gap-2"
          style={{ color: 'var(--vscode-button-background)' }}
        >
          <i className="codicon codicon-calendar" style={{ fontSize: '14px' }} />
          <span className="text-sm font-semibold tracking-wide">TODAY</span>
        </div>
        <div
          className="flex-1 h-px"
          style={{ backgroundColor: 'var(--vscode-panel-border)' }}
        />
        <span className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {formatTimelineDate(today)}
        </span>
      </div>
    </div>
  );
};


