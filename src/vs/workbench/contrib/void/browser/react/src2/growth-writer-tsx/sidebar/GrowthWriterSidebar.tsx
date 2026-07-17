import React, { useEffect, useMemo, useState } from 'react';
import { useAccessor } from '../../util/services.js';
import { GrowthWriterContext } from '../shared/GrowthWriterContext.js';
import { CampaignQueue } from './CampaignQueue.js';
import { RedditOpsFeed } from './RedditOpsFeed.js';
import { QuickStats } from './QuickStats.js';

interface GrowthWriterSidebarProps {
  openView: (viewType: string, viewData?: Record<string, string>) => void;
  channel: {call<T = unknown>(command: string, arg?: unknown): Promise<T>;};
}

export const GrowthWriterSidebar: React.FC<GrowthWriterSidebarProps> = ({ openView, channel }) => {
  const accessor = useAccessor();
  const workspaceId = useMemo(() => {
    try {
      const ws = accessor.get('IWorkspaceContextService');
      return ws.getWorkspace().id;
    } catch {
      return 'default';
    }
  }, [accessor]);

  const ctx = useMemo(() => ({ channel, openView, workspaceId }), [channel, openView, workspaceId]);

  return (
    <GrowthWriterContext.Provider value={ctx}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '2px', height: '100%', color: 'var(--vscode-foreground)' }}>
				<QuickActions openView={openView} />
				<CollapsibleSection title="Campaign Queue" defaultOpen>
					<CampaignQueue />
				</CollapsibleSection>
				<CollapsibleSection title="Reddit Opportunities" defaultOpen>
					<RedditOpsFeed />
				</CollapsibleSection>
				<CollapsibleSection title="Quick Stats" defaultOpen>
					<QuickStats />
				</CollapsibleSection>
			</div>
		</GrowthWriterContext.Provider>);

};

const QuickActions: React.FC<{openView: (viewType: string, viewData?: Record<string, string>) => void;}> = ({ openView }) => {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '8px' }}>
			<ActionButton label="Blog Ideas" onClick={() => openView('blog-ideas')} />
			<ActionButton label="Schedule" onClick={() => openView('schedule')} />
			<ActionButton label="History" onClick={() => openView('history')} />
			<ActionButton label="Accounts" onClick={() => openView('account-health')} />
		</div>);

};

const ActionButton: React.FC<{label: string;onClick: () => void;}> = ({ label, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '4px 10px',
        fontSize: '11px',
        border: '1px solid var(--vscode-button-border, transparent)',
        borderRadius: '4px',
        cursor: 'pointer',
        backgroundColor: hovered ? 'var(--vscode-button-hoverBackground)' : 'var(--vscode-button-secondaryBackground)',
        color: 'var(--vscode-button-secondaryForeground)'
      }}>
      
			{label}
		</button>);

};

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
			<button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          width: '100%',
          padding: '6px 8px',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          border: 'none',
          cursor: 'pointer',
          backgroundColor: 'var(--vscode-sideBarSectionHeader-background)',
          color: 'var(--vscode-sideBarSectionHeader-foreground)',
          borderTop: '1px solid var(--vscode-sideBarSectionHeader-border, transparent)'
        }}>
        
				<span style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', fontSize: '12px' }}>▶</span>
				{title}
			</button>
			{open &&
      <div style={{ padding: '4px 8px' }}>
					{children}
				</div>
      }
		</div>);

};