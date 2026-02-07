/*---------------------------------------------------------------------------------------------
 *  Script to rebuild native modules for Electron after bun install
 *  This is necessary because bun doesn't handle native module compilation for Electron
 *--------------------------------------------------------------------------------------------*/

const cp = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.dirname(path.dirname(__dirname));

// Native modules that need to be rebuilt for Electron
const NATIVE_MODULES = [
	'@vscode/sqlite3',
	'@vscode/spdlog',
	'@vscode/windows-mutex',
	'@vscode/windows-process-tree',
	'@vscode/windows-registry',
	'better-sqlite3',
	'node-pty',
	'native-keymap',
	'native-watchdog',
	'@parcel/watcher',
	'kerberos',
	'sharp', // Used by @xenova/transformers for image processing in RAG embeddings
];

// Read Electron version from package.json
function getElectronVersion() {
	const pkg = require(path.join(root, 'package.json'));
	return pkg.devDependencies?.electron || '34.3.2';
}

function log(message) {
	if (process.stdout.isTTY) {
		console.log(`\x1b[33m[rebuild-native]\x1b[0m ${message}`);
	} else {
		console.log(`[rebuild-native] ${message}`);
	}
}

function logError(message) {
	if (process.stdout.isTTY) {
		console.error(`\x1b[31m[rebuild-native]\x1b[0m ${message}`);
	} else {
		console.error(`[rebuild-native] ${message}`);
	}
}

/**
 * Pre-extract sqlite3 source to work around minizlib/Node.js compatibility issues
 * Uses system tar instead of the broken npm tar/minizlib
 */
function preExtractSqlite3() {
	const sqlite3Path = path.join(root, 'node_modules', '@vscode', 'sqlite3');
	if (!fs.existsSync(sqlite3Path)) {
		return; // sqlite3 not installed
	}

	const depsPath = path.join(sqlite3Path, 'deps');
	const tarball = path.join(depsPath, 'sqlite-autoconf-3390400.tar.gz');
	const extractedDir = path.join(depsPath, 'sqlite-autoconf-3390400');

	if (!fs.existsSync(tarball)) {
		return; // tarball not found
	}

	// Check if already extracted in deps
	const sourceExists = fs.existsSync(extractedDir) && fs.existsSync(path.join(extractedDir, 'sqlite3.c'));

	// Also check if build output location has the file
	const buildOutputDir = path.join(sqlite3Path, 'build', 'Release', 'obj', 'global_intermediate', 'sqlite-autoconf-3390400');
	const buildOutputExists = fs.existsSync(path.join(buildOutputDir, 'sqlite3.c'));

	if (sourceExists && buildOutputExists) {
		log('SQLite source already extracted, skipping');
		return;
	}

	// If source exists but build output doesn't, just copy
	if (sourceExists && !buildOutputExists) {
		log('Copying SQLite source to build output directory...');
		fs.mkdirSync(buildOutputDir, { recursive: true });
		const files = fs.readdirSync(extractedDir);
		for (const file of files) {
			const src = path.join(extractedDir, file);
			const dest = path.join(buildOutputDir, file);
			if (fs.statSync(src).isDirectory()) {
				fs.cpSync(src, dest, { recursive: true });
			} else {
				fs.copyFileSync(src, dest);
			}
		}
		log('SQLite source copied to build output directory');
		return;
	}

	log('Pre-extracting SQLite source using system tar...');
	try {
		// Use system tar to extract (works around minizlib issues)
		cp.execSync(`tar -xzf "${tarball}"`, {
			cwd: depsPath,
			stdio: 'pipe'
		});
		log('SQLite source extracted successfully');

		// Also copy to build output location (create directory if needed)
		fs.mkdirSync(buildOutputDir, { recursive: true });
		// Copy files
		const files = fs.readdirSync(extractedDir);
		for (const file of files) {
			const src = path.join(extractedDir, file);
			const dest = path.join(buildOutputDir, file);
			if (fs.statSync(src).isDirectory()) {
				fs.cpSync(src, dest, { recursive: true });
			} else {
				fs.copyFileSync(src, dest);
			}
		}
		log('SQLite source copied to build output directory');
	} catch (error) {
		logError(`Failed to extract SQLite source: ${error.message}`);
		// Non-fatal, continue with rebuild
	}
}

/**
 * Find all nested sharp modules that need rebuilding
 * Sharp can be nested in dependencies like @xenova/transformers
 */
function findNestedSharpModules() {
	const nestedSharps = [];

	// Check common locations where sharp might be nested
	const checkPaths = [
		path.join(root, 'node_modules', '@xenova', 'transformers', 'node_modules', 'sharp'),
		// Add more paths if needed
	];

	for (const sharpPath of checkPaths) {
		if (fs.existsSync(sharpPath)) {
			const bindingGyp = path.join(sharpPath, 'binding.gyp');
			if (fs.existsSync(bindingGyp)) {
				nestedSharps.push(sharpPath);
			}
		}
	}

	return nestedSharps;
}

