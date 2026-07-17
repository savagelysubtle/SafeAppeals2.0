/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { safeStorage } from 'electron';
import * as fs from 'fs';
import { createRequire } from 'node:module';
import * as path from 'path';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import {
	IDocuSignEnvelope,
	IDocuSignEnvelopeCreateRequest,
	IDocuSignEnvelopeCreateResponse,
	IDocuSignEnvelopeSummary,
	IDocuSignUser
} from '../common/docuSign/docuSignTypes.js';

// Import types for TypeScript
import type { ApiClient, EnvelopeDefinition, EnvelopesApi } from 'docusign-esign';

// Use createRequire to load CommonJS module in ESM context
const require = createRequire(import.meta.url);
const docusign: {
	ApiClient: new () => ApiClient;
	EnvelopesApi: new (client: ApiClient) => EnvelopesApi;
} = require('docusign-esign');

// ============================================
// CONFIGURATION
// ============================================

// Read bundled DocuSign config from environment variables
// These are loaded from .env by the parser in main.ts at startup
const DOCUSIGN_INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY || '';
const DOCUSIGN_CLIENT_SECRET = process.env.DOCUSIGN_CLIENT_SECRET || '';
const DOCUSIGN_ENVIRONMENT = (process.env.DOCUSIGN_ENVIRONMENT || 'demo') as 'demo' | 'production';
// Token refresh settings
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

// Base paths by environment
const BASE_PATHS = {
	demo: {
		oAuth: 'account-d.docusign.com',
		api: 'https://demo.docusign.net/restapi',
	},
	production: {
		oAuth: 'account.docusign.com',
		api: 'https://www.docusign.net/restapi',
	},
};

// Storage key for encrypted private key
const REFRESH_TOKEN_STORAGE_KEY = 'docusign_refresh_token';

// Log at module load time for debugging
console.log('[DocuSignChannel] Module loaded');
console.log('[DocuSignChannel] DOCUSIGN_INTEGRATION_KEY from env:', DOCUSIGN_INTEGRATION_KEY ? `${DOCUSIGN_INTEGRATION_KEY.substring(0, 8)}...` : 'NOT SET');
console.log('[DocuSignChannel] DOCUSIGN_CLIENT_SECRET from env:', DOCUSIGN_CLIENT_SECRET ? 'SET (Hidden)' : 'NOT SET');
console.log('[DocuSignChannel] DOCUSIGN_ENVIRONMENT from env:', DOCUSIGN_ENVIRONMENT);
console.log('[DocuSignChannel] DOCUSIGN_CLIENT_SECRET from env:', DOCUSIGN_CLIENT_SECRET ? 'SET (Hidden)' : 'NOT SET');
console.log('[DocuSignChannel] DOCUSIGN_ENVIRONMENT from env:', DOCUSIGN_ENVIRONMENT);

// ============================================
// TYPES
// ============================================

export interface IDocuSignConfig {
	integrationKey: string;
	environment: 'demo' | 'production';
	userId?: string;
	privateKeyConfigured?: boolean;
	authMode: 'oauth' | 'jwt';
}

interface CachedToken {
	accessToken: string;
	refreshToken?: string;
	expiresAt: number; // Unix timestamp in ms
	accountId: string;
	baseUri: string;
	user: IDocuSignUser;
}

interface AuthStateEvent {
	status: 'signed_out' | 'signing_in' | 'signed_in' | 'error';
	user: IDocuSignUser | null;
	error?: string;
}

// ============================================
// DOCUSIGN JWT CHANNEL
// ============================================

/**
 * IPC Channel for DocuSign JWT authentication and API operations
 * Runs in electron-main with full Node.js access to docusign-esign SDK
 */
export class DocuSignChannel implements IServerChannel {
	private cachedToken: CachedToken | null = null;
	private keyStoragePath: string = '';

	// Events
	private readonly _onAuthStateChange = new Emitter<AuthStateEvent>();

	constructor(appDataPath?: string) {
		// Set up key storage path
		if (appDataPath) {
			this.keyStoragePath = path.join(appDataPath, 'docusign');
		}

		// Try to load refresh token
		this.loadRefreshToken();
	}

	// ============================================
	// IPC INTERFACE
	// ============================================

	listen(_: unknown, event: string): Event<any> {
		if (event === 'onAuthStateChange') {
			return this._onAuthStateChange.event;
		}
		throw new Error(`Event not supported: ${event}`);
	}

