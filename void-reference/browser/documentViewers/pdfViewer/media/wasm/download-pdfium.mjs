/**
 * Downloads the PDFium WASM binary from paulocoutinhox/pdfium-lib.
 *
 * Usage:
 *   node download-pdfium.mjs
 *
 * This downloads the latest wasm release, extracts pdfium.js and pdfium.wasm,
 * and places them in the current directory.
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RELEASE_URL = 'https://github.com/paulocoutinhox/pdfium-lib/releases/download/7623/wasm.tgz';

async function download() {
	console.log('Downloading PDFium WASM binary...');
	console.log('URL:', RELEASE_URL);

	try {
		// Use curl to download (available on Windows 10+, macOS, Linux)
		execSync(`curl -L -o pdfium-wasm.tgz "${RELEASE_URL}"`, {
			cwd: __dirname,
			stdio: 'inherit'
		});

		console.log('Extracting...');
		execSync('tar -xzf pdfium-wasm.tgz', {
			cwd: __dirname,
			stdio: 'inherit'
		});

		console.log('Cleaning up archive...');
		execSync('rm -f pdfium-wasm.tgz', {
			cwd: __dirname,
			stdio: 'inherit'
		});

		// Check if files exist
		if (existsSync(resolve(__dirname, 'pdfium.js')) && existsSync(resolve(__dirname, 'pdfium.wasm'))) {
			console.log('✓ PDFium WASM binary downloaded successfully!');
			console.log('  - pdfium.js');
			console.log('  - pdfium.wasm');
		} else {
			console.error('Files not found after extraction. Check the archive structure.');
			console.log('You may need to manually download from:');
			console.log('  https://github.com/paulocoutinhox/pdfium-lib/releases');
		}
	} catch (error) {
		console.error('Download failed:', error.message);
		console.log('\nManual download instructions:');
		console.log('1. Go to https://github.com/paulocoutinhox/pdfium-lib/releases');
		console.log('2. Download wasm.tgz');
		console.log('3. Extract pdfium.js and pdfium.wasm to this directory');
	}
}

download();
