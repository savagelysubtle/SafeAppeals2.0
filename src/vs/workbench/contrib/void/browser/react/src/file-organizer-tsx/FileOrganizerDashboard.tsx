/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';
import { TemplateSelector } from './TemplateSelector.js';
import { RuleBuilder } from './RuleBuilder.js';
import { ReviewChanges } from './ReviewChanges.js';

interface FileOrganizerDashboardProps {
	accessor: any;
}

export const FileOrganizerDashboard: React.FC<FileOrganizerDashboardProps> = ({ accessor }) => {
	const [currentStep, setCurrentStep] = useState(0);
	const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
	const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
	const [customRules, setCustomRules] = useState<any[]>([]);
	const [proposedChanges, setProposedChanges] = useState<any[]>([]);

	const steps = ['Choose Template', 'Configure Rules', 'Review & Process'];

	const handleNext = useCallback(() => {
		if (currentStep < steps.length - 1) {
			setCurrentStep(currentStep + 1);
		}
	}, [currentStep, steps.length]);

	const handleBack = useCallback(() => {
		if (currentStep > 0) {
			setCurrentStep(currentStep - 1);
		}
	}, [currentStep]);

	const handleTemplateSelect = useCallback((template: any) => {
		setSelectedTemplate(template);
		setCustomRules(template.rules || []);
	}, []);

	const handleFilesSelect = useCallback((files: any[]) => {
		setSelectedFiles(files);
	}, []);

	const handleRulesChange = useCallback((rules: any[]) => {
		setCustomRules(rules);
	}, []);

	const handleChangesGenerated = useCallback((changes: any[]) => {
		setProposedChanges(changes);
	}, []);

	return (
		<div style={{
			display: 'flex',
			flexDirection: 'column',
			height: '100%',
			width: '100%',
			backgroundColor: 'var(--vscode-editor-background)',
			color: 'var(--vscode-editor-foreground)',
		}}>
			{/* Header */}
			<div style={{
				padding: '16px 24px',
				borderBottom: '1px solid var(--vscode-panel-border)',
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
			}}>
				<h2 style={{
					margin: 0,
					fontSize: '18px',
					fontWeight: 600,
				}}>
					File Organizer Dashboard
				</h2>
				<div style={{
					display: 'flex',
					gap: '8px',
				}}>
					<button
						style={{
							background: 'transparent',
							border: 'none',
							color: 'var(--vscode-foreground)',
							cursor: 'pointer',
							padding: '4px 8px',
						}}
						title="Help"
					>
						?
					</button>
				</div>
			</div>

			{/* Progress Indicator */}
			<div style={{
				padding: '24px',
				borderBottom: '1px solid var(--vscode-panel-border)',
			}}>
				<div style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					position: 'relative',
				}}>
					{steps.map((step, index) => (
						<div
							key={index}
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								flex: 1,
								position: 'relative',
							}}
						>
							<div style={{
								width: '32px',
								height: '32px',
								borderRadius: '50%',
								backgroundColor: index <= currentStep
									? 'var(--vscode-button-background)'
									: 'var(--vscode-input-background)',
								color: index <= currentStep
									? 'var(--vscode-button-foreground)'
									: 'var(--vscode-descriptionForeground)',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontWeight: 600,
								marginBottom: '8px',
								border: index === currentStep
									? '2px solid var(--vscode-focusBorder)'
									: 'none',
							}}>
								{index + 1}
							</div>
							<div style={{
								fontSize: '12px',
								color: index <= currentStep
									? 'var(--vscode-foreground)'
									: 'var(--vscode-descriptionForeground)',
							}}>
								{step}
							</div>
							{index < steps.length - 1 && (
								<div style={{
									position: 'absolute',
									top: '16px',
									left: '50%',
									right: '-50%',
									height: '2px',
									backgroundColor: index < currentStep
										? 'var(--vscode-button-background)'
										: 'var(--vscode-input-background)',
								}} />
							)}
						</div>
					))}
				</div>
			</div>

			{/* Step Content */}
			<div style={{
				flex: 1,
				overflow: 'auto',
				padding: '24px',
			}}>
				{currentStep === 0 && (
					<TemplateSelector
						accessor={accessor}
						selectedTemplate={selectedTemplate}
						selectedFiles={selectedFiles}
						onTemplateSelect={handleTemplateSelect}
						onFilesSelect={handleFilesSelect}
					/>
				)}
				{currentStep === 1 && (
					<RuleBuilder
						accessor={accessor}
						rules={customRules}
						selectedFiles={selectedFiles}
						onRulesChange={handleRulesChange}
					/>
				)}
				{currentStep === 2 && (
					<ReviewChanges
						accessor={accessor}
						files={selectedFiles}
						rules={customRules}
						proposedChanges={proposedChanges}
						onChangesGenerated={handleChangesGenerated}
					/>
				)}
			</div>

			{/* Footer Navigation */}
			<div style={{
				padding: '16px 24px',
				borderTop: '1px solid var(--vscode-panel-border)',
				display: 'flex',
				justifyContent: 'space-between',
			}}>
				<button
					onClick={handleBack}
					disabled={currentStep === 0}
					style={{
						padding: '8px 16px',
						backgroundColor: 'var(--vscode-button-secondaryBackground)',
						color: 'var(--vscode-button-secondaryForeground)',
						border: 'none',
						borderRadius: '2px',
						cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
						opacity: currentStep === 0 ? 0.5 : 1,
					}}
				>
					Back
				</button>
				<button
					onClick={handleNext}
					disabled={
						(currentStep === 0 && (!selectedTemplate || selectedFiles.length === 0)) ||
						(currentStep === steps.length - 1)
					}
					style={{
						padding: '8px 16px',
						backgroundColor: 'var(--vscode-button-background)',
						color: 'var(--vscode-button-foreground)',
						border: 'none',
						borderRadius: '2px',
						cursor: 'pointer',
						opacity: (currentStep === 0 && (!selectedTemplate || selectedFiles.length === 0)) ? 0.5 : 1,
					}}
				>
					{currentStep === steps.length - 1 ? 'Process Files' : 'Next'}
				</button>
			</div>
		</div>
	);
};

