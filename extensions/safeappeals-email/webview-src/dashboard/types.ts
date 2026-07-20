export interface Account {
	id: string;
	label: string;
	email: string;
}

export interface MessageSummary {
	id: string;
	accountId: string;
	folder: string;
	from: string;
	to: string;
	subject: string;
	date: string;
	snippet?: string;
	threadId: string;
	isStarred?: boolean;
	bodyLoaded: boolean;
	category?: string;
	priority?: string;
}

export interface Thread {
	threadId: string;
	accountId: string;
	folder: string;
	subject: string;
	latestDate: string;
	emailCount: number;
	participantCount: number;
	status: string;
	messages: MessageSummary[];
}

export interface FullMessage extends MessageSummary {
	bodyText: string;
	bodyHtml?: string;
	attachments: Array<{ filename: string; contentType: string; size?: number }>;
}

export interface Draft {
	id: string;
	accountId: string;
	emailId: string;
	to: string;
	cc?: string;
	subject: string;
	content: string;
	status: string;
	updatedAt: string;
}

export interface Stats {
	totalEmails: number;
	draftCount: number;
	accountCount: number;
	threadCount: number;
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
