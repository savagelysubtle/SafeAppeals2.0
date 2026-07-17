import React, { useCallback, useEffect, useState } from 'react';
import { useGrowthWriter, RedditOpportunity } from '../growth-writer-shared/GrowthWriterContext.js';
import { StatusBadge } from '../growth-writer-shared/StatusBadge.js';

export const RedditOpsFeed: React.FC = () => {
  const { channel, workspaceId, openView } = useGrowthWriter();
  const [opportunities, setOpportunities] = useState<RedditOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const loadOpportunities = useCallback(async () => {
    try {
      const result = await channel.call<RedditOpportunity[]>('getOpportunities', { workspaceId });
      setOpportunities(result || []);
    } catch (err) {
      console.error('[GrowthWriter] Failed to load opportunities:', err);
    } finally {
      setLoading(false);
    }
  }, [channel, workspaceId]);

  useEffect(() => {
    loadOpportunities();
    const interval = setInterval(loadOpportunities, 30000);
    return () => clearInterval(interval);
  }, [loadOpportunities]);

  const handleScan = async () => {
    setScanning(true);
    try {
      await channel.call('scanOpportunities', { workspaceId });
      await loadOpportunities();
    } catch (err) {
      console.error('[GrowthWriter] Scan failed:', err);
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', padding: '4px 0' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
			<button
        onClick={handleScan}
        disabled={scanning}
        style={{
          padding: '3px 8px',
          fontSize: '11px',
          border: '1px solid var(--vscode-button-border, transparent)',
          borderRadius: '3px',
          cursor: scanning ? 'default' : 'pointer',
          backgroundColor: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
          opacity: scanning ? 0.6 : 1,
          alignSelf: 'flex-start'
        }}>
        
				{scanning ? 'Scanning...' : 'Scan Now'}
			</button>

			{opportunities.length === 0 ?
      <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>No opportunities found. Try scanning.</div> :

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
					{opportunities.slice(0, 10).map((opp) =>
        <OpportunityRow key={opp.id} opportunity={opp} onClick={() => {
          openView('reddit-comment', { opportunityId: opp.id, label: `r/${opp.subreddit}` });
        }} />
        )}
				</div>
      }
		</div>);

};

const OpportunityRow: React.FC<{opportunity: RedditOpportunity;onClick: () => void;}> = ({ opportunity, onClick }) => {
  const [hovered, setHovered] = useState(false);

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
      
			<span style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', minWidth: '60px' }}>
				r/{opportunity.subreddit}
			</span>
			<span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
				{opportunity.post_title}
			</span>
			<StatusBadge status={opportunity.status} />
		</div>);

};