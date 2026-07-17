import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGrowthWriter, BlogIdea, SILO_LABELS, SILO_COLORS } from '../growth-writer-shared/GrowthWriterContext.js';
import { SiloSelector, SiloBadge } from '../growth-writer-shared/SiloSelector.js';
import { StatusBadge } from '../growth-writer-shared/StatusBadge.js';

interface BlogIdeasTableProps {
  viewData?: Record<string, string>;
}

export const BlogIdeasTable: React.FC<BlogIdeasTableProps> = () => {
  const ctx = useGrowthWriter();
  const { channel, workspaceId, openView } = ctx;
  const [ideas, setIdeas] = useState<BlogIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSilo, setFilterSilo] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [showGenerateDropdown, setShowGenerateDropdown] = useState(false);
  const generateDropdownRef = useRef<HTMLDivElement>(null);

  const loadIdeas = useCallback(async () => {
    try {
      const result = await channel.call<BlogIdea[]>('getIdeas', { workspaceId });
      setIdeas(result || []);
    } catch (err) {
      console.error('[GrowthWriter] Failed to load ideas:', err);
    } finally {
      setLoading(false);
    }
  }, [channel, workspaceId]);

  useEffect(() => {loadIdeas();}, [loadIdeas]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (generateDropdownRef.current && !generateDropdownRef.current.contains(e.target as Node)) {
        setShowGenerateDropdown(false);
      }
    };
    if (showGenerateDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGenerateDropdown]);

  const filteredIdeas = ideas.filter((idea) => {
    if (filterSilo !== 'all' && idea.silo !== filterSilo) return false;
    if (filterStatus !== 'all' && idea.status !== filterStatus) return false;
    return true;
  });

  const handleGenerate = async (silo: string) => {
    setShowGenerateDropdown(false);
    setGenerating(true);
    try {
      const { generateIdeas } = ctx;
      if (generateIdeas) {
        await generateIdeas(silo, 5);
      } else {
        console.warn('[GrowthWriter] generateIdeas not available on context');
      }
      await loadIdeas();
    } catch (err) {
      console.error('[GrowthWriter] Generate failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkAction = async (newStatus: string) => {
    try {
      for (const id of selectedIds) {
        await channel.call('updateIdeaStatus', { workspaceId, ideaId: id, status: newStatus });
      }
      setSelectedIds(new Set());
      await loadIdeas();
    } catch (err) {
      console.error('[GrowthWriter] Bulk action failed:', err);
    }
  };

  const handleBulkDelete = async () => {
    try {
      for (const id of selectedIds) {
        await channel.call('deleteIdea', { workspaceId, ideaId: id });
      }
      setSelectedIds(new Set());
      await loadIdeas();
    } catch (err) {
      console.error('[GrowthWriter] Bulk delete failed:', err);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else
      next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredIdeas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIdeas.map((i) => i.id)));
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading ideas...</div>;
  }

  return (
    <div className="void-flex void-flex-col void-h-full">
			{/* Toolbar */}
			<div className="void-flex void-items-center void-gap-2 void-px-4 void-py-3 void-border-b void-border-[var(--vscode-panel-border)] void-flex-wrap">
				<span className="void-font-semibold void-text-sm">Blog Ideas</span>
				<div className="void-flex-1" />
				<SiloSelector value={filterSilo} onChange={setFilterSilo} includeAll />
				<select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="void-bg-[var(--vscode-input-background)] void-text-[var(--vscode-input-foreground)] void-border void-border-[var(--vscode-input-border)] void-rounded void-px-2 void-py-1 void-text-xs">
          
					<option value="all">All Status</option>
					<option value="pending">Pending</option>
					<option value="approved">Approved</option>
					<option value="rejected">Rejected</option>
					<option value="used">Used</option>
				</select>
				<div ref={generateDropdownRef} className="void-relative">
					<button
            onClick={() => !generating && setShowGenerateDropdown((prev) => !prev)}
            disabled={generating}
            className={`void-px-3 void-py-1 void-text-xs void-rounded void-border-none void-bg-[var(--vscode-button-background)] void-text-[var(--vscode-button-foreground)] void-inline-flex void-items-center void-gap-1 void-transition-opacity ${generating ? "void-opacity-60 void-cursor-default" : "void-cursor-pointer hover:void-opacity-90"}`}>

            
						{generating ? 'Generating...' : 'Generate More'}
						{!generating && <span className="void-text-[10px]">&#9662;</span>}
					</button>
					{showGenerateDropdown &&
          <div className="void-absolute void-top-full void-right-0 void-mt-1 void-bg-[var(--vscode-menu-background,var(--vscode-dropdown-background))] void-border void-border-[var(--vscode-menu-border,var(--vscode-dropdown-border))] void-rounded void-shadow-[0_4px_12px_rgba(0,0,0,0.3)] void-z-[100] void-min-w-[160px] void-overflow-hidden">
							{Object.entries(SILO_LABELS).map(([key, label]) =>
            <button
              key={key}
              onClick={() => handleGenerate(key)}
              className="void-flex void-items-center void-gap-2 void-w-full void-px-3 void-py-2 void-text-xs void-border-none void-bg-transparent void-text-[var(--vscode-menu-foreground,var(--vscode-dropdown-foreground))] void-cursor-pointer void-text-left hover:void-bg-[var(--vscode-list-hoverBackground)]">
              
									<span style={{ backgroundColor: SILO_COLORS[key] || '#6b7280' }} className="void-w-2 void-h-2 void-rounded-full void-shrink-0" />
									{label}
								</button>
            )}
						</div>
          }
				</div>
			</div>

			{/* Bulk Actions */}
			{selectedIds.size > 0 &&
      <div className="void-flex void-items-center void-gap-2 void-px-4 void-py-1.5 void-bg-[var(--vscode-editor-selectionBackground)] void-text-xs">
					<span>{selectedIds.size} selected</span>
					<button onClick={() => handleBulkAction('approved')} className="void-px-2 void-py-0.5 void-text-[11px] void-rounded void-border void-border-[var(--vscode-button-border,transparent)] void-bg-[var(--vscode-button-secondaryBackground)] void-text-[var(--vscode-button-secondaryForeground)] void-cursor-pointer hover:void-opacity-90">Approve</button>
					<button onClick={() => handleBulkAction('rejected')} className="void-px-2 void-py-0.5 void-text-[11px] void-rounded void-border void-border-[var(--vscode-button-border,transparent)] void-bg-[var(--vscode-button-secondaryBackground)] void-text-[var(--vscode-button-secondaryForeground)] void-cursor-pointer hover:void-opacity-90">Reject</button>
					<button onClick={handleBulkDelete} className="void-px-2 void-py-0.5 void-text-[11px] void-rounded void-border-none void-bg-red-700 void-text-white void-cursor-pointer hover:void-bg-red-800">Delete</button>
					{selectedIds.size === 1 &&
        <button onClick={() => {
          const ideaId = Array.from(selectedIds)[0];
          const idea = ideas.find((i) => i.id === ideaId);
          if (idea) openView('blog-editor', { ideaId, label: idea.title });
        }} className="void-px-2 void-py-0.5 void-text-[11px] void-rounded void-border-none void-bg-[var(--vscode-button-background)] void-text-[var(--vscode-button-foreground)] void-cursor-pointer hover:void-opacity-90">Generate Blog</button>
        }
				</div>
      }

			{/* Table */}
			<div className="void-flex-1 void-overflow-auto">
				<table className="void-w-full void-border-collapse void-text-xs">
					<thead className="void-sticky void-top-0 void-bg-[var(--vscode-editor-background)] void-z-10 void-shadow-[0_1px_0_var(--vscode-panel-border)]">
						<tr>
							<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">
								<input type="checkbox" checked={selectedIds.size === filteredIdeas.length && filteredIdeas.length > 0} onChange={toggleSelectAll} />
							</th>
							<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Title</th>
							<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Silo</th>
							<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Angle</th>
							<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Status</th>
							<th className="void-px-3 void-py-2 void-text-left void-font-semibold void-text-[11px] void-uppercase void-tracking-wider void-text-[var(--vscode-descriptionForeground)]">Created</th>
						</tr>
					</thead>
					<tbody>
						{filteredIdeas.map((idea) =>
            <tr
              key={idea.id}
              className="void-border-b void-border-[var(--vscode-panel-border)] void-cursor-pointer hover:void-bg-[var(--vscode-list-hoverBackground)] void-transition-colors"
              onClick={() => openView('blog-editor', { ideaId: idea.id, label: idea.title })}>
              
								<td className="void-px-3 void-py-2.5" onClick={(e) => {e.stopPropagation();toggleSelect(idea.id);}}>
									<input type="checkbox" checked={selectedIds.has(idea.id)} readOnly />
								</td>
								<td className="void-px-3 void-py-2.5 void-font-medium void-max-w-[300px] void-overflow-hidden void-text-ellipsis void-whitespace-nowrap">
									{idea.title}
								</td>
								<td className="void-px-3 void-py-2.5"><SiloBadge silo={idea.silo} /></td>
								<td className="void-px-3 void-py-2.5 void-max-w-[200px] void-overflow-hidden void-text-ellipsis void-whitespace-nowrap void-text-[var(--vscode-descriptionForeground)]">
									{idea.content_angle}
								</td>
								<td className="void-px-3 void-py-2.5"><StatusBadge status={idea.status} /></td>
								<td className="void-px-3 void-py-2.5 void-text-[var(--vscode-descriptionForeground)]">
									{idea.created_at ? new Date(idea.created_at).toLocaleDateString() : ''}
								</td>
							</tr>
            )}
					</tbody>
				</table>
				{filteredIdeas.length === 0 &&
        <div className="void-p-5 void-text-center void-text-[var(--vscode-descriptionForeground)]">
						No ideas found. Try generating some.
					</div>
        }
			</div>
		</div>);

};