/**
 * Rebuild a single native module using node-gyp
 */
function rebuildSingleModule(moduleName, electronVersion) {
	const modulePath = path.join(root, 'node_modules', moduleName);
	if (!fs.existsSync(modulePath)) {
		return false; // Module not installed
	}

	const bindingGyp = path.join(modulePath, 'binding.gyp');
	if (!fs.existsSync(bindingGyp)) {
		return false; // Not a native module
	}

	log(`Rebuilding ${moduleName}...`);
	try {
		// Use bunx to avoid npm's broken minipass dependency resolution
		cp.execSync(`bunx node-gyp rebuild --target=${electronVersion} --arch=x64 --dist-url=https://electronjs.org/headers --runtime=electron`, {
			cwd: modulePath,
			stdio: 'pipe',
			env: {
				...process.env,
				npm_config_runtime: 'electron',
				npm_config_target: electronVersion,
				npm_config_disturl: 'https://electronjs.org/headers'
			}
		});
		log(`✓ ${moduleName} rebuilt successfully`);
		return true;
	} catch (error) {
		logError(`✗ Failed to rebuild ${moduleName}: ${error.message}`);
		return false;
	}
}

/**
 * Rebuild a nested sharp module at a specific path
 */
function rebuildNestedSharp(sharpPath, electronVersion) {
	const bindingGyp = path.join(sharpPath, 'binding.gyp');
	if (!fs.existsSync(bindingGyp)) {
		return false; // Not a native module
	}

	log(`Rebuilding nested sharp at ${path.relative(root, sharpPath)}...`);
	try {
		// Use bunx to avoid npm's broken minipass dependency resolution
		cp.execSync(`bunx node-gyp rebuild --target=${electronVersion} --arch=x64 --dist-url=https://electronjs.org/headers --runtime=electron`, {
			cwd: sharpPath,
			stdio: 'pipe',
			env: {
				...process.env,
				npm_config_runtime: 'electron',
				npm_config_target: electronVersion,
				npm_config_disturl: 'https://electronjs.org/headers'
			}
		});
		log(`✓ Nested sharp rebuilt successfully`);
		return true;
	} catch (error) {
		logError(`✗ Failed to rebuild nested sharp: ${error.message}`);
		return false;
	}
}

function rebuildNativeModules() {
	const electronVersion = getElectronVersion();
	log(`Rebuilding native modules for Electron ${electronVersion}...`);

	// Pre-extract sqlite3 source to work around minizlib issues
	preExtractSqlite3();

	// Initialize counters
	let successCount = 0;
	let failCount = 0;

	// Try electron-rebuild first (faster for batch rebuilds)
	let electronRebuildSucceeded = false;
	try {
		log('Attempting batch rebuild with @electron/rebuild...');
		// Use bunx to avoid npm's broken minipass dependency resolution
		cp.execSync(`bunx @electron/rebuild --version ${electronVersion}`, {
			stdio: 'inherit',
			cwd: root,
			env: {
				...process.env,
				npm_config_runtime: 'electron',
				npm_config_target: electronVersion,
				npm_config_disturl: 'https://electronjs.org/headers',
				npm_config_build_from_source: 'true'
			}
		});
		log('Native modules rebuilt successfully with @electron/rebuild!');
		electronRebuildSucceeded = true;
	} catch (error) {
		logError(`Batch rebuild failed: ${error.message}`);
		log('Falling back to individual module rebuilds...');
	}

	// Always check and rebuild nested sharp modules, as @electron/rebuild may miss them
	const nestedSharps = findNestedSharpModules();
	if (nestedSharps.length > 0) {
		log(`Found ${nestedSharps.length} nested sharp module(s) to rebuild...`);
		for (const sharpPath of nestedSharps) {
			const result = rebuildNestedSharp(sharpPath, electronVersion);
			if (result) {
				successCount++;
			} else {
				failCount++;
			}
		}
	}

	// If electron-rebuild succeeded and we handled nested sharps, we're done
	if (electronRebuildSucceeded && nestedSharps.length === 0) {
		return;
	}

	for (const moduleName of NATIVE_MODULES) {
		const result = rebuildSingleModule(moduleName, electronVersion);
		if (result) {
			successCount++;
		} else {
			const modulePath = path.join(root, 'node_modules', moduleName);
			if (fs.existsSync(modulePath)) {
				failCount++;
			}
		}
	}

	log(`Rebuild complete: ${successCount} succeeded, ${failCount} failed`);

	if (failCount > 0) {
		logError('Some native modules failed to build. You may need to:');
		logError('1. Install Visual Studio Build Tools with C++ workload');
		logError('2. Run: bunx node-gyp install');
		logError('3. Manually rebuild failing modules');
		// Don't exit with error - allow development to continue
	}
}

// Only run if executed directly (not required as module)
if (require.main === module) {
	rebuildNativeModules();
}

module.exports = { rebuildNativeModules, NATIVE_MODULES };
