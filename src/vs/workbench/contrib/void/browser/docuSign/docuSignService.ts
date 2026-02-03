/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { IEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { INativeHostService } from '../../../../../platform/native/common/native.js';
import { INotificationService, Severity } from '../../../../../platform/notification/common/notification.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import {
	DocuSignAuthChangeEvent,
	DocuSignAuthStatus,
	DocuSignConsentStatus,
	DocuSignEnvelopeStatus,
	DocuSignEnvelopeStatusChangeEvent,
	IDocuSignAuthState,
	IDocuSignEnvelope,
	IDocuSignEnvelopeCreateRequest,
	IDocuSignEnvelopeCreateResponse,
	IDocuSignEnvelopeSummary,
	IDocuSignRecipientInput,
	IDocuSignUser,
} from '../../common/docuSign/docuSignTypes.js';
import { IMetricsService } from '../../common/metricsService.js';
import { IVoidSettingsService } from '../../common/voidSettingsService.js';

// Storage keys
const DOCUSIGN_ENVELOPE_CACHE_KEY = 'void.docusign.envelopes';

// Polling interval for envelope status checks
const POLLING_INTERVAL_MS = 30000; // 30 second polling interval

// ============================================
// SERVICE INTERFACE
// ============================================

export interface IDocuSignService {
	readonly _serviceBrand: undefined;

	// Auth state
	readonly authState: IDocuSignAuthState;
	readonly onAuthStateChange: Event<DocuSignAuthChangeEvent>;

	// Envelope status events
	readonly onEnvelopeStatusChange: Event<DocuSignEnvelopeStatusChangeEvent>;

	// Auth methods
	signIn(): Promise<void>;
	signOut(): Promise<void>;
	refreshSession(): Promise<boolean>;
	handleAuthError(error: string): void;
	handleConsentGranted(): Promise<void>;

	// Legacy OAuth methods (for backward compatibility)
	exchangeCodeForSession(code: string): Promise<void>;

	// JWT-specific methods
	checkConsent(): Promise<DocuSignConsentStatus>;
	openConsentPage(): Promise<void>;
	storePrivateKey(privateKey: string): Promise<{ success: boolean; error?: string }>;
	hasPrivateKey(): Promise<boolean>;

	// Envelope methods
	createEnvelope(request: IDocuSignEnvelopeCreateRequest): Promise<IDocuSignEnvelopeCreateResponse>;
	sendEnvelope(envelopeId: string): Promise<void>;
	getEnvelope(envelopeId: string): Promise<IDocuSignEnvelope>;
	getEnvelopeStatus(envelopeId: string): Promise<DocuSignEnvelopeStatus>;
	listEnvelopes(fromDate?: Date): Promise<IDocuSignEnvelopeSummary[]>;
	downloadSignedDocument(envelopeId: string, documentId?: string): Promise<Uint8Array>;
	voidEnvelope(envelopeId: string, reason: string): Promise<void>;

	// Document tracking
	sendDocumentForSignature(
		documentUri: URI,
		documentBase64: string,
		recipients: IDocuSignRecipientInput[],
		emailSubject: string,
		emailBlurb?: string
	): Promise<string>;
	getEnvelopeForDocument(documentUri: URI): Promise<IDocuSignEnvelope | null>;

	// Utility
	isSignedIn(): boolean;
	getEnvironment(): 'demo' | 'production';

	// Bundled key support
	setBundledIntegrationKey(key: string): void;
	hasBundledIntegrationKey(): boolean;
	isUsingCustomKey(): boolean;
	readonly onBundledConfigLoaded: Event<boolean>;
}

export const IDocuSignService = createDecorator<IDocuSignService>('docuSignService');

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

class DocuSignService extends Disposable implements IDocuSignService {
	readonly _serviceBrand: undefined;

	private _authState: IDocuSignAuthState = {
		status: 'signed_out',
		session: null,
		error: null,
	};

	private _statusPollingTimer: ReturnType<typeof setTimeout> | null = null;
	private _envelopeIdOfDocumentUri: Map<string, string> = new Map();
	private _pendingEnvelopes: Set<string> = new Set();

	// IPC channel to electron-main
	private _channel: IChannel;

	// Events
	private readonly _onAuthStateChange = this._register(new Emitter<DocuSignAuthChangeEvent>());
	readonly onAuthStateChange = this._onAuthStateChange.event;

