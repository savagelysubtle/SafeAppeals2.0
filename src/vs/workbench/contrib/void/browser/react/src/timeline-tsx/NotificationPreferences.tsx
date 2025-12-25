/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useCallback } from 'react';
import { useAccessor } from '../util/services.js';
import { NotificationPreferences as NotificationPreferencesType, DEFAULT_NOTIFICATION_PREFERENCES } from '../../../../common/timeline/timelineTypes.js';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

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
  <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #27272a' }}>
    <div>
      <span className="text-sm font-medium" style={{ color: '#e4e4e7' }}>{label}</span>
      {description && (
        <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>{description}</p>
      )}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full transition-colors"
      style={{ backgroundColor: checked ? BRAND_GREEN : '#3f3f46' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
        style={{ left: checked ? '22px' : '2px' }}
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
        style={{ backgroundColor: '#0f0f0f', border: `1px solid ${BRAND_GREEN}30` }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: `1px solid ${BRAND_GREEN}20` }}
        >
          <div className="flex items-center gap-2">
            <i className="codicon codicon-settings-gear" style={{ color: BRAND_GREEN }} />
            <h3 className="font-semibold" style={{ color: '#fafafa' }}>Notification Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors hover:bg-white/10"
          >
            <i className="codicon codicon-close" style={{ color: '#71717a' }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
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
                <div className="py-3 pl-4" style={{ borderBottom: '1px solid #27272a' }}>
                  <span className="text-xs" style={{ color: '#71717a' }}>Remind me at:</span>
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
                        style={{
                          backgroundColor: prefs.deadlineReminderDays.includes(days)
                            ? BRAND_GREEN
                            : '#27272a',
                          color: prefs.deadlineReminderDays.includes(days)
                            ? '#0a0a0a'
                            : '#a1a1aa'
                        }}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Document Expiration */}
              <div className="py-3" style={{ borderBottom: '1px solid #27272a' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium" style={{ color: '#e4e4e7' }}>
                      Document Expiration Warnings
                    </span>
                    <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
                      Alert when medical reports get old
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs" style={{ color: '#71717a' }}>After</span>
                  <select
                    value={prefs.documentExpirationMonths}
                    onChange={(e) => updatePref('documentExpirationMonths', Number(e.target.value))}
                    className="px-2 py-1 rounded text-sm"
                    style={{ backgroundColor: '#27272a', color: '#e4e4e7', border: 'none' }}
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
              <div className="py-3" style={{ borderBottom: '1px solid #27272a' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium" style={{ color: '#e4e4e7' }}>
                      Statute of Limitations Warning
                    </span>
                    <p className="text-xs mt-0.5" style={{ color: '#71717a' }}>
                      Alert before filing deadline expires
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs" style={{ color: '#71717a' }}>Warn at</span>
                  <select
                    value={prefs.statuteWarningDays}
                    onChange={(e) => updatePref('statuteWarningDays', Number(e.target.value))}
                    className="px-2 py-1 rounded text-sm"
                    style={{ backgroundColor: '#27272a', color: '#e4e4e7', border: 'none' }}
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
          style={{ borderTop: '1px solid #27272a' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: '#27272a', color: '#a1a1aa' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: BRAND_GREEN,
              color: '#0a0a0a',
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

