/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const rootPath = resolve(import.meta.dirname, '..', '..');

/** Extensions that receive a committed copy of safeappeals-shared sources. */
const TARGETS = [
	'safeappeals-email',
	'safeappeals-calendar',
	'safeappeals-documents',
	'safeappeals-audio',
	'time-tracker',
];

const SOURCE_DIR = join(rootPath, 'extensions', 'safeappeals-shared', 'src');

function bannerFor(fileName: string): string {
	return `/* GENERATED — do not edit. Canonical source: extensions/safeappeals-shared/src/${fileName}. Run: npm run sync-safeappeals-shared */\n`;
}

function expectedContent(fileName: string, source: string): string {
	return bannerFor(fileName) + source;
}

function listSourceFiles(): string[] {
	return readdirSync(SOURCE_DIR).filter(name => name.endsWith('.ts')).sort();
}

function targetSharedDir(target: string): string {
	return join(rootPath, 'extensions', target, 'src', 'shared');
}

function sync(checkOnly: boolean): number {
	const files = listSourceFiles();
	if (files.length === 0) {
		console.error(`No .ts sources found in ${SOURCE_DIR}`);
		return 1;
	}

	const problems: string[] = [];

	for (const target of TARGETS) {
		const destDir = targetSharedDir(target);
		if (!checkOnly) {
			mkdirSync(destDir, { recursive: true });
		}

		for (const fileName of files) {
			const sourcePath = join(SOURCE_DIR, fileName);
			const destPath = join(destDir, fileName);
			const source = readFileSync(sourcePath, 'utf8');
			const expected = expectedContent(fileName, source);

			if (checkOnly) {
				if (!existsSync(destPath)) {
					problems.push(`missing: extensions/${target}/src/shared/${fileName}`);
					continue;
				}
				const actual = readFileSync(destPath, 'utf8');
				if (actual !== expected) {
					problems.push(`out-of-sync: extensions/${target}/src/shared/${fileName}`);
				}
			} else {
				writeFileSync(destPath, expected, 'utf8');
				console.log(`Wrote extensions/${target}/src/shared/${fileName}`);
			}
		}
	}

	if (checkOnly) {
		if (problems.length > 0) {
			console.error('safeappeals-shared copies are out of sync:');
			for (const problem of problems) {
				console.error(`  ${problem}`);
			}
			console.error('Run: npm run sync-safeappeals-shared');
			return 1;
		}
		console.log('safeappeals-shared copies are in sync.');
		return 0;
	}

	return 0;
}

const checkOnly = process.argv.includes('--check');
process.exit(sync(checkOnly));
