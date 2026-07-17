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
  borderRadius: '12px'
};

const buttonSecondaryStyle: React.CSSProperties = {
  backgroundColor: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '8px'
};

const textPrimaryStyle: React.CSSProperties = {
  color: 'var(--vscode-editor-foreground)'
};

const textMutedStyle: React.CSSProperties = {
  color: 'var(--vscode-descriptionForeground)'
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
      className="void-fixed void-inset-0 void-z-50 void-flex void-items-center void-justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onClose}>
      
      <div
        className="void-w-full void-max-w-sm void-rounded-xl void-shadow-2xl void-void-scrollbar"
        style={{
          ...modalStyle,
          maxHeight: '80vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div
          className="void-flex void-items-center void-justify-between void-px-5 void-py-4 void-rounded-t-xl"
          style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
          
          <div className="void-flex void-items-center void-gap-3">
            <div
              className="void-w-9 void-h-9 void-rounded-lg void-flex void-items-center void-justify-center"
              style={{ backgroundColor: 'var(--vscode-button-secondaryBackground)' }}>
              
              <i className="void-codicon void-codicon-law" style={{ color: 'var(--vscode-button-background)', fontSize: '16px' }} />
            </div>
            <div>
              <h2 className="void-text-base void-font-semibold" style={textPrimaryStyle}>
                Select Jurisdiction
              </h2>
              <p className="void-text-xs" style={textMutedStyle}>
                Workers' compensation board rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="void-w-8 void-h-8 void-rounded-lg void-flex void-items-center void-justify-center void-transition-colors"
            style={buttonSecondaryStyle}>
            
            <i className="void-codicon void-codicon-close" />
          </button>
        </div>

        {/* Jurisdiction List */}
        <div className="void-p-3">
          {Object.entries(groupedJurisdictions).map(([country, juris]) =>
          <div key={country} className="void-mb-3">
              {/* Country Header */}
              <div
              className="void-px-3 void-py-2 void-text-xs void-font-semibold void-uppercase void-tracking-wide"
              style={{ color: 'var(--vscode-disabledForeground)' }}>
              
                {country}
              </div>

              {/* Jurisdiction Options */}
              <div className="void-space-y-1">
                {juris.map((j) => {
                const isSelected = currentJurisdiction?.id === j.id;
                return (
                  <button
                    key={j.id}
                    onClick={() => {
                      onSelect(j.id);
                      onClose();
                    }}
                    className="void-w-full void-text-left void-px-3 void-py-2.5 void-rounded-lg void-text-sm void-transition-all void-flex void-items-center void-justify-between"
                    style={{
                      backgroundColor: isSelected ? 'var(--vscode-button-secondaryBackground)' : 'transparent',
                      color: isSelected ? 'var(--vscode-button-background)' : 'var(--vscode-foreground)',
                      border: isSelected ? '1px solid var(--vscode-panel-border)' : '1px solid transparent'
                    }}>
                    
                      <div className="void-flex void-items-center void-gap-2">
                        {isSelected &&
                      <i className="void-codicon void-codicon-check" style={{ color: 'var(--vscode-button-background)', fontSize: '14px' }} />
                      }
                        <span>{j.name}</span>
                      </div>
                      <span
                      className="void-text-xs void-px-2 void-py-0.5 void-rounded"
                      style={buttonSecondaryStyle}>
                      
                        {j.statuteOfLimitationsDays} days
                      </span>
                    </button>);

              })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>);

};