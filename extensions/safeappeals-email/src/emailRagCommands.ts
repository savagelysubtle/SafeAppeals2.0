/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

export interface EmailRagIndexer<Message> {
	indexThread(accountId: string, threadId: string, messages: Message[], caseFolderPath: string): Promise<void>;
	unindexThread(accountId: string, threadId: string, messages?: readonly Pick<Message & { id: string }, 'id'>[], caseFolderPath?: string): Promise<void>;
}

export async function indexThenCommitLink<Message extends { id: string }>(input: {
	readonly indexer: EmailRagIndexer<Message>;
	readonly accountId: string;
	readonly threadId: string;
	readonly messages: Message[];
	readonly caseFolderPath: string;
	readonly commitLink: () => Promise<void>;
}): Promise<void> {
	await input.indexer.indexThread(input.accountId, input.threadId, input.messages, input.caseFolderPath);
	try {
		await input.commitLink();
	} catch (error) {
		await input.indexer.unindexThread(input.accountId, input.threadId, input.messages, input.caseFolderPath);
		throw error;
	}
}

export async function purgeThenCommitUnlink<Message extends { id: string }>(input: {
	readonly indexer: EmailRagIndexer<Message> | undefined;
	readonly unavailableError: Error;
	readonly accountId: string;
	readonly threadId: string;
	readonly messages: Message[];
	readonly caseFolderPath: string;
	readonly commitUnlink: () => Promise<void>;
}): Promise<void> {
	if (!input.indexer) {
		throw input.unavailableError;
	}
	await input.indexer.unindexThread(input.accountId, input.threadId, input.messages, input.caseFolderPath);
	try {
		await input.commitUnlink();
	} catch (error) {
		await input.indexer.indexThread(input.accountId, input.threadId, input.messages, input.caseFolderPath);
		throw error;
	}
}

export async function runRetryableEmailIndexing(
	task: () => Promise<void>,
	logRetry: (message: string) => void,
): Promise<void> {
	try {
		await task();
	} catch (error) {
		logRetry(error instanceof Error ? error.message : String(error));
	}
}

export async function runRetryableEmailIndexingTasks(
	tasks: ReadonlyArray<readonly [string, () => Promise<void>]>,
	logRetry: (taskId: string, message: string) => void,
): Promise<void> {
	for (const [taskId, task] of tasks) {
		await runRetryableEmailIndexing(task, message => logRetry(taskId, message));
	}
}

export async function purgeManifestEntries<Message extends { id: string }>(
	indexer: EmailRagIndexer<Message> | undefined,
	entries: ReadonlyArray<readonly [string, string, { readonly caseFolderPath: string }]>,
	unavailableError: Error,
): Promise<void> {
	if (entries.length > 0 && !indexer) {
		throw unavailableError;
	}
	for (const [accountId, threadId, entry] of entries) {
		await indexer?.unindexThread(accountId, threadId, [], entry.caseFolderPath);
	}
}
