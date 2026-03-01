import React, { useCallback, useEffect, useState } from 'react'
import { useGrowthWriter, Campaign, BlogIdea } from '../growth-writer-shared/GrowthWriterContext.js'

interface Stats {
	campaignsPublished: number
	campaignsDraft: number
	campaignsApproved: number
	campaignsTotal: number
	ideasPending: number
	ideasTotal: number
}

export const QuickStats: React.FC = () => {
	const { channel, workspaceId, openView } = useGrowthWriter()
	const [stats, setStats] = useState<Stats>({
		campaignsPublished: 0,
		campaignsDraft: 0,
		campaignsApproved: 0,
		campaignsTotal: 0,
		ideasPending: 0,
		ideasTotal: 0,
	})

	const loadStats = useCallback(async () => {
		try {
			const [campaigns, ideas] = await Promise.all([
				channel.call<Campaign[]>('getCampaigns', { workspaceId }).catch(() => []),
				channel.call<BlogIdea[]>('getIdeas', { workspaceId }).catch(() => []),
			])

			setStats({
				campaignsPublished: (campaigns || []).filter((c: Campaign) => c.status === 'published').length,
				campaignsDraft: (campaigns || []).filter((c: Campaign) => c.status === 'draft').length,
				campaignsApproved: (campaigns || []).filter((c: Campaign) => c.status === 'approved').length,
				campaignsTotal: (campaigns || []).length,
				ideasPending: (ideas || []).filter((i: BlogIdea) => i.status === 'pending' || i.status === 'approved').length,
				ideasTotal: (ideas || []).length,
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
			<StatRow label="Published" value={String(stats.campaignsPublished)} onClick={() => openView('history')} />
			<StatRow label="Drafts" value={String(stats.campaignsDraft)} onClick={() => openView('schedule')} />
			<StatRow label="Approved" value={String(stats.campaignsApproved)} hint="ready to publish" />
			<StatRow label="Ideas" value={String(stats.ideasPending)} hint="pending" onClick={() => openView('blog-ideas')} />
		</div>
	)
}

const StatRow: React.FC<{ label: string; value: string; hint?: string; onClick?: () => void }> = ({ label, value, hint, onClick }) => {
	return (
		<div
			onClick={onClick}
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				fontSize: '12px',
				padding: '2px 0',
				cursor: onClick ? 'pointer' : 'default',
			}}
		>
			<span style={{ color: 'var(--vscode-foreground)' }}>{label}</span>
			<span>
				<span style={{ fontWeight: 600 }}>{value}</span>
				{hint && <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '10px', marginLeft: '4px' }}>{hint}</span>}
			</span>
		</div>
	)
}
