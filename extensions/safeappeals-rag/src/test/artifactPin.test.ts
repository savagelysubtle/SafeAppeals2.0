/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { isArtifactPinConfigured } from '../artifactPin';
import type { IModelSpecLite } from '../types';

suite('artifactPin', () => {
	test('isArtifactPinConfigured accepts multi-file pack pins', () => {
		const spec: IModelSpecLite = {
			id: 'unlimited-ocr',
			diskMb: 7000,
			version: '1.0.0',
			sha256: 'pack-digest',
			files: [
				{
					relativePath: 'model.bin',
					downloadUrl: 'https://example.test/model.bin',
					sha256: 'file-digest',
				},
			],
		};
		assert.strictEqual(isArtifactPinConfigured(spec), true);
	});

	test('isArtifactPinConfigured rejects missing pack digest', () => {
		const spec: IModelSpecLite = {
			id: 'unlimited-ocr',
			diskMb: 7000,
			files: [
				{
					relativePath: 'model.bin',
					downloadUrl: 'https://example.test/model.bin',
					sha256: 'file-digest',
				},
			],
		};
		assert.strictEqual(isArtifactPinConfigured(spec), false);
	});
});
