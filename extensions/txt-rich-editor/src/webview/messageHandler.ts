/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Logger } from '../logger';

// Message types for webview communication
export interface BaseMessage {
	type: string;
	requestId?: string;
	timestamp?: number;
}

export interface EditorMessage extends BaseMessage {
	type: 'content-changed' | 'selection-changed' | 'focus-changed' | 'blur-changed';
	data: {
		content?: string;
		selection?: {
			start: number;
			end: number;
			text: string;
		};
		isFocused?: boolean;
	};
}

export interface CommandMessage extends BaseMessage {
	type: 'execute-command';
	data: {
		command: string;
		args?: any[];
	};
}

export interface AIRequestMessage extends BaseMessage {
	type: 'ai-request';
	data: {
		action: 'summarize' | 'grammar' | 'improve' | 'translate';
		content: string;
		options?: Record<string, any>;
	};
}

export interface PageLayoutMessage extends BaseMessage {
	type: 'page-layout-changed';
	data: {
		margins: {
			top: number;
			right: number;
			bottom: number;
			left: number;
		};
		orientation: 'portrait' | 'landscape';
		size: 'letter' | 'a4' | 'legal' | 'tabloid';
		zoom: number;
	};
}

export interface ResponseMessage extends BaseMessage {
	type: 'response';
	data: {
		success: boolean;
		result?: any;
		error?: string;
	};
}

export interface ReadyMessage extends BaseMessage {
	type: 'ready';
}

export interface ErrorMessage extends BaseMessage {
	type: 'error';
	data: {
		message: string;
		stack?: string;
	};
}

export type WebviewMessage =
	| EditorMessage
	| CommandMessage
	| AIRequestMessage
	| PageLayoutMessage
	| ResponseMessage
	| ReadyMessage
	| ErrorMessage;

export interface PendingRequest {
	resolve: (value: any) => void;
	reject: (error: Error) => void;
	timeout: NodeJS.Timeout;
}

export class WebviewMessageHandler {
	private readonly pendingRequests = new Map<string, PendingRequest>();
	private readonly logger: Logger;
	private readonly defaultTimeout = 5000;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	/**
	 * Send message to webview and wait for response
	 */
	async postWithResponse<T>(
		webview: vscode.WebviewPanel,
		message: CommandMessage | AIRequestMessage,
		timeout: number = this.defaultTimeout
	): Promise<T> {
		const requestId = crypto.randomUUID();
		message.requestId = requestId;
		message.timestamp = Date.now();

		return new Promise<T>((resolve, reject) => {
			// Set up timeout
			const timeoutHandle = setTimeout(() => {
				this.pendingRequests.delete(requestId);
				reject(new Error(`Request ${requestId} timed out after ${timeout}ms`));
			}, timeout);

			// Store pending request
			this.pendingRequests.set(requestId, {
				resolve,
				reject,
				timeout: timeoutHandle
			});

			// Send message
			this.logger.info(`Sending message to webview: ${message.type}`);
			webview.webview.postMessage(message);
		});
	}

	/**
	 * Send message to webview without waiting for response
	 */
	postMessage(webview: vscode.WebviewPanel, message: WebviewMessage): void {
		message.timestamp = Date.now();
		this.logger.info(`Posting message to webview: ${message.type}`);
		webview.webview.postMessage(message);
	}

	/**
	 * Handle message from webview
	 */
	handleMessage(message: WebviewMessage): void {
		try {
			this.logger.info(`Received message from webview: ${message.type}`);

			switch (message.type) {
				case 'response':
					this.handleResponse(message as ResponseMessage);
					break;
				case 'content-changed':
					this.handleContentChanged(message as EditorMessage);
					break;
				case 'selection-changed':
					this.handleSelectionChanged(message as EditorMessage);
					break;
				case 'focus-changed':
					this.handleFocusChanged(message as EditorMessage);
					break;
				case 'blur-changed':
					this.handleBlurChanged(message as EditorMessage);
					break;
				case 'page-layout-changed':
					this.handlePageLayoutChanged(message as PageLayoutMessage);
					break;
				case 'ready':
					this.handleReady(message as ReadyMessage);
					break;
				case 'error':
					this.handleError(message as ErrorMessage);
					break;
				default:
					this.logger.warn(`Unknown message type: ${message.type}`);
			}
		} catch (error) {
			this.logger.error('Error handling webview message:', error);
		}
	}

