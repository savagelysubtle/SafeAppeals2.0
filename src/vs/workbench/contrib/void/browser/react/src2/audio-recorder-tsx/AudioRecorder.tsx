/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useState } from "react";
import {
  RecorderState,
  Recording,
  TranscriptionProgress } from
"../../../../common/audioRecorder/audioRecorderTypes.js";
import { useAccessor } from "../util/services.js";
import { AudioImporter } from "./AudioImporter.js";
import { RecordingControls } from "./RecordingControls.js";
import { RecordingsList } from "./RecordingsList.js";

// VSCode CSS variable styles
const containerStyle: React.CSSProperties = {
  backgroundColor: "var(--vscode-editor-background)",
  color: "var(--vscode-editor-foreground)",
  height: "100%",
  display: "flex",
  flexDirection: "column"
};

const headerStyle: React.CSSProperties = {
  backgroundColor: "var(--vscode-sideBar-background)",
  borderBottom: "1px solid var(--vscode-panel-border)",
  padding: "16px"
};

const titleStyle: React.CSSProperties = {
  color: "var(--vscode-editor-foreground)",
  fontSize: "16px",
  fontWeight: 600,
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: "8px"
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column"
};

export const AudioRecorder: React.FC = () => {
  const accessor = useAccessor();

  // State
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showImporter, setShowImporter] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] =
  useState<TranscriptionProgress | null>(null);

  // Get service
  const getService = useCallback(() => {
    try {
      return accessor.get("IAudioRecorderService");
    } catch {
      return null;
    }
  }, [accessor]);

  // Initialize and subscribe to service events
  useEffect(() => {
    const service = getService();
    if (!service) {
      console.error("[AudioRecorder] AudioRecorderService not available");
      return;
    }

    // Set initial state
    setRecorderState(service.state);

    // Load recordings
    service.getRecordings().then(setRecordings);

    // Subscribe to events
    const stateDisposable = service.onStateChanged((state: RecorderState) => {
      setRecorderState(state);
    });

    const recordingsDisposable = service.onRecordingsChanged(
      (recs: Recording[]) => {
        setRecordings(recs);
      }
    );

    const transcriptionProgressDisposable = service.onTranscriptionProgress(
      (progress: TranscriptionProgress) => {
        console.log("[AudioRecorder] Transcription progress:", progress);
        setTranscriptionProgress(progress);

        // Clear progress when transcription completes
        if (progress.progress === 100) {
          setTimeout(() => setTranscriptionProgress(null), 2000);
        }
      }
    );

    return () => {
      stateDisposable.dispose();
      recordingsDisposable.dispose();
      transcriptionProgressDisposable.dispose();
    };
  }, [getService]);

  // Timer for elapsed time during recording
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    if (recorderState === "recording") {
      intervalId = setInterval(() => {
        const service = getService();
        if (service) {
          setElapsedTime(service.getElapsedTime());
        }
      }, 100);
    } else if (recorderState === "idle") {
      setElapsedTime(0);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [recorderState, getService]);

  // Handlers
  const handleStart = async () => {
    const service = getService();
    if (service) {
      try {
        await service.startRecording();
      } catch (error) {
        console.error("[AudioRecorder] Failed to start recording:", error);
      }
    }
  };

  const handleStop = async () => {
    const service = getService();
    if (service) {
      try {
        console.log("[AudioRecorder] Stopping recording...");
        const recording = await service.stopRecording();
        console.log("[AudioRecorder] Recording stopped successfully");

        // Automatically start transcription after recording stops
        if (recording && recording.status === "pending") {
          console.log("[AudioRecorder] Auto-starting transcription...");
          try {
            await service.transcribe(recording.id);
            console.log("[AudioRecorder] Auto-transcription completed");
          } catch (transcribeError) {
            console.error(
              "[AudioRecorder] Auto-transcription failed:",
              transcribeError
            );
            // Don't throw - recording was saved successfully, transcription can be retried
          }
        }
      } catch (error) {
        console.error("[AudioRecorder] Failed to stop recording:", error);
        // Force refresh state from service in case of error
        setRecorderState(service.state);
      }
    }
  };

  const handlePause = () => {
    const service = getService();
    if (service) {
      try {
        console.log("[AudioRecorder] Pausing recording...");
        service.pauseRecording();
      } catch (error) {
        console.error("[AudioRecorder] Failed to pause recording:", error);
      }
    }
  };

  const handleResume = () => {
    const service = getService();
    if (service) {
      try {
        console.log("[AudioRecorder] Resuming recording...");
        service.resumeRecording();
      } catch (error) {
        console.error("[AudioRecorder] Failed to resume recording:", error);
      }
    }
  };

  const handleDelete = async (id: string) => {
    const service = getService();
    if (service) {
      await service.deleteRecording(id);
    }
  };

  const handleTranscribe = async (id: string) => {
    const service = getService();
    if (service) {
      await service.transcribe(id);
    }
  };

  const handleExport = async (
  id: string,
  format: "docx" | "txt" | "srt" | "json") =>
  {
    const service = getService();
    if (service) {
      await service.exportRecording(id, format);
    }
  };

  const handleImport = async (filePath: string) => {
    const service = getService();
    if (service) {
      try {
        console.log("[AudioRecorder] Importing audio file:", filePath);
        const recording = await service.importAudio(filePath);
        setShowImporter(false);
        console.log("[AudioRecorder] Audio imported successfully");

        // Automatically start transcription after import
        if (recording && recording.status === "pending") {
          console.log("[AudioRecorder] Auto-starting transcription for imported file...");
          try {
            await service.transcribe(recording.id);
            console.log("[AudioRecorder] Auto-transcription of import completed");
          } catch (transcribeError) {
            console.error(
              "[AudioRecorder] Auto-transcription of import failed:",
              transcribeError
            );
            // Don't throw - import was successful, transcription can be retried
          }
        }
      } catch (error) {
        console.error("[AudioRecorder] Failed to import audio:", error);
      }
    }
  };

  const handleGetAudioUrl = async (id: string): Promise<string> => {
    const service = getService();
    if (service) {
      return service.getAudioUrl(id);
    }
    return "";
  };

  const handleRename = async (id: string, newName: string) => {
    const service = getService();
    if (service) {
      try {
        await service.renameRecording(id, newName);
      } catch (error) {
        console.error("[AudioRecorder] Failed to rename recording:", error);
      }
    }
  };

  return (
    <div style={containerStyle} className="void-void-scope">
			<div style={headerStyle}>
				<h2 style={titleStyle}>
					<i className="void-codicon void-codicon-mic" />
					Audio Recorder
				</h2>
			</div>

			<div style={contentStyle}>
				{/* Recording Controls */}
				<RecordingControls
          state={recorderState}
          elapsedTime={elapsedTime}
          onStart={handleStart}
          onStop={handleStop}
          onPause={handlePause}
          onResume={handleResume}
          onShowImporter={() => setShowImporter(true)} />
        

				{/* Importer (shown when toggled) */}
				{showImporter &&
        <AudioImporter
          onImport={handleImport}
          onClose={() => setShowImporter(false)} />

        }

				{/* Recordings List */}
				<RecordingsList
          recordings={recordings}
          onDelete={handleDelete}
          onTranscribe={handleTranscribe}
          onExport={handleExport}
          onGetAudioUrl={handleGetAudioUrl}
          onRename={handleRename} />
        
			</div>
		</div>);

};