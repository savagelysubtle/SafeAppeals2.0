/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mainWindow } from '../../../../base/browser/window.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextKey, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IMicCaptureService } from '../../chat/browser/voiceClient/micCaptureService.js';
import { concatPcm16Base64Chunks } from './pcmChunks.js';

export const SAFEAPPEALS_DICTATION_ACTIVE = new RawContextKey<boolean>('safeappealsDictationActive', false);

export const IDictationSession = createDecorator<IDictationSession>('safeappealsDictationSession');

const AUDIO_EXTENSION_ID = 'safeappeals.safeappeals-audio';
const TRANSCRIBE_PCM_COMMAND = 'safeappeals-audio.transcribePcm';
const INSERT_TEXT_COMMAND = '_chat.dictation.insertText';

/** Soft maximum hold duration before auto-stop. */
const MAX_HOLD_MS = 60_000;
/** Ignore / toast holds shorter than this (or with no audio). */
const MIN_HOLD_MS = 200;

export interface IDictationSession {
	readonly _serviceBrand: undefined;

	readonly isActive: boolean;

	/**
	 * Store a window for lazy mic acquisition (same contract as {@link IMicCaptureService.prepare}).
	 */
	prepare(window: Window & typeof globalThis): void;

	/**
	 * Begin a hold-to-dictate PTT press and start accumulating PCM chunks.
	 * When `trackPointerRelease` is true, also end the hold on window-level
	 * pointerup (backup if the pointer leaves the mic control).
	 */
	start(options?: { trackPointerRelease?: boolean }): Promise<void>;

	/**
	 * End the hold: drain mic → wait for `onPttEnd` → transcribe → insert into chat.
	 * No-op when not active or already stopping.
	 */
	stop(): Promise<void>;

	/**
	 * Abort the current press without insert. Uses {@link IMicCaptureService.abortPtt}
	 * (which suppresses `onPttEnd`).
	 */
	cancel(): void;
}

export class DictationSession extends Disposable implements IDictationSession {
	declare readonly _serviceBrand: undefined;

	private readonly _activeKey: IContextKey<boolean>;
	private _window: (Window & typeof globalThis) | undefined;
	private _phase: 'idle' | 'holding' | 'stopping' = 'idle';
	private _chunks: string[] = [];
	private _holdStartedAt = 0;
	/** Captured while mic AudioContext is live (after pttDown); used after drain. */
	private _sampleRate = 16000;
	/** Bumped on each start; cancel invalidates in-flight stop(). */
	private _sessionGeneration = 0;
	/** Set by cancel(); stop() must not toast or insert after this. */
	private _discarded = false;
	private _sessionDisposables = this._register(new DisposableStore());
	private _maxHoldTimer: ReturnType<typeof setTimeout> | undefined;
	private _pttEndWaiter: { resolve: () => void; promise: Promise<void> } | undefined;

	constructor(
		@IMicCaptureService private readonly mic: IMicCaptureService,
		@ICommandService private readonly commandService: ICommandService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@INotificationService private readonly notificationService: INotificationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this._activeKey = SAFEAPPEALS_DICTATION_ACTIVE.bindTo(contextKeyService);
	}

	get isActive(): boolean {
		return this._phase !== 'idle';
	}

	prepare(window: Window & typeof globalThis): void {
		this._window = window;
		this.mic.prepare(window);
	}

	async start(options?: { trackPointerRelease?: boolean }): Promise<void> {
		if (this._phase !== 'idle') {
			return;
		}

		const win = this._window ?? mainWindow;
		this.prepare(win);

		this._sessionGeneration++;
		const sessionGeneration = this._sessionGeneration;
		this._discarded = false;
		this._phase = 'holding';
		this._activeKey.set(true);
		this._chunks = [];
		this._holdStartedAt = Date.now();
		this._sampleRate = 16000;
		this._sessionDisposables.clear();

		this._sessionDisposables.add(this.mic.onPttAudioChunk(chunk => {
			if (this._phase === 'holding' || this._phase === 'stopping') {
				this._chunks.push(chunk);
			}
		}));

		let resolvePttEnd!: () => void;
		const pttEndPromise = new Promise<void>(resolve => {
			resolvePttEnd = resolve;
		});
		this._pttEndWaiter = { resolve: resolvePttEnd, promise: pttEndPromise };
		this._sessionDisposables.add(this.mic.onPttEnd(() => {
			this._pttEndWaiter?.resolve();
		}));

		// Window-level release backup for pointer holds (keyboard hold mode
		// owns release via enableKeybindingHoldMode).
		if (options?.trackPointerRelease) {
			this._sessionDisposables.add(addWindowPointerUp(win, () => {
				void this.stop();
			}));
		}

		this._maxHoldTimer = setTimeout(() => {
			this._maxHoldTimer = undefined;
			void this.stop();
		}, MAX_HOLD_MS);

		const turnId = `dictation:${generateUuid()}`;
		try {
			await this.mic.pttDown(turnId);
			if (this._isDiscarded(sessionGeneration)) {
				return;
			}
			// Capture while mic AudioContext is live — may be gone after onPttEnd.
			this._sampleRate = this.mic.sampleRate ?? 16000;
		} catch (err) {
			this.logService.warn('[safeappealsDictation] mic pttDown failed', err);
			this._resetSession();
			// Mic permission toast is already surfaced by IMicCaptureService.
		}
	}

