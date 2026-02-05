/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from "react";
import {
	ExportFormat,
	Recording,
} from "../../../../common/audioRecorder/audioRecorderTypes.js";
import { RecordingCard } from "./RecordingCard.js";

// VSCode CSS variable styles
const listContainerStyle: React.CSSProperties = {
	flex: 1,
	overflow: "auto",
	padding: "16px",
};

const emptyStateStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	height: "100%",
	color: "var(--vscode-descriptionForeground)",
	textAlign: "center",
	padding: "40px",
};

const emptyIconStyle: React.CSSProperties = {
	fontSize: "48px",
	marginBottom: "16px",
	opacity: 0.5,
};

const emptyTextStyle: React.CSSProperties = {
	fontSize: "14px",
	marginBottom: "8px",
};

const emptySubtextStyle: React.CSSProperties = {
	fontSize: "12px",
	opacity: 0.7,
};

const listHeaderStyle: React.CSSProperties = {
	fontSize: "12px",
	fontWeight: 600,
	textTransform: "uppercase",
	letterSpacing: "0.5px",
	color: "var(--vscode-descriptionForeground)",
	marginBottom: "12px",
};

interface RecordingsListProps {
	recordings: Recording[];
	onDelete: (id: string) => void;
	onTranscribe: (id: string) => void;
	onExport: (id: string, format: ExportFormat) => void;
	onGetAudioUrl: (id: string) => Promise<string>;
}

export const RecordingsList: React.FC<RecordingsListProps> = ({
	recordings,
	onDelete,
	onTranscribe,
	onExport,
	onGetAudioUrl,
}) => {
	if (recordings.length === 0) {
		return (
			<div style={listContainerStyle}>
				<div style={emptyStateStyle}>
					<i className="codicon codicon-record" style={emptyIconStyle} />
					<div style={emptyTextStyle}>No recordings yet</div>
					<div style={emptySubtextStyle}>
						Click the record button to start,
						<br />
						or import an existing audio file
					</div>
				</div>
			</div>
		);
	}

	return (
		<div style={listContainerStyle} className="void-scrollbar">
			<div style={listHeaderStyle}>Recordings ({recordings.length})</div>

			{recordings.map((recording) => (
				<RecordingCard
					key={recording.id}
					recording={recording}
					onDelete={() => onDelete(recording.id)}
					onTranscribe={() => onTranscribe(recording.id)}
					onExport={(format) => onExport(recording.id, format)}
					onGetAudioUrl={() => onGetAudioUrl(recording.id)}
				/>
			))}
		</div>
	);
};
