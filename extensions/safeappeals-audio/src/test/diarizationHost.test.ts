/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
	resolveDiarizationPaths,
	spikeDiarizationPaths,
} from '../diarizationHost';

suite('diarizationHost paths', () => {
	let tmpRoot: string;

	suiteSetup(async () => {
		tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-audio-diar-'));
	});

	suiteTeardown(async () => {
		await fs.rm(tmpRoot, { recursive: true, force: true });
	});

	test('resolveDiarizationPaths finds extension spike layout when readable', async () => {
		const extensionPath = path.join(tmpRoot, 'ext-spike');
		const spike = spikeDiarizationPaths(extensionPath);
		await fs.mkdir(path.dirname(spike.binary), { recursive: true });
		await fs.mkdir(path.dirname(spike.segmentationModel), { recursive: true });
		await fs.mkdir(path.dirname(spike.embeddingModel), { recursive: true });
		await fs.writeFile(spike.binary, 'fake-bin');
		await fs.writeFile(spike.segmentationModel, 'fake-seg');
		await fs.writeFile(spike.embeddingModel, 'fake-emb');
		const libDir = path.resolve(path.dirname(spike.binary), '..', 'lib');
		await fs.mkdir(libDir, { recursive: true });

		const resolved = await resolveDiarizationPaths(undefined, extensionPath);
		assert.deepStrictEqual(resolved, {
			binary: spike.binary,
			segmentationModel: spike.segmentationModel,
			embeddingModel: spike.embeddingModel,
			libraryDir: libDir,
		});
	});

	test('resolveDiarizationPaths returns undefined when spike files missing', async () => {
		const extensionPath = path.join(tmpRoot, 'ext-empty');
		await fs.mkdir(extensionPath, { recursive: true });
		const resolved = await resolveDiarizationPaths(undefined, extensionPath);
		assert.strictEqual(resolved, undefined);
	});
});
