import React, { useCallback, useEffect, useState } from 'react';
import { useGrowthWriter, Campaign, SocialPost, SILO_LABELS } from '../growth-writer-shared/GrowthWriterContext.js';
import { SiloSelector, SiloBadge } from '../growth-writer-shared/SiloSelector.js';
import { StatusBadge } from '../growth-writer-shared/StatusBadge.js';

interface HistoryMetricsProps {
  viewData?: Record<string, string>;
}

interface CampaignWithMetrics extends Campaign {
  tweetCount: number;
  redditCount: number;
  totalImpressions: number;
  totalLikes: number;
}

export const HistoryMetrics: React.FC<HistoryMetricsProps> = () => {
  const { channel, workspaceId, openView } = useGrowthWriter();
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSilo, setFilterSilo] = useState('all');

  const loadData = useCallback(async () => {
    try {
      const [rawCampaigns, socialPosts] = await Promise.all([
      channel.call<Campaign[]>('getCampaigns', { workspaceId }).catch(() => []),
      channel.call<SocialPost[]>('getSocialPosts', { workspaceId }).catch(() => [])]
      );

      const enriched = (rawCampaigns || []).
      filter((c: Campaign) => c.status === 'published').
      map((c: Campaign) => {
        const posts = (socialPosts || []).filter((p: SocialPost) => p.campaign_id === c.id);
        const tweets = posts.filter((p: SocialPost) => p.platform === 'twitter');
        const reddits = posts.filter((p: SocialPost) => p.platform === 'reddit');

        let totalImpressions = 0;
        let totalLikes = 0;
        for (const p of posts) {
          if (p.engagement_metrics) {
            try {
              const m = JSON.parse(p.engagement_metrics);
              totalImpressions += m.impression_count || 0;
              totalLikes += m.like_count || m.score || 0;
            } catch {/* skip */}
          }
        }

        return {
          ...c,
          tweetCount: tweets.length,
          redditCount: reddits.length,
          totalImpressions,
          totalLikes
        };
      });

      setCampaigns(enriched);
    } catch (err) {
      console.error('[GrowthWriter] Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  }, [channel, workspaceId]);

  useEffect(() => {loadData();}, [loadData]);

  const filtered = campaigns.filter((c) => filterSilo === 'all' || c.silo === filterSilo);

  const totalCampaigns = filtered.length;
  const totalImpressions = filtered.reduce((sum, c) => sum + c.totalImpressions, 0);
  const totalLikes = filtered.reduce((sum, c) => sum + c.totalLikes, 0);

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading history...</div>;
  }

  return (
    <div className="void-p-4">
			<div className="void-flex void-items-center void-gap-3 void-mb-4">
				<h2 className="void-text-base void-font-semibold void-m-0">History & Metrics</h2>
				<div className="void-flex-1" />
				<SiloSelector value={filterSilo} onChange={setFilterSilo} includeAll />
			</div>

			{/* Summary Cards */}
			<div className="void-grid void-grid-cols-1 md:void-grid-cols-3 void-gap-3 void-mb-6">
				<SummaryCard label="Campaigns Published" value={String(totalCampaigns)} />
				<SummaryCard label="Total Impressions" value={formatNumber(totalImpressions)} />
				<SummaryCard label="Total Likes" value={formatNumber(totalLikes)} />
			</div>

			{/* Campaigns Table */}
			{filtered.length === 0 ?
      <div className="void-text-[var(--vscode-descriptionForeground)] void-text-center void-p-10">
					No published campaigns yet.
				</div> :

      <div className="void-overflow-x-auto">
					<table className="void-w-full void-border-collapse void-text-xs">
						<thead>
							<tr className="void-border-b void-border-[var(--vscode-panel-border)]">
								<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Silo</th>
								<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Title</th>
								<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Published</th>
								<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Tweets</th>
								<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Reddit</th>
								<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Impressions</th>
								<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Likes</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((c) =>
            <tr
              key={c.id}
              className="void-border-b void-border-[var(--vscode-panel-border)] void-cursor-pointer hover:void-bg-[var(--vscode-list-hoverBackground)] void-transition-colors"
              onClick={() => openView('social-posts', { campaignId: c.id, label: c.blog_title || c.silo })}>
              
									<td className="void-px-3 void-py-2.5"><SiloBadge silo={c.silo} /></td>
									<td className="void-px-3 void-py-2.5 void-font-medium">{c.blog_title || 'Untitled'}</td>
									<td className="void-px-3 void-py-2.5 void-text-[var(--vscode-descriptionForeground)]">
										{c.published_at ? new Date(c.published_at).toLocaleDateString() : '-'}
									</td>
									<td className="void-px-3 void-py-2.5">{c.tweetCount}</td>
									<td className="void-px-3 void-py-2.5">{c.redditCount}</td>
									<td className="void-px-3 void-py-2.5">{formatNumber(c.totalImpressions)}</td>
									<td className="void-px-3 void-py-2.5">{formatNumber(c.totalLikes)}</td>
								</tr>
            )}
						</tbody>
					</table>
				</div>
      }
		</div>);

};

const SummaryCard: React.FC<{label: string;value: string;}> = ({ label, value }) =>
<div className="void-p-4 void-rounded-lg void-border void-border-[var(--vscode-panel-border)] void-text-center void-bg-[var(--vscode-editor-background)]">
		<div className="void-text-2xl void-font-bold void-mb-1">{value}</div>
		<div className="void-text-xs void-text-[var(--vscode-descriptionForeground)]">{label}</div>
	</div>;


function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}