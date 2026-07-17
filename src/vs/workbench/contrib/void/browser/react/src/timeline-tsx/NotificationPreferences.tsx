/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useState } from 'react';
import { DEFAULT_NOTIFICATION_PREFERENCES, NotificationPreferences as NotificationPreferencesType } from '../../../../common/timeline/timelineTypes.js';
import { useAccessor } from '../util/services.js';

// Reusable style objects with VSCode CSS variables
const modalStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-sideBar-background)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '12px',
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

interface NotificationPreferencesProps {
  onClose: () => void;
}

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
    <div>
      <span className="text-sm font-medium" style={{ color: 'var(--vscode-foreground)' }}>{label}</span>
      {description && (
        <p className="text-xs mt-0.5" style={textMutedStyle}>{description}</p>
      )}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full transition-colors"
      style={{ backgroundColor: checked ? 'var(--vscode-button-background)' : 'var(--vscode-panel-border)' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
        style={{ left: checked ? '22px' : '2px', backgroundColor: 'var(--vscode-editor-foreground)' }}
      />
    </button>
  </div>
);

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ onClose }) => {
  const accessor = useAccessor();
  const timelineService = accessor.get('ITimelineService');

  const [prefs, setPrefs] = useState<NotificationPreferencesType>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const currentPrefs = timelineService.getNotificationPreferences();
    setPrefs(currentPrefs);
  }, [timelineService]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await timelineService.updateNotificationPreferences(prefs);
      onClose();
    } catch (error) {
      console.error('[NotificationPreferences] Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [timelineService, prefs, onClose]);

  const updatePref = <K extends keyof NotificationPreferencesType>(
    key: K,
    value: NotificationPreferencesType[K]
  ) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={modalStyle}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}
        >
          <div className="flex items-center gap-2">
            <i className="codicon codicon-settings-gear" style={{ color: 'var(--vscode-button-background)' }} />
            <h3 className="font-semibold" style={textPrimaryStyle}>Notification Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors hover:bg-white/10"
            style={buttonSecondaryStyle}
          >
            <i className="codicon codicon-close" style={textMutedStyle} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto void-scrollbar">
          {/* Master Toggle */}
          <Toggle
            label="Enable Notifications"
            description="Master toggle for all timeline notifications"
            checked={prefs.enabled}
            onChange={(checked) => updatePref('enabled', checked)}
          />

          {prefs.enabled && (
            <>
              {/* Deadline Alerts */}
              <Toggle
                label="Deadline Alerts"
                description="Notify before deadlines approach"
                checked={prefs.deadlineAlerts}
                onChange={(checked) => updatePref('deadlineAlerts', checked)}
              />

              {prefs.deadlineAlerts && (
                <div className="py-3 pl-4" style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
                  <span className="text-xs" style={textMutedStyle}>Remind me at:</span>
                  <div className="flex gap-2 mt-2">
                    {[1, 3, 7, 14, 30].map(days => (
                      <button
                        key={days}
                        onClick={() => {
                          const current = prefs.deadlineReminderDays;
                          const newDays = current.includes(days)
                            ? current.filter(d => d !== days)
                            : [...current, days].sort((a, b) => b - a);
                          updatePref('deadlineReminderDays', newDays);
                        }}
                        className="px-2 py-1 rounded text-xs transition-all"
                        style={prefs.deadlineReminderDays.includes(days)
                          ? buttonPrimaryStyle
                          : buttonSecondaryStyle
                        }
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Document Expiration */}
              <div className="py-3" style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--vscode-foreground)' }}>
                      Document Expiration Warnings
                    </span>
                    <p className="text-xs mt-0.5" style={textMutedStyle}>
                      Alert when medical reports get old
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs" style={textMutedStyle}>After</span>
                  <select
                    value={prefs.documentExpirationMonths}
                    onChange={(e) => updatePref('documentExpirationMonths', Number(e.target.value))}
                    className="px-2 py-1 rounded text-sm"
                    style={{ backgroundColor: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)' }}
                  >
                    <option value={0}>Disabled</option>
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={9}>9 months</option>
                    <option value={12}>12 months</option>
                  </select>
                </div>
              </div>

              {/* Missing Documents */}
              <Toggle
                label="Missing Document Alerts"
                description="Notify when events don't have linked documents"
                checked={prefs.documentMissingAlerts}
                onChange={(checked) => updatePref('documentMissingAlerts', checked)}
              />

              {/* Follow-up Reminders */}
              <Toggle
                label="Follow-up Reminders"
                description="Get reminded about pending tasks"
                checked={prefs.followUpReminders}
                onChange={(checked) => updatePref('followUpReminders', checked)}
              />

              {/* Statute Warning */}
              <div className="py-3" style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--vscode-foreground)' }}>
                      Statute of Limitations Warning
                    </span>
                    <p className="text-xs mt-0.5" style={textMutedStyle}>
                      Alert before filing deadline expires
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs" style={textMutedStyle}>Warn at</span>
                  <select
                    value={prefs.statuteWarningDays}
                    onChange={(e) => updatePref('statuteWarningDays', Number(e.target.value))}
                    className="px-2 py-1 rounded text-sm"
                    style={{ backgroundColor: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)' }}
                  >
                    <option value={0}>Disabled</option>
                    <option value={7}>7 days before</option>
                    <option value={14}>14 days before</option>
                    <option value={30}>30 days before</option>
                    <option value={60}>60 days before</option>
                    <option value={90}>90 days before</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 p-4"
          style={{ borderTop: '1px solid var(--vscode-panel-border)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={buttonSecondaryStyle}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              ...buttonPrimaryStyle,
              opacity: isSaving ? 0.7 : 1
            }}
          >
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
};

