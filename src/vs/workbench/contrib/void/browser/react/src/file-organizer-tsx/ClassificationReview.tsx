/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useMemo } from 'react';

interface ClassificationReviewProps {
	files: any[];
	onFilesUpdate: (files: any[]) => void;
}

export const ClassificationReview: React.FC<ClassificationReviewProps> = ({
	files,
	onFilesUpdate
}) => {
	const [selectedFileIndices, setSelectedFileIndices] = useState<Set<number>>(new Set());

	// Group files by classification
	const groupedFiles = useMemo(() => {
		const groups = {
			YourSide: files.filter(f => f.classification === 'YourSide'),
			TheirSide: files.filter(f => f.classification === 'TheirSide'),
			Unknown: files.filter(f => !f.classification || f.classification === 'Unknown')
		};
		return groups;
	}, [files]);

	const handleClassificationChange = (fileIndex: number, newClassification: 'YourSide' | 'TheirSide') => {
		const updatedFiles = files.map((file, idx) =>
			idx === fileIndex
				? { ...file, classification: newClassification, classificationMethod: 'manual' }
				: file
		);
		onFilesUpdate(updatedFiles);
	};

	const handleBulkClassify = (classification: 'YourSide' | 'TheirSide') => {
		const updatedFiles = files.map((file, idx) =>
			selectedFileIndices.has(idx)
				? { ...file, classification, classificationMethod: 'manual' }
				: file
		);
		onFilesUpdate(updatedFiles);
		setSelectedFileIndices(new Set());
	};

	const toggleFileSelection = (index: number) => {
		const newSelection = new Set(selectedFileIndices);
		if (newSelection.has(index)) {
			newSelection.delete(index);
		} else {
			newSelection.add(index);
		}
		setSelectedFileIndices(newSelection);
	};

	const selectAllUnknown = () => {
		const unknownIndices = files
			.map((f, idx) => (!f.classification || f.classification === 'Unknown') ? idx : -1)
			.filter(idx => idx !== -1);
		setSelectedFileIndices(new Set(unknownIndices));
	};

	const stats = {
		yourSide: groupedFiles.YourSide.length,
		theirSide: groupedFiles.TheirSide.length,
		unknown: groupedFiles.Unknown.length,
		total: files.length
	};

	return (
		<div style={{
			display: 'flex',
			flexDirection: 'column',
			gap: '24px'
		}}>
			{/* Stats Summary */}
			<div style={{
				display: 'grid',
				gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
				gap: '12px'
			}}>
				<div style={{
					padding: '16px',
					backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
					borderRadius: '6px',
					border: '2px solid var(--vscode-charts-blue)'
				}}>
					<div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--vscode-charts-blue)' }}>
						{stats.yourSide}
					</div>
					<div style={{ fontSize: '13px', marginTop: '4px' }}>👤 Your Side Files</div>
				</div>
				<div style={{
					padding: '16px',
					backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
					borderRadius: '6px',
					border: '2px solid var(--vscode-charts-orange)'
				}}>
					<div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--vscode-charts-orange)' }}>
						{stats.theirSide}
					</div>
					<div style={{ fontSize: '13px', marginTop: '4px' }}>🏢 Their Side Files</div>
				</div>
				{stats.unknown > 0 && (
					<div style={{
						padding: '16px',
						backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
						borderRadius: '6px',
						border: '2px solid var(--vscode-inputValidation-warningBorder)'
					}}>
						<div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--vscode-inputValidation-warningForeground)' }}>
							{stats.unknown}
						</div>
						<div style={{ fontSize: '13px', marginTop: '4px' }}>⚠️ Unclassified</div>
					</div>
				)}
			</div>

			{/* Bulk Actions for Unclassified */}
			{stats.unknown > 0 && (
				<div style={{
					padding: '16px',
					backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
					border: '1px solid var(--vscode-inputValidation-warningBorder)',
					borderRadius: '6px'
				}}>
					<h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
						⚠️ {stats.unknown} files need classification
					</h4>
					<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
						<button
							onClick={selectAllUnknown}
							style={{
								padding: '8px 16px',
								backgroundColor: 'var(--vscode-button-secondaryBackground)',
								color: 'var(--vscode-button-secondaryForeground)',
								border: 'none',
								borderRadius: '4px',
								cursor: 'pointer',
								fontSize: '13px'
							}}
						>
							Select All Unclassified
						</button>
						{selectedFileIndices.size > 0 && (
							<>
								<button
									onClick={() => handleBulkClassify('YourSide')}
									style={{
										padding: '8px 16px',
										backgroundColor: 'var(--vscode-button-background)',
										color: 'var(--vscode-button-foreground)',
										border: 'none',
										borderRadius: '4px',
										cursor: 'pointer',
										fontSize: '13px'
									}}
								>
									👤 Assign to Your Side ({selectedFileIndices.size})
								</button>
								<button
									onClick={() => handleBulkClassify('TheirSide')}
									style={{
										padding: '8px 16px',
										backgroundColor: 'var(--vscode-button-background)',
										color: 'var(--vscode-button-foreground)',
										border: 'none',
										borderRadius: '4px',
										cursor: 'pointer',
										fontSize: '13px'
									}}
								>
									🏢 Assign to Their Side ({selectedFileIndices.size})
								</button>
							</>
						)}
					</div>
				</div>
			)}

			{/* File List with Classification Controls */}
			<div style={{
				display: 'flex',
				flexDirection: 'column',
				gap: '12px'
			}}>
				<h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
					Review Classifications
				</h3>

			<div
				className="void-scrollbar"
				style={{
					maxHeight: '400px',
					overflowY: 'auto',
					border: '1px solid var(--vscode-panel-border)',
					borderRadius: '6px'
				}}>

					{files.length === 0 ? (
						<div style={{
							padding: '32px',
							textAlign: 'center',
							color: 'var(--vscode-descriptionForeground)'
						}}>
							No files selected yet
						</div>
					) : (
						<table style={{ width: '100%', borderCollapse: 'collapse' }}>
							<thead style={{
								position: 'sticky',
								top: 0,
								backgroundColor: 'var(--vscode-editor-background)',
								borderBottom: '1px solid var(--vscode-panel-border)'
							}}>
								<tr>
									<th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', width: '40px' }}>
										<input
											type="checkbox"
											onChange={(e) => {
												if (e.target.checked) {
													setSelectedFileIndices(new Set(files.map((_, idx) => idx)));
												} else {
													setSelectedFileIndices(new Set());
												}
											}}
										/>
									</th>
									<th style={{ padding: '12px', textAlign: 'left', fontSize: '13px' }}>File Name</th>
									<th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', width: '180px' }}>Classification</th>
								</tr>
							</thead>
							<tbody>
								{files.map((file, index) => (
									<tr
										key={index}
										style={{
											borderBottom: '1px solid var(--vscode-panel-border)',
											backgroundColor: selectedFileIndices.has(index)
												? 'var(--vscode-list-activeSelectionBackground)'
												: 'transparent'
										}}
									>
										<td style={{ padding: '12px' }}>
											<input
												type="checkbox"
												checked={selectedFileIndices.has(index)}
												onChange={() => toggleFileSelection(index)}
											/>
										</td>
										<td style={{
											padding: '12px',
											fontSize: '13px',
											wordBreak: 'break-word'
										}}>
											{file.name}
										</td>
										<td style={{ padding: '12px' }}>
											<select
												value={file.classification || 'Unknown'}
												onChange={(e) => handleClassificationChange(index, e.target.value as any)}
												style={{
													padding: '6px 12px',
													backgroundColor: 'var(--vscode-dropdown-background)',
													color: 'var(--vscode-dropdown-foreground)',
													border: '1px solid var(--vscode-dropdown-border)',
													borderRadius: '4px',
													fontSize: '13px',
													cursor: 'pointer',
													width: '100%'
												}}
											>
												<option value="Unknown">⚠️ Unclassified</option>
												<option value="YourSide">👤 Your Side</option>
												<option value="TheirSide">🏢 Their Side</option>
											</select>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>

			{/* Helper Text */}
			<div style={{
				padding: '12px',
				backgroundColor: 'var(--vscode-textBlockQuote-background)',
				border: '1px solid var(--vscode-textBlockQuote-border)',
				borderRadius: '4px',
				fontSize: '13px',
				color: 'var(--vscode-descriptionForeground)',
				lineHeight: '1.5'
			}}>
				<strong>💡 Tip:</strong> Make sure all files are classified before proceeding.
				You can select multiple files and use bulk actions to classify them quickly.
			</div>
		</div>
	);
};

