/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef, useState } from 'react';

type RecorderState = 'idle' | 'recording' | 'paused';
type RecordingStatus = 'pending' | 'transcribing' | 'completed' | 'failed';
type ExportFormat = 'txt' | 'srt' | 'json' | 'docx';
type AudioExportFormat = 'wav' | 'flac' | 'mp3' | 'm4a';

interface TranscriptSegment {
	start: number;
	end: number;
	text: string;
	speaker?: string;
}

interface StoredRecording {
	id: string;
	filename: string;
	createdAt: string;
	duration: number;
	status: RecordingStatus;
	mimeType: string;
	isImported: boolean;
	fileSizeBytes?: number;
	transcript?: string;
	transcriptSegments?: TranscriptSegment[];
	diarizationIntervals?: { start: number; end: number; speakerId: number }[];
}

interface CapabilityStatus {
	whisperAddon: { available: boolean; detail?: string };
	whisperModel: { available: boolean; path?: string; detail?: string };
	ffmpeg: { available: boolean; path?: string; detail?: string };
	ffprobe: { available: boolean; path?: string; detail?: string };
	diarization: {
		available: boolean;
		enabled: boolean;
		detail?: string;
	};
	secretStorage: { available: boolean; detail?: string };
	memoryOnly: boolean;
}

interface TranscriptionProgress {
	recordingId: string;
	progress: number;
	stage: 'loading_model' | 'processing' | 'finalizing';
}

type HostMessage =
	| {
		type: 'bootstrap';
		recordings: StoredRecording[];
		capabilities: CapabilityStatus;
		hasWorkspace: boolean;
		memoryOnly: boolean;
		recorderState: RecorderState;
		elapsedSeconds: number;
	}
	| { type: 'recordingsUpdated'; recordings: StoredRecording[] }
	| { type: 'capabilitiesUpdated'; capabilities: CapabilityStatus; memoryOnly: boolean }
	| { type: 'transcriptionProgress'; progress: TranscriptionProgress }
	| { type: 'playbackData'; id: string; mimeType: string; audioBase64: string }
	| { type: 'command'; command: 'startRecording' | 'stopRecording' | 'pauseRecording' | 'resumeRecording' }
	| { type: 'error'; message: string };

declare function acquireVsCodeApi(): {
	postMessage(message: unknown): void;
};

const vscode = acquireVsCodeApi();

const STAGE_LABELS: Record<TranscriptionProgress['stage'], string> = {
	loading_model: 'Loading model',
	processing: 'Processing',
	finalizing: 'Finalizing',
};

function formatElapsed(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const m = Math.floor(total / 60).toString().padStart(2, '0');
	const s = (total % 60).toString().padStart(2, '0');
	return `${m}:${s}`;
}

function formatBytes(bytes: number | undefined): string {
	if (bytes === undefined) {
		return '';
	}
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pickRecorderMimeType(): string {
	const candidates = [
		'audio/webm;codecs=opus',
		'audio/webm',
		'audio/ogg;codecs=opus',
		'audio/mp4',
	];
	for (const type of candidates) {
		if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
			return type;
		}
	}
	return '';
}

function isWavFilename(filename: string): boolean {
	return filename.toLowerCase().endsWith('.wav');
}

function formatTranscriptPreview(recording: StoredRecording): string | undefined {
	const segments = recording.transcriptSegments;
	if (segments?.some(segment => !!segment.speaker)) {
		const labeled = segments
			.slice(0, 4)
			.map(segment => {
				const text = segment.text.trim();
				return segment.speaker ? `${segment.speaker}: ${text}` : text;
			})
			.filter(Boolean)
			.join(' ');
		if (!labeled) {
			return undefined;
		}
		return labeled.length > 160 ? `${labeled.slice(0, 160)}…` : labeled;
	}
	if (recording.transcript) {
		return recording.transcript.length > 160
			? `${recording.transcript.slice(0, 160)}…`
			: recording.transcript;
	}
	return undefined;
}

