# Audio Recorder Developer Guide

## Architecture Overview

The Audio Recorder is implemented as a **native contribution** rather than an extension, providing improved performance through direct process communication instead of Extension Host IPC.

### Process Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser Process                              │
│  ┌─────────────────────┐    ┌─────────────────────────────────────┐ │
│  │  AudioRecorderPane  │────│  React UI (audio-recorder-tsx)      │ │
│  │  (ViewPane)         │    │  - AudioRecorder.tsx                │ │
│  └─────────────────────┘    │  - RecordingControls.tsx            │ │
│           │                 │  - RecordingsList.tsx               │ │
│           │                 │  - RecordingCard.tsx                │ │
│           ▼                 │  - AudioPlaybackBar.tsx             │ │
│  ┌─────────────────────┐    │  - AudioImporter.tsx                │ │
│  │ AudioRecorderService│    └─────────────────────────────────────┘ │
│  │ - MediaRecorder     │                                            │
│  │ - Web Audio API     │                                            │
│  │ - Whisper (dynamic) │                                            │
│  └─────────────────────┘                                            │
│           │                                                          │
│           │ IPC Channel                                              │
│           ▼                                                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ void-channel-audio-recorder
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Main Process (Node.js)                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  AudioRecorderMainService                      │  │
│  │  - SQLite database (better-sqlite3)                           │  │
│  │  - File system operations                                      │  │
│  │  - Export generation (docx, srt, txt, json)                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/vs/workbench/contrib/void/
├── common/audioRecorder/
│   ├── audioRecorderTypes.ts    # Shared types, interfaces, constants
│   ├── IAudioRecorderService.ts # Service interface + DI decorator
│   └── index.ts
├── electron-main/audioRecorder/
│   ├── audioRecorderMainService.ts  # SQLite, file I/O, export
│   ├── audioRecorderChannel.ts      # IPC channel implementation
│   └── index.ts
├── browser/audioRecorder/
│   ├── audioRecorderService.ts      # Browser-side service
│   ├── audioRecorderPane.ts         # ViewPane wrapper
│   ├── audioRecorder.contribution.ts # View + commands registration
│   └── index.ts
└── browser/react/src/audio-recorder-tsx/
    ├── index.tsx              # Mount entry point
    ├── AudioRecorder.tsx      # Main container
    ├── RecordingControls.tsx  # Timer + buttons
    ├── RecordingsList.tsx     # Scrollable list
    ├── RecordingCard.tsx      # Card with playback
    ├── AudioPlaybackBar.tsx   # Seek + controls
    └── AudioImporter.tsx      # Drag-drop import
```

## Type Definitions

### Core Types (`audioRecorderTypes.ts`)

```typescript
// Recording state machine
export type RecorderState = 'idle' | 'recording' | 'paused';

// Transcription status
export type RecordingStatus = 'pending' | 'transcribing' | 'completed' | 'failed';

// Playback state
export interface PlaybackState {
    recordingId: string | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
}

// Recording metadata
export interface Recording {
    id: string;
    filename: string;
    filePath: string;
    createdAt: string;
    duration: number;
    status: RecordingStatus;
    transcript?: string;
    transcriptSegments?: TranscriptSegment[];
    isImported: boolean;
    language?: string;
}

// Transcript segment with timing
export interface TranscriptSegment {
    start: number;
    end: number;
    text: string;
}

// Transcription result
export interface TranscriptionResult {
    success: boolean;
    text?: string;
    segments?: TranscriptSegment[];
    language?: string;
    error?: string;
}

// Export formats
export type ExportFormat = 'txt' | 'srt' | 'json' | 'docx';

// Supported audio formats
export const SUPPORTED_AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.ogg', '.webm', '.flac'];
```

## Service Interface

### IAudioRecorderService

```typescript
export interface IAudioRecorderService {
    readonly _serviceBrand: undefined;
    
    // State
    readonly state: RecorderState;
    readonly recordings: Recording[];
    readonly playbackState: PlaybackState;
    
    // Events
    readonly onStateChanged: Event<RecorderState>;
    readonly onRecordingsChanged: Event<Recording[]>;
    readonly onPlaybackStateChanged: Event<PlaybackState>;
    readonly onRecordingProgress: Event<{ stage: string; progress: number }>;
    
    // Recording lifecycle
    startRecording(): Promise<void>;
    pauseRecording(): Promise<void>;
    resumeRecording(): Promise<void>;
    stopRecording(): Promise<Recording>;
    
    // Recording management
    getRecordings(): Promise<Recording[]>;
    getRecording(id: string): Promise<Recording | undefined>;
    deleteRecording(id: string): Promise<void>;
    importAudioFile(filePath: string): Promise<Recording>;
    
    // Playback
    getAudioUrl(recordingId: string): Promise<string>;
    play(recordingId: string): Promise<void>;
    pause(): void;
    seek(time: number): void;
    setVolume(volume: number): void;
    
    // Transcription
    transcribe(recordingId: string): Promise<TranscriptionResult>;
    
    // Export
    exportRecording(recordingId: string, format: ExportFormat): Promise<void>;
}

