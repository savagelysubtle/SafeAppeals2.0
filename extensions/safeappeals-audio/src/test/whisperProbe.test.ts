/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
	probeWhisperAddon,
	resetWhisperProbeCacheForTests,
	resolveVendorNativeLibDir,
} from '../whisperProbe';

suite('whisperProbe', () => {
	let cacheDir: string;

	suiteSetup(async () => {
		cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-audio-native-'));
	});

	suiteTeardown(async () => {
		await fs.rm(cacheDir, { recursive: true, force: true });
	});

	setup(() => {
		resetWhisperProbeCacheForTests();
	});

	test('resolves vendor native dir (mac-/darwin- aware)', () => {
		const vendor = resolveVendorNativeLibDir();
		assert.ok(vendor, 'expected kutalia platform folder');
		assert.ok(
			/(?:linux|mac|darwin|win32)-/.test(path.basename(vendor)),
			vendor,
		);
	});

	test('loads from managed copy without mutating vendor node_modules', async () => {
		const vendor = resolveVendorNativeLibDir();
		assert.ok(vendor);
		const before = await fs.readFile(path.join(vendor, 'whisper.node'));

		const probe = probeWhisperAddon({ cacheDir });
		assert.strictEqual(probe.loaded, true);
		assert.strictEqual(probe.hasTranscribe, true);
		assert.ok(probe.nativeLibDir?.startsWith(cacheDir));
		assert.ok(probe.transcribe);

		const after = await fs.readFile(path.join(vendor, 'whisper.node'));
		assert.deepStrictEqual(after.equals(before), true);
	});
});
