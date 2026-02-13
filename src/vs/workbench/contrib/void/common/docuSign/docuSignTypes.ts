/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * DocuSign E-Signature Integration Types
 *
 * This module defines all types for the DocuSign e-signature integration,
 * including envelope management, recipient handling, OAuth sessions, and status tracking.
 */

// ============================================
// ENVELOPE STATUS
// ============================================

/**
 * DocuSign envelope status values
 * @see https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/envelopes/get
 */
export type DocuSignEnvelopeStatus =
	| 'created'      // Draft envelope, not yet sent
	| 'sent'         // Envelope has been sent to recipients
	| 'delivered'    // Envelope has been delivered to recipients
	| 'signed'       // All recipients have signed (completed)
	| 'completed'    // Envelope processing is complete
	| 'declined'     // A recipient declined to sign
	| 'voided'       // Envelope has been voided by sender
	| 'deleted';     // Envelope has been deleted

/**
 * Recipient status values
 */
export type DocuSignRecipientStatus =
	| 'created'      // Recipient created but envelope not sent
	| 'sent'         // Notification sent to recipient
	| 'delivered'    // Recipient has viewed the document
	| 'signed'       // Recipient has signed
	| 'declined'     // Recipient declined to sign
	| 'completed';   // Recipient action is complete

// ============================================
// RECIPIENT TYPES
// ============================================

/**
 * Recipient role types
 */
export type DocuSignRecipientRole = 'signer' | 'carbonCopy' | 'inPersonSigner';

/**
 * DocuSign recipient (signer or CC)
 */
export interface IDocuSignRecipient {
	/** Unique ID for this recipient within the envelope */
	recipientId: string;
	/** Recipient's email address */
	email: string;
	/** Recipient's name */
	name: string;
	/** Role of the recipient */
	role: DocuSignRecipientRole;
	/** Order in which this recipient signs (1-based) */
	routingOrder: number;
	/** Current status of this recipient */
	status?: DocuSignRecipientStatus;
	/** When the recipient signed (ISO 8601) */
	signedDateTime?: string;
	/** When the document was delivered to recipient (ISO 8601) */
	deliveredDateTime?: string;
}

/**
 * Simplified recipient for creation (before envelope is created)
 */
export interface IDocuSignRecipientInput {
	email: string;
	name: string;
	role: DocuSignRecipientRole;
	routingOrder?: number;
}

// ============================================
// DOCUMENT TYPES
// ============================================

/**
 * Document attached to an envelope
 */
export interface IDocuSignDocument {
	/** Document ID within the envelope */
	documentId: string;
	/** Document name */
	name: string;
	/** File extension (pdf, docx, etc.) */
	fileExtension: string;
	/** Order of document in envelope */
	order: number;
	/** Number of pages */
	pages?: number;
}

/**
 * Document input for envelope creation
 */
export interface IDocuSignDocumentInput {
	/** Base64-encoded document content */
	documentBase64: string;
	/** Document name (with extension) */
	name: string;
	/** File extension */
	fileExtension: 'docx' | 'pdf' | 'doc';
	/** Document ID (defaults to "1") */
	documentId?: string;
}

// ============================================
// ENVELOPE TYPES
// ============================================

/**
 * DocuSign envelope (the signing "package")
 */
export interface IDocuSignEnvelope {
	/** DocuSign envelope ID */
	envelopeId: string;
	/** Envelope subject/email subject */
	emailSubject: string;
	/** Envelope message/email body */
	emailBlurb?: string;
	/** Current envelope status */
	status: DocuSignEnvelopeStatus;
	/** When the envelope was created (ISO 8601) */
	createdDateTime: string;
	/** When the envelope was sent (ISO 8601) */
	sentDateTime?: string;
	/** When the envelope was completed (ISO 8601) */
	completedDateTime?: string;
	/** When the envelope expires (ISO 8601) */
	expireDateTime?: string;
	/** Recipients in this envelope */
	recipients: IDocuSignRecipient[];
	/** Documents in this envelope */
	documents: IDocuSignDocument[];
}

/**
 * Envelope creation request
 */
export interface IDocuSignEnvelopeCreateRequest {
	/** Email subject for the envelope */
	emailSubject: string;
	/** Email body/message */
	emailBlurb?: string;
	/** Documents to include */
	documents: IDocuSignDocumentInput[];
	/** Recipients (signers and CCs) */
	recipients: IDocuSignRecipientInput[];
	/** Whether to send immediately or save as draft */
	status: 'created' | 'sent';
}

/**
 * Envelope summary for list views
 */
export interface IDocuSignEnvelopeSummary {
	envelopeId: string;
	emailSubject: string;
	status: DocuSignEnvelopeStatus;
	createdDateTime: string;
	sentDateTime?: string;
	completedDateTime?: string;
	/** Number of recipients */
	recipientCount: number;
	/** Number of documents */
	documentCount: number;
}

// ============================================
// SESSION & AUTH TYPES
// ============================================

/**
 * DocuSign session (works for both OAuth and JWT flows)
 */
