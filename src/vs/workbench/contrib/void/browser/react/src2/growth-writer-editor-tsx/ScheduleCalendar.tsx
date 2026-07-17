import React, { useCallback, useEffect, useState } from 'react';
import { useGrowthWriter, Campaign, SILO_LABELS } from '../growth-writer-shared/GrowthWriterContext.js';
import { SiloBadge } from '../growth-writer-shared/SiloSelector.js';
import { StatusBadge } from '../growth-writer-shared/StatusBadge.js';

interface ScheduleCalendarProps {
  viewData?: Record<string, string>;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const SILO_SCHEDULE: Record<string, string> = {
  lawyers: 'Monday',
  workers_comp: 'Tuesday',
  researchers: 'Wednesday',
  students: 'Thursday',
  business: 'Friday'
};

function getWeekDates(): {dayName: string;date: Date;}[] {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  return DAYS.map((name, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { dayName: name, date: d };
  });
}

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = () => {
  const { channel, workspaceId, openView, generateBlogForIdea, schedulerState } = useGrowthWriter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

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

  const weekDates = getWeekDates();

  const campaignOfDay = (day: string) => {
    const silo = Object.entries(SILO_SCHEDULE).find(([, d]) => d === day)?.[0];
    if (!silo) return null;
    return campaigns.find((c) => c.silo === silo && c.status !== 'failed') || null;
  };

  const handleGenerateForSilo = async (silo: string) => {
    if (!generateBlogForIdea) return;
    setGenerating(silo);
    try {
      const topIdea = await channel.call<{id: string;} | null>('getTopPendingIdea', { workspaceId, silo });
      if (topIdea) {
        await generateBlogForIdea(topIdea.id);
        await loadCampaigns();
      }
    } catch (err) {
      console.error('[GrowthWriter] Generate for silo failed:', err);
    } finally {
      setGenerating(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading schedule...</div>;
  }

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const draftsCount = campaigns.filter((c) => c.status === 'draft').length;
  const approvedCount = campaigns.filter((c) => c.status === 'approved').length;

  return (
    <div className="void-p-4">
			<div className="void-flex void-items-center void-justify-between void-mb-4">
				<h2 className="void-text-base void-font-semibold void-m-0">Weekly Schedule</h2>
				{schedulerState &&
        <div className={`void-text-[10px] void-px-2 void-py-0.5 void-rounded-full void-font-semibold ${schedulerState.enabled ? "void-bg-green-600 void-text-white" : "void-bg-[var(--vscode-button-secondaryBackground)] void-text-[var(--vscode-button-secondaryForeground)]"}`}>
          
						{schedulerState.enabled ? 'AUTO' : 'MANUAL'}
					</div>
        }
			</div>

			{/* Summary Badges */}
			{(draftsCount > 0 || approvedCount > 0) &&
      <div className="void-flex void-gap-2 void-mb-3 void-text-[11px]">
					{draftsCount > 0 &&
        <span className="void-px-2 void-py-0.5 void-rounded-full void-bg-amber-900 void-text-amber-400">
							{draftsCount} needs approval
						</span>
        }
					{approvedCount > 0 &&
        <span className="void-px-2 void-py-0.5 void-rounded-full void-bg-emerald-900 void-text-emerald-400">
							{approvedCount} ready to publish
						</span>
        }
				</div>
      }

			{/* Calendar Grid */}
			<div className="void-overflow-x-auto void-pb-2">
				<div className="void-grid void-grid-cols-5 void-gap-[1px] void-bg-[var(--vscode-panel-border)] void-rounded-lg void-overflow-hidden void-min-w-[700px]">
					{weekDates.map(({ dayName, date }) => {
            const silo = Object.entries(SILO_SCHEDULE).find(([, d]) => d === dayName)?.[0];
            const isToday = dayName === todayName;
            return (
              <div
                key={dayName}
                className={`void-p-2 void-text-center void-font-semibold void-text-[13px] ${isToday ? "void-bg-[var(--vscode-editor-selectionBackground)]" : "void-bg-[var(--vscode-editor-background)]"}`}>

                
								<div>{dayName}</div>
								<div className="void-text-[10px] void-text-[var(--vscode-descriptionForeground)] void-mt-0.5">
									{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
								</div>
								{silo &&
                <div className="void-mt-1 void-flex void-justify-center">
										<SiloBadge silo={silo} />
									</div>
                }
							</div>);

          })}

					{weekDates.map(({ dayName }) => {
            const campaign = campaignOfDay(dayName);
            const silo = Object.entries(SILO_SCHEDULE).find(([, d]) => d === dayName)?.[0];
            const isGenerating = generating === silo;
            return (
              <div
                key={`content-${dayName}`}
                className="void-p-3 void-min-h-[120px] void-bg-[var(--vscode-editor-background)]">
                
								{campaign ?
                <div
                  onClick={() => openView('blog-editor', { campaignId: campaign.id, label: campaign.blog_title || campaign.silo })}
                  className={`void-p-2 void-rounded void-border void-cursor-pointer void-text-xs void-transition-colors hover:void-brightness-110 hover:void-bg-[var(--vscode-list-hoverBackground)] ${campaign.status === 'draft' ? "void-border-amber-900 void-bg-amber-900/10" : campaign.status === 'approved' ? "void-border-emerald-900 void-bg-emerald-900/10" : "void-border-[var(--vscode-panel-border)] void-bg-[var(--vscode-editor-background)]"}`}>

                  
										<div className="void-font-medium void-mb-1 void-overflow-hidden void-line-clamp-2" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
											{campaign.blog_title || 'Untitled'}
										</div>
										<StatusBadge status={campaign.status} />
										{campaign.scheduled_for &&
                  <div className="void-text-[10px] void-text-[var(--vscode-descriptionForeground)] void-mt-1">
												Scheduled: {new Date(campaign.scheduled_for).toLocaleDateString()}
											</div>
                  }
									</div> :
                silo ?
                <div className="void-flex void-flex-col void-items-center void-gap-2">
										<div className="void-text-[11px] void-text-[var(--vscode-descriptionForeground)] void-italic void-text-center">
											No campaign
										</div>
										<button
                    onClick={() => handleGenerateForSilo(silo)}
                    disabled={isGenerating}
                    className={`void-px-2.5 void-py-1 void-text-[10px] void-rounded void-border-none void-bg-[var(--vscode-button-background)] void-text-[var(--vscode-button-foreground)] void-transition-opacity ${isGenerating ? "void-opacity-60 void-cursor-default" : "void-cursor-pointer hover:void-opacity-90"}`}>

                    
											{isGenerating ? 'Generating...' : 'Generate Now'}
										</button>
									</div> :

                <div className="void-text-[11px] void-text-[var(--vscode-descriptionForeground)] void-italic">
										No silo scheduled
									</div>
                }
							</div>);

          })}
				</div>
			</div>

			{/* All Campaigns List */}
			<div className="void-mt-6">
				<h3 className="void-text-sm void-font-semibold void-mb-3">All Campaigns</h3>
				{campaigns.length === 0 ?
        <div className="void-text-[var(--vscode-descriptionForeground)]">No campaigns created yet.</div> :

        <div className="void-overflow-x-auto">
						<table className="void-w-full void-border-collapse void-text-xs">
							<thead>
								<tr className="void-border-b void-border-[var(--vscode-panel-border)]">
									<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Silo</th>
									<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Title</th>
									<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Status</th>
									<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Scheduled</th>
									<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Published</th>
								</tr>
							</thead>
							<tbody>
								{campaigns.map((c) =>
              <tr
                key={c.id}
                className="void-border-b void-border-[var(--vscode-panel-border)] void-cursor-pointer hover:void-bg-[var(--vscode-list-hoverBackground)] void-transition-colors"
                onClick={() => openView('blog-editor', { campaignId: c.id, label: c.blog_title || c.silo })}>
                
										<td className="void-px-3 void-py-2.5"><SiloBadge silo={c.silo} /></td>
										<td className="void-px-3 void-py-2.5 void-font-medium">{c.blog_title || 'Untitled'}</td>
										<td className="void-px-3 void-py-2.5"><StatusBadge status={c.status} /></td>
										<td className="void-px-3 void-py-2.5 void-text-[var(--vscode-descriptionForeground)]">
											{c.scheduled_for ? new Date(c.scheduled_for).toLocaleDateString() : '-'}
										</td>
										<td className="void-px-3 void-py-2.5 void-text-[var(--vscode-descriptionForeground)]">
											{c.published_at ? new Date(c.published_at).toLocaleDateString() : '-'}
										</td>
									</tr>
              )}
							</tbody>
						</table>
					</div>
        }
			</div>
		</div>);

};