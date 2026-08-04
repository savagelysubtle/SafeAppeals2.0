/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	assertTranscriptionStorageReady,
	canTranscribeWithStorage,
} from '../transcriptionGates';

suite('transcriptionGates', () => {
	test('refuses transcription when memory-only / DEK unavailable (no disk writes)', () => {
		assert.throws(
			() => assertTranscriptionStorageReady({
				memoryOnly: true,
				storeRootDir: undefined,
				secretStorageAvailable: false,
			}),
			/memory-only mode/,
		);
		assert.throws(
			() => assertTranscriptionStorageReady({
				memoryOnly: false,
				storeRootDir: undefined,
				secretStorageAvailable: true,
			}),
			/encrypted workspace store/,
		);
		assert.doesNotThrow(() => assertTranscriptionStorageReady({
			memoryOnly: false,
			storeRootDir: '/tmp/managed-global-storage/workspaces/abcd',
			secretStorageAvailable: true,
		}));
		assert.deepStrictEqual({
			memoryOnly: canTranscribeWithStorage({ memoryOnly: true, secretStorageAvailable: false }),
			ok: canTranscribeWithStorage({ memoryOnly: false, secretStorageAvailable: true }),
		}, {
			memoryOnly: false,
			ok: true,
		});
	});
});
