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
];

// Read Electron version from .npmrc or package.json
function getElectronVersion() {
	const npmrcPath = path.join(root, '.npmrc');
	if (fs.existsSync(npmrcPath)) {
		const npmrc = fs.readFileSync(npmrcPath, 'utf8');
		const match = npmrc.match(/target="?([^"\n]+)"?/);
		if (match) {
			return match[1];
		}
	}

	// Fallback to package.json
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

function rebuildNativeModules() {
	const electronVersion = getElectronVersion();
	log(`Rebuilding native modules for Electron ${electronVersion}...`);

	// Check if electron-rebuild is available
	const electronRebuildPath = path.join(root, 'node_modules', '@electron', 'rebuild');
	const hasElectronRebuild = fs.existsSync(electronRebuildPath);

	if (!hasElectronRebuild) {
		log('Installing @electron/rebuild...');
		try {
			cp.execSync('npm install -g @electron/rebuild', {
				stdio: 'inherit',
				cwd: root
			});
		} catch (e) {
			log('Warning: Could not install @electron/rebuild globally');
		}
	}

	try {
		// Run electron-rebuild for all native modules
		log('Running electron-rebuild...');
		cp.execSync(`npx @electron/rebuild --version ${electronVersion}`, {
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
		log('Native modules rebuilt successfully!');
	} catch (error) {
		console.error('[rebuild-native] Error rebuilding native modules:', error.message);
		console.error('[rebuild-native] You may need to install Visual Studio Build Tools with C++ workload');
		process.exit(1);
	}
}

// Only run if executed directly (not required as module)
if (require.main === module) {
	rebuildNativeModules();
}

module.exports = { rebuildNativeModules, NATIVE_MODULES };

