import React, { useCallback, useEffect, useState } from 'react';
import { useGrowthWriter, Campaign } from '../shared/GrowthWriterContext.js';
import { SiloBadge } from '../shared/SiloSelector.js';
import { StatusBadge } from '../shared/StatusBadge.js';

interface BlogEditorProps {
  viewData?: Record<string, string>;
}

export const BlogEditor: React.FC<BlogEditorProps> = ({ viewData }) => {
  const { channel, workspaceId } = useGrowthWriter();
  const campaignId = viewData?.campaignId;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const loadCampaign = useCallback(async () => {
    if (!campaignId) {setLoading(false);return;}
    try {
      const campaigns = await channel.call<Campaign[]>('getCampaigns', { workspaceId });
      const found = (campaigns || []).find((c: Campaign) => c.id === campaignId) || null;
      setCampaign(found);
      if (found) {
        setContent(found.blog_content || '');
        setTitle(found.title || '');
      }
    } catch (err) {
      console.error('[GrowthWriter] Failed to load campaign:', err);
    } finally {
      setLoading(false);
    }
  }, [channel, workspaceId, campaignId]);

  useEffect(() => {loadCampaign();}, [loadCampaign]);

  const handleSave = async () => {
    if (!campaignId) return;
    try {
      await channel.call('updateCampaignContent', { workspaceId, campaignId, content, title });
      await loadCampaign();
    } catch (err) {
      console.error('[GrowthWriter] Save failed:', err);
    }
  };

  const handleApprove = async () => {
    if (!campaignId) return;
    try {
      await channel.call('updateCampaignStatus', { workspaceId, campaignId, status: 'approved' });
      await loadCampaign();
    } catch (err) {
      console.error('[GrowthWriter] Approve failed:', err);
    }
  };

  const handlePublish = async () => {
    if (!campaignId) return;
    setPublishing(true);
    try {
      await channel.call('publishBlog', { workspaceId, campaignId });
      await loadCampaign();
    } catch (err) {
      console.error('[GrowthWriter] Publish failed:', err);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading campaign...</div>;
  }

  if (!campaign) {
    return <div style={{ padding: '20px' }}>Campaign not found. Select one from the sidebar.</div>;
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
        flexShrink: 0
      }}>
				<SiloBadge silo={campaign.silo} />
				<input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
            outline: 'none'
          }} />
        
				<StatusBadge status={campaign.status} size="md" />
				{campaign.blog_slug &&
        <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
						/{campaign.blog_slug}
					</span>
        }
			</div>

			{/* Action Bar */}
			<div style={{
        display: 'flex',
        gap: '8px',
        padding: '8px 16px',
        borderBottom: '1px solid var(--vscode-panel-border)',
        flexShrink: 0
      }}>
				<EditorButton label="Save" onClick={handleSave} />
				<EditorButton label="Approve" onClick={handleApprove} primary />
				<EditorButton label={publishing ? 'Publishing...' : 'Publish'} onClick={handlePublish} disabled={publishing} primary />
				<div style={{ flex: 1 }} />
				<EditorButton
          label={showPreview ? 'Hide Preview' : 'Show Preview'}
          onClick={() => setShowPreview(!showPreview)} />
        
			</div>

			{/* Content Area */}
			<div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
					<textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
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
              whiteSpace: 'pre-wrap'
            }} />
          
				</div>

				{showPreview &&
        <div style={{
          flex: 1,
          padding: '16px',
          overflow: 'auto',
          borderLeft: '1px solid var(--vscode-panel-border)',
          backgroundColor: 'var(--vscode-editor-background)'
        }}>
						<div
            style={{ fontSize: '14px', lineHeight: '1.7' }}
            dangerouslySetInnerHTML={{ __html: content }} />
          
					</div>
        }
			</div>
		</div>);

};

const EditorButton: React.FC<{label: string;onClick: () => void;primary?: boolean;disabled?: boolean;}> = ({ label, onClick, primary, disabled }) => {
  return (
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
        opacity: disabled ? 0.6 : 1
      }}>
      
			{label}
		</button>);

};