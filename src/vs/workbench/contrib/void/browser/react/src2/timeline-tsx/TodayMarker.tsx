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
    <div className="void-relative void-pl-12 void-my-4">
      {/* Today indicator dot - pulsing animation */}
      <div
        className="void-absolute void-left-4 void-w-5 void-h-5 void-rounded-full void-transform -void-translate-x-1/2 void-z-20 void-flex void-items-center void-justify-center"
        style={{
          backgroundColor: 'var(--vscode-button-background)',
          boxShadow: '0 0 0 4px var(--vscode-button-secondaryBackground)'
        }}>
        
        <div
          className="void-w-2 void-h-2 void-rounded-full"
          style={{ backgroundColor: 'var(--vscode-editor-background)' }} />
        
      </div>

      {/* Today line */}
      <div
        className="void-flex void-items-center void-gap-3 void-py-2 void-px-4 void-rounded-lg"
        style={{
          backgroundColor: 'var(--vscode-button-secondaryBackground)',
          border: '1px dashed var(--vscode-panel-border)'
        }}>
        
        <div
          className="void-flex void-items-center void-gap-2"
          style={{ color: 'var(--vscode-button-background)' }}>
          
          <i className="void-codicon void-codicon-calendar" style={{ fontSize: '14px' }} />
          <span className="void-text-sm void-font-semibold void-tracking-wide">TODAY</span>
        </div>
        <div
          className="void-flex-1 void-h-px"
          style={{ backgroundColor: 'var(--vscode-panel-border)' }} />
        
        <span className="void-text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {formatTimelineDate(today)}
        </span>
      </div>
    </div>);

};