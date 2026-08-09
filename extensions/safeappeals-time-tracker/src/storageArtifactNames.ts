/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'node:crypto';

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

export const sensitiveStateTemporaryNamePattern = new RegExp(`^\\.safeappeals-tx-sensitive-state-${uuid}$`);
export const sensitiveStateDeleteNamePattern = new RegExp(`^\\.safeappeals-tx-sensitive-state-delete-${uuid}$`);

export function createSensitiveStateTemporaryName(): string {
	return `.safeappeals-tx-sensitive-state-${randomUUID()}`;
}

export function createSensitiveStateDeleteName(): string {
	return `.safeappeals-tx-sensitive-state-delete-${randomUUID()}`;
}