export function App(): React.ReactElement {
	const [recordings, setRecordings] = useState<StoredRecording[]>([]);
	const [capabilities, setCapabilities] = useState<CapabilityStatus | undefined>();
	const [hasWorkspace, setHasWorkspace] = useState(false);
	const [memoryOnly, setMemoryOnly] = useState(false);
	const [recorderState, setRecorderState] = useState<RecorderState>('idle');
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const [error, setError] = useState<string | undefined>();
	const [playingId, setPlayingId] = useState<string | undefined>();
	const [playbackUrl, setPlaybackUrl] = useState<string | undefined>();
	const [progress, setProgress] = useState<TranscriptionProgress | null>(null);

	const mediaRecorderRef = useRef<MediaRecorder | undefined>(undefined);
	const streamRef = useRef<MediaStream | undefined>(undefined);
	const chunksRef = useRef<Blob[]>([]);
	const startedAtRef = useRef<number>(0);
	const accumulatedRef = useRef<number>(0);
	const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
	const mimeTypeRef = useRef<string>('');
	const playbackUrlRef = useRef<string | undefined>(undefined);

	const clearTimer = useCallback(() => {
		if (timerRef.current !== undefined) {
			clearInterval(timerRef.current);
			timerRef.current = undefined;
		}
	}, []);

	const publishState = useCallback((state: RecorderState, elapsed: number) => {
		setRecorderState(state);
		setElapsedSeconds(elapsed);
		vscode.postMessage({ type: 'recorderState', state, elapsedSeconds: elapsed });
	}, []);

	const stopTracks = useCallback(() => {
		streamRef.current?.getTracks().forEach(track => track.stop());
		streamRef.current = undefined;
	}, []);

	const stopRecording = useCallback(() => {
		const recorder = mediaRecorderRef.current;
		if (!recorder || recorder.state === 'inactive') {
			return;
		}
		recorder.stop();
	}, []);

	const startRecording = useCallback(async () => {
		if (memoryOnly) {
			setError('Secure storage is unavailable — recording is disabled in memory-only mode.');
			return;
		}
		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
			return;
		}
		setError(undefined);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			const mimeType = pickRecorderMimeType();
			mimeTypeRef.current = mimeType;
			const recorder = mimeType
				? new MediaRecorder(stream, { mimeType })
				: new MediaRecorder(stream);
			chunksRef.current = [];
			accumulatedRef.current = 0;
			startedAtRef.current = Date.now();
			recorder.ondataavailable = event => {
				if (event.data.size > 0) {
					chunksRef.current.push(event.data);
				}
			};
			recorder.onstop = () => {
				clearTimer();
				const blob = new Blob(chunksRef.current, {
					type: mimeTypeRef.current || recorder.mimeType || 'audio/webm',
				});
				const duration = accumulatedRef.current + (Date.now() - startedAtRef.current) / 1000;
				stopTracks();
				mediaRecorderRef.current = undefined;
				publishState('idle', 0);
				void blob.arrayBuffer().then(buffer => {
					const bytes = new Uint8Array(buffer);
					let binary = '';
					for (let i = 0; i < bytes.length; i++) {
						binary += String.fromCharCode(bytes[i]!);
					}
					const audioBase64 = btoa(binary);
					const stamp = new Date().toISOString().replace(/[:.]/g, '-');
					vscode.postMessage({
						type: 'saveRecording',
						filename: `recording-${stamp}.webm`,
						mimeType: blob.type || 'audio/webm',
						duration,
						audioBase64,
					});
				});
			};
			mediaRecorderRef.current = recorder;
			recorder.start(250);
			clearTimer();
			timerRef.current = setInterval(() => {
				const elapsed = accumulatedRef.current + (Date.now() - startedAtRef.current) / 1000;
				publishState('recording', elapsed);
			}, 200);
			publishState('recording', 0);
		} catch (err) {
			stopTracks();
			const detail = err instanceof Error ? err.message : String(err);
			setError(`Microphone access failed: ${detail}`);
			vscode.postMessage({ type: 'error', message: `Microphone access failed: ${detail}` });
			publishState('idle', 0);
		}
	}, [clearTimer, memoryOnly, publishState, stopTracks]);

	const pauseRecording = useCallback(() => {
		const recorder = mediaRecorderRef.current;
		if (!recorder || recorder.state !== 'recording') {
			return;
		}
		recorder.pause();
		accumulatedRef.current += (Date.now() - startedAtRef.current) / 1000;
		clearTimer();
		publishState('paused', accumulatedRef.current);
	}, [clearTimer, publishState]);

	const resumeRecording = useCallback(() => {
		const recorder = mediaRecorderRef.current;
		if (!recorder || recorder.state !== 'paused') {
			return;
		}
		startedAtRef.current = Date.now();
		recorder.resume();
		clearTimer();
		timerRef.current = setInterval(() => {
			const elapsed = accumulatedRef.current + (Date.now() - startedAtRef.current) / 1000;
			publishState('recording', elapsed);
		}, 200);
		publishState('recording', accumulatedRef.current);
	}, [clearTimer, publishState]);

	useEffect(() => {
		const onMessage = (event: MessageEvent<HostMessage>) => {
			const msg = event.data;
			switch (msg.type) {
				case 'bootstrap':
					setRecordings(msg.recordings);
					setCapabilities(msg.capabilities);
					setHasWorkspace(msg.hasWorkspace);
					setMemoryOnly(msg.memoryOnly);
					setRecorderState(msg.recorderState);
					setElapsedSeconds(msg.elapsedSeconds);
					setError(undefined);
					return;
				case 'recordingsUpdated':
					setRecordings(msg.recordings);
					return;
				case 'capabilitiesUpdated':
					setCapabilities(msg.capabilities);
					setMemoryOnly(msg.memoryOnly);
					return;
				case 'transcriptionProgress':
					setProgress(msg.progress);
					if (msg.progress.progress >= 100) {
						window.setTimeout(() => setProgress(null), 1500);
					}
					return;
				case 'playbackData': {
					if (playbackUrlRef.current) {
						URL.revokeObjectURL(playbackUrlRef.current);
					}
					const binary = atob(msg.audioBase64);
					const bytes = new Uint8Array(binary.length);
					for (let i = 0; i < binary.length; i++) {
						bytes[i] = binary.charCodeAt(i);
					}
					const url = URL.createObjectURL(new Blob([bytes], { type: msg.mimeType }));
					playbackUrlRef.current = url;
					setPlayingId(msg.id);
					setPlaybackUrl(url);
					return;
				}
				case 'command':
					if (msg.command === 'startRecording') {
						void startRecording();
					} else if (msg.command === 'stopRecording') {
						stopRecording();
					} else if (msg.command === 'pauseRecording') {
						pauseRecording();
					} else if (msg.command === 'resumeRecording') {
						resumeRecording();
					}
					return;
				case 'error':
					setError(msg.message);
					return;
			}
		};
		window.addEventListener('message', onMessage);
		vscode.postMessage({ type: 'ready' });
		return () => {
			window.removeEventListener('message', onMessage);
			clearTimer();
			stopTracks();
			if (playbackUrlRef.current) {
				URL.revokeObjectURL(playbackUrlRef.current);
			}
		};
		// Intentionally run once on mount for host bridge lifecycle.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const secretStorageOk = !memoryOnly && !!capabilities?.secretStorage.available;
	const canTranscribeBase = secretStorageOk
		&& !!capabilities?.whisperAddon.available
		&& !!capabilities.whisperModel.available;
	const ffmpegOk = !!capabilities?.ffmpeg.available;

	const showSecureStorageBanner = memoryOnly || (capabilities !== undefined && !capabilities.secretStorage.available);
	const secureStorageDetail = capabilities?.secretStorage.detail;

	const canTranscribeRecording = (recording: StoredRecording): boolean => {
		if (!canTranscribeBase || recording.status === 'transcribing') {
			return false;
		}
		if (!isWavFilename(recording.filename) && !ffmpegOk) {
			return false;
		}
		return true;
	};

	const diarizationAvailable = !!capabilities?.diarization?.available;
	const canIdentifySpeakers = (recording: StoredRecording): boolean => {
		if (recording.status !== 'completed') {
			return false;
		}
		const hasTranscript = !!(recording.transcriptSegments?.length || recording.transcript);
		if (!hasTranscript) {
			return false;
		}
		if (!secretStorageOk || !diarizationAvailable || !ffmpegOk) {
			return false;
		}
		if (progress?.recordingId === recording.id && progress.progress < 100) {
			return false;
		}
		return true;
	};

	const identifySpeakersTitle = !diarizationAvailable
		? (capabilities?.diarization?.detail
			?? 'Speaker identification assets are not installed.')
		: !ffmpegOk
			? 'ffmpeg is required to prepare audio for speaker identification.'
			: !secretStorageOk
				? 'Secure storage is required for speaker identification.'
				: 'Identify speakers on this transcript';

	const hasSpeakerLabels = (recording: StoredRecording): boolean => {
		const labeled = recording.transcriptSegments?.some(seg => !!seg.speaker?.trim());
		const intervals = (recording.diarizationIntervals?.length ?? 0) > 0;
		return !!(labeled || intervals);
	};

	const canRefineTranscript = (recording: StoredRecording): boolean => {
		if (recording.status !== 'completed' || !hasSpeakerLabels(recording)) {
			return false;
		}
		if (!canTranscribeBase) {
			return false;
		}
		if (!isWavFilename(recording.filename) && !ffmpegOk) {
			return false;
		}
		if (progress?.recordingId === recording.id && progress.progress < 100) {
			return false;
		}
		return true;
	};

	const refineTranscriptTitle = (recording: StoredRecording): string => {
		if (!canTranscribeBase) {
			return 'Whisper addon and model are required to improve transcripts.';
		}
		if (!isWavFilename(recording.filename) && !ffmpegOk) {
			return 'ffmpeg is required to prepare audio for transcript improvement.';
		}
		if (!secretStorageOk) {
			return 'Secure storage is required for transcript improvement.';
		}
		return 'Improve this transcript locally with Whisper (speaker cues)';
	};

	return (
		<div className="app">
			<header className="header">
				<h1>Audio Recorder</h1>
				<p>Case recordings stay on this computer, encrypted at rest.</p>
			</header>

			{!hasWorkspace && (
				<div className="banner tip">
					<div>Tip: open a case folder to keep recordings tied to that workspace.</div>
					<div className="row banner-actions">
						<button type="button" className="secondary" onClick={() => vscode.postMessage({ type: 'openFolder' })}>
							Open Folder
						</button>
					</div>
				</div>
			)}

			{showSecureStorageBanner && (
				<div className="banner warn">
					<div>
						{secureStorageDetail
							? `Secure storage unavailable — ${secureStorageDetail} Recordings stay in memory only; transcription is disabled.`
							: 'Secure storage unavailable — recordings stay in memory only; transcription is disabled.'}
					</div>
				</div>
			)}

			{capabilities && !capabilities.whisperAddon.available && (
				<div className="banner warn">
					<div>{capabilities.whisperAddon.detail ?? 'Whisper addon unavailable.'}</div>
				</div>
			)}

			{capabilities && !capabilities.whisperModel.available && (
				<div className="banner warn">
					<div>
						{capabilities.whisperModel.detail
							?? 'Default Whisper model is not installed yet.'}
					</div>
					<div className="row banner-actions">
						<button
							type="button"
							onClick={() => vscode.postMessage({ type: 'downloadWhisperModel' })}
						>
							Install Default Model
						</button>
					</div>
				</div>
			)}

			{capabilities && !capabilities.ffmpeg.available && (
				<div className="banner warn">
					<div>
						{capabilities.ffmpeg.detail
							?? 'ffmpeg not found. Install with: sudo apt install ffmpeg — or set safeappeals.audio.ffmpegPath.'}
					</div>
				</div>
			)}

			{capabilities && !capabilities.diarization?.available && (
				<div className="banner tip">
					<div>
						{capabilities.diarization?.detail
							?? 'Speaker identification is unavailable until diarization assets are installed.'}
					</div>
				</div>
			)}

			{error && <div className="banner error">{error}</div>}

			{progress && (
				<div className="progress-panel">
					<div className="progress-label">
						{STAGE_LABELS[progress.stage]} — {progress.progress}%
					</div>
					<div className="progress-bar">
						<div className="progress-fill" style={{ width: `${progress.progress}%` }} />
					</div>
				</div>
			)}

			<section className="controls">
				<div className={`timer ${recorderState}`}>{formatElapsed(elapsedSeconds)}</div>
				<div className="row">
					{recorderState === 'idle' && (
						<button type="button" disabled={memoryOnly} onClick={() => void startRecording()}>
							Start Recording
						</button>
					)}
					{recorderState === 'recording' && (
						<>
							<button type="button" className="secondary" onClick={pauseRecording}>
								Pause
							</button>
							<button type="button" className="danger" onClick={stopRecording}>
								Stop
							</button>
						</>
					)}
					{recorderState === 'paused' && (
						<>
							<button type="button" onClick={resumeRecording}>
								Resume
							</button>
							<button type="button" className="danger" onClick={stopRecording}>
								Stop
							</button>
						</>
					)}
					<button
						type="button"
						className="secondary"
						disabled={memoryOnly || recorderState !== 'idle'}
						onClick={() => vscode.postMessage({ type: 'importAudio' })}
					>
						Import Audio
					</button>
				</div>
			</section>

			<section className="list">
				{recordings.length === 0 ? (
					<div className="empty">No recordings yet.</div>
				) : (
					recordings.map(recording => {
						const transcriptPreview = formatTranscriptPreview(recording);
						const showIdentify = recording.status === 'completed'
							&& !!(recording.transcriptSegments?.length || recording.transcript);
						const showRefine = recording.status === 'completed' && hasSpeakerLabels(recording);
						return (
						<article key={recording.id} className="card">
							<div className="card-title">{recording.filename}</div>
							<div className="meta">
								<span className={`status ${recording.status}`}>{recording.status}</span>
								{' · '}
								{formatElapsed(recording.duration)}
								{recording.fileSizeBytes !== undefined ? ` · ${formatBytes(recording.fileSizeBytes)}` : ''}
								{recording.isImported ? ' · imported' : ''}
							</div>
							{transcriptPreview && (
								<div className="transcript-preview">{transcriptPreview}</div>
							)}
							<div className="row">
								<button
									type="button"
									className="secondary"
									onClick={() => vscode.postMessage({ type: 'requestPlayback', id: recording.id })}
								>
									Play
								</button>
								<button
									type="button"
									disabled={!canTranscribeRecording(recording)}
									onClick={() => vscode.postMessage({ type: 'transcribe', id: recording.id })}
								>
									Transcribe
								</button>
								{showIdentify && (
									<button
										type="button"
										className="secondary"
										disabled={!canIdentifySpeakers(recording)}
										title={identifySpeakersTitle}
										onClick={() => vscode.postMessage({ type: 'identifySpeakers', id: recording.id })}
									>
										Identify Speakers
									</button>
								)}
								{showRefine && (
									<button
										type="button"
										className="secondary"
										disabled={!canRefineTranscript(recording)}
										title={refineTranscriptTitle(recording)}
										onClick={() => vscode.postMessage({ type: 'refineTranscript', id: recording.id })}
									>
										Improve Transcript
									</button>
								)}
								<button
									type="button"
									className="secondary"
									disabled={recording.status !== 'completed' || !recording.transcript}
									onClick={() => vscode.postMessage({
										type: 'exportTranscript',
										id: recording.id,
									} satisfies { type: 'exportTranscript'; id: string; format?: ExportFormat })}
								>
									Export
								</button>
								<button
									type="button"
									className="secondary"
									onClick={() => vscode.postMessage({
										type: 'exportAudio',
										id: recording.id,
									} satisfies { type: 'exportAudio'; id: string; format?: AudioExportFormat })}
								>
									Export Audio…
								</button>
								<button
									type="button"
									className="danger"
									onClick={() => vscode.postMessage({ type: 'deleteRecording', id: recording.id })}
								>
									Delete
								</button>
							</div>
							{playingId === recording.id && playbackUrl && (
								<div className="playback">
									<audio
										controls
										autoPlay
										src={playbackUrl}
										onEnded={() => {
											if (playbackUrlRef.current) {
												URL.revokeObjectURL(playbackUrlRef.current);
												playbackUrlRef.current = undefined;
											}
											setPlaybackUrl(undefined);
											setPlayingId(undefined);
										}}
									/>
								</div>
							)}
						</article>
						);
					})
				)}
			</section>
		</div>
	);
}
