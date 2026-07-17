/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { JurisdictionConfig } from '../../../../common/timeline/timelineTypes.js';

// Reusable style objects with VSCode CSS variables
const modalStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-sideBar-background)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '12px',
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

interface JurisdictionSelectorProps {
  jurisdictions: JurisdictionConfig[];
  currentJurisdiction?: JurisdictionConfig;
  onSelect: (jurisdictionId: string) => void;
  onClose: () => void;
}

// Group jurisdictions by country
const groupJurisdictions = (jurisdictions: JurisdictionConfig[]) => {
  return jurisdictions.reduce((acc, j) => {
    let country = 'Other';
    if (j.id.startsWith('bc-') || j.id.startsWith('ontario-') || j.id.startsWith('alberta-') ||
        j.id.startsWith('quebec-') || j.id.startsWith('manitoba-') || j.id.startsWith('saskatchewan-') ||
        j.id.startsWith('nova-scotia-') || j.id.startsWith('nb-') || j.id.startsWith('pei-') ||
        j.id.startsWith('newfoundland-') || j.id.startsWith('yukon-') || j.id.startsWith('nwt-') ||
        j.id.startsWith('nunavut-') || j.id === 'federal-canada') {
      country = '🇨🇦 Canada';
    } else if (j.id.startsWith('california-') || j.id.startsWith('texas-') || j.id.startsWith('new-york-') ||
               j.id.startsWith('florida-') || j.id === 'federal-usa') {
      country = '🇺🇸 United States';
    }

    if (!acc[country]) acc[country] = [];
    acc[country].push(j);
    return acc;
  }, {} as Record<string, JurisdictionConfig[]>);
};

export const JurisdictionSelector: React.FC<JurisdictionSelectorProps> = ({
  jurisdictions,
  currentJurisdiction,
  onSelect,
  onClose
}) => {
  const groupedJurisdictions = groupJurisdictions(jurisdictions);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl shadow-2xl void-scrollbar"
        style={{
          ...modalStyle,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 rounded-t-xl"
          style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)' }}
            >
              <i className="codicon codicon-law" style={{ color: 'var(--vscode-button-background)', fontSize: '16px' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={textPrimaryStyle}>
                Select Jurisdiction
              </h2>
              <p className="text-xs" style={textMutedStyle}>
                Workers' compensation board rules
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

        {/* Jurisdiction List */}
        <div className="p-3">
          {Object.entries(groupedJurisdictions).map(([country, juris]) => (
            <div key={country} className="mb-3">
              {/* Country Header */}
              <div
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--vscode-disabledForeground)' }}
              >
                {country}
              </div>

              {/* Jurisdiction Options */}
              <div className="space-y-1">
                {juris.map((j) => {
                  const isSelected = currentJurisdiction?.id === j.id;
                  return (
                    <button
                      key={j.id}
                      onClick={() => {
                        onSelect(j.id);
                        onClose();
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between"
                      style={{
                        backgroundColor: isSelected ? 'var(--vscode-button-secondaryBackground)' : 'transparent',
                        color: isSelected ? 'var(--vscode-button-background)' : 'var(--vscode-foreground)',
                        border: isSelected ? '1px solid var(--vscode-panel-border)' : '1px solid transparent'
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <i className="codicon codicon-check" style={{ color: 'var(--vscode-button-background)', fontSize: '14px' }} />
                        )}
                        <span>{j.name}</span>
                      </div>
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={buttonSecondaryStyle}
                      >
                        {j.statuteOfLimitationsDays} days
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