export const IAudioRecorderService = createDecorator<IAudioRecorderService>('audioRecorderService');
```

## Browser Service Implementation

### Recording Pipeline

```typescript
// 1. Create MediaRecorder
private async startRecording(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    this.chunks = [];
    
    this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data);
    this.mediaRecorder.start();
    this._state = 'recording';
}

// 2. Stop and convert to WAV
private async stopRecording(): Promise<Recording> {
    this.mediaRecorder.stop();
    const webmBlob = new Blob(this.chunks, { type: 'audio/webm' });
    const wavBuffer = await this.convertToWav(webmBlob);
    
    // Send to main process via IPC
    const recording = await this.channelClient.saveRecording({
        audioData: wavBuffer,
        duration: this.elapsedTime
    });
    
    return recording;
}

// 3. WebM to WAV conversion using Web Audio API
private async convertToWav(webmBlob: Blob): Promise<ArrayBuffer> {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Get mono channel at 16kHz
    const samples = audioBuffer.getChannelData(0);
    return this.encodeWav(samples, 16000);
}
```

### Playback Implementation

```typescript
// Using HTML5 Audio element with blob URLs
private audioElement: HTMLAudioElement | null = null;
private blobUrlCache: Map<string, string> = new Map();

async getAudioUrl(recordingId: string): Promise<string> {
    if (this.blobUrlCache.has(recordingId)) {
        return this.blobUrlCache.get(recordingId)!;
    }
    
    // Fetch audio data from main process
    const audioData = await this.channelClient.getAudioData(recordingId);
    const blob = new Blob([audioData], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    
    this.blobUrlCache.set(recordingId, url);
    return url;
}

// Cleanup on dispose
dispose(): void {
    for (const url of this.blobUrlCache.values()) {
        URL.revokeObjectURL(url);
    }
    this.blobUrlCache.clear();
}
```

### Transcription with Whisper

```typescript
async transcribe(recordingId: string): Promise<TranscriptionResult> {
    // Dynamic import of transformers.js
    const { pipeline } = await import('@huggingface/transformers');
    
    // Load Whisper model (cached after first use)
    const transcriber = await pipeline(
        'automatic-speech-recognition',
        'distil-whisper/distil-large-v3.5-ONNX',
        { 
            dtype: 'fp32',
            progress_callback: (progress) => {
                this._onRecordingProgress.fire({
                    stage: progress.status,
                    progress: progress.progress || 0
                });
            }
        }
    );
    
    // Get audio and transcribe
    const audioUrl = await this.getAudioUrl(recordingId);
    const result = await transcriber(audioUrl, {
        return_timestamps: 'word',
        language: 'english'
    });
    
    return {
        success: true,
        text: result.text,
        segments: result.chunks?.map(c => ({
            start: c.timestamp[0],
            end: c.timestamp[1],
            text: c.text
        })),
        language: result.language
    };
}
```

## Main Process Implementation

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    duration_seconds REAL,
    file_size_bytes INTEGER,
    sample_rate INTEGER DEFAULT 16000,
    channels INTEGER DEFAULT 1,
    created_at INTEGER,
    transcription_status TEXT DEFAULT 'pending',
    transcription_text TEXT,
    transcription_segments TEXT,  -- JSON array
    transcription_language TEXT,
    is_imported INTEGER DEFAULT 0,
    original_filename TEXT
);

CREATE INDEX IF NOT EXISTS idx_recordings_workspace 
    ON recordings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created 
    ON recordings(created_at DESC);
```

### File Operations

```typescript
// Storage paths
getWorkspacePath(workspaceId: string): string {
    return path.join(
        os.homedir(),
        '.safe-appeals-navigator',
        'databases',
        'workspaces',
        workspaceId
    );
}

getRecordingsPath(workspaceId: string): string {
    return path.join(this.getWorkspacePath(workspaceId), 'recordings');
}

getDatabasePath(workspaceId: string): string {
    return path.join(this.getWorkspacePath(workspaceId), 'audio_recordings.db');
}
```

### Export Generation

```typescript
async exportRecording(
    recordingId: string, 
    format: ExportFormat
): Promise<{ data: ArrayBuffer; filename: string }> {
    const recording = await this.getRecording(recordingId);
    
    switch (format) {
        case 'txt':
            return this.exportAsTxt(recording);
        case 'srt':
            return this.exportAsSrt(recording);
        case 'json':
            return this.exportAsJson(recording);
        case 'docx':
            return this.exportAsDocx(recording);
    }
}

// SRT format example
private exportAsSrt(recording: Recording): { data: ArrayBuffer; filename: string } {
    let srt = '';
    recording.transcriptSegments?.forEach((seg, i) => {
        srt += `${i + 1}\n`;
        srt += `${this.formatSrtTime(seg.start)} --> ${this.formatSrtTime(seg.end)}\n`;
        srt += `${seg.text}\n\n`;
    });
    
    return {
        data: new TextEncoder().encode(srt).buffer,
        filename: `${recording.filename}.srt`
    };
}
```

## IPC Channel

### Channel Definition

```typescript
export class AudioRecorderChannel implements IServerChannel {
    constructor(private service: AudioRecorderMainService) {}
    
    listen(context: any, event: string): Event<any> {
        switch (event) {
            case 'onRecordingAdded': return this.service.onRecordingAdded;
            case 'onRecordingUpdated': return this.service.onRecordingUpdated;
            case 'onRecordingDeleted': return this.service.onRecordingDeleted;
        }
        throw new Error(`Unknown event: ${event}`);
    }
    
    call(context: any, command: string, args?: any): Promise<any> {
        switch (command) {
            case 'saveRecording': return this.service.saveRecording(args);
            case 'getRecordings': return this.service.getRecordings(args.workspaceId);
            case 'getAudioData': return this.service.getAudioData(args.recordingId);
            case 'deleteRecording': return this.service.deleteRecording(args.recordingId);
            case 'updateTranscription': return this.service.updateTranscription(args);
            case 'exportRecording': return this.service.exportRecording(args.id, args.format);
        }
        throw new Error(`Unknown command: ${command}`);
    }
}
```

### Channel Registration (`app.ts`)

```typescript
// In CodeApplication.createMainServices()
import { AudioRecorderChannel } from '../../workbench/contrib/void/electron-main/audioRecorder/audioRecorderChannel.js';
import { AudioRecorderMainService } from '../../workbench/contrib/void/electron-main/audioRecorder/audioRecorderMainService.js';

// Register channel
const audioRecorderMainService = new AudioRecorderMainService(accessor.get(ILogService));
const audioRecorderChannel = new AudioRecorderChannel(audioRecorderMainService);
mainProcessElectronServer.registerChannel('void-channel-audio-recorder', audioRecorderChannel);
```

## React Components

### Mount Integration

```typescript
// index.tsx
import { mountFnGenerator } from '../util/mountFnGenerator';
import AudioRecorder from './AudioRecorder';

export const mountAudioRecorder = mountFnGenerator(AudioRecorder);
```

### Service Access

```typescript
// Using useAccessor hook
import { useAccessor } from '../util/services';

const AudioRecorder: React.FC = () => {
    const accessor = useAccessor();
    const audioService = accessor.get(IAudioRecorderService);
    
    const [state, setState] = useState(audioService.state);
    const [recordings, setRecordings] = useState<Recording[]>([]);
    
    useEffect(() => {
        // Subscribe to service events
        const disposable = audioService.onStateChanged(setState);
        return () => disposable.dispose();
    }, []);
    
    // ...
};
```

### Styling Conventions

Follow the existing Timeline CSS patterns:

```typescript
// Use VSCode CSS variables via inline styles
const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--vscode-editor-background)',
    border: '1px solid var(--vscode-panel-border)',
    borderRadius: '6px',
    padding: '12px'
};

// Use Tailwind for layout (scoped via void-scope parent)
<div className="void-scope">
    <div className="flex flex-col gap-3">
        {/* components */}
    </div>
</div>
```

## Build Configuration

### tsup.config.js

```javascript
// Add to entry array
entry: [
    // ... existing entries
    './src2/audio-recorder-tsx/index.tsx'
]
```

### Contribution Registration

```typescript
// audioRecorder.contribution.ts
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { AudioRecorderService } from './audioRecorderService';
import { IAudioRecorderService } from '../common/audioRecorder';

// Register service
registerSingleton(IAudioRecorderService, AudioRecorderService, InstantiationType.Delayed);

// Register view container
const viewContainer = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry)
    .registerViewContainer({
        id: 'audioRecorder',
        title: 'Audio Recorder',
        icon: Codicon.mic,
        ctorDescriptor: new SyncDescriptor(ViewPaneContainer),
        order: 15
    }, ViewContainerLocation.Sidebar);

// Register view
Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
    id: 'audioRecorder.panel',
    name: 'Audio Recorder',
    containerIcon: Codicon.mic,
    ctorDescriptor: new SyncDescriptor(AudioRecorderPane),
    canToggleVisibility: true
}], viewContainer);
```

## Testing

### Unit Tests

```typescript
describe('AudioRecorderService', () => {
    test('should start recording', async () => {
        const service = new AudioRecorderService(/* mocks */);
        await service.startRecording();
        expect(service.state).toBe('recording');
    });
    
    test('should convert WebM to WAV', async () => {
        // Test WebM → WAV conversion
    });
});
```

### Integration Tests

```typescript
describe('Audio Recorder Integration', () => {
    test('should save and retrieve recording', async () => {
        // Test full pipeline: record → save → retrieve
    });
    
    test('should transcribe with Whisper', async () => {
        // Test transcription (requires model)
    });
});
```

## Performance Considerations

### Memory Management

- Use blob URLs with cleanup on dispose
- Lazy load audio data on first play
- Clear caches when switching workspaces

### CPU Usage

- Whisper runs on main thread (can block UI during heavy transcription)
- Consider Web Worker for transcription in future

### Storage

- WAV files are uncompressed (~10MB/minute)
- Consider MP3 export for archival
- Database uses SQLite with indexed queries
