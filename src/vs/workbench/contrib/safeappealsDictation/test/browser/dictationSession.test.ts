/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ContextKeyService } from '../../../../../platform/contextkey/browser/contextKeyService.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IExtensionDescription } from '../../../../../platform/extensions/common/extensions.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { INotification, INotificationService } from '../../../../../platform/notification/common/notification.js';
import { TestNotificationService } from '../../../../../platform/notification/test/common/testNotificationService.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { IMicCaptureService } from '../../../chat/browser/voiceClient/micCaptureService.js';
import { DictationSession } from '../../browser/dictationSession.js';

suite('DictationSession', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('cancel during stopping does not toast hold-too-short or insert', async () => {
		const notifications: INotification[] = [];
		const commandCalls: string[] = [];

		let resolvePttDrain!: () => void;
		const pttDrain = new Promise<void>(resolve => { resolvePttDrain = resolve; });

		const pttAudioChunk = store.add(new Emitter<string>());
		const pttEnd = store.add(new Emitter<void>());

		const mic = createFakeMic({
			pttAudioChunk,
			pttEnd,
			sampleRate: 48000,
			pttUp: () => {
				// Delay onPttEnd so stop() remains in 'stopping' while cancel runs.
				void pttDrain.then(() => pttEnd.fire());
			},
		});

		const session = store.add(createSession(mic, {
			onNotify: n => notifications.push(n),
			executeCommand: async (id: string) => {
				commandCalls.push(id);
				return 'transcript';
			},
		}));

		await session.start();
		pttAudioChunk.fire(btoa('\0\0'));

		const stopPromise = session.stop();
		assert.strictEqual(session.isActive, true, 'should still be active while stopping');

		session.cancel();
		resolvePttDrain();
		await stopPromise;

		assert.strictEqual(session.isActive, false);
		assert.strictEqual(notifications.length, 0, 'cancel must not surface hold-too-short');
		assert.deepStrictEqual(commandCalls, [], 'cancel must not transcribe or insert');
	});

	test('captures sampleRate at hold start after pttDown', async () => {
		const pttAudioChunk = store.add(new Emitter<string>());
		const pttEnd = store.add(new Emitter<void>());
		let liveSampleRate: number | undefined = 44100;
		const commandPayloads: unknown[] = [];

		const mic = createFakeMic({
			pttAudioChunk,
			pttEnd,
			getSampleRate: () => liveSampleRate,
			pttUp: () => pttEnd.fire(),
		});

		const session = store.add(createSession(mic, {
			executeCommand: async (id: string, ...args: unknown[]) => {
				if (id === 'safeappeals-audio.transcribePcm') {
					commandPayloads.push(args[0]);
					return 'ok';
				}
				return undefined;
			},
		}));

		await session.start();

		// Mic context gone after release — stop must still use the captured rate.
		liveSampleRate = undefined;
		pttAudioChunk.fire(btoa('\0\0'));
		await delay(250);
		await session.stop();

		assert.deepStrictEqual(commandPayloads, [{
			pcm16Base64: btoa('\0\0'),
			sampleRate: 44100,
		}]);
	});

	function createSession(
		mic: IMicCaptureService,
		options: {
			onNotify?: (notification: INotification) => void;
			executeCommand?: (id: string, ...args: unknown[]) => Promise<unknown>;
		} = {},
	): DictationSession {
		const instantiationService = store.add(new TestInstantiationService());
		instantiationService.stub(IConfigurationService, new TestConfigurationService());
		instantiationService.stub(IContextKeyService, store.add(instantiationService.createInstance(ContextKeyService)));
		instantiationService.stub(ILogService, new NullLogService());
		instantiationService.stub(IMicCaptureService, mic);

		const notificationService = new class extends TestNotificationService {
			override notify(notification: INotification) {
				options.onNotify?.(notification);
				return super.notify(notification);
			}
		}();
		instantiationService.stub(INotificationService, notificationService);

		instantiationService.stub(IExtensionService, {
			getExtension: async () => ({ identifier: { value: 'safeappeals.safeappeals-audio' } } as IExtensionDescription),
		} as Partial<IExtensionService>);

		instantiationService.stub(ICommandService, {
			executeCommand: async (id: string, ...args: unknown[]) => {
				if (options.executeCommand) {
					return options.executeCommand(id, ...args);
				}
				return undefined;
			},
		} as Partial<ICommandService>);

		return instantiationService.createInstance(DictationSession);
	}
});

function createFakeMic(options: {
	pttAudioChunk: Emitter<string>;
	pttEnd: Emitter<void>;
	sampleRate?: number;
	getSampleRate?: () => number | undefined;
	pttUp: () => void;
}): IMicCaptureService {
	return {
		_serviceBrand: undefined,
		onPttStart: Event.None,
		onPttAudioChunk: options.pttAudioChunk.event,
		onPttEnd: options.pttEnd.event,
		onMonitorAudioChunk: Event.None,
		onPttDiagnostic: Event.None,
		analyserNode: undefined,
		get sampleRate() {
			return options.getSampleRate ? options.getSampleRate() : options.sampleRate;
		},
		isCapturing: false,
		isMuted: false,
		prepare: () => { },
		startCapture: async () => { },
		stopCapture: () => { },
		pttDown: async () => { },
		pttUp: options.pttUp,
		abortPtt: () => { },
		startMonitor: async () => { },
		stopMonitor: () => { },
		suppressUntil: () => { },
	};
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
