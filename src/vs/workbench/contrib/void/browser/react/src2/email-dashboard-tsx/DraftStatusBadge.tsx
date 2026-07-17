/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useRef, useEffect } from 'react';
import { DraftStatus } from '../../../../common/emailService.js';

interface DraftStatusBadgeProps {
  status: DraftStatus;
  draftId: string;
  onStatusChange: (newStatus: DraftStatus) => void;
}

// Status configuration
interface StatusConfig {
  icon: string;
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const STATUS_CONFIGS: Record<DraftStatus, StatusConfig> = {
  'draft': {
    icon: '✏️',
    label: 'Draft',
    bgColor: 'var(--vscode-button-secondaryBackground)',
    textColor: 'var(--vscode-descriptionForeground)',
    borderColor: 'var(--vscode-panel-border)'
  },
  'reviewed': {
    icon: '👀',
    label: 'Reviewed',
    bgColor: 'var(--vscode-inputValidation-infoBackground)',
    textColor: 'var(--vscode-charts-blue)',
    borderColor: 'var(--vscode-inputValidation-infoBorder)'
  },
  'ready': {
    icon: '✅',
    label: 'Ready to Send',
    bgColor: 'var(--vscode-testing-iconPassed)',
    textColor: 'var(--vscode-charts-green)',
    borderColor: 'var(--vscode-charts-green)'
  },
  'sent': {
    icon: '📤',
    label: 'Sent',
    bgColor: 'var(--vscode-inputValidation-warningBackground)',
    textColor: 'var(--vscode-charts-purple)',
    borderColor: 'var(--vscode-inputValidation-warningBorder)'
  }
};

export const DraftStatusBadge: React.FC<DraftStatusBadgeProps> = ({
  status,
  draftId,
  onStatusChange
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const config = STATUS_CONFIGS[status];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  const handleStatusClick = (newStatus: DraftStatus) => {
    if (newStatus !== status) {
      onStatusChange(newStatus);
    }
    setShowDropdown(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
			{/* Current Status Badge - Clickable */}
			<button
        onClick={() => setShowDropdown(!showDropdown)}
        className="void-inline-flex void-items-center void-gap-1.5 void-rounded void-px-2.5 void-py-1 void-text-xs void-font-medium void-transition-all"
        style={{
          backgroundColor: config.bgColor,
          color: config.textColor,
          border: `1px solid ${config.borderColor}`,
          cursor: 'pointer'
        }}
        title="Change draft status">
        
				<span>{config.icon}</span>
				<span>{config.label}</span>
				<i
          className="void-codicon void-codicon-chevron-down"
          style={{
            fontSize: '10px',
            opacity: 0.7
          }} />
        
			</button>

			{/* Dropdown Menu */}
			{showDropdown &&
      <div
        className="void-void-scrollbar"
        style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          minWidth: '160px',
          backgroundColor: 'var(--vscode-dropdown-background)',
          border: '1px solid var(--vscode-dropdown-border)',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
        
					{/* Status Options */}
					{(Object.keys(STATUS_CONFIGS) as DraftStatus[]).map((statusOption) => {
          const optionConfig = STATUS_CONFIGS[statusOption];
          const isCurrentStatus = statusOption === status;
          const isDisabled = statusOption === 'sent'; // Can't manually mark as sent (will be in Phase 3)

          return (
            <button
              key={statusOption}
              onClick={() => !isDisabled && handleStatusClick(statusOption)}
              disabled={isDisabled}
              className="void-flex void-items-center void-gap-2 void-px-3 void-py-2 void-text-xs void-w-full void-text-left void-transition-colors"
              style={{
                backgroundColor: isCurrentStatus ?
                'var(--vscode-list-activeSelectionBackground)' :
                'transparent',
                color: isDisabled ?
                'var(--vscode-disabledForeground)' :
                'var(--vscode-dropdown-foreground)',
                border: 'none',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!isDisabled && !isCurrentStatus) {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDisabled && !isCurrentStatus) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}>
              
								<span>{optionConfig.icon}</span>
								<span style={{ flex: 1 }}>{optionConfig.label}</span>
								{isCurrentStatus &&
              <i
                className="void-codicon void-codicon-check"
                style={{
                  fontSize: '12px',
                  color: 'var(--vscode-charts-green)'
                }} />

              }
							</button>);

        })}
				</div>
      }
		</div>);

};