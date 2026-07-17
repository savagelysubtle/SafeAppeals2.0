/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useRef, useState } from "react";
import {
	EXPORT_FORMAT_LABELS,
	ExportFormat,
	Recording,
	RECORDING_STATUS_COLORS,
	RECORDING_STATUS_LABELS,
} from "../../../../common/audioRecorder/audioRecorderTypes.js";
import { AudioPlaybackBar } from "./AudioPlaybackBar.js";

// VSCode CSS variable styles
const cardStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-input-background)",
	border: "1px solid var(--vscode-panel-border)",
	borderRadius: "12px",
	padding: "16px",
	marginBottom: "12px",
	transition: "border-color 0.2s",
};

const cardHeaderStyle: React.CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	marginBottom: "12px",
};

const fileInfoStyle: React.CSSProperties = {
	flex: 1,
	minWidth: 0,
};

const filenameStyle: React.CSSProperties = {
	fontSize: "14px",
	fontWeight: 500,
	color: "var(--vscode-editor-foreground)",
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	marginBottom: "4px",
	cursor: "pointer",
};

const filenameInputStyle: React.CSSProperties = {
	fontSize: "14px",
	fontWeight: 500,
	color: "var(--vscode-editor-foreground)",
	backgroundColor: "var(--vscode-input-background)",
	border: "1px solid var(--vscode-focusBorder)",
	borderRadius: "4px",
	padding: "2px 6px",
	marginBottom: "4px",
	width: "100%",
	outline: "none",
};

const metadataStyle: React.CSSProperties = {
	fontSize: "12px",
	color: "var(--vscode-descriptionForeground)",
};

const badgeStyle: React.CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: "4px",
	padding: "2px 8px",
	borderRadius: "6px",
	fontSize: "11px",
	fontWeight: 500,
};

const transcriptPreviewStyle: React.CSSProperties = {
	fontSize: "13px",
	color: "var(--vscode-editor-foreground)",
	lineHeight: 1.5,
	marginTop: "12px",
	padding: "12px",
	backgroundColor: "var(--vscode-editor-background)",
	borderRadius: "8px",
	maxHeight: "80px",
	overflow: "hidden",
	position: "relative",
};

const transcriptFadeStyle: React.CSSProperties = {
	position: "absolute",
	bottom: 0,
	left: 0,
	right: 0,
	height: "32px",
	background: "linear-gradient(transparent, var(--vscode-editor-background))",
	pointerEvents: "none",
};

const actionRowStyle: React.CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	marginTop: "12px",
	paddingTop: "12px",
	borderTop: "1px solid var(--vscode-panel-border)",
};

const buttonGroupStyle: React.CSSProperties = {
	display: "flex",
	gap: "8px",
};

const iconButtonStyle: React.CSSProperties = {
	backgroundColor: "transparent",
	color: "var(--vscode-descriptionForeground)",
	border: "1px solid var(--vscode-panel-border)",
	borderRadius: "6px",
	padding: "6px 10px",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	gap: "6px",
	fontSize: "12px",
	transition: "all 0.15s ease",
};

const deleteButtonStyle: React.CSSProperties = {
	backgroundColor: "transparent",
	color: "var(--vscode-descriptionForeground)",
	border: "1px solid var(--vscode-panel-border)",
	borderRadius: "6px",
	padding: "6px 10px",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	gap: "6px",
	fontSize: "12px",
	transition: "all 0.15s ease",
};

const deleteButtonHoverStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-inputValidation-errorBackground)",
	borderColor: "var(--vscode-errorForeground)",
	color: "var(--vscode-errorForeground)",
};

const dropdownStyle: React.CSSProperties = {
	position: "relative",
	display: "inline-block",
};

const dropdownMenuStyle: React.CSSProperties = {
	position: "absolute",
	bottom: "100%",
	left: 0,
	backgroundColor: "var(--vscode-dropdown-background)",
	border: "1px solid var(--vscode-dropdown-border)",
	borderRadius: "8px",
	boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
	minWidth: "160px",
	zIndex: 1000,
	marginBottom: "4px",
	overflow: "hidden",
};

const dropdownItemStyle: React.CSSProperties = {
	display: "block",
	width: "100%",
	padding: "8px 12px",
	backgroundColor: "transparent",
	color: "var(--vscode-dropdown-foreground)",
	border: "none",
	textAlign: "left",
	cursor: "pointer",
	fontSize: "12px",
};

interface RecordingCardProps {
	recording: Recording;
	onDelete: () => void;
	onTranscribe: () => void;
	onExport: (format: ExportFormat) => void;
	onGetAudioUrl: () => Promise<string>;
	onRename: (newName: string) => void;
}

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(isoString: string): string {
	const date = new Date(isoString);
	return date.toLocaleString();
}

