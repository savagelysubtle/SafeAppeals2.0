/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useRef, useEffect } from 'react';

interface ReminderPickerProps {
  currentDate?: Date;
  onSetReminder: (date: Date | null) => void;
  onClose: () => void;
}

// ============================================================================
// STYLES
// ============================================================================

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  right: 0,
  marginTop: '4px',
  backgroundColor: 'var(--vscode-dropdown-background)',
  border: '1px solid var(--vscode-dropdown-border)',
  borderRadius: '8px',
  padding: '8px',
  minWidth: '200px',
  zIndex: 1000,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
};

const optionButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '8px 12px',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: '6px',
  color: 'var(--vscode-dropdown-foreground)',
  cursor: 'pointer',
  fontSize: '13px',
  textAlign: 'left'
};

const optionButtonHoverStyle: React.CSSProperties = {
  ...optionButtonStyle,
  backgroundColor: 'var(--vscode-list-hoverBackground)'
};

const separatorStyle: React.CSSProperties = {
  height: '1px',
  backgroundColor: 'var(--vscode-dropdown-border)',
  margin: '8px 0'
};

const dateInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  backgroundColor: 'var(--vscode-input-background)',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: '6px',
  color: 'var(--vscode-input-foreground)',
  fontSize: '13px'
};

const currentReminderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  marginBottom: '8px',
  backgroundColor: 'var(--vscode-inputValidation-infoBackground)',
  border: '1px solid var(--vscode-inputValidation-infoBorder)',
  borderRadius: '6px',
  color: 'var(--vscode-charts-blue)',
  fontSize: '12px'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getTomorrow(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow;
}

function getNextWeek(): Date {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(9, 0, 0, 0);
  return nextWeek;
}

function getNextMonth(): Date {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setHours(9, 0, 0, 0);
  return nextMonth;
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatReminderDate(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return 'Today';
  } else if (days === 1) {
    return 'Tomorrow';
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'long' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ReminderPicker: React.FC<ReminderPickerProps> = ({
  currentDate,
  onSetReminder,
  onClose
}) => {
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState(formatDateForInput(getTomorrow()));
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleQuickOption = (date: Date) => {
    onSetReminder(date);
    onClose();
  };

  const handleCustomDateSubmit = () => {
    const date = new Date(customDate);
    date.setHours(9, 0, 0, 0);
    onSetReminder(date);
    onClose();
  };

  const handleClearReminder = () => {
    onSetReminder(null);
    onClose();
  };

  return (
    <div ref={dropdownRef} style={dropdownStyle} onClick={(e) => e.stopPropagation()}>
			{/* Current Reminder Display */}
			{currentDate &&
      <div style={currentReminderStyle}>
					<i className="void-codicon void-codicon-bell-dot" style={{ fontSize: '14px' }} />
					<span>Reminder: {formatReminderDate(currentDate)}</span>
				</div>
      }

			{/* Quick Options */}
			{!showCustom &&
      <>
					<button
          style={hoveredOption === 'tomorrow' ? optionButtonHoverStyle : optionButtonStyle}
          onMouseEnter={() => setHoveredOption('tomorrow')}
          onMouseLeave={() => setHoveredOption(null)}
          onClick={() => handleQuickOption(getTomorrow())}>
          
						<i className="void-codicon void-codicon-calendar" style={{ fontSize: '14px' }} />
						<span>Tomorrow</span>
					</button>

					<button
          style={hoveredOption === 'nextWeek' ? optionButtonHoverStyle : optionButtonStyle}
          onMouseEnter={() => setHoveredOption('nextWeek')}
          onMouseLeave={() => setHoveredOption(null)}
          onClick={() => handleQuickOption(getNextWeek())}>
          
						<i className="void-codicon void-codicon-calendar" style={{ fontSize: '14px' }} />
						<span>Next Week</span>
					</button>

					<button
          style={hoveredOption === 'nextMonth' ? optionButtonHoverStyle : optionButtonStyle}
          onMouseEnter={() => setHoveredOption('nextMonth')}
          onMouseLeave={() => setHoveredOption(null)}
          onClick={() => handleQuickOption(getNextMonth())}>
          
						<i className="void-codicon void-codicon-calendar" style={{ fontSize: '14px' }} />
						<span>Next Month</span>
					</button>

					<div style={separatorStyle} />

					<button
          style={hoveredOption === 'custom' ? optionButtonHoverStyle : optionButtonStyle}
          onMouseEnter={() => setHoveredOption('custom')}
          onMouseLeave={() => setHoveredOption(null)}
          onClick={() => setShowCustom(true)}>
          
						<i className="void-codicon void-codicon-edit" style={{ fontSize: '14px' }} />
						<span>Pick a Date...</span>
					</button>

					{currentDate &&
        <>
							<div style={separatorStyle} />
							<button
            style={{
              ...(hoveredOption === 'clear' ? optionButtonHoverStyle : optionButtonStyle),
              color: 'var(--vscode-charts-red)'
            }}
            onMouseEnter={() => setHoveredOption('clear')}
            onMouseLeave={() => setHoveredOption(null)}
            onClick={handleClearReminder}>
            
								<i className="void-codicon void-codicon-trash" style={{ fontSize: '14px' }} />
								<span>Clear Reminder</span>
							</button>
						</>
        }
				</>
      }

			{/* Custom Date Picker */}
			{showCustom &&
      <>
					<div style={{ marginBottom: '8px' }}>
						<input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            min={formatDateForInput(new Date())}
            style={dateInputStyle}
            autoFocus />
          
					</div>

					<div style={{ display: 'flex', gap: '8px' }}>
						<button
            style={{
              ...optionButtonStyle,
              backgroundColor: 'var(--vscode-button-secondaryBackground)',
              border: '1px solid var(--vscode-panel-border)',
              flex: 1,
              justifyContent: 'center'
            }}
            onClick={() => setShowCustom(false)}>
            
							Back
						</button>
						<button
            style={{
              ...optionButtonStyle,
              backgroundColor: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              flex: 1,
              justifyContent: 'center'
            }}
            onClick={handleCustomDateSubmit}>
            
							Set Reminder
						</button>
					</div>
				</>
      }
		</div>);

};