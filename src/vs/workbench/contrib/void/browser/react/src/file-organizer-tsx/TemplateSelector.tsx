/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback } from 'react';
import { IFileOrganizerService } from '../../../fileOrganizer/fileOrganizerService.js';

const TEMPLATES = [
	{
		id: 'workers-comp-full',
		name: 'Workers Compensation - Full Case',
		description: 'Complete organization for workers comp case files with medical, legal, and correspondence',
		icon: '⚖️',
		rules: []
	},
	{
		id: 'medical-reports',
		name: 'Medical Reports Only',
		description: 'Focus on organizing medical documentation with detailed categories',
		icon: '🏥',
		rules: []
	},
	{
		id: 'legal-documents',
		name: 'Legal Documents Only',
		description: 'Organize legal filings, court documents, and attorney correspondence',
		icon: '💼',
		rules: []
	},
	{
		id: 'correspondence',
		name: 'Correspondence & Communications',
		description: 'Organize emails, letters, and communications by sender/recipient',
		icon: '✉️',
		rules: []
	},
	{
		id: 'your-side-their-side',
		name: 'Your Side vs Their Side',
		description: 'Organize by source: Your documents vs Employer/WCB/Other party documents',
		icon: '🔄',
		rules: []
	},
	{
		id: 'chronological',
		name: 'Chronological Organization',
		description: 'Organize all case documents by date for timeline tracking',
		icon: '📅',
		rules: []
	},
	{
		id: 'quick-sort-ai',
		name: 'Quick Sort - AI Assisted',
		description: 'Fast automated sorting using AI to detect document types',
		icon: '✨',
		rules: []
	},
	{
		id: 'custom',
		name: 'Custom',
		description: 'Start with a blank template and create your own rules',
		icon: '✏️',
		rules: []
	}
];

interface TemplateSelectorProps {
	accessor: any;
	selectedTemplate: any | null;
	selectedFiles: any[];
	onTemplateSelect: (template: any) => void;
	onFilesSelect: (files: any[]) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
	accessor,
	selectedTemplate,
	selectedFiles,
	onTemplateSelect,
	onFilesSelect
}) => {
	const handleSelectFiles = useCallback(async () => {
		// Use accessor to call file organizer service
		try {
			const fileOrganizerService = accessor.get(IFileOrganizerService);
			const files = await fileOrganizerService.selectFiles();
			const metadata = await fileOrganizerService.analyzeFiles(files);
			onFilesSelect(metadata);
		} catch (error) {
			console.error('Failed to select files:', error);
		}
	}, [accessor, onFilesSelect]);

	return (
		<div style={{
			display: 'flex',
			flexDirection: 'column',
			gap: '24px',
		}}>
			{/* File Selection */}
			<div>
				<h3 style={{
					margin: '0 0 16px 0',
					fontSize: '16px',
					fontWeight: 600,
				}}>
					Select Files
				</h3>
				<button
					onClick={handleSelectFiles}
					style={{
						padding: '12px 24px',
						backgroundColor: 'var(--vscode-button-background)',
						color: 'var(--vscode-button-foreground)',
						border: 'none',
						borderRadius: '4px',
						cursor: 'pointer',
						fontSize: '14px',
						fontWeight: 500,
					}}
				>
					📂 Choose Files from File System
				</button>
				{selectedFiles.length > 0 && (
					<div style={{
						marginTop: '16px',
						padding: '12px',
						backgroundColor: 'var(--vscode-input-background)',
						borderRadius: '2px',
					}}>
						<div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginBottom: '8px' }}>
							{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
						</div>
						<div style={{
							maxHeight: '150px',
							overflow: 'auto',
						}}>
							{selectedFiles.map((file, index) => (
								<div key={index} style={{
									fontSize: '12px',
									padding: '4px 0',
									borderBottom: index < selectedFiles.length - 1 ? '1px solid var(--vscode-panel-border)' : 'none',
								}}>
									{file.name} ({(file.size / 1024).toFixed(1)} KB)
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Template Selection */}
			<div>
				<h3 style={{
					margin: '0 0 16px 0',
					fontSize: '16px',
					fontWeight: 600,
				}}>
					Choose a Template
				</h3>
				<div style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
					gap: '16px',
				}}>
					{TEMPLATES.map((template) => (
						<button
							key={template.id}
							onClick={() => onTemplateSelect(template)}
							style={{
								padding: '20px',
								backgroundColor: selectedTemplate?.id === template.id
									? 'var(--vscode-button-background)'
									: 'var(--vscode-input-background)',
								color: selectedTemplate?.id === template.id
									? 'var(--vscode-button-foreground)'
									: 'var(--vscode-foreground)',
								border: selectedTemplate?.id === template.id
									? '2px solid var(--vscode-focusBorder)'
									: '1px solid var(--vscode-panel-border)',
								borderRadius: '4px',
								cursor: 'pointer',
								textAlign: 'left',
								transition: 'all 0.2s',
							}}
						>
							<div style={{
								fontSize: '32px',
								marginBottom: '12px',
							}}>
								{template.icon}
							</div>
							<div style={{
								fontWeight: 600,
								marginBottom: '8px',
								fontSize: '14px',
							}}>
								{template.name}
							</div>
							<div style={{
								fontSize: '12px',
								color: 'var(--vscode-descriptionForeground)',
								lineHeight: '1.4',
							}}>
								{template.description}
							</div>
						</button>
					))}
				</div>
			</div>
		</div>
	);
};

