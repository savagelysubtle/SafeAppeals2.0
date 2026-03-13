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
		<div className="p-4">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-base font-semibold m-0">Weekly Schedule</h2>
				{schedulerState && (
					<div className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${schedulerState.enabled ? 'bg-green-600 text-white' : 'bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]'
						}`}>
						{schedulerState.enabled ? 'AUTO' : 'MANUAL'}
					</div>
				)}
			</div>

			{/* Summary Badges */}
			{(draftsCount > 0 || approvedCount > 0) && (
				<div className="flex gap-2 mb-3 text-[11px]">
					{draftsCount > 0 && (
						<span className="px-2 py-0.5 rounded-full bg-amber-900 text-amber-400">
							{draftsCount} needs approval
						</span>
					)}
					{approvedCount > 0 && (
						<span className="px-2 py-0.5 rounded-full bg-emerald-900 text-emerald-400">
							{approvedCount} ready to publish
						</span>
					)}
				</div>
			)}

			{/* Calendar Grid */}
			<div className="overflow-x-auto pb-2">
				<div className="grid grid-cols-5 gap-[1px] bg-[var(--vscode-panel-border)] rounded-lg overflow-hidden min-w-[700px]">
					{weekDates.map(({ dayName, date }) => {
						const silo = Object.entries(SILO_SCHEDULE).find(([, d]) => d === dayName)?.[0]
						const isToday = dayName === todayName
						return (
							<div
								key={dayName}
								className={`p-2 text-center font-semibold text-[13px] ${isToday ? 'bg-[var(--vscode-editor-selectionBackground)]' : 'bg-[var(--vscode-editor-background)]'
									}`}
							>
								<div>{dayName}</div>
								<div className="text-[10px] text-[var(--vscode-descriptionForeground)] mt-0.5">
									{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
								</div>
								{silo && (
									<div className="mt-1 flex justify-center">
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
								className="p-3 min-h-[120px] bg-[var(--vscode-editor-background)]"
							>
								{campaign ? (
									<div
										onClick={() => openView('blog-editor', { campaignId: campaign.id, label: campaign.blog_title || campaign.silo })}
										className={`p-2 rounded border cursor-pointer text-xs transition-colors hover:brightness-110 hover:bg-[var(--vscode-list-hoverBackground)] ${campaign.status === 'draft' ? 'border-amber-900 bg-amber-900/10' : campaign.status === 'approved' ? 'border-emerald-900 bg-emerald-900/10' : 'border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)]'
											}`}
									>
										<div className="font-medium mb-1 overflow-hidden line-clamp-2" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
											{campaign.blog_title || 'Untitled'}
										</div>
										<StatusBadge status={campaign.status} />
										{campaign.scheduled_for && (
											<div className="text-[10px] text-[var(--vscode-descriptionForeground)] mt-1">
												Scheduled: {new Date(campaign.scheduled_for).toLocaleDateString()}
											</div>
										)}
									</div>
								) : silo ? (
									<div className="flex flex-col items-center gap-2">
										<div className="text-[11px] text-[var(--vscode-descriptionForeground)] italic text-center">
											No campaign
										</div>
										<button
											onClick={() => handleGenerateForSilo(silo)}
											disabled={isGenerating}
											className={`px-2.5 py-1 text-[10px] rounded border-none bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] transition-opacity ${isGenerating ? 'opacity-60 cursor-default' : 'cursor-pointer hover:opacity-90'
												}`}
										>
											{isGenerating ? 'Generating...' : 'Generate Now'}
										</button>
									</div>
								) : (
									<div className="text-[11px] text-[var(--vscode-descriptionForeground)] italic">
										No silo scheduled
									</div>
								)}
							</div>
						)
					})}
				</div>
			</div>

			{/* All Campaigns List */}
			<div className="mt-6">
				<h3 className="text-sm font-semibold mb-3">All Campaigns</h3>
				{campaigns.length === 0 ? (
					<div className="text-[var(--vscode-descriptionForeground)]">No campaigns created yet.</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full border-collapse text-xs">
							<thead>
								<tr className="border-b border-[var(--vscode-panel-border)]">
									<th className="px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Silo</th>
									<th className="px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Title</th>
									<th className="px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Status</th>
									<th className="px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Scheduled</th>
									<th className="px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">Published</th>
								</tr>
							</thead>
							<tbody>
								{campaigns.map(c => (
									<tr
										key={c.id}
										className="border-b border-[var(--vscode-panel-border)] cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
										onClick={() => openView('blog-editor', { campaignId: c.id, label: c.blog_title || c.silo })}
									>
										<td className="px-3 py-2.5"><SiloBadge silo={c.silo} /></td>
										<td className="px-3 py-2.5 font-medium">{c.blog_title || 'Untitled'}</td>
										<td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
										<td className="px-3 py-2.5 text-[var(--vscode-descriptionForeground)]">
											{c.scheduled_for ? new Date(c.scheduled_for).toLocaleDateString() : '-'}
										</td>
										<td className="px-3 py-2.5 text-[var(--vscode-descriptionForeground)]">
											{c.published_at ? new Date(c.published_at).toLocaleDateString() : '-'}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	)
}
