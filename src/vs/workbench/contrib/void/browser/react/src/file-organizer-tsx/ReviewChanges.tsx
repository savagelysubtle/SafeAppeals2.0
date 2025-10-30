/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccessor } from '../util/services.js';

interface ReviewChangesProps {
	files: any[];
	rules: any[];
	proposedChanges: any[];
	onChangesGenerated: (changes: any[]) => void;
}

export const ReviewChanges: React.FC<ReviewChangesProps> = ({
	files,
	rules,
	proposedChanges,
	onChangesGenerated
}) => {
	const accessor = useAccessor();

	// Get the service immediately on mount (synchronously) to avoid accessor expiration
	const fileOrganizerService = useMemo(() => {
		try {
			return accessor.get('IFileOrganizerService');
		} catch (error) {
			console.error('[ReviewChanges] Failed to get FileOrganizerService:', error);
			return null;
		}
	}, [accessor]);

	const [changes, setChanges] = useState<any[]>([]);
	const [processing, setProcessing] = useState(false);
	const [progress, setProgress] = useState({ current: 0, total: 0 });
	const [results, setResults] = useState<any[]>([]);

	const generatePreview = useCallback(async () => {
		if (!fileOrganizerService) {
			console.error('FileOrganizerService not available');
			return;
		}
		try {
			const previewChanges = await fileOrganizerService.previewChanges(files, rules);
			setChanges(previewChanges);
			onChangesGenerated(previewChanges);
		} catch (error) {
			console.error('Failed to generate preview:', error);
		}
	}, [fileOrganizerService, files, rules, onChangesGenerated]);

	// Group changes by target folder for better visualization
	const changesByFolder = useMemo(() => {
		const grouped: Record<string, any[]> = {};
		changes.forEach(change => {
			const folderName = change.proposed.location?.path?.split('/').pop() || 'Current Location';
			if (!grouped[folderName]) {
				grouped[folderName] = [];
			}
			grouped[folderName].push(change);
		});
		return grouped;
	}, [changes]);

	useEffect(() => {
		generatePreview();
	}, [generatePreview]);

	const handleProcess = useCallback(async () => {
		if (!fileOrganizerService) {
			alert('File Organizer Service is not available.');
			return;
		}

		setProcessing(true);
		setProgress({ current: 0, total: changes.length });

		try {
			const processResults = await fileOrganizerService.applyChanges(changes);
			setResults(processResults);
			setProcessing(false);
		} catch (error) {
			console.error('Failed to process files:', error);
			setProcessing(false);
		}
	}, [fileOrganizerService, changes]);

	return (
		<div style={{
			display: 'flex',
			flexDirection: 'column',
			gap: '24px',
		}}>
			{/* Summary */}
			<div style={{
				padding: '16px',
				backgroundColor: 'var(--vscode-input-background)',
				borderRadius: '4px',
			}}>
				<h3 style={{
					margin: '0 0 12px 0',
					fontSize: '16px',
					fontWeight: 600,
				}}>
					Summary
				</h3>
				<div style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(3, 1fr)',
					gap: '16px',
					fontSize: '12px',
				}}>
					<div>
						<div style={{ color: 'var(--vscode-descriptionForeground)' }}>Total Files</div>
						<div style={{ fontSize: '20px', fontWeight: 600, marginTop: '4px' }}>{files.length}</div>
					</div>
					<div>
						<div style={{ color: 'var(--vscode-descriptionForeground)' }}>Will be Renamed</div>
						<div style={{ fontSize: '20px', fontWeight: 600, marginTop: '4px' }}>{changes.length}</div>
					</div>
					<div>
						<div style={{ color: 'var(--vscode-descriptionForeground)' }}>Rules Applied</div>
						<div style={{ fontSize: '20px', fontWeight: 600, marginTop: '4px' }}>{rules.length}</div>
					</div>
				</div>
			</div>

			{/* Changes Preview */}
			<div>
				<h3 style={{
					margin: '0 0 16px 0',
					fontSize: '16px',
					fontWeight: 600,
				}}>
					Proposed Changes
				</h3>
				<div style={{
					padding: '16px',
					backgroundColor: 'var(--vscode-input-background)',
					borderRadius: '4px',
					maxHeight: '500px',
					overflow: 'auto',
				}}>
					{changes.length === 0 ? (
						<div style={{
							color: 'var(--vscode-descriptionForeground)',
							fontSize: '12px',
							textAlign: 'center',
							padding: '24px',
						}}>
							No changes to preview
						</div>
					) : (
						<table style={{
							width: '100%',
							borderCollapse: 'collapse',
							fontSize: '12px',
						}}>
							<thead>
								<tr style={{
									borderBottom: '2px solid var(--vscode-panel-border)',
								}}>
									<th style={{ padding: '8px', textAlign: 'left', fontWeight: 600 }}>Original Name</th>
									<th style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>→</th>
									<th style={{ padding: '8px', textAlign: 'left', fontWeight: 600 }}>New Name</th>
									<th style={{ padding: '8px', textAlign: 'left', fontWeight: 600 }}>Tags</th>
								</tr>
							</thead>
							<tbody>
								{changes.map((change, index) => (
									<tr key={index} style={{
										borderBottom: index < changes.length - 1 ? '1px solid var(--vscode-panel-border)' : 'none',
									}}>
										<td style={{
											padding: '8px',
											color: 'var(--vscode-descriptionForeground)',
										}}>
											{change.original.name}
										</td>
										<td style={{ padding: '8px', textAlign: 'center' }}>→</td>
										<td style={{
											padding: '8px',
											color: 'var(--vscode-foreground)',
											fontWeight: 500,
										}}>
											{change.proposed.name}
										</td>
										<td style={{
											padding: '8px',
										}}>
											<div style={{
												display: 'flex',
												flexWrap: 'wrap',
												gap: '4px',
											}}>
												{change.proposed.tags.map((tag: string, tagIndex: number) => (
													<span
														key={tagIndex}
														style={{
															padding: '2px 6px',
															backgroundColor: 'var(--vscode-button-secondaryBackground)',
															color: 'var(--vscode-button-secondaryForeground)',
															borderRadius: '2px',
															fontSize: '10px',
														}}
													>
														{tag}
													</span>
												))}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>

			{/* Processing Progress */}
			{processing && (
				<div style={{
					padding: '16px',
					backgroundColor: 'var(--vscode-input-background)',
					borderRadius: '4px',
				}}>
					<div style={{ marginBottom: '8px', fontSize: '14px' }}>
						Processing files... {progress.current} / {progress.total}
					</div>
					<div style={{
						height: '4px',
						backgroundColor: 'var(--vscode-panel-border)',
						borderRadius: '2px',
						overflow: 'hidden',
					}}>
						<div style={{
							height: '100%',
							width: `${(progress.current / progress.total) * 100}%`,
							backgroundColor: 'var(--vscode-button-background)',
							transition: 'width 0.3s',
						}} />
					</div>
				</div>
			)}

			{/* Results */}
			{results.length > 0 && (
				<div style={{
					padding: '16px',
					backgroundColor: results.every(r => r.success)
						? 'var(--vscode-testing-iconPassed)'
						: 'var(--vscode-testing-iconFailed)',
					color: 'var(--vscode-input-background)',
					borderRadius: '4px',
				}}>
					<div style={{ fontWeight: 600, marginBottom: '8px' }}>
						{results.filter(r => r.success).length} / {results.length} files processed successfully
					</div>
					{results.some(r => !r.success) && (
						<div style={{ fontSize: '12px' }}>
							{results.filter(r => !r.success).length} file(s) failed to process
						</div>
					)}
				</div>
			)}

			{/* Process Button */}
			{!processing && results.length === 0 && changes.length > 0 && (
				<button
					onClick={handleProcess}
					style={{
						padding: '12px 24px',
						backgroundColor: 'var(--vscode-button-background)',
						color: 'var(--vscode-button-foreground)',
						border: 'none',
						borderRadius: '2px',
						cursor: 'pointer',
						fontSize: '14px',
						fontWeight: 600,
					}}
				>
					✨ Process {changes.length} File{changes.length !== 1 ? 's' : ''}
				</button>
			)}
		</div>
	);
};

