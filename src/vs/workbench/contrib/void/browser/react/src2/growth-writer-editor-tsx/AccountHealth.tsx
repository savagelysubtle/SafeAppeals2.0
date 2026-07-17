import React, { useCallback, useEffect, useState } from 'react';
import { useGrowthWriter } from '../growth-writer-shared/GrowthWriterContext.js';
import { useAccessor } from '../util/services.js';
import { StatusBadge } from '../growth-writer-shared/StatusBadge.js';

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

interface EnvCredentials {
  twitter: {clientId: string | null;clientSecret: string | null;bearerToken: string | null;};
  reddit: {clientId: string | null;clientSecret: string | null;username: string | null;password: string | null;};
}

export const AccountHealth: React.FC<AccountHealthProps> = () => {
  const { channel, workspaceId } = useGrowthWriter();
  const accessor = useAccessor();
  const [redditHealth, setRedditHealth] = useState<RedditHealth | null>(null);
  const [twitterStatus, setTwitterStatus] = useState<TwitterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showRedditForm, setShowRedditForm] = useState(false);
  const [redditCreds, setRedditCreds] = useState({ clientId: '', clientSecret: '', username: '', password: '' });
  const [showTwitterForm, setShowTwitterForm] = useState(false);
  const [twitterCreds, setTwitterCreds] = useState({ clientId: '', clientSecret: '' });
  const [twitterAuthPending, setTwitterAuthPending] = useState<{state: string;} | null>(null);
  const [twitterAuthCode, setTwitterAuthCode] = useState('');
  const [envLoaded, setEnvLoaded] = useState(false);

  const getEnvFilePath = useCallback((): string | null => {
    try {
      const ws = accessor.get('IWorkspaceContextService');
      const folders = ws.getWorkspace().folders;
      if (folders.length > 0) {
        const folderPath = folders[0].uri.fsPath;
        return folderPath + (folderPath.includes('\\') ? '\\.env' : '/.env');
      }
    } catch {/* noop */}
    return null;
  }, [accessor]);

  const loadEnvCredentials = useCallback(async () => {
    if (envLoaded) return;
    const envPath = getEnvFilePath();
    if (!envPath) return;
    try {
      const creds = await channel.call<EnvCredentials | null>('readEnvCredentials', { envFilePath: envPath });
      if (creds) {
        if (creds.twitter.clientId || creds.twitter.clientSecret) {
          setTwitterCreds({
            clientId: creds.twitter.clientId || '',
            clientSecret: creds.twitter.clientSecret || ''
          });
        }
        if (creds.reddit.clientId || creds.reddit.username) {
          setRedditCreds({
            clientId: creds.reddit.clientId || '',
            clientSecret: creds.reddit.clientSecret || '',
            username: creds.reddit.username || '',
            password: creds.reddit.password || ''
          });
        }
      }
    } catch {/* noop */}
    setEnvLoaded(true);
  }, [channel, getEnvFilePath, envLoaded]);

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
  useEffect(() => {loadEnvCredentials();}, [loadEnvCredentials]);

  const handleRedditAuth = async () => {
    setAuthenticating('reddit');
    setAuthError(null);
    try {
      await channel.call('authenticateReddit', { workspaceId });
      setShowRedditForm(false);
      await loadHealth();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not configured') || msg.includes('Store credentials first')) {
        setShowRedditForm(true);
      } else {
        setAuthError(msg);
      }
    } finally {
      setAuthenticating(null);
    }
  };

  const handleRedditCredsSubmit = async () => {
    if (!redditCreds.clientId || !redditCreds.clientSecret || !redditCreds.username || !redditCreds.password) {
      setAuthError('All fields are required');
      return;
    }
    setAuthenticating('reddit');
    setAuthError(null);
    try {
      await channel.call('storeRedditCredentials', redditCreds);
      await channel.call('authenticateReddit', redditCreds);
      setShowRedditForm(false);
      setRedditCreds({ clientId: '', clientSecret: '', username: '', password: '' });
      await loadHealth();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthenticating(null);
    }
  };

  const handleTwitterAuth = async () => {
    setAuthenticating('twitter');
    setAuthError(null);
    try {
      const stored = await channel.call<{clientId: string;} | null>('loadTwitterTokens');
      if (stored?.clientId) {
        await loadHealth();
        return;
      }
    } catch {/* noop */}
    setShowTwitterForm(true);
    setAuthenticating(null);
  };

  const startTwitterAuth = async () => {
    const clientId = twitterCreds.clientId.trim();
    if (!clientId) {
      setAuthError('Twitter Client ID is required');
      return;
    }
    setAuthenticating('twitter');
    setAuthError(null);
    try {
      const result = await channel.call<{authUrl: string;state: string;}>('startTwitterAuth', {
        clientId,
        clientSecret: twitterCreds.clientSecret.trim() || undefined
      });
      setTwitterAuthPending({ state: result.state });
      setShowTwitterForm(false);
      window.open(result.authUrl, '_blank');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthenticating(null);
    }
  };

  const handleTwitterCredsSubmit = async () => {
    await startTwitterAuth();
  };

  const handleTwitterCodeSubmit = async () => {
    if (!twitterAuthCode.trim() || !twitterAuthPending) {
      setAuthError('Paste the authorization code from the browser');
      return;
    }
    setAuthenticating('twitter');
    setAuthError(null);
    try {
      await channel.call('exchangeTwitterCode', {
        code: twitterAuthCode.trim(),
        state: twitterAuthPending.state
      });
      setTwitterAuthPending(null);
      setTwitterAuthCode('');
      setTwitterCreds({ clientId: '', clientSecret: '' });
      await loadHealth();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
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

			{authError &&
      <div style={{
        padding: '8px 12px',
        marginBottom: '16px',
        borderRadius: '4px',
        backgroundColor: '#ef444420',
        color: '#ef4444',
        fontSize: '12px',
        border: '1px solid #ef444440'
      }}>
					{authError}
				</div>
      }

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
        showRedditForm ?
        <RedditCredentialsForm
          creds={redditCreds}
          onChange={setRedditCreds}
          onSubmit={handleRedditCredsSubmit}
          onCancel={() => {setShowRedditForm(false);setAuthError(null);}}
          submitting={authenticating === 'reddit'} /> :


        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
						<span style={{ color: 'var(--vscode-descriptionForeground)' }}>Not connected</span>
						<AuthButton
            label={authenticating === 'reddit' ? 'Checking...' : 'Connect Reddit'}
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
        twitterAuthPending ?
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
						<div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
							Authorize the app in your browser, then copy the code from the redirect page and paste it below.
						</div>
						<div style={{ display: 'flex', gap: '8px' }}>
							<input
              type="text"
              placeholder="Paste authorization code here"
              value={twitterAuthCode}
              onChange={(e) => setTwitterAuthCode(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid var(--vscode-input-border)',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                fontFamily: 'var(--vscode-editor-font-family)'
              }} />
            
							<AuthButton
              label={authenticating === 'twitter' ? 'Connecting...' : 'Submit'}
              onClick={handleTwitterCodeSubmit}
              disabled={authenticating === 'twitter' || !twitterAuthCode.trim()} />
            
						</div>
						<button
            onClick={() => {setTwitterAuthPending(null);setTwitterAuthCode('');setAuthError(null);}}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--vscode-descriptionForeground)',
              cursor: 'pointer',
              padding: 0,
              fontSize: '11px',
              textAlign: 'left'
            }}>
            
							Cancel
						</button>
					</div> :
        showTwitterForm ?
        <TwitterCredentialsForm
          creds={twitterCreds}
          onChange={setTwitterCreds}
          onSubmit={handleTwitterCredsSubmit}
          onCancel={() => {setShowTwitterForm(false);setAuthError(null);}}
          submitting={authenticating === 'twitter'} /> :


        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
						<span style={{ color: 'var(--vscode-descriptionForeground)' }}>Not connected</span>
						<AuthButton
            label={authenticating === 'twitter' ? 'Checking...' : 'Connect Twitter'}
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


