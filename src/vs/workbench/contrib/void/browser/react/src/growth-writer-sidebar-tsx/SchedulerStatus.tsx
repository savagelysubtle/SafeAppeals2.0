import React, { useState } from 'react'
import { useGrowthWriter } from '../growth-writer-shared/GrowthWriterContext.js'

function timeAgo(isoDate: string | null): string {
	if (!isoDate) return 'never'
	const diff = Date.now() - new Date(isoDate).getTime()
	const mins = Math.floor(diff / 60000)
	if (mins < 1) return 'just now'
	if (mins < 60) return `${mins}m ago`
	const hours = Math.floor(mins / 60)
	if (hours < 24) return `${hours}h ago`
	return `${Math.floor(hours / 24)}d ago`
}

function timeUntil(isoDate: string | null): string {
	if (!isoDate) return '-'
	const diff = new Date(isoDate).getTime() - Date.now()
	if (diff <= 0) return 'now'
	const mins = Math.floor(diff / 60000)
	if (mins < 60) return `${mins}m`
	const hours = Math.floor(mins / 60)
	return `${hours}h ${mins % 60}m`
}

export const SchedulerStatus: React.FC = () => {
	const { schedulerState, setSchedulerEnabled, runSchedulerNow } = useGrowthWriter()
	const [runningManual, setRunningManual] = useState(false)

	if (!schedulerState || !setSchedulerEnabled || !runSchedulerNow) {
		return (
			<div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', padding: '4px 0' }}>
				Scheduler loading...
			</div>
		)
	}

	const handleRunNow = async () => {
		setRunningManual(true)
		try {
			await runSchedulerNow()
		} finally {
			setRunningManual(false)
		}
	}

	const isRunning = schedulerState.running || runningManual

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
			{/* Enable/Disable Toggle */}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
				<span style={{ fontSize: '12px' }}>Auto-schedule</span>
				<button
					onClick={() => setSchedulerEnabled(!schedulerState.enabled)}
					style={{
						padding: '2px 8px',
						fontSize: '10px',
						borderRadius: '10px',
						border: 'none',
						cursor: 'pointer',
						backgroundColor: schedulerState.enabled ? '#16a34a' : 'var(--vscode-button-secondaryBackground)',
						color: schedulerState.enabled ? '#ffffff' : 'var(--vscode-button-secondaryForeground)',
						fontWeight: 600,
					}}
				>
					{schedulerState.enabled ? 'ON' : 'OFF'}
				</button>
			</div>

			{/* Status Info */}
			<div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between' }}>
					<span>Last run</span>
					<span>{timeAgo(schedulerState.lastRunAt)}</span>
				</div>
				<div style={{ display: 'flex', justifyContent: 'space-between' }}>
					<span>Next run</span>
					<span>{schedulerState.enabled ? timeUntil(schedulerState.nextRunAt) : 'disabled'}</span>
				</div>
			</div>

			{/* Running Indicator */}
			{isRunning && (
				<div style={{
					fontSize: '11px',
					padding: '4px 8px',
					borderRadius: '4px',
					backgroundColor: 'var(--vscode-editor-selectionBackground)',
					display: 'flex',
					alignItems: 'center',
					gap: '6px',
				}}>
					<span style={{ animation: 'pulse 1.5s infinite', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block' }} />
					Running...
				</div>
			)}

			{/* Recent Actions */}
			{schedulerState.pendingActions.length > 0 && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
					{schedulerState.pendingActions.slice(0, 4).map((action, i) => (
						<div key={i} style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', padding: '1px 0' }}>
							{action}
						</div>
					))}
				</div>
			)}

			{/* Run Now Button */}
			<button
				onClick={handleRunNow}
				disabled={isRunning}
				style={{
					padding: '3px 8px',
					fontSize: '11px',
					border: '1px solid var(--vscode-button-border, transparent)',
					borderRadius: '3px',
					cursor: isRunning ? 'default' : 'pointer',
					backgroundColor: 'var(--vscode-button-secondaryBackground)',
					color: 'var(--vscode-button-secondaryForeground)',
					opacity: isRunning ? 0.6 : 1,
					alignSelf: 'flex-start',
				}}
			>
				{isRunning ? 'Running...' : 'Run Now'}
			</button>
		</div>
	)
}