	private readonly _onEnvelopeStatusChange = this._register(new Emitter<DocuSignEnvelopeStatusChangeEvent>());
	readonly onEnvelopeStatusChange = this._onEnvelopeStatusChange.event;

	private readonly _onBundledConfigLoaded = this._register(new Emitter<boolean>());
	readonly onBundledConfigLoaded = this._onBundledConfigLoaded.event;

	// Bundled config
	private _bundledIntegrationKey: string = '';
	private _bundledEnvironment: 'demo' | 'production' = 'demo';
	private _bundledUserId: string = '';
	private _privateKeyConfigured: boolean = false;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService,
		@INativeHostService private readonly nativeHostService: INativeHostService,
		@IMetricsService private readonly metricsService: IMetricsService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@INotificationService private readonly notificationService: INotificationService,
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
	) {
		super();
		this._channel = this.mainProcessService.getChannel('void-channel-docusign');
		this._loadEnvelopeCache();
		this._loadBundledConfig();
		this._listenToAuthStateChanges();
	}

	// ============================================
	// INITIALIZATION
	// ============================================

	/**
	 * Load bundled DocuSign config from main process
	 */
	private async _loadBundledConfig(): Promise<void> {
		try {
			const config = await this._channel.call<{
				integrationKey: string;
				environment: 'demo' | 'production';
				userId?: string;
				privateKeyConfigured?: boolean;
			}>('getConfig');

			if (config.integrationKey) {
				this._bundledIntegrationKey = config.integrationKey;
				this._bundledEnvironment = config.environment || 'demo';
				this._bundledUserId = config.userId || '';
				this._privateKeyConfigured = config.privateKeyConfigured || false;
				console.log('[DocuSignService] Bundled config loaded:');
				console.log('  - Integration Key: SET');
				console.log('  - Environment:', this._bundledEnvironment);
				console.log('  - User ID:', this._bundledUserId ? 'SET' : 'NOT SET');
				console.log('  - Private Key:', this._privateKeyConfigured ? 'SET' : 'NOT SET');
			} else {
				console.log('[DocuSignService] No bundled integration key configured');
			}
			this._onBundledConfigLoaded.fire(!!this._bundledIntegrationKey);
		} catch (error) {
			console.warn('[DocuSignService] Failed to load bundled config:', error);
			this._onBundledConfigLoaded.fire(false);
		}
	}

	/**
	 * Listen for auth state changes from main process
	 */
	private _listenToAuthStateChanges(): void {
		try {
			this._register(this._channel.listen<{
				status: DocuSignAuthStatus;
				user: IDocuSignUser | null;
				error?: string;
			}>('onAuthStateChange')(event => {
				this._updateAuthState(event.status, event.user, event.error);
			}));
		} catch (error) {
			// Event listening may not be supported in all cases
			console.warn('[DocuSignService] Could not listen to auth state changes:', error);
		}
	}

	private _updateAuthState(status: DocuSignAuthStatus, user: IDocuSignUser | null, error?: string): void {
		const previousStatus = this._authState.status;

		this._authState = {
			status,
			session: user ? {
				accessToken: '', // Token is managed by main process
				refreshToken: null, // JWT doesn't use refresh tokens
				expiresAt: 0,
				accountId: '',
				baseUri: '',
				user,
				authMethod: 'jwt',
			} : null,
			error: error || null,
		};

		if (previousStatus !== status) {
			this._onAuthStateChange.fire({ status, user });

			this.metricsService.capture('DocuSign Auth State Change', {
				previousStatus,
				newStatus: status,
				hasError: !!error,
				authMethod: 'jwt',
			});
		}
	}

	// ============================================
	// GETTERS
	// ============================================

	get authState(): IDocuSignAuthState {
		return this._authState;
	}

	private get docuSignSettings() {
		return this.settingsService.state.globalSettings.docuSign;
	}

	private get environment(): 'demo' | 'production' {
		if (this.docuSignSettings?.useCustomKey) {
			return this.docuSignSettings?.environment ?? 'production';
		}
		return this._bundledEnvironment;
	}

	private get integrationKey(): string {
		if (this.docuSignSettings?.useCustomKey && this.docuSignSettings?.integrationKey) {
			return this.docuSignSettings.integrationKey;
		}
		return this._bundledIntegrationKey || this.docuSignSettings?.integrationKey || '';
	}

	private get userId(): string {
		return this.docuSignSettings?.userId || this._bundledUserId || '';
	}

	// ============================================
	// PUBLIC API - BUNDLED KEY SUPPORT
	// ============================================

	public setBundledIntegrationKey(key: string): void {
		this._bundledIntegrationKey = key;
		console.log('[DocuSignService] Bundled integration key configured:', key ? 'yes' : 'no');
	}

	public hasBundledIntegrationKey(): boolean {
		return !!this._bundledIntegrationKey;
	}

	public isUsingCustomKey(): boolean {
		return this.docuSignSettings?.useCustomKey ?? false;
	}

	// ============================================
	// AUTH METHODS - JWT FLOW
	// ============================================

	async signIn(): Promise<void> {
		// When using bundled config, all settings come from env vars
		const usingBundled = !this.isUsingCustomKey() && this.hasBundledIntegrationKey();

		if (!usingBundled) {
			// Validate custom configuration
			if (!this.integrationKey) {
				this.notificationService.notify({
					severity: Severity.Error,
					message: 'Please configure your DocuSign Integration Key in Settings.',
				});
				return;
			}

			if (!this.userId) {
				this.notificationService.notify({
					severity: Severity.Error,
					message: 'Please configure your DocuSign User ID in Settings.',
				});
				return;
			}

			// Check if private key is configured (for custom keys)
			const hasKey = await this.hasPrivateKey();
			if (!hasKey) {
				this.notificationService.notify({
					severity: Severity.Error,
					message: 'Please configure your DocuSign private key in Settings.',
				});
				return;
			}
		}

		this._updateAuthState('signing_in', null);

		try {
			// Request access token from main process (JWT flow)
			const result = await this._channel.call<{
				accessToken: string;
				expiresAt: number;
				accountId: string;
				baseUri: string;
				user: IDocuSignUser;
			}>('getAccessToken', {
				integrationKey: this.integrationKey,
				userId: this.userId,
				environment: this.environment,
			});

			this._authState = {
				status: 'signed_in',
				session: {
					accessToken: result.accessToken,
					refreshToken: null,
					expiresAt: result.expiresAt,
					accountId: result.accountId,
					baseUri: result.baseUri,
					user: result.user,
					authMethod: 'jwt',
				},
				error: null,
			};

			this._onAuthStateChange.fire({
				status: 'signed_in',
				user: result.user,
			});

			this.notificationService.notify({
				severity: Severity.Info,
				message: 'Successfully signed in to DocuSign!',
			});

		} catch (error: any) {
			const message = error.message || 'Sign in failed';

			// Check for consent_required error
			if (message.includes('consent_required')) {
				this._updateAuthState('error', null, 'consent_required');
				this.notificationService.notify({
					severity: Severity.Warning,
					message: 'DocuSign requires consent. Please click "Grant Consent" in Settings.',
				});
				return;
			}

			this._updateAuthState('error', null, message);
			this.notificationService.notify({
				severity: Severity.Error,
				message: `DocuSign sign in failed: ${message}`,
			});
		}
	}

	async signOut(): Promise<void> {
		try {
			await this._channel.call('signOut');
		} catch (error) {
			console.error('[DocuSignService] Sign out error:', error);
		}

		this._authState = {
			status: 'signed_out',
			session: null,
			error: null,
		};

		this._onAuthStateChange.fire({
			status: 'signed_out',
			user: null,
		});

		// Stop status polling
		if (this._statusPollingTimer) {
			clearTimeout(this._statusPollingTimer);
			this._statusPollingTimer = null;
		}
	}

	async refreshSession(): Promise<boolean> {
		// For JWT flow, we just get a new token
		try {
			await this.signIn();
			return this._authState.status === 'signed_in';
		} catch {
			return false;
		}
	}

	handleAuthError(error: string): void {
		this._updateAuthState('error', null, error);
	}

	async handleConsentGranted(): Promise<void> {
		// Update consent status in settings
		this.settingsService.setGlobalSetting('docuSign', {
			integrationKey: this.docuSignSettings?.integrationKey || '',
			environment: this.docuSignSettings?.environment || 'demo',
			...this.docuSignSettings,
			consentStatus: 'granted',
		});

		// Try to sign in now that consent is granted
		await this.signIn();
	}

	// Legacy method - for backward compatibility with OAuth flow
	async exchangeCodeForSession(_code: string): Promise<void> {
		// For JWT flow, consent callback doesn't need to exchange code
		// The code just confirms consent was granted
		await this.handleConsentGranted();
	}

	// ============================================
	// JWT-SPECIFIC METHODS
	// ============================================

	async checkConsent(): Promise<DocuSignConsentStatus> {
		try {
			return await this._channel.call<DocuSignConsentStatus>('checkConsent', {
				integrationKey: this.integrationKey,
				userId: this.userId,
				environment: this.environment,
			});
		} catch {
			return 'error';
		}
	}

	async openConsentPage(): Promise<void> {
		const redirectUri = this.environmentService.isBuilt
			? 'safe-appeals-navigator://docusign/consent'
			: 'http://127.0.0.1:3000/docusign/consent';

		const consentUrl = await this._channel.call<string>('getConsentUrl', {
			integrationKey: this.integrationKey,
			environment: this.environment,
			redirectUri,
		});

		await this.nativeHostService.openExternal(consentUrl);

		this.notificationService.notify({
			severity: Severity.Info,
			message: 'Please complete the consent process in your browser.',
		});
	}

	async storePrivateKey(privateKey: string): Promise<{ success: boolean; error?: string }> {
		const result = await this._channel.call<{ success: boolean; error?: string }>('storePrivateKey', {
			privateKey,
		});

		if (result.success) {
			this._privateKeyConfigured = true;
			// Update settings
			this.settingsService.setGlobalSetting('docuSign', {
				integrationKey: this.docuSignSettings?.integrationKey || '',
				environment: this.docuSignSettings?.environment || 'demo',
				...this.docuSignSettings,
				privateKeyConfigured: true,
			});
		}

		return result;
	}

	async hasPrivateKey(): Promise<boolean> {
		try {
			return await this._channel.call<boolean>('hasPrivateKey');
		} catch {
			return false;
		}
	}

	// ============================================
	// ENVELOPE METHODS - VIA IPC
	// ============================================

	async createEnvelope(request: IDocuSignEnvelopeCreateRequest): Promise<IDocuSignEnvelopeCreateResponse> {
		const response = await this._channel.call<IDocuSignEnvelopeCreateResponse>('createEnvelope', request);

		// Track the envelope
		if (request.status === 'sent') {
			this._pendingEnvelopes.add(response.envelopeId);
			this._startStatusPolling();
		}

		this.metricsService.capture('DocuSign Envelope Created', {
			status: request.status,
			recipientCount: request.recipients.length,
			documentCount: request.documents.length,
		});

		return response;
	}

	async sendEnvelope(envelopeId: string): Promise<void> {
		await this._channel.call('sendEnvelope', { envelopeId });
		this._pendingEnvelopes.add(envelopeId);
		this._startStatusPolling();
	}

	async getEnvelope(envelopeId: string): Promise<IDocuSignEnvelope> {
		return await this._channel.call<IDocuSignEnvelope>('getEnvelope', { envelopeId });
	}

	async getEnvelopeStatus(envelopeId: string): Promise<DocuSignEnvelopeStatus> {
		return await this._channel.call<DocuSignEnvelopeStatus>('getEnvelopeStatus', { envelopeId });
	}

	async listEnvelopes(fromDate?: Date): Promise<IDocuSignEnvelopeSummary[]> {
		return await this._channel.call<IDocuSignEnvelopeSummary[]>('listEnvelopes', {
			fromDate: fromDate?.toISOString(),
		});
	}

	async downloadSignedDocument(envelopeId: string, documentId: string = 'combined'): Promise<Uint8Array> {
		const data = await this._channel.call<Uint8Array>('downloadSignedDocument', {
			envelopeId,
			documentId,
		});
		return new Uint8Array(data);
	}

	async voidEnvelope(envelopeId: string, reason: string): Promise<void> {
		await this._channel.call('voidEnvelope', { envelopeId, reason });
		this._pendingEnvelopes.delete(envelopeId);
	}

	// ============================================
	// DOCUMENT TRACKING
	// ============================================

	async sendDocumentForSignature(
		documentUri: URI,
		documentBase64: string,
		recipients: IDocuSignRecipientInput[],
		emailSubject: string,
		emailBlurb?: string
	): Promise<string> {
		const path = documentUri.path;
		const ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
		const fileExtension = (ext === 'docx' || ext === 'pdf' || ext === 'doc') ? ext : 'docx';

		const request: IDocuSignEnvelopeCreateRequest = {
			emailSubject,
			emailBlurb,
			status: 'sent',
			documents: [{
				documentBase64,
				name: path.substring(path.lastIndexOf('/') + 1) || 'document',
				fileExtension: fileExtension as 'docx' | 'pdf' | 'doc',
			}],
			recipients,
		};

		const response = await this.createEnvelope(request);

		// Track document -> envelope mapping
		this._envelopeIdOfDocumentUri.set(documentUri.toString(), response.envelopeId);
		this._saveEnvelopeCache();

		return response.envelopeId;
	}

	async getEnvelopeForDocument(documentUri: URI): Promise<IDocuSignEnvelope | null> {
		const envelopeId = this._envelopeIdOfDocumentUri.get(documentUri.toString());
		if (!envelopeId) {
			return null;
		}

		try {
			return await this.getEnvelope(envelopeId);
		} catch {
			return null;
		}
	}

	// ============================================
	// ENVELOPE CACHE
	// ============================================

	private _loadEnvelopeCache(): void {
		try {
			const cached = this.storageService.get(DOCUSIGN_ENVELOPE_CACHE_KEY, StorageScope.WORKSPACE);
			if (cached) {
				const data = JSON.parse(cached);
				if (data.envelopeIdOfDocumentUri) {
					this._envelopeIdOfDocumentUri = new Map(Object.entries(data.envelopeIdOfDocumentUri));
				}
			}
		} catch (error) {
			console.error('[DocuSignService] Failed to load envelope cache:', error);
		}
	}

	private _saveEnvelopeCache(): void {
		const data = {
			envelopeIdOfDocumentUri: Object.fromEntries(this._envelopeIdOfDocumentUri),
		};
		this.storageService.store(DOCUSIGN_ENVELOPE_CACHE_KEY, JSON.stringify(data), StorageScope.WORKSPACE, StorageTarget.MACHINE);
	}

	// ============================================
	// STATUS POLLING
	// ============================================

	private _startStatusPolling(): void {
		if (this._statusPollingTimer) {
			return;
		}
		this._pollEnvelopeStatuses();
	}

	private async _pollEnvelopeStatuses(): Promise<void> {
		if (this._pendingEnvelopes.size === 0) {
			this._statusPollingTimer = null;
			return;
		}

		const completedStatuses: DocuSignEnvelopeStatus[] = ['completed', 'signed', 'declined', 'voided'];

		for (const envelopeId of this._pendingEnvelopes) {
			try {
				const status = await this.getEnvelopeStatus(envelopeId);

				if (completedStatuses.includes(status)) {
					this._pendingEnvelopes.delete(envelopeId);

					let documentUri: string | undefined;
					for (const [uri, id] of this._envelopeIdOfDocumentUri) {
						if (id === envelopeId) {
							documentUri = uri;
							break;
						}
					}

					this._onEnvelopeStatusChange.fire({
						envelopeId,
						previousStatus: 'sent',
						newStatus: status,
						documentUri,
					});

					if (status === 'completed' || status === 'signed') {
						this.notificationService.notify({
							severity: Severity.Info,
							message: 'Document has been signed! You can download the completed document.',
						});
					} else if (status === 'declined') {
						this.notificationService.notify({
							severity: Severity.Warning,
							message: 'A recipient has declined to sign the document.',
						});
					}
				}
			} catch (error) {
				console.error(`[DocuSignService] Error polling envelope ${envelopeId}:`, error);
			}
		}

		if (this._pendingEnvelopes.size > 0) {
			this._statusPollingTimer = setTimeout(() => this._pollEnvelopeStatuses(), POLLING_INTERVAL_MS);
		} else {
			this._statusPollingTimer = null;
		}
	}

	// ============================================
	// UTILITY METHODS
	// ============================================

	isSignedIn(): boolean {
		return this._authState.status === 'signed_in' && this._authState.session !== null;
	}

	getEnvironment(): 'demo' | 'production' {
		return this.environment;
	}

	override dispose(): void {
		if (this._statusPollingTimer) {
			clearTimeout(this._statusPollingTimer);
			this._statusPollingTimer = null;
		}
		super.dispose();
	}
}

// Register the service
registerSingleton(IDocuSignService, DocuSignService, InstantiationType.Delayed);
