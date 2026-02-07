#!/usr/bin/env node
/**
 * Download FFmpeg Binaries Script
 *
 * Downloads platform-specific FFmpeg static binaries for audio processing.
 * Required for converting non-WAV audio formats for Whisper transcription.
 *
 * Platforms supported:
 * - Windows (win32): From gyan.dev
 * - macOS (darwin): From evermeet.cx
 * - Linux (linux): From johnvansickle.com
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

// Output directory for FFmpeg binaries
const OUTPUT_DIR = path.join(__dirname, '..', 'resources', 'ffmpeg');

// FFmpeg download URLs by platform
const FFMPEG_URLS = {
	win32: {
		url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
		format: 'zip',
		binaryPath: 'ffmpeg-master-latest-win64-gpl/bin',
		binaries: ['ffmpeg.exe', 'ffprobe.exe']
	},
	darwin: {
		// For macOS, we'll provide instructions to use Homebrew
		// or download from evermeet.cx
		url: null, // Will be handled specially
		format: null,
		binaries: ['ffmpeg', 'ffprobe']
	},
	linux: {
		url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
		format: 'tar.xz',
		binaryPath: '', // Will be determined after extraction
		binaries: ['ffmpeg', 'ffprobe']
	}
};

// Max redirects to follow
const MAX_REDIRECTS = 10;

/**
 * Download a file with progress tracking and proper redirect handling
 */
function downloadFile(url, destPath, progressCallback, redirectCount = 0) {
	return new Promise((resolve, reject) => {
		if (redirectCount > MAX_REDIRECTS) {
			reject(new Error('Too many redirects'));
			return;
		}

		const urlObj = new URL(url);
		const protocol = urlObj.protocol === 'https:' ? https : require('http');

		const options = {
			hostname: urlObj.hostname,
			path: urlObj.pathname + urlObj.search,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SafeAppeals/1.0',
				'Accept': '*/*',
			}
		};

		const request = protocol.get(options, (response) => {
			// Handle redirects
			if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
				let redirectUrl = response.headers.location;
				if (!redirectUrl.startsWith('http')) {
					redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
				}
				if (redirectCount === 0) {
					console.log(`  → Following redirect...`);
				}
				return downloadFile(redirectUrl, destPath, progressCallback, redirectCount + 1)
					.then(resolve)
					.catch(reject);
			}

			if (response.statusCode !== 200) {
				reject(new Error(`HTTP ${response.statusCode}`));
				return;
			}

			const totalBytes = parseInt(response.headers['content-length'], 10);
			let downloadedBytes = 0;

			fs.mkdirSync(path.dirname(destPath), { recursive: true });

			const fileStream = fs.createWriteStream(destPath);

			response.on('data', (chunk) => {
				downloadedBytes += chunk.length;
				if (progressCallback && totalBytes) {
					progressCallback(downloadedBytes, totalBytes);
				}
			});

			response.pipe(fileStream);

			fileStream.on('finish', () => {
				fileStream.close();
				resolve();
			});

			fileStream.on('error', (err) => {
				fs.unlink(destPath, () => { });
				reject(err);
			});
		});

		request.on('error', reject);
		request.setTimeout(600000, () => { // 10 minute timeout
			request.destroy();
			reject(new Error('Download timeout'));
		});
	});
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
	if (bytes < 1024) return bytes + ' B';
	if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
	if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Create a progress bar string
 */
function progressBar(current, total, width = 30) {
	const percent = Math.round((current / total) * 100);
	const filled = Math.round((current / total) * width);
	const empty = width - filled;
	const bar = '█'.repeat(filled) + '░'.repeat(empty);
	return `[${bar}] ${percent}% (${formatBytes(current)}/${formatBytes(total)})`;
}

/**
 * Extract ZIP file (Windows)
 */
async function extractZip(zipPath, destDir) {
	console.log('  Extracting ZIP archive...');

	// Use PowerShell on Windows
	if (process.platform === 'win32') {
		execSync(`powershell -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${destDir}'"`, {
			stdio: 'inherit'
		});
	} else {
		// Use unzip on other platforms
		execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
	}
}

