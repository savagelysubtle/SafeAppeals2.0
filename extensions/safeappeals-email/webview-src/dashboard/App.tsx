import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Account, Draft, FullMessage, Stats, SyncStatus, Thread } from './types';
import { VirtualList } from './VirtualList';

const vscode = acquireVsCodeApi();

type Pane = 'list' | 'compose' | 'drafts';

const DEFAULT_LIST_WIDTH = 340;
const MIN_LIST_WIDTH = 220;
const MIN_READER_WIDTH = 320;
const SASH_WIDTH = 5;

interface PersistedState {
	listWidth?: number;
}

function readPersistedListWidth(): number {
	const state = vscode.getState() as PersistedState | undefined;
	const w = state?.listWidth;
	if (typeof w === 'number' && Number.isFinite(w) && w >= MIN_LIST_WIDTH) {
		return w;
	}
	return DEFAULT_LIST_WIDTH;
}

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
	const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
	const [drafts, setDrafts] = useState<Draft[]>([]);
	const [pane, setPane] = useState<Pane>('list');
	const [error, setError] = useState<string | null>(null);
	const [loadingBody, setLoadingBody] = useState(false);
	const [compose, setCompose] = useState({ to: '', subject: '', content: '' });
	const [listWidth, setListWidth] = useState(readPersistedListWidth);
	const [sashActive, setSashActive] = useState(false);
	const [listRemeasureKey, setListRemeasureKey] = useState(0);

	const layoutRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
	const pendingSelectRef = useRef<string | null>(null);

	const selectMessage = useCallback((messageId: string) => {
		setSelectedMessageId(messageId);
		setLoadingBody(true);
		setMessage(null);
		vscode.postMessage({ type: 'getMessage', messageId });
	}, []);

	const focusThread = useCallback(
		(threadId: string, thread?: Thread) => {
			setSelectedThreadId(threadId);
			setPane('list');
			pendingSelectRef.current = threadId;
			vscode.postMessage({ type: 'getThread', threadId });
			const t = thread || threads.find((x) => x.threadId === threadId);
			const latest = t?.messages[t.messages.length - 1];
			if (latest) {
				pendingSelectRef.current = null;
				selectMessage(latest.id);
			}
		},
		[threads, selectMessage],
	);

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const msg = event.data;
			if (!msg || typeof msg !== 'object') {
				return;
			}
			switch (msg.type) {
				case 'bootstrap':
					setAccounts(msg.accounts || []);
					setAccountId((prev) => {
						const list = msg.accounts || [];
						if (prev && list.some((a: Account) => a.id === prev)) {
							return prev;
						}
						return list[0]?.id || '';
					});
					setFolder(msg.folder || 'INBOX');
					setThreads(msg.threads || []);
					setTotal(msg.total || 0);
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
					setTotal(msg.total || 0);
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
						setPane('list');
						pendingSelectRef.current = msg.threadId;
						vscode.postMessage({ type: 'getThread', threadId: msg.threadId });
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

	useEffect(() => {
		const prev = (vscode.getState() as PersistedState | null) || {};
		vscode.setState({ ...prev, listWidth });
	}, [listWidth]);

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
		focusThread(thread.threadId, thread);
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

	const clampListWidth = useCallback((raw: number) => {
		const layoutW = layoutRef.current?.clientWidth ?? window.innerWidth;
		const maxList = Math.max(MIN_LIST_WIDTH, layoutW - MIN_READER_WIDTH - SASH_WIDTH);
		return Math.min(maxList, Math.max(MIN_LIST_WIDTH, Math.round(raw)));
	}, []);

	const onSashPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.preventDefault();
		const sash = e.currentTarget;
		sash.setPointerCapture(e.pointerId);
		dragRef.current = { startX: e.clientX, startWidth: listWidth };
		setSashActive(true);

		const onMove = (ev: PointerEvent) => {
			const drag = dragRef.current;
			if (!drag) {
				return;
			}
			setListWidth(clampListWidth(drag.startWidth + (ev.clientX - drag.startX)));
		};

		const onUp = (ev: PointerEvent) => {
			dragRef.current = null;
			setSashActive(false);
			try {
				sash.releasePointerCapture(ev.pointerId);
			} catch {
				/* already released */
			}
			sash.removeEventListener('pointermove', onMove);
			sash.removeEventListener('pointerup', onUp);
			sash.removeEventListener('pointercancel', onUp);
			setListRemeasureKey((k) => k + 1);
		};

		sash.addEventListener('pointermove', onMove);
		sash.addEventListener('pointerup', onUp);
		sash.addEventListener('pointercancel', onUp);
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
					<select
						className="account-menu"
						value=""
						disabled={!accountId}
						title="Account actions"
						onChange={(e) => {
							const action = e.target.value;
							e.target.value = '';
							if (!accountId || !action) {
								return;
							}
							if (action === 'remove') {
								vscode.postMessage({ type: 'removeAccount', accountId });
							} else if (action === 'updatePassword') {
								vscode.postMessage({ type: 'updatePassword', accountId });
							}
						}}
					>
						<option value="">Account…</option>
						<option value="updatePassword">Update password</option>
						<option value="remove">Remove account</option>
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
				<div className="layout" ref={layoutRef}>
					<aside className="thread-list" style={{ width: listWidth, flexBasis: listWidth }}>
						<div className="list-meta muted">
							{total} threads (showing {threads.length})
						</div>
						<VirtualList
							items={threads}
							itemHeight={64}
							remeasureKey={listRemeasureKey}
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

					<div
						className={`sash${sashActive ? ' active' : ''}`}
						role="separator"
						aria-orientation="vertical"
						aria-valuenow={listWidth}
						aria-valuemin={MIN_LIST_WIDTH}
						tabIndex={0}
						onPointerDown={onSashPointerDown}
					/>

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
