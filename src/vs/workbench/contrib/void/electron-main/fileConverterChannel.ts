/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as path from 'path';
import { spawn } from 'child_process';
import { Event } from '../../../../base/common/event.js';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IFileConverterMainService, ConversionResult, BatchResult, MergeResult, ConversionMap, FileConverterConfig } from '../common/fileConverterTypes.js';

export class FileConverterMainService implements IFileConverterMainService {

	private pythonProcess: any = null;
	private pythonProcessPromise: Promise<any> | null = null;
	private pythonPath: string = 'python'; // Default to system Python
	private configured: boolean = false;

	constructor() {
		// Initialize Python process lazily when first needed
	}

	async configure(config: FileConverterConfig): Promise<void> {
		// If Python path changed and we have a running process, kill it
		if (this.configured && config.pythonPath !== this.pythonPath && this.pythonProcess) {
			console.log('[FileConverterMainService] Python path changed, restarting process');
			this.pythonProcess.kill();
			this.pythonProcess = null;
			this.pythonProcessPromise = null;
		}

		this.pythonPath = config.pythonPath && config.pythonPath.trim() ? config.pythonPath.trim() : 'python';
		this.configured = true;

		console.log('[FileConverterMainService] Configured with Python path:', this.pythonPath);
	}

	private async getPythonProcess(): Promise<any> {
		if (this.pythonProcessPromise) {
			return this.pythonProcessPromise;
		}

		this.pythonProcessPromise = this.spawnPythonProcess();
		return this.pythonProcessPromise;
	}

	private async spawnPythonProcess(): Promise<any> {
		return new Promise((resolve, reject) => {
			try {
				// Get the path to the Python backend
				const pythonDir = path.join(__dirname, '..', '..', '..', '..', 'python');
				const bridgePath = path.join(pythonDir, 'transmutation_codex', 'adapters', 'bridges', 'electron_bridge.py');

				console.log('[FileConverterMainService] Spawning Python process:', {
					pythonDir,
					bridgePath,
					pythonExecutable: this.pythonPath,
					exists: require('fs').existsSync(bridgePath)
				});

				// Spawn Python process with configured Python path
				this.pythonProcess = spawn(this.pythonPath, [bridgePath], {
					cwd: pythonDir,
					stdio: ['pipe', 'pipe', 'pipe'],
					env: {
						...process.env,
						PYTHONPATH: pythonDir
					}
				});

				let stdoutBuffer = '';
				let stderrBuffer = '';

				this.pythonProcess.stdout.on('data', (data: Buffer) => {
					const output = data.toString();
					console.log('[FileConverterMainService] Python stdout:', output.trim());

					// Parse JSON messages with prefixes
					const lines = output.split('\n');
					for (const line of lines) {
						if (line.trim()) {
							stdoutBuffer += line;
							this.parsePythonMessage(stdoutBuffer);
							stdoutBuffer = ''; // Clear buffer after processing
						}
					}
				});

				this.pythonProcess.stderr.on('data', (data: Buffer) => {
					const output = data.toString();
					console.log('[FileConverterMainService] Python stderr:', output.trim());

					// Parse JSON messages with prefixes from stderr too
					const lines = output.split('\n');
					for (const line of lines) {
						if (line.trim()) {
							stderrBuffer += line;
							this.parsePythonMessage(stderrBuffer);
							stderrBuffer = ''; // Clear buffer after processing
						}
					}
				});

				this.pythonProcess.on('error', (error: Error) => {
					console.error('[FileConverterMainService] Python process error:', error);
					this.pythonProcessPromise = null;
					reject(error);
				});

				this.pythonProcess.on('exit', (code: number, signal: string) => {
					console.log('[FileConverterMainService] Python process exited:', { code, signal });
					this.pythonProcess = null;
					this.pythonProcessPromise = null;
				});

				// Wait a bit for process to initialize
				setTimeout(() => {
					if (this.pythonProcess) {
						resolve(this.pythonProcess);
					} else {
						reject(new Error('Python process failed to start'));
					}
				}, 1000);

			} catch (error) {
				console.error('[FileConverterMainService] Failed to spawn Python process:', error);
				this.pythonProcessPromise = null;
				reject(error);
			}
		});
	}