	async call(_ctx: any, command: string, params?: any): Promise<any> {
		try {
			switch (command) {
				// Configuration
				case 'getConfig':
					console.log('[DocuSignChannel] IPC Call: getConfig');
					return this.getConfig();
				case 'hasBundledKey':
					console.log('[DocuSignChannel] IPC Call: hasBundledKey');
					return !!DOCUSIGN_INTEGRATION_KEY;
				case 'isEncryptionAvailable':
					return safeStorage.isEncryptionAvailable();

				// OAuth Authentication
				case 'exchangeAuthCode':
					return this.exchangeAuthCode(params);

				// Key management
				// storePrivateKey, clearPrivateKey, validatePrivateKey removed as they are JWT specific

				// JWT Authentication
				case 'getAccessToken':
					console.log('[DocuSignChannel] IPC Call: getAccessToken');
					return this.getAccessToken(params);
				case 'getConsentUrl':
					console.log('[DocuSignChannel] IPC Call: getConsentUrl with params:', JSON.stringify(params));
					const url = this.getConsentUrl(params);
					console.log('[DocuSignChannel] Generated Consent URL:', url);
					return url;

				// Envelope operations
				case 'createEnvelope':
					return this.createEnvelope(params);
				case 'sendEnvelope':
					return this.sendEnvelope(params.envelopeId);
				case 'getEnvelope':
					return this.getEnvelope(params.envelopeId);
				case 'getEnvelopeStatus':
					return this.getEnvelopeStatus(params.envelopeId);
				case 'listEnvelopes':
					return this.listEnvelopes(params?.fromDate);
				case 'voidEnvelope':
					return this.voidEnvelope(params.envelopeId, params.reason);
				case 'downloadSignedDocument':
					return this.downloadSignedDocument(params.envelopeId, params.documentId);

				// User info
				case 'getUserInfo':
					return this.getUserInfo();

				// Sign out
				case 'signOut':
					return this.signOut();

				default:
					throw new Error(`Unknown command: ${command}`);
			}
		} catch (error) {
			console.error(`[DocuSignChannel] Error in ${command}:`, error);
			throw error;
		}
	}

	// ============================================
	// CONFIGURATION METHODS
	// ============================================

	private getConfig(): {
		integrationKey: string;
		environment: 'demo' | 'production';
		privateKeyConfigured: boolean;
		authMode: string;
	} {
		console.log('[DocuSignChannel] Getting config');
		console.log('[DocuSignChannel] Config: integrationKey=%s, environment=%s',
			DOCUSIGN_INTEGRATION_KEY ? 'SET' : 'NOT SET',
			DOCUSIGN_ENVIRONMENT
		);
		return {
			integrationKey: DOCUSIGN_INTEGRATION_KEY,
			environment: DOCUSIGN_ENVIRONMENT,
			privateKeyConfigured: this.hasRefreshToken(), // Reuse field to indicate "configured"
			authMode: 'oauth',
		};
	}

	// ============================================
	// PRIVATE KEY MANAGEMENT (Removed)
	// ============================================
	// Methods removed as they are no longer used in OAuth flow.



	// ============================================
	// REFRESH TOKEN MANAGEMENT
	// ============================================

	private hasRefreshToken(): boolean {
		return !!this.cachedToken?.refreshToken;
	}

	private loadRefreshToken(): void {
		try {
			// Try loading from encrypted storage
			if (this.keyStoragePath && safeStorage.isEncryptionAvailable()) {
				const encryptedPath = path.join(this.keyStoragePath, `${REFRESH_TOKEN_STORAGE_KEY}.enc`);
				if (fs.existsSync(encryptedPath)) {
					const encrypted = fs.readFileSync(encryptedPath);
					const decrypted = safeStorage.decryptString(encrypted);
					const tokenData = JSON.parse(decrypted);

					// Restore cached token
					this.cachedToken = tokenData;
					console.log('[DocuSignChannel] Loaded refresh token from encrypted storage');

					// Check if we need to refresh immediately
					if (tokenData.expiresAt < Date.now()) {
						console.log('[DocuSignChannel] Token expired, will refresh on next use');
					}

					this._onAuthStateChange.fire({ status: 'signed_in', user: tokenData.user });
					return;
				}
			}
		} catch (error) {
			console.error('[DocuSignChannel] Error loading refresh token:', error);
		}
	}

