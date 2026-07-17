# Audio Recorder & Transcriber

## Overview

The Audio Recorder is a native contribution that provides integrated audio recording, playback, and transcription capabilities within SafeAppeals. It's designed for legal professionals to capture client calls, depositions, interviews, and meetings with automatic AI-powered transcription.

## Key Features

- **Audio Recording** - Capture audio directly within the app with start/stop/pause controls
- **Inline Playback** - Play recordings with seek bar, time display, and volume control
- **Local Transcription** - Whisper AI transcription runs entirely locally with no API costs
- **Import Audio** - Drag-and-drop or file picker for existing audio files
- **Export Options** - Export transcripts as DOCX, TXT, SRT (subtitles), or JSON
- **Per-Workspace Storage** - Recordings are isolated per case/workspace

## Quick Start

### Recording Audio

1. Click the **microphone icon** in the Activity Bar (or press `Ctrl+Shift+R`)
2. Click the **Start Recording** button
3. Speak into your microphone
4. Click **Stop** when finished
5. Your recording appears in the list below

### Playing Audio

1. Find the recording in the list
2. Click the **play button** on the recording card
3. Use the seek bar to navigate within the audio
4. Adjust volume with the volume slider

### Transcribing

1. Click the **Transcribe** button on any recording
2. Wait for the model to download (first time only, ~1.5GB)
3. The transcript appears on the recording card
4. Click **Export** to save as DOCX, TXT, SRT, or JSON

### Importing Audio

1. Drag-and-drop audio files onto the recorder panel
2. Or click **Import Audio** and select files
3. Supported formats: WAV, MP3, M4A, OGG, WEBM, FLAC

## Documentation

- [User Guide](user-guide.md) - Complete usage instructions
- [Developer Guide](developer-guide.md) - Technical implementation details
- [API Reference](api-reference.md) - Service interfaces and methods

## Architecture

```
Native Contribution (src/vs/workbench/contrib/void/)
├── common/audioRecorder/        # Shared types and interfaces
├── electron-main/audioRecorder/ # Main process (SQLite, file I/O)
├── browser/audioRecorder/       # Browser service (recording, playback)
└── browser/react/src/audio-recorder-tsx/  # React UI components
```

## Technology Stack

| Component | Technology |
| --------- | ---------- |
| Recording | MediaRecorder API (WebM → WAV) |
| Playback | HTML5 Audio + Web Audio API |
| Transcription | @huggingface/transformers + Whisper |
| Database | better-sqlite3 (per-workspace) |
| Export | docx library for Word documents |
| UI | React + Tailwind CSS + VSCode theme |

## Storage Locations

- **Database**: `~/.safe-appeals-navigator/databases/workspaces/{workspaceId}/audio_recordings.db`
- **Audio Files**: `~/.safe-appeals-navigator/databases/workspaces/{workspaceId}/recordings/`
- **Whisper Model**: `~/.cache/huggingface/` (~1.5GB, downloaded on first use)

## Commands

| Command | Description | Shortcut |
| ------- | ----------- | -------- |
| Open Audio Recorder | Opens the recorder panel | `Ctrl+Shift+R` |
| Start Recording | Begins audio capture | - |
| Stop Recording | Ends recording and saves | - |
| Import Audio | Opens file picker for import | - |

## Privacy & Offline

All audio processing happens locally on your machine:

- **No cloud uploads** - Audio files never leave your computer
- **No API calls** - Transcription uses local Whisper model
- **Offline capable** - Works without internet after model download
- **Per-case isolation** - Recordings are workspace-scoped

## Whisper Model Details

- **Model**: distil-whisper-large-v3.5-ONNX
- **Size**: ~1.5GB (downloaded once)
- **Accuracy**: ~7% Word Error Rate
- **Languages**: Multilingual with auto-detection
- **Speed**: ~1.5x faster than Whisper-Large-v3

## Related Features

- [Timeline](../timeline/README.md) - Link recordings to case events
- [RAG System](../ragSystem/README.md) - Future: search transcripts
- [File Organizer](../fileOrganizer/README.md) - Organize audio files
