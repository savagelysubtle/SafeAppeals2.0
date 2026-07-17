/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { INotificationService, Severity } from '../../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IDocuSignRecipientInput } from '../../common/docuSign/docuSignTypes.js';
import { IDocuSignService } from './docuSignService.js';

// Action IDs
const DOCUSIGN_SIGN_IN = 'void.docusign.signIn';
const DOCUSIGN_SIGN_OUT = 'void.docusign.signOut';
const DOCUSIGN_SEND_FOR_SIGNATURE = 'void.docusign.sendForSignature';

/**
 * Sign in to DocuSign
 */
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: DOCUSIGN_SIGN_IN,
			title: { value: 'DocuSign: Sign In', original: 'DocuSign: Sign In' },
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const docuSignService = accessor.get(IDocuSignService);
		const notificationService = accessor.get(INotificationService);

		try {
			await docuSignService.signIn();
		} catch (error) {
			notificationService.notify({
				severity: Severity.Error,
				message: `DocuSign sign in failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
		}
	}
});

/**
 * Sign out from DocuSign
 */
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: DOCUSIGN_SIGN_OUT,
			title: { value: 'DocuSign: Sign Out', original: 'DocuSign: Sign Out' },
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const docuSignService = accessor.get(IDocuSignService);
		const notificationService = accessor.get(INotificationService);

		try {
			await docuSignService.signOut();
			notificationService.notify({
				severity: Severity.Info,
				message: 'Signed out from DocuSign'
			});
		} catch (error) {
			notificationService.notify({
				severity: Severity.Error,
				message: `DocuSign sign out failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
		}
	}
});

/**
 * Send document for signature
 * This command is called from the DOCX/PDF viewer ribbon button
 */
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: DOCUSIGN_SEND_FOR_SIGNATURE,
			title: { value: 'DocuSign: Send for Signature', original: 'DocuSign: Send for Signature' },
			f1: true
		});
	}

	async run(accessor: ServicesAccessor, args?: {
		documentBase64?: string;
		documentUri?: string;
		filename?: string;
	}): Promise<void> {
		const docuSignService = accessor.get(IDocuSignService);
		const notificationService = accessor.get(INotificationService);
		const quickInputService = accessor.get(IQuickInputService);

		// Check if signed in
		if (!docuSignService.isSignedIn()) {
			const signIn = await quickInputService.pick(
				[
					{ label: 'Sign in to DocuSign', description: 'Required to send documents for signature' },
					{ label: 'Cancel' }
				],
				{ placeHolder: 'You need to sign in to DocuSign first' }
			);

			if (signIn?.label === 'Sign in to DocuSign') {
				await docuSignService.signIn();
			}
			return;
		}

		// Get document data from args (passed from viewer) or prompt user
		let documentBase64 = args?.documentBase64;
		let documentUri = args?.documentUri;
		let filename = args?.filename || 'document';

		if (!documentBase64) {
			notificationService.notify({
				severity: Severity.Error,
				message: 'No document provided. Please use the "Send for Signature" button in the document viewer.'
			});
			return;
		}

		try {
			// Simple recipient input via quick input for MVP
			// In future: Use the RecipientDialog React component

			// Get recipient email
			const recipientEmail = await quickInputService.input({
				placeHolder: 'recipient@example.com',
				prompt: 'Enter recipient email address',
				validateInput: async (value) => {
					if (!value) return 'Email is required';
					if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email address';
					return undefined;
				}
			});

			if (!recipientEmail) return;

			// Get recipient name
			const recipientName = await quickInputService.input({
				placeHolder: 'John Doe',
				prompt: 'Enter recipient name'
			});

			if (!recipientName) return;

			// Get email subject
			const emailSubject = await quickInputService.input({
				value: `Please sign: ${filename}`,
				prompt: 'Enter email subject'
			});

			if (!emailSubject) return;

			// Create recipient
			const recipients: IDocuSignRecipientInput[] = [{
				email: recipientEmail,
				name: recipientName,
				role: 'signer',
				routingOrder: 1
			}];

			// Show progress notification
			notificationService.notify({
				severity: Severity.Info,
				message: 'Sending document to DocuSign...'
			});

			// Send document for signature
			const envelopeId = await docuSignService.sendDocumentForSignature(
				URI.parse(documentUri || 'file:///unknown'),
				documentBase64,
				recipients,
				emailSubject,
				'Please review and sign this document.'
			);

			notificationService.notify({
				severity: Severity.Info,
				message: `Document sent for signature! Envelope ID: ${envelopeId.substring(0, 8)}...`
			});

		} catch (error) {
			notificationService.notify({
				severity: Severity.Error,
				message: `Failed to send for signature: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
		}
	}
});
