/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as DOM from '../../../../../../base/browser/dom.js';
import { Dimension } from '../../../../../../base/browser/dom.js';
import { CodeWindow } from '../../../../../../base/browser/window.js';
import { VSBuffer } from '../../../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { IDisposable } from '../../../../../../base/common/lifecycle.js';
import { FileAccess } from '../../../../../../base/common/network.js';
import { URI } from '../../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../../base/common/uuid.js';
import { IChannel } from '../../../../../../base/parts/ipc/common/ipc.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { IFileDialogService } from '../../../../../../platform/dialogs/common/dialogs.js';
import { IEditorOptions } from '../../../../../../platform/editor/common/editor.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { IMainProcessService } from '../../../../../../platform/ipc/common/mainProcessService.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../../../common/editor.js';
import { EditorInput } from '../../../../../common/editor/editorInput.js';
import { IEditorGroup } from '../../../../../services/editor/common/editorGroupsService.js';
import { INativeWorkbenchEnvironmentService } from '../../../../../services/environment/electron-sandbox/environmentService.js';
import { IWorkingCopyService } from '../../../../../services/workingCopy/common/workingCopyService.js';
import { IOverlayWebview, IWebviewService } from '../../../../webview/browser/webview.js';
import { asWebviewUri } from '../../../../webview/common/webview.js';
// import { createTrustedTypesPolicy } from '../../../../../../base/browser/trustedTypes.js';
import { INotificationService, Severity } from '../../../../../../platform/notification/common/notification.js';
import { ICloudLLMRouterService } from '../../../browser/cloudLLMRouterService.js';
import { IVoidSettingsService } from '../../../common/voidSettingsService.js';
import { ModelSelection, ProviderName } from '../../../common/voidSettingsTypes.js';
import { IDocuSignService } from '../../docuSign/docuSignService.js';
import { DOCXSelection, DOCXViewerInput } from './docxViewerInput.js';
import { DOCXWorkingCopy } from './docxWorkingCopy.js';

// const docxPrintPolicy = createTrustedTypesPolicy('docxViewerPrint', {
// 	createHTML: value => value
// });

export class DOCXViewerEditor extends EditorPane {
	static readonly ID = 'void.docxViewer';

