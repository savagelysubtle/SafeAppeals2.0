import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccessor } from '../util/services.js';
import { GrowthWriterContext, SchedulerState } from '../growth-writer-shared/GrowthWriterContext.js';
import { CampaignQueue } from './CampaignQueue.js';
import { QuickStats } from './QuickStats.js';
import { SchedulerStatus } from './SchedulerStatus.js';

interface GrowthWriterSidebarProps {
  openView: (viewType: string, viewData?: Record<string, string>) => void;
  channel: {call<T = unknown>(command: string, arg?: unknown): Promise<T>;};
}

export const GrowthWriterSidebar: React.FC<GrowthWriterSidebarProps> = ({ openView, channel }) => {
  const accessor = useAccessor();
  const workspaceId = useMemo(() => {
    try {
      const ragService = accessor.get('IRAGService');
      return ragService.getWorkspaceId();
    } catch {
      return 'default';
    }
  }, [accessor]);

  const [schedulerState, setSchedulerState] = useState<SchedulerState>({
    enabled: true,
    running: false,
    lastRunAt: null,
    nextRunAt: null,
    pendingActions: []
  });

  useEffect(() => {
    try {
      const scheduler = accessor.get('IBlogSchedulerService');
      if (scheduler) {
        setSchedulerState(scheduler.state);
        const disposable = scheduler.onDidChangeState((state: SchedulerState) => {
          setSchedulerState(state);
        });
        return () => disposable.dispose();
      }
    } catch {

      // Scheduler not available yet
    }}, [accessor]);

  const setSchedulerEnabled = useCallback((enabled: boolean) => {
    try {
      const scheduler = accessor.get('IBlogSchedulerService');
      if (scheduler) scheduler.setEnabled(enabled);
    } catch {/* noop */}
  }, [accessor]);

  const runSchedulerNow = useCallback(async () => {
    try {
      const scheduler = accessor.get('IBlogSchedulerService');
      if (scheduler) await scheduler.runNow();
    } catch {/* noop */}
  }, [accessor]);

  const ctx = useMemo(() => ({
    channel,
    openView,
    workspaceId,
    schedulerState,
    setSchedulerEnabled,
    runSchedulerNow
  }), [channel, openView, workspaceId, schedulerState, setSchedulerEnabled, runSchedulerNow]);

  return (
    <GrowthWriterContext.Provider value={ctx}>
			<div className="void-flex void-flex-col void-gap-1 void-h-full void-text-[var(--vscode-foreground)]">
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
		</GrowthWriterContext.Provider>);

};

const QuickActions: React.FC<{openView: (viewType: string, viewData?: Record<string, string>) => void;}> = ({ openView }) => {
  return (
    <div className="void-flex void-flex-wrap void-gap-1.5 void-p-3">
			<ActionButton label="Blog Ideas" onClick={() => openView('blog-ideas')} />
			<ActionButton label="Schedule" onClick={() => openView('schedule')} />
			<ActionButton label="History" onClick={() => openView('history')} />
		</div>);

};

const ActionButton: React.FC<{label: string;onClick: () => void;}> = ({ label, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="void-px-3 void-py-1 void-text-xs void-border void-border-[var(--vscode-button-border,transparent)] void-rounded void-cursor-pointer void-bg-[var(--vscode-button-secondaryBackground)] void-text-[var(--vscode-button-secondaryForeground)] hover:void-bg-[var(--vscode-button-hoverBackground)] void-transition-colors">
      
			{label}
		</button>);

};

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
			<button
        onClick={() => setOpen(!open)}
        className="void-flex void-items-center void-gap-1.5 void-w-full void-px-2 void-py-1.5 void-text-[11px] void-font-semibold void-uppercase void-tracking-wider void-border-none void-cursor-pointer void-bg-[var(--vscode-sideBarSectionHeader-background)] void-text-[var(--vscode-sideBarSectionHeader-foreground)] void-border-t void-border-[var(--vscode-sideBarSectionHeader-border,transparent)] hover:void-bg-[var(--vscode-list-hoverBackground)] void-transition-colors">
        
				<span className="void-text-xs void-transition-transform void-duration-150" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
				{title}
			</button>
			{open &&
      <div className="void-p-2">
					{children}
				</div>
      }
		</div>);

};