#!/usr/bin/env node
/**
 * Download Whisper Model Script
 *
 * Downloads the distil-large-v3.5 GGML model for local speech-to-text transcription.
 * Uses the official GGML version from distil-whisper/distil-large-v3.5-ggml
 *
 * Model: distil-whisper/distil-large-v3.5-ggml
 * Size: ~1.5GB
 * WER: ~7.08% short-form OOD (best in class for distilled models)
 * Speed: ~1.5x faster than Whisper large-v3-turbo
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration - Use official GGML version (publicly available, no auth required)
const MODEL_REPO = 'distil-whisper/distil-large-v3.5-ggml';
const OUTPUT_DIR = path.join(__dirname, '..', 'resources', 'models', 'whisper', 'distil-large-v3.5');

// GGML model file - single file containing the complete model
const MODEL_FILES = [
	{ name: 'ggml-model.bin', size: '~1.5GB' },
];

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
		const options = {
			hostname: urlObj.hostname,
			path: urlObj.pathname + urlObj.search,
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 SafeAppeals/1.0',
				'Accept': '*/*',
			}
		};

		const request = https.get(options, (response) => {
			// Handle all redirect status codes (301, 302, 303, 307, 308)
			if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
				let redirectUrl = response.headers.location;
				// Handle relative URLs
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

			// Ensure directory exists
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
				fs.unlink(destPath, () => { }); // Delete partial file
				reject(err);
			});
		});

		request.on('error', reject);
		request.setTimeout(1800000, () => { // 30 minute timeout for large file
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
 * Main download function
 */
async function downloadModel() {
	const repo = MODEL_REPO;
	const baseUrl = `https://huggingface.co/${repo}/resolve/main`;

	console.log('╔════════════════════════════════════════════════════════════════╗');
	console.log('║       SafeAppeals Whisper Model Downloader                     ║');
	console.log('╠════════════════════════════════════════════════════════════════╣');
	console.log(`║  Model: ${repo.padEnd(52)} ║`);
	console.log('║  Purpose: Legal-grade transcription (~7% WER)                  ║');
	console.log('║  Size: ~1.5GB                                                  ║');
	console.log('║  Format: GGML (whisper.cpp compatible)                         ║');
	console.log('╚════════════════════════════════════════════════════════════════╝');
	console.log('');

	// Create output directory
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });

	console.log(`Output directory: ${OUTPUT_DIR}\n`);

	let successCount = 0;
	let failedFiles = [];

	for (let i = 0; i < MODEL_FILES.length; i++) {
		const file = MODEL_FILES[i];
		const url = `${baseUrl}/${file.name}`;
		const destPath = path.join(OUTPUT_DIR, file.name);

		// Check if file already exists
		if (fs.existsSync(destPath)) {
			const stats = fs.statSync(destPath);
			// Check if file is reasonably sized (> 1GB for the model)
			if (stats.size > 1000000000) {
				console.log(`✓ ${file.name} (already exists, ${formatBytes(stats.size)})`);
				successCount++;
				continue;
			} else {
				console.log(`  Removing incomplete file: ${file.name} (${formatBytes(stats.size)})`);
				fs.unlinkSync(destPath);
			}
		}

		console.log(`\nDownloading [${i + 1}/${MODEL_FILES.length}]: ${file.name} (${file.size})`);
		console.log(`  URL: ${url}`);

		try {
			let lastProgress = -1;
			const startTime = Date.now();

			await downloadFile(url, destPath, (current, total) => {
				const progress = Math.floor((current / total) * 100);
				if (progress !== lastProgress) {
					const elapsed = (Date.now() - startTime) / 1000;
					const speed = current / elapsed;
					const remaining = (total - current) / speed;
					const eta = remaining > 60 ? `${Math.ceil(remaining / 60)}m` : `${Math.ceil(remaining)}s`;

					process.stdout.write(`\r  ${progressBar(current, total)} ETA: ${eta}   `);
					lastProgress = progress;
				}
			});

			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			console.log(`\r  ✓ Downloaded successfully in ${elapsed}s                                      `);
			successCount++;
		} catch (error) {
			console.log(`\r  ✗ Failed: ${error.message}                                     `);
			failedFiles.push({ file: file.name, error: error.message });
		}
	}

	console.log('\n════════════════════════════════════════════════════════════════');
	console.log(`Download complete: ${successCount}/${MODEL_FILES.length} files`);

	if (failedFiles.length > 0) {
		console.log('\nFailed files:');
		failedFiles.forEach(f => console.log(`  - ${f.file}: ${f.error}`));
		console.log('\nTroubleshooting:');
		console.log('  1. Check your internet connection');
		console.log('  2. Try again - HuggingFace may be experiencing issues');
		console.log('  3. Manual download: https://huggingface.co/distil-whisper/distil-large-v3.5-ggml');
		process.exit(1);
	} else {
		console.log('\n✓ All model files downloaded successfully!');
		console.log(`\nModel ready at: ${OUTPUT_DIR}`);

		// Create a marker file to indicate successful download
		const markerPath = path.join(OUTPUT_DIR, '.download-complete');
		fs.writeFileSync(markerPath, JSON.stringify({
			repo,
			downloadedAt: new Date().toISOString(),
			files: MODEL_FILES.map(f => f.name),
			format: 'ggml',
			usage: 'Use with whisper-node or whisper.cpp'
		}, null, 2));

		console.log('\nNext steps:');
		console.log('  1. The model will be used by the audio-recorder extension');
		console.log('  2. For whisper.cpp: ./main -m ggml-model.bin -f audio.wav');
	}
}

// Run if called directly
if (require.main === module) {
	downloadModel().catch((error) => {
		console.error('Download failed:', error);
		process.exit(1);
	});
}

module.exports = { downloadModel };
