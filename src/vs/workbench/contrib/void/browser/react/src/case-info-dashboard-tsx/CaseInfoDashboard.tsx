/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAccessor } from "../util/services.js";

export const CaseInfoDashboard: React.FC = () => {
	const accessor = useAccessor();
	const [caseConfig, setCaseConfig] = useState<any | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [loading, setLoading] = useState(true);

	// Form state
	const [caseNumber, setCaseNumber] = useState("");
	const [claimantName, setClaimantName] = useState("");
	const [injuryDate, setInjuryDate] = useState("");
	const [caseType, setCaseType] = useState("Workers Compensation");
	const [description, setDescription] = useState("");

	// Parties
	const [claimantLawyers, setClaimantLawyers] = useState("");
	const [treatingDoctors, setTreatingDoctors] = useState("");
	const [advocate, setAdvocate] = useState("");
	const [employerName, setEmployerName] = useState("");
	const [defenseLawyers, setDefenseLawyers] = useState("");
	const [imeDoctors, setImeDoctors] = useState("");
	const [caseManager, setCaseManager] = useState("");
	const [reviewOfficer, setReviewOfficer] = useState("");
	const [employerRepresentative, setEmployerRepresentative] = useState("");
	const [adjudicators, setAdjudicators] = useState("");
	const [wcbReferences, setWcbReferences] = useState("");

	// Keywords
	const [yourSideKeywords, setYourSideKeywords] = useState(
		"claimant, treating, personal"
	);
	const [theirSideKeywords, setTheirSideKeywords] = useState(
		"employer, wcb, ime, defense"
	);

	const fileOrganizerService = useMemo(() => {
		try {
			return accessor.get("IFileOrganizerService");
		} catch (error) {
			console.error(
				"[CaseInfoDashboard] Failed to get FileOrganizerService:",
				error
			);
			return null;
		}
	}, [accessor]);

	const workspaceContextService = useMemo(() => {
		try {
			return accessor.get("IWorkspaceContextService");
		} catch (error) {
			console.error(
				"[CaseInfoDashboard] Failed to get IWorkspaceContextService:",
				error
			);
			return null;
		}
	}, [accessor]);

	// Load existing case config
	useEffect(() => {
		const loadCaseConfig = async () => {
			if (!fileOrganizerService || !workspaceContextService) return;

			try {
				setLoading(true);
				const workspace = workspaceContextService.getWorkspace();
				if (!workspace.folders || workspace.folders.length === 0) {
					console.warn("[CaseInfoDashboard] No workspace folder open");
					setIsEditing(true);
					setLoading(false);
					return;
				}
				const workspaceFolder = workspace.folders[0].uri;
				const exists = await fileOrganizerService.caseConfigExists(
					workspaceFolder
				);

				if (exists) {
					const config = await fileOrganizerService.loadCaseConfig(
						workspaceFolder
					);
					if (config) {
						setCaseConfig(config);
						populateFormFromConfig(config);
					}
				} else {
					setIsEditing(true); // Start in edit mode if no config
				}
			} catch (error) {
				console.error("[CaseInfoDashboard] Error loading case config:", error);
			} finally {
				setLoading(false);
			}
		};

		loadCaseConfig();
	}, [fileOrganizerService, workspaceContextService]);

	const populateFormFromConfig = useCallback((config: any) => {
		setCaseNumber(config.caseInfo.caseNumber || "");
		setClaimantName(config.caseInfo.claimantName || "");
		setInjuryDate(config.caseInfo.injuryDate || "");
		setCaseType(config.caseInfo.caseType || "Workers Compensation");
		setDescription(config.caseInfo.description || "");

		setClaimantLawyers(
			config.caseInfo.parties?.claimant?.lawyers?.join(", ") || ""
		);
		setTreatingDoctors(
			config.caseInfo.parties?.claimant?.doctors?.join(", ") || ""
		);
		setAdvocate(config.caseInfo.parties?.claimant?.advocate?.join(", ") || "");
		setEmployerName(config.caseInfo.parties?.employer?.name || "");
		setDefenseLawyers(
			config.caseInfo.parties?.employer?.lawyers?.join(", ") || ""
		);
		setImeDoctors(config.caseInfo.parties?.employer?.doctors?.join(", ") || "");
		setCaseManager(
			config.caseInfo.parties?.employer?.caseManager?.join(", ") || ""
		);
		setReviewOfficer(
			config.caseInfo.parties?.employer?.reviewOfficer?.join(", ") || ""
		);
		setEmployerRepresentative(
			config.caseInfo.parties?.employer?.employerRepresentative?.join(", ") ||
				""
		);
		setAdjudicators(
			config.caseInfo.parties?.wcb?.adjudicators?.join(", ") || ""
		);
		setWcbReferences(
			config.caseInfo.parties?.wcb?.references?.join(", ") || ""
		);

		setYourSideKeywords(
			config.caseInfo.keywords?.yourSide?.join(", ") ||
				"claimant, treating, personal"
		);
		setTheirSideKeywords(
			config.caseInfo.keywords?.theirSide?.join(", ") ||
				"employer, wcb, ime, defense"
		);
	}, []);

	const handleSave = useCallback(async () => {
		if (!fileOrganizerService || !workspaceContextService) return;

		// Check for workspace folder
		const workspace = workspaceContextService.getWorkspace();
		if (!workspace.folders || workspace.folders.length === 0) {
			alert(
				"❌ Error: No workspace folder is open.\n\nPlease open a folder first to save case configuration."
			);
			return;
		}
		const workspaceFolder = workspace.folders[0].uri;

		// Process names for keyword arrays
		const advocateNames = advocate
			? advocate
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: [];
		const caseManagerNames = caseManager
			? caseManager
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: [];
		const reviewOfficerNames = reviewOfficer
			? reviewOfficer
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: [];
		const employerRepNames = employerRepresentative
			? employerRepresentative
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: [];

		const config: any = {
			version: "1.0" as const,
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
						advocate: advocateNames.length > 0 ? advocateNames : undefined,
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
								caseManager:
									caseManagerNames.length > 0 ? caseManagerNames : undefined,
								reviewOfficer:
									reviewOfficerNames.length > 0
										? reviewOfficerNames
										: undefined,
								employerRepresentative:
									employerRepNames.length > 0 ? employerRepNames : undefined,
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
					yourSide: [
						...new Set([
							...yourSideKeywords
								.split(",")
								.map((s) => s.trim())
								.filter(Boolean),
							...advocateNames,
						]),
					],
					theirSide: [
						...new Set([
							...theirSideKeywords
								.split(",")
								.map((s) => s.trim())
								.filter(Boolean),
							...caseManagerNames,
							...reviewOfficerNames,
							...employerRepNames,
						]),
					],
					medical: [
						"medical",
						"doctor",
						"physician",
						"diagnosis",
						"treatment",
						"mri",
						"xray",
					],
					legal: ["legal", "court", "decision", "appeal", "ruling", "judgment"],
					evidence: ["evidence", "study", "research", "expert", "report"],
				},
			},
			organizationSettings: {
				selectedTemplate: "workers-comp-full",
				preserveOriginalNames: true,
				createBackup: true,
				targetFolder: "./organized",
			},
			createdAt: caseConfig?.createdAt || new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		try {
			await fileOrganizerService.saveCaseConfig(workspaceFolder, config);
			setCaseConfig(config);
			setIsEditing(false);
			alert(
				"✅ Case configuration saved!\n\nFile: .fileorg.json in workspace root\n\nThis case info will be available to the AI when you chat."
			);
		} catch (error) {
			console.error("[CaseInfoDashboard] Error saving case config:", error);
			alert("❌ Error saving case configuration. Check console for details.");
		}
	}, [
		fileOrganizerService,
		workspaceContextService,
		caseNumber,
		claimantName,
		injuryDate,
		caseType,
		description,
		claimantLawyers,
		treatingDoctors,
		advocate,
		employerName,
		defenseLawyers,
		imeDoctors,
		caseManager,
		reviewOfficer,
		employerRepresentative,
		adjudicators,
		wcbReferences,
		yourSideKeywords,
		theirSideKeywords,
		caseConfig,
	]);

	if (loading) {
		return (
			<div
				style={{
					padding: "24px",
					textAlign: "center",
				}}
			>
				<div
					style={{
						fontSize: "14px",
						color: "var(--vscode-descriptionForeground)",
					}}
				>
					Loading case configuration...
				</div>
			</div>
		);
	}

	if (!isEditing && caseConfig) {
		// View mode
		return (
			<div
				className="void-scrollbar"
				style={{
					padding: "24px",
					maxWidth: "600px",
					height: "100%",
					overflowY: "auto",
					boxSizing: "border-box",
				}}
			>
				<div
					style={{
						marginBottom: "24px",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
						📋 Case Information
					</h2>
					<button
						onClick={() => setIsEditing(true)}
						style={{
							padding: "6px 12px",
							backgroundColor: "var(--vscode-button-background)",
							color: "var(--vscode-button-foreground)",
							border: "none",
							borderRadius: "4px",
							cursor: "pointer",
							fontSize: "13px",
						}}
					>
						✏️ Edit
					</button>
				</div>

				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "16px",
					}}
				>
					<div>
						<div
							style={{
								fontSize: "12px",
								color: "var(--vscode-descriptionForeground)",
								marginBottom: "4px",
							}}
						>
							Case Number
						</div>
						<div style={{ fontSize: "14px" }}>
							{caseConfig.caseInfo.caseNumber || "N/A"}
						</div>
					</div>

					<div>
						<div
							style={{
								fontSize: "12px",
								color: "var(--vscode-descriptionForeground)",
								marginBottom: "4px",
							}}
						>
							Claimant
						</div>
						<div style={{ fontSize: "14px", fontWeight: 500 }}>
							{caseConfig.caseInfo.claimantName || "N/A"}
						</div>
					</div>

					<div>
						<div
							style={{
								fontSize: "12px",
								color: "var(--vscode-descriptionForeground)",
								marginBottom: "4px",
							}}
						>
							Case Type
						</div>
						<div style={{ fontSize: "14px" }}>
							{caseConfig.caseInfo.caseType}
						</div>
					</div>

					{caseConfig.caseInfo.injuryDate && (
						<div>
							<div
								style={{
									fontSize: "12px",
									color: "var(--vscode-descriptionForeground)",
									marginBottom: "4px",
								}}
							>
								Injury Date
							</div>
							<div style={{ fontSize: "14px" }}>
								{caseConfig.caseInfo.injuryDate}
							</div>
						</div>
					)}

					{caseConfig.caseInfo.description && (
						<div>
							<div
								style={{
									fontSize: "12px",
									color: "var(--vscode-descriptionForeground)",
									marginBottom: "4px",
								}}
							>
								Description
							</div>
							<div style={{ fontSize: "14px" }}>
								{caseConfig.caseInfo.description}
							</div>
						</div>
					)}

					{caseConfig.caseInfo.parties?.claimant?.advocate?.length > 0 && (
						<div
							style={{
								borderTop: "1px solid var(--vscode-panel-border)",
								paddingTop: "16px",
								marginTop: "8px",
							}}
						>
							<div
								style={{
									fontSize: "14px",
									fontWeight: 600,
									marginBottom: "12px",
								}}
							>
								Your Side
							</div>
							<div>
								<div
									style={{
										fontSize: "12px",
										color: "var(--vscode-descriptionForeground)",
										marginBottom: "4px",
									}}
								>
									Advocate
								</div>
								<div style={{ fontSize: "14px" }}>
									{caseConfig.caseInfo.parties.claimant.advocate.join(", ")}
								</div>
							</div>
						</div>
					)}

					{caseConfig.caseInfo.parties?.employer && (
						<div
							style={{
								borderTop: "1px solid var(--vscode-panel-border)",
								paddingTop: "16px",
								marginTop: "8px",
							}}
						>
							<div
								style={{
									fontSize: "14px",
									fontWeight: 600,
									marginBottom: "12px",
								}}
							>
								Their Side
							</div>
							{caseConfig.caseInfo.parties.employer.name && (
								<div style={{ marginBottom: "12px" }}>
									<div
										style={{
											fontSize: "12px",
											color: "var(--vscode-descriptionForeground)",
											marginBottom: "4px",
										}}
									>
										Employer
									</div>
									<div style={{ fontSize: "14px", fontWeight: 500 }}>
										{caseConfig.caseInfo.parties.employer.name}
									</div>
								</div>
							)}
							{caseConfig.caseInfo.parties.employer.caseManager?.length > 0 && (
								<div style={{ marginBottom: "12px" }}>
									<div
										style={{
											fontSize: "12px",
											color: "var(--vscode-descriptionForeground)",
											marginBottom: "4px",
										}}
									>
										Case Manager
									</div>
									<div style={{ fontSize: "14px" }}>
										{caseConfig.caseInfo.parties.employer.caseManager.join(
											", "
										)}
									</div>
								</div>
							)}
							{caseConfig.caseInfo.parties.employer.reviewOfficer?.length >
								0 && (
								<div style={{ marginBottom: "12px" }}>
									<div
										style={{
											fontSize: "12px",
											color: "var(--vscode-descriptionForeground)",
											marginBottom: "4px",
										}}
									>
										Review Officer
									</div>
									<div style={{ fontSize: "14px" }}>
										{caseConfig.caseInfo.parties.employer.reviewOfficer.join(
											", "
										)}
									</div>
								</div>
							)}
							{caseConfig.caseInfo.parties.employer.employerRepresentative
								?.length > 0 && (
								<div>
									<div
										style={{
											fontSize: "12px",
											color: "var(--vscode-descriptionForeground)",
											marginBottom: "4px",
										}}
									>
										Employer Representative
									</div>
									<div style={{ fontSize: "14px" }}>
										{caseConfig.caseInfo.parties.employer.employerRepresentative.join(
											", "
										)}
									</div>
								</div>
							)}
						</div>
					)}

					<div
						style={{
							borderTop: "1px solid var(--vscode-panel-border)",
							paddingTop: "16px",
							marginTop: "8px",
						}}
					>
						<div
							style={{
								fontSize: "14px",
								fontWeight: 600,
								marginBottom: "12px",
							}}
						>
							Your Side Keywords
						</div>
						<div
							style={{
								fontSize: "13px",
								color: "var(--vscode-descriptionForeground)",
							}}
						>
							{caseConfig.caseInfo.keywords.yourSide.join(", ")}
						</div>
					</div>

					<div>
						<div
							style={{
								fontSize: "14px",
								fontWeight: 600,
								marginBottom: "12px",
							}}
						>
							Their Side Keywords
						</div>
						<div
							style={{
								fontSize: "13px",
								color: "var(--vscode-descriptionForeground)",
							}}
						>
							{caseConfig.caseInfo.keywords.theirSide.join(", ")}
						</div>
					</div>

					<div
						style={{
							marginTop: "16px",
							padding: "12px",
							backgroundColor: "var(--vscode-inputValidation-infoBackground)",
							border: "1px solid var(--vscode-inputValidation-infoBorder)",
							borderRadius: "4px",
							fontSize: "12px",
						}}
					>
						<strong>💡 Tip:</strong> This case information is automatically
						available to the AI when you chat (Ctrl+L), helping it understand
						the context of your case.
					</div>
				</div>
			</div>
		);
	}

	// Edit mode - simplified form
	return (
		<div
			className="void-scrollbar"
			style={{
				padding: "24px",
				maxWidth: "600px",
				height: "100%",
				overflowY: "auto",
				boxSizing: "border-box",
			}}
		>
			<div style={{ marginBottom: "24px" }}>
				<h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
					{caseConfig
						? "✏️ Edit Case Information"
						: "📋 Setup Case Information"}
				</h2>
				<p
					style={{
						margin: "8px 0 0 0",
						fontSize: "13px",
						color: "var(--vscode-descriptionForeground)",
					}}
				>
					This information will be saved to `.fileorg.json` and automatically
					provided to the AI.
				</p>

				{!caseConfig && (
					<div
						style={{
							marginTop: "16px",
							padding: "12px",
							backgroundColor: "var(--vscode-inputValidation-infoBackground)",
							border: "1px solid var(--vscode-inputValidation-infoBorder)",
							borderRadius: "4px",
							fontSize: "12px",
							lineHeight: "1.5",
						}}
					>
						<strong>🎯 What is this?</strong>
						<br />
						This helps the AI understand your case. By adding names and
						keywords, the AI can:
						<ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
							<li>Automatically tag and organize your files</li>
							<li>Understand context when you chat (Ctrl+L)</li>
							<li>Identify which side documents belong to</li>
						</ul>
						<div style={{ marginTop: "8px" }}>
							<strong>💡 Tip:</strong> Start with just the claimant name and
							case number. You can add more details later.
						</div>
					</div>
				)}
			</div>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "16px",
				}}
			>
				<div
					style={{
						padding: "12px",
						backgroundColor: "var(--vscode-editor-background)",
						border: "1px solid var(--vscode-panel-border)",
						borderRadius: "4px",
						marginBottom: "8px",
					}}
				>
					<div
						style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}
					>
						Basic Information
					</div>
					<div
						style={{
							fontSize: "11px",
							color: "var(--vscode-descriptionForeground)",
							lineHeight: "1.4",
						}}
					>
						Start here! These basic details help identify your case.
					</div>
				</div>

				<div>
					<label
						style={{
							display: "block",
							marginBottom: "4px",
							fontSize: "13px",
							fontWeight: 500,
						}}
					>
						Claimant Name{" "}
						<span style={{ color: "var(--vscode-errorForeground)" }}>*</span>
					</label>
					<input
						type="text"
						value={claimantName}
						onChange={(e) => setClaimantName(e.target.value)}
						placeholder="e.g., John Smith"
						style={{
							width: "100%",
							padding: "8px",
							backgroundColor: "var(--vscode-input-background)",
							color: "var(--vscode-input-foreground)",
							border: "1px solid var(--vscode-input-border)",
							borderRadius: "4px",
							fontSize: "13px",
						}}
					/>
					<div
						style={{
							marginTop: "4px",
							fontSize: "11px",
							color: "var(--vscode-descriptionForeground)",
						}}
					>
						The person filing the claim (you or your client)
					</div>
				</div>

				<div>
					<label
						style={{
							display: "block",
							marginBottom: "4px",
							fontSize: "13px",
							fontWeight: 500,
						}}
					>
						Case Number{" "}
						<span
							style={{
								fontSize: "11px",
								color: "var(--vscode-descriptionForeground)",
								fontWeight: "normal",
							}}
						>
							(optional)
						</span>
					</label>
					<input
						type="text"
						value={caseNumber}
						onChange={(e) => setCaseNumber(e.target.value)}
						placeholder="e.g., 39573881 or WCB-2024-12345"
						style={{
							width: "100%",
							padding: "8px",
							backgroundColor: "var(--vscode-input-background)",
							color: "var(--vscode-input-foreground)",
							border: "1px solid var(--vscode-input-border)",
							borderRadius: "4px",
							fontSize: "13px",
						}}
					/>
					<div
						style={{
							marginTop: "4px",
							fontSize: "11px",
							color: "var(--vscode-descriptionForeground)",
						}}
					>
						Your case or claim number from the board/insurer
					</div>
				</div>

				<div>
					<label
						style={{
							display: "block",
							marginBottom: "4px",
							fontSize: "13px",
							fontWeight: 500,
						}}
					>
						Case Type
					</label>
					<select
						value={caseType}
						onChange={(e) => setCaseType(e.target.value)}
						style={{
							width: "100%",
							padding: "8px",
							backgroundColor: "var(--vscode-dropdown-background)",
							color: "var(--vscode-dropdown-foreground)",
							border: "1px solid var(--vscode-dropdown-border)",
							borderRadius: "4px",
							fontSize: "13px",
						}}
					>
						<option value="Workers Compensation">Workers Compensation</option>
						<option value="Personal Injury">Personal Injury</option>
						<option value="Disability Claim">Disability Claim</option>
						<option value="Employment Dispute">Employment Dispute</option>
						<option value="Other">Other</option>
					</select>
					<div
						style={{
							marginTop: "4px",
							fontSize: "11px",
							color: "var(--vscode-descriptionForeground)",
						}}
					>
						The type of legal case you're working on
					</div>
				</div>

				<div
					style={{
						borderTop: "1px solid var(--vscode-panel-border)",
						paddingTop: "16px",
						marginTop: "16px",
					}}
				>
					<div style={{ marginBottom: "12px" }}>
						<div
							style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}
						>
							Your Side
						</div>
						<div
							style={{
								fontSize: "11px",
								color: "var(--vscode-descriptionForeground)",
								lineHeight: "1.4",
							}}
						>
							People helping you or the claimant (lawyers, advocates, treating
							doctors, etc.)
						</div>
					</div>
					<div>
						<label
							style={{
								display: "block",
								marginBottom: "4px",
								fontSize: "13px",
								fontWeight: 500,
							}}
						>
							Advocate{" "}
							<span
								style={{
									fontSize: "11px",
									color: "var(--vscode-descriptionForeground)",
									fontWeight: "normal",
								}}
							>
								(optional)
							</span>
						</label>
						<input
							type="text"
							value={advocate}
							onChange={(e) => setAdvocate(e.target.value)}
							placeholder="e.g., Jane Doe, John Smith"
							style={{
								width: "100%",
								padding: "8px",
								backgroundColor: "var(--vscode-input-background)",
								color: "var(--vscode-input-foreground)",
								border: "1px solid var(--vscode-input-border)",
								borderRadius: "4px",
								fontSize: "13px",
							}}
						/>
						<div
							style={{
								marginTop: "4px",
								fontSize: "11px",
								color: "var(--vscode-descriptionForeground)",
							}}
						>
							Separate multiple names with commas. These names will be used to
							tag files.
						</div>
					</div>
				</div>

				<div
					style={{
						borderTop: "1px solid var(--vscode-panel-border)",
						paddingTop: "16px",
						marginTop: "16px",
					}}
				>
					<div style={{ marginBottom: "12px" }}>
						<div
							style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}
						>
							Their Side
						</div>
						<div
							style={{
								fontSize: "11px",
								color: "var(--vscode-descriptionForeground)",
								lineHeight: "1.4",
							}}
						>
							The opposing party: employer, insurer, defense lawyers, WCB staff,
							etc.
						</div>
					</div>
					<div style={{ marginBottom: "12px" }}>
						<label
							style={{
								display: "block",
								marginBottom: "4px",
								fontSize: "13px",
								fontWeight: 500,
							}}
						>
							Employer Name{" "}
							<span
								style={{
									fontSize: "11px",
									color: "var(--vscode-descriptionForeground)",
									fontWeight: "normal",
								}}
							>
								(optional)
							</span>
						</label>
						<input
							type="text"
							value={employerName}
							onChange={(e) => setEmployerName(e.target.value)}
							placeholder="e.g., ABC Corporation"
							style={{
								width: "100%",
								padding: "8px",
								backgroundColor: "var(--vscode-input-background)",
								color: "var(--vscode-input-foreground)",
								border: "1px solid var(--vscode-input-border)",
								borderRadius: "4px",
								fontSize: "13px",
							}}
						/>
						<div
							style={{
								marginTop: "4px",
								fontSize: "11px",
								color: "var(--vscode-descriptionForeground)",
							}}
						>
							The company or organization name
						</div>
					</div>
					<div style={{ marginBottom: "12px" }}>
						<label
							style={{
								display: "block",
								marginBottom: "4px",
								fontSize: "13px",
								fontWeight: 500,
							}}
						>
							Case Manager{" "}
							<span
								style={{
									fontSize: "11px",
									color: "var(--vscode-descriptionForeground)",
									fontWeight: "normal",
								}}
							>
								(optional)
							</span>
						</label>
						<input
							type="text"
							value={caseManager}
							onChange={(e) => setCaseManager(e.target.value)}
							placeholder="e.g., Sarah Johnson"
							style={{
								width: "100%",
								padding: "8px",
								backgroundColor: "var(--vscode-input-background)",
								color: "var(--vscode-input-foreground)",
								border: "1px solid var(--vscode-input-border)",
								borderRadius: "4px",
								fontSize: "13px",
							}}
						/>
						<div
							style={{
								marginTop: "4px",
								fontSize: "11px",
								color: "var(--vscode-descriptionForeground)",
							}}
						>
							The insurer's case manager handling your claim
						</div>
					</div>
					<div style={{ marginBottom: "12px" }}>
						<label
							style={{
								display: "block",
								marginBottom: "4px",
								fontSize: "13px",
								fontWeight: 500,
							}}
						>
							Review Officer{" "}
							<span
								style={{
									fontSize: "11px",
									color: "var(--vscode-descriptionForeground)",
									fontWeight: "normal",
								}}
							>
								(optional)
							</span>
						</label>
						<input
							type="text"
							value={reviewOfficer}
							onChange={(e) => setReviewOfficer(e.target.value)}
							placeholder="e.g., Michael Brown"
							style={{
								width: "100%",
								padding: "8px",
								backgroundColor: "var(--vscode-input-background)",
								color: "var(--vscode-input-foreground)",
								border: "1px solid var(--vscode-input-border)",
								borderRadius: "4px",
								fontSize: "13px",
							}}
						/>
						<div
							style={{
								marginTop: "4px",
								fontSize: "11px",
								color: "var(--vscode-descriptionForeground)",
							}}
						>
							WCB review officer assigned to your case
						</div>
					</div>
					<div>
						<label
							style={{
								display: "block",
								marginBottom: "4px",
								fontSize: "13px",
								fontWeight: 500,
							}}
						>
							Employer Representative{" "}
							<span
								style={{
									fontSize: "11px",
									color: "var(--vscode-descriptionForeground)",
									fontWeight: "normal",
								}}
							>
								(optional)
							</span>
						</label>
						<input
							type="text"
							value={employerRepresentative}
							onChange={(e) => setEmployerRepresentative(e.target.value)}
							placeholder="e.g., Robert Williams"
							style={{
								width: "100%",
								padding: "8px",
								backgroundColor: "var(--vscode-input-background)",
								color: "var(--vscode-input-foreground)",
								border: "1px solid var(--vscode-input-border)",
								borderRadius: "4px",
								fontSize: "13px",
							}}
						/>
						<div
							style={{
								marginTop: "4px",
								fontSize: "11px",
								color: "var(--vscode-descriptionForeground)",
							}}
						>
							Person representing the employer in your case
						</div>
					</div>
				</div>

				<div
					style={{
						borderTop: "1px solid var(--vscode-panel-border)",
						paddingTop: "16px",
						marginTop: "16px",
					}}
				>
					<div style={{ marginBottom: "12px" }}>
						<div
							style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}
						>
							File Tagging Keywords
						</div>
						<div
							style={{
								fontSize: "11px",
								color: "var(--vscode-descriptionForeground)",
								lineHeight: "1.4",
							}}
						>
							Keywords help the AI automatically tag and organize your files.
							Names you added above are automatically included.
						</div>
					</div>

					<div style={{ marginBottom: "12px" }}>
						<label
							style={{
								display: "block",
								marginBottom: "4px",
								fontSize: "13px",
								fontWeight: 500,
							}}
						>
							Your Side Keywords{" "}
							<span
								style={{
									fontSize: "11px",
									color: "var(--vscode-descriptionForeground)",
									fontWeight: "normal",
								}}
							>
								(optional)
							</span>
						</label>
						<input
							type="text"
							value={yourSideKeywords}
							onChange={(e) => setYourSideKeywords(e.target.value)}
							placeholder="e.g., claimant, treating, personal"
							style={{
								width: "100%",
								padding: "8px",
								backgroundColor: "var(--vscode-input-background)",
								color: "var(--vscode-input-foreground)",
								border: "1px solid var(--vscode-input-border)",
								borderRadius: "4px",
								fontSize: "13px",
							}}
						/>
						<div
							style={{
								marginTop: "4px",
								fontSize: "11px",
								color: "var(--vscode-descriptionForeground)",
							}}
						>
							Words that appear in files from your side. Defaults work for most
							cases.
						</div>
					</div>

					<div>
						<label
							style={{
								display: "block",
								marginBottom: "4px",
								fontSize: "13px",
								fontWeight: 500,
							}}
						>
							Their Side Keywords{" "}
							<span
								style={{
									fontSize: "11px",
									color: "var(--vscode-descriptionForeground)",
									fontWeight: "normal",
								}}
							>
								(optional)
							</span>
						</label>
						<input
							type="text"
							value={theirSideKeywords}
							onChange={(e) => setTheirSideKeywords(e.target.value)}
							placeholder="e.g., employer, wcb, ime, defense"
							style={{
								width: "100%",
								padding: "8px",
								backgroundColor: "var(--vscode-input-background)",
								color: "var(--vscode-input-foreground)",
								border: "1px solid var(--vscode-input-border)",
								borderRadius: "4px",
								fontSize: "13px",
							}}
						/>
						<div
							style={{
								marginTop: "4px",
								fontSize: "11px",
								color: "var(--vscode-descriptionForeground)",
							}}
						>
							Words that appear in files from the opposing side. Defaults work
							for most cases.
						</div>
					</div>
				</div>

				<div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
					<button
						onClick={handleSave}
						disabled={!claimantName.trim()}
						style={{
							flex: 1,
							padding: "10px",
							backgroundColor: claimantName.trim()
								? "var(--vscode-button-background)"
								: "var(--vscode-button-secondaryBackground)",
							color: claimantName.trim()
								? "var(--vscode-button-foreground)"
								: "var(--vscode-button-secondaryForeground)",
							border: "none",
							borderRadius: "4px",
							cursor: claimantName.trim() ? "pointer" : "not-allowed",
							fontSize: "13px",
							fontWeight: 500,
							opacity: claimantName.trim() ? 1 : 0.5,
						}}
					>
						💾 Save Case Info
					</button>
					{caseConfig && (
						<button
							onClick={() => {
								setIsEditing(false);
								populateFormFromConfig(caseConfig);
							}}
							style={{
								padding: "10px 20px",
								backgroundColor: "transparent",
								color: "var(--vscode-descriptionForeground)",
								border: "1px solid var(--vscode-panel-border)",
								borderRadius: "4px",
								cursor: "pointer",
								fontSize: "13px",
							}}
						>
							Cancel
						</button>
					)}
				</div>
			</div>
		</div>
	);
};
