/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IChatTerminalToolInvocationData } from './chatService/chatService.js';

type TerminalCommandOutput = NonNullable<IChatTerminalToolInvocationData['terminalCommandOutput']>;

const transientTerminalCommandOutputs = new WeakMap<IChatTerminalToolInvocationData, TerminalCommandOutput>();

export function setTransientTerminalCommandOutput(data: IChatTerminalToolInvocationData, output: TerminalCommandOutput): void {
	transientTerminalCommandOutputs.set(data, output);
}

export function getTransientTerminalCommandOutput(data: IChatTerminalToolInvocationData): TerminalCommandOutput | undefined {
	return transientTerminalCommandOutputs.get(data);
}

export function clearTransientTerminalCommandOutput(data: IChatTerminalToolInvocationData): void {
	transientTerminalCommandOutputs.delete(data);
}

export function resolveTerminalCommandOutput(data: IChatTerminalToolInvocationData): TerminalCommandOutput | undefined {
	return data.terminalCommandOutput ?? getTransientTerminalCommandOutput(data);
}
