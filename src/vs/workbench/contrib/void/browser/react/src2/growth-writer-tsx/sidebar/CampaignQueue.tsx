import React, { useCallback, useEffect, useState } from 'react';
import { useGrowthWriter, Campaign } from '../shared/GrowthWriterContext.js';
import { SiloBadge } from '../shared/SiloSelector.js';
import { StatusBadge } from '../shared/StatusBadge.js';

const SCHEDULE_DAYS: Record<string, string> = {
  lawyers: 'Monday',
  researchers: 'Wednesday',
  students: 'Thursday',
  business: 'Friday'
};

export const CampaignQueue: React.FC = () => {
  const { channel, workspaceId, openView } = useGrowthWriter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCampaigns = useCallback(async () => {
    try {
      const result = await channel.call<Campaign[]>('getCampaigns', { workspaceId });
      setCampaigns(result || []);
    } catch (err) {
      console.error('[GrowthWriter] Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, [channel, workspaceId]);

  useEffect(() => {
    loadCampaigns();
    const interval = setInterval(loadCampaigns, 30000);
    return () => clearInterval(interval);
  }, [loadCampaigns]);

  if (loading) {
    return <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', padding: '4px 0' }}>Loading campaigns...</div>;
  }

  if (campaigns.length === 0) {
    return <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', padding: '4px 0' }}>No campaigns yet. Generate ideas to get started.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
			{campaigns.slice(0, 8).map((campaign) =>
      <CampaignRow key={campaign.id} campaign={campaign} onClick={() => {
        openView('blog-editor', { campaignId: campaign.id, label: campaign.title || campaign.silo });
      }} />
      )}
		</div>);

};

const CampaignRow: React.FC<{campaign: Campaign;onClick: () => void;}> = ({ campaign, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const day = SCHEDULE_DAYS[campaign.silo] || '';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 6px',
        borderRadius: '3px',
        cursor: 'pointer',
        backgroundColor: hovered ? 'var(--vscode-list-hoverBackground)' : 'transparent',
        fontSize: '12px'
      }}>
      
			<SiloBadge silo={campaign.silo} />
			<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
				{campaign.title || 'Untitled'}
			</span>
			<StatusBadge status={campaign.status} />
			{day && <span style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)' }}>{day}</span>}
		</div>);

};