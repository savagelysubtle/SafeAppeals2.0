import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Account, MailScope, MessageSummary, SyncStatus, TagInfo, Thread, ThreadSort } from './types';

const vscode = acquireVsCodeApi();

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;

interface PersistedState {
	accountId?: string;
	folder?: string;
	sort?: ThreadSort;
	scope?: MailScope;
	tagFilter?: string | null;
}

function readPersisted(): PersistedState {
	const state = vscode.getState() as PersistedState | undefined;
	return state && typeof state === 'object' ? state : {};
}

function isThreadSort(value: unknown): value is ThreadSort {
	return value === 'newest' || value === 'oldest' || value === 'sender' || value === 'subject';
}

function isMailScope(value: unknown): value is MailScope {
	return value === 'all' || value === 'case';
}

export const App: React.FC = () => {
	const persisted = readPersisted();
	const [accounts, setAccounts] = useState<Account[]>([]);
const [accountId, setAccountId] = useState(persisted.accountId || '');
const [folder, setFolder] = useState(persisted.folder || 'INBOX');
const [sort, setSort] = useState<ThreadSort>(isThreadSort(persisted.sort) ? persisted.sort : 'newest');
const [scope, setScope] = useState<MailScope>(isMailScope(persisted.scope) ? persisted.scope : 'all');
const [caseName, setCaseName] = useState<string | null>(null);
const [casePath, setCasePath] = useState<string | null>(null);
const [allTags, setAllTags] = useState<TagInfo[]>([]);
const [tagFilter, setTagFilter] = useState<string | null>(
	typeof persisted.tagFilter === 'string' ? persisted.tagFilter : null,
);
const [tagMenuOpen, setTagMenuOpen] = useState(false);
const [menuThreadId, setMenuThreadId] = useState<string | null>(null);
const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
const [newTagDraft, setNewTagDraft] = useState<string | null>(null);
const [accountMenuAction, setAccountMenuAction] = useState<string>('');
const menuRef = useRef<HTMLDivElement | null>(null);
const tagMenuRef = useRef<HTMLDivElement | null>(null);
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
					if (isMailScope(msg.scope)) {
						setScope(msg.scope);
					}
					setCaseName(typeof msg.caseName === 'string' ? msg.caseName : null);
					setCasePath(typeof msg.caseFolderPath === 'string' ? msg.caseFolderPath : null);
					setAllTags(Array.isArray(msg.allTags) ? msg.allTags : []);
					setTagFilter(typeof msg.tag === 'string' && msg.tag ? msg.tag : null);
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
					if (isMailScope(msg.scope)) {
						setScope(msg.scope);
					}
					if (Array.isArray(msg.allTags)) {
						setAllTags(msg.allTags);
					}
					setTagFilter(typeof msg.tag === 'string' && msg.tag ? msg.tag : null);
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
		vscode.setState({ accountId, folder, sort, scope, tagFilter });
	}, [accountId, folder, sort, scope, tagFilter]);

	useEffect(() => {
		return () => {
			if (searchTimerRef.current) {
				clearTimeout(searchTimerRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!menuThreadId) {
			return;
		}
		const onDocMouseDown = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				closeMenu();
			}
		};
		const onDocKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				closeMenu();
			}
		};
		document.addEventListener('mousedown', onDocMouseDown);
		document.addEventListener('keydown', onDocKeyDown);
		return () => {
			document.removeEventListener('mousedown', onDocMouseDown);
			document.removeEventListener('keydown', onDocKeyDown);
		};
	}, [menuThreadId]);

	useEffect(() => {
		if (!tagMenuOpen) {
			return;
		}
		const onDocMouseDown = (e: MouseEvent) => {
			if (tagMenuRef.current && !tagMenuRef.current.contains(e.target as Node)) {
				setTagMenuOpen(false);
			}
		};
		const onDocKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setTagMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', onDocMouseDown);
		document.addEventListener('keydown', onDocKeyDown);
		return () => {
			document.removeEventListener('mousedown', onDocMouseDown);
			document.removeEventListener('keydown', onDocKeyDown);
		};
	}, [tagMenuOpen]);

	useEffect(() => {
		if (
			tagFilter &&
			allTags.length > 0 &&
			!allTags.some((t) => t.name.toLowerCase() === tagFilter.toLowerCase())
		) {
			setTagFilter(null);
			listThreads({ tag: null, offset: 0 });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [allTags, tagFilter]);

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

	const menuThread = useMemo(
		() => (menuThreadId ? threads.find((t) => t.threadId === menuThreadId) || null : null),
		[threads, menuThreadId],
	);

	const listThreads = (opts: {
		accountId?: string;
		folder?: string;
		offset?: number;
		sort?: ThreadSort;
		scope?: MailScope;
		tag?: string | null;
	}) => {
		vscode.postMessage({
			type: 'listThreads',
			accountId: opts.accountId ?? (accountId || undefined),
			folder: opts.folder ?? folder,
			offset: opts.offset ?? 0,
			limit: PAGE_SIZE,
			sort: opts.sort ?? sort,
			scope: opts.scope ?? scope,
			tag: opts.tag === undefined ? tagFilter : opts.tag,
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

	const onScopeChange = (next: MailScope) => {
		if (next === scope) {
			return;
		}
		setScope(next);
		listThreads({ scope: next, offset: 0 });
	};

	const onTagFilterPick = (nextTag: string | null) => {
		setTagFilter(nextTag);
		setTagMenuOpen(false);
		listThreads({ tag: nextTag, offset: 0 });
	};

	const onDeleteTag = (tag: string, e: React.MouseEvent) => {
		e.stopPropagation();
		vscode.postMessage({ type: 'deleteTag', tag });
		setTagMenuOpen(false);
	};

	const closeMenu = () => {
		setMenuThreadId(null);
		setMenuPos(null);
		setNewTagDraft(null);
	};

	const onMenuButtonClick = (thread: Thread, e: React.MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		setTagMenuOpen(false);
		if (menuThreadId === thread.threadId) {
			closeMenu();
			return;
		}
		const rect = e.currentTarget.getBoundingClientRect();
		const entryCount = (caseName ? 1 : 0) + 1 + allTags.length + 1;
		const estHeight = Math.min(260, entryCount * 24 + 20);
		const top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - estHeight - 8));
		const left = Math.max(8, Math.min(rect.right - 180, window.innerWidth - 188));
		setNewTagDraft(null);
		setMenuThreadId(thread.threadId);
		setMenuPos({ top, left });
	};

	const onMenuToggleCase = (thread: Thread) => {
		const linked = !!casePath && thread.caseFolderPath === casePath;
		vscode.postMessage({
			type: linked ? 'unlinkThreadFromCase' : 'linkThreadToCase',
			accountId: thread.accountId,
			threadId: thread.threadId,
		});
		closeMenu();
	};

	const onMenuToggleHidden = (thread: Thread) => {
		vscode.postMessage({
			type: thread.hidden ? 'unhideThread' : 'hideThread',
			accountId: thread.accountId,
			threadId: thread.threadId,
		});
		closeMenu();
	};

	const onMenuToggleTag = (thread: Thread, tag: string) => {
		const has = (thread.tags || []).some((t) => t.toLowerCase() === tag.toLowerCase());
		vscode.postMessage({
			type: has ? 'untagThread' : 'tagThread',
			accountId: thread.accountId,
			threadId: thread.threadId,
			tag,
		});
		closeMenu();
	};

	const onNewTagSubmit = (thread: Thread) => {
		const tag = (newTagDraft || '').trim();
		if (!tag) {
			return;
		}
		vscode.postMessage({ type: 'tagThread', accountId: thread.accountId, threadId: thread.threadId, tag });
		closeMenu();
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
		if (action === 'reconnect') {
			vscode.postMessage({ type: 'reconnectMailbox', accountId });
		} else if (action === 'updatePassword') {
			vscode.postMessage({ type: 'updatePassword', accountId });
		} else if (action === 'remove') {
			vscode.postMessage({ type: 'removeAccount', accountId });
		}
	};

	const selectedNeedsReconnect =
		!!accountId && accounts.some((a) => a.id === accountId && a.authStatus === 'needsReconnect');

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
								{a.authStatus === 'needsReconnect' ? `${a.label} (reconnect)` : a.label}
							</option>
						))}
					</select>
					<select
						className="account-menu"
						value={accountMenuAction}
						title="Account actions"
						onChange={(e) => {
							const action = e.target.value;
							setAccountMenuAction('');
							onAccountMenu(action);
						}}
					>
						<option value="">Account…</option>
						<option value="add">Add account…</option>
						<option value="reconnect" disabled={!selectedNeedsReconnect}>
							Reconnect mailbox
						</option>
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
					<button
						type="button"
						className="icon-btn"
						title="Email Settings"
						aria-label="Email Settings"
						onClick={() => vscode.postMessage({ type: 'openSettings' })}
					>
						<span className="codicon" aria-hidden="true">
							⚙
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
					<div className="tag-filter" ref={tagMenuRef}>
						<button
							type="button"
							className={`tag-select-btn ${tagMenuOpen ? 'open' : ''}`}
							title="Filter by tag"
							aria-label="Filter by tag"
							aria-haspopup="menu"
							aria-expanded={tagMenuOpen}
							onClick={() => {
								closeMenu();
								setTagMenuOpen((open) => !open);
							}}
						>
							<span className="tag-select-label">{tagFilter || 'All tags'}</span>
							<span className="tag-select-caret" aria-hidden>
								▾
							</span>
						</button>
						{tagMenuOpen && (
							<div className="tag-filter-menu" role="menu">
								<button
									type="button"
									className={`tag-filter-item ${!tagFilter ? 'active' : ''}`}
									role="menuitem"
									onClick={() => onTagFilterPick(null)}
								>
									All tags
								</button>
								{allTags.length === 0 ? (
									<div className="tag-filter-empty muted">No tags yet</div>
								) : (
									allTags.map((t) => (
										<div key={t.name} className="tag-filter-row">
											<button
												type="button"
												className={`tag-filter-item ${
													tagFilter?.toLowerCase() === t.name.toLowerCase()
														? 'active'
														: ''
												}`}
												role="menuitem"
												onClick={() => onTagFilterPick(t.name)}
											>
												{t.name} ({t.count})
											</button>
											<button
												type="button"
												className="tag-remove-btn"
												title={`Remove tag “${t.name}” (emails stay)`}
												aria-label={`Remove tag ${t.name}`}
												onClick={(e) => onDeleteTag(t.name, e)}
											>
												✕
											</button>
										</div>
									))
								)}
							</div>
						)}
					</div>
				</div>
			</header>

			{caseName && (
				<div className="scope-toggle" role="group" aria-label="Mail scope">
					<button
						type="button"
						className={`scope-btn ${scope === 'all' ? 'active' : ''}`}
						onClick={() => onScopeChange('all')}
					>
						All mail
					</button>
					<button
						type="button"
						className={`scope-btn ${scope === 'case' ? 'active' : ''}`}
						title={`Only threads linked to ${caseName}`}
						onClick={() => onScopeChange('case')}
					>
						This case
					</button>
				</div>
			)}

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
				<p className="empty muted">
					{tagFilter
						? `No threads tagged '${tagFilter}'.`
						: 'No threads yet. Sync to fetch mail.'}
				</p>
			) : (
				<>
					<div className="list-meta muted">
						{total} thread{total === 1 ? '' : 's'}
						{threads.length < total ? ` · showing ${threads.length}` : ''}
					</div>
					<ul className="thread-list">
						{threads.map((thread) => {
							const sender = thread.messages[thread.messages.length - 1]?.from || '(unknown)';
							const tags = thread.tags || [];
							return (
								<li key={thread.threadId} className="thread-item">
									<button
										type="button"
										className={`thread-row ${thread.hidden ? 'hidden-thread' : ''}`}
										onClick={() =>
											vscode.postMessage({ type: 'openThread', threadId: thread.threadId })
										}
									>
										<div className="row-top">
											<span className="subject">{thread.subject || '(no subject)'}</span>
											{casePath && thread.caseFolderPath === casePath && (
												<span className="case-chip" title={`Linked to case: ${caseName}`}>
													case
												</span>
											)}
											{tags.slice(0, 2).map((tag) => (
												<span key={tag} className="tag-chip" title={`Tagged: ${tag}`}>
													{tag}
												</span>
											))}
											{tags.length > 2 && (
												<span className="tag-chip" title={tags.slice(2).join(', ')}>
													+{tags.length - 2}
												</span>
											)}
											<span className="badge">{thread.emailCount}</span>
										</div>
										<div className="row-bottom muted">
											<span className="sender">{shortSender(sender)}</span>
											<span className="time">{relativeTime(thread.latestDate)}</span>
										</div>
									</button>
									<button
										type="button"
										className={`row-menu-btn ${menuThreadId === thread.threadId ? 'open' : ''}`}
										title="Thread actions"
										aria-label="Thread actions"
										onMouseDown={(e) => e.stopPropagation()}
										onClick={(e) => onMenuButtonClick(thread, e)}
									>
										▾
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

			{menuThread && menuPos && (
				<div
					className="row-menu"
					ref={menuRef}
					role="menu"
					style={{ top: menuPos.top, left: menuPos.left }}
				>
					{caseName && (
						<button
							type="button"
							className="menu-item"
							role="menuitemcheckbox"
							aria-checked={!!casePath && menuThread.caseFolderPath === casePath}
							onClick={() => onMenuToggleCase(menuThread)}
						>
							<span className="menu-check" aria-hidden="true">
								{casePath && menuThread.caseFolderPath === casePath ? '✓' : ''}
							</span>
							This case
						</button>
					)}
					<button
						type="button"
						className="menu-item"
						role="menuitemcheckbox"
						aria-checked={!!menuThread.hidden}
						onClick={() => onMenuToggleHidden(menuThread)}
					>
						<span className="menu-check" aria-hidden="true">
							{menuThread.hidden ? '✓' : ''}
						</span>
						Hide
					</button>
					<div className="menu-sep" />
					{allTags.map((t) => {
						const has = (menuThread.tags || []).some(
							(x) => x.toLowerCase() === t.name.toLowerCase(),
						);
						return (
							<button
								type="button"
								key={t.name}
								className="menu-item"
								role="menuitemcheckbox"
								aria-checked={has}
								onClick={() => onMenuToggleTag(menuThread, t.name)}
							>
								<span className="menu-check" aria-hidden="true">
									{has ? '✓' : ''}
								</span>
								{t.name}
							</button>
						);
					})}
					{newTagDraft === null ? (
						<button
							type="button"
							className="menu-item"
							role="menuitem"
							onClick={() => setNewTagDraft('')}
						>
							<span className="menu-check" aria-hidden="true" />
							New tag…
						</button>
					) : (
						<input
							className="menu-input"
							autoFocus
							value={newTagDraft}
							placeholder="Tag name"
							aria-label="New tag name"
							onChange={(e) => setNewTagDraft(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									onNewTagSubmit(menuThread);
								} else if (e.key === 'Escape') {
									e.preventDefault();
									e.stopPropagation();
									setNewTagDraft(null);
								}
							}}
						/>
					)}
				</div>
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
