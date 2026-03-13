import React, { useCallback, useEffect, useState } from 'react'
import { useGrowthWriter, Campaign } from '../growth-writer-shared/GrowthWriterContext.js'
import { SiloBadge } from '../growth-writer-shared/SiloSelector.js'
import { StatusBadge } from '../growth-writer-shared/StatusBadge.js'

const SCHEDULE_DAYS: Record<string, string> = {
	lawyers: 'Monday',
	workers_comp: 'Tuesday',
	researchers: 'Wednesday',
	students: 'Thursday',
	business: 'Friday',
}

export const CampaignQueue: React.FC = () => {
	const { channel, workspaceId, openView } = useGrowthWriter()
	const [campaigns, setCampaigns] = useState<Campaign[]>([])
	const [loading, setLoading] = useState(true)

	const loadCampaigns = useCallback(async () => {
		try {
			const result = await channel.call<Campaign[]>('getCampaigns', { workspaceId })
			setCampaigns(result || [])
		} catch (err) {
			console.error('[GrowthWriter] Failed to load campaigns:', err)
		} finally {
			setLoading(false)
		}
	}, [channel, workspaceId])

	useEffect(() => {
		loadCampaigns()
		const interval = setInterval(loadCampaigns, 30000)
		return () => clearInterval(interval)
	}, [loadCampaigns])

	if (loading) {
		return <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', padding: '4px 0' }}>Loading campaigns...</div>
	}

	if (campaigns.length === 0) {
		return <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', padding: '4px 0' }}>No campaigns yet. Generate ideas to get started.</div>
	}

	return (
		<div className="flex flex-col gap-1">
			{campaigns.slice(0, 8).map(campaign => (
				<CampaignRow key={campaign.id} campaign={campaign} onClick={() => {
					openView('blog-editor', { campaignId: campaign.id, label: campaign.blog_title || campaign.silo })
				}} />
			))}
		</div>
	)
}

const CampaignRow: React.FC<{ campaign: Campaign; onClick: () => void }> = ({ campaign, onClick }) => {
	const day = SCHEDULE_DAYS[campaign.silo] || ''

	return (
		<div
			onClick={onClick}
			className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] text-xs transition-colors"
		>
			<SiloBadge silo={campaign.silo} />
			<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
				{campaign.blog_title || 'Untitled'}
			</span>
			<StatusBadge status={campaign.status} />
			{day && <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">{day}</span>}
		</div>
	)
}
