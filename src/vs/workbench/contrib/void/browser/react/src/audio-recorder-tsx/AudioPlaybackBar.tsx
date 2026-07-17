/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef, useState } from "react";

// VSCode CSS variable styles
const playbackContainerStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "12px",
	padding: "8px 12px",
	backgroundColor: "var(--vscode-editor-background)",
	borderRadius: "8px",
};

const playButtonStyle: React.CSSProperties = {
	width: "32px",
	height: "32px",
	borderRadius: "50%",
	backgroundColor: "transparent",
	color: "var(--vscode-editor-foreground)",
	border: "2px solid var(--vscode-editor-foreground)",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	flexShrink: 0,
	transition: "all 0.15s ease",
};

const seekContainerStyle: React.CSSProperties = {
	flex: 1,
	display: "flex",
	alignItems: "center",
	gap: "8px",
};

const seekBarContainerStyle: React.CSSProperties = {
	flex: 1,
	height: "6px",
	backgroundColor: "var(--vscode-panel-border)",
	borderRadius: "3px",
	cursor: "pointer",
	position: "relative",
	overflow: "hidden",
};

const seekBarFillStyle: React.CSSProperties = {
	height: "100%",
	backgroundColor: "var(--vscode-progressBar-background)",
	borderRadius: "3px",
	transition: "width 0.1s",
};

const timeDisplayStyle: React.CSSProperties = {
	fontSize: "11px",
	fontFamily: "monospace",
	color: "var(--vscode-descriptionForeground)",
	minWidth: "75px",
	textAlign: "right",
};

const volumeContainerStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: "4px",
};

const volumeButtonStyle: React.CSSProperties = {
	backgroundColor: "transparent",
	color: "var(--vscode-descriptionForeground)",
	border: "none",
	cursor: "pointer",
	padding: "4px",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	borderRadius: "4px",
};

const volumeSliderStyle: React.CSSProperties = {
	width: "60px",
	height: "4px",
	appearance: "none",
	backgroundColor: "var(--vscode-panel-border)",
	borderRadius: "2px",
	outline: "none",
	cursor: "pointer",
};

const loadingStyle: React.CSSProperties = {
	...playbackContainerStyle,
	justifyContent: "center",
	color: "var(--vscode-descriptionForeground)",
	fontSize: "12px",
};

interface AudioPlaybackBarProps {
	duration: number;
	onGetAudioUrl: () => Promise<string>;
}

function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Inline keyframes for loading spinner
const spinKeyframes = `
@keyframes audio-playback-spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}
`;

