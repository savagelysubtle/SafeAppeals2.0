/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type * as vscode from 'vscode';
import type { CloudApiClient } from '../api';
import type { CloudAuthProvider } from '../cloudAuthProvider';
import { CloudChatProvider } from '../llm/cloudChatProvider';

suite('CloudChatProvider disposal', () => {
	test('aborts an active response so shutdown cannot cross the ACK boundary', async () => {
		let activeSignal: AbortSignal | undefined;
		let markStarted!: () => void;
		const started = new Promise<void>(resolve => markStarted = resolve);
		const auth = {
			onDidChangeSessions: () => ({ dispose() { } }),
		} as unknown as CloudAuthProvider;
		const api = {
			streamChat: async (
				_body: object,
				_onPart: (part: object) => void,
				signal?: AbortSignal,
			): Promise<void> => {
				activeSignal = signal;
				markStarted();
				await new Promise<void>((_resolve, reject) => signal?.addEventListener('abort', () => {
					const error = new Error('Aborted');
					error.name = 'AbortError';
					reject(error);
				}, { once: true }));
			},
		} as CloudApiClient;
		const output = { appendLine: (_line: string) => { /* test stub */ } } as vscode.OutputChannel;
		const provider = new CloudChatProvider(auth, api, output);
		const response = provider.provideLanguageModelChatResponse(
			{ id: 'model', maxOutputTokens: 100 } as vscode.LanguageModelChatInformation,
			[],
			{} as vscode.ProvideLanguageModelChatResponseOptions,
			{ report: (_part: vscode.LanguageModelResponsePart) => { /* no parts expected */ } },
			{
				isCancellationRequested: false,
				onCancellationRequested: () => ({ dispose() { } }),
			} as vscode.CancellationToken,
		);
		await started;
		provider.dispose();
		await response;
		assert.strictEqual(activeSignal?.aborted, true);
	});
});
