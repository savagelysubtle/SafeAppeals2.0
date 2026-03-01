import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useGrowthWriter, Campaign, BlogIdea } from '../growth-writer-shared/GrowthWriterContext.js'
import { SiloBadge } from '../growth-writer-shared/SiloSelector.js'
import { StatusBadge } from '../growth-writer-shared/StatusBadge.js'

interface BlogEditorProps {
	viewData?: Record<string, string>
}

export const BlogEditor: React.FC<BlogEditorProps> = ({ viewData }) => {
	const { channel, workspaceId, openView, generateBlogForIdea } = useGrowthWriter()
	const campaignId = viewData?.campaignId
	const ideaId = viewData?.ideaId
	const [campaign, setCampaign] = useState<Campaign | null>(null)
	const [idea, setIdea] = useState<BlogIdea | null>(null)
	const [content, setContent] = useState('')
	const [title, setTitle] = useState('')
	const [loading, setLoading] = useState(true)
	const [generating, setGenerating] = useState(false)
	const [publishing, setPublishing] = useState(false)
	const [showPreview, setShowPreview] = useState(true)

	const applyCampaign = (c: Campaign) => {
		setCampaign(c)
		setContent(c.blog_content || '')
		setTitle(c.blog_title || '')
	}

	const loadCampaign = useCallback(async (cId?: string) => {
		const targetId = cId || campaignId
		if (!targetId) { setLoading(false); return }
		try {
			const found = await channel.call<Campaign | null>('getCampaignById', { workspaceId, campaignId: targetId })
			if (found) {
				applyCampaign(found)
			} else {
				setCampaign(null)
			}
		} catch (err) {
			console.error('[GrowthWriter] Failed to load campaign:', err)
		} finally {
			setLoading(false)
		}
	}, [channel, workspaceId, campaignId])

	const loadIdea = useCallback(async () => {
		if (!ideaId) return
		try {
			const ideas = await channel.call<BlogIdea[]>('getIdeas', { workspaceId })
			const found = (ideas || []).find((i: BlogIdea) => i.id === ideaId) || null
			setIdea(found)

			if (found) {
				const existingCampaign = await channel.call<Campaign | null>('getCampaignByIdeaId', { workspaceId, ideaId })
				if (existingCampaign) {
					applyCampaign(existingCampaign)
				}
			}
		} catch (err) {
			console.error('[GrowthWriter] Failed to load idea:', err)
		} finally {
			setLoading(false)
		}
	}, [channel, workspaceId, ideaId])

	useEffect(() => {
		if (campaignId) {
			loadCampaign()
		} else if (ideaId) {
			loadIdea()
		} else {
			setLoading(false)
		}
	}, [campaignId, ideaId, loadCampaign, loadIdea])

	const handleGenerateBlog = async () => {
		if (!ideaId || !generateBlogForIdea) return
		setGenerating(true)
		try {
			const newCampaign = await generateBlogForIdea(ideaId)
			applyCampaign(newCampaign)
		} catch (err) {
			console.error('[GrowthWriter] Generate blog failed:', err)
		} finally {
			setGenerating(false)
		}
	}

	const handleSave = async () => {
		const cId = campaign?.id || campaignId
		if (!cId) return
		try {
			await channel.call('updateCampaignContent', { workspaceId, campaignId: cId, content, title })
			await loadCampaign(cId)
		} catch (err) {
			console.error('[GrowthWriter] Save failed:', err)
		}
	}

	const handleApprove = async () => {
		const cId = campaign?.id || campaignId
		if (!cId) return
		try {
			await channel.call('updateCampaignStatus', { workspaceId, campaignId: cId, status: 'approved' })
			await loadCampaign(cId)
		} catch (err) {
			console.error('[GrowthWriter] Approve failed:', err)
		}
	}

	const handlePublish = async () => {
		const cId = campaign?.id || campaignId
		if (!cId) return
		setPublishing(true)
		try {
			await channel.call('publishBlog', { workspaceId, campaignId: cId })
			await loadCampaign(cId)
		} catch (err) {
			console.error('[GrowthWriter] Publish failed:', err)
		} finally {
			setPublishing(false)
		}
	}

	const handleMarkPublished = async () => {
		const cId = campaign?.id || campaignId
		if (!cId) return
		try {
			await channel.call('updateCampaignStatus', { workspaceId, campaignId: cId, status: 'published' })
			await loadCampaign(cId)
		} catch (err) {
			console.error('[GrowthWriter] Mark published failed:', err)
		}
	}

	const handleDelete = async () => {
		const cId = campaign?.id || campaignId
		if (!cId) return
		try {
			await channel.call('deleteCampaign', { workspaceId, campaignId: cId })
			if (idea) {
				await channel.call('updateIdeaStatus', { workspaceId, ideaId: idea.id, status: 'pending' })
			}
			openView('blog-ideas')
		} catch (err) {
			console.error('[GrowthWriter] Delete failed:', err)
		}
	}

	if (loading) {
		return <div style={{ padding: '20px' }}>Loading...</div>
	}

	if (!campaign && idea) {
		return (
			<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
				<div style={{
					display: 'flex',
					alignItems: 'center',
					gap: '12px',
					padding: '12px 16px',
					borderBottom: '1px solid var(--vscode-panel-border)',
					flexShrink: 0,
				}}>
					<SiloBadge silo={idea.silo} />
					<span style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>{idea.title}</span>
					<StatusBadge status={idea.status} size="md" />
				</div>

				<div style={{ padding: '24px', flex: 1 }}>
					<div style={{ maxWidth: '600px' }}>
						<div style={{ marginBottom: '16px' }}>
							<span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vscode-descriptionForeground)' }}>Content Angle</span>
							<p style={{ margin: '4px 0', fontSize: '13px' }}>{idea.content_angle}</p>
						</div>
						<div style={{ marginBottom: '16px' }}>
							<span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vscode-descriptionForeground)' }}>Created</span>
							<p style={{ margin: '4px 0', fontSize: '13px' }}>{idea.created_at ? new Date(idea.created_at).toLocaleString() : 'Unknown'}</p>
						</div>

						<div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
							<button
								onClick={handleGenerateBlog}
								disabled={generating}
								style={{
									padding: '8px 20px',
									fontSize: '13px',
									fontWeight: 600,
									borderRadius: '4px',
									cursor: generating ? 'default' : 'pointer',
									border: 'none',
									backgroundColor: 'var(--vscode-button-background)',
									color: 'var(--vscode-button-foreground)',
									opacity: generating ? 0.6 : 1,
								}}
							>
								{generating ? 'Generating Blog Post...' : 'Generate Blog Post'}
							</button>
							<button
								onClick={() => openView('blog-ideas')}
								style={{
									padding: '8px 16px',
									fontSize: '13px',
									borderRadius: '4px',
									cursor: 'pointer',
									border: '1px solid var(--vscode-button-border, transparent)',
									backgroundColor: 'var(--vscode-button-secondaryBackground)',
									color: 'var(--vscode-button-secondaryForeground)',
								}}
							>
								Back to Ideas
							</button>
						</div>

						{generating && (
							<p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
								The AI is writing a full blog post from this idea using RAG context. This may take a minute...
							</p>
						)}
					</div>
				</div>
			</div>
		)
	}

	if (!campaign) {
		return <div style={{ padding: '20px' }}>No idea or campaign selected. Go to <a href="#" onClick={e => { e.preventDefault(); openView('blog-ideas') }} style={{ color: 'var(--vscode-textLink-foreground)' }}>Blog Ideas</a> to get started.</div>
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
			{/* Top Bar */}
			<div style={{
				display: 'flex',
				alignItems: 'center',
				gap: '12px',
				padding: '12px 16px',
				borderBottom: '1px solid var(--vscode-panel-border)',
				flexShrink: 0,
			}}>
				<SiloBadge silo={campaign.silo} />
				<input
					value={title}
					onChange={e => setTitle(e.target.value)}
					placeholder="Blog title..."
					style={{
						flex: 1,
						fontSize: '14px',
						fontWeight: 600,
						padding: '4px 8px',
						backgroundColor: 'var(--vscode-input-background)',
						color: 'var(--vscode-input-foreground)',
						border: '1px solid var(--vscode-input-border)',
						borderRadius: '4px',
						outline: 'none',
					}}
				/>
				<StatusBadge status={campaign.status} size="md" />
				{campaign.blog_slug && (
					<span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
						/{campaign.blog_slug}
					</span>
				)}
			</div>

			{/* Action Bar */}
			<div style={{
				display: 'flex',
				gap: '8px',
				padding: '8px 16px',
				borderBottom: '1px solid var(--vscode-panel-border)',
				flexShrink: 0,
			}}>
				<EditorButton label="Save" onClick={handleSave} />
				{campaign.status === 'failed' ? (
					<>
						<EditorButton label="Re-approve" onClick={handleApprove} primary />
						<EditorButton label="Mark as Published" onClick={handleMarkPublished} />
					</>
				) : campaign.status === 'published' ? null : (
					<>
						<EditorButton label="Approve" onClick={handleApprove} primary />
						<EditorButton label={publishing ? 'Publishing...' : 'Publish'} onClick={handlePublish} disabled={publishing} primary />
					</>
				)}
				<div style={{ flex: 1 }} />
				<EditorButton label="Delete" onClick={handleDelete} danger />
				<EditorButton
					label={showPreview ? 'Hide Preview' : 'Show Preview'}
					onClick={() => setShowPreview(!showPreview)}
				/>
			</div>

			{/* Content Area */}
			<div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
					<textarea
						value={content}
						onChange={e => setContent(e.target.value)}
						placeholder="Blog content (HTML)..."
						spellCheck={false}
						style={{
							flex: 1,
							padding: '16px',
							fontFamily: 'var(--vscode-editor-font-family)',
							fontSize: 'var(--vscode-editor-font-size, 13px)',
							lineHeight: '1.6',
							backgroundColor: 'var(--vscode-editor-background)',
							color: 'var(--vscode-editor-foreground)',
							border: 'none',
							outline: 'none',
							resize: 'none',
							whiteSpace: 'pre-wrap',
						}}
					/>
				</div>

			{showPreview && (
				<div style={{
					flex: 1,
					padding: '16px',
					overflow: 'auto',
					borderLeft: '1px solid var(--vscode-panel-border)',
					backgroundColor: 'var(--vscode-editor-background)',
				}}>
					<HtmlPreview content={content} />
				</div>
			)}
			</div>
		</div>
	)
}

const HtmlPreview: React.FC<{ content: string }> = ({ content }) => {
	const previewRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!previewRef.current) return
		const el = previewRef.current
		while (el.firstChild) el.removeChild(el.firstChild)
		if (!content) return
		try {
			const parser = new DOMParser()
			const doc = parser.parseFromString(content, 'text/html')
			Array.from(doc.body.childNodes).forEach(node => {
				el.appendChild(document.importNode(node, true))
			})
		} catch {
			el.textContent = content
		}
	}, [content])
	return <div ref={previewRef} style={{ fontSize: '14px', lineHeight: '1.7' }} />
}

const EditorButton: React.FC<{ label: string; onClick: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }> = ({ label, onClick, primary, danger, disabled }) => {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			style={{
				padding: '4px 12px',
				fontSize: '12px',
				borderRadius: '4px',
				cursor: disabled ? 'default' : 'pointer',
				border: primary || danger ? 'none' : '1px solid var(--vscode-button-border, transparent)',
				backgroundColor: danger ? '#b91c1c' : primary ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
				color: danger ? '#ffffff' : primary ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
				opacity: disabled ? 0.6 : 1,
			}}
		>
			{label}
		</button>
	)
}