	private async storeRefreshToken(token: CachedToken): Promise<void> {
		try {
			this.cachedToken = token;

			// Check if encryption is available
			if (!safeStorage.isEncryptionAvailable()) {
				console.warn('[DocuSignChannel] System encryption not available. Token stored in memory only.');
				return;
			}

			// Ensure storage directory exists
			if (this.keyStoragePath) {
				if (!fs.existsSync(this.keyStoragePath)) {
					fs.mkdirSync(this.keyStoragePath, { recursive: true });
				}

				// Encrypt and store the entire token object
				const encrypted = safeStorage.encryptString(JSON.stringify(token));
				const encryptedPath = path.join(this.keyStoragePath, `${REFRESH_TOKEN_STORAGE_KEY}.enc`);
				fs.writeFileSync(encryptedPath, encrypted);

				console.log('[DocuSignChannel] Refresh token stored securely');
			}
		} catch (error) {
			console.error('[DocuSignChannel] Error storing refresh token:', error);
		}
	}

	private async clearRefreshToken(): Promise<void> {
		this.cachedToken = null;

		// Remove from storage
		if (this.keyStoragePath) {
			const encryptedPath = path.join(this.keyStoragePath, `${REFRESH_TOKEN_STORAGE_KEY}.enc`);
			if (fs.existsSync(encryptedPath)) {
				fs.unlinkSync(encryptedPath);
			}
		}
	}

	// ============================================
	// OAUTH AUTHENTICATION
	// ============================================

	private async exchangeAuthCode(params: { authCode: string; redirectUri: string }): Promise<void> {
		console.log('[DocuSignChannel] Exchanging auth code for token...');

		if (!DOCUSIGN_INTEGRATION_KEY || !DOCUSIGN_CLIENT_SECRET) {
			throw new Error('DocuSign Integration Key or Client Secret not configured');
		}

		try {
			console.log('[DocuSignChannel] exchangeAuthCode params:', JSON.stringify(params));
			const basePaths = BASE_PATHS[DOCUSIGN_ENVIRONMENT];
			console.log('[DocuSignChannel] Using base path:', basePaths.oAuth);
			const apiClient = new docusign.ApiClient();
			apiClient.setOAuthBasePath(basePaths.oAuth);

			// Exchange code for token
			const response = await (apiClient as any).generateAccessToken(
				DOCUSIGN_INTEGRATION_KEY,
				DOCUSIGN_CLIENT_SECRET,
				params.authCode
			);

			if (!response || !response.body) {
				throw new Error('Invalid response from DocuSign');
			}

			const { access_token, refresh_token, expires_in } = response.body as any;

			// Get user info
			apiClient.addDefaultHeader('Authorization', `Bearer ${access_token}`);
			const userInfo = await apiClient.getUserInfo(access_token);
			const account = userInfo.accounts?.find((a: any) => a.isDefault === 'true') || userInfo.accounts?.[0];

			if (!account) {
				throw new Error('No DocuSign account found for this user');
			}

			// Create token object
			const token: CachedToken = {
				accessToken: access_token,
				refreshToken: refresh_token,
				expiresAt: Date.now() + (expires_in * 1000) - 60000, // 1 min buffer
				accountId: account.accountId,
				baseUri: account.baseUri,
				user: {
					userId: userInfo.sub,
					email: userInfo.email,
					name: userInfo.name,
				},
			};

			// Store it
			await this.storeRefreshToken(token);

			this._onAuthStateChange.fire({ status: 'signed_in', user: token.user });
			console.log(`[DocuSignChannel] Successfully signed in as ${token.user.email}`);

		} catch (error: any) {
			console.error('[DocuSignChannel] OAuth exchange failed:', error);
			this._onAuthStateChange.fire({
				status: 'error',
				user: null,
				error: error.message || 'Authentication failed'
			});
			throw error;
		}
	}

	private async refreshAccessToken(): Promise<CachedToken> {
		if (!this.cachedToken || !this.cachedToken.refreshToken) {
			throw new Error('No refresh token available');
		}

		console.log('[DocuSignChannel] Refreshing access token...');

		try {
			const basePaths = BASE_PATHS[DOCUSIGN_ENVIRONMENT];
			const apiClient = new docusign.ApiClient();
			apiClient.setOAuthBasePath(basePaths.oAuth);

			const response = await (apiClient as any).refreshAccessToken(
				DOCUSIGN_INTEGRATION_KEY,
				DOCUSIGN_CLIENT_SECRET,
				this.cachedToken.refreshToken
			);

			const { access_token, refresh_token, expires_in } = response.body as any;

			// Update token
			const updatedToken: CachedToken = {
				...this.cachedToken,
				accessToken: access_token,
				refreshToken: refresh_token || this.cachedToken.refreshToken, // Use new one if provided
				expiresAt: Date.now() + (expires_in * 1000) - 60000,
			};

			await this.storeRefreshToken(updatedToken);
			return updatedToken;

		} catch (error: any) {
			console.error('[DocuSignChannel] Token refresh failed:', error);
			// On fatal refresh errors, clear session
			if (error.response?.status === 400 || error.message?.includes('invalid_grant')) {
				await this.signOut();
			}
			throw error;
		}
	}


