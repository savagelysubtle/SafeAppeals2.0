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
		<div style={{ padding: '16px' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
				<h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>History & Metrics</h2>
				<div style={{ flex: 1 }} />
				<SiloSelector value={filterSilo} onChange={setFilterSilo} includeAll />
			</div>

			{/* Summary Cards */}
			<div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
				<SummaryCard label="Campaigns Published" value={String(totalCampaigns)} />
				<SummaryCard label="Total Impressions" value={formatNumber(totalImpressions)} />
				<SummaryCard label="Total Likes" value={formatNumber(totalLikes)} />
			</div>

			{/* Campaigns Table */}
			{filtered.length === 0 ? (
				<div style={{ color: 'var(--vscode-descriptionForeground)', textAlign: 'center', padding: '40px' }}>
					No published campaigns yet.
				</div>
			) : (
				<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
					<thead>
						<tr style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
							<th style={thStyle}>Silo</th>
							<th style={thStyle}>Title</th>
							<th style={thStyle}>Published</th>
							<th style={thStyle}>Tweets</th>
							<th style={thStyle}>Reddit</th>
							<th style={thStyle}>Impressions</th>
							<th style={thStyle}>Likes</th>
						</tr>
					</thead>
					<tbody>
						{filtered.map(c => (
							<tr
								key={c.id}
								style={{ borderBottom: '1px solid var(--vscode-panel-border)', cursor: 'pointer' }}
							onClick={() => openView('social-posts', { campaignId: c.id, label: c.blog_title || c.silo })}
						>
							<td style={tdStyle}><SiloBadge silo={c.silo} /></td>
							<td style={{ ...tdStyle, fontWeight: 500 }}>{c.blog_title || 'Untitled'}</td>
								<td style={{ ...tdStyle, color: 'var(--vscode-descriptionForeground)' }}>
									{c.published_at ? new Date(c.published_at).toLocaleDateString() : '-'}
								</td>
								<td style={tdStyle}>{c.tweetCount}</td>
								<td style={tdStyle}>{c.redditCount}</td>
								<td style={tdStyle}>{formatNumber(c.totalImpressions)}</td>
								<td style={tdStyle}>{formatNumber(c.totalLikes)}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	)
}

const SummaryCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
	<div style={{
		flex: 1,
		padding: '16px',
		borderRadius: '8px',
		border: '1px solid var(--vscode-panel-border)',
		textAlign: 'center',
	}}>
		<div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>{value}</div>
		<div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>{label}</div>
	</div>
)

function formatNumber(n: number): string {
	if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
	if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
	return String(n)
}

const thStyle: React.CSSProperties = {
	padding: '8px 12px',
	textAlign: 'left',
	fontWeight: 600,
	fontSize: '11px',
	textTransform: 'uppercase',
	letterSpacing: '0.05em',
	color: 'var(--vscode-descriptionForeground)',
}

const tdStyle: React.CSSProperties = {
	padding: '8px 12px',
}