export const AudioPlaybackBar: React.FC<AudioPlaybackBarProps> = ({
	duration,
	onGetAudioUrl,
}) => {
	const audioRef = useRef<HTMLAudioElement>(null);
	const seekBarRef = useRef<HTMLDivElement>(null);

	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [volume, setVolume] = useState(1);
	const [isMuted, setIsMuted] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [showVolumeSlider, setShowVolumeSlider] = useState(false);

	// Load audio URL on first play
	const loadAudio = useCallback(async () => {
		if (audioUrl || isLoading) return;

		setIsLoading(true);
		try {
			const url = await onGetAudioUrl();
			setAudioUrl(url);
		} catch (error) {
			console.error("[AudioPlaybackBar] Failed to load audio:", error);
		} finally {
			setIsLoading(false);
		}
	}, [audioUrl, isLoading, onGetAudioUrl]);

	// Set audio source when URL is available
	useEffect(() => {
		if (audioUrl && audioRef.current) {
			audioRef.current.src = audioUrl;
			audioRef.current.load();
		}

		return () => {
			// Only revoke blob URLs on cleanup (data URLs don't need revocation)
			if (audioUrl && audioUrl.startsWith("blob:")) {
				URL.revokeObjectURL(audioUrl);
			}
		};
	}, [audioUrl]);

	// Audio event handlers
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const handleTimeUpdate = () => {
			setCurrentTime(audio.currentTime);
		};

		const handleEnded = () => {
			setIsPlaying(false);
			setCurrentTime(0);
		};

		const handleCanPlay = () => {
			if (isLoading) {
				setIsLoading(false);
				// Auto-play after loading
				audio
					.play()
					.then(() => setIsPlaying(true))
					.catch(console.error);
			}
		};

		audio.addEventListener("timeupdate", handleTimeUpdate);
		audio.addEventListener("ended", handleEnded);
		audio.addEventListener("canplay", handleCanPlay);

		return () => {
			audio.removeEventListener("timeupdate", handleTimeUpdate);
			audio.removeEventListener("ended", handleEnded);
			audio.removeEventListener("canplay", handleCanPlay);
		};
	}, [isLoading]);

	// Update volume
	useEffect(() => {
		if (audioRef.current) {
			audioRef.current.volume = isMuted ? 0 : volume;
		}
	}, [volume, isMuted]);

	// Play/Pause toggle
	const togglePlay = async () => {
		if (!audioUrl) {
			await loadAudio();
			return;
		}

		const audio = audioRef.current;
		if (!audio) return;

		if (isPlaying) {
			audio.pause();
			setIsPlaying(false);
		} else {
			try {
				await audio.play();
				setIsPlaying(true);
			} catch (error) {
				console.error("[AudioPlaybackBar] Play failed:", error);
			}
		}
	};

	// Seek
	const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
		const audio = audioRef.current;
		const seekBar = seekBarRef.current;
		if (!audio || !seekBar) return;

		const rect = seekBar.getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		const newTime = percent * (duration || audio.duration);

		audio.currentTime = Math.max(
			0,
			Math.min(newTime, duration || audio.duration),
		);
		setCurrentTime(audio.currentTime);
	};

	// Volume toggle
	const toggleMute = () => {
		setIsMuted(!isMuted);
	};

	const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
	const displayDuration = duration || audioRef.current?.duration || 0;

	if (isLoading && !audioUrl) {
		return (
			<div style={loadingStyle}>
				<i
					className="codicon codicon-loading codicon-modifier-spin"
					style={{ marginRight: "8px" }}
				/>
				Loading audio...
			</div>
		);
	}

	return (
		<div style={playbackContainerStyle}>
			{/* Inject keyframes for spinner animation */}
			<style>{spinKeyframes}</style>

			{/* Hidden Audio Element */}
			<audio ref={audioRef} preload="metadata" />

			{/* Play/Pause Button */}
			<button
				style={playButtonStyle}
				onClick={togglePlay}
				onMouseEnter={(e) => {
					e.currentTarget.style.backgroundColor =
						"var(--vscode-editor-foreground)";
					e.currentTarget.style.color = "var(--vscode-editor-background)";
					e.currentTarget.style.transform = "scale(1.05)";
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.backgroundColor = "transparent";
					e.currentTarget.style.color = "var(--vscode-editor-foreground)";
					e.currentTarget.style.transform = "scale(1)";
				}}
				title={isPlaying ? "Pause" : "Play"}
			>
				{isLoading ? (
					<svg
						width="14"
						height="14"
						viewBox="0 0 16 16"
						fill="currentColor"
						style={{ animation: "audio-playback-spin 1s linear infinite" }}
					>
						<path d="M8 1a7 7 0 1 0 7 7h-1.5A5.5 5.5 0 1 1 8 2.5V1z" />
					</svg>
				) : isPlaying ? (
					<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
						<rect x="4" y="3" width="3" height="10" rx="0.5" />
						<rect x="9" y="3" width="3" height="10" rx="0.5" />
					</svg>
				) : (
					<svg
						width="14"
						height="14"
						viewBox="0 0 16 16"
						fill="currentColor"
						style={{ marginLeft: "2px" }}
					>
						<path d="M4 3.5v9a.5.5 0 0 0 .75.433l7.5-4.5a.5.5 0 0 0 0-.866l-7.5-4.5A.5.5 0 0 0 4 3.5z" />
					</svg>
				)}
			</button>

			{/* Seek Bar */}
			<div style={seekContainerStyle}>
				<div
					ref={seekBarRef}
					style={seekBarContainerStyle}
					onClick={handleSeek}
				>
					<div
						style={{
							...seekBarFillStyle,
							width: `${progress}%`,
						}}
					/>
				</div>

				{/* Time Display */}
				<div style={timeDisplayStyle}>
					{formatTime(currentTime)} / {formatTime(displayDuration)}
				</div>
			</div>

			{/* Volume Control */}
			<div
				style={volumeContainerStyle}
				onMouseEnter={() => setShowVolumeSlider(true)}
				onMouseLeave={() => setShowVolumeSlider(false)}
			>
				<button
					style={volumeButtonStyle}
					onClick={toggleMute}
					title={isMuted ? "Unmute" : "Mute"}
				>
					<i
						className={`codicon ${isMuted || volume === 0 ? "codicon-mute" : "codicon-unmute"}`}
						style={{ fontSize: "14px" }}
					/>
				</button>

				{showVolumeSlider && (
					<input
						type="range"
						min="0"
						max="1"
						step="0.1"
						value={isMuted ? 0 : volume}
						onChange={(e) => {
							setVolume(parseFloat(e.target.value));
							setIsMuted(false);
						}}
						style={volumeSliderStyle}
					/>
				)}
			</div>
		</div>
	);
};