	// ============================================
	// JWT AUTHENTICATION
	// ============================================

	private async getAccessToken(_params?: any): Promise<CachedToken> {

		// Check if cached token is still valid
		if (this.cachedToken) {
			const expiresIn = this.cachedToken.expiresAt - Date.now();
			if (expiresIn > TOKEN_REFRESH_BUFFER_MS) {
				return this.cachedToken;
			}

			// Try to refresh
			if (this.cachedToken.refreshToken) {
				try {
					return await this.refreshAccessToken();
				} catch (error) {
					console.warn('[DocuSignChannel] Token refresh failed in getAccessToken, requiring re-login', error);
				}
			}
		}

		this._onAuthStateChange.fire({ status: 'signed_out', user: null });
		throw new Error('No valid session. Please sign in to DocuSign.');
	}


	private getConsentUrl(params: {
		integrationKey?: string;
		environment?: 'demo' | 'production';
		redirectUri: string;
	}): string {
		const integrationKey = params.integrationKey || DOCUSIGN_INTEGRATION_KEY;
		const environment = params.environment || DOCUSIGN_ENVIRONMENT;
		const basePaths = BASE_PATHS[environment];

		console.log('[DocuSignChannel] getConsentUrl environment:', environment);
		console.log('[DocuSignChannel] getConsentUrl integrationKey:', integrationKey);
		console.log('[DocuSignChannel] getConsentUrl redirectUri:', params.redirectUri);

		const url = new URL(`https://${basePaths.oAuth}/oauth/auth`);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('scope', 'signature'); // removed impersonation
		url.searchParams.set('client_id', integrationKey);
		url.searchParams.set('redirect_uri', params.redirectUri);

		return url.toString();
	}

	private async signOut(): Promise<void> {
		this.cachedToken = null;
		await this.clearRefreshToken();
		this._onAuthStateChange.fire({ status: 'signed_out', user: null });
		console.log('[DocuSignChannel] Signed out');
	}

	private async getUserInfo(): Promise<IDocuSignUser | null> {
		if (!this.cachedToken) {
			return null;
		}
		return this.cachedToken.user;
	}

	// ============================================
	// ENVELOPE OPERATIONS
	// ============================================

	private async getApiClient(): Promise<{ client: ApiClient; accountId: string }> {
		// Check token expiration and refresh if needed
		if (this.cachedToken && this.cachedToken.refreshToken) {
			const expiresIn = this.cachedToken.expiresAt - Date.now();
			if (expiresIn < TOKEN_REFRESH_BUFFER_MS) {
				console.log(`[DocuSignChannel] Token expiring soon (in ${Math.round(expiresIn / 1000)}s), refreshing...`);
				try {
					await this.refreshAccessToken();
				} catch (error) {
					console.error('[DocuSignChannel] Failed to refresh token, attempting to use existing token:', error);
				}
			}
		}

		const token = await this.getAccessToken({});

		const apiClient = new docusign.ApiClient();
		apiClient.setBasePath(`${token.baseUri}/restapi`);
		apiClient.addDefaultHeader('Authorization', `Bearer ${token.accessToken}`);

		return { client: apiClient, accountId: token.accountId };
	}

	private async createEnvelope(request: IDocuSignEnvelopeCreateRequest): Promise<IDocuSignEnvelopeCreateResponse> {
		const { client, accountId } = await this.getApiClient();
		const envelopesApi = new docusign.EnvelopesApi(client);

		// Build envelope definition
		const envelopeDefinition: EnvelopeDefinition = {
			emailSubject: request.emailSubject,
			emailBlurb: request.emailBlurb,
			status: request.status,
			documents: request.documents.map((doc, index) => ({
				documentBase64: doc.documentBase64,
				name: doc.name,
				fileExtension: doc.fileExtension,
				documentId: doc.documentId || String(index + 1),
			})),
			recipients: {
				signers: request.recipients
					.filter(r => r.role === 'signer')
					.map((r, index) => ({
						email: r.email,
						name: r.name,
						recipientId: String(index + 1),
						routingOrder: String(r.routingOrder || (index + 1)),
						tabs: {
							signHereTabs: [{
								anchorString: '/sig/',
								anchorUnits: 'pixels',
								anchorXOffset: '0',
								anchorYOffset: '0',
							}],
						},
					})),
				carbonCopies: request.recipients
					.filter(r => r.role === 'carbonCopy')
					.map((r, index) => ({
						email: r.email,
						name: r.name,
						recipientId: String(100 + index),
						routingOrder: String(r.routingOrder || (index + 1)),
					})),
			},
		};

		console.log('[DocuSignChannel] Creating envelope:', request.emailSubject);

		const result = await envelopesApi.createEnvelope(accountId, { envelopeDefinition });

		console.log('[DocuSignChannel] Envelope created:', result.envelopeId);

		return {
			envelopeId: result.envelopeId!,
			uri: result.uri!,
			statusDateTime: result.statusDateTime!,
			status: result.status as any,
		};
	}