	async stop(): Promise<void> {
		if (this._phase !== 'holding') {
			return;
		}
		this._phase = 'stopping';
		this._clearMaxHoldTimer();

		const sessionGeneration = this._sessionGeneration;
		const heldMs = Date.now() - this._holdStartedAt;
		const sampleRate = this._sampleRate;
		const pttEndPromise = this._pttEndWaiter?.promise;

		this.mic.pttUp();

		if (pttEndPromise) {
			await pttEndPromise;
		}
		if (this._isDiscarded(sessionGeneration)) {
			return;
		}

		const chunks = this._chunks.slice();
		this._sessionDisposables.clear();
		this._pttEndWaiter = undefined;

		if (heldMs < MIN_HOLD_MS || chunks.length === 0) {
			this._resetSession();
			if (this._isDiscarded(sessionGeneration)) {
				return;
			}
			this.notificationService.notify({
				severity: Severity.Info,
				message: localize('safeappeals.dictation.holdTooShort', "Hold the mic a moment longer to dictate."),
			});
			return;
		}

		const pcm16Base64 = concatPcm16Base64Chunks(chunks);

		try {
			const ext = await this.extensionService.getExtension(AUDIO_EXTENSION_ID);
			if (this._isDiscarded(sessionGeneration)) {
				return;
			}
			if (!ext) {
				this.notificationService.notify({
					severity: Severity.Error,
					message: localize('safeappeals.dictation.extensionMissing', "Audio extension required for dictation."),
				});
				this._resetSession();
				return;
			}

			const text = await this.commandService.executeCommand<string>(TRANSCRIBE_PCM_COMMAND, {
				pcm16Base64,
				sampleRate,
			});
			if (this._isDiscarded(sessionGeneration)) {
				return;
			}

			const transcript = typeof text === 'string' ? text.trim() : '';
			if (!transcript) {
				// Soft: empty ASR — no insert, no hard error.
				this._resetSession();
				return;
			}

			await this.commandService.executeCommand(INSERT_TEXT_COMMAND, transcript);
		} catch (err) {
			if (this._isDiscarded(sessionGeneration)) {
				return;
			}
			this._notifyTranscribeError(err);
		} finally {
			if (!this._isDiscarded(sessionGeneration)) {
				this._resetSession();
			}
		}
	}

	cancel(): void {
		if (this._phase === 'idle') {
			return;
		}
		this._discarded = true;
		// abortPtt suppresses onPttEnd — resolve any waiter so stop() cannot hang.
		this._pttEndWaiter?.resolve();
		this.mic.abortPtt();
		this._resetSession();
	}

	private _isDiscarded(sessionGeneration: number): boolean {
		return this._discarded || this._sessionGeneration !== sessionGeneration;
	}

	private _notifyTranscribeError(err: unknown): void {
		const message = err instanceof Error ? err.message : String(err);
		const lower = message.toLowerCase();

		if (lower.includes('command') && (lower.includes('not found') || lower.includes('not known'))) {
			this.notificationService.notify({
				severity: Severity.Error,
				message: localize('safeappeals.dictation.extensionMissing', "Audio extension required for dictation."),
			});
			return;
		}

		if (lower.includes('busy')) {
			this.notificationService.notify({
				severity: Severity.Warning,
				message: localize('safeappeals.dictation.whisperBusy', "Whisper busy — try again."),
			});
			return;
		}

		if (lower.includes('whisper') || lower.includes('model') || lower.includes('unavailable')) {
			this.notificationService.notify({
				severity: Severity.Error,
				message: message || localize('safeappeals.dictation.whisperUnavailable', "Whisper unavailable — install or choose a model."),
			});
			return;
		}

		this.notificationService.notify({
			severity: Severity.Error,
			message: localize('safeappeals.dictation.transcribeFailed', "Dictation failed: {0}", message),
		});
	}

	private _clearMaxHoldTimer(): void {
		if (this._maxHoldTimer !== undefined) {
			clearTimeout(this._maxHoldTimer);
			this._maxHoldTimer = undefined;
		}
	}

	private _resetSession(): void {
		this._clearMaxHoldTimer();
		this._sessionDisposables.clear();
		this._pttEndWaiter = undefined;
		this._chunks = [];
		this._holdStartedAt = 0;
		this._phase = 'idle';
		this._activeKey.set(false);
	}
}

function addWindowPointerUp(win: Window & typeof globalThis, handler: () => void): { dispose(): void } {
	const onUp = () => handler();
	win.addEventListener('pointerup', onUp, true);
	win.addEventListener('pointercancel', onUp, true);
	return {
		dispose: () => {
			win.removeEventListener('pointerup', onUp, true);
			win.removeEventListener('pointercancel', onUp, true);
		}
	};
}

registerSingleton(IDictationSession, DictationSession, InstantiationType.Delayed);
