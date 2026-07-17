import React, { useCallback, useEffect, useState } from 'react';
import { useGrowthWriter, SocialPost } from '../shared/GrowthWriterContext.js';
import { StatusBadge } from '../shared/StatusBadge.js';

type Platform = 'twitter' | 'reddit' | 'linkedin';

interface SocialPostsEditorProps {
  viewData?: Record<string, string>;
}

export const SocialPostsEditor: React.FC<SocialPostsEditorProps> = ({ viewData }) => {
  const { channel, workspaceId } = useGrowthWriter();
  const campaignId = viewData?.campaignId;
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState<Platform>('twitter');

  const loadPosts = useCallback(async () => {
    try {
      const result = await channel.call<SocialPost[]>('getSocialPosts', {
        workspaceId,
        ...(campaignId ? { campaign_id: campaignId } : {})
      });
      setPosts(result || []);
    } catch (err) {
      console.error('[GrowthWriter] Failed to load social posts:', err);
    } finally {
      setLoading(false);
    }
  }, [channel, workspaceId, campaignId]);

  useEffect(() => {loadPosts();}, [loadPosts]);

  const filteredPosts = posts.filter((p) => p.platform === activePlatform);
  const platforms: Platform[] = ['twitter', 'reddit', 'linkedin'];

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading social posts...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
			{/* Tab Bar */}
			<div style={{
        display: 'flex',
        borderBottom: '1px solid var(--vscode-panel-border)',
        flexShrink: 0
      }}>
				{platforms.map((platform) => {
          const count = posts.filter((p) => p.platform === platform).length;
          const active = activePlatform === platform;
          return (
            <button
              key={platform}
              onClick={() => setActivePlatform(platform)}
              style={{
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: active ? 600 : 400,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                color: active ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
                borderBottom: active ? '2px solid var(--vscode-focusBorder)' : '2px solid transparent',
                textTransform: 'capitalize'
              }}>
              
							{platform} ({count})
						</button>);

        })}
			</div>

			{/* Posts List */}
			<div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
				{filteredPosts.length === 0 ?
        <div style={{ color: 'var(--vscode-descriptionForeground)', textAlign: 'center', padding: '40px' }}>
						No {activePlatform} posts yet.
					</div> :

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
						{filteredPosts.map((post) =>
          <SocialPostCard key={post.id} post={post} channel={channel} workspaceId={workspaceId} onRefresh={loadPosts} />
          )}
					</div>
        }
			</div>
		</div>);

};

interface SocialPostCardProps {
  post: SocialPost;
  channel: {call<T = unknown>(command: string, arg?: unknown): Promise<T>;};
  workspaceId: string;
  onRefresh: () => void;
}

const SocialPostCard: React.FC<SocialPostCardProps> = ({ post, channel, workspaceId, onRefresh }) => {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [posting, setPosting] = useState(false);

  const charLimit = post.platform === 'twitter' ? 280 : undefined;
  const effectiveLength = post.platform === 'twitter' ? calculateTweetLength(post.content) : post.content.length;

  const handleApprove = async () => {
    try {
      await channel.call('updateSocialPostStatus', { workspaceId, socialPostId: post.id, status: 'approved' });
      onRefresh();
    } catch (err) {
      console.error('[GrowthWriter] Approve failed:', err);
    }
  };

  const handlePost = async () => {
    setPosting(true);
    try {
      const command = post.platform === 'twitter' ? 'postTweet' : 'postSocialPost';
      await channel.call(command, { workspaceId, socialPostId: post.id, text: post.content });
      onRefresh();
    } catch (err) {
      console.error('[GrowthWriter] Post failed:', err);
    } finally {
      setPosting(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await channel.call('updateSocialPostContent', { workspaceId, socialPostId: post.id, content: editContent });
      setEditing(false);
      onRefresh();
    } catch (err) {
      console.error('[GrowthWriter] Save failed:', err);
    }
  };

  return (
    <div style={{
      border: '1px solid var(--vscode-panel-border)',
      borderRadius: '6px',
      padding: '12px'
    }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
				<StatusBadge status={post.status} size="md" />
				{charLimit &&
        <span style={{
          fontSize: '11px',
          color: effectiveLength > charLimit ? '#ef4444' : 'var(--vscode-descriptionForeground)'
        }}>
						{effectiveLength}/{charLimit}
					</span>
        }
				{post.posted_at &&
        <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
						Posted: {new Date(post.posted_at).toLocaleString()}
					</span>
        }
				<div style={{ flex: 1 }} />
				{post.status === 'draft' &&
        <>
						<PostButton label="Edit" onClick={() => setEditing(!editing)} />
						<PostButton label="Approve" onClick={handleApprove} primary />
					</>
        }
				{post.status === 'approved' &&
        <PostButton label={posting ? 'Posting...' : 'Post'} onClick={handlePost} primary disabled={posting} />
        }
			</div>

			{editing ?
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
					<textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          style={{
            padding: '8px',
            fontFamily: 'var(--vscode-editor-font-family)',
            fontSize: '13px',
            lineHeight: '1.5',
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border)',
            borderRadius: '4px',
            outline: 'none',
            resize: 'vertical',
            minHeight: '80px'
          }} />
        
					<div style={{ display: 'flex', gap: '8px' }}>
						<PostButton label="Save" onClick={handleSaveEdit} primary />
						<PostButton label="Cancel" onClick={() => {setEditing(false);setEditContent(post.content);}} />
					</div>
				</div> :

      <div style={{
        fontSize: '13px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        padding: '8px',
        borderRadius: '4px',
        backgroundColor: 'var(--vscode-textBlockQuote-background)'
      }}>
					{post.content}
				</div>
      }

			{post.engagement_metrics &&
      <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
					{formatMetrics(post.engagement_metrics)}
				</div>
      }
		</div>);

};

function calculateTweetLength(text: string): number {
  return text.replace(/https?:\/\/\S+/g, '                       ').length;
}

function formatMetrics(metricsJson: string): string {
  try {
    const m = JSON.parse(metricsJson);
    const parts: string[] = [];
    if (m.like_count) parts.push(`${m.like_count} likes`);
    if (m.retweet_count) parts.push(`${m.retweet_count} RTs`);
    if (m.reply_count) parts.push(`${m.reply_count} replies`);
    if (m.impression_count) parts.push(`${m.impression_count} views`);
    return parts.join(' · ') || 'No metrics yet';
  } catch {
    return '';
  }
}

const PostButton: React.FC<{label: string;onClick: () => void;primary?: boolean;disabled?: boolean;}> = ({ label, onClick, primary, disabled }) =>
<button
  onClick={onClick}
  disabled={disabled}
  style={{
    padding: '3px 10px',
    fontSize: '11px',
    borderRadius: '3px',
    cursor: disabled ? 'default' : 'pointer',
    border: primary ? 'none' : '1px solid var(--vscode-button-border, transparent)',
    backgroundColor: primary ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
    color: primary ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
    opacity: disabled ? 0.6 : 1
  }}>
  
		{label}
	</button>;