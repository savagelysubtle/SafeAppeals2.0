import React, { useCallback, useEffect, useState } from 'react';
import { useGrowthWriter, Campaign, SILO_LABELS } from '../shared/GrowthWriterContext.js';
import { SiloBadge } from '../shared/SiloSelector.js';
import { StatusBadge } from '../shared/StatusBadge.js';

interface ScheduleCalendarProps {
  viewData?: Record<string, string>;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const SILO_SCHEDULE: Record<string, string> = {
  lawyers: 'Monday',
  researchers: 'Wednesday',
  students: 'Thursday',
  business: 'Friday'
};

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = () => {
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

  useEffect(() => {loadCampaigns();}, [loadCampaigns]);

  const campaignOfDay = (day: string) => {
    const silo = Object.entries(SILO_SCHEDULE).find(([, d]) => d === day)?.[0];
    if (!silo) return null;
    return campaigns.find((c) => c.silo === silo) || null;
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading schedule...</div>;
  }

  return (
    <div style={{ padding: '16px' }}>
			<h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Weekly Schedule</h2>

			<div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${DAYS.length}, 1fr)`,
        gap: '1px',
        backgroundColor: 'var(--vscode-panel-border)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
				{/* Day Headers */}
				{DAYS.map((day) => {
          const silo = Object.entries(SILO_SCHEDULE).find(([, d]) => d === day)?.[0];
          const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
          return (
            <div
              key={day}
              style={{
                padding: '12px',
                textAlign: 'center',
                backgroundColor: isToday ? 'var(--vscode-editor-selectionBackground)' : 'var(--vscode-editor-background)',
                fontWeight: 600,
                fontSize: '13px'
              }}>
              
							{day}
							{silo &&
              <div style={{ marginTop: '4px' }}>
									<SiloBadge silo={silo} />
								</div>
              }
						</div>);

        })}

				{/* Day Content */}
				{DAYS.map((day) => {
          const campaign = campaignOfDay(day);
          const silo = Object.entries(SILO_SCHEDULE).find(([, d]) => d === day)?.[0];
          return (
            <div
              key={`content-${day}`}
              style={{
                padding: '12px',
                minHeight: '120px',
                backgroundColor: 'var(--vscode-editor-background)'
              }}>
              
							{campaign ?
              <div
                onClick={() => openView('blog-editor', { campaignId: campaign.id, label: campaign.title || campaign.silo })}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid var(--vscode-panel-border)',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}>
                
									<div style={{ fontWeight: 500, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										{campaign.title || 'Untitled'}
									</div>
									<StatusBadge status={campaign.status} />
								</div> :
              silo ?
              <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>
									No campaign for {SILO_LABELS[silo]}
								</div> :

              <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>
									No silo scheduled
								</div>
              }
						</div>);

        })}
			</div>

			{/* All Campaigns List */}
			<div style={{ marginTop: '24px' }}>
				<h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>All Campaigns</h3>
				{campaigns.length === 0 ?
        <div style={{ color: 'var(--vscode-descriptionForeground)' }}>No campaigns created yet.</div> :

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
						<thead>
							<tr style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
								<th style={thStyle}>Silo</th>
								<th style={thStyle}>Title</th>
								<th style={thStyle}>Status</th>
								<th style={thStyle}>Scheduled</th>
								<th style={thStyle}>Published</th>
							</tr>
						</thead>
						<tbody>
							{campaigns.map((c) =>
            <tr
              key={c.id}
              style={{ borderBottom: '1px solid var(--vscode-panel-border)', cursor: 'pointer' }}
              onClick={() => openView('blog-editor', { campaignId: c.id, label: c.title || c.silo })}>
              
									<td style={tdStyle}><SiloBadge silo={c.silo} /></td>
									<td style={tdStyle}>{c.title || 'Untitled'}</td>
									<td style={tdStyle}><StatusBadge status={c.status} /></td>
									<td style={{ ...tdStyle, color: 'var(--vscode-descriptionForeground)' }}>
										{c.scheduled_date ? new Date(c.scheduled_date).toLocaleDateString() : '-'}
									</td>
									<td style={{ ...tdStyle, color: 'var(--vscode-descriptionForeground)' }}>
										{c.published_at ? new Date(c.published_at).toLocaleDateString() : '-'}
									</td>
								</tr>
            )}
						</tbody>
					</table>
        }
			</div>
		</div>);

};

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--vscode-descriptionForeground)'
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px'
};