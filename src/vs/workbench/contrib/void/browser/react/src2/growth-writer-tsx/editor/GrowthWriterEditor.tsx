import React, { useMemo } from 'react';
import { useAccessor } from '../../util/services.js';
import { GrowthWriterContext } from '../shared/GrowthWriterContext.js';
import { BlogEditor } from './BlogEditor.js';
import { BlogIdeasTable } from './BlogIdeasTable.js';
import { SocialPostsEditor } from './SocialPostsEditor.js';
import { RedditCommentEditor } from './RedditCommentEditor.js';
import { ScheduleCalendar } from './ScheduleCalendar.js';
import { HistoryMetrics } from './HistoryMetrics.js';
import { AccountHealth } from './AccountHealth.js';

type ViewType = 'blog-editor' | 'social-posts' | 'reddit-comment' | 'blog-ideas' | 'schedule' | 'history' | 'account-health';

const VIEWS: Record<ViewType, React.ComponentType<{viewData?: Record<string, string>;}>> = {
  'blog-editor': BlogEditor,
  'social-posts': SocialPostsEditor,
  'reddit-comment': RedditCommentEditor,
  'blog-ideas': BlogIdeasTable,
  'schedule': ScheduleCalendar,
  'history': HistoryMetrics,
  'account-health': AccountHealth
};

interface GrowthWriterEditorProps {
  viewType: ViewType;
  viewData?: Record<string, string>;
  openView: (viewType: string, viewData?: Record<string, string>) => void;
  channel: {call<T = unknown>(command: string, arg?: unknown): Promise<T>;};
}

export const GrowthWriterEditor: React.FC<GrowthWriterEditorProps> = ({ viewType, viewData, openView, channel }) => {
  const accessor = useAccessor();
  const workspaceId = useMemo(() => {
    try {
      const ws = accessor.get('IWorkspaceContextService');
      return ws.getWorkspace().id;
    } catch {
      return 'default';
    }
  }, [accessor]);

  const ctx = useMemo(() => ({ channel, openView, workspaceId }), [channel, openView, workspaceId]);
  const ViewComponent = VIEWS[viewType];

  if (!ViewComponent) {
    return (
      <div style={{ padding: '20px', color: 'var(--vscode-foreground)' }}>
				Unknown view: {viewType}
			</div>);

  }

  return (
    <GrowthWriterContext.Provider value={ctx}>
			<div style={{
        height: '100%',
        width: '100%',
        overflow: 'auto',
        color: 'var(--vscode-foreground)',
        backgroundColor: 'var(--vscode-editor-background)'
      }}>
				<ViewComponent viewData={viewData} />
			</div>
		</GrowthWriterContext.Provider>);

};