/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { formatTimelineDate } from '../../../../common/timeline/timelineTypes.js';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

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
          backgroundColor: BRAND_GREEN,
          boxShadow: `0 0 0 4px ${BRAND_GREEN}30`,
          animation: 'pulse 2s ease-in-out infinite'
        }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: '#0a0a0a' }}
        />
      </div>

      {/* Today line */}
      <div
        className="flex items-center gap-3 py-2 px-4 rounded-lg"
        style={{
          backgroundColor: `${BRAND_GREEN}10`,
          border: `1px dashed ${BRAND_GREEN}40`
        }}
      >
        <div
          className="flex items-center gap-2"
          style={{ color: BRAND_GREEN }}
        >
          <i className="codicon codicon-calendar" style={{ fontSize: '14px' }} />
          <span className="text-sm font-semibold tracking-wide">TODAY</span>
        </div>
        <div
          className="flex-1 h-px"
          style={{ background: `linear-gradient(to right, ${BRAND_GREEN}40, transparent)` }}
        />
        <span className="text-xs" style={{ color: '#71717a' }}>
          {formatTimelineDate(today)}
        </span>
      </div>

      {/* Inline keyframes for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px ${BRAND_GREEN}30;
          }
          50% {
            box-shadow: 0 0 0 8px ${BRAND_GREEN}15;
          }
        }
      `}</style>
    </div>
  );
};


