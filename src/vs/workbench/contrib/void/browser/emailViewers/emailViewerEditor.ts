/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as DOM from '../../../../../base/browser/dom.js';
import { Dimension } from '../../../../../base/browser/dom.js';
import { CodeWindow } from '../../../../../base/browser/window.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IEditorOptions } from '../../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../../common/editor.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { IEditorGroup } from '../../../../services/editor/common/editorGroupsService.js';
import { IOverlayWebview, IWebviewService } from '../../../../contrib/webview/browser/webview.js';
import { EmailViewerInput } from './emailViewerInput.js';
import { IEmailService, IEmailDraftService } from '../../common/emailService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { INotificationService, Severity } from '../../../../../platform/notification/common/notification.js';

// SafeAppeals brand colors
const BRAND_GREEN = '#22c55e';

export class EmailViewerEditor extends EditorPane {
	static readonly ID = 'void.emailViewer';

	private _element?: HTMLElement;
	private _dimension?: Dimension;
	private webview?: IOverlayWebview;
	private _currentInput?: EmailViewerInput;
	private _webviewReady: boolean = false;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IEmailService private readonly emailService: IEmailService,
		@IEmailDraftService private readonly emailDraftService: IEmailDraftService,
		@IEditorService private readonly editorService: IEditorService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super(EmailViewerEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		this._element = DOM.append(parent, DOM.$('div.email-viewer-container'));
		this._element.style.width = '100%';
		this._element.style.height = '100%';
		this._element.style.position = 'relative';
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);

		if (token.isCancellationRequested || !(input instanceof EmailViewerInput)) {
			return;
		}

		this._currentInput = input;

		// Load email data if not already loaded
		if (!input.getEmail()) {
			const email = await this.emailService.getEmailById(input.emailId);
			if (email) {
				input.setEmail(email);
			}
		}

		// Create or update webview
		if (!this.webview && this._element) {
			this.createWebview();
		}

