/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useState } from "react";
import "./styles.css";

interface CaseOnboardingProps {
	onComplete: (caseConfig: any) => void;
	onSkip: () => void;
}

export const CaseOnboarding: React.FC<CaseOnboardingProps> = ({
	onComplete,
	onSkip,
}) => {
	const [step, setStep] = useState(0);

	// Basic Info
	const [caseNumber, setCaseNumber] = useState("");
	const [claimantName, setClaimantName] = useState("");
	const [injuryDate, setInjuryDate] = useState("");
	const [caseType, setCaseType] = useState("Workers Compensation");
	const [description, setDescription] = useState("");

	// Claimant Side
	const [claimantLawyers, setClaimantLawyers] = useState("");
	const [treatingDoctors, setTreatingDoctors] = useState("");

	// Employer/Defense Side
	const [employerName, setEmployerName] = useState("");
	const [defenseLawyers, setDefenseLawyers] = useState("");
	const [imeDoctors, setImeDoctors] = useState("");

	// WCB
	const [adjudicators, setAdjudicators] = useState("");
	const [wcbReferences, setWcbReferences] = useState("");

	// Keywords
	const [yourSideKeywords, setYourSideKeywords] = useState(
		"claimant, treating, personal"
	);
	const [theirSideKeywords, setTheirSideKeywords] = useState(
		"employer, wcb, ime, defense"
	);

	const handleNext = useCallback(() => {
		if (step < 3) {
			setStep(step + 1);
		} else {
			// Generate final config
			const config = {
				version: "1.0",
				caseInfo: {
					caseNumber: caseNumber || undefined,
					claimantName: claimantName || undefined,
					injuryDate: injuryDate || undefined,
					caseType,
					description: description || undefined,
					parties: {
						claimant: {
							name: claimantName || "Claimant",
							lawyers: claimantLawyers
								? claimantLawyers
										.split(",")
										.map((s) => s.trim())
										.filter(Boolean)
								: [],
							doctors: treatingDoctors
								? treatingDoctors
										.split(",")
										.map((s) => s.trim())
										.filter(Boolean)
								: [],
						},
						employer: employerName
							? {
									name: employerName,
									lawyers: defenseLawyers
										? defenseLawyers
												.split(",")
												.map((s) => s.trim())
												.filter(Boolean)
										: [],
									doctors: imeDoctors
										? imeDoctors
												.split(",")
												.map((s) => s.trim())
												.filter(Boolean)
										: [],
							  }
							: undefined,
						wcb:
							adjudicators || wcbReferences
								? {
										adjudicators: adjudicators
											? adjudicators
													.split(",")
													.map((s) => s.trim())
													.filter(Boolean)
											: [],
										references: wcbReferences
											? wcbReferences
													.split(",")
													.map((s) => s.trim())
													.filter(Boolean)
											: [],
								  }
								: undefined,
					},
					keywords: {
						yourSide: yourSideKeywords
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean),
						theirSide: theirSideKeywords
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean),
						medical: [
							"medical",
							"doctor",
							"physician",
							"diagnosis",
							"treatment",
							"mri",
							"xray",
						],
						legal: [
							"legal",
							"court",
							"decision",
							"appeal",
							"ruling",
							"judgment",
						],
						evidence: ["evidence", "study", "research", "expert", "report"],
					},
				},
				organizationSettings: {
					selectedTemplate: "workers-comp-full",
					preserveOriginalNames: true,
					createBackup: true,
					targetFolder: "./organized",
				},
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};

			onComplete(config);
		}
	}, [
		step,
		caseNumber,
		claimantName,
		injuryDate,
		caseType,
		description,
		claimantLawyers,
		treatingDoctors,
		employerName,
		defenseLawyers,
		imeDoctors,
		adjudicators,
		wcbReferences,
		yourSideKeywords,
		theirSideKeywords,
		onComplete,
	]);

	const handleBack = useCallback(() => {
		if (step > 0) {
			setStep(step - 1);
		}
	}, [step]);

	const renderStep = () => {
		switch (step) {
			case 0:
				return (
					<div className="step-container">
						<h3 className="step-title">📋 Basic Case Information</h3>
						<p className="step-description">
							Let's set up your case. This information will help organize your
							files and provide context to the AI.
						</p>

						<div className="form-group">
							<label className="form-label">Case Number (Optional)</label>
							<input
								type="text"
								className="form-input"
								value={caseNumber}
								onChange={(e) => setCaseNumber(e.target.value)}
								placeholder="e.g., 39573881"
							/>
						</div>

						<div className="form-group">
							<label className="form-label">Claimant Name *</label>
							<input
								type="text"
								className="form-input"
								value={claimantName}
								onChange={(e) => setClaimantName(e.target.value)}
								placeholder="e.g., John Smith"
							/>
						</div>

						<div className="form-group">
							<label className="form-label">Injury Date (Optional)</label>
							<input
								type="date"
								className="form-input"
								value={injuryDate}
								onChange={(e) => setInjuryDate(e.target.value)}
							/>
						</div>

						<div className="form-group">
							<label className="form-label">Case Type</label>
							<select
								className="form-select"
								value={caseType}
								onChange={(e) => setCaseType(e.target.value)}
							>
								<option value="Workers Compensation">
									Workers Compensation
								</option>
								<option value="Personal Injury">Personal Injury</option>
								<option value="Disability Claim">Disability Claim</option>
								<option value="Employment Dispute">Employment Dispute</option>
								<option value="Other">Other</option>
							</select>
						</div>

						<div className="form-group">
							<label className="form-label">Case Description (Optional)</label>
							<textarea
								className="form-textarea"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Brief description of your case..."
								rows={3}
							/>
						</div>
					</div>
				);

			case 1:
				return (
					<div className="step-container">
						<h3 className="step-title">👤 Your Side - Claimant Team</h3>
						<p className="step-description">
							Who is representing and treating the claimant?
						</p>

						<div className="form-group">
							<label className="form-label">
								Your Lawyers (comma-separated)
							</label>
							<input
								type="text"
								className="form-input"
								value={claimantLawyers}
								onChange={(e) => setClaimantLawyers(e.target.value)}
								placeholder="e.g., John Smith, Jane Doe"
							/>
						</div>

						<div className="form-group">
							<label className="form-label">
								Treating Physicians (comma-separated)
							</label>
							<input
								type="text"
								className="form-input"
								value={treatingDoctors}
								onChange={(e) => setTreatingDoctors(e.target.value)}
								placeholder="e.g., Dr. Smith, Dr. Johnson"
							/>
						</div>
					</div>
				);

			case 2:
				return (
					<div className="step-container">
						<h3 className="step-title">
							🏢 Their Side - Employer/Defense Team
						</h3>
						<p className="step-description">
							Who is on the employer or defense side?
						</p>

						<div className="form-group">
							<label className="form-label">Employer Name</label>
							<input
								type="text"
								className="form-input"
								value={employerName}
								onChange={(e) => setEmployerName(e.target.value)}
								placeholder="e.g., ABC Corporation"
							/>
						</div>

						<div className="form-group">
							<label className="form-label">
								Defense Lawyers (comma-separated)
							</label>
							<input
								type="text"
								className="form-input"
								value={defenseLawyers}
								onChange={(e) => setDefenseLawyers(e.target.value)}
								placeholder="e.g., Kotze, Defense Attorney"
							/>
						</div>

						<div className="form-group">
							<label className="form-label">
								IME Doctors (comma-separated)
							</label>
							<input
								type="text"
								className="form-input"
								value={imeDoctors}
								onChange={(e) => setImeDoctors(e.target.value)}
								placeholder="e.g., Dr. IME Doctor"
							/>
						</div>

						<div className="form-group">
							<label className="form-label">
								WCB Adjudicators (comma-separated)
							</label>
							<input
								type="text"
								className="form-input"
								value={adjudicators}
								onChange={(e) => setAdjudicators(e.target.value)}
								placeholder="e.g., Heather, Review Officer"
							/>
						</div>

						<div className="form-group">
							<label className="form-label">
								WCB Reference Numbers (comma-separated)
							</label>
							<input
								type="text"
								className="form-input"
								value={wcbReferences}
								onChange={(e) => setWcbReferences(e.target.value)}
								placeholder="e.g., R0331814"
							/>
						</div>
					</div>
				);

			case 3:
				return (
					<div className="step-container">
						<h3 className="step-title">🔑 Classification Keywords</h3>
						<p className="step-description">
							These keywords will help automatically classify your files. The AI
							will use these for context too.
						</p>

						<div className="form-group">
							<label className="form-label">
								Your Side Keywords (comma-separated)
							</label>
							<input
								type="text"
								className="form-input"
								value={yourSideKeywords}
								onChange={(e) => setYourSideKeywords(e.target.value)}
								placeholder="e.g., claimant, treating, personal"
							/>
							<div className="form-hint">
								Add names from step 2 as keywords (e.g.,{" "}
								{claimantLawyers || treatingDoctors
									? "your lawyers/doctors names"
									: "lawyer names, doctor names"}
								)
							</div>
						</div>

						<div className="form-group">
							<label className="form-label">
								Their Side Keywords (comma-separated)
							</label>
							<input
								type="text"
								className="form-input"
								value={theirSideKeywords}
								onChange={(e) => setTheirSideKeywords(e.target.value)}
								placeholder="e.g., employer, wcb, ime, defense"
							/>
							<div className="form-hint">
								Add names from step 3 as keywords (e.g.,{" "}
								{employerName || defenseLawyers || imeDoctors
									? "employer, defense names"
									: "employer name, defense lawyers"}
								)
							</div>
						</div>

						<div className="info-box">
							<strong>💡 Tip:</strong> Include all variations of names and
							entities. For example: "Kotze" if you have defense lawyer named
							Kotze, "Heather" if that's the WCB adjudicator's name.
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
		<div
			className="onboarding-container"
			style={{
				maxWidth: "600px",
				margin: "0 auto",
				display: "flex",
				flexDirection: "column",
				gap: "24px",
			}}
		>
			{/* Progress indicator */}
			<div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
				{[0, 1, 2, 3].map((s) => (
					<div
						key={s}
						style={{
							flex: 1,
							height: "4px",
							backgroundColor:
								s <= step
									? "var(--vscode-progressBar-background)"
									: "var(--vscode-panel-border)",
							borderRadius: "2px",
							transition: "background-color 0.3s",
						}}
					/>
				))}
			</div>

			<div
				style={{
					fontSize: "12px",
					textAlign: "center",
					color: "var(--vscode-descriptionForeground)",
				}}
			>
				Step {step + 1} of 4
			</div>

			{/* Step content */}
			{renderStep()}

			{/* Navigation */}
			<div
				className="footer-nav"
				style={{
					marginTop: "auto",
					borderTop: "1px solid var(--vscode-panel-border)",
					paddingTop: "16px",
				}}
			>
				<div style={{ display: "flex", gap: "8px" }}>
					{step > 0 && (
						<button onClick={handleBack} className="btn btn-secondary">
							← Back
						</button>
					)}
					{step === 0 && (
						<button
							onClick={onSkip}
							className="btn"
							style={{
								backgroundColor: "transparent",
								color: "var(--vscode-descriptionForeground)",
								border: "1px solid var(--vscode-panel-border)",
							}}
						>
							Skip Setup
						</button>
					)}
				</div>
				<button
					onClick={handleNext}
					disabled={!canProceed()}
					className={`btn ${canProceed() ? "btn-primary" : "btn-secondary"}`}
				>
					{step === 3 ? "Complete Setup" : "Next →"}
				</button>
			</div>
		</div>
	);
};
