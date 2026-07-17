import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Account, Draft, FullMessage, Stats, Thread } from './types';
import { VirtualList } from './VirtualList';

const vscode = acquireVsCodeApi();

type Pane = 'list' | 'compose' | 'drafts';

export const App: React.FC = () => {
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [accountId, setAccountId] = useState<string>('');
	const [folder, setFolder] = useState('INBOX');
	const [threads, setThreads] = useState<Thread[]>([]);
	const [total, setTotal] = useState(0);
	const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
	const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
	const [message, setMessage] = useState<FullMessage | null>(null);
	const [stats, setStats] = useState<Stats | null>(null);
	const [drafts, setDrafts] = useState<Draft[]>([]);
	const [pane, setPane] = useState<Pane>('list');
	const [error, setError] = useState<string | null>(null);
	const [loadingBody, setLoadingBody] = useState(false);
	const [compose, setCompose] = useState({ to: '', subject: '', content: '' });

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const msg = event.data;
			if (!msg || typeof msg !== 'object') {
				return;
			}
			switch (msg.type) {
				case 'bootstrap':
					setAccounts(msg.accounts || []);
					setAccountId((prev) => prev || msg.accounts?.[0]?.id || '');
					setFolder(msg.folder || 'INBOX');
					setThreads(msg.threads || []);
					setTotal(msg.total || 0);
					setStats(msg.stats || null);
					setDrafts(msg.drafts || []);
					setError(null);
					break;
				case 'threads':
					setThreads(msg.threads || []);
					setTotal(msg.total || 0);
					break;
				case 'thread':
					if (msg.thread) {
						setThreads((prev) => {
							const others = prev.filter((t) => t.threadId !== msg.thread.threadId);
							return [msg.thread, ...others];
						});
					}
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

	const selectedThread = useMemo(
		() => threads.find((t) => t.threadId === selectedThreadId) || null,
		[threads, selectedThreadId],
	);

	const loadMore = useCallback(
		(offset: number) => {
			vscode.postMessage({
				type: 'listThreads',
				accountId: accountId || undefined,
				folder,
				offset,
				limit: 50,
			});
		},
		[accountId, folder],
	);

	const selectThread = (thread: Thread) => {
		setSelectedThreadId(thread.threadId);
		setPane('list');
		vscode.postMessage({ type: 'getThread', threadId: thread.threadId });
		const latest = thread.messages[thread.messages.length - 1];
		if (latest) {
			selectMessage(latest.id);
		}
	};

	const selectMessage = (messageId: string) => {
		setSelectedMessageId(messageId);
		setLoadingBody(true);
		setMessage(null);
		vscode.postMessage({ type: 'getMessage', messageId });
	};

	const onSync = () => {
		vscode.postMessage({ type: 'syncNow', accountId: accountId || undefined });
	};

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
		setPane('list');
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
				</div>
				<div className="toolbar-right">
					<select
						value={accountId}
						onChange={(e) => {
							setAccountId(e.target.value);
							vscode.postMessage({
								type: 'listThreads',
								accountId: e.target.value || undefined,
								folder,
								offset: 0,
								limit: 50,
							});
						}}
					>
						{accounts.length === 0 && <option value="">No accounts</option>}
						{accounts.map((a) => (
							<option key={a.id} value={a.id}>
								{a.label}
							</option>
						))}
					</select>
					<input
						className="folder-input"
						value={folder}
						onChange={(e) => setFolder(e.target.value)}
						onBlur={() => loadMore(0)}
						title="IMAP folder"
					/>
					<button type="button" onClick={onSync}>
						Sync
					</button>
					<button type="button" onClick={() => vscode.postMessage({ type: 'addAccount' })}>
						Add account
					</button>
					<button type="button" onClick={() => setPane('compose')}>
						Compose
					</button>
					<button type="button" onClick={() => { setPane('drafts'); vscode.postMessage({ type: 'listDrafts', accountId }); }}>
						Drafts
					</button>
				</div>
			</header>

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
						<button type="button" className="secondary" onClick={() => setPane('list')}>
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
					<button type="button" className="secondary" onClick={() => setPane('list')}>
						Back
					</button>
				</section>
			)}

			{pane === 'list' && (
				<div className="layout">
					<aside className="thread-list">
						<div className="list-meta muted">
							{total} threads (showing {threads.length})
						</div>
						<VirtualList
							items={threads}
							itemHeight={64}
							height={Math.max(240, window.innerHeight - 120)}
							renderItem={(thread) => (
								<button
									type="button"
									className={`thread-row ${thread.threadId === selectedThreadId ? 'active' : ''}`}
									onClick={() => selectThread(thread)}
								>
									<div className="thread-subject">{thread.subject}</div>
									<div className="thread-meta muted">
										{thread.emailCount} · {formatDate(thread.latestDate)} · {thread.status}
									</div>
								</button>
							)}
						/>
						{threads.length < total && (
							<button type="button" className="secondary" onClick={() => loadMore(threads.length)}>
								Load more
							</button>
						)}
					</aside>

					<main className="reader">
						{!selectedThread && <p className="muted">Select a thread</p>}
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
										<h2>{message.subject}</h2>
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
										<button
											type="button"
											onClick={() => {
												setCompose({
													to: message.from,
													subject: message.subject.startsWith('Re:')
														? message.subject
														: `Re: ${message.subject}`,
													content: '',
												});
												setPane('compose');
											}}
										>
											Reply
										</button>
									</article>
								)}
							</>
						)}
					</main>
				</div>
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
