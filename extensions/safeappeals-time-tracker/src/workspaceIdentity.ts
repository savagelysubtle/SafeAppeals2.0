/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from 'node:crypto';

const IDENTITY_VERSION = 'safeappeals-time-tracker-workspace-v1';

function field(value: string): string {
	return `${Buffer.byteLength(value, 'utf8')}:${value}`;
}

/** Canonical, versioned serialization used for the managed workspace identity. */
export function serializeTimeTrackerWorkspaceIdentity(
	workspaceFileUri: string | undefined,
	orderedFolderUris: readonly string[]
): string | undefined {
	if (workspaceFileUri) {
		return `${field(IDENTITY_VERSION)}${field('workspace-file')}${field(workspaceFileUri)}`;
	}
	if (orderedFolderUris.length === 0) {
		return undefined;
	}
	return `${field(IDENTITY_VERSION)}${field('folders')}${field(String(orderedFolderUris.length))}${orderedFolderUris.map(field).join('')}`;
}

/** Full SHA-256 managed identifier. Undefined identities are deliberately non-durable. */
export function getTimeTrackerWorkspaceId(_globalStoragePath: string, workspaceIdentity?: string): string {
	if (!workspaceIdentity) {
		throw new Error('A durable workspace identity is required');
	}
	return crypto.createHash('sha256').update(workspaceIdentity).digest('hex');
}

/** Exact identifier used by the historical implementation for legacy discovery only. */
export function getLegacyTimeTrackerWorkspaceId(firstWorkspaceFolderPath: string): string {
	return crypto.createHash('sha256').update(firstWorkspaceFolderPath).digest('hex').substring(0, 16);
}
