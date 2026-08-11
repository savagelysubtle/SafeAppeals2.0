/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * Fail packaging / CI when dual-ABI native prebuilds required by the desktop
 * installer are missing. End users must not need MSVC, Rust, or Perl — those
 * only run on the build machine that produces the committed `.node` files.
 *
 * Usage:
 *   node build/lib/verifyNativePrebuilds.ts
 *   node build/lib/verifyNativePrebuilds.ts --platform win32 --arch x64
 *   node build/lib/verifyNativePrebuilds.ts --require-all-platforms
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

type RuntimeAbi = 'electron-146' | 'node-137';

interface RequiredPrebuild {
	readonly label: string;
	readonly relativePath: string;
	/** Soft minimum size in bytes (catches empty / wrong stubs). */
	readonly minBytes: number;
}

function timeTrackerSqlite(platformArch: string, runtime: RuntimeAbi): RequiredPrebuild {
	return {
		label: `time-tracker SQLCipher (${platformArch}/${runtime})`,
		relativePath: path.join(
			'extensions',
			'safeappeals-time-tracker',
			'prebuilds',
			platformArch,
			runtime,
			'better_sqlite3.node',
		),
		// Ciphers builds are ~2MB+; plain sqlite was ~1.9MB historically.
		minBytes: 1_500_000,
	};
}

function ragCore(platformArch: string, runtime: RuntimeAbi): RequiredPrebuild {
	return {
		label: `rag-core (${platformArch}/${runtime})`,
		relativePath: path.join(
			'rust',
			'rag-core',
			'prebuilds',
			platformArch,
			runtime,
			'rag_core.node',
		),
		// Full feature builds are tens of MB.
		minBytes: 5_000_000,
	};
}

/** Prebuilds that must ship inside the app for a given desktop target. */
export function requiredPrebuildsForTarget(platform: string, arch: string): RequiredPrebuild[] {
	const platformArch = `${platform}-${arch}`;
	const list: RequiredPrebuild[] = [];

	if (platform === 'win32' && arch === 'x64') {
		list.push(
			timeTrackerSqlite(platformArch, 'electron-146'),
			timeTrackerSqlite(platformArch, 'node-137'),
			ragCore(platformArch, 'electron-146'),
			ragCore(platformArch, 'node-137'),
		);
	} else if (platform === 'linux' && arch === 'x64') {
		list.push(
			timeTrackerSqlite(platformArch, 'electron-146'),
			timeTrackerSqlite(platformArch, 'node-137'),
			ragCore(platformArch, 'electron-146'),
			ragCore(platformArch, 'node-137'),
		);
	}
	// darwin / arm64: add when those prebuilds are produced.

	return list;
}

export interface VerifyResult {
	readonly ok: boolean;
	readonly missing: string[];
	readonly tooSmall: string[];
	readonly present: string[];
}

export function verifyNativePrebuilds(options: {
	readonly platform: string;
	readonly arch: string;
	readonly requireAllPlatforms?: boolean;
}): VerifyResult {
	const targets = options.requireAllPlatforms
		? [
			{ platform: 'linux', arch: 'x64' },
			{ platform: 'win32', arch: 'x64' },
		]
		: [{ platform: options.platform, arch: options.arch }];

	const missing: string[] = [];
	const tooSmall: string[] = [];
	const present: string[] = [];

	for (const t of targets) {
		for (const req of requiredPrebuildsForTarget(t.platform, t.arch)) {
			const abs = path.join(repoRoot, req.relativePath);
			if (!fs.existsSync(abs)) {
				missing.push(`${req.label}: missing ${req.relativePath}`);
				continue;
			}
			const size = fs.statSync(abs).size;
			if (size < req.minBytes) {
				tooSmall.push(`${req.label}: ${req.relativePath} is ${size} bytes (min ${req.minBytes})`);
				continue;
			}
			present.push(`${req.label} (${size} bytes)`);
		}
	}

	return { ok: missing.length === 0 && tooSmall.length === 0, missing, tooSmall, present };
}

function parseArgs(argv: string[]) {
	let platform = process.platform;
	let arch = process.arch;
	let requireAllPlatforms = false;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--platform' && argv[i + 1]) {
			platform = argv[++i];
		} else if (a === '--arch' && argv[i + 1]) {
			arch = argv[++i];
		} else if (a === '--require-all-platforms') {
			requireAllPlatforms = true;
		}
	}
	return { platform, arch, requireAllPlatforms };
}

function main(): void {
	const opts = parseArgs(process.argv.slice(2));
	const result = verifyNativePrebuilds(opts);

	for (const line of result.present) {
		console.log(`[ok] ${line}`);
	}
	for (const line of result.missing) {
		console.error(`[missing] ${line}`);
	}
	for (const line of result.tooSmall) {
		console.error(`[too-small] ${line}`);
	}

	if (!result.ok) {
		console.error('');
		console.error('Native prebuilds required for the desktop installer are incomplete.');
		console.error('End-user installs must not compile natives. Produce and commit prebuilds on a matching host:');
		console.error('  - extensions/safeappeals-time-tracker/PREBUILDS.md');
		console.error('  - rust/rag-core/PREBUILDS.md');
		console.error('  - docs/development/WINDOWS_PACKAGING.md');
		process.exit(1);
	}

	console.log(`Native prebuild verification passed (${opts.requireAllPlatforms ? 'all platforms' : `${opts.platform}-${opts.arch}`}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
