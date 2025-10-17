/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { execSync } from 'child_process';
import { spawn } from 'cross-spawn'
// Added lines below
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function doesPathExist(filePath) {
	try {
		const stats = fs.statSync(filePath);

		return stats.isFile();
	} catch (err) {
		if (err.code === 'ENOENT') {
			return false;
		}
		throw err;
	}
}

/*

This function finds `globalDesiredPath` given `localDesiredPath` and `currentPath`

Diagram:

...basePath/
└── void/
	├── ...currentPath/ (defined globally)
	└── ...localDesiredPath/ (defined locally)

*/
function findDesiredPathFromLocalPath(localDesiredPath, currentPath) {

	// walk upwards until currentPath + localDesiredPath exists
	while (!doesPathExist(path.join(currentPath, localDesiredPath))) {
		const parentDir = path.dirname(currentPath);

		if (parentDir === currentPath) {
			return undefined;
		}

		currentPath = parentDir;
	}

	// return the `globallyDesiredPath`
	const globalDesiredPath = path.join(currentPath, localDesiredPath)
	return globalDesiredPath;
}

// hack to refresh styles automatically
function saveStylesFile() {
	setTimeout(() => {
		try {
			const pathToCssFile = findDesiredPathFromLocalPath('./src/vs/workbench/contrib/void/browser/react/src2/styles.css', __dirname);

			if (pathToCssFile === undefined) {
				console.error('[scope-tailwind] Error finding styles.css');
				return;
			}

			// Or re-write with the same content:
			const content = fs.readFileSync(pathToCssFile, 'utf8');
			fs.writeFileSync(pathToCssFile, content, 'utf8');
			console.log('[scope-tailwind] Force-saved styles.css');
		} catch (err) {
			console.error('[scope-tailwind] Error saving styles.css:', err);
		}
	}, 6000);
}

const args = process.argv.slice(2);
const isWatch = args.includes('--watch') || args.includes('-w');

if (isWatch) {
	// this just builds it if it doesn't exist instead of waiting for the watcher to trigger
	// Check if src2/ exists; if not, do an initial scope-tailwind build
	if (!fs.existsSync('src2')) {
		try {
			console.log('🔨 Running initial scope-tailwind build to create src2 folder...');
			execSync(
				'npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"',
				{ stdio: 'inherit' }
			);
			console.log('✅ src2/ created successfully.');
		} catch (err) {
			console.error('❌ Error running initial scope-tailwind build:', err);
			process.exit(1);
		}
	}

	// Watch mode
	const scopeTailwindWatcher = spawn('npx', [
		'nodemon',
		'--watch', 'src',
		'--ext', 'ts,tsx,css',
		'--exec',
		'npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-" && npx tailwindcss -i ./src/styles.css -o ./src2/styles.css --content "./src2/**/*.{tsx,jsx}"'
	]);

	const tsupWatcher = spawn('npx', [
		'tsup',
		'--watch'
	]);

	scopeTailwindWatcher.stdout.on('data', (data) => {
		console.log(`[scope-tailwind] ${data}`);
		// If the output mentions "styles.css", trigger the save:
		if (data.toString().includes('styles.css')) {
			saveStylesFile();
		}
	});

	scopeTailwindWatcher.stderr.on('data', (data) => {
		console.error(`[scope-tailwind] ${data}`);
	});

	// Handle tsup watcher output
	tsupWatcher.stdout.on('data', (data) => {
		console.log(`[tsup] ${data}`);
	});

	tsupWatcher.stderr.on('data', (data) => {
		console.error(`[tsup] ${data}`);
	});

	// Handle process termination
	process.on('SIGINT', () => {
		scopeTailwindWatcher.kill();
		tsupWatcher.kill();
		process.exit();
	});

	console.log('🔄 Watchers started! Press Ctrl+C to stop both watchers.');
} else {
	// Build mode
	console.log('📦 Building...');

	// Run scope-tailwind once - suppress stderr to avoid Tailwind debug output corruption
	try {
		execSync('npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-" 2>nul', { stdio: ['inherit', 'inherit', 'pipe'] });
	} catch (err) {
		console.warn('⚠️  scope-tailwind had issues, but src2/ may still be usable. Continuing...');
	}

	// Run Tailwind CSS compilation to generate utility classes
	console.log('🎨 Compiling Tailwind CSS...');
	try {
		// Don't minify to preserve CSS variables - tsup will minify the final bundle
		execSync('npx tailwindcss -i ./src/styles.css -o ./src2/styles-tailwind.css --content "./src2/**/*.{tsx,jsx}"', { stdio: 'inherit' });
		console.log('✅ Tailwind CSS compiled successfully!');

		// Append custom CSS variables to the Tailwind output
		console.log('🔧 Appending CSS variables...');
		const tailwindCss = fs.readFileSync('./src2/styles-tailwind.css', 'utf8');
		const customCss = `\n\n.void-scope {
	--void-bg-1: var(--vscode-input-background, #1e1e1e);
	--void-bg-1-alt: var(--vscode-badge-background, #252526);
	--void-bg-2: var(--vscode-sideBar-background, #252526);
	--void-bg-2-alt: var(--vscode-editor-background, #1e1e1e);
	--void-bg-2-hover: var(--vscode-sideBar-background, #252526);
	--void-bg-3: var(--vscode-editor-background, #1e1e1e);

	--void-fg-0: var(--vscode-tab-activeForeground, #ffffff);
	--void-fg-1: var(--vscode-editor-foreground, #cccccc);
	--void-fg-2: var(--vscode-input-foreground, #cccccc);
	--void-fg-3: var(--vscode-input-placeholderForeground, #8c8c8c);
	--void-fg-4: var(--vscode-list-deemphasizedForeground, #8c8c8c);

	--void-warning: var(--vscode-charts-yellow, #f0d754);

	--void-border-1: var(--vscode-commandCenter-activeBorder, #007acc);
	--void-border-2: var(--vscode-commandCenter-border, #3e3e42);
	--void-border-3: var(--vscode-commandCenter-inactiveBorder, #3e3e42);
	--void-border-4: var(--vscode-editorGroup-border, #3e3e42);

	--void-ring-color: #A6E22E;
	--void-link-color: #A6E22E;
}\n`;
		fs.writeFileSync('./src2/styles.css', tailwindCss + customCss, 'utf8');
		console.log('✅ CSS variables appended successfully!');
	} catch (err) {
		console.error('❌ Tailwind CSS compilation failed:', err);
		process.exit(1);
	}

	// Run tsup once
	execSync('npx tsup', { stdio: 'inherit' });

	console.log('✅ Build complete!');
}
