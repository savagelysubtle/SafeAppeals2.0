import React, { useEffect, useMemo, useState } from 'react';
import type { Account, SyncStatus, Thread } from './types';

const vscode = acquireVsCodeApi();

const PAGE_SIZE = 50;

interface PersistedState {
	accountId?: string;
	folder?: string;
}

function readPersisted(): PersistedState {
	const state = vscode.getState() as PersistedState | undefined;
	return state && typeof state === 'object' ? state : {};
}

export const App: React.FC = () => {
	const persisted = readPersisted();
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [accountId, setAccountId] = useState(persisted.accountId || '');
	const [folder, setFolder] = useState(persisted.folder || 'INBOX');
	const [threads, setThreads] = useState<Thread[]>([]);
	const [total, setTotal] = useState(0);
	const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const msg = event.data;
			if (!msg || typeof msg !== 'object') {
				return;
			}
			switch (msg.type) {
				case 'bootstrap': {
					const list: Account[] = msg.accounts || [];
					setAccounts(list);
					setAccountId((prev) => {
						if (prev && list.some((a) => a.id === prev)) {
							return prev;
						}
						return list[0]?.id || '';
					});
					setFolder(msg.folder || 'INBOX');
					setThreads(msg.threads || []);
					setTotal(typeof msg.total === 'number' ? msg.total : 0);
					setSyncStatus(msg.status || null);
					setError(null);
					break;
				}
				case 'threads': {
					const next: Thread[] = msg.threads || [];
					const offset = typeof msg.offset === 'number' ? msg.offset : 0;
					setTotal(typeof msg.total === 'number' ? msg.total : 0);
					if (typeof msg.folder === 'string' && msg.folder) {
						setFolder(msg.folder);
					}
					if (offset > 0) {
						setThreads((prev) => [...prev, ...next]);
					} else {
						setThreads(next);
					}
					break;
				}
				case 'syncStatus':
					setSyncStatus(msg.status || null);
					break;
				case 'error':
					setError(msg.message || 'Unknown error');
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
		vscode.setState({ accountId, folder });
	}, [accountId, folder]);

	const accountStatus = useMemo(() => {
		if (!syncStatus) {
			return null;
		}
		if (accountId) {
			return syncStatus.accounts.find((a) => a.accountId === accountId) || null;
		}
		return syncStatus.accounts[0] || null;
	}, [syncStatus, accountId]);

	const statusDotClass = useMemo(() => {
		if (syncStatus?.syncing) {
			return 'dot syncing';
		}
		if (accountStatus?.error) {
			return 'dot error';
		}
		if (accountStatus?.lastSync) {
			return 'dot ok';
		}
		return 'dot idle';
	}, [syncStatus, accountStatus]);

	const listThreads = (opts: { accountId?: string; folder?: string; offset?: number }) => {
		vscode.postMessage({
			type: 'listThreads',
			accountId: opts.accountId ?? (accountId || undefined),
			folder: opts.folder ?? folder,
			offset: opts.offset ?? 0,
			limit: PAGE_SIZE,
		});
	};

	const onAccountChange = (id: string) => {
		setAccountId(id);
		listThreads({ accountId: id || undefined, offset: 0 });
	};

	const commitFolder = () => {
		const next = folder.trim() || 'INBOX';
		if (next !== folder) {
			setFolder(next);
		}
		listThreads({ folder: next, offset: 0 });
	};

	const onSync = () => {
		vscode.postMessage({ type: 'syncNow', accountId: accountId || undefined });
	};

	return (
		<div className="sidebar">
			<header className="header">
				<div className="header-row">
					<select
						className="account-select"
						value={accountId}
						onChange={(e) => onAccountChange(e.target.value)}
						title="Account"
					>
						{accounts.length === 0 && <option value="">No accounts</option>}
						{accounts.map((a) => (
							<option key={a.id} value={a.id}>
								{a.label}
							</option>
						))}
					</select>
					<button
						type="button"
						className="icon-btn"
						title="Compose"
						aria-label="Compose"
						onClick={() => vscode.postMessage({ type: 'compose' })}
					>
						<span className="codicon" aria-hidden="true">
							✎
						</span>
					</button>
					<button
						type="button"
						className="icon-btn"
						title="Open Email Dashboard"
						aria-label="Open Email Dashboard"
						onClick={() => vscode.postMessage({ type: 'openDashboard' })}
					>
						<span className="codicon" aria-hidden="true">
							⧉
						</span>
					</button>
				</div>
				<div className="header-row meta-row">
					<input
						className="folder-input"
						value={folder}
						onChange={(e) => setFolder(e.target.value)}
						onBlur={commitFolder}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								(e.target as HTMLInputElement).blur();
							}
						}}
						title="IMAP folder"
						aria-label="IMAP folder"
					/>
					<span className={statusDotClass} title={statusTitle(accountStatus, syncStatus)} />
					<span className="sync-time muted">
						{syncStatus?.syncing
							? 'Syncing…'
							: accountStatus?.lastSync
								? relativeTime(accountStatus.lastSync)
								: 'Never'}
					</span>
					<button type="button" className="sync-btn" onClick={onSync} disabled={!!syncStatus?.syncing}>
						Sync
					</button>
				</div>
			</header>

			{error && <div className="error">{error}</div>}

			{accounts.length === 0 ? (
				<p className="empty muted">Add an account from the dashboard.</p>
			) : threads.length === 0 ? (
				<p className="empty muted">No threads yet. Sync to fetch mail.</p>
			) : (
				<>
					<div className="list-meta muted">
						{total} thread{total === 1 ? '' : 's'}
						{threads.length < total ? ` · showing ${threads.length}` : ''}
					</div>
					<ul className="thread-list">
						{threads.map((thread) => {
							const sender = thread.messages[thread.messages.length - 1]?.from || '(unknown)';
							return (
								<li key={thread.threadId}>
									<button
										type="button"
										className="thread-row"
										onClick={() =>
											vscode.postMessage({ type: 'openThread', threadId: thread.threadId })
										}
									>
										<div className="row-top">
											<span className="subject">{thread.subject || '(no subject)'}</span>
											<span className="badge">{thread.emailCount}</span>
										</div>
										<div className="row-bottom muted">
											<span className="sender">{shortSender(sender)}</span>
											<span className="time">{relativeTime(thread.latestDate)}</span>
										</div>
									</button>
								</li>
							);
						})}
					</ul>
					{threads.length < total && (
						<div className="list-footer">
							<button
								type="button"
								className="load-more"
								onClick={() => listThreads({ offset: threads.length })}
							>
								Load more
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
};

function statusTitle(
	accountStatus: SyncStatus['accounts'][0] | null,
	syncStatus: SyncStatus | null,
): string {
	if (syncStatus?.syncing) {
		return 'Syncing';
	}
	if (accountStatus?.error) {
		return `Error: ${accountStatus.error}`;
	}
	if (accountStatus?.lastSync) {
		return `Last synced ${new Date(accountStatus.lastSync).toLocaleString()}`;
	}
	return 'Not synced';
}

function shortSender(from: string): string {
	const angle = from.match(/<([^>]+)>/);
	if (angle) {
		const name = from.slice(0, from.indexOf('<')).trim().replace(/^"|"$/g, '');
		return name || angle[1];
	}
	return from;
}

function relativeTime(iso: string): string {
	try {
		const t = Date.parse(iso);
		if (!Number.isFinite(t)) {
			return iso;
		}
		const diff = Date.now() - t;
		const sec = Math.round(diff / 1000);
		if (sec < 60) {
			return 'just now';
		}
		const min = Math.round(sec / 60);
		if (min < 60) {
			return `${min}m`;
		}
		const hr = Math.round(min / 60);
		if (hr < 24) {
			return `${hr}h`;
		}
		const days = Math.round(hr / 24);
		if (days < 7) {
			return `${days}d`;
		}
		return new Date(t).toLocaleDateString();
	} catch {
		return iso;
	}
}
