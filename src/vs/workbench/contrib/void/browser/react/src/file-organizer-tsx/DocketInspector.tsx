/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react';
import { DocketItem, Tag, EntityMatch } from '../../../fileOrganizer/types.js';

interface DocketInspectorProps {
	item?: DocketItem;
	onUpdate: (updates: Partial<DocketItem>) => void;
	onProcess: (item: DocketItem) => void;
	onAnalyze?: (item: DocketItem) => void;
}

export const DocketInspector: React.FC<DocketInspectorProps> = ({
	item,
	onUpdate,
	onProcess,
	onAnalyze
}) => {
	// Styles
	const columnStyle: React.CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		height: '100%',
		overflow: 'hidden',
		backgroundColor: 'var(--vscode-editor-background)',
		borderRight: '1px solid var(--vscode-panel-border)',
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

	const contentStyle: React.CSSProperties = {
		flex: 1,
		padding: '16px',
		overflowY: 'auto',
		display: 'flex',
		flexDirection: 'column',
		gap: '16px',
	};

	const emptyStyle: React.CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		height: '100%',
		color: 'var(--vscode-descriptionForeground)',
		textAlign: 'center',
		opacity: 0.7,
	};

	const cardStyle: React.CSSProperties = {
		background: 'var(--vscode-editor-inactiveSelectionBackground)',
		border: '1px solid var(--vscode-panel-border)',
		borderRadius: '6px',
		padding: '14px',
		position: 'relative',
		borderLeft: '3px solid var(--vscode-charts-purple, #a855f7)',
	};

	const inputStyle: React.CSSProperties = {
		width: '100%',
		padding: '6px 10px',
		backgroundColor: 'var(--vscode-input-background)',
		border: '1px solid var(--vscode-input-border)',
		color: 'var(--vscode-input-foreground)',
		borderRadius: '3px',
		fontSize: '13px',
		boxSizing: 'border-box',
	};

	const labelStyle: React.CSSProperties = {
		fontSize: '11px',
		fontWeight: 600,
		color: 'var(--vscode-descriptionForeground)',
		textTransform: 'uppercase',
		marginBottom: '6px',
	};

	const tagStyle = (type: string): React.CSSProperties => ({
		display: 'inline-flex',
		alignItems: 'center',
		padding: '3px 8px',
		borderRadius: '12px',
		fontSize: '11px',
		backgroundColor: type === 'entity' ? 'rgba(100, 149, 237, 0.2)' : 'rgba(60, 179, 113, 0.2)',
		color: type === 'entity' ? '#6495ED' : '#3CB371',
		border: `1px solid ${type === 'entity' ? 'rgba(100, 149, 237, 0.3)' : 'rgba(60, 179, 113, 0.3)'}`,
		marginRight: '6px',
		marginBottom: '6px',
	});

	const buttonPrimaryStyle: React.CSSProperties = {
		padding: '8px 16px',
		backgroundColor: 'var(--vscode-button-background)',
		color: 'var(--vscode-button-foreground)',
		border: 'none',
		borderRadius: '3px',
		fontSize: '12px',
		fontWeight: 500,
		cursor: 'pointer',
		display: 'inline-flex',
		alignItems: 'center',
		gap: '6px',
	};

	if (!item) {
		return (
			<div style={columnStyle}>
				<div style={headerStyle}>
					<span>Inspector</span>
				</div>
				<div style={emptyStyle}>
					<div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.5 }}>👈</div>
					<div>Select a file to inspect</div>
				</div>
			</div>
		);
	}

	const isReady = item.docketStatus === 'ready';
	const isAnalyzing = item.docketStatus === 'analyzing';
	const isNew = item.docketStatus === 'new';

	return (
		<div style={columnStyle}>
			<div style={headerStyle}>
				<span>Inspector</span>
				{item.docketStatus === 'error' && (
					<span style={{ color: 'var(--vscode-errorForeground)', fontSize: '11px' }}>⚠️ Error</span>
				)}
			</div>

			<div style={contentStyle} className="void-scrollbar">
				{/* AI Analysis Card */}
				{isReady && (
					<div style={cardStyle}>
						<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
							<span style={{
								backgroundColor: 'var(--vscode-charts-purple, #a855f7)',
								color: 'white',
								padding: '2px 8px',
								borderRadius: '10px',
								fontSize: '11px',
								fontWeight: 600,
							}}>
								{Math.round((item.aiConfidence || 0) * 100)}%
							</span>
							<span style={{ fontSize: '12px', fontWeight: 500 }}>
								{item.classification === 'YourSide' ? '👤 Your Side' :
								 item.classification === 'TheirSide' ? '🏢 Their Side' : '📄 Document'}
							</span>
						</div>

						<div style={{ fontSize: '12px', lineHeight: 1.5, opacity: 0.9 }}>
							AI suggests: <strong>{item.suggestedTags?.[0]?.name || item.suggestedFolder || 'Unknown'}</strong>
						</div>

						{/* Entity Matches */}
						{item.entityMatches && item.entityMatches.length > 0 && (
							<div style={{ marginTop: '12px' }}>
								<div style={labelStyle}>Detected Entities</div>
								<div style={{ display: 'flex', flexWrap: 'wrap' }}>
									{item.entityMatches.map((entity: EntityMatch, idx: number) => (
										<span
											key={idx}
											style={tagStyle('entity')}
											title={`${entity.entityType} (${Math.round(entity.confidence * 100)}%)`}
										>
											{entity.side === 'YourSide' ? '👤' : '🏢'} {entity.entityName}
										</span>
									))}
								</div>
							</div>
						)}
					</div>
				)}

				{isAnalyzing && (
					<div style={{ ...cardStyle, textAlign: 'center', padding: '30px' }}>
						<div style={{ fontSize: '20px', marginBottom: '10px' }}>⏳</div>
						<div style={{ fontSize: '12px' }}>Analyzing document...</div>
					</div>
				)}

				{isNew && (
					<div
						style={{
							...cardStyle,
							textAlign: 'center',
							padding: '20px',
							borderLeftColor: 'var(--vscode-charts-blue, #3794ff)',
							cursor: 'pointer',
							transition: 'background 0.15s ease',
						}}
						onClick={() => onAnalyze?.(item)}
						onMouseOver={(e) => {
							(e.currentTarget as HTMLDivElement).style.background = 'var(--vscode-list-hoverBackground)';
						}}
						onMouseOut={(e) => {
							(e.currentTarget as HTMLDivElement).style.background = 'var(--vscode-editor-inactiveSelectionBackground)';
						}}
					>
						<div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
						<div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--vscode-textLink-foreground)' }}>
							Click to start AI analysis
						</div>
						<div style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)', marginTop: '4px' }}>
							Classify document and suggest destination
						</div>
					</div>
				)}

				{/* File Details Form */}
				<div>
					<div style={labelStyle}>Filename</div>
					<input
						type="text"
						style={inputStyle}
						value={item.name}
						onChange={(e) => onUpdate({ name: e.target.value })}
					/>
				</div>

				<div>
					<div style={labelStyle}>Destination Folder</div>
					<input
						type="text"
						style={{ ...inputStyle, fontFamily: 'monospace' }}
						value={item.suggestedFolder || ''}
						onChange={(e) => onUpdate({ suggestedFolder: e.target.value })}
						placeholder="e.g. Medical/Reports"
					/>
				</div>

				<div>
					<div style={labelStyle}>Tags</div>
					<div style={{ display: 'flex', flexWrap: 'wrap' }}>
						{item.suggestedTags?.map((tag: Tag, idx: number) => (
							<span key={idx} style={tagStyle('category')}>
								{tag.name}
								<button
									style={{
										marginLeft: '4px',
										background: 'none',
										border: 'none',
										color: 'currentColor',
										cursor: 'pointer',
										padding: 0,
										fontSize: '10px',
									}}
									onClick={() => {
										const newTags = [...(item.suggestedTags || [])];
										newTags.splice(idx, 1);
										onUpdate({ suggestedTags: newTags });
									}}
								>
									×
								</button>
							</span>
						))}
						<button
							style={{
								...tagStyle('category'),
								backgroundColor: 'var(--vscode-button-secondaryBackground)',
								color: 'var(--vscode-button-secondaryForeground)',
								border: '1px dashed var(--vscode-panel-border)',
								cursor: 'pointer',
							}}
							onClick={() => {
								const tagName = prompt('Add tag:');
								if (tagName) {
									const newTag: Tag = { id: tagName, name: tagName, type: 'custom' };
									onUpdate({ suggestedTags: [...(item.suggestedTags || []), newTag] });
								}
							}}
						>
							+ Add
						</button>
					</div>
				</div>

				{/* Actions */}
				<div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
					<button
						style={{
							...buttonPrimaryStyle,
							backgroundColor: 'var(--vscode-button-secondaryBackground)',
							color: 'var(--vscode-button-secondaryForeground)',
						}}
					>
						🗑️ Skip
					</button>
					<button
						style={{
							...buttonPrimaryStyle,
							opacity: item.suggestedFolder ? 1 : 0.5,
						}}
						disabled={!item.suggestedFolder}
						onClick={() => onProcess(item)}
					>
						✅ File It
					</button>
				</div>
			</div>
		</div>
	);
};
