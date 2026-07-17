# Audio Recorder API Reference

## Service Interface

### IAudioRecorderService

The main service interface for audio recording, playback, and transcription.

```typescript
import { IAudioRecorderService } from 'vs/workbench/contrib/void/common/audioRecorder';

// Access via dependency injection
constructor(@IAudioRecorderService private audioService: IAudioRecorderService) {}
```

---

## Properties

### state

```typescript
readonly state: RecorderState
```

Current recording state.

**Type**: `'idle' | 'recording' | 'paused'`

---

### recordings

```typescript
readonly recordings: Recording[]
```

List of all recordings for the current workspace.

---

### playbackState

```typescript
readonly playbackState: PlaybackState
```

Current playback state including playing status, time, and volume.

---

## Events

### onStateChanged

```typescript
readonly onStateChanged: Event<RecorderState>
```

Fired when the recording state changes.

**Example**:
```typescript
const disposable = audioService.onStateChanged((state) => {
    console.log('Recording state:', state);
});
```

---

### onRecordingsChanged

```typescript
readonly onRecordingsChanged: Event<Recording[]>
```

Fired when the recordings list changes (add, delete, update).

---

### onPlaybackStateChanged

```typescript
readonly onPlaybackStateChanged: Event<PlaybackState>
```

Fired when playback state changes (play, pause, seek, volume).

---

### onRecordingProgress

```typescript
readonly onRecordingProgress: Event<{ stage: string; progress: number }>
```

Fired during transcription to report progress.

**Stages**:
- `download` - Model downloading (0-100%)
- `loading` - Loading model into memory
- `processing` - Processing audio
- `finalizing` - Generating transcript

---

## Methods

### Recording Lifecycle

#### startRecording

```typescript
startRecording(): Promise<void>
```

Starts audio recording using the system microphone.

**Throws**: Error if microphone access is denied.

---

#### pauseRecording

```typescript
pauseRecording(): Promise<void>
```

Pauses the current recording. Can be resumed with `resumeRecording()`.

---

#### resumeRecording

```typescript
resumeRecording(): Promise<void>
```

Resumes a paused recording.

---

#### stopRecording

```typescript
stopRecording(): Promise<Recording>
```

Stops the current recording and saves it.

**Returns**: The newly created `Recording` object.

---

### Recording Management

#### getRecordings

```typescript
getRecordings(): Promise<Recording[]>
```

Retrieves all recordings for the current workspace.

---

#### getRecording

```typescript
getRecording(id: string): Promise<Recording | undefined>
```

Retrieves a specific recording by ID.

**Parameters**:
- `id`: Recording identifier

---

#### deleteRecording

```typescript
deleteRecording(id: string): Promise<void>
```

Deletes a recording and its audio file.

**Parameters**:
- `id`: Recording identifier

---

#### importAudioFile

```typescript
importAudioFile(filePath: string): Promise<Recording>
```

Imports an existing audio file as a recording.

**Parameters**:
- `filePath`: Absolute path to the audio file

**Supported formats**: WAV, MP3, M4A, OGG, WEBM, FLAC

---

### Playback

#### getAudioUrl

```typescript
getAudioUrl(recordingId: string): Promise<string>
```

Gets a blob URL for playing the audio.

**Parameters**:
- `recordingId`: Recording identifier

**Returns**: Blob URL string (e.g., `blob:...`)

**Note**: URLs are cached and cleaned up on service dispose.

---

#### play

```typescript
play(recordingId: string): Promise<void>
```

Starts playing a recording.

**Parameters**:
- `recordingId`: Recording identifier

---

#### pause

```typescript
pause(): void
```

Pauses current playback.

---

#### seek

```typescript
seek(time: number): void
```

Seeks to a specific time in the audio.

**Parameters**:
- `time`: Time in seconds

---

#### setVolume

```typescript
setVolume(volume: number): void
```

Sets playback volume.

**Parameters**:
- `volume`: Volume level (0.0 to 1.0)

---

### Transcription

#### transcribe

```typescript
transcribe(recordingId: string): Promise<TranscriptionResult>
```

Transcribes a recording using Whisper.

**Parameters**:
- `recordingId`: Recording identifier

**Returns**: `TranscriptionResult` with text and segments

---

### Export

#### exportRecording

```typescript
exportRecording(recordingId: string, format: ExportFormat): Promise<void>
```

Exports a transcribed recording.

