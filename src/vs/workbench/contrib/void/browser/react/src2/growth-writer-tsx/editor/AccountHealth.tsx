import React, { useCallback, useEffect, useState } from 'react';
import { useGrowthWriter } from '../shared/GrowthWriterContext.js';
import { StatusBadge } from '../shared/StatusBadge.js';

interface AccountHealthProps {
  viewData?: Record<string, string>;
}

interface RedditHealth {
  username: string;
  karma: number;
  warmup_complete: boolean;
  warmup_days: number;
  total_comments: number;
  removed_comments: number;
  removal_rate: number;
}

interface TwitterStatus {
  authenticated: boolean;
  username?: string;
  lastTweetDate?: string;
}

export const AccountHealth: React.FC<AccountHealthProps> = () => {
  const { channel, workspaceId } = useGrowthWriter();
  const [redditHealth, setRedditHealth] = useState<RedditHealth | null>(null);
  const [twitterStatus, setTwitterStatus] = useState<TwitterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      const [reddit, twitter] = await Promise.all([
      channel.call<RedditHealth | null>('getRedditHealth', { workspaceId }).catch(() => null),
      channel.call<TwitterStatus | null>('getTwitterStatus', { workspaceId }).catch(() => null)]
      );
      setRedditHealth(reddit);
      setTwitterStatus(twitter);
    } catch (err) {
      console.error('[GrowthWriter] Failed to load health:', err);
    } finally {
      setLoading(false);
    }
  }, [channel, workspaceId]);

  useEffect(() => {loadHealth();}, [loadHealth]);

  const handleRedditAuth = async () => {
    setAuthenticating('reddit');
    try {
      await channel.call('authenticateReddit', { workspaceId });
      await loadHealth();
    } catch (err) {
      console.error('[GrowthWriter] Reddit auth failed:', err);
    } finally {
      setAuthenticating(null);
    }
  };

  const handleTwitterAuth = async () => {
    setAuthenticating('twitter');
    try {
      await channel.call('startTwitterAuth', { clientId: '' });
      await loadHealth();
    } catch (err) {
      console.error('[GrowthWriter] Twitter auth failed:', err);
    } finally {
      setAuthenticating(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading account health...</div>;
  }

  return (
    <div style={{ padding: '16px', maxWidth: '800px' }}>
			<h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Account Health</h2>

			{/* Reddit Section */}
			<PlatformSection title="Reddit" icon="🔴">
				{redditHealth ?
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<StatusBadge status="approved" size="md" />
							<span style={{ fontWeight: 500 }}>u/{redditHealth.username}</span>
						</div>

						<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
							<MetricCard label="Karma" value={String(redditHealth.karma)} />
							<MetricCard label="Comments Posted" value={String(redditHealth.total_comments)} />
							<MetricCard
              label="Removal Rate"
              value={`${(redditHealth.removal_rate * 100).toFixed(1)}%`}
              warning={redditHealth.removal_rate > 0.1} />
            
							<MetricCard label="Warmup Days" value={String(redditHealth.warmup_days)} />
						</div>

						{/* Warmup Progress */}
						<div>
							<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
								<span>Warmup Progress</span>
								<span>{redditHealth.warmup_complete ? 'Complete' : 'In Progress'}</span>
							</div>
							<div style={{
              height: '8px',
              borderRadius: '4px',
              backgroundColor: 'var(--vscode-progressBar-background, #333)',
              overflow: 'hidden'
            }}>
								<div style={{
                height: '100%',
                width: redditHealth.warmup_complete ? '100%' : `${Math.min(redditHealth.warmup_days / 30 * 100, 100)}%`,
                backgroundColor: redditHealth.warmup_complete ? '#10b981' : '#3b82f6',
                borderRadius: '4px',
                transition: 'width 0.3s'
              }} />
							</div>
						</div>
					</div> :

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
						<span style={{ color: 'var(--vscode-descriptionForeground)' }}>Not connected</span>
						<AuthButton
            label={authenticating === 'reddit' ? 'Authenticating...' : 'Connect Reddit'}
            onClick={handleRedditAuth}
            disabled={authenticating === 'reddit'} />
          
					</div>
        }
			</PlatformSection>

			{/* Twitter Section */}
			<PlatformSection title="Twitter / X" icon="🐦">
				{twitterStatus?.authenticated ?
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
							<StatusBadge status="approved" size="md" />
							{twitterStatus.username && <span style={{ fontWeight: 500 }}>@{twitterStatus.username}</span>}
						</div>
						{twitterStatus.lastTweetDate &&
          <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
								Last tweet: {new Date(twitterStatus.lastTweetDate).toLocaleDateString()}
							</div>
          }
					</div> :

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
						<span style={{ color: 'var(--vscode-descriptionForeground)' }}>Not connected</span>
						<AuthButton
            label={authenticating === 'twitter' ? 'Authenticating...' : 'Connect Twitter'}
            onClick={handleTwitterAuth}
            disabled={authenticating === 'twitter'} />
          
					</div>
        }
			</PlatformSection>

			{/* LinkedIn Section */}
			<PlatformSection title="LinkedIn" icon="💼">
				<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
					<span style={{ color: 'var(--vscode-descriptionForeground)' }}>Coming soon</span>
					<AuthButton label="Connect LinkedIn" onClick={() => {}} disabled />
				</div>
			</PlatformSection>
		</div>);

};

const PlatformSection: React.FC<{title: string;icon: string;children: React.ReactNode;}> = ({ title, icon, children }) =>
<div style={{
  marginBottom: '20px',
  padding: '16px',
  borderRadius: '8px',
  border: '1px solid var(--vscode-panel-border)'
}}>
		<h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
			<span>{icon}</span> {title}
		</h3>
		{children}
	</div>;


const MetricCard: React.FC<{label: string;value: string;warning?: boolean;}> = ({ label, value, warning }) =>
<div style={{
  padding: '12px',
  borderRadius: '6px',
  backgroundColor: 'var(--vscode-textBlockQuote-background)',
  textAlign: 'center'
}}>
		<div style={{ fontSize: '20px', fontWeight: 700, color: warning ? '#ef4444' : 'var(--vscode-foreground)' }}>{value}</div>
		<div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '2px' }}>{label}</div>
	</div>;


const AuthButton: React.FC<{label: string;onClick: () => void;disabled?: boolean;}> = ({ label, onClick, disabled }) =>
<button
  onClick={onClick}
  disabled={disabled}
  style={{
    padding: '6px 16px',
    fontSize: '12px',
    borderRadius: '4px',
    cursor: disabled ? 'default' : 'pointer',
    border: 'none',
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    opacity: disabled ? 0.6 : 1
  }}>
  
		{label}
	</button>;