import React from 'react';

const STATUS_CONFIG: Record<string, {color: string;bg: string;label?: string;}> = {
  draft: { color: '#d97706', bg: '#d9770620' },
  pending: { color: '#d97706', bg: '#d9770620' },
  approved: { color: '#3b82f6', bg: '#3b82f620' },
  generating: { color: '#8b5cf6', bg: '#8b5cf620' },
  generated: { color: '#6366f1', bg: '#6366f120' },
  published: { color: '#10b981', bg: '#10b98120' },
  posted: { color: '#10b981', bg: '#10b98120' },
  commented: { color: '#10b981', bg: '#10b98120' },
  failed: { color: '#ef4444', bg: '#ef444420' },
  rejected: { color: '#ef4444', bg: '#ef444420' },
  new: { color: '#06b6d4', bg: '#06b6d420' },
  used: { color: '#6b7280', bg: '#6b728020' }
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const config = STATUS_CONFIG[status] || { color: '#6b7280', bg: '#6b728020' };
  const fontSize = size === 'sm' ? '10px' : '11px';
  const padding = size === 'sm' ? '1px 6px' : '2px 8px';

  return (
    <span
      style={{
        display: 'inline-block',
        fontSize,
        fontWeight: 500,
        padding,
        borderRadius: '9999px',
        color: config.color,
        backgroundColor: config.bg,
        textTransform: 'capitalize',
        lineHeight: '1.4'
      }}>
      
			{config.label || status}
		</span>);

};