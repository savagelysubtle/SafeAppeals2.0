export interface Account {
	id: string;
	label: string;
	email: string;
	/** Present when mailbox auth needs user action (OAuth reconnect). */
	authStatus?: 'ok' | 'needsReconnect';
}

export type ThreadSort = 'newest' | 'oldest' | 'sender' | 'subject';

export type MailScope = 'all' | 'case';

export interface TagInfo {
	name: string;
	count: number;
}

export interface MessageSummary {
	id: string;
	threadId: string;
	from: string;
	subject: string;
	date: string;
	snippet?: string;
}

export interface Thread {
	threadId: string;
	accountId: string;
	folder: string;
	subject: string;
	latestDate: string;
	emailCount: number;
	caseFolderPath?: string;
	tags?: string[];
	hidden?: boolean;
	messages: MessageSummary[];
}

export interface AccountSyncStatus {
	accountId: string;
	label: string;
	email: string;
	lastSync: string | null;
	messageCount: number;
	error?: string;
}

export interface SyncStatus {
	accounts: AccountSyncStatus[];
	lastBackgroundSync: string | null;
	syncIntervalMinutes: number;
	syncing: boolean;
}

declare global {
	function acquireVsCodeApi(): {
		postMessage(msg: unknown): void;
		getState(): unknown;
		setState(state: unknown): void;
	};
}
