import React, { useCallback, useEffect, useState } from 'react'
import { useGrowthWriter, Campaign, SILO_LABELS } from '../growth-writer-shared/GrowthWriterContext.js'
import { SiloBadge } from '../growth-writer-shared/SiloSelector.js'
import { StatusBadge } from '../growth-writer-shared/StatusBadge.js'

interface ScheduleCalendarProps {
	viewData?: Record<string, string>
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const SILO_SCHEDULE: Record<string, string> = {
	lawyers: 'Monday',
	workers_comp: 'Tuesday',
	researchers: 'Wednesday',
	students: 'Thursday',
	business: 'Friday',
}

function getWeekDates(): { dayName: string; date: Date }[] {
	const now = new Date()
	const day = now.getDay()
	const diffToMonday = day === 0 ? -6 : 1 - day
	const monday = new Date(now)
	monday.setDate(now.getDate() + diffToMonday)
	monday.setHours(0, 0, 0, 0)

	return DAYS.map((name, i) => {
		const d = new Date(monday)
		d.setDate(monday.getDate() + i)
		return { dayName: name, date: d }
	})
}

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = () => {
	const { channel, workspaceId, openView, generateBlogForIdea, schedulerState } = useGrowthWriter()
	const [campaigns, setCampaigns] = useState<Campaign[]>([])
	const [loading, setLoading] = useState(true)
	const [generating, setGenerating] = useState<string | null>(null)

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

	useEffect(() => { loadCampaigns() }, [loadCampaigns])

	const weekDates = getWeekDates()

	const campaignOfDay = (day: string) => {
		const silo = Object.entries(SILO_SCHEDULE).find(([, d]) => d === day)?.[0]
		if (!silo) return null
		return campaigns.find(c => c.silo === silo && c.status !== 'failed') || null
	}

	const handleGenerateForSilo = async (silo: string) => {
		if (!generateBlogForIdea) return
		setGenerating(silo)
		try {
			const topIdea = await channel.call<{ id: string } | null>('getTopPendingIdea', { workspaceId, silo })
			if (topIdea) {
				await generateBlogForIdea(topIdea.id)
				await loadCampaigns()
			}
		} catch (err) {
			console.error('[GrowthWriter] Generate for silo failed:', err)
		} finally {
			setGenerating(null)
		}
	}

	if (loading) {
		return <div style={{ padding: '20px' }}>Loading schedule...</div>
	}

	const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
	const draftsCount = campaigns.filter(c => c.status === 'draft').length
	const approvedCount = campaigns.filter(c => c.status === 'approved').length

	return (
		<div style={{ padding: '16px' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
				<h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Weekly Schedule</h2>
				{schedulerState && (
					<div style={{
						fontSize: '10px',
						padding: '2px 8px',
						borderRadius: '10px',
						backgroundColor: schedulerState.enabled ? '#16a34a' : 'var(--vscode-button-secondaryBackground)',
						color: schedulerState.enabled ? '#ffffff' : 'var(--vscode-button-secondaryForeground)',
						fontWeight: 600,
					}}>
						{schedulerState.enabled ? 'AUTO' : 'MANUAL'}
					</div>
				)}
			</div>

			{/* Summary Badges */}
			{(draftsCount > 0 || approvedCount > 0) && (
				<div style={{ display: 'flex', gap: '8px', marginBottom: '12px', fontSize: '11px' }}>
					{draftsCount > 0 && (
						<span style={{ padding: '2px 8px', borderRadius: '10px', backgroundColor: '#92400e', color: '#fbbf24' }}>
							{draftsCount} needs approval
						</span>
					)}
					{approvedCount > 0 && (
						<span style={{ padding: '2px 8px', borderRadius: '10px', backgroundColor: '#065f46', color: '#34d399' }}>
							{approvedCount} ready to publish
						</span>
					)}
				</div>
			)}

			{/* Calendar Grid */}
			<div style={{
				display: 'grid',
				gridTemplateColumns: `repeat(${DAYS.length}, 1fr)`,
				gap: '1px',
				backgroundColor: 'var(--vscode-panel-border)',
				borderRadius: '8px',
				overflow: 'hidden',
			}}>
				{weekDates.map(({ dayName, date }) => {
					const silo = Object.entries(SILO_SCHEDULE).find(([, d]) => d === dayName)?.[0]
					const isToday = dayName === todayName
					return (
						<div
							key={dayName}
							style={{
								padding: '12px',
								textAlign: 'center',
								backgroundColor: isToday ? 'var(--vscode-editor-selectionBackground)' : 'var(--vscode-editor-background)',
								fontWeight: 600,
								fontSize: '13px',
							}}
						>
							<div>{dayName}</div>
							<div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>
								{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
							</div>
							{silo && (
								<div style={{ marginTop: '4px' }}>
									<SiloBadge silo={silo} />
								</div>
							)}
						</div>
					)
				})}

				{weekDates.map(({ dayName }) => {
					const campaign = campaignOfDay(dayName)
					const silo = Object.entries(SILO_SCHEDULE).find(([, d]) => d === dayName)?.[0]
					const isGenerating = generating === silo
					return (
						<div
							key={`content-${dayName}`}
							style={{
								padding: '12px',
								minHeight: '120px',
								backgroundColor: 'var(--vscode-editor-background)',
							}}
						>
							{campaign ? (
								<div
									onClick={() => openView('blog-editor', { campaignId: campaign.id, label: campaign.blog_title || campaign.silo })}
									style={{
										padding: '8px',
										borderRadius: '4px',
										border: `1px solid ${campaign.status === 'draft' ? '#92400e' : campaign.status === 'approved' ? '#065f46' : 'var(--vscode-panel-border)'}`,
										cursor: 'pointer',
										fontSize: '12px',
									}}
								>
									<div style={{ fontWeight: 500, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										{campaign.blog_title || 'Untitled'}
									</div>
									<StatusBadge status={campaign.status} />
									{campaign.scheduled_for && (
										<div style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
											Scheduled: {new Date(campaign.scheduled_for).toLocaleDateString()}
										</div>
									)}
								</div>
							) : silo ? (
								<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
									<div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic', textAlign: 'center' }}>
										No campaign
									</div>
									<button
										onClick={() => handleGenerateForSilo(silo)}
										disabled={isGenerating}
										style={{
											padding: '3px 10px',
											fontSize: '10px',
											borderRadius: '3px',
											border: 'none',
											cursor: isGenerating ? 'default' : 'pointer',
											backgroundColor: 'var(--vscode-button-background)',
											color: 'var(--vscode-button-foreground)',
											opacity: isGenerating ? 0.6 : 1,
										}}
									>
										{isGenerating ? 'Generating...' : 'Generate Now'}
									</button>
								</div>
							) : (
								<div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>
									No silo scheduled
								</div>
							)}
						</div>
					)
				})}
			</div>

			{/* All Campaigns List */}
			<div style={{ marginTop: '24px' }}>
				<h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>All Campaigns</h3>
				{campaigns.length === 0 ? (
					<div style={{ color: 'var(--vscode-descriptionForeground)' }}>No campaigns created yet.</div>
				) : (
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
							{campaigns.map(c => (
								<tr
									key={c.id}
									style={{ borderBottom: '1px solid var(--vscode-panel-border)', cursor: 'pointer' }}
									onClick={() => openView('blog-editor', { campaignId: c.id, label: c.blog_title || c.silo })}
								>
									<td style={tdStyle}><SiloBadge silo={c.silo} /></td>
									<td style={tdStyle}>{c.blog_title || 'Untitled'}</td>
									<td style={tdStyle}><StatusBadge status={c.status} /></td>
									<td style={{ ...tdStyle, color: 'var(--vscode-descriptionForeground)' }}>
										{c.scheduled_for ? new Date(c.scheduled_for).toLocaleDateString() : '-'}
									</td>
									<td style={{ ...tdStyle, color: 'var(--vscode-descriptionForeground)' }}>
										{c.published_at ? new Date(c.published_at).toLocaleDateString() : '-'}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	)
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
