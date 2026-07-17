import React, { useState } from 'react';
import { useGrowthWriter } from '../growth-writer-shared/GrowthWriterContext.js';

function timeAgo(isoDate: string | null): string {
  if (!isoDate) return 'never';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function timeUntil(isoDate: string | null): string {
  if (!isoDate) return '-';
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return 'now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

export const SchedulerStatus: React.FC = () => {
  const { schedulerState, setSchedulerEnabled, runSchedulerNow } = useGrowthWriter();
  const [runningManual, setRunningManual] = useState(false);

  if (!schedulerState || !setSchedulerEnabled || !runSchedulerNow) {
    return (
      <div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', padding: '4px 0' }}>
				Scheduler loading...
			</div>);

  }

  const handleRunNow = async () => {
    setRunningManual(true);
    try {
      await runSchedulerNow();
    } finally {
      setRunningManual(false);
    }
  };

  const isRunning = schedulerState.running || runningManual;

  return (
    <div className="void-flex void-flex-col void-gap-2">
			{/* Enable/Disable Toggle */}
			<div className="void-flex void-items-center void-justify-between">
				<span className="void-text-xs">Auto-schedule</span>
				<button
          onClick={() => setSchedulerEnabled(!schedulerState.enabled)}
          className={`void-px-2 void-py-0.5 void-text-[10px] void-rounded-full void-border-none void-cursor-pointer void-font-semibold void-transition-colors ${schedulerState.enabled ? "void-bg-green-600 void-text-white hover:void-bg-green-700" : "void-bg-[var(--vscode-button-secondaryBackground)] void-text-[var(--vscode-button-secondaryForeground)] hover:void-bg-[var(--vscode-button-hoverBackground)]"}`}>

          
					{schedulerState.enabled ? 'ON' : 'OFF'}
				</button>
			</div>

			{/* Status Info */}
			<div className="void-flex void-flex-col void-gap-0.5 void-text-[11px] void-text-[var(--vscode-descriptionForeground)]">
				<div className="void-flex void-justify-between">
					<span>Last run</span>
					<span>{timeAgo(schedulerState.lastRunAt)}</span>
				</div>
				<div className="void-flex void-justify-between">
					<span>Next run</span>
					<span>{schedulerState.enabled ? timeUntil(schedulerState.nextRunAt) : 'disabled'}</span>
				</div>
			</div>

			{/* Running Indicator */}
			{isRunning &&
      <div className="void-text-[11px] void-px-2 void-py-1 void-rounded void-bg-[var(--vscode-editor-selectionBackground)] void-flex void-items-center void-gap-1.5">
					<span className="void-w-1.5 void-h-1.5 void-rounded-full void-bg-blue-500 void-inline-block void-animate-pulse" />
					Running...
				</div>
      }

			{/* Recent Actions */}
			{schedulerState.pendingActions.length > 0 &&
      <div className="void-flex void-flex-col void-gap-0.5">
					{schedulerState.pendingActions.slice(0, 4).map((action, i) =>
        <div key={i} className="void-text-[10px] void-text-[var(--vscode-descriptionForeground)] void-py-px">
							{action}
						</div>
        )}
				</div>
      }

			{/* Run Now Button */}
			<button
        onClick={handleRunNow}
        disabled={isRunning}
        className={`void-px-2 void-py-1 void-text-[11px] void-border void-border-[var(--vscode-button-border,transparent)] void-rounded void-bg-[var(--vscode-button-secondaryBackground)] void-text-[var(--vscode-button-secondaryForeground)] void-self-start void-transition-opacity ${isRunning ? "void-opacity-60 void-cursor-default" : "void-cursor-pointer hover:void-bg-[var(--vscode-button-hoverBackground)]"}`}>

        
				{isRunning ? 'Running...' : 'Run Now'}
			</button>
		</div>);

};