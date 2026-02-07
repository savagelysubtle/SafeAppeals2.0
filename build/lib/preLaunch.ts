/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// @ts-check

import path from 'path';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rootDir = path.resolve(__dirname, '..', '..');

function runProcess(command: string, args: ReadonlyArray<string> = []) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, { cwd: rootDir, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
		child.on('exit', err => !err ? resolve() : process.exit(err ?? 1));
		child.on('error', reject);
	});
}

async function exists(subdir: string) {
	try {
		await fs.stat(path.join(rootDir, subdir));
		return true;
	} catch {
		return false;
	}
}

async function ensureNodeModules() {
	if (!(await exists('node_modules'))) {
		await runProcess(npm, ['ci']);
	}
}

async function getElectron() {
	await runProcess(npm, ['run', 'electron']);
}

async function ensureCompiled() {
	if (!(await exists('out'))) {
		await runProcess(npm, ['run', 'compile']);
	}
}

async function ensureFFmpeg() {
	// Download FFmpeg binaries for audio transcription
	const ffmpegMarker = path.join(rootDir, 'resources', 'ffmpeg', '.download-complete');
	try {
		await fs.stat(ffmpegMarker);
		console.log('[preLaunch] FFmpeg binaries already downloaded');
	} catch {
		console.log('[preLaunch] Downloading FFmpeg binaries...');
		const scriptPath = path.join(rootDir, 'scripts', 'download-ffmpeg.js');
		try {
			await fs.stat(scriptPath);
			await runProcess('node', [scriptPath]);
		} catch (err) {
			console.warn('[preLaunch] FFmpeg download script not found or failed. FFmpeg can be installed manually: winget install FFmpeg');
		}
	}
}

async function ensureWhisperModel() {
	// Download Whisper model for audio transcription (~1.5GB)
	const modelMarker = path.join(rootDir, 'resources', 'models', 'whisper', 'distil-large-v3.5', '.download-complete');
	try {
		await fs.stat(modelMarker);
		console.log('[preLaunch] Whisper model already downloaded');
	} catch {
		console.log('[preLaunch] Downloading Whisper model (~1.5GB)...');
		const scriptPath = path.join(rootDir, 'scripts', 'download-whisper-model.js');
		try {
			await fs.stat(scriptPath);
			await runProcess('node', [scriptPath]);
		} catch (err) {
			console.warn('[preLaunch] Whisper model download failed. Run manually: node scripts/download-whisper-model.js');
		}
	}
}

async function main() {
	await ensureNodeModules();
	await getElectron();
	await ensureCompiled();
	await ensureFFmpeg();
	await ensureWhisperModel();

	// Can't require this until after dependencies are installed
	const { getBuiltInExtensions } = require('./builtInExtensions');
	await getBuiltInExtensions();
}

if (require.main === module) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