	/**
	 * Handle response message
	 */
	private handleResponse(message: ResponseMessage): void {
		if (!message.requestId) {
			this.logger.warn('Response message missing requestId');
			return;
		}

		const pendingRequest = this.pendingRequests.get(message.requestId);
		if (!pendingRequest) {
			this.logger.warn(`No pending request found for requestId: ${message.requestId}`);
			return;
		}

		// Clear timeout and remove from pending requests
		clearTimeout(pendingRequest.timeout);
		this.pendingRequests.delete(message.requestId);

		// Resolve or reject based on success
		if (message.data.success) {
			pendingRequest.resolve(message.data.result);
		} else {
			pendingRequest.reject(new Error(message.data.error || 'Unknown error'));
		}
	}

	/**
	 * Handle content changed message
	 */
	private handleContentChanged(message: EditorMessage): void {
		this.logger.info('Content changed in webview');

		// Emit event for other parts of the system to listen to
		this.emit('content-changed', message.data);
	}

	/**
	 * Handle selection changed message
	 */
	private handleSelectionChanged(message: EditorMessage): void {
		this.logger.info('Selection changed in webview');

		// Emit event for other parts of the system to listen to
		this.emit('selection-changed', message.data);
	}

	/**
	 * Handle focus changed message
	 */
	private handleFocusChanged(message: EditorMessage): void {
		this.logger.info('Webview gained focus');
		this.emit('focus-changed', message.data);
	}

	/**
	 * Handle blur changed message
	 */
	private handleBlurChanged(message: EditorMessage): void {
		this.logger.info('Webview lost focus');
		this.emit('blur-changed', message.data);
	}

	/**
	 * Handle page layout changed message
	 */
	private handlePageLayoutChanged(message: PageLayoutMessage): void {
		this.logger.info('Page layout changed in webview');

		this.emit('page-layout-changed', message.data);
	}

	/**
	 * Handle ready message
	 */
	private handleReady(message: ReadyMessage): void {
		this.logger.info('Webview is ready');
		this.emit('ready', message);
	}

	/**
	 * Handle error message
	 */
	private handleError(message: ErrorMessage): void {
		this.logger.error('Webview error: ' + message.data.message);

		this.emit('error', message.data);
	}

	/**
	 * Clean up pending requests
	 */
	dispose(): void {
		this.pendingRequests.forEach((request, requestId) => {
			clearTimeout(request.timeout);
			request.reject(new Error(`Request ${requestId} cancelled due to disposal`));
		});
		this.pendingRequests.clear();
	}

	/**
	 * Get pending request count
	 */
	getPendingRequestCount(): number {
		return this.pendingRequests.size;
	}

	/**
	 * Simple event emitter functionality
	 */
	private eventListeners = new Map<string, Function[]>();

	on(event: string, listener: Function): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, []);
		}
		this.eventListeners.get(event)!.push(listener);
	}

	off(event: string, listener: Function): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			const index = listeners.indexOf(listener);
			if (index > -1) {
				listeners.splice(index, 1);
			}
		}
	}

	private emit(event: string, data: any): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			listeners.forEach(listener => {
				try {
					listener(data);
				} catch (error) {
					this.logger.error(`Error in event listener for ${event}:`, error);
				}
			});
		}
	}
}

/**
 * Create a typed message builder
 */
export class MessageBuilder {
	/**
	 * Create a command message
	 */
	static command(command: string, args?: any[]): CommandMessage {
		return {
			type: 'execute-command',
			data: { command, args }
		};
	}

	/**
	 * Create an AI request message
	 */
	static aiRequest(action: 'summarize' | 'grammar' | 'improve' | 'translate', content: string, options?: Record<string, any>): AIRequestMessage {
		return {
			type: 'ai-request',
			data: { action, content, options }
		};
	}

	/**
	 * Create a page layout message
	 */
	static pageLayout(margins: { top: number; right: number; bottom: number; left: number }, orientation: 'portrait' | 'landscape', size: 'letter' | 'a4' | 'legal' | 'tabloid', zoom: number): PageLayoutMessage {
		return {
			type: 'page-layout-changed',
			data: { margins, orientation, size, zoom }
		};
	}

	/**
	 * Create a response message
	 */
	static response(requestId: string, success: boolean, result?: any, error?: string): ResponseMessage {
		return {
			type: 'response',
			requestId,
			data: { success, result, error }
		};
	}

	/**
	 * Create a ready message
	 */
	static ready(): ReadyMessage {
		return {
			type: 'ready'
		};
	}

	/**
	 * Create an error message
	 */
	static error(message: string, stack?: string): ErrorMessage {
		return {
			type: 'error',
			data: { message, stack }
		};
	}
}
