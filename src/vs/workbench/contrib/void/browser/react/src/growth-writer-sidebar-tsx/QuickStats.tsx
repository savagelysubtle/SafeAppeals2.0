import React, { useCallback, useEffect, useState } from 'react'
import { useGrowthWriter, Campaign, SocialPost, BlogIdea, RedditOpportunity } from '../growth-writer-shared/GrowthWriterContext.js'

interface Stats {
	campaignsPublished: number
	campaignsTotal: number
	tweetsPosted: number
	tweetsTotal: number
	ideasPending: number
	redditComments: number
	redditOpportunities: number
}

export const QuickStats: React.FC = () => {
	const { channel, workspaceId, openView } = useGrowthWriter()
	const [stats, setStats] = useState<Stats>({
		campaignsPublished: 0,
		campaignsTotal: 0,
		tweetsPosted: 0,
		tweetsTotal: 0,
		ideasPending: 0,
		redditComments: 0,
		redditOpportunities: 0,
	})

	const loadStats = useCallback(async () => {
		try {
			const [campaigns, ideas, opportunities, socialPosts] = await Promise.all([
				channel.call<Campaign[]>('getCampaigns', { workspaceId }).catch(() => []),
				channel.call<BlogIdea[]>('getIdeas', { workspaceId }).catch(() => []),
				channel.call<RedditOpportunity[]>('getOpportunities', { workspaceId }).catch(() => []),
				channel.call<SocialPost[]>('getSocialPosts', { workspaceId }).catch(() => []),
			])

			const tweets = (socialPosts || []).filter((p: SocialPost) => p.platform === 'twitter')

			setStats({
				campaignsPublished: (campaigns || []).filter((c: Campaign) => c.status === 'published').length,
				campaignsTotal: (campaigns || []).length,
				tweetsPosted: tweets.filter((t: SocialPost) => t.status === 'posted').length,
				tweetsTotal: tweets.length,
				ideasPending: (ideas || []).filter((i: BlogIdea) => i.status === 'pending' || i.status === 'approved').length,
				redditComments: (opportunities || []).filter((o: RedditOpportunity) => o.status === 'commented').length,
				redditOpportunities: (opportunities || []).length,
			})
		} catch (err) {
			console.error('[GrowthWriter] Failed to load stats:', err)
		}
	}, [channel, workspaceId])

	useEffect(() => {
		loadStats()
		const interval = setInterval(loadStats, 30000)
		return () => clearInterval(interval)
	}, [loadStats])

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
			<StatRow label="Campaigns" value={`${stats.campaignsPublished}/${stats.campaignsTotal}`} hint="published" />
			<StatRow label="Tweets" value={`${stats.tweetsPosted}/${stats.tweetsTotal}`} hint="posted" />
			<StatRow label="Ideas" value={String(stats.ideasPending)} hint="pending" />
			<StatRow label="Reddit" value={`${stats.redditComments}/${stats.redditOpportunities}`} hint="commented" />
			<div
				onClick={() => openView('account-health')}
				style={{
					fontSize: '11px',
					color: 'var(--vscode-textLink-foreground)',
					cursor: 'pointer',
					padding: '2px 0',
				}}
			>
				View Account Health →
			</div>
		</div>
	)
}

const StatRow: React.FC<{ label: string; value: string; hint: string }> = ({ label, value, hint }) => {
	return (
		<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0' }}>
			<span style={{ color: 'var(--vscode-foreground)' }}>{label}</span>
			<span>
				<span style={{ fontWeight: 600 }}>{value}</span>
				<span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '10px', marginLeft: '4px' }}>{hint}</span>
			</span>
		</div>
	)
}
