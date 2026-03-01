import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useGrowthWriter, BlogIdea, SILO_LABELS, SILO_COLORS } from '../growth-writer-shared/GrowthWriterContext.js'
import { SiloSelector, SiloBadge } from '../growth-writer-shared/SiloSelector.js'
import { StatusBadge } from '../growth-writer-shared/StatusBadge.js'

interface BlogIdeasTableProps {
	viewData?: Record<string, string>
}

export const BlogIdeasTable: React.FC<BlogIdeasTableProps> = () => {
	const ctx = useGrowthWriter()
	const { channel, workspaceId, openView } = ctx
	const [ideas, setIdeas] = useState<BlogIdea[]>([])
	const [loading, setLoading] = useState(true)
	const [filterSilo, setFilterSilo] = useState('all')
	const [filterStatus, setFilterStatus] = useState('all')
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [generating, setGenerating] = useState(false)
	const [showGenerateDropdown, setShowGenerateDropdown] = useState(false)
	const generateDropdownRef = useRef<HTMLDivElement>(null)

	const loadIdeas = useCallback(async () => {
		try {
			const result = await channel.call<BlogIdea[]>('getIdeas', { workspaceId })
			setIdeas(result || [])
		} catch (err) {
			console.error('[GrowthWriter] Failed to load ideas:', err)
		} finally {
			setLoading(false)
		}
	}, [channel, workspaceId])

	useEffect(() => { loadIdeas() }, [loadIdeas])

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (generateDropdownRef.current && !generateDropdownRef.current.contains(e.target as Node)) {
				setShowGenerateDropdown(false)
			}
		}
		if (showGenerateDropdown) {
			document.addEventListener('mousedown', handleClickOutside)
		}
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [showGenerateDropdown])

	const filteredIdeas = ideas.filter(idea => {
		if (filterSilo !== 'all' && idea.silo !== filterSilo) return false
		if (filterStatus !== 'all' && idea.status !== filterStatus) return false
		return true
	})

	const handleGenerate = async (silo: string) => {
		setShowGenerateDropdown(false)
		setGenerating(true)
		try {
			const { generateIdeas } = ctx
			if (generateIdeas) {
				await generateIdeas(silo, 5)
			} else {
				console.warn('[GrowthWriter] generateIdeas not available on context')
			}
			await loadIdeas()
		} catch (err) {
			console.error('[GrowthWriter] Generate failed:', err)
		} finally {
			setGenerating(false)
		}
	}

	const handleBulkAction = async (newStatus: string) => {
		try {
			for (const id of selectedIds) {
				await channel.call('updateIdeaStatus', { workspaceId, ideaId: id, status: newStatus })
			}
			setSelectedIds(new Set())
			await loadIdeas()
		} catch (err) {
			console.error('[GrowthWriter] Bulk action failed:', err)
		}
	}

	const handleBulkDelete = async () => {
		try {
			for (const id of selectedIds) {
				await channel.call('deleteIdea', { workspaceId, ideaId: id })
			}
			setSelectedIds(new Set())
			await loadIdeas()
		} catch (err) {
			console.error('[GrowthWriter] Bulk delete failed:', err)
		}
	}

	const toggleSelect = (id: string) => {
		setSelectedIds(prev => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const toggleSelectAll = () => {
		if (selectedIds.size === filteredIdeas.length) {
			setSelectedIds(new Set())
		} else {
			setSelectedIds(new Set(filteredIdeas.map(i => i.id)))
		}
	}

	if (loading) {
		return <div style={{ padding: '20px' }}>Loading ideas...</div>
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
			{/* Toolbar */}
			<div style={{
				display: 'flex',
				alignItems: 'center',
				gap: '8px',
				padding: '12px 16px',
				borderBottom: '1px solid var(--vscode-panel-border)',
				flexWrap: 'wrap',
			}}>
				<span style={{ fontWeight: 600, fontSize: '14px' }}>Blog Ideas</span>
				<div style={{ flex: 1 }} />
				<SiloSelector value={filterSilo} onChange={setFilterSilo} includeAll />
				<select
					value={filterStatus}
					onChange={e => setFilterStatus(e.target.value)}
					style={{
						backgroundColor: 'var(--vscode-input-background)',
						color: 'var(--vscode-input-foreground)',
						border: '1px solid var(--vscode-input-border)',
						borderRadius: '4px',
						padding: '4px 8px',
						fontSize: '12px',
					}}
				>
					<option value="all">All Status</option>
					<option value="pending">Pending</option>
					<option value="approved">Approved</option>
					<option value="rejected">Rejected</option>
					<option value="used">Used</option>
				</select>
			<div ref={generateDropdownRef} style={{ position: 'relative' }}>
				<button
					onClick={() => !generating && setShowGenerateDropdown(prev => !prev)}
					disabled={generating}
					style={{
						padding: '4px 12px',
						fontSize: '12px',
						borderRadius: '4px',
						cursor: generating ? 'default' : 'pointer',
						border: 'none',
						backgroundColor: 'var(--vscode-button-background)',
						color: 'var(--vscode-button-foreground)',
						opacity: generating ? 0.6 : 1,
						display: 'inline-flex',
						alignItems: 'center',
						gap: '4px',
					}}
				>
					{generating ? 'Generating...' : 'Generate More'}
					{!generating && <span style={{ fontSize: '10px' }}>&#9662;</span>}
				</button>
				{showGenerateDropdown && (
					<div style={{
						position: 'absolute',
						top: '100%',
						right: 0,
						marginTop: '4px',
						backgroundColor: 'var(--vscode-menu-background, var(--vscode-dropdown-background))',
						border: '1px solid var(--vscode-menu-border, var(--vscode-dropdown-border))',
						borderRadius: '4px',
						boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
						zIndex: 100,
						minWidth: '160px',
						overflow: 'hidden',
					}}>
						{Object.entries(SILO_LABELS).map(([key, label]) => (
							<button
								key={key}
								onClick={() => handleGenerate(key)}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '8px',
									width: '100%',
									padding: '8px 12px',
									fontSize: '12px',
									border: 'none',
									backgroundColor: 'transparent',
									color: 'var(--vscode-menu-foreground, var(--vscode-dropdown-foreground))',
									cursor: 'pointer',
									textAlign: 'left',
								}}
								onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)' }}
								onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
							>
								<span style={{
									width: '8px',
									height: '8px',
									borderRadius: '50%',
									backgroundColor: SILO_COLORS[key] || '#6b7280',
									flexShrink: 0,
								}} />
								{label}
							</button>
						))}
					</div>
				)}
			</div>
			</div>

			{/* Bulk Actions */}
			{selectedIds.size > 0 && (
				<div style={{
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					padding: '6px 16px',
					backgroundColor: 'var(--vscode-editor-selectionBackground)',
					fontSize: '12px',
				}}>
				<span>{selectedIds.size} selected</span>
				<button onClick={() => handleBulkAction('approved')} style={bulkBtnStyle}>Approve</button>
				<button onClick={() => handleBulkAction('rejected')} style={bulkBtnStyle}>Reject</button>
				<button onClick={handleBulkDelete} style={{ ...bulkBtnStyle, backgroundColor: '#b91c1c', color: '#ffffff', border: 'none' }}>Delete</button>
				{selectedIds.size === 1 && (
					<button onClick={() => {
						const ideaId = Array.from(selectedIds)[0]
						const idea = ideas.find(i => i.id === ideaId)
						if (idea) openView('blog-editor', { ideaId, label: idea.title })
					}} style={{ ...bulkBtnStyle, backgroundColor: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none' }}>Generate Blog</button>
				)}
				</div>
			)}

			{/* Table */}
			<div style={{ flex: 1, overflow: 'auto' }}>
				<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
					<thead>
						<tr style={{ borderBottom: '1px solid var(--vscode-panel-border)', position: 'sticky', top: 0, backgroundColor: 'var(--vscode-editor-background)' }}>
							<th style={thStyle}>
								<input type="checkbox" checked={selectedIds.size === filteredIdeas.length && filteredIdeas.length > 0} onChange={toggleSelectAll} />
							</th>
							<th style={thStyle}>Title</th>
							<th style={thStyle}>Silo</th>
							<th style={thStyle}>Angle</th>
							<th style={thStyle}>Status</th>
							<th style={thStyle}>Created</th>
						</tr>
					</thead>
					<tbody>
						{filteredIdeas.map(idea => (
							<tr
								key={idea.id}
								style={{ borderBottom: '1px solid var(--vscode-panel-border)', cursor: 'pointer' }}
								onClick={() => openView('blog-editor', { ideaId: idea.id, label: idea.title })}
							>
								<td style={tdStyle} onClick={e => { e.stopPropagation(); toggleSelect(idea.id) }}>
									<input type="checkbox" checked={selectedIds.has(idea.id)} readOnly />
								</td>
								<td style={{ ...tdStyle, fontWeight: 500, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
									{idea.title}
								</td>
								<td style={tdStyle}><SiloBadge silo={idea.silo} /></td>
								<td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--vscode-descriptionForeground)' }}>
									{idea.content_angle}
								</td>
								<td style={tdStyle}><StatusBadge status={idea.status} /></td>
								<td style={{ ...tdStyle, color: 'var(--vscode-descriptionForeground)' }}>
									{idea.created_at ? new Date(idea.created_at).toLocaleDateString() : ''}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{filteredIdeas.length === 0 && (
					<div style={{ padding: '20px', textAlign: 'center', color: 'var(--vscode-descriptionForeground)' }}>
						No ideas found. Try generating some.
					</div>
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

const bulkBtnStyle: React.CSSProperties = {
	padding: '2px 8px',
	fontSize: '11px',
	borderRadius: '3px',
	border: '1px solid var(--vscode-button-border, transparent)',
	backgroundColor: 'var(--vscode-button-secondaryBackground)',
	color: 'var(--vscode-button-secondaryForeground)',
	cursor: 'pointer',
}
