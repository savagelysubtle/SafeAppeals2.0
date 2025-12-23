/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';

interface FilingCabinetProps {
	destinationFolder?: string;
}

export const FilingCabinet: React.FC<FilingCabinetProps> = ({ destinationFolder }) => {
	// Folder structure matching what initializeCaseFolders creates
	const treeData = [
		{ name: 'Medical', icon: '🏥', children: ['Reports', 'Imaging', 'Bills'] },
		{ name: 'Legal', icon: '⚖️', children: ['Correspondence', 'Court Filings', 'Decisions'] },
		{ name: 'Evidence', icon: '📎', children: [] },
		{ name: 'Your Side', icon: '👤', children: [] },
		{ name: 'Their Side', icon: '🏢', children: [] },
	];

	// Styles
	const columnStyle: React.CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		overflow: 'hidden',
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
	};

	const treeStyle: React.CSSProperties = {
		flex: 1,
		overflowY: 'auto',
		padding: '8px 0',
	};

	const folderStyle = (isActive: boolean): React.CSSProperties => ({
		padding: '4px 12px',
		display: 'flex',
		alignItems: 'center',
		gap: '6px',
		fontSize: '13px',
		fontWeight: 500,
		cursor: 'default',
		backgroundColor: isActive ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
		color: isActive ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit',
	});

	const childStyle = (isActive: boolean): React.CSSProperties => ({
		padding: '3px 12px 3px 32px',
		display: 'flex',
		alignItems: 'center',
		gap: '6px',
		fontSize: '12px',
		cursor: 'default',
		backgroundColor: isActive ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
		color: isActive ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
		opacity: isActive ? 1 : 0.85,
	});

	return (
		<div style={columnStyle}>
			<div style={headerStyle}>
				<span>📁 Destination</span>
			</div>

			<div style={treeStyle} className="void-scrollbar">
				{destinationFolder && (
					<div style={{
						padding: '8px 12px',
						fontSize: '11px',
						color: 'var(--vscode-descriptionForeground)',
						borderBottom: '1px solid var(--vscode-panel-border)',
						marginBottom: '4px',
					}}>
						Filing to: <strong style={{ color: 'var(--vscode-foreground)' }}>{destinationFolder}</strong>
					</div>
				)}

				{treeData.map((folder, idx) => {
					const folderActive = destinationFolder?.startsWith(folder.name);
					return (
						<div key={idx}>
							<div style={folderStyle(!!folderActive)}>
								<span style={{ opacity: 0.7 }}>📂</span>
								<span>{folder.name}</span>
								{folderActive && !folder.children.some(c => destinationFolder === `${folder.name}/${c}`) && (
									<span style={{ marginLeft: 'auto', fontSize: '10px' }}>◀</span>
								)}
							</div>
							{folder.children.map((child, cIdx) => {
								const fullPath = `${folder.name}/${child}`;
								const isActive = destinationFolder === fullPath;
								return (
									<div key={cIdx} style={childStyle(isActive)}>
										<span style={{ opacity: 0.5 }}>📄</span>
										<span>{child}</span>
										{isActive && <span style={{ marginLeft: 'auto', fontSize: '10px' }}>◀</span>}
									</div>
								);
							})}
						</div>
					);
				})}
			</div>
		</div>
	);
};