	private async sendEnvelope(envelopeId: string): Promise<void> {
		const { client, accountId } = await this.getApiClient();
		const envelopesApi = new docusign.EnvelopesApi(client);

		await envelopesApi.update(accountId, envelopeId, {
			envelope: { status: 'sent' },
		});

		console.log('[DocuSignChannel] Envelope sent:', envelopeId);
	}

	private async getEnvelope(envelopeId: string): Promise<IDocuSignEnvelope> {
		const { client, accountId } = await this.getApiClient();
		const envelopesApi = new docusign.EnvelopesApi(client);

		const result = await envelopesApi.getEnvelope(accountId, envelopeId, {
			include: 'recipients,documents',
		});

		return {
			envelopeId: result.envelopeId!,
			emailSubject: result.emailSubject!,
			emailBlurb: result.emailBlurb,
			status: result.status as any,
			createdDateTime: result.createdDateTime!,
			sentDateTime: result.sentDateTime,
			completedDateTime: result.completedDateTime,
			expireDateTime: result.expireDateTime,
			recipients: [
				...((result.recipients?.signers || []).map((s: any) => ({
					recipientId: s.recipientId,
					email: s.email,
					name: s.name,
					role: 'signer' as const,
					routingOrder: parseInt(s.routingOrder, 10),
					status: s.status,
					signedDateTime: s.signedDateTime,
					deliveredDateTime: s.deliveredDateTime,
				}))),
				...((result.recipients?.carbonCopies || []).map((c: any) => ({
					recipientId: c.recipientId,
					email: c.email,
					name: c.name,
					role: 'carbonCopy' as const,
					routingOrder: parseInt(c.routingOrder, 10),
					status: c.status,
				}))),
			],
			documents: (result.envelopeDocuments || []).map((d: any) => ({
				documentId: d.documentId,
				name: d.name,
				fileExtension: d.type,
				order: parseInt(d.order, 10),
				pages: d.pages ? parseInt(d.pages, 10) : undefined,
			})),
		};
	}

	private async getEnvelopeStatus(envelopeId: string): Promise<string> {
		const { client, accountId } = await this.getApiClient();
		const envelopesApi = new docusign.EnvelopesApi(client);

		const result = await envelopesApi.getEnvelope(accountId, envelopeId);
		return result.status!;
	}

	private async listEnvelopes(fromDate?: string): Promise<IDocuSignEnvelopeSummary[]> {
		const { client, accountId } = await this.getApiClient();
		const envelopesApi = new docusign.EnvelopesApi(client);

		const from = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

		const result = await envelopesApi.listStatusChanges(accountId, {
			fromDate: from,
		});

		return (result.envelopes || []).map((e: any) => ({
			envelopeId: e.envelopeId,
			emailSubject: e.emailSubject,
			status: e.status,
			createdDateTime: e.createdDateTime,
			sentDateTime: e.sentDateTime,
			completedDateTime: e.completedDateTime,
			recipientCount: parseInt(e.recipientsCount || '0', 10),
			documentCount: parseInt(e.documentsCount || '0', 10),
		}));
	}

	private async voidEnvelope(envelopeId: string, reason: string): Promise<void> {
		const { client, accountId } = await this.getApiClient();
		const envelopesApi = new docusign.EnvelopesApi(client);

		await envelopesApi.update(accountId, envelopeId, {
			envelope: {
				status: 'voided',
				voidedReason: reason,
			},
		});

		console.log('[DocuSignChannel] Envelope voided:', envelopeId);
	}

	private async downloadSignedDocument(envelopeId: string, documentId: string = 'combined'): Promise<Uint8Array> {
		const { client, accountId } = await this.getApiClient();
		const envelopesApi = new docusign.EnvelopesApi(client);

		const result = await envelopesApi.getDocument(accountId, envelopeId, documentId);

		// Result is a base64-encoded string or buffer
		if (typeof result === 'string') {
			return new Uint8Array(Buffer.from(result, 'base64'));
		}
		return new Uint8Array(result);
	}

	// ============================================
	// CLEANUP
	// ============================================

	dispose(): void {
		this._onAuthStateChange.dispose();
	}
}
