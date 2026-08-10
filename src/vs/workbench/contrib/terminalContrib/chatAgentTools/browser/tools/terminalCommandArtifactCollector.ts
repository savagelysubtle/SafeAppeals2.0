/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../../base/common/uri.js';
import { IChatTerminalToolInvocationData } from '../../../../chat/common/chatService/chatService.js';
import { ITerminalInstance } from '../../../../terminal/browser/terminal.js';
import { getCommandOutputSnapshot } from '../../../../terminal/browser/chatTerminalCommandMirror.js';
import { TerminalCapability, type ITerminalCommand } from '../../../../../../platform/terminal/common/capabilities/capabilities.js';
import { ITerminalLogService } from '../../../../../../platform/terminal/common/terminal.js';
import { removeAnsiEscapeCodes } from '../../../../../../base/common/strings.js';
import { MAX_OUTPUT_LENGTH, truncateLargeOutput } from '../outputHelpers.js';
import { clearTransientTerminalCommandOutput, setTransientTerminalCommandOutput } from '../../../../chat/common/terminalCommandOutput.js';

export function createTerminalCommandOutputSnapshot(output: string): NonNullable<IChatTerminalToolInvocationData['terminalCommandOutput']> {
	const sanitizedOutput = removeAnsiEscapeCodes(output);
	const truncated = sanitizedOutput.length > MAX_OUTPUT_LENGTH;
	const text = truncated ? truncateLargeOutput(sanitizedOutput) : sanitizedOutput;
	return {
		text,
		lineCount: text.length === 0 ? 0 : text.split(/\r?\n/).length,
		truncated: truncated || undefined,
	};
}

export interface ITerminalCommandArtifactSource {
	readonly resource: URI;
	getCommand(commandId: string): Promise<ITerminalCommand | undefined>;
	captureCommandOutput(command: ITerminalCommand): Promise<IChatTerminalToolInvocationData['terminalCommandOutput'] | undefined>;
	capturePartialCommandOutput(commandId: string): Promise<IChatTerminalToolInvocationData['terminalCommandOutput'] | undefined>;
	getTheme(): IChatTerminalToolInvocationData['terminalTheme'] | undefined;
}

export class TerminalCommandArtifactCollector {
	constructor(
		@ITerminalLogService private readonly _logService: ITerminalLogService,
	) { }

	async capture(
		toolSpecificData: IChatTerminalToolInvocationData,
		instance: ITerminalInstance,
		commandId: string | undefined,
		capturedOutput?: string,
	): Promise<void> {
		return this.captureFromSource(toolSpecificData, this._createSource(instance), commandId, capturedOutput);
	}

	async captureFromSource(
		toolSpecificData: IChatTerminalToolInvocationData,
		source: ITerminalCommandArtifactSource,
		commandId: string | undefined,
		capturedOutput?: string,
	): Promise<void> {
		if (commandId) {
			try {
				toolSpecificData.terminalCommandUri = this._createTerminalCommandUri(source.resource, commandId);
			} catch (error) {
				this._logService.warn(`RunInTerminalTool: Failed to create terminal command URI for ${commandId}`, error);
			}

			const command = await source.getCommand(commandId);
			if (command) {
				toolSpecificData.terminalCommandState = {
					exitCode: command.exitCode,
					timestamp: command.timestamp,
					duration: command.duration
				};
				const snapshot = await source.captureCommandOutput(command);
				if (snapshot) {
					toolSpecificData.terminalCommandOutput = snapshot;
					clearTransientTerminalCommandOutput(toolSpecificData);
				} else if (capturedOutput !== undefined) {
					setTransientTerminalCommandOutput(toolSpecificData, createTerminalCommandOutputSnapshot(capturedOutput));
				}
				this._applyTheme(toolSpecificData, source);
				return;
			}

			if (capturedOutput !== undefined) {
				setTransientTerminalCommandOutput(toolSpecificData, createTerminalCommandOutputSnapshot(capturedOutput));
			} else {
				// Only inspect the active terminal when no execution-scoped output is available.
				const partialSnapshot = await source.capturePartialCommandOutput(commandId);
				if (partialSnapshot) {
					toolSpecificData.terminalCommandOutput = partialSnapshot;
					clearTransientTerminalCommandOutput(toolSpecificData);
					this._logService.debug(`RunInTerminalTool: Captured partial command output for ${commandId}`);
				}
			}
		}

		if (!toolSpecificData.terminalCommandOutput && capturedOutput !== undefined) {
			setTransientTerminalCommandOutput(toolSpecificData, createTerminalCommandOutputSnapshot(capturedOutput));
		}

		this._applyTheme(toolSpecificData, source);
	}

