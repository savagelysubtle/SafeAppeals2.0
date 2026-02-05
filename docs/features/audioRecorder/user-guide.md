# Audio Recorder User Guide

## Getting Started

The Audio Recorder allows you to record, play, and transcribe audio directly within SafeAppeals. It's perfect for capturing client calls, depositions, witness interviews, and meetings.

## Opening the Audio Recorder

### Method 1: Activity Bar
Click the **microphone icon** in the Activity Bar (left side panel).

### Method 2: Keyboard Shortcut
Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (macOS).

### Method 3: Command Palette
1. Press `Ctrl+Shift+P` to open Command Palette
2. Type "Open Audio Recorder"
3. Press Enter

## Recording Audio

### Starting a Recording

1. Click the large **Start Recording** button
2. A pulsing red indicator shows recording is active
3. The timer displays elapsed time (MM:SS)

### Pausing a Recording

1. Click the **Pause** button during recording
2. The timer pauses and indicator stops pulsing
3. Click **Resume** to continue recording

### Stopping a Recording

1. Click the **Stop** button
2. The recording is automatically saved
3. A new card appears in the recordings list

### Recording Tips

- Use a quality microphone for better transcription accuracy
- Minimize background noise
- Speak clearly and at a moderate pace
- For interviews, position the microphone between speakers

## Playing Recordings

### Basic Playback

Each recording card has integrated playback controls:

1. **Play/Pause Button** - Start or pause playback
2. **Seek Bar** - Click anywhere to jump to that position
3. **Time Display** - Shows current time / total duration
4. **Volume Control** - Adjust playback volume

### Playback Features

- **Click-to-seek**: Click anywhere on the progress bar to jump
- **Lazy loading**: Audio loads when you first press play
- **Memory efficient**: Uses blob URLs that are cleaned up automatically

## Transcribing Audio

### Starting Transcription

1. Find the recording in your list
2. Click the **Transcribe** button (speech bubble icon)
3. Wait for processing (status shows "Transcribing...")

### First-Time Setup

On first transcription, the Whisper model (~1.5GB) downloads automatically:
- Progress shows in notifications
- Download only happens once
- Model is cached for future use

### Transcription Stages

1. **Loading Model** - Loading Whisper into memory
2. **Processing Audio** - Analyzing audio waveform
3. **Generating Text** - Creating transcript with timestamps
4. **Complete** - Transcript ready to view/export

### Viewing Transcripts

- Transcripts appear on the recording card
- Click to expand long transcripts
- Timestamps are preserved for export

## Importing Audio Files

### Drag and Drop

1. Open the Audio Recorder panel
2. Drag audio files from your file explorer
3. Drop them onto the recorder panel
4. Files are imported and appear in your list

### File Picker

1. Click the **Import Audio** button
2. Select one or more audio files
3. Click Open to import

### Supported Formats

| Format | Extension | Notes |
| ------ | --------- | ----- |
| WAV | .wav | Best quality, no conversion needed |
| MP3 | .mp3 | Common, widely compatible |
| M4A | .m4a | Apple/iOS recordings |
| OGG | .ogg | Open format |
| WebM | .webm | Web recordings |
| FLAC | .flac | Lossless compression |

## Exporting Transcripts

Click the **Export** button on a transcribed recording to choose format:

### Word Document (.docx)

- Professional formatting
- Ready for legal documents
- Includes metadata (date, duration)

### Plain Text (.txt)

- Simple text format
- Easy to copy/paste
- No special formatting

### Subtitles (.srt)

- Standard subtitle format
- Includes timestamps
- Use with video editing software

### JSON (.json)

- Structured data format
- Includes all metadata
- For integration with other tools

## Managing Recordings

### Deleting Recordings

1. Click the **Delete** button (trash icon) on a recording
2. Confirm in the dialog
3. Both the recording and audio file are removed

### Recording Status

Status badges show the state of each recording:

| Status | Meaning |
| ------ | ------- |
| Pending | Not yet transcribed |
| Transcribing | Transcription in progress |
| Completed | Transcript ready |
| Failed | Error during transcription |

## Per-Workspace Storage

Recordings are stored per workspace (case folder):

- **Separate for each case** - Opening a different folder shows different recordings
- **Portable** - Recordings stay with their case
- **Private** - No cross-case access

## Troubleshooting

### No Audio Captured

1. Check microphone permissions in your system settings
2. Verify the correct microphone is selected
3. Ensure no other app is using the microphone

### Transcription Failed

1. Check if the recording has audio content
2. Verify sufficient disk space for model cache
3. Restart the app and try again

### Slow Transcription

Whisper runs locally on your CPU/GPU:
- First transcription loads the model (slower)
- Subsequent transcriptions are faster
- Longer recordings take proportionally longer

### Import Failed

1. Verify the file format is supported
2. Check if the file is corrupted
3. Try converting to WAV format first

## Keyboard Shortcuts

| Action | Shortcut |
| ------ | -------- |
| Open Recorder | `Ctrl+Shift+R` |
| Start/Stop Recording | *(click UI)* |
| Play/Pause | *(click card)* |

## Best Practices

### For Depositions

1. Test recording before the deposition starts
2. Use external microphone for clarity
3. Announce participants at the start
4. Export as DOCX for easy editing

### For Client Calls

1. Inform client about recording (legal requirement in many jurisdictions)
2. Note key points in real-time in the transcript
3. Link to timeline events when relevant

### For Interviews

1. Position microphone centrally
2. Ask one question at a time
3. Pause between speakers for better transcription
