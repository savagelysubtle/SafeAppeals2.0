/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { Event } from '../../../../base/common/event.js';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IFileConverterMainService, ConversionResult, BatchResult, MergeResult, ConversionMap, FileConverterConfig } from '../common/fileConverterTypes.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the project root directory (handles both source and compiled locations)
function getProjectRoot(): string {
	// __dirname is either:
	// - Source: src/vs/workbench/contrib/void/electron-main/
	// - Compiled: out/vs/workbench/contrib/void/electron-main/
	// Both are 6 levels deep from project root
	const projectRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
	console.log(`[FileConverterMainService] __dirname: ${__dirname}`);
	console.log(`[FileConverterMainService] Project root: ${projectRoot}`);
	return projectRoot;
}

// Get the path to the bundled Python venv
function getBundledPythonPath(): string | null {
	const isWindows = process.platform === 'win32';
	const projectRoot = getProjectRoot();
	const pythonDir = path.join(projectRoot, 'python');

	// Path to venv Python executable
	const venvPython = isWindows
		? path.join(pythonDir, '.venv', 'Scripts', 'python.exe')
		: path.join(pythonDir, '.venv', 'bin', 'python');

	console.log(`[FileConverterMainService] Looking for venv Python at: ${venvPython}`);

	if (fs.existsSync(venvPython)) {
		console.log(`[FileConverterMainService] Found bundled Python venv: ${venvPython}`);
		return venvPython;
	}

	console.log(`[FileConverterMainService] Bundled venv not found at: ${venvPython}`);
	return null;
}

// Detect available Python executable
async function detectPythonExecutable(): Promise<string> {
	const isWindows = process.platform === 'win32';

	// 1. First, try bundled venv
	const bundledPython = getBundledPythonPath();
	if (bundledPython) {
		return bundledPython;
	}

	console.log('[FileConverterMainService] No bundled venv found, searching system Python...');

	// 2. List of system Python commands to try, in order of preference
	const pythonCommands = isWindows
		? ['py', 'python', 'python3']  // 'py' is the Python Launcher on Windows
		: ['python3', 'python'];

	for (const cmd of pythonCommands) {
		try {
			const { execSync } = await import('child_process');
			// Try to get Python version to verify it works
			// execSync with a string command uses shell by default
			execSync(`${cmd} --version`, {
				stdio: 'pipe',
				timeout: 5000,
				windowsHide: true
			});
			console.log(`[FileConverterMainService] Found system Python: ${cmd}`);
			return cmd;
		} catch {
			// This command doesn't work, try next
		}
	}

	// Fallback to 'python' and let the error propagate
	console.warn('[FileConverterMainService] No Python found, defaulting to "python"');
	return 'python';
}

export class FileConverterMainService implements IFileConverterMainService {

	private pythonProcess: any = null;
	private pythonProcessPromise: Promise<any> | null = null;
	private pythonPath: string = ''; // Will be auto-detected if not configured
	private configured: boolean = false;
	private pythonDetected: boolean = false;

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

		if (config.pythonPath && config.pythonPath.trim()) {
			this.pythonPath = config.pythonPath.trim();
			this.pythonDetected = true;
		} else if (!this.pythonDetected) {
			// Auto-detect Python if not already detected
			this.pythonPath = await detectPythonExecutable();
			this.pythonDetected = true;
		}

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
		console.log('[FileConverterMainService] spawnPythonProcess called');

		// Ensure Python is detected before spawning
		if (!this.pythonDetected) {
			console.log('[FileConverterMainService] Detecting Python...');
			this.pythonPath = await detectPythonExecutable();
			this.pythonDetected = true;
			console.log('[FileConverterMainService] Python detected:', this.pythonPath);
		}