		if (this._webviewReady) {
			await this.renderEmail();
		}
	}

	private createWebview(): void {
		if (!this._element) return;

		this.webview = this.webviewService.createWebviewOverlay({
			title: 'Email Viewer',
			providedViewType: 'void.emailViewer',
			options: {
				enableFindWidget: true,
				retainContextWhenHidden: true
			},
			contentOptions: {
				allowScripts: true,
				localResourceRoots: []
			},
			extension: undefined
		});

		const targetWindow = DOM.getWindow(this._element);
		this.webview.claim(this, targetWindow as CodeWindow, undefined);
		this.webview.layoutWebviewOverElement(this._element);

		if (this._dimension) {
			this.webview.layoutWebviewOverElement(this._element, this._dimension);
		}

		// Set initial HTML
		this.webview.setHtml(this.getLoadingHtml());

		// Handle webview messages
		this.webview.onMessage(async (e: { message: { type: string } }) => {
			const message = e.message;
			switch (message.type) {
				case 'ready':
					this._webviewReady = true;
					await this.renderEmail();
					break;
				case 'draftReply':
					// Handle draft reply request
					if (this._currentInput?.getEmail()) {
						await this.handleDraftReply();
					}
					break;
			}
		});
	}

	private async renderEmail(): Promise<void> {
		if (!this.webview || !this._currentInput) return;

		const email = this._currentInput.getEmail();
		if (!email) {
			this.webview.setHtml(this.getErrorHtml('Email not found'));
			return;
		}

		this.webview.setHtml(this.getEmailHtml(email));
	}

	private async handleDraftReply(): Promise<void> {
		const email = this._currentInput?.getEmail();
		if (!email) {
			this.notificationService.notify({
				severity: Severity.Error,
				message: 'No email loaded to reply to.'
			});
			return;
		}

		try {
			// Show progress notification
			this.notificationService.notify({
				severity: Severity.Info,
				message: `Creating draft reply for "${email.subject}"...`
			});

			// Create initial draft content with email context
			const draftContent = `<p>Dear ${email.from || 'Recipient'},</p>
<p></p>
<p>Thank you for your email regarding "${email.subject}".</p>
<p></p>
<p></p>
<p>Best regards,</p>`;

			// Save draft to the draft service for inline editing
			await this.emailDraftService.saveDraft(email.id, draftContent);

			// Also create a DOCX document for external editing if needed
			const docxUri = await this.emailService.createReplyDocument(email.id, draftContent);

			// Open the generated DOCX in the editor
			await this.editorService.openEditor({ resource: docxUri });

			this.notificationService.notify({
				severity: Severity.Info,
				message: `Draft reply created successfully!`
			});
		} catch (error) {
			console.error('[EmailViewer] Failed to create draft reply:', error);
			this.notificationService.notify({
				severity: Severity.Error,
				message: `Failed to create draft reply: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
		}
	}

	private getLoadingHtml(): string {
		return `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body {
						background-color: #0a0a0a;
						color: #fafafa;
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
						display: flex;
						align-items: center;
						justify-content: center;
						height: 100vh;
						margin: 0;
					}
					.loader {
						border: 3px solid #27272a;
						border-top: 3px solid ${BRAND_GREEN};
						border-radius: 50%;
						width: 40px;
						height: 40px;
						animation: spin 1s linear infinite;
					}
					@keyframes spin {
						0% { transform: rotate(0deg); }
						100% { transform: rotate(360deg); }
					}
				</style>
			</head>
			<body>
				<div class="loader"></div>
				<script>
					const vscode = acquireVsCodeApi();
					vscode.postMessage({ type: 'ready' });
				</script>
			</body>
			</html>
		`;
	}

	private getErrorHtml(message: string): string {
		return `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body {
						background-color: #0a0a0a;
						color: #ef4444;
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
						display: flex;
						align-items: center;
						justify-content: center;
						height: 100vh;
						margin: 0;
					}
				</style>
			</head>
			<body>
				<div>${message}</div>
			</body>
			</html>
		`;
	}

	private getEmailHtml(email: { from: string; to: string; cc?: string; subject: string; date: Date; bodyText: string; bodyHtml?: string; attachments: Array<{ filename: string; contentType: string }> }): string {
		const dateStr = new Date(email.date).toLocaleString();
		const hasAttachments = email.attachments.length > 0;

		// Escape HTML in text content
		const escapeHtml = (text: string) => text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');

		// Use HTML body if available, otherwise format plain text
		const bodyContent = email.bodyHtml
			? email.bodyHtml
			: `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(email.bodyText)}</pre>`;

		return `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					* {
						box-sizing: border-box;
					}
					body {
						background-color: #0a0a0a;
						color: #fafafa;
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
						margin: 0;
						padding: 24px;
						line-height: 1.6;
					}
					.email-container {
						max-width: 800px;
						margin: 0 auto;
					}
					.email-header {
						background-color: #111111;
						border: 1px solid #27272a;
						border-radius: 12px;
						padding: 20px;
						margin-bottom: 20px;
					}
					.email-subject {
						font-size: 1.5rem;
						font-weight: 600;
						color: #fafafa;
						margin-bottom: 16px;
					}
					.email-meta {
						display: grid;
						grid-template-columns: auto 1fr;
						gap: 8px 16px;
						font-size: 0.9rem;
					}
					.email-meta-label {
						color: #71717a;
						font-weight: 500;
					}
					.email-meta-value {
						color: #a1a1aa;
					}
					.email-actions {
						display: flex;
						gap: 12px;
						margin-top: 16px;
						padding-top: 16px;
						border-top: 1px solid #27272a;
					}
					.btn {
						padding: 10px 20px;
						border-radius: 8px;
						font-weight: 600;
						cursor: pointer;
						border: none;
						display: flex;
						align-items: center;
						gap: 8px;
						transition: all 0.2s;
					}
					.btn-primary {
						background-color: ${BRAND_GREEN};
						color: #0a0a0a;
					}
					.btn-primary:hover {
						background-color: #16a34a;
					}
					.btn-secondary {
						background-color: #1a1a1a;
						color: #a1a1aa;
						border: 1px solid #27272a;
					}
					.btn-secondary:hover {
						background-color: #27272a;
						color: #fafafa;
					}
					.email-body {
						background-color: #111111;
						border: 1px solid #27272a;
						border-radius: 12px;
						padding: 24px;
					}
					.attachments {
						margin-top: 20px;
						padding: 16px;
						background-color: #0f0f0f;
						border: 1px solid #27272a;
						border-radius: 8px;
					}
					.attachments-title {
						font-size: 0.85rem;
						font-weight: 600;
						color: #71717a;
						margin-bottom: 12px;
					}
					.attachment-item {
						display: flex;
						align-items: center;
						gap: 8px;
						padding: 8px 12px;
						background-color: #1a1a1a;
						border: 1px solid #27272a;
						border-radius: 6px;
						margin-bottom: 8px;
						font-size: 0.85rem;
						color: #a1a1aa;
					}
					.attachment-item:last-child {
						margin-bottom: 0;
					}
				</style>
			</head>
			<body>
				<div class="email-container">
					<div class="email-header">
						<div class="email-subject">${escapeHtml(email.subject)}</div>
						<div class="email-meta">
							<span class="email-meta-label">From:</span>
							<span class="email-meta-value">${escapeHtml(email.from)}</span>
							<span class="email-meta-label">To:</span>
							<span class="email-meta-value">${escapeHtml(email.to)}</span>
							${email.cc ? `
								<span class="email-meta-label">CC:</span>
								<span class="email-meta-value">${escapeHtml(email.cc)}</span>
							` : ''}
							<span class="email-meta-label">Date:</span>
							<span class="email-meta-value">${dateStr}</span>
						</div>
						<div class="email-actions">
							<button class="btn btn-primary" onclick="draftReply()">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
									<polyline points="22,6 12,13 2,6"/>
								</svg>
								Draft Reply
							</button>
						</div>
					</div>
					<div class="email-body">
						${bodyContent}
					</div>
					${hasAttachments ? `
						<div class="attachments">
							<div class="attachments-title">Attachments (${email.attachments.length})</div>
							${email.attachments.map(att => `
								<div class="attachment-item">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
									</svg>
									${escapeHtml(att.filename)}
								</div>
							`).join('')}
						</div>
					` : ''}
				</div>
				<script>
					const vscode = acquireVsCodeApi();

					function draftReply() {
						vscode.postMessage({ type: 'draftReply' });
					}

					// Signal ready
					vscode.postMessage({ type: 'ready' });
				</script>
			</body>
			</html>
		`;
	}

	override layout(dimension: Dimension): void {
		this._dimension = dimension;
		if (this._element) {
			this._element.style.width = `${dimension.width}px`;
			this._element.style.height = `${dimension.height}px`;
		}
		if (this.webview && this._element) {
			this.webview.layoutWebviewOverElement(this._element, dimension);
		}
	}

	override focus(): void {
		this.webview?.focus();
	}

	override clearInput(): void {
		this._currentInput = undefined;
		super.clearInput();
	}

	override dispose(): void {
		this.webview?.dispose();
		super.dispose();
	}
}

