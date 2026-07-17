/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { DocketItem } from '../../../fileOrganizer/types.js';

interface DocketInboxProps {
	items: DocketItem[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	onScan: () => void;
	onOpenFolder?: () => void;
	isScanning?: boolean;
}

export const DocketInbox: React.FC<DocketInboxProps> = ({
	items,
	selectedId,
	onSelect,
	onScan,
	onOpenFolder,
	isScanning
}) => {
	const getStatusColor = (status: string) => {
		switch (status) {
			case 'new': return '#3794ff';
			case 'analyzing': return '#cca700';
			case 'ready': return '#89d185';
			case 'error': return '#f14c4c';
			default: return '#888';
		}
	};

	const formatTime = (isoString: string) => {
		const date = new Date(isoString);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	};

	// Styles
	const columnStyle: React.CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		overflow: 'hidden',
		borderRight: '1px solid var(--vscode-panel-border)',
		backgroundColor: 'var(--vscode-sideBar-background)',
	};

	const headerStyle: React.CSSProperties = {
		padding: '10px 12px',
		borderBottom: '1px solid var(--vscode-panel-border)',
		fontSize: '11px',
		fontWeight: 600,
		textTransform: 'uppercase',
		color: 'var(--vscode-descriptionForeground)',
		letterSpacing: '0.5px',
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
	};

	const listStyle: React.CSSProperties = {
		flex: 1,
		overflowY: 'auto',
		padding: '4px',
	};

	const itemStyle = (isSelected: boolean): React.CSSProperties => ({
		display: 'flex',
		alignItems: 'center',
		gap: '10px',
		padding: '8px 10px',
		borderRadius: '4px',
		cursor: 'pointer',
		marginBottom: '2px',
		backgroundColor: isSelected ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
		color: isSelected ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit',
	});

	const dotStyle = (status: string): React.CSSProperties => ({
		width: '8px',
		height: '8px',
		borderRadius: '50%',
		flexShrink: 0,
		backgroundColor: getStatusColor(status),
		boxShadow: status === 'new' ? `0 0 6px ${getStatusColor(status)}` : 'none',
		animation: status === 'analyzing' ? 'pulse 1.5s infinite' : 'none',
	});

	const emptyStyle: React.CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		height: '100%',
		color: 'var(--vscode-descriptionForeground)',
		textAlign: 'center',
		padding: '24px',
		opacity: 0.8,
	};

	const buttonStyle: React.CSSProperties = {
		padding: '4px 8px',
		background: 'transparent',
		border: 'none',
		color: 'var(--vscode-foreground)',
		cursor: 'pointer',
		borderRadius: '3px',
		fontSize: '14px',
	};

	return (
		<div style={columnStyle}>
			<div style={headerStyle}>
				<span>Inbox ({items.length})</span>
				<div style={{ display: 'flex', gap: '2px' }}>
					<button
						style={buttonStyle}
						onClick={onOpenFolder}
						title="Open 'To Sort' Folder"
					>
						📂
					</button>
					<button
						style={{
							...buttonStyle,
							opacity: isScanning ? 0.5 : 1,
						}}
						onClick={onScan}
						title="Refresh Inbox"
						disabled={isScanning}
					>
						{isScanning ? '⏳' : '🔄'}
					</button>
				</div>
			</div>

			<div style={listStyle} className="void-scrollbar">
				{items.length === 0 ? (
					<div style={emptyStyle}>
						<div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.5 }}>📭</div>
						<div style={{ fontWeight: 500 }}>Inbox is empty</div>
						<div style={{ fontSize: '11px', marginTop: '8px', lineHeight: 1.4 }}>
							Drag files into the <strong>To Sort</strong> folder in your file explorer, then click Refresh.
						</div>
						<button
							style={{
								marginTop: '16px',
								padding: '6px 12px',
								fontSize: '12px',
								backgroundColor: 'var(--vscode-button-secondaryBackground)',
								color: 'var(--vscode-button-secondaryForeground)',
								border: 'none',
								borderRadius: '3px',
								cursor: 'pointer',
							}}
							onClick={onOpenFolder}
						>
							📂 Open Drop Folder
						</button>
					</div>
				) : (
					items.map(item => (
						<div
							key={item.uri.toString()}
							style={itemStyle(selectedId === item.uri.toString())}
							onClick={() => onSelect(item.uri.toString())}
						>
							<div style={dotStyle(item.docketStatus)} />
							<div style={{ flex: 1, overflow: 'hidden' }}>
								<div style={{
									fontSize: '13px',
									whiteSpace: 'nowrap',
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									fontWeight: 500,
								}} title={item.name}>
									{item.name}
								</div>
								<div style={{
									fontSize: '10px',
									color: 'var(--vscode-descriptionForeground)',
									marginTop: '2px',
									display: 'flex',
									justifyContent: 'space-between',
								}}>
									<span>{item.extension.toUpperCase()}</span>
									<span>{formatTime(item.addedAt)}</span>
								</div>
							</div>
						</div>
					))
				)}
			</div>

			{/* Keyframe animation for pulse */}
			<style>{`
				@keyframes pulse {
					0% { opacity: 0.5; transform: scale(0.9); }
					50% { opacity: 1; transform: scale(1.1); }
					100% { opacity: 0.5; transform: scale(0.9); }
				}
			`}</style>
		</div>
	);
};
