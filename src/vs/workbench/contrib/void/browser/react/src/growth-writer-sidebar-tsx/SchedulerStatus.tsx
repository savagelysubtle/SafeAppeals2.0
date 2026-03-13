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
		<div className="flex flex-col gap-2">
			{/* Enable/Disable Toggle */}
			<div className="flex items-center justify-between">
				<span className="text-xs">Auto-schedule</span>
				<button
					onClick={() => setSchedulerEnabled(!schedulerState.enabled)}
					className={`px-2 py-0.5 text-[10px] rounded-full border-none cursor-pointer font-semibold transition-colors ${schedulerState.enabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-hoverBackground)]'
						}`}
				>
					{schedulerState.enabled ? 'ON' : 'OFF'}
				</button>
			</div>

			{/* Status Info */}
			<div className="flex flex-col gap-0.5 text-[11px] text-[var(--vscode-descriptionForeground)]">
				<div className="flex justify-between">
					<span>Last run</span>
					<span>{timeAgo(schedulerState.lastRunAt)}</span>
				</div>
				<div className="flex justify-between">
					<span>Next run</span>
					<span>{schedulerState.enabled ? timeUntil(schedulerState.nextRunAt) : 'disabled'}</span>
				</div>
			</div>

			{/* Running Indicator */}
			{isRunning && (
				<div className="text-[11px] px-2 py-1 rounded bg-[var(--vscode-editor-selectionBackground)] flex items-center gap-1.5">
					<span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block animate-pulse" />
					Running...
				</div>
			)}

			{/* Recent Actions */}
			{schedulerState.pendingActions.length > 0 && (
				<div className="flex flex-col gap-0.5">
					{schedulerState.pendingActions.slice(0, 4).map((action, i) => (
						<div key={i} className="text-[10px] text-[var(--vscode-descriptionForeground)] py-px">
							{action}
						</div>
					))}
				</div>
			)}

			{/* Run Now Button */}
			<button
				onClick={handleRunNow}
				disabled={isRunning}
				className={`px-2 py-1 text-[11px] border border-[var(--vscode-button-border,transparent)] rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] self-start transition-opacity ${isRunning ? 'opacity-60 cursor-default' : 'cursor-pointer hover:bg-[var(--vscode-button-hoverBackground)]'
					}`}
			>
				{isRunning ? 'Running...' : 'Run Now'}
			</button>
		</div>
	)
}
