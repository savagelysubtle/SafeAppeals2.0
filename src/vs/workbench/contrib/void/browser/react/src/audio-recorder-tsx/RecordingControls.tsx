/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState } from "react";
import {
	RECORDER_STATE_COLORS,
	RecorderState,
} from "../../../../common/audioRecorder/audioRecorderTypes.js";

// VSCode CSS variable styles
const controlsContainerStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-input-background)",
	borderBottom: "1px solid var(--vscode-panel-border)",
	padding: "24px",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: "16px",
};

const timerStyle: React.CSSProperties = {
	fontFamily: "monospace",
	fontSize: "32px",
	fontWeight: 600,
	color: "var(--vscode-editor-foreground)",
};

const buttonRowStyle: React.CSSProperties = {
	display: "flex",
	gap: "16px",
	alignItems: "center",
	justifyContent: "center",
};

// Labeled rectangular button style for Import and Pause/Resume
const labeledButtonStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-button-secondaryBackground)",
	color: "var(--vscode-button-secondaryForeground)",
	border: "1px solid var(--vscode-panel-border)",
	borderRadius: "8px",
	padding: "10px 16px",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	gap: "8px",
	fontSize: "13px",
	fontWeight: 500,
	transition: "background-color 0.2s, border-color 0.2s",
	minWidth: "100px",
	justifyContent: "center",
};

// Large circular record button - always red
const recordButtonStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-charts-red)",
	color: "white",
	border: "none",
	borderRadius: "50%",
	width: "64px",
	height: "64px",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
	transition: "transform 0.1s, box-shadow 0.2s",
};

const recordButtonContainerStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: "6px",
};

const recordButtonLabelStyle: React.CSSProperties = {
	fontSize: "11px",
	fontWeight: 500,
	color: "var(--vscode-descriptionForeground)",
	textTransform: "uppercase",
	letterSpacing: "0.5px",
};

const statusIndicatorStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "8px",
	fontSize: "14px",
	color: "var(--vscode-descriptionForeground)",
};

const pulsingDotStyle: React.CSSProperties = {
	width: "10px",
	height: "10px",
	borderRadius: "50%",
};

// Inject keyframes for pulsing animation
const styleSheet = `
@keyframes pulse {
	0%, 100% { opacity: 1; transform: scale(1); }
	50% { opacity: 0.5; transform: scale(1.1); }
}
@keyframes recordPulse {
	0%, 100% { box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
	50% { box-shadow: 0 4px 24px rgba(239, 68, 68, 0.6); }
}
`;

interface RecordingControlsProps {
	state: RecorderState;
	elapsedTime: number;
	onStart: () => void;
	onStop: () => void;
	onPause: () => void;
	onResume: () => void;
	onShowImporter: () => void;
}

function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	const ms = Math.floor((seconds % 1) * 10);
	return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
}

export const RecordingControls: React.FC<RecordingControlsProps> = ({
	state,
	elapsedTime,
	onStart,
	onStop,
	onPause,
	onResume,
	onShowImporter,
}) => {
	const isRecording = state === "recording";
	const isPaused = state === "paused";
	const isIdle = state === "idle";

	// Hover states for labeled buttons
	const [importHovered, setImportHovered] = useState(false);
	const [pauseHovered, setPauseHovered] = useState(false);

	const stateColor = RECORDER_STATE_COLORS[state];
	const stateLabel = isRecording
		? "Recording..."
		: isPaused
			? "Paused"
			: "Ready";

	// Get hover style for labeled buttons
	const getHoverStyle = (isHovered: boolean, isDisabled: boolean): React.CSSProperties => ({
		backgroundColor: isHovered && !isDisabled
			? "var(--vscode-button-secondaryHoverBackground)"
			: "var(--vscode-button-secondaryBackground)",
		borderColor: isHovered && !isDisabled
			? "var(--vscode-focusBorder)"
			: "var(--vscode-panel-border)",
	});

	return (
		<>
			{/* Inject CSS animation */}
			<style>{styleSheet}</style>

			<div style={controlsContainerStyle}>
				{/* Timer Display */}
				<div style={timerStyle}>{formatTime(elapsedTime)}</div>

				{/* Status Indicator */}
				<div style={statusIndicatorStyle}>
					{!isIdle && (
						<div
							style={{
								...pulsingDotStyle,
								backgroundColor: stateColor,
								animation: isRecording
									? "pulse 1.5s ease-in-out infinite"
									: "none",
							}}
						/>
					)}
					<span>{stateLabel}</span>
				</div>

				{/* Control Buttons */}
				<div style={buttonRowStyle}>
					{/* Import Button - Labeled rectangular */}
					<button
						style={{
							...labeledButtonStyle,
							...getHoverStyle(importHovered, !isIdle),
							opacity: isIdle ? 1 : 0.5,
							cursor: isIdle ? "pointer" : "not-allowed",
						}}
						onClick={onShowImporter}
						title="Import audio file"
						disabled={!isIdle}
						onMouseEnter={() => setImportHovered(true)}
						onMouseLeave={() => setImportHovered(false)}
					>
						<i
							className="codicon codicon-folder-opened"
							style={{ fontSize: "14px" }}
						/>
						<span>Import</span>
					</button>

					{/* Center: Record/Stop Button with label */}
					<div style={recordButtonContainerStyle}>
						<button
							style={{
								...recordButtonStyle,
								animation: isRecording ? "recordPulse 1.5s ease-in-out infinite" : "none",
							}}
							onClick={isIdle ? onStart : onStop}
							title={isIdle ? "Start recording" : "Stop recording"}
						>
							<i
								className={`codicon ${isIdle ? "codicon-circle-filled" : "codicon-primitive-square"}`}
								style={{ fontSize: isIdle ? "24px" : "20px" }}
							/>
						</button>
						<span style={recordButtonLabelStyle}>
							{isIdle ? "Record" : "Stop"}
						</span>
					</div>

					{/* Pause/Resume Button - Labeled rectangular */}
					<button
						style={{
							...labeledButtonStyle,
							...getHoverStyle(pauseHovered, isIdle),
							opacity: isIdle ? 0.5 : 1,
							cursor: isIdle ? "not-allowed" : "pointer",
						}}
						onClick={isPaused ? onResume : onPause}
						title={isPaused ? "Resume recording" : "Pause recording"}
						disabled={isIdle}
						onMouseEnter={() => setPauseHovered(true)}
						onMouseLeave={() => setPauseHovered(false)}
					>
						<i
							className={`codicon ${isPaused ? "codicon-play" : "codicon-debug-pause"}`}
							style={{ fontSize: "14px" }}
						/>
						<span>{isPaused ? "Resume" : "Pause"}</span>
					</button>
				</div>
			</div>
		</>
	);
};
