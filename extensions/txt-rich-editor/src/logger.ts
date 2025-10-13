/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Logger for the Rich Text Editor extension
 * Uses VS Code's output channel with log level support
 */
export class Logger {
	private outputChannel: vscode.LogOutputChannel;

	constructor(name: string = 'Rich Text Editor') {
		this.outputChannel = vscode.window.createOutputChannel(name, { log: true });
	}

	/**
	 * Log an error message
	 */
	public error(message: string, error?: Error | unknown): void {
		if (error instanceof Error) {
			this.outputChannel.error(`${message}: ${error.message}`);
			if (error.stack) {
				this.outputChannel.error(error.stack);
			}
		} else if (error) {
			this.outputChannel.error(`${message}: ${JSON.stringify(error)}`);
		} else {
			this.outputChannel.error(message);
		}
	}

	/**
	 * Log a warning message
	 */
	public warn(message: string): void {
		this.outputChannel.warn(message);
	}

	/**
	 * Log an info message
	 */
	public info(message: string): void {
		this.outputChannel.info(message);
	}

	/**
	 * Log a debug/trace message
	 */
	public trace(message: string): void {
		this.outputChannel.trace(message);
	}

	/**
	 * Show the output channel
	 */
	public show(preserveFocus?: boolean): void {
		this.outputChannel.show(preserveFocus);
	}

	/**
	 * Clear all output
	 */
	public clear(): void {
		this.outputChannel.clear();
	}

	/**
	 * Dispose of the logger
	 */
	public dispose(): void {
		this.outputChannel.dispose();
	}
}