/**
 * Extract tar.xz file (Linux)
 */
async function extractTarXz(tarPath, destDir) {
	console.log('  Extracting tar.xz archive...');
	execSync(`tar -xf "${tarPath}" -C "${destDir}"`, { stdio: 'inherit' });
}

/**
 * Check if FFmpeg is already installed system-wide
 */
function isFFmpegInstalled() {
	try {
		execSync('ffmpeg -version', { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if FFmpeg binaries exist in our resources folder
 */
function hasBundledFFmpeg() {
	const platform = process.platform;
	const binName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
	const binPath = path.join(OUTPUT_DIR, platform, binName);
	return fs.existsSync(binPath);
}

/**
 * Download and install FFmpeg for Windows
 */
async function installFFmpegWindows() {
	const config = FFMPEG_URLS.win32;
	const downloadPath = path.join(os.tmpdir(), 'ffmpeg-win64.zip');
	const extractDir = path.join(os.tmpdir(), 'ffmpeg-extract');
	const outputDir = path.join(OUTPUT_DIR, 'win32');

	console.log('\nDownloading FFmpeg for Windows...');
	console.log(`  URL: ${config.url}`);

	let lastProgress = -1;
	await downloadFile(config.url, downloadPath, (current, total) => {
		const progress = Math.floor((current / total) * 100);
		if (progress !== lastProgress && progress % 5 === 0) {
			process.stdout.write(`\r  ${progressBar(current, total)}   `);
			lastProgress = progress;
		}
	});
	console.log('\r  ✓ Download complete                                              ');

	// Extract
	fs.mkdirSync(extractDir, { recursive: true });
	await extractZip(downloadPath, extractDir);

	// Find and copy binaries
	fs.mkdirSync(outputDir, { recursive: true });

	const extractedDir = fs.readdirSync(extractDir).find(d => d.startsWith('ffmpeg'));
	const binDir = path.join(extractDir, extractedDir, 'bin');

	for (const binary of config.binaries) {
		const srcPath = path.join(binDir, binary);
		const destPath = path.join(outputDir, binary);
		if (fs.existsSync(srcPath)) {
			fs.copyFileSync(srcPath, destPath);
			console.log(`  ✓ Installed ${binary}`);
		}
	}

	// Cleanup
	fs.rmSync(downloadPath, { force: true });
	fs.rmSync(extractDir, { recursive: true, force: true });

	return true;
}

/**
 * Handle macOS installation
 */
async function installFFmpegMacOS() {
	console.log('\n╔════════════════════════════════════════════════════════════════╗');
	console.log('║  FFmpeg Installation for macOS                                 ║');
	console.log('╚════════════════════════════════════════════════════════════════╝');
	console.log('');
	console.log('FFmpeg needs to be installed via Homebrew on macOS.');
	console.log('');
	console.log('Please run:');
	console.log('  brew install ffmpeg');
	console.log('');

	// Check if Homebrew is installed
	try {
		execSync('which brew', { stdio: 'ignore' });
		console.log('Homebrew detected. Would you like to install FFmpeg now?');
		console.log('Run: brew install ffmpeg');
	} catch {
		console.log('Homebrew not found. Install Homebrew first:');
		console.log('  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
	}

	return false; // Indicate manual installation needed
}

/**
 * Download and install FFmpeg for Linux
 */
async function installFFmpegLinux() {
	const config = FFMPEG_URLS.linux;
	const downloadPath = path.join(os.tmpdir(), 'ffmpeg-linux.tar.xz');
	const extractDir = path.join(os.tmpdir(), 'ffmpeg-extract');
	const outputDir = path.join(OUTPUT_DIR, 'linux');

	console.log('\nDownloading FFmpeg for Linux...');
	console.log(`  URL: ${config.url}`);

	let lastProgress = -1;
	await downloadFile(config.url, downloadPath, (current, total) => {
		const progress = Math.floor((current / total) * 100);
		if (progress !== lastProgress && progress % 5 === 0) {
			process.stdout.write(`\r  ${progressBar(current, total)}   `);
			lastProgress = progress;
		}
	});
	console.log('\r  ✓ Download complete                                              ');

	// Extract
	fs.mkdirSync(extractDir, { recursive: true });
	await extractTarXz(downloadPath, extractDir);

	// Find and copy binaries
	fs.mkdirSync(outputDir, { recursive: true });

	const extractedDir = fs.readdirSync(extractDir).find(d => d.startsWith('ffmpeg'));
	const binDir = path.join(extractDir, extractedDir);

	for (const binary of config.binaries) {
		const srcPath = path.join(binDir, binary);
		const destPath = path.join(outputDir, binary);
		if (fs.existsSync(srcPath)) {
			fs.copyFileSync(srcPath, destPath);
			fs.chmodSync(destPath, 0o755); // Make executable
			console.log(`  ✓ Installed ${binary}`);
		}
	}

	// Cleanup
	fs.rmSync(downloadPath, { force: true });
	fs.rmSync(extractDir, { recursive: true, force: true });

	return true;
}

/**
 * Main function
 */
async function downloadFFmpeg() {
	console.log('╔════════════════════════════════════════════════════════════════╗');
	console.log('║       SafeAppeals FFmpeg Downloader                            ║');
	console.log('╠════════════════════════════════════════════════════════════════╣');
	console.log('║  Purpose: Audio format conversion for Whisper transcription    ║');
	console.log('║  Converts: m4a, mp3, aac, ogg, flac → WAV                      ║');
	console.log('╚════════════════════════════════════════════════════════════════╝');
	console.log('');

	// Check if FFmpeg is already available
	if (isFFmpegInstalled()) {
		console.log('✓ FFmpeg is already installed system-wide.');
		const version = execSync('ffmpeg -version').toString().split('\n')[0];
		console.log(`  ${version}`);
		return;
	}

	if (hasBundledFFmpeg()) {
		console.log('✓ FFmpeg binaries already bundled.');
		return;
	}

	console.log('FFmpeg not found. Installing for your platform...');
	console.log(`Platform: ${process.platform} (${process.arch})`);

	let success = false;

	try {
		switch (process.platform) {
			case 'win32':
				success = await installFFmpegWindows();
				break;
			case 'darwin':
				success = await installFFmpegMacOS();
				break;
			case 'linux':
				success = await installFFmpegLinux();
				break;
			default:
				console.log(`Unsupported platform: ${process.platform}`);
				console.log('Please install FFmpeg manually.');
				process.exit(1);
		}
	} catch (error) {
		console.error('\n✗ Installation failed:', error.message);
		console.log('\nPlease install FFmpeg manually:');
		console.log('  Windows: winget install FFmpeg');
		console.log('  macOS:   brew install ffmpeg');
		console.log('  Linux:   sudo apt install ffmpeg');
		process.exit(1);
	}

	if (success) {
		console.log('\n════════════════════════════════════════════════════════════════');
		console.log('✓ FFmpeg installation complete!');
		console.log(`\nBinaries installed to: ${path.join(OUTPUT_DIR, process.platform)}`);

		// Create marker file
		const markerPath = path.join(OUTPUT_DIR, '.download-complete');
		fs.writeFileSync(markerPath, JSON.stringify({
			platform: process.platform,
			arch: process.arch,
			downloadedAt: new Date().toISOString()
		}, null, 2));
	}
}

// Export the function to get bundled FFmpeg path
function getBundledFFmpegPath() {
	const platform = process.platform;
	const binDir = path.join(OUTPUT_DIR, platform);

	if (fs.existsSync(binDir)) {
		return binDir;
	}
	return null;
}

// Run if called directly
if (require.main === module) {
	downloadFFmpeg().catch((error) => {
		console.error('Download failed:', error);
		process.exit(1);
	});
}

module.exports = { downloadFFmpeg, getBundledFFmpegPath };
