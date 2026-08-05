/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import { AudioService } from '../audioService';
import { WhisperSlotAdapter } from '../ml/adapters/whisperAdapter';
import { FfmpegStubAdapter } from '../ml/adapters/ffmpegAdapter';
import { MlBusyError } from '../ml/errors';
import { WHISPER_PCM_SAMPLE_RATE } from '../pcm16';
import type { WhisperTranscribeOptions } from '../whisperProbe';
import { WhisperHost } from '../whisperHost';
import { FakeMlResourceEngine } from './fakeMlEngine';

class FakeSecretStorage implements vscode.SecretStorage {
	private readonly map = new Map<string, string>();
	async keys(): Promise<string[]> {
		return [...this.map.keys()];
	}
	async get(key: string): Promise<string | undefined> {
		return this.map.get(key);
	}
	async store(key: string, value: string): Promise<void> {
		this.map.set(key, value);
	}
	async delete(key: string): Promise<void> {
		this.map.delete(key);
	}
	readonly onDidChange: vscode.Event<vscode.SecretStorageChangeEvent> = () => ({ dispose() { } });
}

class FakeMemento implements vscode.Memento {
	private readonly map = new Map<string, unknown>();
	keys(): readonly string[] {
		return [...this.map.keys()];
	}
	get<T>(key: string, defaultValue?: T): T | undefined {
		if (this.map.has(key)) {
			return this.map.get(key) as T;
		}
		return defaultValue;
	}
	async update(key: string, value: unknown): Promise<void> {
		if (value === undefined) {
			this.map.delete(key);
		} else {
			this.map.set(key, value);
		}
	}
	setKeysForSync(): void { }
}

function fakeContext(globalStoragePath: string): vscode.ExtensionContext {
	return {
		secrets: new FakeSecretStorage(),
		globalState: new FakeMemento(),
		globalStorageUri: { fsPath: globalStoragePath } as vscode.Uri,
		extensionUri: { fsPath: globalStoragePath } as vscode.Uri,
		subscriptions: [],
	} as unknown as vscode.ExtensionContext;
}

function encodePcm16Base64(samples: number[]): string {
	const bytes = Buffer.alloc(samples.length * 2);
	for (let i = 0; i < samples.length; i++) {
		bytes.writeInt16LE(samples[i]!, i * 2);
	}
	return bytes.toString('base64');
}

suite('AudioService.transcribePcm', () => {
	let tempDir: string;
	let service: AudioService | undefined;
	let testEngine: FakeMlResourceEngine | undefined;

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-transcribe-pcm-'));
	});

	suiteTeardown(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	teardown(async () => {
		if (service) {
			await service.dispose();
			service = undefined;
		}
		testEngine = undefined;
	});

	test('uses withLease whisper + pcmf32 and returns trimmed text', async () => {
		const seen: WhisperTranscribeOptions[] = [];
		const whisperHost = new WhisperHost({
			getModelPath: () => path.join(tempDir, 'fake-model.bin'),
			getTranscribe: () => async (opts: WhisperTranscribeOptions) => {
				seen.push(opts);
				// Object with `text` only — empty `segments: []` would route parseWhisperOutput oddly.
				return { text: '  hello dictation  ' };
			},
		});
		testEngine = new FakeMlResourceEngine([
			new WhisperSlotAdapter(whisperHost),
			new FfmpegStubAdapter(),
		]);

		service = new AudioService(fakeContext(tempDir), () => { });
		await service.initialize();
		await service.replaceWhisperPipelineForTest(whisperHost, testEngine);

		const text = await service.transcribePcm({
			pcm16Base64: encodePcm16Base64([1000, -1000, 500, -500]),
			sampleRate: WHISPER_PCM_SAMPLE_RATE,
		});

		assert.strictEqual(text, 'hello dictation');
		assert.strictEqual(seen.length, 1);
		assert.ok(seen[0]!.pcmf32 instanceof Float32Array);
		assert.strictEqual(seen[0]!.pcmf32!.length, 4);
		assert.strictEqual(seen[0]!.translate, false);
	});

	test('propagates MlBusyError when whisper lane is busy', async () => {
		const whisperHost = new WhisperHost({
			getModelPath: () => path.join(tempDir, 'fake-model.bin'),
			getTranscribe: () => async () => ({ text: 'never' }),
		});
		testEngine = new FakeMlResourceEngine([
			new WhisperSlotAdapter(whisperHost),
			new FfmpegStubAdapter(),
		]);

		service = new AudioService(fakeContext(tempDir), () => { });
		await service.initialize();
		await service.replaceWhisperPipelineForTest(whisperHost, testEngine);

		let releaseHold!: () => void;
		const hold = new Promise<void>(resolve => {
			releaseHold = resolve;
		});
		let signalEntered!: () => void;
		const entered = new Promise<void>(resolve => {
			signalEntered = resolve;
		});
		const first = testEngine.withLease('whisper', { jobId: 'hold', rejectIfBusy: false }, async () => {
			signalEntered();
			await hold;
		});
		await entered;

		await assert.rejects(
			() => service!.transcribePcm({
				pcm16Base64: encodePcm16Base64([1, -1]),
				sampleRate: WHISPER_PCM_SAMPLE_RATE,
			}),
			(error: unknown) => error instanceof MlBusyError,
		);

		releaseHold();
		await first;
	});
});
