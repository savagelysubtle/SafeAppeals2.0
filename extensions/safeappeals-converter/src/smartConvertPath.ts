/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import * as fs from 'node:fs';

/** Build a sibling output path while honoring the input path's platform syntax. */
export function buildSmartOutputPath(inputPath: string, targetExtension: string, suffix = ''): string {
	const pathApi = inputPath.includes('\\') ? path.win32 : path.posix;
	const directory = pathApi.dirname(inputPath);
	const fileName = pathApi.basename(inputPath);
	const extension = pathApi.extname(fileName);
	const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
	const outputName = `${baseName}${suffix}.${targetExtension}`;
	return directory === '.' ? outputName : pathApi.join(directory, outputName);
}

/** Choose the first non-conflicting sibling output path. */
export function findSmartOutputPath(
	inputPath: string,
	targetExtension: string,
	exists: (candidate: string) => boolean = fs.existsSync,
): string {
	let candidate = buildSmartOutputPath(inputPath, targetExtension);
	let counter = 1;
	while (exists(candidate)) {
		candidate = buildSmartOutputPath(inputPath, targetExtension, ` (${counter})`);
		counter++;
	}
	return candidate;
}

/** Return only the filename for POSIX or Windows syntax, including hostile literal characters. */
export function getPathDisplayName(inputPath: string): string {
	return inputPath.includes('\\') ? path.win32.basename(inputPath) : path.posix.basename(inputPath);
}
