import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Account, Draft, FullMessage, Stats, SyncStatus, Thread } from './types';

const vscode = acquireVsCodeApi();

type Pane = 'read' | 'compose' | 'drafts';

export const App: React.FC = () => {
	const [accountId, setAccountId] = useState<string>('');
	const [threads, setThreads] = useState<Thread[]>([]);
	const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
	const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
	const [message, setMessage] = useState<FullMessage | null>(null);
	const [stats, setStats] = useState<Stats | null>(null);
	const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
	const [drafts, setDrafts] = useState<Draft[]>([]);
	const [pane, setPane] = useState<Pane>('read');
	const [error, setError] = useState<string | null>(null);
	const [loadingBody, setLoadingBody] = useState(false);
	const [compose, setCompose] = useState({ to: '', subject: '', content: '' });

	const pendingSelectRef = useRef<string | null>(null);

	const selectMessage = useCallback((messageId: string) => {
		setSelectedMessageId(messageId);
		setLoadingBody(true);
		setMessage(null);
		vscode.postMessage({ type: 'getMessage', messageId });
	}, []);

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const msg = event.data;
			if (!msg || typeof msg !== 'object') {
				return;
			}
			switch (msg.type) {
				case 'bootstrap':
					setAccountId((prev) => {
						const list: Account[] = msg.accounts || [];
						if (prev && list.some((a) => a.id === prev)) {
							return prev;
						}
						return list[0]?.id || '';
					});
					setThreads(msg.threads || []);
					setStats(msg.stats || null);
					setSyncStatus(msg.status || null);
					setDrafts(msg.drafts || []);
					setError(null);
					break;
				case 'syncStatus':
					setSyncStatus(msg.status || null);
					break;
				case 'threads':
					setThreads(msg.threads || []);
					break;
				case 'thread':
					if (msg.thread) {
						setThreads((prev) => {
							const others = prev.filter((t) => t.threadId !== msg.thread.threadId);
							return [msg.thread, ...others];
						});
						if (pendingSelectRef.current === msg.thread.threadId) {
							pendingSelectRef.current = null;
							const latest = msg.thread.messages[msg.thread.messages.length - 1];
							if (latest) {
								setSelectedMessageId(latest.id);
								setLoadingBody(true);
								setMessage(null);
								vscode.postMessage({ type: 'getMessage', messageId: latest.id });
							}
						}
					}
					break;
				case 'selectThread':
					if (typeof msg.threadId === 'string' && msg.threadId) {
						setSelectedThreadId(msg.threadId);
						setPane('read');
						pendingSelectRef.current = msg.threadId;
						vscode.postMessage({ type: 'getThread', threadId: msg.threadId });
					}
					break;
				case 'openCompose':
					setPane('compose');
					break;
				case 'openDrafts':
					setPane('drafts');
					break;
				case 'message':
					setMessage(msg.message);
					setLoadingBody(false);
					break;
				case 'draftSaved':
				case 'drafts':
					setDrafts(msg.drafts || (msg.draft ? [msg.draft] : []));
					break;
				case 'error':
					setError(msg.message || 'Unknown error');
					setLoadingBody(false);
					break;
				default:
					break;
			}
		};
		window.addEventListener('message', handler);
		vscode.postMessage({ type: 'ready' });
		return () => window.removeEventListener('message', handler);
	}, []);

	const selectedAccountStatus = useMemo(() => {
		if (!syncStatus) {
			return null;
		}
		if (accountId) {
			return syncStatus.accounts.find((a) => a.accountId === accountId) || null;
		}
		return syncStatus.accounts.find((a) => a.error) || syncStatus.accounts[0] || null;
	}, [syncStatus, accountId]);

	const syncErrorBanner = useMemo(() => {
		if (!syncStatus) {
			return null;
		}
		const withError = accountId
			? syncStatus.accounts.filter((a) => a.accountId === accountId && a.error)
			: syncStatus.accounts.filter((a) => a.error);
		if (withError.length === 0) {
			return null;
		}
		return withError.map((a) => `Sync failed: ${a.error}`).join(' · ');
	}, [syncStatus, accountId]);

	const selectedThread = useMemo(
		() => threads.find((t) => t.threadId === selectedThreadId) || null,
		[threads, selectedThreadId],
	);

	const onSend = () => {
		if (!accountId) {
			setError('Add an account first');
			return;
		}
		vscode.postMessage({
			type: 'send',
			request: {
				accountId,
				to: compose.to,
				subject: compose.subject,
				text: compose.content,
				html: `<pre>${escapeHtml(compose.content)}</pre>`,
			},
		});
		setCompose({ to: '', subject: '', content: '' });
		setPane('read');
	};

	const onSaveDraft = () => {
		if (!accountId) {
			setError('Add an account first');
			return;
		}
		vscode.postMessage({
			type: 'saveDraft',
			draft: {
				accountId,
				emailId: selectedMessageId || '',
				to: compose.to,
				subject: compose.subject,
				content: compose.content,
			},
		});
	};

	const onReply = () => {
		if (!message) {
			return;
		}
		setCompose({
			to: message.from,
			subject: message.subject.startsWith('Re:')
				? message.subject
				: `Re: ${message.subject}`,
			content: '',
		});
		setPane('compose');
	};

	const onForward = () => {
		if (!message) {
			return;
		}
		const subject = message.subject.startsWith('Fwd:')
			? message.subject
			: `Fwd: ${message.subject}`;
		const body =
			message.bodyText ||
			message.snippet ||
			'';
		const content =
			`\n\n---------- Forwarded message ----------\n` +
			`From: ${message.from}\n` +
			`Date: ${formatDate(message.date)}\n` +
			`Subject: ${message.subject}\n` +
			`To: ${message.to}\n` +
			`\n${body}`;
		setCompose({ to: '', subject, content });
		setPane('compose');
	};

	return (
		<div className="app">
			<header className="toolbar">
				<div className="toolbar-left">
					<strong>Email</strong>
					{stats && (
						<span className="muted">
							{stats.totalEmails} msgs · {stats.threadCount} threads · {stats.draftCount} drafts
						</span>
					)}
					{selectedAccountStatus && (
						<span className="muted sync-meta">
							Last synced:{' '}
							{selectedAccountStatus.lastSync
								? formatDate(selectedAccountStatus.lastSync)
								: 'never'}{' '}
							· {selectedAccountStatus.messageCount} messages
							{syncStatus?.syncing ? ' · syncing…' : ''}
						</span>
					)}
				</div>
			</header>

			{syncErrorBanner && <div className="error sync-error">{syncErrorBanner}</div>}
			{error && <div className="error">{error}</div>}

			{pane === 'compose' && (
				<section className="compose">
					<h2>Compose</h2>
					<input
						placeholder="To"
						value={compose.to}
						onChange={(e) => setCompose({ ...compose, to: e.target.value })}
					/>
					<input
						placeholder="Subject"
						value={compose.subject}
						onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
					/>
					<textarea
						placeholder="Message"
						rows={12}
						value={compose.content}
						onChange={(e) => setCompose({ ...compose, content: e.target.value })}
					/>
					<div className="compose-actions">
						<button type="button" onClick={onSend}>
							Send
						</button>
						<button type="button" onClick={onSaveDraft}>
							Save draft
						</button>
						<button type="button" className="secondary" onClick={() => setPane('read')}>
							Cancel
						</button>
					</div>
				</section>
			)}

			{pane === 'drafts' && (
				<section className="drafts">
					<h2>Drafts</h2>
					{drafts.length === 0 && <p className="muted">No drafts</p>}
					<ul>
						{drafts.map((d) => (
							<li key={d.id}>
								<button
									type="button"
									className="linkish"
									onClick={() => {
										setCompose({ to: d.to, subject: d.subject, content: d.content });
										setPane('compose');
									}}
								>
									{d.subject || '(no subject)'} → {d.to} · {d.status}
								</button>
							</li>
						))}
					</ul>
					<button type="button" className="secondary" onClick={() => setPane('read')}>
						Back
					</button>
				</section>
			)}

			{pane === 'read' && (
				<main className="reader">
					{!selectedThread && (
						<div className="empty-state">
							<div className="empty-icon" aria-hidden="true">
								✉
							</div>
							<p className="empty-title">Select an email from the Email sidebar to read it here.</p>
							<div className="empty-actions">
								<button
									type="button"
									onClick={() => vscode.postMessage({ type: 'focusSidebar' })}
								>
									Open Email sidebar
								</button>
								<button type="button" onClick={() => setPane('compose')}>
									Compose
								</button>
							</div>
						</div>
					)}
					{selectedThread && (
						<>
							<div className="thread-messages">
								{selectedThread.messages.map((m) => (
									<button
										key={m.id}
										type="button"
										className={`msg-chip ${m.id === selectedMessageId ? 'active' : ''}`}
										onClick={() => selectMessage(m.id)}
									>
										{m.from || '(unknown)'} · {formatDate(m.date)}
									</button>
								))}
							</div>
							{loadingBody && <p className="muted">Loading body…</p>}
							{message && !loadingBody && (
								<article className="message">
									<div className="msg-title-row">
										<h2>{message.subject}</h2>
										<div className="msg-actions">
											<button type="button" onClick={onReply}>
												Reply
											</button>
											<button type="button" onClick={onForward}>
												Forward
											</button>
										</div>
									</div>
									<div className="msg-headers muted">
										<div>From: {message.from}</div>
										<div>To: {message.to}</div>
										<div>{formatDate(message.date)}</div>
									</div>
									{message.bodyHtml ? (
										<iframe
											className="body-html"
											sandbox=""
											title="email-body"
											srcDoc={message.bodyHtml}
										/>
									) : (
										<pre className="body-text">{message.bodyText || '(empty)'}</pre>
									)}
								</article>
							)}
						</>
					)}
				</main>
			)}
		</div>
	);
};

function formatDate(iso: string): string {
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