interface RedditCredentialsFormProps {
  creds: {clientId: string;clientSecret: string;username: string;password: string;};
  onChange: (creds: {clientId: string;clientSecret: string;username: string;password: string;}) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
}

const RedditCredentialsForm: React.FC<RedditCredentialsFormProps> = ({ creds, onChange, onSubmit, onCancel, submitting }) => {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    fontSize: '12px',
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '4px',
    outline: 'none'
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--vscode-descriptionForeground)',
    marginBottom: '4px',
    display: 'block'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
			<div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
				Create a Reddit &quot;script&quot; app at{' '}
				<a href="https://www.reddit.com/prefs/apps" style={{ color: 'var(--vscode-textLink-foreground)' }}>
					reddit.com/prefs/apps
				</a>
			</div>
			<div>
				<label style={labelStyle}>Client ID</label>
				<input style={inputStyle} value={creds.clientId} onChange={(e) => onChange({ ...creds, clientId: e.target.value })} placeholder="Under 'personal use script'" />
			</div>
			<div>
				<label style={labelStyle}>Client Secret</label>
				<input style={inputStyle} type="password" value={creds.clientSecret} onChange={(e) => onChange({ ...creds, clientSecret: e.target.value })} placeholder="secret" />
			</div>
			<div>
				<label style={labelStyle}>Reddit Username</label>
				<input style={inputStyle} value={creds.username} onChange={(e) => onChange({ ...creds, username: e.target.value })} placeholder="u/your_username" />
			</div>
			<div>
				<label style={labelStyle}>Reddit Password</label>
				<input style={inputStyle} type="password" value={creds.password} onChange={(e) => onChange({ ...creds, password: e.target.value })} placeholder="password" />
			</div>
			<div style={{ display: 'flex', gap: '8px' }}>
				<AuthButton label={submitting ? 'Connecting...' : 'Connect'} onClick={onSubmit} disabled={submitting} />
				<button
          onClick={onCancel}
          style={{
            padding: '6px 16px',
            fontSize: '12px',
            borderRadius: '4px',
            cursor: 'pointer',
            border: '1px solid var(--vscode-button-border, transparent)',
            backgroundColor: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)'
          }}>
          
					Cancel
				</button>
			</div>
		</div>);

};

