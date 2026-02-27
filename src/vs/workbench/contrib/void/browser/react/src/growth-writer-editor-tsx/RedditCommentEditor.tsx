import React, { useCallback, useEffect, useState } from 'react'
import { useGrowthWriter, RedditOpportunity } from '../growth-writer-shared/GrowthWriterContext.js'
import { StatusBadge } from '../growth-writer-shared/StatusBadge.js'

interface RedditCommentEditorProps {
	viewData?: Record<string, string>
}

export const RedditCommentEditor: React.FC<RedditCommentEditorProps> = ({ viewData }) => {
	const { channel, workspaceId } = useGrowthWriter()
	const opportunityId = viewData?.opportunityId
	const [opportunity, setOpportunity] = useState<RedditOpportunity | null>(null)
	const [comment, setComment] = useState('')
	const [loading, setLoading] = useState(true)
	const [generating, setGenerating] = useState(false)
	const [postingComment, setPostingComment] = useState(false)

	const loadOpportunity = useCallback(async () => {
		if (!opportunityId) { setLoading(false); return }
		try {
			const opportunities = await channel.call<RedditOpportunity[]>('getOpportunities', { workspaceId })
			const found = (opportunities || []).find((o: RedditOpportunity) => o.id === opportunityId) || null
			setOpportunity(found)
			if (found?.generated_comment) {
				setComment(found.generated_comment)
			}
		} catch (err) {
			console.error('[GrowthWriter] Failed to load opportunity:', err)
		} finally {
			setLoading(false)
		}
	}, [channel, workspaceId, opportunityId])

	useEffect(() => { loadOpportunity() }, [loadOpportunity])

	const handleGenerate = async () => {
		if (!opportunityId) return
		setGenerating(true)
		try {
			const result = await channel.call<{ comment: string }>('generateComment', { workspaceId, opportunityId })
			if (result?.comment) {
				setComment(result.comment)
			}
			await loadOpportunity()
		} catch (err) {
			console.error('[GrowthWriter] Generate comment failed:', err)
		} finally {
			setGenerating(false)
		}
	}

	const handleApprove = async () => {
		if (!opportunityId) return
		try {
			await channel.call('approveComment', { workspaceId, opportunityId, comment })
			await loadOpportunity()
		} catch (err) {
			console.error('[GrowthWriter] Approve failed:', err)
		}
	}

	const handlePost = async () => {
		if (!opportunityId) return
		setPostingComment(true)
		try {
			await channel.call('postComment', { workspaceId, opportunityId })
			await loadOpportunity()
		} catch (err) {
			console.error('[GrowthWriter] Post comment failed:', err)
		} finally {
			setPostingComment(false)
		}
	}

	if (loading) {
		return <div style={{ padding: '20px' }}>Loading opportunity...</div>
	}

	if (!opportunity) {
		return <div style={{ padding: '20px' }}>Opportunity not found. Select one from the sidebar.</div>
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
			{/* Header */}
			<div style={{
				display: 'flex',
				alignItems: 'center',
				gap: '12px',
				padding: '12px 16px',
				borderBottom: '1px solid var(--vscode-panel-border)',
				flexShrink: 0,
			}}>
				<span style={{
					padding: '2px 8px',
					fontSize: '11px',
					borderRadius: '4px',
					backgroundColor: 'var(--vscode-badge-background)',
					color: 'var(--vscode-badge-foreground)',
				}}>
					r/{opportunity.subreddit}
				</span>
				<StatusBadge status={opportunity.status} size="md" />
				<span style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
					Score: {opportunity.relevance_score.toFixed(2)}
				</span>
			</div>

			{/* Action Bar */}
			<div style={{
				display: 'flex',
				gap: '8px',
				padding: '8px 16px',
				borderBottom: '1px solid var(--vscode-panel-border)',
				flexShrink: 0,
			}}>
				<CommentButton label={generating ? 'Generating...' : 'Regenerate'} onClick={handleGenerate} disabled={generating} />
				<CommentButton label="Approve" onClick={handleApprove} primary />
				<CommentButton label={postingComment ? 'Posting...' : 'Post Comment'} onClick={handlePost} primary disabled={postingComment || opportunity.status !== 'approved'} />
			</div>

			{/* Content */}
			<div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
				{/* Left: Thread Context */}
				<div style={{
					flex: 1,
					padding: '16px',
					overflow: 'auto',
					borderRight: '1px solid var(--vscode-panel-border)',
				}}>
					<div style={{ marginBottom: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vscode-descriptionForeground)' }}>
						Original Thread
					</div>
					<h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px 0', lineHeight: '1.4' }}>
						{opportunity.post_title}
					</h3>
					<a
						href={opportunity.post_url}
						style={{
							fontSize: '12px',
							color: 'var(--vscode-textLink-foreground)',
							wordBreak: 'break-all',
						}}
					>
						{opportunity.post_url}
					</a>
				</div>

				{/* Right: Comment Draft */}
				<div style={{
					flex: 1,
					padding: '16px',
					display: 'flex',
					flexDirection: 'column',
				}}>
					<div style={{ marginBottom: '8px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vscode-descriptionForeground)' }}>
						Comment Draft
					</div>
					<textarea
						value={comment}
						onChange={e => setComment(e.target.value)}
						placeholder="Generate or write a comment..."
						style={{
							flex: 1,
							padding: '12px',
							fontFamily: 'var(--vscode-editor-font-family)',
							fontSize: '13px',
							lineHeight: '1.6',
							backgroundColor: 'var(--vscode-input-background)',
							color: 'var(--vscode-input-foreground)',
							border: '1px solid var(--vscode-input-border)',
							borderRadius: '4px',
							outline: 'none',
							resize: 'none',
						}}
					/>
					<div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
						{comment.length} characters
					</div>
				</div>
			</div>
		</div>
	)
}

const CommentButton: React.FC<{ label: string; onClick: () => void; primary?: boolean; disabled?: boolean }> = ({ label, onClick, primary, disabled }) => (
	<button
		onClick={onClick}
		disabled={disabled}
		style={{
			padding: '4px 12px',
			fontSize: '12px',
			borderRadius: '4px',
			cursor: disabled ? 'default' : 'pointer',
			border: primary ? 'none' : '1px solid var(--vscode-button-border, transparent)',
			backgroundColor: primary ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
			color: primary ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
			opacity: disabled ? 0.6 : 1,
		}}
	>
		{label}
	</button>
)
