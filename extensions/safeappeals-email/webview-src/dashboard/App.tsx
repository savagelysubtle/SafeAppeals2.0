import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
	Account,
	Draft,
	DraftAttachment,
	EmailSettings,
	FullMessage,
	Stats,
	SyncStatus,
	Thread,
} from './types';

const vscode = acquireVsCodeApi();

type Pane = 'read' | 'compose' | 'drafts' | 'settings';

interface ComposeState {
	to: string;
	cc: string;
	bcc: string;
	subject: string;
	content: string;
	/** Set after the first successful save so later saves update the same draft. */
	draftId?: string;
	/** Parent message id when replying/forwarding; empty for a new compose. */
	emailId?: string;
	/** Metadata only — never attachment bytes */
	attachments: DraftAttachment[];
}

const emptyCompose = (): ComposeState => ({
	to: '',
	cc: '',
	bcc: '',
	subject: '',
	content: '',
	draftId: undefined,
	emailId: undefined,
	attachments: [],
});

function formatAttachmentSize(size: number): string {
	if (size < 1024) {
		return `${size} B`;
	}
	if (size < 1024 * 1024) {
		return `${(size / 1024).toFixed(1)} KB`;
	}
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function applyDefaults(
	body: string,
	settings: EmailSettings | null,
): Pick<ComposeState, 'content' | 'cc' | 'bcc'> {
	const compose = settings?.compose;
	const parts: string[] = [];
	const header = compose?.header?.trim() || '';
	const signature = compose?.signature?.trim() || '';
	if (header) {
		parts.push(header);
	}
	if (body.trim()) {
		parts.push(body.trim());
	} else if (header || signature) {
		parts.push('');
	}
	if (signature) {
		parts.push(signature);
	}
	return {
		content: parts.join('\n\n'),
		cc: compose?.autoCc || '',
		bcc: compose?.autoBcc || '',
	};
}

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
	const [caseName, setCaseName] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loadingBody, setLoadingBody] = useState(false);
	const [compose, setCompose] = useState<ComposeState>(emptyCompose());
	const [showCc, setShowCc] = useState(false);
	const [showBcc, setShowBcc] = useState(false);
	const [settings, setSettings] = useState<EmailSettings | null>(null);
	const [settingsDraft, setSettingsDraft] = useState<EmailSettings | null>(null);
	const [settingsSaved, setSettingsSaved] = useState(false);
	const [draftSavedHint, setDraftSavedHint] = useState(false);
	const [draftRemoteError, setDraftRemoteError] = useState<string | null>(null);

	const pendingSelectRef = useRef<string | null>(null);
	// Ref mirror so the once-mounted message listener always sees current settings
	const settingsRef = useRef<EmailSettings | null>(null);
	settingsRef.current = settings;

	const selectMessage = useCallback((messageId: string) => {
		setSelectedMessageId(messageId);
		setLoadingBody(true);
		setMessage(null);
		vscode.postMessage({ type: 'getMessage', messageId });
	}, []);

	const startCompose = useCallback(
		(partial: Partial<ComposeState> & { body?: string }) => {
			const defaults = applyDefaults(partial.body ?? '', settingsRef.current);
			const next: ComposeState = {
				to: partial.to ?? '',
				cc: partial.cc ?? defaults.cc,
				bcc: partial.bcc ?? defaults.bcc,
				subject: partial.subject ?? '',
				content: partial.content ?? defaults.content,
				draftId: partial.draftId,
				emailId: partial.emailId,
				attachments: partial.attachments ? [...partial.attachments] : [],
			};
			setCompose(next);
			setShowCc(!!next.cc);
			setShowBcc(!!next.bcc);
			setDraftSavedHint(false);
			setDraftRemoteError(null);
			setPane('compose');
		},
		[],
	);

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
					setCaseName(typeof msg.caseName === 'string' ? msg.caseName : null);
					if (msg.settings) {
						setSettings(msg.settings);
						// Never clobber in-progress edits: seed the draft only when empty
						setSettingsDraft((prev) => prev ?? msg.settings);
					}
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
					startCompose({});
					break;
				case 'loadDraft': {
					const draft = msg.draft;
					if (!draft || typeof draft !== 'object') {
						startCompose({});
						break;
					}
					const attachments = Array.isArray(draft.attachments)
						? draft.attachments.filter(
							(a: DraftAttachment) => a && typeof a.id === 'string' && typeof a.filename === 'string',
						)
						: [];
					startCompose({
						to: typeof draft.to === 'string' ? draft.to : '',
						cc: typeof draft.cc === 'string' ? draft.cc : '',
						bcc: typeof draft.bcc === 'string' ? draft.bcc : '',
						subject: typeof draft.subject === 'string' ? draft.subject : '',
						content: typeof draft.content === 'string' ? draft.content : '',
						draftId: typeof draft.id === 'string' ? draft.id : undefined,
						emailId: typeof draft.emailId === 'string' ? draft.emailId : undefined,
						attachments,
					});
					if (typeof draft.accountId === 'string' && draft.accountId) {
						setAccountId(draft.accountId);
					}
					break;
				}
				case 'openDrafts':
					setPane('drafts');
					vscode.postMessage({ type: 'listDrafts', accountId: undefined });
					break;
				case 'openSettings':
					setPane('settings');
					setSettingsSaved(false);
					break;
				case 'settingsSaved':
					if (msg.settings) {
						setSettings(msg.settings);
						setSettingsDraft(msg.settings);
					}
					setSettingsSaved(true);
					break;
				case 'message':
					setMessage(msg.message);
					setLoadingBody(false);
					break;
				case 'draftSaved': {
					const list: Draft[] = Array.isArray(msg.drafts)
						? msg.drafts
						: msg.draft
							? [msg.draft]
							: [];
					setDrafts(list);
					if (msg.stats) {
						setStats(msg.stats);
					}
					if (msg.draft?.id) {
						setCompose((prev) => ({
							...prev,
							draftId: msg.draft.id,
							attachments: Array.isArray(msg.draft.attachments)
								? msg.draft.attachments
								: prev.attachments,
						}));
					}
					setDraftSavedHint(true);
					setDraftRemoteError(
						typeof msg.remoteError === 'string' && msg.remoteError
							? msg.remoteError
							: null,
					);
					setError(null);
					break;
				}
				case 'attachmentsUpdated': {
					const draftId = typeof msg.draftId === 'string' ? msg.draftId : undefined;
					const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
					setCompose((prev) => ({
						...prev,
						draftId: draftId || prev.draftId,
						attachments,
					}));
					if (Array.isArray(msg.drafts)) {
						setDrafts(msg.drafts);
					}
					setError(null);
					break;
				}
				case 'sent': {
					if (Array.isArray(msg.drafts)) {
						setDrafts(msg.drafts);
					}
					if (msg.stats) {
						setStats(msg.stats);
					}
					break;
				}
				case 'drafts':
					setDrafts(Array.isArray(msg.drafts) ? msg.drafts : []);
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
		// Mount once: `ready` must only be posted a single time, and the handler
		// reads live values through refs/stable callbacks.
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
				cc: compose.cc || undefined,
				bcc: compose.bcc || undefined,
				subject: compose.subject,
				text: compose.content,
				html: `<pre>${escapeHtml(compose.content)}</pre>`,
				draftId: compose.draftId,
			},
		});
		setCompose(emptyCompose());
		setShowCc(false);
		setShowBcc(false);
		setPane('read');
	};

	const onSaveDraft = () => {
		if (!accountId) {
			setError('Add an account first');
			return;
		}
		setDraftSavedHint(false);
		setDraftRemoteError(null);
		vscode.postMessage({
			type: 'saveDraft',
			draft: {
				accountId,
				emailId: compose.emailId || selectedMessageId || '',
				to: compose.to,
				cc: compose.cc || undefined,
				bcc: compose.bcc || undefined,
				subject: compose.subject,
				content: compose.content,
				draftId: compose.draftId,
			},
		});
	};

	const onPickAttachments = () => {
		if (!accountId) {
			setError('Add an account first');
			return;
		}
		vscode.postMessage({
			type: 'pickAttachments',
			accountId,
			draftId: compose.draftId,
			emailId: compose.emailId || selectedMessageId || '',
			to: compose.to,
			cc: compose.cc || undefined,
			bcc: compose.bcc || undefined,
			subject: compose.subject,
			content: compose.content,
		});
	};

	const onRemoveAttachment = (attachmentId: string) => {
		if (!compose.draftId) {
			setCompose((prev) => ({
				...prev,
				attachments: prev.attachments.filter((a) => a.id !== attachmentId),
			}));
			return;
		}
		vscode.postMessage({
			type: 'removeAttachment',
			draftId: compose.draftId,
			attachmentId,
		});
	};

	const onReply = () => {
		if (!message) {
			return;
		}
		startCompose({
			to: message.from,
			cc: message.cc || undefined,
			subject: message.subject.startsWith('Re:')
				? message.subject
				: `Re: ${message.subject}`,
			body: '',
			emailId: message.id,
		});
	};

	const onLinkCase = () => {
		if (!selectedThreadId) {
			return;
		}
		vscode.postMessage({ type: 'linkThreadToCase', threadId: selectedThreadId });
	};

	const onUnlinkCase = () => {
		if (!selectedThreadId) {
			return;
		}
		vscode.postMessage({ type: 'unlinkThreadFromCase', threadId: selectedThreadId });
	};

	const onForward = () => {
		if (!message) {
			return;
		}
		const subject = message.subject.startsWith('Fwd:')
			? message.subject
			: `Fwd: ${message.subject}`;
		const body = message.bodyText || message.snippet || '';
		const forwarded =
			`---------- Forwarded message ----------\n` +
			`From: ${message.from}\n` +
			`Date: ${formatDate(message.date)}\n` +
			`Subject: ${message.subject}\n` +
			`To: ${message.to}\n` +
			`\n${body}`;
		startCompose({ to: '', subject, body: forwarded, emailId: message.id });
	};

	const onSaveSettings = () => {
		if (!settingsDraft) {
			return;
		}
		setSettingsSaved(false);
		vscode.postMessage({
			type: 'updateSettings',
			settings: {
				header: settingsDraft.compose.header,
				signature: settingsDraft.compose.signature,
				autoCc: settingsDraft.compose.autoCc,
				autoBcc: settingsDraft.compose.autoBcc,
				syncIntervalMinutes: settingsDraft.sync.syncIntervalMinutes,
				defaultFolder: settingsDraft.sync.defaultFolder,
				maxMessagesPerSync: settingsDraft.sync.maxMessagesPerSync,
			},
		});
	};

	const draftCompose = settingsDraft?.compose;
	const draftSync = settingsDraft?.sync;

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
					<div className="compose-to-row">
						<input
							className="compose-to"
							placeholder="To"
							value={compose.to}
							onChange={(e) => setCompose({ ...compose, to: e.target.value })}
						/>
						<div className="cc-bcc-toggles">
							{!showCc && (
								<button type="button" className="linkish" onClick={() => setShowCc(true)}>
									Cc
								</button>
							)}
							{!showBcc && (
								<button type="button" className="linkish" onClick={() => setShowBcc(true)}>
									Bcc
								</button>
							)}
						</div>
					</div>
					{showCc && (
						<input
							placeholder="Cc"
							value={compose.cc}
							onChange={(e) => setCompose({ ...compose, cc: e.target.value })}
						/>
					)}
					{showBcc && (
						<input
							placeholder="Bcc"
							value={compose.bcc}
							onChange={(e) => setCompose({ ...compose, bcc: e.target.value })}
						/>
					)}
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
					{compose.attachments.length > 0 && (
						<ul className="compose-attachments">
							{compose.attachments.map((att) => (
								<li key={att.id} className="compose-attachment-item">
									<span className="compose-attachment-name" title={att.filename}>
										{att.filename}
									</span>
									<span className="muted compose-attachment-size">
										{formatAttachmentSize(att.size)}
									</span>
									<button
										type="button"
										className="linkish"
										aria-label={`Remove ${att.filename}`}
										onClick={() => onRemoveAttachment(att.id)}
									>
										Remove
									</button>
								</li>
							))}
						</ul>
					)}
					<div className="compose-actions">
						<button type="button" onClick={onSend}>
							Send
						</button>
						<button type="button" onClick={onSaveDraft}>
							Save draft
						</button>
						<button type="button" className="secondary" onClick={onPickAttachments}>
							Attach
						</button>
						<button type="button" className="secondary" onClick={() => setPane('read')}>
							Cancel
						</button>
						{draftSavedHint && !draftRemoteError && (
							<span className="muted">Draft saved</span>
						)}
						{draftRemoteError && (
							<span className="error" title={draftRemoteError}>
								Saved locally; server Drafts failed
							</span>
						)}
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
										startCompose({
											to: d.to,
											cc: d.cc || '',
											bcc: d.bcc || '',
											subject: d.subject,
											content: d.content,
											draftId: d.id,
											emailId: d.emailId,
											attachments: d.attachments || [],
										});
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

			{pane === 'settings' && draftCompose && draftSync && (
				<section className="settings">
					<h2>Email Settings</h2>

					<h3>Compose</h3>
					<label className="settings-field">
						<span>Header (global)</span>
						<textarea
							rows={3}
							value={draftCompose.header}
							placeholder="e.g. PRIVILEGED AND CONFIDENTIAL"
							onChange={(e) =>
								setSettingsDraft({
									...settingsDraft!,
									compose: { ...draftCompose, header: e.target.value },
								})
							}
						/>
					</label>
					<label className="settings-field">
						<span>Signature (global)</span>
						<textarea
							rows={4}
							value={draftCompose.signature}
							placeholder="Your name, title, contact…"
							onChange={(e) =>
								setSettingsDraft({
									...settingsDraft!,
									compose: { ...draftCompose, signature: e.target.value },
								})
							}
						/>
					</label>
					<label className="settings-field">
						<span>
							Auto-CC (this case)
							{!draftCompose.hasCase && (
								<span className="muted"> — open a case folder to set</span>
							)}
						</span>
						<input
							value={draftCompose.autoCc}
							disabled={!draftCompose.hasCase}
							placeholder="address@example.com"
							onChange={(e) =>
								setSettingsDraft({
									...settingsDraft!,
									compose: { ...draftCompose, autoCc: e.target.value },
								})
							}
						/>
					</label>
					<label className="settings-field">
						<span>
							Auto-BCC (this case)
							{!draftCompose.hasCase && (
								<span className="muted"> — open a case folder to set</span>
							)}
						</span>
						<input
							value={draftCompose.autoBcc}
							disabled={!draftCompose.hasCase}
							placeholder="address@example.com"
							onChange={(e) =>
								setSettingsDraft({
									...settingsDraft!,
									compose: { ...draftCompose, autoBcc: e.target.value },
								})
							}
						/>
					</label>

					<h3>Sync</h3>
					<label className="settings-field">
						<span>Sync interval (minutes)</span>
						<input
							type="number"
							min={1}
							value={draftSync.syncIntervalMinutes}
							onChange={(e) =>
								setSettingsDraft({
									...settingsDraft!,
									sync: {
										...draftSync,
										syncIntervalMinutes: Number(e.target.value) || 15,
									},
								})
							}
						/>
					</label>
					<label className="settings-field">
						<span>Default folder</span>
						<input
							value={draftSync.defaultFolder}
							onChange={(e) =>
								setSettingsDraft({
									...settingsDraft!,
									sync: { ...draftSync, defaultFolder: e.target.value },
								})
							}
						/>
					</label>
					<label className="settings-field">
						<span>Max messages per sync</span>
						<input
							type="number"
							min={10}
							max={500}
							value={draftSync.maxMessagesPerSync}
							onChange={(e) =>
								setSettingsDraft({
									...settingsDraft!,
									sync: {
										...draftSync,
										maxMessagesPerSync: Number(e.target.value) || 100,
									},
								})
							}
						/>
					</label>

					<div className="compose-actions">
						<button type="button" onClick={onSaveSettings}>
							Save
						</button>
						<button type="button" className="secondary" onClick={() => setPane('read')}>
							Back
						</button>
						{settingsSaved && <span className="muted">Saved</span>}
					</div>
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
								<button type="button" onClick={() => startCompose({})}>
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
										{selectedThread.caseFolderPath && (
											<span className="case-chip" title={selectedThread.caseFolderPath}>
												{basename(selectedThread.caseFolderPath)}
											</span>
										)}
										{(selectedThread.tags || []).map((tag) => (
											<span key={tag} className="tag-chip" title={`Tagged: ${tag}`}>
												{tag}
											</span>
										))}
										<div className="msg-actions">
											<button type="button" onClick={onReply}>
												Reply
											</button>
											<button type="button" onClick={onForward}>
												Forward
											</button>
											{selectedThread.caseFolderPath ? (
												<button type="button" className="secondary" onClick={onUnlinkCase}>
													Unlink from case
												</button>
											) : caseName ? (
												<button
													type="button"
													className="secondary"
													title={`Link this thread to ${caseName}`}
													onClick={onLinkCase}
												>
													Link to case
												</button>
											) : null}
										</div>
									</div>
									<div className="msg-headers muted">
										<div>From: {message.from}</div>
										<div>To: {message.to}</div>
										{message.cc && <div>Cc: {message.cc}</div>}
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

function basename(fsPath: string): string {
	const parts = fsPath.split(/[\\/]/).filter(Boolean);
	return parts[parts.length - 1] || fsPath;
}

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
