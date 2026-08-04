/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { AudioExportFormat } from './audioExportService';
import type { CapabilityStatus, RecorderState, StoredRecording, TranscriptionProgress } from './types';
import type { ExportFormat } from './exportService';

export type WebviewToHostMessage =
	| { type: 'ready' }
	| { type: 'saveRecording'; filename: string; mimeType: string; duration: number; audioBase64: string }
	| { type: 'deleteRecording'; id: string }
	| { type: 'renameRecording'; id: string; filename: string }
	| { type: 'requestPlayback'; id: string }
	| { type: 'transcribe'; id: string }
	| { type: 'identifySpeakers'; id: string }
	| { type: 'refineTranscript'; id: string }
	| { type: 'exportTranscript'; id: string; format?: ExportFormat }
	| { type: 'exportAudio'; id: string; format?: AudioExportFormat }
	| { type: 'importAudio' }
	| { type: 'clearCache' }
	| { type: 'openFolder' }
	| { type: 'chooseWhisperModel' }
	| { type: 'downloadWhisperModel' }
	| { type: 'recorderState'; state: RecorderState; elapsedSeconds: number }
	| { type: 'error'; message: string };

export type HostToWebviewMessage =
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
