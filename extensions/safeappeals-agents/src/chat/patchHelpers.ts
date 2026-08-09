/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type PatchAction = 'add' | 'update' | 'delete';

export interface PatchHunk {
	readonly header: string;
	readonly lines: readonly string[];
}

export interface PatchFileOp {
	readonly action: PatchAction;
	readonly path: string;
	readonly moveTo?: string;
	readonly hunks: readonly PatchHunk[];
	readonly addLines: readonly string[];
}

function countOccurrences(haystack: string, needle: string): number {
	if (needle.length === 0) {
		return 0;
	}
	let count = 0;
	let from = 0;
	while (true) {
		const idx = haystack.indexOf(needle, from);
		if (idx === -1) {
			return count;
		}
		count++;
		from = idx + needle.length;
	}
}

/**
 * Replace exactly one occurrence of `oldString` with `newString`.
 */
export function replaceOnce(haystack: string, oldString: string, newString: string): { ok: true; text: string } | { ok: false; error: string } {
	if (oldString.length === 0) {
		return { ok: false, error: 'oldString must not be empty.' };
	}
	const occurrences = countOccurrences(haystack, oldString);
	if (occurrences === 0) {
		return { ok: false, error: 'oldString was not found in the file.' };
	}
	if (occurrences > 1) {
		return { ok: false, error: `oldString matched ${occurrences} times; expected exactly one.` };
	}
	const idx = haystack.indexOf(oldString);
	return {
		ok: true,
		text: haystack.slice(0, idx) + newString + haystack.slice(idx + oldString.length),
	};
}

/**
 * Apply a single @@ hunk (space/-/+ lines) to file text.
 */
export function applyHunkToText(text: string, hunkLines: readonly string[]): { ok: true; text: string } | { ok: false; error: string } {
	const oldParts: string[] = [];
	const newParts: string[] = [];
	for (const line of hunkLines) {
		if (line.startsWith('***')) {
			continue;
		}
		const prefix = line.charAt(0);
		const body = line.length > 0 ? line.slice(1) : '';
		if (prefix === ' ') {
			oldParts.push(body);
			newParts.push(body);
		} else if (prefix === '-') {
			oldParts.push(body);
		} else if (prefix === '+') {
			newParts.push(body);
		} else if (prefix === '\\') {
			continue;
		} else {
			oldParts.push(line);
			newParts.push(line);
		}
	}
	const oldBlock = oldParts.join('\n');
	const newBlock = newParts.join('\n');
	if (oldBlock.length === 0 && newBlock.length === 0) {
		return { ok: true, text };
	}
	if (oldBlock.length === 0) {
		const sep = text.length === 0 || text.endsWith('\n') ? '' : '\n';
		return { ok: true, text: text + sep + newBlock + (text.endsWith('\n') || newBlock.endsWith('\n') ? '' : '\n') };
	}
	return replaceOnce(text, oldBlock, newBlock);
}

/**
 * Parse a pragmatic V4A-lite / Begin-Patch envelope into file operations.
 */
export function parseSimplePatch(input: string): PatchFileOp[] {
	const lines = input.replace(/\r\n/g, '\n').split('\n');
	const ops: PatchFileOp[] = [];
	let current: {
		action: PatchAction;
		path: string;
		moveTo?: string;
		hunks: PatchHunk[];
		addLines: string[];
		currentHunk: string[] | undefined;
		hunkHeader: string;
	} | undefined;

	const flushHunk = (): void => {
		if (!current?.currentHunk) {
			return;
		}
		current.hunks.push({ header: current.hunkHeader, lines: current.currentHunk });
		current.currentHunk = undefined;
		current.hunkHeader = '';
	};

	const flushOp = (): void => {
		if (!current) {
			return;
		}
		flushHunk();
		ops.push({
			action: current.action,
			path: current.path,
			moveTo: current.moveTo,
			hunks: current.hunks,
			addLines: current.addLines,
		});
		current = undefined;
	};

	for (const line of lines) {
		if (line === '*** Begin Patch' || line === '*** End Patch') {
			if (line === '*** End Patch') {
				flushOp();
			}
			continue;
		}

		const addMatch = /^\*\*\* Add File:\s*(.+)\s*$/.exec(line);
		const updateMatch = /^\*\*\* Update File:\s*(.+)\s*$/.exec(line);
		const deleteMatch = /^\*\*\* Delete File:\s*(.+)\s*$/.exec(line);
		const moveMatch = /^\*\*\* Move to:\s*(.+)\s*$/.exec(line);

		if (addMatch || updateMatch || deleteMatch) {
			flushOp();
			if (addMatch) {
				current = { action: 'add', path: addMatch[1].trim(), hunks: [], addLines: [], currentHunk: undefined, hunkHeader: '' };
			} else if (updateMatch) {
				current = { action: 'update', path: updateMatch[1].trim(), hunks: [], addLines: [], currentHunk: undefined, hunkHeader: '' };
			} else if (deleteMatch) {
				current = { action: 'delete', path: deleteMatch[1].trim(), hunks: [], addLines: [], currentHunk: undefined, hunkHeader: '' };
			}
			continue;
		}

		if (!current) {
			continue;
		}

		if (moveMatch) {
			current.moveTo = moveMatch[1].trim();
			continue;
		}

		if (line.startsWith('@@')) {
			flushHunk();
			current.currentHunk = [];
			current.hunkHeader = line.slice(2).trim();
			continue;
		}

		if (current.action === 'add') {
			if (line.startsWith('+')) {
				current.addLines.push(line.slice(1));
			} else if (line.length > 0) {
				current.addLines.push(line);
			}
			continue;
		}

		if (current.action === 'update') {
			if (current.currentHunk === undefined) {
				current.currentHunk = [];
				current.hunkHeader = '';
			}
			current.currentHunk.push(line);
		}
	}

	flushOp();
	return ops;
}