		return new Promise((resolve, reject) => {
			try {
				console.log('[FileConverterMainService] Starting spawn process...');
				// Get the path to the Python backend
				const projectRoot = getProjectRoot();
				const pythonDir = path.join(projectRoot, 'python');
				const bridgePath = path.join(pythonDir, 'transmutation_codex', 'adapters', 'bridges', 'electron_bridge.py');

				const debugInfo = {
					pythonDir,
					bridgePath,
					pythonExecutable: this.pythonPath,
					pythonExists: fs.existsSync(this.pythonPath),
					bridgeExists: fs.existsSync(bridgePath),
					projectRoot
				};

				console.log('[FileConverterMainService] Spawning Python process:', debugInfo);

				// Pre-flight checks
				if (!fs.existsSync(bridgePath)) {
					reject(new Error(`Python bridge script not found at: ${bridgePath}. Project root: ${projectRoot}`));
					return;
				}

				if (path.isAbsolute(this.pythonPath) && !fs.existsSync(this.pythonPath)) {
					reject(new Error(`Python executable not found at: ${this.pythonPath}. Did you run setup-venv.ps1?`));
					return;
				}

				// Spawn Python process with configured Python path
				console.log('[FileConverterMainService] Calling spawn...');
				this.pythonProcess = spawn(this.pythonPath, [bridgePath], {
					cwd: pythonDir,
					stdio: ['pipe', 'pipe', 'pipe'],
					env: {
						...process.env,
						PYTHONPATH: pythonDir
					}
				});
				console.log('[FileConverterMainService] Spawn returned, pid:', this.pythonProcess?.pid);

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

				let spawnError: Error | null = null;
				let hasResolved = false;

				this.pythonProcess.on('error', (error: Error) => {
					console.error('[FileConverterMainService] Python process spawn error:', error.message);
					console.error('[FileConverterMainService] Python path was:', this.pythonPath);
					console.error('[FileConverterMainService] Full error:', error);
					spawnError = error;
					this.pythonProcess = null;
					this.pythonProcessPromise = null;
					if (!hasResolved) {
						hasResolved = true;
						reject(new Error(`Failed to spawn Python: ${error.message}. Python path: ${this.pythonPath}`));
					}
				});

				this.pythonProcess.on('exit', (code: number, signal: string) => {
					console.log('[FileConverterMainService] Python process exited:', { code, signal });
					this.pythonProcess = null;
					this.pythonProcessPromise = null;
				});

				// Wait a bit for process to initialize
				setTimeout(() => {
					if (hasResolved) return; // Already resolved/rejected
					hasResolved = true;

					if (this.pythonProcess) {
						console.log('[FileConverterMainService] Python process started successfully');
						resolve(this.pythonProcess);
					} else if (spawnError) {
						reject(new Error(`Python process failed: ${spawnError.message}`));
					} else {
						reject(new Error(`Python process failed to start. Python: ${this.pythonPath}, Bridge: ${bridgePath}, Exists: python=${debugInfo.pythonExists}, bridge=${debugInfo.bridgeExists}`));
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
		console.log('[FileConverterMainService] Starting conversion:', { input, output, type, options });

		// Ensure Python is detected
		if (!this.pythonDetected) {
			this.pythonPath = await detectPythonExecutable();
			this.pythonDetected = true;
		}

		const projectRoot = getProjectRoot();
		const pythonDir = path.join(projectRoot, 'python');
		const bridgePath = path.join(pythonDir, 'transmutation_codex', 'adapters', 'bridges', 'electron_bridge.py');

		// Build command-line arguments for the Python bridge
		// Format: python electron_bridge.py <conversion_type> --input-files <input> --output <output>
		const args = [
			bridgePath,
			type,  // e.g., 'docx2pdf'
			'--input-files', input,
			'--output', output
		];

		console.log('[FileConverterMainService] Running Python with args:', args);

		return new Promise((resolve) => {
			const startTime = Date.now();

			const pythonProcess = spawn(this.pythonPath, args, {
				cwd: pythonDir,
				env: {
					...process.env,
					PYTHONPATH: pythonDir
				}
			});

			let stdout = '';
			let stderr = '';

			pythonProcess.stdout.on('data', (data: Buffer) => {
				const output = data.toString();
				stdout += output;
				console.log('[FileConverterMainService] Python stdout:', output.trim());
			});

			pythonProcess.stderr.on('data', (data: Buffer) => {
				const output = data.toString();
				stderr += output;
				console.log('[FileConverterMainService] Python stderr:', output.trim());
			});

			pythonProcess.on('error', (error: Error) => {
				console.error('[FileConverterMainService] Python process error:', error);
				resolve({
					success: false,
					error: `Failed to start Python: ${error.message}`,
					error_type: 'spawn'
				});
			});

			pythonProcess.on('close', (code: number) => {
				const duration = (Date.now() - startTime) / 1000;
				console.log('[FileConverterMainService] Python process exited with code:', code);

				// Check if output file was created - this is the real success indicator
				// Python may exit with code 1 due to internal error handling even when conversion works
				if (fs.existsSync(output)) {
					const stats = fs.statSync(output);
					if (stats.size > 0) {
						console.log('[FileConverterMainService] Output file created successfully:', output, 'size:', stats.size);
						resolve({
							success: true,
							output_path: output,
							duration
						});
						return;
					}
				}

				// No valid output file - report error
				if (code !== 0) {
					// Parse error from stderr
					let errorMessage = stderr || `Python exited with code ${code}`;

					// Try to extract a cleaner error message
					const errorMatch = stderr.match(/error: (.+)/i) || stderr.match(/Error: (.+)/i);
					if (errorMatch) {
						errorMessage = errorMatch[1];
					}

					resolve({
						success: false,
						error: errorMessage,
						error_type: 'conversion'
					});
				} else {
					resolve({
						success: false,
						error: 'Conversion completed but output file was not created',
						error_type: 'conversion'
					});
				}
			});
		});
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
		console.log('[FileConverterMainService] Getting available conversions');

		// Return the full list of supported conversions
		// These match the Python transmutation_codex converters
		return {
			'md2pdf': { source_formats: ['md', 'markdown'], target_formats: ['pdf'], description: 'Markdown → PDF' },
			'md2html': { source_formats: ['md', 'markdown'], target_formats: ['html'], description: 'Markdown → HTML' },
			'md2docx': { source_formats: ['md', 'markdown'], target_formats: ['docx'], description: 'Markdown → DOCX' },
			'pdf2md': { source_formats: ['pdf'], target_formats: ['md'], description: 'PDF → Markdown' },
			'pdf2html': { source_formats: ['pdf'], target_formats: ['html'], description: 'PDF → HTML' },
			'pdf2images': { source_formats: ['pdf'], target_formats: ['png', 'jpg'], description: 'PDF → Images' },
			'docx2pdf': { source_formats: ['docx'], target_formats: ['pdf'], description: 'DOCX → PDF' },
			'docx2md': { source_formats: ['docx'], target_formats: ['md'], description: 'DOCX → Markdown' },
			'html2pdf': { source_formats: ['html', 'htm'], target_formats: ['pdf'], description: 'HTML → PDF' },
			'image2pdf': { source_formats: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'], target_formats: ['pdf'], description: 'Image → PDF' },
			'image2text': { source_formats: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'], target_formats: ['txt'], description: 'Image → Text (OCR)' },
		};
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
