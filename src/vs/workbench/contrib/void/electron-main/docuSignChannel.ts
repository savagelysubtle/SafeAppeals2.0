/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import { safeStorage } from 'electron';
import * as fs from 'fs';
import { createRequire } from 'node:module';
import * as path from 'path';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import {
	DocuSignConsentStatus,
	IDocuSignEnvelope,
	IDocuSignEnvelopeCreateRequest,
	IDocuSignEnvelopeCreateResponse,
	IDocuSignEnvelopeSummary,
	IDocuSignUser,
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

// Read bundled DocuSign config from environment
const DOCUSIGN_INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY || '';
const DOCUSIGN_ENVIRONMENT = (process.env.DOCUSIGN_ENVIRONMENT as 'demo' | 'production') || 'demo';
// Support both DOCUSIGN_USER_ID and DOCUSIGN_SERVICE_USER_ID
const DOCUSIGN_USER_ID = process.env.DOCUSIGN_USER_ID || process.env.DOCUSIGN_SERVICE_USER_ID || '';
const DOCUSIGN_PRIVATE_KEY_PATH = process.env.DOCUSIGN_PRIVATE_KEY_PATH || '';
const DOCUSIGN_KEYPAIR_ID = process.env.DOCUSIGN_KEYPAIR_ID || process.env.DOCUSIGN_KEPYPAIR_ID || '';

// Token refresh settings
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry
const JWT_LIFETIME_SECONDS = 3600; // 1 hour max

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
const PRIVATE_KEY_STORAGE_KEY = 'docusign_private_key';

// Log at module load time for debugging
console.log('[DocuSignChannel] Module loaded');
console.log('[DocuSignChannel] DOCUSIGN_INTEGRATION_KEY from env:', DOCUSIGN_INTEGRATION_KEY ? `${DOCUSIGN_INTEGRATION_KEY.substring(0, 8)}...` : 'NOT SET');
console.log('[DocuSignChannel] DOCUSIGN_ENVIRONMENT from env:', DOCUSIGN_ENVIRONMENT);
console.log('[DocuSignChannel] DOCUSIGN_USER_ID from env:', DOCUSIGN_USER_ID ? `${DOCUSIGN_USER_ID.substring(0, 8)}...` : 'NOT SET');
console.log('[DocuSignChannel] DOCUSIGN_KEYPAIR_ID from env:', DOCUSIGN_KEYPAIR_ID ? `${DOCUSIGN_KEYPAIR_ID.substring(0, 8)}...` : 'NOT SET');

// ============================================
// TYPES
// ============================================

export interface IDocuSignConfig {
	integrationKey: string;
	environment: 'demo' | 'production';
	userId?: string;
	privateKeyConfigured?: boolean;
}

interface CachedToken {
	accessToken: string;
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
	private privateKey: Buffer | null = null;
	private keyStoragePath: string = '';

	// Events
	private readonly _onAuthStateChange = new Emitter<AuthStateEvent>();

	constructor(appDataPath?: string) {
		// Set up key storage path
		if (appDataPath) {
			this.keyStoragePath = path.join(appDataPath, 'docusign');
		}

		// Try to load private key from environment or stored location
		this.loadPrivateKey();
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
					return this.getConfig();
				case 'hasBundledKey':
					return !!DOCUSIGN_INTEGRATION_KEY;
				case 'hasPrivateKey':
					return this.hasPrivateKey();
				case 'isEncryptionAvailable':
					return safeStorage.isEncryptionAvailable();

				// Key management
				case 'storePrivateKey':
					return this.storePrivateKey(params.privateKey);
				case 'clearPrivateKey':
					return this.clearPrivateKey();
				case 'validatePrivateKey':
					return this.validatePrivateKey(params.privateKey);

				// JWT Authentication
				case 'getAccessToken':
					return this.getAccessToken(params);
				case 'checkConsent':
					return this.checkConsent(params);
				case 'getConsentUrl':
					return this.getConsentUrl(params);

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

	private async getConfig(): Promise<IDocuSignConfig> {
		console.log('[DocuSignChannel] Getting config');
		console.log('[DocuSignChannel] Config: integrationKey=%s, environment=%s, userId=%s, privateKey=%s',
			DOCUSIGN_INTEGRATION_KEY ? 'SET' : 'NOT SET',
			DOCUSIGN_ENVIRONMENT,
			DOCUSIGN_USER_ID ? 'SET' : 'NOT SET',
			this.hasPrivateKey() ? 'SET' : 'NOT SET'
		);
		return {
			integrationKey: DOCUSIGN_INTEGRATION_KEY,
			environment: DOCUSIGN_ENVIRONMENT,
			userId: DOCUSIGN_USER_ID || undefined,
			privateKeyConfigured: this.hasPrivateKey(),
		};
	}

	// ============================================
	// PRIVATE KEY MANAGEMENT
	// ============================================

	private hasPrivateKey(): boolean {
		return this.privateKey !== null && this.privateKey.length > 0;
	}

	private loadPrivateKey(): void {
		try {
			// First, try loading from environment variable path
			if (DOCUSIGN_PRIVATE_KEY_PATH && fs.existsSync(DOCUSIGN_PRIVATE_KEY_PATH)) {
				this.privateKey = fs.readFileSync(DOCUSIGN_PRIVATE_KEY_PATH);
				console.log('[DocuSignChannel] Loaded private key from env path');
				return;
			}

			// Try loading from inline environment variable
			const envKey = process.env.DOCUSIGN_PRIVATE_KEY;
			if (envKey) {
				const keyContent = this.normalizePrivateKey(envKey);
				this.privateKey = Buffer.from(keyContent);
				console.log('[DocuSignChannel] Loaded private key from env inline');
				return;
			}

			// Try loading from encrypted storage
			if (this.keyStoragePath && safeStorage.isEncryptionAvailable()) {
				const encryptedPath = path.join(this.keyStoragePath, `${PRIVATE_KEY_STORAGE_KEY}.enc`);
				if (fs.existsSync(encryptedPath)) {
					const encrypted = fs.readFileSync(encryptedPath);
					const decrypted = safeStorage.decryptString(encrypted);
					this.privateKey = Buffer.from(decrypted);
					console.log('[DocuSignChannel] Loaded private key from encrypted storage');
					return;
				}
			}

			console.log('[DocuSignChannel] No private key found');
		} catch (error) {
			console.error('[DocuSignChannel] Error loading private key:', error);
		}
	}

	/**
	 * Normalize a private key to proper PEM format.
	 * Handles raw base64 keys (without headers), keys with \n escapes,
	 * and converts PKCS#1 (RSA PRIVATE KEY) to PKCS#8 (PRIVATE KEY) format.
	 */
	private normalizePrivateKey(key: string): string {
		// Debug: log first 50 chars to understand the input format
		console.log('[DocuSignChannel] normalizePrivateKey input (first 100 chars):', key.substring(0, 100));
		console.log('[DocuSignChannel] Key length:', key.length);

		// Strip surrounding quotes that dotenv might include
		let normalized = key.trim();
		if ((normalized.startsWith('"') && normalized.endsWith('"')) ||
			(normalized.startsWith("'") && normalized.endsWith("'"))) {
			normalized = normalized.slice(1, -1);
		}

		// Handle literal \n escape sequences (when dotenv doesn't expand them)
		normalized = normalized.replace(/\\n/g, '\n');

		// Handle Windows line endings
		normalized = normalized.replace(/\r\n/g, '\n');
		normalized = normalized.replace(/\r/g, '\n');

		// Trim again after conversions
		normalized = normalized.trim();

		console.log('[DocuSignChannel] After normalization, has BEGIN PRIVATE KEY:', normalized.includes('-----BEGIN PRIVATE KEY-----'));
		console.log('[DocuSignChannel] After normalization, has BEGIN RSA PRIVATE KEY:', normalized.includes('-----BEGIN RSA PRIVATE KEY-----'));

		// Check if already in PKCS#8 format
		if (normalized.includes('-----BEGIN PRIVATE KEY-----')) {
			console.log('[DocuSignChannel] Key is already PKCS#8');
			return normalized.endsWith('\n') ? normalized : normalized + '\n';
		}

		// Convert PKCS#1 (RSA PRIVATE KEY) to PKCS#8 format
		if (normalized.includes('-----BEGIN RSA PRIVATE KEY-----')) {
			console.log('[DocuSignChannel] Key is PKCS#1, attempting conversion to PKCS#8...');
			try {
				const privateKeyObject = crypto.createPrivateKey({
					key: normalized,
					format: 'pem',
					type: 'pkcs1'
				});
				const pkcs8Key = privateKeyObject.export({ type: 'pkcs8', format: 'pem' }) as string;
				console.log('[DocuSignChannel] Successfully converted PKCS#1 key to PKCS#8 format');
				return pkcs8Key;
			} catch (err) {
				console.error('[DocuSignChannel] Failed to convert PKCS#1 to PKCS#8:', err);
				console.error('[DocuSignChannel] Key structure check - starts with:', normalized.substring(0, 50));
				console.error('[DocuSignChannel] Key structure check - ends with:', normalized.substring(normalized.length - 50));

				// Try alternative: extract base64 and reconstruct
				try {
					console.log('[DocuSignChannel] Attempting base64 extraction fallback...');
					const base64Match = normalized.match(/-----BEGIN RSA PRIVATE KEY-----\s*([\s\S]*?)\s*-----END RSA PRIVATE KEY-----/);
					if (base64Match && base64Match[1]) {
						const base64Content = base64Match[1].replace(/\s+/g, '');
						const reconstructedPem = `-----BEGIN RSA PRIVATE KEY-----\n${base64Content.match(/.{1,64}/g)?.join('\n')}\n-----END RSA PRIVATE KEY-----\n`;
						console.log('[DocuSignChannel] Reconstructed PEM, retrying conversion...');
						const privateKeyObject2 = crypto.createPrivateKey(reconstructedPem);
						const pkcs8Key2 = privateKeyObject2.export({ type: 'pkcs8', format: 'pem' }) as string;
						console.log('[DocuSignChannel] Fallback conversion succeeded!');
						return pkcs8Key2;
					}
				} catch (fallbackErr) {
					console.error('[DocuSignChannel] Fallback conversion also failed:', fallbackErr);
				}
				// Fall through to return as-is
			}
		}

		// If has any BEGIN header, return as-is
		if (normalized.includes('-----BEGIN')) {
			return normalized.endsWith('\n') ? normalized : normalized + '\n';
		}

		// Raw base64 - wrap with PKCS#8 headers
		// Remove any whitespace/newlines from the raw key
		const rawBase64 = normalized.replace(/\s+/g, '');

		// Format with 64-char line width (PEM standard)
		const lines: string[] = [];
		for (let i = 0; i < rawBase64.length; i += 64) {
			lines.push(rawBase64.substring(i, i + 64));
		}

		return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
	}

	private async storePrivateKey(privateKey: string): Promise<{ success: boolean; error?: string }> {
		try {
			// Normalize the key first (handles raw base64 and \n escapes)
			const normalizedKey = this.normalizePrivateKey(privateKey);

			// Validate key format
			const validation = this.validatePrivateKey(normalizedKey);
			if (!validation.valid) {
				return { success: false, error: validation.error };
			}

			// Check if encryption is available
			if (!safeStorage.isEncryptionAvailable()) {
				return { success: false, error: 'System encryption not available. On Linux, ensure kwallet or gnome-keyring is configured.' };
			}

			// Ensure storage directory exists
			if (this.keyStoragePath) {
				if (!fs.existsSync(this.keyStoragePath)) {
					fs.mkdirSync(this.keyStoragePath, { recursive: true });
				}

				// Encrypt and store
				const encrypted = safeStorage.encryptString(normalizedKey);
				const encryptedPath = path.join(this.keyStoragePath, `${PRIVATE_KEY_STORAGE_KEY}.enc`);
				fs.writeFileSync(encryptedPath, encrypted);

				// Update in-memory key
				this.privateKey = Buffer.from(normalizedKey);

				console.log('[DocuSignChannel] Private key stored securely');
				return { success: true };
			}

			// Fallback: store in memory only (less secure, lost on restart)
			this.privateKey = Buffer.from(normalizedKey);
			console.warn('[DocuSignChannel] Private key stored in memory only (no persistent storage path)');
			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error('[DocuSignChannel] Error storing private key:', error);
			return { success: false, error: message };
		}
	}

	private async clearPrivateKey(): Promise<void> {
		this.privateKey = null;
		this.cachedToken = null;

		// Remove from storage
		if (this.keyStoragePath) {
			const encryptedPath = path.join(this.keyStoragePath, `${PRIVATE_KEY_STORAGE_KEY}.enc`);
			if (fs.existsSync(encryptedPath)) {
				fs.unlinkSync(encryptedPath);
			}
		}

		this._onAuthStateChange.fire({ status: 'signed_out', user: null });
		console.log('[DocuSignChannel] Private key cleared');
	}

	private validatePrivateKey(privateKey: string): { valid: boolean; error?: string } {
		// Normalize newlines
		const key = privateKey.replace(/\\n/g, '\n').trim();

		// Check for PKCS#8 format (required by DocuSign)
		if (key.includes('-----BEGIN PRIVATE KEY-----')) {
			return { valid: true };
		}

		// Check for PKCS#1 format (needs conversion)
		if (key.includes('-----BEGIN RSA PRIVATE KEY-----')) {
			return {
				valid: false,
				error: 'Private key is in PKCS#1 format. DocuSign requires PKCS#8 format. Convert with: openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in key.pem -out key-pkcs8.pem'
			};
		}

		return { valid: false, error: 'Invalid private key format. Expected PEM format starting with -----BEGIN PRIVATE KEY-----' };
	}

	// ============================================
	// JWT AUTHENTICATION
	// ============================================

	private async getAccessToken(params: {
		integrationKey?: string;
		userId?: string;
		environment?: 'demo' | 'production';
	}): Promise<CachedToken> {
		const integrationKey = params.integrationKey || DOCUSIGN_INTEGRATION_KEY;
		const userId = params.userId || DOCUSIGN_USER_ID;
		const environment = params.environment || DOCUSIGN_ENVIRONMENT;

		// Check if cached token is still valid
		if (this.cachedToken) {
			const expiresIn = this.cachedToken.expiresAt - Date.now();
			if (expiresIn > TOKEN_REFRESH_BUFFER_MS) {
				console.log(`[DocuSignChannel] Using cached token (expires in ${Math.round(expiresIn / 1000)}s)`);
				return this.cachedToken;
			}
		}

		// Validate configuration
		if (!integrationKey) {
			throw new Error('DocuSign Integration Key not configured');
		}
		if (!userId) {
			throw new Error('DocuSign User ID not configured');
		}
		if (!this.privateKey) {
			throw new Error('DocuSign private key not configured');
		}

		this._onAuthStateChange.fire({ status: 'signing_in', user: null });

		try {
			const basePaths = BASE_PATHS[environment];
			const apiClient = new docusign.ApiClient();
			apiClient.setOAuthBasePath(basePaths.oAuth);

			console.log('[DocuSignChannel] Requesting JWT token...');

			// Request JWT token
			const result = await apiClient.requestJWTUserToken(
				integrationKey,
				userId,
				['signature'], // impersonation scope is implicit in JWT Grant
				this.privateKey,
				JWT_LIFETIME_SECONDS
			);

			if (!result.body || !result.body.access_token) {
				throw new Error('Invalid token response from DocuSign');
			}

			// Get user info and account details
			apiClient.addDefaultHeader('Authorization', `Bearer ${result.body.access_token}`);
			const userInfoResult = await apiClient.getUserInfo(result.body.access_token);

			// Find default account
			const defaultAccount = userInfoResult.accounts?.find((a: any) => a.isDefault === 'true') || userInfoResult.accounts?.[0];
			if (!defaultAccount) {
				throw new Error('No DocuSign account found for this user');
			}

			// Create cached token
			this.cachedToken = {
				accessToken: result.body.access_token,
				expiresAt: Date.now() + (result.body.expires_in * 1000) - 60000, // 1 min buffer
				accountId: defaultAccount.accountId,
				baseUri: defaultAccount.baseUri,
				user: {
					userId: userInfoResult.sub,
					email: userInfoResult.email,
					name: userInfoResult.name,
				},
			};

			console.log(`[DocuSignChannel] JWT token obtained (expires in ${result.body.expires_in}s, account: ${this.cachedToken.accountId})`);

			this._onAuthStateChange.fire({ status: 'signed_in', user: this.cachedToken.user });

			return this.cachedToken;
		} catch (error: any) {
			console.error('[DocuSignChannel] JWT authentication failed:', error);

			// Check for consent_required error
			if (error.message?.includes('consent_required') || error.response?.body?.error === 'consent_required') {
				this._onAuthStateChange.fire({
					status: 'error',
					user: null,
					error: 'consent_required'
				});
				throw new Error('consent_required: User must grant consent before using JWT authentication');
			}

			this._onAuthStateChange.fire({
				status: 'error',
				user: null,
				error: error.message || 'Authentication failed'
			});
			throw error;
		}
	}

	private async checkConsent(params: {
		integrationKey?: string;
		userId?: string;
		environment?: 'demo' | 'production';
	}): Promise<DocuSignConsentStatus> {
		try {
			await this.getAccessToken(params);
			return 'granted';
		} catch (error: any) {
			if (error.message?.includes('consent_required')) {
				return 'required';
			}
			return 'error';
		}
	}

	private getConsentUrl(params: {
		integrationKey?: string;
		environment?: 'demo' | 'production';
		redirectUri: string;
	}): string {
		const integrationKey = params.integrationKey || DOCUSIGN_INTEGRATION_KEY;
		const environment = params.environment || DOCUSIGN_ENVIRONMENT;
		const basePaths = BASE_PATHS[environment];

		const url = new URL(`https://${basePaths.oAuth}/oauth/auth`);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('scope', 'signature impersonation');
		url.searchParams.set('client_id', integrationKey);
		url.searchParams.set('redirect_uri', params.redirectUri);

		return url.toString();
	}

	private async signOut(): Promise<void> {
		this.cachedToken = null;
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
