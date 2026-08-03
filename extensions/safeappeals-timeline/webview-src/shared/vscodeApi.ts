/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { HostToWebviewMessage, WebviewToHostMessage } from './types';

interface VsCodeApi {
	postMessage(message: WebviewToHostMessage): void;
	getState(): unknown;
	setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

export function postToHost(message: WebviewToHostMessage): void {
	vscode.postMessage(message);
}

export function onHostMessage(handler: (message: HostToWebviewMessage) => void): () => void {
	const listener = (event: MessageEvent<HostToWebviewMessage>) => {
		if (event.data && typeof event.data === 'object' && 'type' in event.data) {
			handler(event.data);
		}
	};
	window.addEventListener('message', listener);
	return () => window.removeEventListener('message', listener);
}
