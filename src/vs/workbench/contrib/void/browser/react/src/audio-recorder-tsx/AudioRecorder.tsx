/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useState } from "react";
import {
	RecorderState,
	Recording,
} from "../../../../common/audioRecorder/audioRecorderTypes.js";
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
	flexDirection: "column",
};

const headerStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-sideBar-background)",
	borderBottom: "1px solid var(--vscode-panel-border)",
	padding: "16px",
};

const titleStyle: React.CSSProperties = {
	color: "var(--vscode-editor-foreground)",
	fontSize: "16px",
	fontWeight: 600,
	margin: 0,
	display: "flex",
	alignItems: "center",
	gap: "8px",
};

const contentStyle: React.CSSProperties = {
	flex: 1,
	overflow: "hidden",
	display: "flex",
	flexDirection: "column",
};

export const AudioRecorder: React.FC = () => {
	const accessor = useAccessor();

	// State
	const [recorderState, setRecorderState] = useState<RecorderState>("idle");
	const [recordings, setRecordings] = useState<Recording[]>([]);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [showImporter, setShowImporter] = useState(false);

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
			},
		);

		return () => {
			stateDisposable.dispose();
			recordingsDisposable.dispose();
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
			await service.startRecording();
		}
	};

	const handleStop = async () => {
		const service = getService();
		if (service) {
			await service.stopRecording();
		}
	};

	const handlePause = () => {
		const service = getService();
		if (service) {
			service.pauseRecording();
		}
	};

	const handleResume = () => {
		const service = getService();
		if (service) {
			service.resumeRecording();
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
		format: "docx" | "txt" | "srt" | "json",
	) => {
		const service = getService();
		if (service) {
			await service.exportRecording(id, format);
		}
	};

	const handleImport = async (filePath: string) => {
		const service = getService();
		if (service) {
			await service.importAudio(filePath);
			setShowImporter(false);
		}
	};

	const handleGetAudioUrl = async (id: string): Promise<string> => {
		const service = getService();
		if (service) {
			return service.getAudioUrl(id);
		}
		return "";
	};

	return (
		<div style={containerStyle} className="void-scope">
			<div style={headerStyle}>
				<h2 style={titleStyle}>
					<i className="codicon codicon-mic" />
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
					onShowImporter={() => setShowImporter(true)}
				/>

				{/* Importer (shown when toggled) */}
				{showImporter && (
					<AudioImporter
						onImport={handleImport}
						onClose={() => setShowImporter(false)}
					/>
				)}

				{/* Recordings List */}
				<RecordingsList
					recordings={recordings}
					onDelete={handleDelete}
					onTranscribe={handleTranscribe}
					onExport={handleExport}
					onGetAudioUrl={handleGetAudioUrl}
				/>
			</div>
		</div>
	);
};
