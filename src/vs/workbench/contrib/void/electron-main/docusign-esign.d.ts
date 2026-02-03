/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Type declarations for docusign-esign SDK
 * @see https://github.com/docusign/docusign-esign-node-client
 */
declare module 'docusign-esign' {
	export class ApiClient {
		constructor();
		setOAuthBasePath(basePath: string): void;
		setBasePath(basePath: string): void;
		addDefaultHeader(header: string, value: string): void;
		requestJWTUserToken(
			clientId: string,
			userId: string,
			scopes: string[],
			privateKey: Buffer | string,
			expiresIn: number
		): Promise<{
			body: {
				access_token: string;
				token_type: string;
				expires_in: number;
			};
		}>;
		getUserInfo(accessToken: string): Promise<{
			sub: string;
			email: string;
			name: string;
			accounts: Array<{
				accountId: string;
				isDefault: string;
				accountName: string;
				baseUri: string;
			}>;
		}>;
	}

	export interface EnvelopeDefinition {
		emailSubject?: string;
		emailBlurb?: string;
		status?: string;
		voidedReason?: string;
		documents?: Array<{
			documentBase64?: string;
			name?: string;
			fileExtension?: string;
			documentId?: string;
		}>;
		recipients?: {
			signers?: Array<{
				email?: string;
				name?: string;
				recipientId?: string;
				routingOrder?: string;
				tabs?: {
					signHereTabs?: Array<{
						anchorString?: string;
						anchorUnits?: string;
						anchorXOffset?: string;
						anchorYOffset?: string;
					}>;
				};
			}>;
			carbonCopies?: Array<{
				email?: string;
				name?: string;
				recipientId?: string;
				routingOrder?: string;
			}>;
		};
	}

	export interface EnvelopeSummary {
		envelopeId?: string;
		uri?: string;
		statusDateTime?: string;
		status?: string;
	}

	export interface Envelope {
		envelopeId?: string;
		emailSubject?: string;
		emailBlurb?: string;
		status?: string;
		createdDateTime?: string;
		sentDateTime?: string;
		completedDateTime?: string;
		expireDateTime?: string;
		recipients?: {
			signers?: Array<any>;
			carbonCopies?: Array<any>;
		};
		envelopeDocuments?: Array<any>;
	}

	export interface EnvelopesListResult {
		envelopes?: Array<any>;
	}

	export class EnvelopesApi {
		constructor(apiClient: ApiClient);
		createEnvelope(
			accountId: string,
			opts: { envelopeDefinition: EnvelopeDefinition }
		): Promise<EnvelopeSummary>;
		update(
			accountId: string,
			envelopeId: string,
			opts: { envelope: Partial<EnvelopeDefinition> }
		): Promise<EnvelopeSummary>;
		getEnvelope(
			accountId: string,
			envelopeId: string,
			opts?: { include?: string }
		): Promise<Envelope>;
		listStatusChanges(
			accountId: string,
			opts?: { fromDate?: string }
		): Promise<EnvelopesListResult>;
		getDocument(
			accountId: string,
			envelopeId: string,
			documentId: string
		): Promise<string | Buffer>;
	}
}