	private _element?: HTMLElement;
	private _dimension?: Dimension;
	private webview?: IOverlayWebview;
	private _currentInput?: DOCXViewerInput;
	private _webviewReady: boolean = false;
	private _pendingInput?: DOCXViewerInput;
	private _docxDataCache?: { uri: string; data: string; jsonContent?: string };
	private _isLoading: boolean = false;
	private _workingCopy?: DOCXWorkingCopy;
	private _workingCopyDisposable?: IDisposable;
	private _saveCompleteResolver?: (success: boolean) => void;
	private _pendingSaveTimeout?: NodeJS.Timeout;
	private readonly documentExportChannel: IChannel;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IFileService private readonly fileService: IFileService,
		@IWorkingCopyService private readonly workingCopyService: IWorkingCopyService,
		@IOpenerService private readonly openerService: IOpenerService,
		@INativeWorkbenchEnvironmentService private readonly environmentService: INativeWorkbenchEnvironmentService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IMainProcessService mainProcessService: IMainProcessService,
		@ICommandService private readonly commandService: ICommandService,
		@ICloudLLMRouterService private readonly cloudLLMRouterService: ICloudLLMRouterService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@INotificationService private readonly notificationService: INotificationService,
		@IDocuSignService private readonly docuSignService: IDocuSignService
	) {
		super(DOCXViewerEditor.ID, group, telemetryService, themeService, storageService);
		this.documentExportChannel = mainProcessService.getChannel('void-channel-document-export');
	}

	protected override createEditor(parent: HTMLElement): void {
		this._element = DOM.append(parent, DOM.$('div.docx-viewer-container'));
		this._element.style.width = '100%';
		this._element.style.height = '100%';
		this._element.style.position = 'relative';
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);

		if (token.isCancellationRequested || !(input instanceof DOCXViewerInput)) {
			return;
		}

		this._currentInput = input;
		console.log('[DOCX Viewer] setInput called for:', input.resource.toString());

		// Create or get working copy for this document
		this.ensureWorkingCopy(input.resource, input.getName());

		// Create webview if it doesn't exist
		if (!this.webview && this._element) {
			this.webview = this.webviewService.createWebviewOverlay({
				title: 'DOCX Viewer',
				providedViewType: 'void.docxViewer',
				options: {
					enableFindWidget: false,
					retainContextWhenHidden: true
				},
				contentOptions: {
					allowScripts: true,
					localResourceRoots: [this.getMediaUri()]
				},
				extension: undefined
			});

			// Mount webview to container
			const targetWindow = DOM.getWindow(this._element);
			this.webview.claim(this, targetWindow as CodeWindow, undefined);
			this.webview.layoutWebviewOverElement(this._element);

			// Set up message handlers
			this._register(this.webview.onMessage(message => {
				this.handleWebviewMessage(message);
			}));

			// Listen for settings changes to update model dropdown
			this._register(this.voidSettingsService.onDidChangeState(() => {
				if (this._webviewReady) {
					this.sendAvailableModels();
				}
			}));

			// Load webview HTML
			this.webview.setHtml(this.getWebviewHTML());

			// Layout if we have dimensions
			if (this._dimension) {
				this.webview.layoutWebviewOverElement(this._element, this._dimension);
			}
		}

		// If webview exists and is ready, check if we need to reload
		if (this.webview && this._webviewReady) {
			const currentUri = input.resource.toString();

			// If input has modified content, use that
			if (input.hasContent()) {
				console.log('[DOCX Viewer] Loading from input modified content');
				this.webview.postMessage({
					type: 'loadDOCX',
					data: input.getContent(),
					jsonContent: input.getJsonContent(), // Include JSON for image preservation
					encoding: 'base64',
					docxUri: currentUri
				});
				return;
			}

			// If same DOCX is already loaded and cached, resend to webview
			if (this._docxDataCache?.uri === currentUri) {
				console.log('✅ [DOCX Viewer] Same DOCX cached, resending to webview');
				this.webview.postMessage({
					type: 'loadDOCX',
					data: this._docxDataCache.data,
					jsonContent: this._docxDataCache.jsonContent, // Include JSON for image preservation
					encoding: 'base64',
					docxUri: currentUri
				});
				return;
			}

			// Different DOCX, load it
			console.log('[DOCX Viewer] Different DOCX, loading');
			await this.loadDOCX(input);
		} else {
			// Webview not ready yet, queue the input
			console.log('[DOCX Viewer] Webview not ready, queuing input');
			this._pendingInput = input;
		}
	}

	private async loadDOCX(input: DOCXViewerInput): Promise<void> {
		if (this._isLoading || !this.webview) {
			return;
		}

		// If input has modified content, use that instead of loading from disk
		if (input.hasContent()) {
			console.log('[DOCX Viewer] Loading DOCX from input content');
			this.webview.postMessage({
				type: 'loadDOCX',
				data: input.getContent(),
				encoding: 'base64',
				docxUri: input.resource.toString()
			});
			return;
		}

		this._isLoading = true;

		try {
			const currentUri = input.resource.toString();
			console.log('[DOCX Viewer] Loading DOCX:', currentUri);

			// Retry logic for newly created files that may still be populating
			let fileContent: Awaited<ReturnType<typeof this.fileService.readFile>> | undefined;
			let retries = 0;
			const maxRetries = 5; // Try up to 5 times
			const retryDelay = 100; // Wait 100ms between retries

			while (retries < maxRetries) {
				try {
					fileContent = await this.fileService.readFile(input.resource);
					console.log(`[DOCX Viewer] File read attempt ${retries + 1}/${maxRetries} - Size: ${fileContent.value.byteLength} bytes`);

					// If file is empty, it might still be populating - wait and retry
					if (fileContent.value.byteLength === 0) {
						if (retries < maxRetries - 1) {
							console.warn(`[DOCX Viewer] File is empty, waiting ${retryDelay}ms before retry...`);
							await new Promise(resolve => setTimeout(resolve, retryDelay));
							retries++;
							continue;
						} else {
							// Last retry failed
							throw new Error('DOCX file is empty (0 bytes) after multiple retries. The file may not have been created correctly.');
						}
					}

					// File has content, break out of retry loop
					break;

				} catch (error) {
					if (retries < maxRetries - 1) {
						console.warn(`[DOCX Viewer] Error reading file on attempt ${retries + 1}, retrying...`, error);
						await new Promise(resolve => setTimeout(resolve, retryDelay));
						retries++;
					} else {
						throw error;
					}
				}
			}

			// Ensure fileContent was successfully read
			if (!fileContent) {
				throw new Error('Failed to read file after multiple retries');
			}

			// Convert to base64 manually (like PDF viewer)
			const uint8Array = new Uint8Array(fileContent.value.buffer);

			// Verify ZIP signature
			if (uint8Array.length >= 4) {
				const signature = Array.from(uint8Array.slice(0, 4)).map(b => '0x' + b.toString(16).toUpperCase()).join(' ');
				console.log('[DOCX Viewer] File ZIP signature:', signature);
				const isValidZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B;
				if (!isValidZip) {
					console.error('[DOCX Viewer] Invalid ZIP signature - file may be corrupted');
					throw new Error(`File does not have a valid ZIP signature. Expected 0x50 0x4B, got ${signature.substring(0, 11)}`);
				}
			}

			let base64 = '';
			const chunkSize = 8192;

			for (let i = 0; i < uint8Array.length; i += chunkSize) {
				const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
				base64 += String.fromCharCode.apply(null, Array.from(chunk));
			}

			const base64Data = btoa(base64);
			console.log('[DOCX Viewer] Base64 encoded - Length:', base64Data.length);

			// Cache the data
			this._docxDataCache = { uri: currentUri, data: base64Data };

			// Send to webview
			this.webview.postMessage({
				type: 'loadDOCX',
				data: base64Data,
				encoding: 'base64',
				docxUri: currentUri
			});

			console.log('[DOCX Viewer] DOCX loaded successfully');

		} catch (error) {
			console.error('[DOCX Viewer] Failed to load DOCX:', error);
		} finally {
			this._isLoading = false;
		}
	}

	private handleWebviewMessage(message: any): void {
		// Only log message type to avoid flooding console with large base64 data
		const msgType = message?.message?.type || message?.type || 'unknown';
		console.log('[DOCX Viewer] Received message from webview:', msgType);

		const data = message.message || message;

		switch (data.type) {
			case 'ready':
				console.log('[DOCX Viewer] Webview ready');
				this._webviewReady = true;

				// Send available models to the webview
				this.sendAvailableModels();

				// If there's a pending input, load it now
				if (this._pendingInput) {
					console.log('[DOCX Viewer] Processing pending input');
					const pendingInput = this._pendingInput;
					this._pendingInput = undefined;
					this.loadDOCX(pendingInput);
				}
				break;

			case 'contentChanged':
				// Mark working copy as dirty when content changes
				if (this._workingCopy) {
					// console.log('[DOCX Viewer] Content changed, marking working copy dirty'); // noisy
					this._workingCopy.markDirty();
				}
				// Update input content if provided
				if (this._currentInput && (data.docxData || data.data)) {
					this._currentInput.setContent(data.docxData || data.data);
					// Also store JSON content for round-trip image preservation
					if (data.jsonContent) {
						this._currentInput.setJsonContent(data.jsonContent);
					}
				}
				break;

			case 'textSelected':
				// Store selection for Ctrl+K
				if (this._currentInput) {
					this._currentInput.selection = data.selection as DOCXSelection;
				}
				break;

			case 'clearSelection':
				if (this._currentInput) {
					this._currentInput.selection = null;
				}
				break;

			case 'saveRequested':
				if (this._currentInput && (data.text || data.docxData)) {
					// Store JSON content for round-trip image preservation
					if (data.jsonContent) {
						this._currentInput.setJsonContent(data.jsonContent);
					}
					// Await the save and resolve based on actual result
					this.saveDOCX(this._currentInput.resource, data.text, data.html, data.docxData)
						.then(() => {
							if (this._saveCompleteResolver) {
								this._saveCompleteResolver(true);
							}
						})
						.catch((error) => {
							console.error('[DOCX Viewer] Save failed:', error);
							if (this._saveCompleteResolver) {
								this._saveCompleteResolver(false);
							}
						});
				} else {
					// Resolve with false if no data
					if (this._saveCompleteResolver) {
						this._saveCompleteResolver(false);
					}
				}
				break;

			case 'print':
				// Handle printing from the main editor process (outside sandbox)
				if (data.html) {
					this.printHtml(data.html);
				}
				break;

			case 'exportToPDF':
				// Handle PDF export
				if (data.html) {
					this.handleExportToPDF(data.html, data.title);
				}
				break;

			case 'applyEdits':
				// Forward agent edit operations to webview for execution
				if (this.webview) {
					this.webview.postMessage({
						type: 'executeOperations',
						operations: data.operations
					});
				}
				break;

			case 'openLink':
				// Open links in system browser (webview sandbox blocks popups)
				if (data.url) {
					console.log('[DOCX Viewer] Opening link in system browser:', data.url);
					this.openerService.open(URI.parse(data.url), { openExternal: true });
				}
				break;

			case 'executeCommand':
				// Execute VS Code command from webview (e.g., Ctrl+L, Ctrl+K from tooltip)
				if (data.command) {
					console.log('[DOCX Viewer] Executing command:', data.command);
					this.commandService.executeCommand(data.command);
				}
				break;

			case 'inlineEditRequest':
				// Handle inline edit request from Ctrl+K popup
				if (data.selection && data.instructions) {
					console.log('[DOCX Viewer] Inline edit request:', {
						textLength: data.selection.text?.length,
						instructions: data.instructions,
						modelSelection: data.modelSelection
					});
					this.handleInlineEditRequest(data.selection, data.instructions, data.modelSelection);
				}
				break;

			case 'sendForSignature':
				// Handle DocuSign send for signature request
				if (data.docxData) {
					console.log('[DOCX Viewer] Send for Signature request:', {
						docxUri: data.docxUri,
						filename: data.filename
					});
					this.handleSendForSignature(data.docxData, data.docxUri, data.filename);
				}
				break;
		}
	}

	/**
	 * Send available models to the webview for the inline edit dropdown
	 */
	private async sendAvailableModels(): Promise<void> {
		if (!this.webview) return;

		// Wait for settings to be initialized
		await this.voidSettingsService.waitForInitState;

		const state = this.voidSettingsService.state;
		const models = state._modelOptions || [];

		// Find the default model (the one selected for Ctrl+K)
		const defaultSelection = state.modelSelectionOfFeature['Ctrl+K'];
		let defaultIndex = 0;

		if (defaultSelection) {
			const idx = models.findIndex(
				m => m.selection.providerName === defaultSelection.providerName &&
					m.selection.modelName === defaultSelection.modelName
			);
			if (idx >= 0) {
				defaultIndex = idx;
			}
		}

		console.log('[DOCX Viewer] Sending available models:', models.length, 'default index:', defaultIndex);

		this.webview.postMessage({
			type: 'updateModels',
			models: models,
			defaultIndex: defaultIndex
		});
	}

	/**
	 * Handle inline edit request from webview Ctrl+K popup
	 */
	private async handleInlineEditRequest(
		selection: DOCXSelection,
		instructions: string,
		requestedModelSelection?: { providerName: string; modelName: string } | null
	): Promise<void> {
		const input = this._currentInput;
		if (!input) return;

		// Use the requested model (cast to ModelSelection), or fall back to Ctrl+K default
		const modelSelection: ModelSelection | null = requestedModelSelection
			? { providerName: requestedModelSelection.providerName as ProviderName, modelName: requestedModelSelection.modelName }
			: this.voidSettingsService.state.modelSelectionOfFeature['Ctrl+K'];
		if (!modelSelection) {
			this.notificationService.error('Please configure a model for Quick Edit in settings');
			return;
		}

		// Show loading state in webview
		if (this.webview) {
			this.webview.postMessage({
				type: 'inlineEditStarted',
				message: 'Processing edit request...'
			});
		}

		const systemMessage = `You are an expert document editor. Your task is to edit text according to user instructions.
You will receive selected text and editing instructions. Return ONLY the edited text, with no explanations, no markdown formatting, no code blocks.
Preserve the original formatting style (capitalization, punctuation patterns) unless explicitly asked to change it.`;

		const userMessage = `Edit the following text according to my instructions.

SELECTED TEXT:
${selection.text}

INSTRUCTIONS:
${instructions}

Return ONLY the edited text, nothing else.`;

		let editedText = '';

		// Get model options from settings
		const ctrlKOptions = this.voidSettingsService.state.optionsOfModelSelection['Ctrl+K'];
		const providerOptions = ctrlKOptions?.[modelSelection.providerName];
		const modelSelectionOptions = providerOptions?.[modelSelection.modelName];
		const overridesOfModel = this.voidSettingsService.state.overridesOfModel;

		try {
			await new Promise<void>((resolve, reject) => {
				const requestId = this.cloudLLMRouterService.sendLLMMessage({
					messagesType: 'chatMessages',
					messages: [
						{ role: 'user', content: userMessage }
					],
					separateSystemMessage: systemMessage,
					chatMode: null,
					modelSelection,
					modelSelectionOptions,
					overridesOfModel,
					logging: {
						loggingName: 'DOCX Inline Edit'
					},
					onText: ({ fullText }) => {
						editedText = fullText;
						// Stream progress to webview
						if (this.webview) {
							this.webview.postMessage({
								type: 'inlineEditProgress',
								text: fullText
							});
						}
					},
					onFinalMessage: ({ fullText }) => {
						editedText = fullText.trim();
						console.log('[DOCX Inline Edit] LLM response:', editedText.substring(0, 100) + '...');
						resolve();
					},
					onError: ({ message }) => {
						console.error('[DOCX Inline Edit] LLM error:', message);
						reject(new Error(message));
					},
					onAbort: () => {
						reject(new Error('Edit cancelled'));
					}
				});

				if (!requestId) {
					reject(new Error('Failed to start LLM request'));
				}
			});

			// Send the edited text back to the webview to apply
			if (this.webview && editedText) {
				this.webview.postMessage({
					type: 'applyInlineEdit',
					originalText: selection.text,
					editedText: editedText
				});
				this.notificationService.info('Edit applied successfully');
			}

		} catch (error) {
			console.error('[DOCX Inline Edit] Error:', error);
			this.notificationService.error('Edit failed: ' + (error as Error).message);
			if (this.webview) {
				this.webview.postMessage({
					type: 'inlineEditError',
					message: (error as Error).message
				});
			}
		}
	}

	/**
	 * Handle Send for Signature request from webview - initiates DocuSign workflow
	 */
	private async handleSendForSignature(docxBase64: string, docxUri: string, filename: string): Promise<void> {
		console.log('[DOCX Viewer] Handling Send for Signature request');

		// Check if DocuSign service is configured and signed in
		if (!this.docuSignService.isSignedIn()) {
			// Show sign-in required notification
			this.notificationService.notify({
				severity: Severity.Warning,
				message: 'Please sign in to DocuSign first. Go to Settings > DocuSign to configure.',
			});

			// Post message back to webview to show dialog
			if (this.webview) {
				this.webview.postMessage({
					type: 'docuSignAuthRequired',
					message: 'Please sign in to DocuSign to send documents for signature.'
				});
			}
			return;
		}

		// For MVP, we'll show a simple dialog for recipient info via the command palette
		// In a future iteration, this would open the RecipientDialog React component
		try {
			// Show status in webview
			if (this.webview) {
				this.webview.postMessage({
					type: 'docuSignStatus',
					status: 'preparing',
					message: 'Preparing document for signature...'
				});
			}

			// For now, execute the command which will show a quick pick for recipient info
			// This command will be registered in void.contribution.ts
			await this.commandService.executeCommand('void.docusign.sendForSignature', {
				documentBase64: docxBase64,
				documentUri: docxUri,
				filename: filename
			});

		} catch (error) {
			console.error('[DOCX Viewer] Send for Signature error:', error);
			this.notificationService.error('Failed to send for signature: ' + (error as Error).message);

			if (this.webview) {
				this.webview.postMessage({
					type: 'docuSignStatus',
					status: 'error',
					message: (error as Error).message
				});
			}
		}
	}

	private async printHtml(html: string): Promise<void> {
		// Write HTML to a temp file and open in system browser for printing
		// This bypasses all CSP, Trusted Types, and Electron sandbox restrictions
		console.log('[DOCX Viewer] Printing via temp file in browser');

		try {
			// Add print script to HTML to auto-trigger print dialog
			const printReadyHtml = html.replace(
				'</body>',
				`<script>
					window.onload = function() {
						setTimeout(function() {
							window.print();
						}, 500);
					};
				</script>
				</body>`
			);

			// Generate a unique temp file path
			const tempDir = this.environmentService.tmpDir;
			const tempFileName = `docx-print-${generateUuid()}.html`;
			const tempFileUri = URI.joinPath(tempDir, tempFileName);

			console.log('[DOCX Viewer] Writing print HTML to:', tempFileUri.toString());

			// Write HTML to temp file
			await this.fileService.writeFile(tempFileUri, VSBuffer.fromString(printReadyHtml));

			// Open in external browser
			await this.openerService.open(tempFileUri, { openExternal: true });

			console.log('[DOCX Viewer] Opened print file in browser');

			// Schedule cleanup of temp file after a delay (give user time to print)
			setTimeout(async () => {
				try {
					await this.fileService.del(tempFileUri);
					console.log('[DOCX Viewer] Cleaned up temp print file');
				} catch (e) {
					// Ignore cleanup errors
					console.warn('[DOCX Viewer] Could not clean up temp file:', e);
				}
			}, 60000); // Cleanup after 1 minute

		} catch (error) {
			console.error('[DOCX Viewer] Print error:', error);
		}
	}

	private async handleExportToPDF(html: string, title?: string): Promise<void> {
		console.log('[DOCX Viewer] Starting PDF export');

		try {
			// Call electron-main to generate PDF
			const base64Pdf = await this.documentExportChannel.call<string>('exportToPDF', {
				html,
				title: title || this._currentInput?.getName() || 'document'
			});

			// Decode base64 to Uint8Array
			const binaryString = atob(base64Pdf);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			console.log('[DOCX Viewer] PDF generated, size:', bytes.length);

			// Prompt user for save location
			const defaultFileName = title || this._currentInput?.getName() || 'document';
			const defaultUri = this._currentInput?.resource
				? URI.joinPath(this._currentInput.resource, '..', `${defaultFileName.replace(/\.(docx|doc)$/i, '')}.pdf`)
				: undefined;

			const result = await this.fileDialogService.showSaveDialog({
				title: 'Export to PDF',
				defaultUri,
				filters: [
					{ name: 'PDF Files', extensions: ['pdf'] }
				]
			});

			if (result) {
				// Write PDF to selected location
				await this.fileService.writeFile(result, VSBuffer.wrap(bytes));
				console.log('[DOCX Viewer] PDF saved to:', result.toString());
			}

		} catch (error) {
			console.error('[DOCX Viewer] PDF export error:', error);
		}
	}

	private async saveDOCX(uri: URI, text: string, html?: string, docxData?: string): Promise<void> {
		try {
			let bytes: VSBuffer;

			if (docxData) {
				// Convert base64 DOCX data to bytes
				console.log('[DOCX Viewer] Saving as DOCX format, size:', docxData.length);
				const binaryString = atob(docxData);
				const uint8Array = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					uint8Array[i] = binaryString.charCodeAt(i);
				}
				bytes = VSBuffer.wrap(uint8Array);
			} else {
				// Fallback to plain text
				console.warn('[DOCX Viewer] No DOCX data provided, saving as plain text');
				bytes = VSBuffer.fromString(text);
			}

			await this.fileService.writeFile(uri, bytes);
			console.log('[DOCX Viewer] Document saved successfully');

			// Update the cache with the newly saved data so navigating away and back shows correct content
			// Include JSON content from the input for image preservation during round-trip
			if (docxData) {
				const jsonContent = this._currentInput?.getJsonContent();
				this._docxDataCache = { uri: uri.toString(), data: docxData, jsonContent };
				console.log('[DOCX Viewer] Cache updated with saved data', jsonContent ? '(with JSON)' : '(DOCX only)');
			}

			// Mark working copy as saved
			if (this._workingCopy) {
				this._workingCopy.markSaved();
			}

			// Notify webview
			if (this.webview) {
				this.webview.postMessage({ type: 'saveComplete', success: true });
			}

		} catch (error) {
			console.error('[DOCX Viewer] Failed to save document:', error);

			if (this.webview) {
				this.webview.postMessage({
					type: 'saveComplete',
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}
	}

	/**
	 * Ensure a working copy exists for the given resource
	 */
	private ensureWorkingCopy(resource: URI, name: string): void {
		// Clean up old working copy if it exists
		if (this._workingCopy) {
			this._workingCopyDisposable?.dispose();
			this._workingCopy.dispose();
			this._workingCopy = undefined;
			this._workingCopyDisposable = undefined;
		}

		// Create new working copy
		this._workingCopy = new DOCXWorkingCopy(resource, name);

		// Connect working copy to input for dirty state reporting
		if (this._currentInput) {
			this._currentInput.setWorkingCopy(this._workingCopy);
		}

		// Set up save handler
		this._workingCopy.setSaveHandler(async (reason) => {
			console.log('[DOCX Viewer] Working copy save triggered, reason:', reason, 'webviewReady:', this._webviewReady);

			// If webview isn't ready, return false to skip this save attempt
			if (!this.webview || !this._webviewReady) {
				console.warn('[DOCX Viewer] Webview not ready for save, will retry later');
				return false;
			}

			try {
				// Request save from webview
				this.webview.postMessage({ type: 'saveRequest', reason });

				// Wait for save response (with timeout)
				const success = await this.waitForSaveComplete();
				console.log('[DOCX Viewer] Save result:', success);
				return success;
			} catch (error) {
				console.error('[DOCX Viewer] Save handler error:', error);
				return false;
			}
		});

		// Register with working copy service
		this._workingCopyDisposable = this.workingCopyService.registerWorkingCopy(this._workingCopy);
		console.log('[DOCX Viewer] Working copy registered for:', resource.toString());
	}

	/**
	 * Wait for save complete message from webview
	 */
	private waitForSaveComplete(): Promise<boolean> {
		return new Promise((resolve) => {
			// Clear any existing timeout
			if (this._pendingSaveTimeout) {
				clearTimeout(this._pendingSaveTimeout);
			}

			// Set new timeout (30 seconds for active saves - large documents with images need more time)
			this._pendingSaveTimeout = setTimeout(() => {
				console.warn('[DOCX Viewer] Save timeout after 30 seconds');
				this._saveCompleteResolver = undefined;
				this._pendingSaveTimeout = undefined;
				resolve(false);
			}, 30000);

			// Store the resolve function to be called when save completes
			this._saveCompleteResolver = (success: boolean) => {
				if (this._pendingSaveTimeout) {
					clearTimeout(this._pendingSaveTimeout);
					this._pendingSaveTimeout = undefined;
				}
				this._saveCompleteResolver = undefined;
				resolve(success);
			};
		});
	}

	/**
	 * Trigger save programmatically (e.g., Ctrl+S)
	 */
	async triggerSave(): Promise<boolean> {
		if (this._workingCopy) {
			return await this._workingCopy.save();
		}
		return false;
	}

	public getInput(): DOCXViewerInput | undefined {
		return this._currentInput;
	}

	public getWebview(): IOverlayWebview | undefined {
		return this.webview;
	}

	override layout(dimension: Dimension): void {
		this._dimension = dimension;
		if (this.webview && this._element) {
			this.webview.layoutWebviewOverElement(this._element, dimension);
		}
	}

	protected override setEditorVisible(visible: boolean): void {
		if (this.webview && this._element) {
			const targetWindow = DOM.getWindow(this._element);
			if (visible) {
				this.webview.claim(this, targetWindow as CodeWindow, undefined);
			} else {
				this.webview.release(this);
			}
		}
		super.setEditorVisible(visible);
	}

	override clearInput(): void {
		if (this.webview) {
			this.webview.postMessage({ type: 'clearDOCX' });
		}

		// Unregister working copy and clear input's reference to prevent stale dirty state
		if (this._workingCopy) {
			if (this._currentInput) {
				this._currentInput.clearWorkingCopy();
			}
			this._workingCopyDisposable?.dispose();
			this._workingCopy.dispose();
			this._workingCopy = undefined;
			this._workingCopyDisposable = undefined;
		}

		this._currentInput = undefined;
		super.clearInput();
	}

	override dispose(): void {
		// Clean up pending save timeout
		if (this._pendingSaveTimeout) {
			clearTimeout(this._pendingSaveTimeout);
			this._pendingSaveTimeout = undefined;
		}

		// Reject any pending save promises
		if (this._saveCompleteResolver) {
			this._saveCompleteResolver(false);
			this._saveCompleteResolver = undefined;
		}

		// Clean up working copy
		if (this._workingCopy) {
			this._workingCopyDisposable?.dispose();
			this._workingCopy.dispose();
			this._workingCopy = undefined;
			this._workingCopyDisposable = undefined;
		}

		if (this.webview) {
			this.webview.release(this);
		}
		super.dispose();
	}

	private getMediaUri(): URI {
		return FileAccess.asFileUri('vs/workbench/contrib/void/browser/documentViewers/docxViewer/media');
	}

	private getWebviewHTML(): string {
		if (!this.webview) {
			return '';
		}

		const nonce = generateUuid();
		const mediaUri = this.getMediaUri();

		// Tiptap and dependencies
		const tiptapDocxBundleUri = asWebviewUri(URI.joinPath(mediaUri, 'tiptapDocxBundle.js'));
		const tiptapBundleUri = asWebviewUri(URI.joinPath(mediaUri, 'tiptapBundle.js'));
		const docxLibUri = asWebviewUri(URI.joinPath(mediaUri, 'lib', 'docx-preview.min.js'));
		const ribbonScriptUri = asWebviewUri(URI.joinPath(mediaUri, 'docxRibbon.js'));
		const scriptUri = asWebviewUri(URI.joinPath(mediaUri, 'docxViewerTiptap.js'));
		const styleUri = asWebviewUri(URI.joinPath(mediaUri, 'docxViewer.css'));

		// CDN dependencies (only JSZip for docx-preview)
		const jszipCdnUri = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
		// Note: Tiptap and docx library are now bundled in tiptapDocxBundle.js

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src blob: data: https: http://127.0.0.1:* vscode-resource:; img-src https: data: blob: vscode-resource:; script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com vscode-resource:; style-src 'unsafe-inline' vscode-resource:; font-src data: vscode-resource:;">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>DOCX Viewer</title>
	<link rel="stylesheet" href="${styleUri}">
	<style>
		/* Inline fallback styles for when external CSS fails to load */
		/* Link styling - MAXIMUM SPECIFICITY to override * { color: #333 !important } */
		/* Target all possible link locations in Tiptap/ProseMirror */
		a,
		a[href],
		.tiptap-editor a,
		.tiptap-editor a[href],
		.ProseMirror a,
		.ProseMirror a[href],
		.tiptap-editor a.docx-link,
		.ProseMirror a.docx-link,
		.Page a,
		.Page a[href],
		.PageContent a,
		.PageContent a[href],
		[data-page] a,
		[data-page] a[href],
		p a,
		span a,
		.tiptap-editor p a,
		.tiptap-editor span a,
		.ProseMirror p a,
		.ProseMirror span a {
			color: #0066cc !important;
			text-decoration: underline !important;
			cursor: pointer !important;
		}
		/* Also target the text inside links */
		a *,
		a[href] *,
		.tiptap-editor a *,
		.ProseMirror a * {
			color: inherit !important;
		}
		a:hover,
		a[href]:hover,
		.tiptap-editor a:hover,
		.ProseMirror a:hover {
			color: #0044aa !important;
		}
	</style>
</head>
<body>
	<!-- ============================================
	     RIBBON TOOLBAR - MS Word Style
	     ============================================ -->
	<div id="docx-ribbon-container">
		<!-- Ribbon Tab Bar -->
		<div class="ribbon-tabs">
			<button class="ribbon-tab active" data-tab="home">Home</button>
			<button class="ribbon-tab" data-tab="insert">Insert</button>
			<button class="ribbon-tab" data-tab="layout">Layout</button>
		</div>

		<!-- HOME TAB PANEL -->
		<div class="ribbon-panel active" data-panel="home">
			<!-- Clipboard Section -->
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="save-btn" title="Save (Ctrl+S)">
						<span class="ribbon-btn-icon">💾</span>
						<span class="ribbon-btn-label">Save</span>
					</button>
					<button class="ribbon-btn" id="print-btn" title="Print (Ctrl+P)">
						<span class="ribbon-btn-icon">🖨️</span>
						<span class="ribbon-btn-label">Print</span>
					</button>
					<button class="ribbon-btn" id="export-pdf-btn" title="Export to PDF">
						<span class="ribbon-btn-icon">📄</span>
						<span class="ribbon-btn-label">Export PDF</span>
					</button>
				</div>
				<span class="ribbon-section-label">File</span>
			</div>

			<!-- Undo/Redo Section -->
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn ribbon-btn-small" id="undo-btn" title="Undo (Ctrl+Z)">↶</button>
					<button class="ribbon-btn ribbon-btn-small" id="redo-btn" title="Redo (Ctrl+Y)">↷</button>
				</div>
				<span class="ribbon-section-label">Undo</span>
			</div>

			<!-- Font Section -->
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<select class="ribbon-select" id="font-family-select" title="Font Family">
						<option value="Calibri" selected>Calibri</option>
						<option value="Arial">Arial</option>
						<option value="Times New Roman">Times New Roman</option>
						<option value="Georgia">Georgia</option>
						<option value="Verdana">Verdana</option>
						<option value="Courier New">Courier New</option>
					</select>
					<select class="ribbon-select" id="font-size-select" title="Font Size" style="width: 60px;">
						<option value="8">8</option>
						<option value="9">9</option>
						<option value="10">10</option>
						<option value="11" selected>11</option>
						<option value="12">12</option>
						<option value="14">14</option>
						<option value="16">16</option>
						<option value="18">18</option>
						<option value="20">20</option>
						<option value="24">24</option>
						<option value="28">28</option>
						<option value="36">36</option>
						<option value="48">48</option>
						<option value="72">72</option>
					</select>
				</div>
				<div class="ribbon-section-content">
					<button class="ribbon-btn ribbon-btn-small" id="bold-btn" title="Bold (Ctrl+B)"><strong>B</strong></button>
					<button class="ribbon-btn ribbon-btn-small" id="italic-btn" title="Italic (Ctrl+I)"><em>I</em></button>
					<button class="ribbon-btn ribbon-btn-small" id="underline-btn" title="Underline (Ctrl+U)"><u>U</u></button>
					<button class="ribbon-btn ribbon-btn-small" id="strikethrough-btn" title="Strikethrough"><s>S</s></button>
					<input type="color" class="ribbon-color-picker" id="font-color-picker" value="#000000" title="Font Color">
				</div>
				<span class="ribbon-section-label">Font</span>
			</div>

			<!-- Paragraph Section -->
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn ribbon-btn-small" id="align-left-btn" title="Align Left">⬅</button>
					<button class="ribbon-btn ribbon-btn-small" id="align-center-btn" title="Align Center">⬌</button>
					<button class="ribbon-btn ribbon-btn-small" id="align-right-btn" title="Align Right">➡</button>
				</div>
				<div class="ribbon-section-content">
					<button class="ribbon-btn ribbon-btn-small" id="bullet-list-btn" title="Bullet List">•</button>
					<button class="ribbon-btn ribbon-btn-small" id="ordered-list-btn" title="Numbered List">1.</button>
				</div>
				<span class="ribbon-section-label">Paragraph</span>
			</div>

			<!-- Styles Section -->
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<select class="ribbon-select" id="text-style-select" title="Text Style" style="width: 100px;">
						<option value="paragraph" selected>Normal</option>
						<option value="heading1">Heading 1</option>
						<option value="heading2">Heading 2</option>
						<option value="heading3">Heading 3</option>
						<option value="heading4">Heading 4</option>
					</select>
				</div>
				<span class="ribbon-section-label">Styles</span>
			</div>

			<!-- Signature Section (DocuSign) -->
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="send-signature-btn" title="Send for e-Signature via DocuSign">
						<span class="ribbon-btn-icon">✍️</span>
						<span class="ribbon-btn-label">Send for Signature</span>
					</button>
				</div>
				<span class="ribbon-section-label">Signature</span>
			</div>
		</div>

		<!-- INSERT TAB PANEL -->
		<div class="ribbon-panel" data-panel="insert">
			<!-- Tables Section -->
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="insert-table-btn" title="Insert Table">
						<span class="ribbon-btn-icon">📊</span>
						<span class="ribbon-btn-label">Table</span>
					</button>
				</div>
				<span class="ribbon-section-label">Tables</span>
			</div>

			<!-- Illustrations Section -->
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="insert-image-btn" title="Insert Image">
						<span class="ribbon-btn-icon">🖼️</span>
						<span class="ribbon-btn-label">Picture</span>
					</button>
				</div>
				<span class="ribbon-section-label">Illustrations</span>
			</div>

			<!-- Links Section -->
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="insert-link-btn" title="Insert Link">
						<span class="ribbon-btn-icon">🔗</span>
						<span class="ribbon-btn-label">Link</span>
					</button>
				</div>
				<span class="ribbon-section-label">Links</span>
			</div>

			<!-- Pages Section -->
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="page-break-btn" title="Page Break">
						<span class="ribbon-btn-icon">📄</span>
						<span class="ribbon-btn-label">Page Break</span>
					</button>
					<button class="ribbon-btn" id="insert-hr-btn" title="Horizontal Line">
						<span class="ribbon-btn-icon">━</span>
						<span class="ribbon-btn-label">Line</span>
					</button>
				</div>
				<span class="ribbon-section-label">Pages</span>
			</div>
		</div>

		<!-- LAYOUT TAB PANEL -->
		<div class="ribbon-panel" data-panel="layout">
			<!-- Page Setup Section -->
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<select class="ribbon-select" id="page-size-select" title="Page Size">
						<option value="letter" selected>Letter</option>
						<option value="legal">Legal</option>
						<option value="tabloid">Tabloid</option>
						<option value="a4">A4</option>
						<option value="a3">A3</option>
					</select>
				</div>
				<span class="ribbon-section-label">Size</span>
			</div>

			<!-- Margins Section -->
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<select class="ribbon-select" id="margin-preset-select" title="Margins">
						<option value="normal" selected>Normal</option>
						<option value="narrow">Narrow</option>
						<option value="moderate">Moderate</option>
						<option value="wide">Wide</option>
					</select>
				</div>
				<span class="ribbon-section-label">Margins</span>
			</div>

			<!-- Orientation Section -->
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="orientation-portrait-btn" title="Portrait">
						<span class="ribbon-btn-icon">📃</span>
						<span class="ribbon-btn-label">Portrait</span>
					</button>
					<button class="ribbon-btn" id="orientation-landscape-btn" title="Landscape">
						<span class="ribbon-btn-icon">📃</span>
						<span class="ribbon-btn-label">Landscape</span>
					</button>
				</div>
				<span class="ribbon-section-label">Orientation</span>
			</div>
		</div>
	</div>

	<!-- ============================================
	     DOCUMENT CANVAS
	     ============================================ -->
	<div id="docx-container">
		<!-- Ruler moved inside container for better alignment -->
		<div id="docx-ruler-sticky-wrapper">
			<div id="docx-ruler"></div>
		</div>
	</div>

	<!-- ============================================
	     STATUS BAR
	     ============================================ -->
	<div id="docx-statusbar">
		<div class="statusbar-left">
			<span class="statusbar-item" id="page-count-display">Page 1 of 1</span>
			<span class="statusbar-item" id="word-count-display">0 words</span>
			<span class="statusbar-item" id="status-text">Loading...</span>
		</div>
		<div class="statusbar-right">
			<span class="statusbar-item">
				<button class="ribbon-btn ribbon-btn-small" id="zoom-out-btn" title="Zoom Out">−</button>
				<input type="range" id="zoom-slider" min="50" max="200" value="100" title="Zoom">
				<button class="ribbon-btn ribbon-btn-small" id="zoom-in-btn" title="Zoom In">+</button>
				<span id="zoom-display">100%</span>
			</span>
		</div>
	</div>

	<!-- Load dependencies in order -->
	<script nonce="${nonce}" src="${jszipCdnUri}"></script>
	<script nonce="${nonce}" src="${docxLibUri}"></script>
	<script nonce="${nonce}" src="${tiptapDocxBundleUri}?v=${Date.now()}"></script>
	<script nonce="${nonce}" src="${tiptapBundleUri}?v=${Date.now()}"></script>
	<script nonce="${nonce}" src="${ribbonScriptUri}?v=${Date.now()}"></script>
	<script nonce="${nonce}" src="${scriptUri}?v=${Date.now()}"></script>
</body>
</html>`;
	}
}
