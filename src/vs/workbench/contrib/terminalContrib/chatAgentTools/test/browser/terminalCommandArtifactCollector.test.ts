/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import type { ITerminalCommand } from '../../../../../../platform/terminal/common/capabilities/capabilities.js';
import { NullLogService } from '../../../../../../platform/log/common/log.js';
import type { ITerminalLogService } from '../../../../../../platform/terminal/common/terminal.js';
import type { IChatTerminalToolInvocationData } from '../../../../chat/common/chatService/chatService.js';
import { MAX_OUTPUT_LENGTH } from '../../browser/outputHelpers.js';
import { createTerminalCommandOutputSnapshot, type ITerminalCommandArtifactSource, TerminalCommandArtifactCollector } from '../../browser/tools/terminalCommandArtifactCollector.js';
import { getTransientTerminalCommandOutput, resolveTerminalCommandOutput, setTransientTerminalCommandOutput } from '../../../../chat/common/terminalCommandOutput.js';

class TestTerminalLogService extends NullLogService implements ITerminalLogService {
	declare _serviceBrand: undefined;
	declare _logBrand: undefined;
}

const logService = new TestTerminalLogService();

function createToolSpecificData(): IChatTerminalToolInvocationData {
	return {
		kind: 'terminal',
		language: 'shellscript',
		commandLine: { original: 'echo hello' },
	};
}

function createSource(options?: {
	command?: ITerminalCommand;
	richOutput?: string;
	onPartialCapture?: () => void;
}): ITerminalCommandArtifactSource {
	return {
		resource: URI.parse('terminal://test/1'),
		getCommand: async () => options?.command,
		captureCommandOutput: async () => options?.richOutput === undefined ? undefined : { text: options.richOutput, lineCount: 1 },
		capturePartialCommandOutput: async () => {
			options?.onPartialCapture?.();
			return undefined;
		},
		getTheme: () => undefined,
	};
}

suite('TerminalCommandArtifactCollector', () => {
	test('creates a valid snapshot for empty output', () => {
		assert.deepStrictEqual(createTerminalCommandOutputSnapshot(''), {
			text: '',
			lineCount: 0,
			truncated: undefined,
		});
	});

	test('sanitizes and bounds captured output', () => {
		const snapshot = createTerminalCommandOutputSnapshot(`\x1b[31mred\x1b[0m\n${'x'.repeat(MAX_OUTPUT_LENGTH)}`);

		assert.deepStrictEqual({
			containsEscape: snapshot.text.includes('\x1b'),
			isBounded: snapshot.text.length <= MAX_OUTPUT_LENGTH,
			truncated: snapshot.truncated,
		}, {
			containsEscape: false,
			isBounded: true,
			truncated: true,
		});
	});

	test('prefers a rich detected-command snapshot over captured output', async () => {
		const command: ITerminalCommand = Object.create(null);
		Object.assign(command, { id: 'command-id' });
		const toolSpecificData = createToolSpecificData();
		setTransientTerminalCommandOutput(toolSpecificData, { text: 'old fallback', lineCount: 1 });

		await new TerminalCommandArtifactCollector(logService).captureFromSource(toolSpecificData, createSource({ command, richOutput: 'rich output' }), command.id, 'fallback output');

		assert.deepStrictEqual({
			persisted: toolSpecificData.terminalCommandOutput,
			transient: getTransientTerminalCommandOutput(toolSpecificData),
		}, {
			persisted: { text: 'rich output', lineCount: 1 },
			transient: undefined,
		});
	});

	test('uses captured output without command detection or shell integration', async () => {
		const toolSpecificData = createToolSpecificData();

		await new TerminalCommandArtifactCollector(logService).captureFromSource(toolSpecificData, createSource(), 'command-id', 'fallback output');

		assert.deepStrictEqual({
			resolved: resolveTerminalCommandOutput(toolSpecificData),
			persisted: toolSpecificData.terminalCommandOutput,
			serialized: JSON.parse(JSON.stringify(toolSpecificData)).terminalCommandOutput,
		}, {
			resolved: { text: 'fallback output', lineCount: 1, truncated: undefined },
			persisted: undefined,
			serialized: undefined,
		});
	});

	test('retains empty captured output', async () => {
		const toolSpecificData = createToolSpecificData();

		await new TerminalCommandArtifactCollector(logService).captureFromSource(toolSpecificData, createSource(), undefined, '');

		assert.deepStrictEqual(resolveTerminalCommandOutput(toolSpecificData), {
			text: '',
			lineCount: 0,
			truncated: undefined,
		});
	});

	test('uses execution-scoped partial output without reading the active buffer', async () => {
		let didReadBuffer = false;
		const toolSpecificData = createToolSpecificData();

		await new TerminalCommandArtifactCollector(logService).captureFromSource(toolSpecificData, createSource({
			onPartialCapture: () => { didReadBuffer = true; },
		}), 'command-id', 'scoped partial output');

		assert.deepStrictEqual({
			output: resolveTerminalCommandOutput(toolSpecificData),
			didReadBuffer,
		}, {
			output: {
				text: 'scoped partial output',
				lineCount: 1,
				truncated: undefined,
			},
			didReadBuffer: false,
		});
	});

	test('isolates transient output by invocation data object', () => {
		const first = createToolSpecificData();
		const second = createToolSpecificData();
		setTransientTerminalCommandOutput(first, { text: 'first' });
		setTransientTerminalCommandOutput(second, { text: 'second' });

		assert.deepStrictEqual({
			first: resolveTerminalCommandOutput(first)?.text,
			second: resolveTerminalCommandOutput(second)?.text,
		}, {
			first: 'first',
			second: 'second',
		});
	});
});
