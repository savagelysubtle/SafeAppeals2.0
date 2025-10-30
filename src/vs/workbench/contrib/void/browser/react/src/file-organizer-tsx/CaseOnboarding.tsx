/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useCallback } from 'react';

interface CaseOnboardingProps {
	onComplete: (caseConfig: any) => void;
	onSkip: () => void;
}

export const CaseOnboarding: React.FC<CaseOnboardingProps> = ({
	onComplete,
	onSkip
}) => {
	const [step, setStep] = useState(0);

	// Basic Info
	const [caseNumber, setCaseNumber] = useState('');
	const [claimantName, setClaimantName] = useState('');
	const [injuryDate, setInjuryDate] = useState('');
	const [caseType, setCaseType] = useState('Workers Compensation');
	const [description, setDescription] = useState('');

	// Claimant Side
	const [claimantLawyers, setClaimantLawyers] = useState('');
	const [treatingDoctors, setTreatingDoctors] = useState('');

	// Employer/Defense Side
	const [employerName, setEmployerName] = useState('');
	const [defenseLawyers, setDefenseLawyers] = useState('');
	const [imeDoctors, setImeDoctors] = useState('');

	// WCB
	const [adjudicators, setAdjudicators] = useState('');
	const [wcbReferences, setWcbReferences] = useState('');

	// Keywords
	const [yourSideKeywords, setYourSideKeywords] = useState('claimant, treating, personal');
	const [theirSideKeywords, setTheirSideKeywords] = useState('employer, wcb, ime, defense');

	const handleNext = useCallback(() => {
		if (step < 3) {
			setStep(step + 1);
		} else {
			// Generate final config
			const config = {
				version: '1.0',
				caseInfo: {
					caseNumber: caseNumber || undefined,
					claimantName: claimantName || undefined,
					injuryDate: injuryDate || undefined,
					caseType,
					description: description || undefined,
					parties: {
						claimant: {
							name: claimantName || 'Claimant',
							lawyers: claimantLawyers ? claimantLawyers.split(',').map(s => s.trim()).filter(Boolean) : [],
							doctors: treatingDoctors ? treatingDoctors.split(',').map(s => s.trim()).filter(Boolean) : []
						},
						employer: employerName ? {
							name: employerName,
							lawyers: defenseLawyers ? defenseLawyers.split(',').map(s => s.trim()).filter(Boolean) : [],
							doctors: imeDoctors ? imeDoctors.split(',').map(s => s.trim()).filter(Boolean) : []
						} : undefined,
						wcb: (adjudicators || wcbReferences) ? {
							adjudicators: adjudicators ? adjudicators.split(',').map(s => s.trim()).filter(Boolean) : [],
							references: wcbReferences ? wcbReferences.split(',').map(s => s.trim()).filter(Boolean) : []
						} : undefined
					},
					keywords: {
						yourSide: yourSideKeywords.split(',').map(s => s.trim()).filter(Boolean),
						theirSide: theirSideKeywords.split(',').map(s => s.trim()).filter(Boolean),
						medical: ['medical', 'doctor', 'physician', 'diagnosis', 'treatment', 'mri', 'xray'],
						legal: ['legal', 'court', 'decision', 'appeal', 'ruling', 'judgment'],
						evidence: ['evidence', 'study', 'research', 'expert', 'report']
					}
				},
				organizationSettings: {
					selectedTemplate: 'workers-comp-full',
					preserveOriginalNames: true,
					createBackup: true,
					targetFolder: './organized'
				},
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			onComplete(config);
		}
	}, [step, caseNumber, claimantName, injuryDate, caseType, description, claimantLawyers, treatingDoctors, employerName, defenseLawyers, imeDoctors, adjudicators, wcbReferences, yourSideKeywords, theirSideKeywords, onComplete]);

	const handleBack = useCallback(() => {
		if (step > 0) {
			setStep(step - 1);
		}
	}, [step]);

	const renderStep = () => {
		switch (step) {
			case 0:
				return (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
						<h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
							📋 Basic Case Information
						</h3>
						<p style={{ margin: 0, fontSize: '13px', color: 'var(--vscode-descriptionForeground)' }}>
							Let's set up your case. This information will help organize your files and provide context to the AI.
						</p>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								Case Number (Optional)
							</label>
							<input
								type="text"
								value={caseNumber}
								onChange={(e) => setCaseNumber(e.target.value)}
								placeholder="e.g., 39573881"
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)',
									borderRadius: '4px',
									fontSize: '13px'
								}}
							/>
						</div>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								Claimant Name *
							</label>
							<input
								type="text"
								value={claimantName}
								onChange={(e) => setClaimantName(e.target.value)}
								placeholder="e.g., John Smith"
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)',
									borderRadius: '4px',
									fontSize: '13px'
								}}
							/>
						</div>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								Injury Date (Optional)
							</label>
							<input
								type="date"
								value={injuryDate}
								onChange={(e) => setInjuryDate(e.target.value)}
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)',
									borderRadius: '4px',
									fontSize: '13px'
								}}
							/>
						</div>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								Case Type
							</label>
							<select
								value={caseType}
								onChange={(e) => setCaseType(e.target.value)}
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-dropdown-background)',
									color: 'var(--vscode-dropdown-foreground)',
									border: '1px solid var(--vscode-dropdown-border)',
									borderRadius: '4px',
									fontSize: '13px'
								}}
							>
								<option value="Workers Compensation">Workers Compensation</option>
								<option value="Personal Injury">Personal Injury</option>
								<option value="Disability Claim">Disability Claim</option>
								<option value="Employment Dispute">Employment Dispute</option>
								<option value="Other">Other</option>
							</select>
						</div>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								Case Description (Optional)
							</label>
							<textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Brief description of your case..."
								rows={3}
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)',
									borderRadius: '4px',
									fontSize: '13px',
									resize: 'vertical'
								}}
							/>
						</div>
					</div>
				);

			case 1:
				return (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
						<h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
							👤 Your Side - Claimant Team
						</h3>
						<p style={{ margin: 0, fontSize: '13px', color: 'var(--vscode-descriptionForeground)' }}>
							Who is representing and treating the claimant?
						</p>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								Your Lawyers (comma-separated)
							</label>
							<input
								type="text"
								value={claimantLawyers}
								onChange={(e) => setClaimantLawyers(e.target.value)}
								placeholder="e.g., John Smith, Jane Doe"
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)',
									borderRadius: '4px',
									fontSize: '13px'
								}}
							/>
						</div>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								Treating Physicians (comma-separated)
							</label>
							<input
								type="text"
								value={treatingDoctors}
								onChange={(e) => setTreatingDoctors(e.target.value)}
								placeholder="e.g., Dr. Smith, Dr. Johnson"
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)',
									borderRadius: '4px',
									fontSize: '13px'
								}}
							/>
						</div>
					</div>
				);

			case 2:
				return (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
						<h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
							🏢 Their Side - Employer/Defense Team
						</h3>
						<p style={{ margin: 0, fontSize: '13px', color: 'var(--vscode-descriptionForeground)' }}>
							Who is on the employer or defense side?
						</p>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								Employer Name
							</label>
							<input
								type="text"
								value={employerName}
								onChange={(e) => setEmployerName(e.target.value)}
								placeholder="e.g., ABC Corporation"
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)',
									borderRadius: '4px',
									fontSize: '13px'
								}}
							/>
						</div>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								Defense Lawyers (comma-separated)
							</label>
							<input
								type="text"
								value={defenseLawyers}
								onChange={(e) => setDefenseLawyers(e.target.value)}
								placeholder="e.g., Kotze, Defense Attorney"
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)',
									borderRadius: '4px',
									fontSize: '13px'
								}}
							/>
						</div>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								IME Doctors (comma-separated)
							</label>
							<input
								type="text"
								value={imeDoctors}
								onChange={(e) => setImeDoctors(e.target.value)}
								placeholder="e.g., Dr. IME Doctor"
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)',
									borderRadius: '4px',
									fontSize: '13px'
								}}
							/>
						</div>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								WCB Adjudicators (comma-separated)
							</label>
							<input
								type="text"
								value={adjudicators}
								onChange={(e) => setAdjudicators(e.target.value)}
								placeholder="e.g., Heather, Review Officer"
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)',
									borderRadius: '4px',
									fontSize: '13px'
								}}
							/>
						</div>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								WCB Reference Numbers (comma-separated)
							</label>
							<input
								type="text"
								value={wcbReferences}
								onChange={(e) => setWcbReferences(e.target.value)}
								placeholder="e.g., R0331814"
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)',
									borderRadius: '4px',
									fontSize: '13px'
								}}
							/>
						</div>
					</div>
				);

			case 3:
				return (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
						<h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
							🔑 Classification Keywords
						</h3>
						<p style={{ margin: 0, fontSize: '13px', color: 'var(--vscode-descriptionForeground)' }}>
							These keywords will help automatically classify your files. The AI will use these for context too.
						</p>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								Your Side Keywords (comma-separated)
							</label>
							<input
								type="text"
								value={yourSideKeywords}
								onChange={(e) => setYourSideKeywords(e.target.value)}
								placeholder="e.g., claimant, treating, personal"
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)',
									borderRadius: '4px',
									fontSize: '13px'
								}}
							/>
							<div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
								Add names from step 2 as keywords (e.g., {claimantLawyers || treatingDoctors ? 'your lawyers/doctors names' : 'lawyer names, doctor names'})
							</div>
						</div>

						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 500 }}>
								Their Side Keywords (comma-separated)
							</label>
							<input
								type="text"
								value={theirSideKeywords}
								onChange={(e) => setTheirSideKeywords(e.target.value)}
								placeholder="e.g., employer, wcb, ime, defense"
								style={{
									width: '100%',
									padding: '8px',
									backgroundColor: 'var(--vscode-input-background)',
									color: 'var(--vscode-input-foreground)',
									border: '1px solid var(--vscode-input-border)',
									borderRadius: '4px',
									fontSize: '13px'
								}}
							/>
							<div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
								Add names from step 3 as keywords (e.g., {employerName || defenseLawyers || imeDoctors ? 'employer, defense names' : 'employer name, defense lawyers'})
							</div>
						</div>

						<div style={{
							padding: '12px',
							backgroundColor: 'var(--vscode-inputValidation-infoBackground)',
							border: '1px solid var(--vscode-inputValidation-infoBorder)',
							borderRadius: '4px',
							fontSize: '12px'
						}}>
							<strong>💡 Tip:</strong> Include all variations of names and entities. For example: "Kotze" if you have defense lawyer named Kotze, "Heather" if that's the WCB adjudicator's name.
						</div>
					</div>
				);

			default:
				return null;
		}
	};

	const canProceed = () => {
		if (step === 0) {
			return claimantName.trim().length > 0;
		}
		return true;
	};

	return (
		<div style={{
			display: 'flex',
			flexDirection: 'column',
			gap: '24px',
			maxWidth: '600px',
			margin: '0 auto'
		}}>
			{/* Progress indicator */}
			<div style={{
				display: 'flex',
				gap: '8px',
				justifyContent: 'center'
			}}>
				{[0, 1, 2, 3].map((s) => (
					<div
						key={s}
						style={{
							flex: 1,
							height: '4px',
							backgroundColor: s <= step
								? 'var(--vscode-progressBar-background)'
								: 'var(--vscode-panel-border)',
							borderRadius: '2px',
							transition: 'background-color 0.3s'
						}}
					/>
				))}
			</div>

			<div style={{
				fontSize: '12px',
				textAlign: 'center',
				color: 'var(--vscode-descriptionForeground)'
			}}>
				Step {step + 1} of 4
			</div>

			{/* Step content */}
			{renderStep()}

			{/* Navigation */}
			<div style={{
				display: 'flex',
				justifyContent: 'space-between',
				gap: '12px',
				paddingTop: '16px',
				borderTop: '1px solid var(--vscode-panel-border)'
			}}>
				<div style={{ display: 'flex', gap: '8px' }}>
					{step > 0 && (
						<button
							onClick={handleBack}
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
							← Back
						</button>
					)}
					{step === 0 && (
						<button
							onClick={onSkip}
							style={{
								padding: '8px 16px',
								backgroundColor: 'transparent',
								color: 'var(--vscode-descriptionForeground)',
								border: '1px solid var(--vscode-panel-border)',
								borderRadius: '4px',
								cursor: 'pointer',
								fontSize: '13px'
							}}
						>
							Skip Setup
						</button>
					)}
				</div>
				<button
					onClick={handleNext}
					disabled={!canProceed()}
					style={{
						padding: '8px 24px',
						backgroundColor: canProceed()
							? 'var(--vscode-button-background)'
							: 'var(--vscode-button-secondaryBackground)',
						color: canProceed()
							? 'var(--vscode-button-foreground)'
							: 'var(--vscode-button-secondaryForeground)',
						border: 'none',
						borderRadius: '4px',
						cursor: canProceed() ? 'pointer' : 'not-allowed',
						fontSize: '13px',
						fontWeight: 500,
						opacity: canProceed() ? 1 : 0.5
					}}
				>
					{step === 3 ? 'Complete Setup' : 'Next →'}
				</button>
			</div>
		</div>
	);
};