	private parsePythonMessage(message: string): void {
		try {
			let jsonData: any = null;

			// Parse messages with prefixes
			if (message.startsWith('PROGRESS:')) {
				const jsonStr = message.substring('PROGRESS:'.length).trim();
				jsonData = JSON.parse(jsonStr);
				console.log('[FileConverterMainService] Progress update:', jsonData);
				// TODO: Emit progress event to browser
			} else if (message.startsWith('RESULT:')) {
				const jsonStr = message.substring('RESULT:'.length).trim();
				jsonData = JSON.parse(jsonStr);
				console.log('[FileConverterMainService] Conversion result:', jsonData);
				// TODO: Store result for retrieval
			} else if (message.startsWith('ERROR:')) {
				const jsonStr = message.substring('ERROR:'.length).trim();
				jsonData = JSON.parse(jsonStr);
				console.error('[FileConverterMainService] Conversion error:', jsonData);
				// TODO: Handle error
			} else if (message.startsWith('LOG_MESSAGE:')) {
				const jsonStr = message.substring('LOG_MESSAGE:'.length).trim();
				jsonData = JSON.parse(jsonStr);
				console.log('[FileConverterMainService] Python log:', jsonData);
			}
		} catch (error) {
			console.error('[FileConverterMainService] Failed to parse Python message:', message, error);
		}
	}

	private async sendCommandToPython(command: string, args: any[]): Promise<any> {
		const pythonProcess = await this.getPythonProcess();

		return new Promise((resolve, reject) => {
			try {
				// Create command message
				const message = JSON.stringify({
					command,
					args,
					timestamp: Date.now()
				});

				console.log('[FileConverterMainService] Sending command to Python:', { command, args });

				// Send message to Python process
				pythonProcess.stdin.write(message + '\n');

				// For now, resolve immediately - in a real implementation,
				// we'd need to correlate responses with requests
				resolve({ success: true });

			} catch (error) {
				console.error('[FileConverterMainService] Failed to send command:', error);
				reject(error);
			}
		});
	}

	async convert(input: string, output: string, type: string, options?: any): Promise<ConversionResult> {
		try {
			console.log('[FileConverterMainService] Starting conversion:', { input, output, type, options });

			await this.sendCommandToPython('convert', [input, output, type, options]);

			// For now, return a placeholder result
			// In a real implementation, we'd wait for the RESULT message
			return {
				success: true,
				output_path: output,
				duration: 0
			};

		} catch (error) {
			console.error('[FileConverterMainService] Conversion failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				error_type: 'conversion'
			};
		}
	}

	async batchConvert(files: string[], outputDir: string, type: string): Promise<BatchResult> {
		try {
			console.log('[FileConverterMainService] Starting batch conversion:', { files, outputDir, type });

			await this.sendCommandToPython('batch_convert', [files, outputDir, type]);

			// For now, return a placeholder result
			return {
				success: true,
				results: files.map(() => ({ success: true }))
			};

		} catch (error) {
			console.error('[FileConverterMainService] Batch conversion failed:', error);
			return {
				success: false,
				results: []
			};
		}
	}

	async mergePDFs(files: string[], output: string): Promise<MergeResult> {
		try {
			console.log('[FileConverterMainService] Starting PDF merge:', { files, output });

			await this.sendCommandToPython('merge_pdfs', [files, output]);

			// For now, return a placeholder result
			return {
				success: true,
				output_path: output
			};

		} catch (error) {
			console.error('[FileConverterMainService] PDF merge failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	async getAvailableConversions(): Promise<ConversionMap> {
		try {
			console.log('[FileConverterMainService] Getting available conversions');

			await this.sendCommandToPython('get_available_conversions', []);

			// Return a sample conversion map for now
			return {
				'md2pdf': {
					source_formats: ['md', 'markdown'],
					target_formats: ['pdf'],
					description: 'Convert Markdown to PDF'
				},
				'pdf2md': {
					source_formats: ['pdf'],
					target_formats: ['md', 'markdown'],
					description: 'Convert PDF to Markdown'
				}
				// TODO: Add all supported conversions
			};

		} catch (error) {
			console.error('[FileConverterMainService] Failed to get conversions:', error);
			return {};
		}
	}

	dispose(): void {
		if (this.pythonProcess) {
			console.log('[FileConverterMainService] Disposing Python process');
			this.pythonProcess.kill();
			this.pythonProcess = null;
			this.pythonProcessPromise = null;
		}
	}
}

export class FileConverterChannel implements IServerChannel {

	constructor(private service: FileConverterMainService) { }

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	async call(_: unknown, command: string, arg?: any): Promise<any> {
		switch (command) {
			case 'configure':
				const { pythonPath } = arg || {};
				return this.service.configure({ pythonPath });

			case 'convert':
				const { input, output, type, options } = arg;
				return this.service.convert(input, output, type, options);

			case 'batchConvert':
				const { files, outputDir, batchType } = arg;
				return this.service.batchConvert(files, outputDir, batchType);

			case 'mergePDFs':
				const { pdfFiles, mergeOutput } = arg;
				return this.service.mergePDFs(pdfFiles, mergeOutput);

			case 'getAvailableConversions':
				return this.service.getAvailableConversions();

			default:
				throw new Error(`Call not found: ${command}`);
		}
	}
}
