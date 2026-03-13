import React, { useCallback, useEffect, useState } from 'react'
import { useGrowthWriter, Campaign, SocialPost, SILO_LABELS } from '../growth-writer-shared/GrowthWriterContext.js'
import { SiloSelector, SiloBadge } from '../growth-writer-shared/SiloSelector.js'
import { StatusBadge } from '../growth-writer-shared/StatusBadge.js'

interface HistoryMetricsProps {
	viewData?: Record<string, string>
}

interface CampaignWithMetrics extends Campaign {
	tweetCount: number
	redditCount: number
	totalImpressions: number
	totalLikes: number
}

export const HistoryMetrics: React.FC<HistoryMetricsProps> = () => {
	const { channel, workspaceId, openView } = useGrowthWriter()
	const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([])
	const [loading, setLoading] = useState(true)
	const [filterSilo, setFilterSilo] = useState('all')

	const loadData = useCallback(async () => {
		try {
			const [rawCampaigns, socialPosts] = await Promise.all([
				channel.call<Campaign[]>('getCampaigns', { workspaceId }).catch(() => []),
				channel.call<SocialPost[]>('getSocialPosts', { workspaceId }).catch(() => []),
			])

			const enriched = (rawCampaigns || [])
				.filter((c: Campaign) => c.status === 'published')
				.map((c: Campaign) => {
					const posts = (socialPosts || []).filter((p: SocialPost) => p.campaign_id === c.id)
					const tweets = posts.filter((p: SocialPost) => p.platform === 'twitter')
					const reddits = posts.filter((p: SocialPost) => p.platform === 'reddit')

					let totalImpressions = 0
					let totalLikes = 0
					for (const p of posts) {
						if (p.engagement_metrics) {
							try {
								const m = JSON.parse(p.engagement_metrics)
								totalImpressions += m.impression_count || 0
								totalLikes += m.like_count || m.score || 0
							} catch { /* skip */ }
						}
					}

					return {
						...c,
						tweetCount: tweets.length,
						redditCount: reddits.length,
						totalImpressions,
						totalLikes,
					}
				})

			setCampaigns(enriched)
		} catch (err) {
			console.error('[GrowthWriter] Failed to load history:', err)
		} finally {
			setLoading(false)
		}
	}, [channel, workspaceId])

	useEffect(() => { loadData() }, [loadData])

	const filtered = campaigns.filter(c => filterSilo === 'all' || c.silo === filterSilo)

	const totalCampaigns = filtered.length
	const totalImpressions = filtered.reduce((sum, c) => sum + c.totalImpressions, 0)
	const totalLikes = filtered.reduce((sum, c) => sum + c.totalLikes, 0)

	if (loading) {
		return <div style={{ padding: '20px' }}>Loading history...</div>
	}

	return (
		<div className="p-4">
			<div className="flex items-center gap-3 mb-4">
				<h2 className="text-base font-semibold m-0">History & Metrics</h2>
				<div className="flex-1" />
				<SiloSelector value={filterSilo} onChange={setFilterSilo} includeAll />
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
				<SummaryCard label="Campaigns Published" value={String(totalCampaigns)} />
				<SummaryCard label="Total Impressions" value={formatNumber(totalImpressions)} />
				<SummaryCard label="Total Likes" value={formatNumber(totalLikes)} />
			</div>

			{/* Campaigns Table */}
			{filtered.length === 0 ? (
				<div className="text-[var(--vscode-descriptionForeground)] text-center p-10">
					No published campaigns yet.
				</div>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-xs">
						<thead>
							<tr className="border-b border-[var(--vscode-panel-border)]">
								<th className="px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Silo</th>
								<th className="px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Title</th>
								<th className="px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Published</th>
								<th className="px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Tweets</th>
								<th className="px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Reddit</th>
								<th className="px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Impressions</th>
								<th className="px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Likes</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map(c => (
								<tr
									key={c.id}
									className="border-b border-[var(--vscode-panel-border)] cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
									onClick={() => openView('social-posts', { campaignId: c.id, label: c.blog_title || c.silo })}
								>
									<td className="px-3 py-2.5"><SiloBadge silo={c.silo} /></td>
									<td className="px-3 py-2.5 font-medium">{c.blog_title || 'Untitled'}</td>
									<td className="px-3 py-2.5 text-[var(--vscode-descriptionForeground)]">
										{c.published_at ? new Date(c.published_at).toLocaleDateString() : '-'}
									</td>
									<td className="px-3 py-2.5">{c.tweetCount}</td>
									<td className="px-3 py-2.5">{c.redditCount}</td>
									<td className="px-3 py-2.5">{formatNumber(c.totalImpressions)}</td>
									<td className="px-3 py-2.5">{formatNumber(c.totalLikes)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}

const SummaryCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
	<div className="p-4 rounded-lg border border-[var(--vscode-panel-border)] text-center bg-[var(--vscode-editor-background)]">
		<div className="text-2xl font-bold mb-1">{value}</div>
		<div className="text-xs text-[var(--vscode-descriptionForeground)]">{label}</div>
	</div>
)

function formatNumber(n: number): string {
	if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
	if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
	return String(n)
}

