import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAccessor } from '../util/services.js'
import { GrowthWriterContext, SchedulerState } from '../growth-writer-shared/GrowthWriterContext.js'
import { CampaignQueue } from './CampaignQueue.js'
import { QuickStats } from './QuickStats.js'
import { SchedulerStatus } from './SchedulerStatus.js'

interface GrowthWriterSidebarProps {
	openView: (viewType: string, viewData?: Record<string, string>) => void
	channel: { call<T = unknown>(command: string, arg?: unknown): Promise<T> }
}

export const GrowthWriterSidebar: React.FC<GrowthWriterSidebarProps> = ({ openView, channel }) => {
	const accessor = useAccessor()
	const workspaceId = useMemo(() => {
		try {
			const ragService = accessor.get('IRAGService')
			return ragService.getWorkspaceId()
		} catch {
			return 'default'
		}
	}, [accessor])

	const [schedulerState, setSchedulerState] = useState<SchedulerState>({
		enabled: true,
		running: false,
		lastRunAt: null,
		nextRunAt: null,
		pendingActions: [],
	})

	useEffect(() => {
		try {
			const scheduler = accessor.get('IBlogSchedulerService')
			if (scheduler) {
				setSchedulerState(scheduler.state)
				const disposable = scheduler.onDidChangeState((state: SchedulerState) => {
					setSchedulerState(state)
				})
				return () => disposable.dispose()
			}
		} catch {
			// Scheduler not available yet
		}
	}, [accessor])

	const setSchedulerEnabled = useCallback((enabled: boolean) => {
		try {
			const scheduler = accessor.get('IBlogSchedulerService')
			if (scheduler) scheduler.setEnabled(enabled)
		} catch { /* noop */ }
	}, [accessor])

	const runSchedulerNow = useCallback(async () => {
		try {
			const scheduler = accessor.get('IBlogSchedulerService')
			if (scheduler) await scheduler.runNow()
		} catch { /* noop */ }
	}, [accessor])

	const ctx = useMemo(() => ({
		channel,
		openView,
		workspaceId,
		schedulerState,
		setSchedulerEnabled,
		runSchedulerNow,
	}), [channel, openView, workspaceId, schedulerState, setSchedulerEnabled, runSchedulerNow])

	return (
		<GrowthWriterContext.Provider value={ctx}>
			<div className="flex flex-col gap-1 h-full text-[var(--vscode-foreground)]">
				<QuickActions openView={openView} />
				<CollapsibleSection title="Scheduler" defaultOpen>
					<SchedulerStatus />
				</CollapsibleSection>
				<CollapsibleSection title="Campaign Queue" defaultOpen>
					<CampaignQueue />
				</CollapsibleSection>
				<CollapsibleSection title="Quick Stats" defaultOpen>
					<QuickStats />
				</CollapsibleSection>
			</div>
		</GrowthWriterContext.Provider>
	)
}

const QuickActions: React.FC<{ openView: (viewType: string, viewData?: Record<string, string>) => void }> = ({ openView }) => {
	return (
		<div className="flex flex-wrap gap-1.5 p-3">
			<ActionButton label="Blog Ideas" onClick={() => openView('blog-ideas')} />
			<ActionButton label="Schedule" onClick={() => openView('schedule')} />
			<ActionButton label="History" onClick={() => openView('history')} />
		</div>
	)
}

const ActionButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => {
	return (
		<button
			onClick={onClick}
			className="px-3 py-1 text-xs border border-[var(--vscode-button-border,transparent)] rounded cursor-pointer bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-hoverBackground)] transition-colors"
		>
			{label}
		</button>
	)
}

interface CollapsibleSectionProps {
	title: string
	defaultOpen?: boolean
	children: React.ReactNode
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, defaultOpen = true, children }) => {
	const [open, setOpen] = useState(defaultOpen)
	return (
		<div>
			<button
				onClick={() => setOpen(!open)}
				className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider border-none cursor-pointer bg-[var(--vscode-sideBarSectionHeader-background)] text-[var(--vscode-sideBarSectionHeader-foreground)] border-t border-[var(--vscode-sideBarSectionHeader-border,transparent)] hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
			>
				<span className="text-xs transition-transform duration-150" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
				{title}
			</button>
			{open && (
				<div className="p-2">
					{children}
				</div>
			)}
		</div>
	)
}
