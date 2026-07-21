import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Account, MessageSummary, SyncStatus, Thread, ThreadSort } from './types';

const vscode = acquireVsCodeApi();

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;

interface PersistedState {
	accountId?: string;
	folder?: string;
	sort?: ThreadSort;
}

function readPersisted(): PersistedState {
	const state = vscode.getState() as PersistedState | undefined;
	return state && typeof state === 'object' ? state : {};
}

function isThreadSort(value: unknown): value is ThreadSort {
	return value === 'newest' || value === 'oldest' || value === 'sender' || value === 'subject';
}

export const App: React.FC = () => {
	const persisted = readPersisted();
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [accountId, setAccountId] = useState(persisted.accountId || '');
	const [folder, setFolder] = useState(persisted.folder || 'INBOX');
	const [sort, setSort] = useState<ThreadSort>(isThreadSort(persisted.sort) ? persisted.sort : 'newest');
	const [threads, setThreads] = useState<Thread[]>([]);
	const [total, setTotal] = useState(0);
	const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [searchInput, setSearchInput] = useState('');
	const [activeQuery, setActiveQuery] = useState('');
	const [searchResults, setSearchResults] = useState<MessageSummary[] | null>(null);
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearSearch = () => {
		if (searchTimerRef.current) {
			clearTimeout(searchTimerRef.current);
			searchTimerRef.current = null;
		}
		setSearchInput('');
		setActiveQuery('');
		setSearchResults(null);
	};

	const runSearch = (query: string) => {
		const q = query.trim();
		if (q.length < SEARCH_MIN_CHARS) {
			setActiveQuery('');
			setSearchResults(null);
			return;
		}
		setActiveQuery(q);
		vscode.postMessage({
			type: 'search',
			query: q,
			accountId: accountId || undefined,
		});
	};

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
					if (isThreadSort(msg.sort)) {
						setSort(msg.sort);
					}
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
					if (isThreadSort(msg.sort)) {
						setSort(msg.sort);
					}
					if (offset > 0) {
						setThreads((prev) => [...prev, ...next]);
					} else {
						setThreads(next);
					}
					break;
				}
				case 'searchResults':
					setActiveQuery(typeof msg.query === 'string' ? msg.query : '');
					setSearchResults(Array.isArray(msg.results) ? msg.results : []);
					break;
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
		vscode.setState({ accountId, folder, sort });
	}, [accountId, folder, sort]);

	useEffect(() => {
		return () => {
			if (searchTimerRef.current) {
				clearTimeout(searchTimerRef.current);
			}
		};
	}, []);

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

	const searching = searchResults !== null;

	const listThreads = (opts: {
		accountId?: string;
		folder?: string;
		offset?: number;
		sort?: ThreadSort;
	}) => {
		vscode.postMessage({
			type: 'listThreads',
			accountId: opts.accountId ?? (accountId || undefined),
			folder: opts.folder ?? folder,
			offset: opts.offset ?? 0,
			limit: PAGE_SIZE,
			sort: opts.sort ?? sort,
		});
	};

	const onAccountChange = (id: string) => {
		setAccountId(id);
		listThreads({ accountId: id || undefined, offset: 0 });
		if (activeQuery.length >= SEARCH_MIN_CHARS) {
			vscode.postMessage({
				type: 'search',
				query: activeQuery,
				accountId: id || undefined,
			});
		}
	};

	const onSortChange = (next: ThreadSort) => {
		setSort(next);
		listThreads({ sort: next, offset: 0 });
	};

	const commitFolder = () => {
		const next = folder.trim() || 'INBOX';
		if (next !== folder) {
			setFolder(next);
		}
		listThreads({ folder: next, offset: 0 });
	};

	const onSearchInputChange = (value: string) => {
		setSearchInput(value);
		if (searchTimerRef.current) {
			clearTimeout(searchTimerRef.current);
			searchTimerRef.current = null;
		}
		const trimmed = value.trim();
		if (trimmed.length < SEARCH_MIN_CHARS) {
			setActiveQuery('');
			setSearchResults(null);
			return;
		}
		searchTimerRef.current = setTimeout(() => {
			runSearch(value);
		}, SEARCH_DEBOUNCE_MS);
	};

	const onSync = () => {
		vscode.postMessage({ type: 'syncNow', accountId: accountId || undefined });
	};

	const onAccountMenu = (action: string) => {
		if (!action) {
			return;
		}
		if (action === 'add') {
			vscode.postMessage({ type: 'addAccount' });
			return;
		}
		if (!accountId) {
			return;
		}
		if (action === 'updatePassword') {
			vscode.postMessage({ type: 'updatePassword', accountId });
		} else if (action === 'remove') {
			vscode.postMessage({ type: 'removeAccount', accountId });
		}
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
					<select
						className="account-menu"
						value=""
						title="Account actions"
						onChange={(e) => {
							const action = e.target.value;
							e.target.value = '';
							onAccountMenu(action);
						}}
					>
						<option value="">Account…</option>
						<option value="add">Add account…</option>
						<option value="updatePassword" disabled={!accountId}>
							Update password
						</option>
						<option value="remove" disabled={!accountId}>
							Remove account
						</option>
					</select>
				</div>
				<div className="header-row toolbar-row">
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
						title="Drafts"
						aria-label="Drafts"
						onClick={() => vscode.postMessage({ type: 'openDrafts' })}
					>
						<span className="codicon" aria-hidden="true">
							☰
						</span>
					</button>
					<button
						type="button"
						className="icon-btn"
						title="Sync"
						aria-label="Sync"
						disabled={!!syncStatus?.syncing}
						onClick={onSync}
					>
						<span className="codicon" aria-hidden="true">
							↻
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
					<span className={statusDotClass} title={statusTitle(accountStatus, syncStatus)} />
					<span className="sync-time muted">
						{syncStatus?.syncing
							? 'Syncing…'
							: accountStatus?.lastSync
								? relativeTime(accountStatus.lastSync)
								: 'Never'}
					</span>
				</div>
				<div className="search-row">
					<input
						className="search-input"
						type="search"
						placeholder="Search emails…"
						value={searchInput}
						aria-label="Search emails"
						onChange={(e) => onSearchInputChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								if (searchTimerRef.current) {
									clearTimeout(searchTimerRef.current);
									searchTimerRef.current = null;
								}
								runSearch(searchInput);
							} else if (e.key === 'Escape') {
								e.preventDefault();
								clearSearch();
							}
						}}
					/>
					{searchInput && (
						<button
							type="button"
							className="icon-btn search-clear"
							title="Clear search"
							aria-label="Clear search"
							onClick={clearSearch}
						>
							✕
						</button>
					)}
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
					<select
						className="sort-select"
						value={sort}
						title="Sort threads"
						aria-label="Sort threads"
						onChange={(e) => onSortChange(e.target.value as ThreadSort)}
					>
						<option value="newest">Newest</option>
						<option value="oldest">Oldest</option>
						<option value="sender">Sender</option>
						<option value="subject">Subject</option>
					</select>
				</div>
			</header>

			{error && <div className="error">{error}</div>}

			{accounts.length === 0 ? (
				<p className="empty muted">Add an account via Account…</p>
			) : searching ? (
				<>
					<div className="list-meta muted">
						{searchResults!.length} result{searchResults!.length === 1 ? '' : 's'} for &lsquo;
						{activeQuery}&rsquo;
						<span className="meta-note"> · synced mail only</span>
					</div>
					{searchResults!.length === 0 ? (
						<p className="empty muted">No matches.</p>
					) : (
						<ul className="thread-list">
							{searchResults!.map((result) => (
								<li key={result.id}>
									<button
										type="button"
										className="thread-row search-row"
										onClick={() =>
											vscode.postMessage({ type: 'openThread', threadId: result.threadId })
										}
									>
										<div className="row-top">
											<span className="subject">{result.subject || '(no subject)'}</span>
										</div>
										<div className="row-bottom muted">
											<span className="sender">{shortSender(result.from)}</span>
											<span className="time">{relativeTime(result.date)}</span>
										</div>
										{result.snippet && (
											<div className="snippet muted">{result.snippet}</div>
										)}
									</button>
								</li>
							))}
						</ul>
					)}
				</>
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