interface TwitterCredentialsFormProps {
  creds: {clientId: string;clientSecret: string;};
  onChange: (creds: {clientId: string;clientSecret: string;}) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
}

const TwitterCredentialsForm: React.FC<TwitterCredentialsFormProps> = ({ creds, onChange, onSubmit, onCancel, submitting }) => {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    fontSize: '12px',
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '4px',
    outline: 'none'
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--vscode-descriptionForeground)',
    marginBottom: '4px',
    display: 'block'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
			<div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
				Set the callback URL to{' '}
				<code style={{ fontSize: '11px', backgroundColor: 'var(--vscode-textBlockQuote-background)', padding: '1px 4px', borderRadius: '2px' }}>
					https://safeappeals.com/auth/twitter/callback
				</code>{' '}
				in your{' '}
				<a href="https://developer.x.com/en/portal/dashboard" style={{ color: 'var(--vscode-textLink-foreground)' }}>
					Twitter/X Developer Portal
				</a>
				. Credentials are auto-loaded from your .env file.
			</div>
			<div>
				<label style={labelStyle}>Client ID</label>
				<input style={inputStyle} value={creds.clientId} onChange={(e) => onChange({ ...creds, clientId: e.target.value })} placeholder="OAuth 2.0 Client ID" />
			</div>
			<div>
				<label style={labelStyle}>Client Secret</label>
				<input style={inputStyle} type="password" value={creds.clientSecret} onChange={(e) => onChange({ ...creds, clientSecret: e.target.value })} placeholder="OAuth 2.0 Client Secret" />
			</div>
			<div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
				A browser window will open for you to authorize the app.
			</div>
			<div style={{ display: 'flex', gap: '8px' }}>
				<AuthButton label={submitting ? 'Waiting for browser...' : 'Authorize'} onClick={onSubmit} disabled={submitting} />
				<button
          onClick={onCancel}
          style={{
            padding: '6px 16px',
            fontSize: '12px',
            borderRadius: '4px',
            cursor: 'pointer',
            border: '1px solid var(--vscode-button-border, transparent)',
            backgroundColor: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)'
          }}>
          
					Cancel
				</button>
			</div>
		</div>);

};

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