**Parameters**:
- `recordingId`: Recording identifier
- `format`: Export format (`'txt' | 'srt' | 'json' | 'docx'`)

---

## Types

### Recording

```typescript
interface Recording {
    /** Unique identifier (UUID) */
    id: string;
    
    /** Display filename */
    filename: string;
    
    /** Absolute path to audio file */
    filePath: string;
    
    /** ISO date string */
    createdAt: string;
    
    /** Duration in seconds */
    duration: number;
    
    /** Transcription status */
    status: RecordingStatus;
    
    /** Full transcript text */
    transcript?: string;
    
    /** Timestamped segments */
    transcriptSegments?: TranscriptSegment[];
    
    /** Whether imported (vs recorded) */
    isImported: boolean;
    
    /** Detected language */
    language?: string;
}
```

---

### RecorderState

```typescript
type RecorderState = 'idle' | 'recording' | 'paused';
```

---

### RecordingStatus

```typescript
type RecordingStatus = 'pending' | 'transcribing' | 'completed' | 'failed';
```

---

### PlaybackState

```typescript
interface PlaybackState {
    /** Currently playing recording ID */
    recordingId: string | null;
    
    /** Whether audio is playing */
    isPlaying: boolean;
    
    /** Current playback time in seconds */
    currentTime: number;
    
    /** Total duration in seconds */
    duration: number;
    
    /** Volume level (0-1) */
    volume: number;
}
```

---

### TranscriptSegment

```typescript
interface TranscriptSegment {
    /** Start time in seconds */
    start: number;
    
    /** End time in seconds */
    end: number;
    
    /** Segment text */
    text: string;
}
```

---

### TranscriptionResult

```typescript
interface TranscriptionResult {
    /** Whether transcription succeeded */
    success: boolean;
    
    /** Full transcript text */
    text?: string;
    
    /** Timestamped segments */
    segments?: TranscriptSegment[];
    
    /** Detected language code */
    language?: string;
    
    /** Error message if failed */
    error?: string;
}
```

---

### ExportFormat

```typescript
type ExportFormat = 'txt' | 'srt' | 'json' | 'docx';
```

---

## Utility Functions

### isSupportedAudioFile

```typescript
function isSupportedAudioFile(filename: string): boolean
```

Checks if a file is a supported audio format.

**Parameters**:
- `filename`: File name or path

**Returns**: `true` if supported

**Example**:
```typescript
isSupportedAudioFile('recording.mp3'); // true
isSupportedAudioFile('document.pdf');  // false
```

---

## Constants

### SUPPORTED_AUDIO_EXTENSIONS

```typescript
const SUPPORTED_AUDIO_EXTENSIONS = [
    '.wav',
    '.mp3',
    '.m4a',
    '.ogg',
    '.webm',
    '.flac'
];
```

---

## Commands

### void.openAudioRecorder

Opens the Audio Recorder panel.

**Keybinding**: `Ctrl+Shift+R`

---

### void.startRecording

Starts audio recording.

---

### void.stopRecording

Stops the current recording.

---

### void.importAudio

Opens file picker to import audio files.

---

## IPC Channel

For main process communication, the `void-channel-audio-recorder` channel exposes these methods:

### Commands

| Command | Arguments | Returns |
| ------- | --------- | ------- |
| `saveRecording` | `{ workspaceId, audioData, duration }` | `Recording` |
| `getRecordings` | `{ workspaceId }` | `Recording[]` |
| `getRecording` | `{ recordingId }` | `Recording` |
| `getAudioData` | `{ recordingId }` | `ArrayBuffer` |
| `deleteRecording` | `{ recordingId }` | `void` |
| `updateTranscription` | `{ recordingId, status, text, segments, language }` | `void` |
| `exportRecording` | `{ recordingId, format }` | `{ data, filename }` |
| `importAudioFile` | `{ workspaceId, filePath }` | `Recording` |

### Events

| Event | Payload |
| ----- | ------- |
| `onRecordingAdded` | `Recording` |
| `onRecordingUpdated` | `Recording` |
| `onRecordingDeleted` | `{ id: string }` |

---

## React Hooks

### useAccessor

Access services from React components:

```typescript
import { useAccessor } from 'vs/workbench/contrib/void/browser/react/src/util/services';
import { IAudioRecorderService } from 'vs/workbench/contrib/void/common/audioRecorder';

const MyComponent: React.FC = () => {
    const accessor = useAccessor();
    const audioService = accessor.get(IAudioRecorderService);
    
    // Use service methods...
};
```
