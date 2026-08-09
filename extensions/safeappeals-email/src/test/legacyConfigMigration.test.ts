/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'node:assert';
import type { ConfigurationTarget } from 'vscode';
import { clearLegacySetting, clearLegacySettingAtAllScopes, legacyString, legacyValue } from '../legacyConfigMigration';

suite('legacy encrypted-config migration', () => {
	test('does not write removed settings and tolerates cleanup failure', async () => {
		const updates: string[] = [];
		const configuration = {
			inspect: <T>(key: string) => key === 'registered'
				? { key, globalValue: 'legacy' as T }
				: undefined,
			update: async (key: string): Promise<void> => {
				updates.push(key);
				throw new Error('not registered');
			},
		};
		await clearLegacySetting(configuration, 'removed', 1 as ConfigurationTarget);
		await clearLegacySetting(configuration, 'registered', 1 as ConfigurationTarget);
		assert.deepStrictEqual({ updates, value: legacyString(configuration, 'registered') }, {
			updates: ['registered'], value: 'legacy',
		});
	});

	test('clears every populated scope and returns scopes requiring retry', async () => {
		const updates: number[] = [];
		const configuration = {
			inspect: <T>(_key: string) => ({
				key: 'compose.signature', globalValue: 'g' as T,
				workspaceValue: 'w' as T, workspaceFolderValue: 'f' as T,
			}),
			update: async (_key: string, _value: string | undefined, target?: boolean | ConfigurationTarget | null): Promise<void> => {
				updates.push(target as number);
				if (target === 2) throw new Error('workspace locked');
			},
		};
		const failed = await clearLegacySettingAtAllScopes(configuration, 'compose.signature');
		assert.deepStrictEqual({ updates, failed }, { updates: [1, 2, 3], failed: [2] });
	});

	test('account metadata migration uses folder, workspace, then global precedence', () => {
		const inspect = <T>(_key: string) => ({
			key: 'accounts', globalValue: ['global'] as T,
			workspaceValue: ['workspace'] as T, workspaceFolderValue: ['folder'] as T,
		});
		assert.deepStrictEqual(legacyValue<string[]>({ inspect }, 'accounts'), ['folder']);
	});
});
