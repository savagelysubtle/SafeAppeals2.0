/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAccessor } from '../util/services.js';
import { DocketInbox } from './DocketInbox.js';
import { DocketInspector } from './DocketInspector.js';
import { FilingCabinet } from './FilingCabinet.js';
import { DocketItem } from '../../../fileOrganizer/types.js';
import { CaseInfo } from '../../../fileOrganizer/caseConfig.js';

export const DocketDashboard: React.FC = () => {
	const accessor = useAccessor();
	const [docketItems, setDocketItems] = useState<DocketItem[]>([]);
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
	const [inboxPath, setInboxPath] = useState<string | null>(null);
	const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
	const [isScanning, setIsScanning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const hasInitialized = useRef(false);

	// Service Access
	const fileOrganizerService = useMemo(() => {
		try {
			return accessor.get('IFileOrganizerService');
		} catch (err) {
			console.error('[DocketDashboard] Failed to get FileOrganizerService:', err);
			return null;
		}
	}, [accessor]);

	// Scan function with cooldown protection
	const doScan = useCallback(async (service: any, force: boolean = false) => {
		if (!service) return;
		setIsScanning(true);
		setError(null);
		try {
			const items = await service.scanInboxFolder(force);
			setDocketItems(items);
		} catch (err: any) {
			console.error('Scan failed:', err);
			setError(err?.message || 'Failed to scan inbox');
		} finally {
			setIsScanning(false);
		}
	}, []);

	// Load Case Info & Scan Inbox on Mount (only once)
	useEffect(() => {
		if (hasInitialized.current) return;
		if (!fileOrganizerService) return;

		hasInitialized.current = true;

		const init = async () => {
			try {
				const workspaceService = accessor.get('IWorkspaceContextService');
				const workspace = workspaceService.getWorkspace();
				const workspaceFolder = workspace.folders?.[0]?.uri;

				if (!workspaceFolder) {
					setError('No workspace folder open. Please open a folder first.');
					return;
				}

				// Load Case Info
				try {
					const info = await fileOrganizerService.loadCaseInfo(workspaceFolder);
					if (info) setCaseInfo(info);
				} catch (e) {
					console.warn('No case info found:', e);
				}

				// Auto-detect "To Sort" folder using service method (no dynamic imports!)
				const inboxPathResult = fileOrganizerService.autoDetectInbox();
				if (inboxPathResult) {
					setInboxPath(inboxPathResult);
					// Scan once on init
					await doScan(fileOrganizerService);
				} else {
					setError('Could not detect inbox folder. Make sure a workspace is open.');
				}
			} catch (err) {
				console.error('[DocketDashboard] Init error:', err);
				setError('Failed to initialize. Check console.');
			}
		};
		init();
	}, [fileOrganizerService, accessor, doScan]);

	// Manual Refresh (force=true bypasses cooldown)
	const handleScanInbox = useCallback(() => {
		doScan(fileOrganizerService, true);
	}, [fileOrganizerService, doScan]);

	// Open Inbox Folder in OS
	const handleOpenInbox = useCallback(async () => {
		if (!inboxPath || !fileOrganizerService) return;
		try {
			await fileOrganizerService.revealInExplorer(inboxPath);
		} catch (err) {
			console.error('Failed to open folder:', err);
		}
	}, [inboxPath, fileOrganizerService]);

	// Select Item & Trigger AI if needed
	const handleSelectItem = useCallback(async (id: string) => {
		setSelectedItemId(id);

		const item = docketItems.find(i => i.uri.toString() === id);
		if (item && item.docketStatus === 'new' && fileOrganizerService && caseInfo) {
			// Trigger AI Analysis
			setDocketItems(prev => prev.map(i =>
				i.uri.toString() === id ? { ...i, docketStatus: 'analyzing' as const } : i
			));

			try {
				const classifiedItem = await fileOrganizerService.classifySingleFile(item, caseInfo);
				setDocketItems(prev => prev.map(i =>
					i.uri.toString() === id ? classifiedItem : i
				));
			} catch (err) {
				console.error('AI Analysis failed:', err);
				setDocketItems(prev => prev.map(i =>
					i.uri.toString() === id ? { ...i, docketStatus: 'error' as const } : i
				));
			}
		}
	}, [docketItems, fileOrganizerService, caseInfo]);

	// Update Item (Manual Edits)
	const handleUpdateItem = useCallback((updates: Partial<DocketItem>) => {
		if (!selectedItemId) return;
		setDocketItems(prev => prev.map(item =>
			item.uri.toString() === selectedItemId ? { ...item, ...updates } : item
		));
	}, [selectedItemId]);

	// Process (Move) File
	const handleProcessItem = useCallback(async (item: DocketItem) => {
		if (!fileOrganizerService || !item.suggestedFolder) return;

		try {
			const result = await fileOrganizerService.moveFileToFolder(item, item.suggestedFolder);

			if (result.success) {
				setDocketItems(prev => prev.filter(i => i.uri.toString() !== item.uri.toString()));
				setSelectedItemId(null);
			} else {
				alert(`Failed to move file: ${result.error}`);
			}
		} catch (err) {
			console.error('Process failed:', err);
			alert('Failed to process file. Check console.');
		}
	}, [fileOrganizerService]);

	// Analyze Single File (triggered by clicking "Start AI analysis")
	const handleAnalyzeItem = useCallback(async (item: DocketItem) => {
		if (!fileOrganizerService) return;

		const id = item.uri.toString();

		// Set status to analyzing
		setDocketItems(prev => prev.map(i =>
			i.uri.toString() === id ? { ...i, docketStatus: 'analyzing' as const } : i
		));

		try {
			const classifiedItem = await fileOrganizerService.classifySingleFile(item, caseInfo);
			setDocketItems(prev => prev.map(i =>
				i.uri.toString() === id ? classifiedItem : i
			));
		} catch (err) {
			console.error('AI Analysis failed:', err);
			setDocketItems(prev => prev.map(i =>
				i.uri.toString() === id ? { ...i, docketStatus: 'error' as const } : i
			));
		}
	}, [fileOrganizerService, caseInfo]);

	// Derived State
	const selectedItem = useMemo(() =>
		docketItems.find(i => i.uri.toString() === selectedItemId),
		[docketItems, selectedItemId]
	);

	// ============ INLINE STYLES (bypasses build system prefixing) ============
	const containerStyle: React.CSSProperties = {
		display: 'grid',
		gridTemplateColumns: '280px 1fr 240px',
		gridTemplateRows: 'auto 1fr',
		height: '100%',
		width: '100%',
		backgroundColor: 'var(--vscode-editor-background)',
		color: 'var(--vscode-editor-foreground)',
		overflow: 'hidden',
		fontSize: '13px',
	};

	const headerStyle: React.CSSProperties = {
		gridColumn: '1 / -1',
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: '10px 16px',
		borderBottom: '1px solid var(--vscode-panel-border)',
		backgroundColor: 'var(--vscode-editor-background)',
	};

	const titleStyle: React.CSSProperties = {
		fontSize: '14px',
		fontWeight: 600,
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
	};

	const buttonStyle: React.CSSProperties = {
		padding: '4px 10px',
		borderRadius: '3px',
		border: 'none',
		fontSize: '12px',
		cursor: 'pointer',
		backgroundColor: 'var(--vscode-button-secondaryBackground)',
		color: 'var(--vscode-button-secondaryForeground)',
	};

	return (
		<div style={containerStyle}>
			{/* Header */}
			<div style={headerStyle}>
				<div style={titleStyle}>
					<span>⚖️</span>
					<span>Case Docket</span>
					{inboxPath && (
						<span style={{
							fontSize: '11px',
							color: 'var(--vscode-descriptionForeground)',
							fontWeight: 400,
							marginLeft: '8px'
						}}>
							📂 To Sort
						</span>
					)}
				</div>
				<div style={{ display: 'flex', gap: '6px' }}>
					<button style={buttonStyle} onClick={() => alert('Config coming soon')}>
						⚙️
					</button>
				</div>
			</div>

			{/* Error Banner */}
			{error && (
				<div style={{
					gridColumn: '1 / -1',
					padding: '8px 16px',
					backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
					borderBottom: '1px solid var(--vscode-inputValidation-errorBorder)',
					fontSize: '12px',
				}}>
					⚠️ {error}
				</div>
			)}

			{/* Three Columns */}
			<DocketInbox
				items={docketItems}
				selectedId={selectedItemId}
				onSelect={handleSelectItem}
				onScan={handleScanInbox}
				onOpenFolder={handleOpenInbox}
				isScanning={isScanning}
			/>

			<DocketInspector
				item={selectedItem}
				onUpdate={handleUpdateItem}
				onProcess={handleProcessItem}
				onAnalyze={handleAnalyzeItem}
			/>

			<FilingCabinet
				destinationFolder={selectedItem?.suggestedFolder}
			/>
		</div>
	);
};
