/*--------------------------------------------------------------------------------------
 *  OAuth tokens in ExtensionContext.secrets (never settings / globalState / sync JSON)
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { CalendarProvider, OAuthTokens } from './types';

const SECRET_KEYS: Record<CalendarProvider, string> = {
	google: 'safeappeals-calendar.google.tokens',
	outlook: 'safeappeals-calendar.outlook.tokens',
};

export class TokenStore {
	constructor(private readonly secrets: vscode.SecretStorage) {}

	async get(provider: CalendarProvider): Promise<OAuthTokens | undefined> {
		const raw = await this.secrets.get(SECRET_KEYS[provider]);
		if (!raw) {
			return undefined;
		}
		try {
			return JSON.parse(raw) as OAuthTokens;
		} catch {
			return undefined;
		}
	}

	async set(provider: CalendarProvider, tokens: OAuthTokens): Promise<void> {
		await this.secrets.store(SECRET_KEYS[provider], JSON.stringify(tokens));
	}

	async clear(provider: CalendarProvider): Promise<void> {
		await this.secrets.delete(SECRET_KEYS[provider]);
	}

	async isConnected(provider: CalendarProvider): Promise<boolean> {
		const tokens = await this.get(provider);
		return !!(tokens?.accessToken);
	}
}
