import React from 'react';
import { SILO_LABELS, SILO_COLORS } from './GrowthWriterContext.js';

interface SiloSelectorProps {
  value: string;
  onChange: (silo: string) => void;
  includeAll?: boolean;
}

export const SiloSelector: React.FC<SiloSelectorProps> = ({ value, onChange, includeAll = false }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        backgroundColor: 'var(--vscode-input-background)',
        color: 'var(--vscode-input-foreground)',
        border: '1px solid var(--vscode-input-border)',
        borderRadius: '4px',
        padding: '4px 8px',
        fontSize: '12px',
        outline: 'none'
      }}>
      
			{includeAll && <option value="all">All Silos</option>}
			{Object.entries(SILO_LABELS).map(([key, label]) =>
      <option key={key} value={key}>
					{label}
				</option>
      )}
		</select>);

};

export const SiloBadge: React.FC<{silo: string;}> = ({ silo }) => {
  const color = SILO_COLORS[silo] || '#6b7280';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        fontWeight: 500
      }}>
      
			<span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block'
        }} />
      
			{SILO_LABELS[silo] || silo}
		</span>);

};