export const RecordingCard: React.FC<RecordingCardProps> = ({
	recording,
	onDelete,
	onTranscribe,
	onExport,
	onGetAudioUrl,
	onRename,
}) => {
	const [showExportMenu, setShowExportMenu] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState(recording.filename);
	const inputRef = useRef<HTMLInputElement>(null);

	const statusColor = RECORDING_STATUS_COLORS[recording.status];
	const statusLabel = RECORDING_STATUS_LABELS[recording.status];

	// Focus input when editing starts
	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			// Select the filename without extension
			const dotIndex = editName.lastIndexOf(".");
			if (dotIndex > 0) {
				inputRef.current.setSelectionRange(0, dotIndex);
			} else {
				inputRef.current.select();
			}
		}
	}, [isEditing, editName]);

	// Handle double-click to start editing
	const handleDoubleClick = () => {
		setEditName(recording.filename);
		setIsEditing(true);
	};

	// Handle saving the new name
	const handleSave = () => {
		const trimmedName = editName.trim();
		if (trimmedName && trimmedName !== recording.filename) {
			onRename(trimmedName);
		}
		setIsEditing(false);
	};

	// Handle key events in the input
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			setEditName(recording.filename);
			setIsEditing(false);
		}
	};

	// Handle blur (clicking outside)
	const handleBlur = () => {
		handleSave();
	};

	const handleDelete = () => {
		if (confirmDelete) {
			onDelete();
			setConfirmDelete(false);
		} else {
			setConfirmDelete(true);
			setTimeout(() => setConfirmDelete(false), 3000);
		}
	};

	const handleExport = (format: ExportFormat) => {
		onExport(format);
		setShowExportMenu(false);
	};

	const canExport = recording.status === "completed" && recording.transcript;
	const canTranscribe =
		recording.status === "pending" || recording.status === "failed";

	return (
		<div style={cardStyle}>
			{/* Header */}
			<div style={cardHeaderStyle}>
				<div style={fileInfoStyle}>
					{isEditing ? (
						<input
							ref={inputRef}
							type="text"
							value={editName}
							onChange={(e) => setEditName(e.target.value)}
							onBlur={handleBlur}
							onKeyDown={handleKeyDown}
							style={filenameInputStyle}
						/>
					) : (
						<div
							style={filenameStyle}
							title="Double-click to rename"
							onDoubleClick={handleDoubleClick}
						>
							<i
								className={`codicon ${recording.isImported ? "codicon-folder-opened" : "codicon-record"}`}
								style={{ marginRight: "6px", fontSize: "12px" }}
							/>
							{recording.filename}
						</div>
					)}
					<div style={metadataStyle}>
						{formatDate(recording.createdAt)} ·{" "}
						{formatDuration(recording.duration)}
					</div>
				</div>

				{/* Status Badge */}
				<span
					style={{
						...badgeStyle,
						backgroundColor: `${statusColor}20`,
						color: statusColor,
						border: `1px solid ${statusColor}30`,
					}}
				>
					{recording.status === "transcribing" && (
						<i
							className="codicon codicon-loading codicon-modifier-spin"
							style={{ fontSize: "10px" }}
						/>
					)}
					{statusLabel}
				</span>
			</div>

			{/* Playback Bar */}
			<AudioPlaybackBar
				duration={recording.duration}
				onGetAudioUrl={onGetAudioUrl}
			/>

			{/* Transcript Preview */}
			{recording.transcript && (
				<div style={transcriptPreviewStyle}>
					"{recording.transcript}"
					<div style={transcriptFadeStyle} />
				</div>
			)}

			{/* Action Buttons */}
			<div style={actionRowStyle}>
				<div style={buttonGroupStyle}>
					{/* Transcribe Button */}
					{canTranscribe && (
						<button
							style={iconButtonStyle}
							onClick={onTranscribe}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor = "var(--vscode-list-hoverBackground)";
								e.currentTarget.style.color = "var(--vscode-editor-foreground)";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = "transparent";
								e.currentTarget.style.color = "var(--vscode-descriptionForeground)";
							}}
							title="Transcribe with Whisper AI"
						>
							<i className="codicon codicon-symbol-string" />
							Transcribe
						</button>
					)}

					{/* Export Dropdown */}
					{canExport && (
						<div style={dropdownStyle}>
							<button
								style={iconButtonStyle}
								onClick={() => setShowExportMenu(!showExportMenu)}
								onMouseEnter={(e) => {
									e.currentTarget.style.backgroundColor = "var(--vscode-list-hoverBackground)";
									e.currentTarget.style.color = "var(--vscode-editor-foreground)";
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.backgroundColor = "transparent";
									e.currentTarget.style.color = "var(--vscode-descriptionForeground)";
								}}
								title="Export transcript"
							>
								<i className="codicon codicon-export" />
								Export
								<i
									className="codicon codicon-chevron-down"
									style={{ fontSize: "10px" }}
								/>
							</button>

							{showExportMenu && (
								<div style={dropdownMenuStyle}>
									{(
										Object.entries(EXPORT_FORMAT_LABELS) as [
											ExportFormat,
											string,
										][]
									).map(([format, label]) => (
										<button
											key={format}
											style={dropdownItemStyle}
											onClick={() => handleExport(format)}
											onMouseEnter={(e) => {
												e.currentTarget.style.backgroundColor =
													"var(--vscode-list-hoverBackground)";
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.backgroundColor = "transparent";
											}}
										>
											{label}
										</button>
									))}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Delete Button */}
				<button
					style={{
						...deleteButtonStyle,
						...(confirmDelete ? deleteButtonHoverStyle : {}),
					}}
					onClick={handleDelete}
					onMouseEnter={(e) => {
						if (!confirmDelete) {
							e.currentTarget.style.backgroundColor = "var(--vscode-inputValidation-errorBackground)";
							e.currentTarget.style.borderColor = "var(--vscode-errorForeground)";
							e.currentTarget.style.color = "var(--vscode-errorForeground)";
						}
					}}
					onMouseLeave={(e) => {
						if (!confirmDelete) {
							e.currentTarget.style.backgroundColor = "transparent";
							e.currentTarget.style.borderColor = "var(--vscode-panel-border)";
							e.currentTarget.style.color = "var(--vscode-descriptionForeground)";
						}
					}}
					title={confirmDelete ? "Click again to confirm" : "Delete recording"}
				>
					<i className="codicon codicon-trash" />
					{confirmDelete ? "Confirm?" : "Delete"}
				</button>
			</div>
		</div>
	);
};
