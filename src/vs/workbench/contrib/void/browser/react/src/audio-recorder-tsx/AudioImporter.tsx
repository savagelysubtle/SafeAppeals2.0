/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useRef, useState } from "react";
import {
	SUPPORTED_AUDIO_EXTENSIONS,
	isSupportedAudioFile,
} from "../../../../common/audioRecorder/audioRecorderTypes.js";
import { useAccessor } from "../util/services.js";

// VSCode CSS variable styles
const importerContainerStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-input-background)",
	borderBottom: "1px solid var(--vscode-panel-border)",
	padding: "16px",
};

const headerStyle: React.CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	marginBottom: "12px",
};

const titleStyle: React.CSSProperties = {
	fontSize: "13px",
	fontWeight: 500,
	color: "var(--vscode-editor-foreground)",
};

const closeButtonStyle: React.CSSProperties = {
	backgroundColor: "transparent",
	color: "var(--vscode-descriptionForeground)",
	border: "none",
	cursor: "pointer",
	padding: "4px",
	borderRadius: "4px",
};

const dropZoneStyle: React.CSSProperties = {
	border: "2px dashed var(--vscode-panel-border)",
	borderRadius: "12px",
	padding: "32px 16px",
	textAlign: "center",
	cursor: "pointer",
	transition: "border-color 0.2s, background-color 0.2s",
};

const dropZoneActiveStyle: React.CSSProperties = {
	...dropZoneStyle,
	borderColor: "var(--vscode-focusBorder)",
	backgroundColor: "var(--vscode-list-hoverBackground)",
};

const dropIconStyle: React.CSSProperties = {
	fontSize: "32px",
	color: "var(--vscode-descriptionForeground)",
	marginBottom: "8px",
};

const dropTextStyle: React.CSSProperties = {
	fontSize: "13px",
	color: "var(--vscode-editor-foreground)",
	marginBottom: "4px",
};

const dropSubtextStyle: React.CSSProperties = {
	fontSize: "11px",
	color: "var(--vscode-descriptionForeground)",
};

const formatsStyle: React.CSSProperties = {
	marginTop: "12px",
	display: "flex",
	flexWrap: "wrap",
	gap: "6px",
	justifyContent: "center",
};

const formatBadgeStyle: React.CSSProperties = {
	fontSize: "10px",
	padding: "2px 8px",
	borderRadius: "4px",
	backgroundColor: "var(--vscode-badge-background)",
	color: "var(--vscode-badge-foreground)",
	textTransform: "uppercase",
};

const errorStyle: React.CSSProperties = {
	marginTop: "12px",
	padding: "8px 12px",
	borderRadius: "8px",
	backgroundColor: "var(--vscode-inputValidation-errorBackground)",
	color: "var(--vscode-inputValidation-errorForeground)",
	fontSize: "12px",
	display: "flex",
	alignItems: "center",
	gap: "8px",
};

const buttonRowStyle: React.CSSProperties = {
	display: "flex",
	gap: "8px",
	marginTop: "12px",
};

const primaryButtonStyle: React.CSSProperties = {
	flex: 1,
	backgroundColor: "var(--vscode-button-background)",
	color: "var(--vscode-button-foreground)",
	border: "none",
	borderRadius: "8px",
	padding: "10px",
	cursor: "pointer",
	fontSize: "13px",
	fontWeight: 500,
};

interface AudioImporterProps {
	onImport: (filePath: string) => void;
	onClose: () => void;
}

export const AudioImporter: React.FC<AudioImporterProps> = ({
	onImport,
	onClose,
}) => {
	const accessor = useAccessor();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [isDragActive, setIsDragActive] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	const handleDragEnter = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragActive(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragActive(false);
	}, []);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragActive(false);
		setError(null);

		const files = e.dataTransfer.files;
		if (files.length > 0) {
			handleFileSelect(files[0]);
		}
	}, []);

	const handleFileSelect = (file: File) => {
		if (!isSupportedAudioFile(file.name)) {
			setError(
				`Unsupported file format. Please use: ${SUPPORTED_AUDIO_EXTENSIONS.join(", ")}`,
			);
			setSelectedFile(null);
			return;
		}

		setSelectedFile(file);
		setError(null);
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files && files.length > 0) {
			handleFileSelect(files[0]);
		}
	};

	const handleBrowseClick = () => {
		fileInputRef.current?.click();
	};

	const handleImport = async () => {
		if (!selectedFile) return;

		try {
			// For browser environment, we need to use the file picker dialog
			// This is a workaround - in a real implementation, we'd use the
			// VSCode file dialog API
			const fileDialog = accessor.get("IFileDialogService");

			const result = await fileDialog.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				filters: [
					{
						name: "Audio Files",
						extensions: ["wav", "mp3", "m4a", "ogg", "webm", "flac"],
					},
				],
			});

			if (result && result.length > 0) {
				onImport(result[0].fsPath);
			}
		} catch (error) {
			console.error("[AudioImporter] Import failed:", error);
			setError("Failed to import file. Please try again.");
		}
	};

	const handleQuickImport = async () => {
		try {
			const fileDialog = accessor.get("IFileDialogService");

			const result = await fileDialog.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				filters: [
					{
						name: "Audio Files",
						extensions: ["wav", "mp3", "m4a", "ogg", "webm", "flac"],
					},
				],
			});

			if (result && result.length > 0) {
				onImport(result[0].fsPath);
			}
		} catch (error) {
			console.error("[AudioImporter] Import failed:", error);
			setError("Failed to open file dialog.");
		}
	};

	return (
		<div style={importerContainerStyle}>
			{/* Header */}
			<div style={headerStyle}>
				<span style={titleStyle}>
					<i
						className="codicon codicon-folder-opened"
						style={{ marginRight: "6px" }}
					/>
					Import Audio File
				</span>
				<button style={closeButtonStyle} onClick={onClose} title="Close">
					<i className="codicon codicon-close" />
				</button>
			</div>

			{/* Drop Zone */}
			<div
				style={isDragActive ? dropZoneActiveStyle : dropZoneStyle}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				onClick={handleQuickImport}
			>
				<i className="codicon codicon-cloud-upload" style={dropIconStyle} />
				<div style={dropTextStyle}>
					{selectedFile
						? selectedFile.name
						: "Drop audio file here or click to browse"}
				</div>
				<div style={dropSubtextStyle}>Supported formats:</div>

				<div style={formatsStyle}>
					{SUPPORTED_AUDIO_EXTENSIONS.map((ext) => (
						<span key={ext} style={formatBadgeStyle}>
							{ext.replace(".", "")}
						</span>
					))}
				</div>
			</div>

			{/* Hidden File Input */}
			<input
				ref={fileInputRef}
				type="file"
				accept={SUPPORTED_AUDIO_EXTENSIONS.join(",")}
				onChange={handleInputChange}
				style={{ display: "none" }}
			/>

			{/* Error Message */}
			{error && (
				<div style={errorStyle}>
					<i className="codicon codicon-error" />
					{error}
				</div>
			)}

			{/* Action Buttons */}
			{selectedFile && (
				<div style={buttonRowStyle}>
					<button style={primaryButtonStyle} onClick={handleImport}>
						<i
							className="codicon codicon-check"
							style={{ marginRight: "6px" }}
						/>
						Import {selectedFile.name}
					</button>
				</div>
			)}
		</div>
	);
};