	private _createSource(instance: ITerminalInstance): ITerminalCommandArtifactSource {
		return {
			resource: instance.resource,
			getCommand: commandId => this._tryGetCommand(instance, commandId),
			captureCommandOutput: command => this._captureCommandOutput(instance, command),
			capturePartialCommandOutput: commandId => this._capturePartialCommandOutput(instance, commandId),
			getTheme: () => {
				const theme = instance.xterm?.getXtermTheme();
				return theme ? { background: theme.background, foreground: theme.foreground } : undefined;
			},
		};
	}

	private async _captureCommandOutput(instance: ITerminalInstance, command: ITerminalCommand): Promise<IChatTerminalToolInvocationData['terminalCommandOutput'] | undefined> {
		try {
			await instance.xtermReadyPromise;
		} catch {
			return undefined;
		}
		const xterm = instance.xterm;
		if (!xterm) {
			return undefined;
		}

		return getCommandOutputSnapshot(xterm, command, (reason, error) => {
			const suffix = reason === 'fallback' ? ' (fallback)' : '';
			this._logService.debug(`RunInTerminalTool: Failed to snapshot command output${suffix}`, error);
		});
	}

	/**
	 * Captures output from a partial/current command that hasn't finished yet.
	 * This is used when the command is cancelled mid-execution.
	 */
	private async _capturePartialCommandOutput(instance: ITerminalInstance, commandId: string): Promise<IChatTerminalToolInvocationData['terminalCommandOutput'] | undefined> {
		try {
			await instance.xtermReadyPromise;
		} catch {
			return undefined;
		}
		const xterm = instance.xterm;
		if (!xterm) {
			return undefined;
		}

		// Try to find the current/partial command
		const commandDetection = instance.capabilities.get(TerminalCapability.CommandDetection);
		const currentCommand = commandDetection?.currentCommand;
		if (currentCommand && (currentCommand as { id?: string }).id === commandId) {
			// Use commandExecutedMarker from partial command
			const executedMarker = currentCommand.commandExecutedMarker;
			if (executedMarker && !executedMarker.isDisposed) {
				try {
					// Get text from executed marker to current cursor position
					const raw = xterm.raw;
					const buffer = raw.buffer.active;
					const endLine = buffer.baseY + buffer.cursorY;
					const startLine = executedMarker.line;
					const lineCount = Math.max(endLine - startLine, 0);

					if (lineCount > 0) {
						const text = await xterm.getRangeAsVT(executedMarker, undefined, true);
						if (text) {
							return { text, lineCount };
						}
					}
				} catch (error) {
					this._logService.debug(`RunInTerminalTool: Failed to capture partial command output`, error);
				}
			}
		}

		return undefined;
	}

	private _applyTheme(toolSpecificData: IChatTerminalToolInvocationData, source: ITerminalCommandArtifactSource): void {
		const theme = source.getTheme();
		if (theme) {
			toolSpecificData.terminalTheme = theme;
		}
	}

	private _createTerminalCommandUri(resource: URI, commandId: string): URI {
		const params = new URLSearchParams(resource.query);
		params.set('command', commandId);
		return resource.with({ query: params.toString() });
	}

	private async _tryGetCommand(instance: ITerminalInstance, commandId: string) {
		const commandDetection = instance.capabilities.get(TerminalCapability.CommandDetection);
		return commandDetection?.commands.find(c => c.id === commandId);
	}
}