export interface IDocuSignSession {
	/** Access token (from OAuth or JWT exchange) */
	accessToken: string;
	/** OAuth refresh token (null for JWT flow - tokens are regenerated) */
	refreshToken: string | null;
	/** When the access token expires (Unix timestamp in seconds) */
	expiresAt: number;
	/** DocuSign account ID */
	accountId: string;
	/** DocuSign base URI for API calls */
	baseUri: string;
	/** User info */
	user: IDocuSignUser;
	/** Authentication method used */
	authMethod: 'oauth' | 'jwt';
}

/**
 * DocuSign user info
 */
export interface IDocuSignUser {
	/** User ID */
	userId: string;
	/** User's email */
	email: string;
	/** User's name */
	name: string;
}

/**
 * DocuSign auth state
 */
export type DocuSignAuthStatus =
	| 'signed_out'
	| 'signing_in'
	| 'signed_in'
	| 'error';

export interface IDocuSignAuthState {
	status: DocuSignAuthStatus;
	session: IDocuSignSession | null;
	error: string | null;
}

// ============================================
// WORKSPACE TRACKING TYPES
// ============================================

/**
 * Maps document URIs to their DocuSign envelopes (per-workspace)
 */
export interface IDocuSignDocumentTracking {
	/** Workspace folder URI */
	workspaceUri: string;
	/** Document URI -> Envelope ID mapping */
	envelopeIdOfDocumentUri: Record<string, string>;
	/** Envelope ID -> Envelope summary */
	envelopeSummaryOfId: Record<string, IDocuSignEnvelopeSummary>;
}

// ============================================
// SERVICE EVENTS
// ============================================

/**
 * Auth state change event
 */
export interface DocuSignAuthChangeEvent {
	status: DocuSignAuthStatus;
	user: IDocuSignUser | null;
}

/**
 * Envelope status change event
 */
export interface DocuSignEnvelopeStatusChangeEvent {
	envelopeId: string;
	previousStatus: DocuSignEnvelopeStatus;
	newStatus: DocuSignEnvelopeStatus;
	documentUri?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * DocuSign API error response
 */
export interface IDocuSignApiError {
	errorCode: string;
	message: string;
}

/**
 * Envelope creation response
 */
export interface IDocuSignEnvelopeCreateResponse {
	envelopeId: string;
	uri: string;
	statusDateTime: string;
	status: DocuSignEnvelopeStatus;
}

/**
 * Token exchange response
 */
export interface IDocuSignTokenResponse {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
}

/**
 * User info response from /oauth/userinfo
 */
export interface IDocuSignUserInfoResponse {
	sub: string;
	email: string;
	name: string;
	accounts: Array<{
		account_id: string;
		is_default: boolean;
		base_uri: string;
	}>;
}

// ============================================
// SETTINGS TYPES
// ============================================

/**
 * DocuSign authentication mode
 * - jwt: JWT Grant flow (recommended for desktop apps)
 * - oauth: OAuth Authorization Code flow (legacy browser-based)
 */
export type DocuSignAuthMode = 'jwt' | 'oauth';

/**
 * DocuSign consent status
 */
export type DocuSignConsentStatus = 'unknown' | 'granted' | 'required' | 'error';

/**
 * DocuSign integration settings
 */
export interface IDocuSignSettings {
	/** DocuSign Integration Key (Client ID) */
	integrationKey: string;
	/** Environment selection */
	environment: 'demo' | 'production';
	/** Saved account ID (optional, uses default if not set) */
	accountId?: string;
	/** User ID (GUID) for JWT impersonation - required for JWT auth */
	userId?: string;
	/** Whether private key is configured (stored securely via safeStorage) */
	privateKeyConfigured?: boolean;
	/** Authentication mode to use */
	authMode?: DocuSignAuthMode;
	/** Whether user consent has been granted for JWT impersonation */
	consentStatus?: DocuSignConsentStatus;
}

/**
 * Default DocuSign settings
 */
export const defaultDocuSignSettings: IDocuSignSettings = {
	integrationKey: '',
	environment: 'demo',
	authMode: 'oauth',
	consentStatus: 'unknown',
};

// ============================================
// JWT-SPECIFIC TYPES
// ============================================

/**
 * JWT token request for electron-main
 */
export interface IDocuSignJWTRequest {
	integrationKey: string;
	userId: string;
	environment: 'demo' | 'production';
}

/**
 * OAuth Access Code request
 */
export interface IDocuSignOAuthRequest {
	authCode: string;
	redirectUri: string;
}

/**
 * JWT token response from electron-main
 */
export interface IDocuSignJWTResponse {
	accessToken: string;
	expiresAt: number;
	accountId: string;
	baseUri: string;
	user: IDocuSignUser;
}

/**
 * Consent URL generation request
 */
export interface IDocuSignConsentUrlRequest {
	integrationKey: string;
	environment: 'demo' | 'production';
	redirectUri: string;
}

/**
 * Private key storage request
 */
export interface IDocuSignPrivateKeyRequest {
	/** The RSA private key in PEM format (PKCS#8) */
	privateKey: string;
}
