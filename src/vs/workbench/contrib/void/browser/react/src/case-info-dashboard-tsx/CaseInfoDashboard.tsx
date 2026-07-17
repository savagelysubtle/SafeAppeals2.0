/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAccessor, useFileOrgConfigListener } from "../util/services.js";
import {
	WorkspaceType,
	WorkspaceTemplate,
	SectionDefinition,
	FieldDefinition,
	getTemplate,
	getTemplateOptions,
	getNestedValue,
	setNestedValue,
	createConfigFromTemplate,
	detectWorkspaceType,
	validateConfig,
	generateFixPrompt,
	ValidationResult,
} from "../util/workspaceTemplates.js";

// ============================================================================
// TYPES
// ============================================================================

interface CollapsedSections {
	[sectionId: string]: boolean;
}

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

const inputStyle: React.CSSProperties = {
	width: "100%",
	padding: "8px",
	backgroundColor: "var(--vscode-input-background)",
	color: "var(--vscode-input-foreground)",
	border: "1px solid var(--vscode-input-border)",
	borderRadius: "4px",
	fontSize: "13px",
	boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
	display: "block",
	marginBottom: "4px",
	fontSize: "13px",
	fontWeight: 500,
};

const descriptionStyle: React.CSSProperties = {
	marginTop: "4px",
	fontSize: "11px",
	color: "var(--vscode-descriptionForeground)",
};

// Collapsible Section Component
const CollapsibleSection: React.FC<{
	section: SectionDefinition;
	isCollapsed: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}> = ({ section, isCollapsed, onToggle, children }) => (
	<div
		style={{
			borderTop: "1px solid var(--vscode-panel-border)",
			paddingTop: "16px",
			marginTop: "16px",
		}}
	>
		<div
			onClick={onToggle}
			style={{
				display: "flex",
				alignItems: "center",
				cursor: "pointer",
				marginBottom: isCollapsed ? "0" : "12px",
				userSelect: "none",
			}}
		>
			<span style={{ marginRight: "8px", fontSize: "12px" }}>
				{isCollapsed ? "▶" : "▼"}
			</span>
			<span style={{ marginRight: "8px" }}>{section.icon}</span>
			<span style={{ fontSize: "14px", fontWeight: 600 }}>{section.title}</span>
		</div>
		{section.description && !isCollapsed && (
			<div
				style={{
					fontSize: "11px",
					color: "var(--vscode-descriptionForeground)",
					marginBottom: "12px",
					lineHeight: "1.4",
				}}
			>
				{section.description}
			</div>
		)}
		{!isCollapsed && children}
	</div>
);

// Dynamic Field Renderer
const DynamicField: React.FC<{
	field: FieldDefinition;
	value: unknown;
	onChange: (value: unknown) => void;
	isEditing: boolean;
}> = ({ field, value, onChange, isEditing }) => {
	if (!isEditing) {
		// View mode
		if (field.type === "array") {
			const arr = Array.isArray(value) ? value : [];
			if (arr.length === 0) return null;
			return (
				<div style={{ marginBottom: "12px" }}>
					<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", marginBottom: "4px" }}>
						{field.label}
					</div>
					<div style={{ fontSize: "14px" }}>{arr.join(", ")}</div>
				</div>
			);
		}
		if (!value) return null;
		return (
			<div style={{ marginBottom: "12px" }}>
				<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)", marginBottom: "4px" }}>
					{field.label}
				</div>
				<div style={{ fontSize: "14px" }}>{String(value)}</div>
			</div>
		);
	}

	// Edit mode
	const optionalLabel = !field.required && (
		<span style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", fontWeight: "normal" }}>
			{" "}(optional)
		</span>
	);

	const requiredMarker = field.required && (
		<span style={{ color: "var(--vscode-errorForeground)" }}> *</span>
	);

	switch (field.type) {
		case "text":
			return (
				<div style={{ marginBottom: "12px" }}>
					<label style={labelStyle}>
						{field.label}{requiredMarker}{optionalLabel}
					</label>
					<input
						type="text"
						value={String(value || "")}
						onChange={(e) => onChange(e.target.value)}
						placeholder={field.placeholder}
						style={inputStyle}
					/>
					{field.description && <div style={descriptionStyle}>{field.description}</div>}
				</div>
			);

		case "textarea":
			return (
				<div style={{ marginBottom: "12px" }}>
					<label style={labelStyle}>
						{field.label}{requiredMarker}{optionalLabel}
					</label>
					<textarea
						value={String(value || "")}
						onChange={(e) => onChange(e.target.value)}
						placeholder={field.placeholder}
						rows={3}
						style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }}
					/>
					{field.description && <div style={descriptionStyle}>{field.description}</div>}
				</div>
			);

		case "date":
			return (
				<div style={{ marginBottom: "12px" }}>
					<label style={labelStyle}>
						{field.label}{requiredMarker}{optionalLabel}
					</label>
					<input
						type="date"
						value={String(value || "")}
						onChange={(e) => onChange(e.target.value)}
						style={inputStyle}
					/>
					{field.description && <div style={descriptionStyle}>{field.description}</div>}
				</div>
			);

		case "select":
			return (
				<div style={{ marginBottom: "12px" }}>
					<label style={labelStyle}>
						{field.label}{requiredMarker}{optionalLabel}
					</label>
					<select
						value={String(value || field.options?.[0] || "")}
						onChange={(e) => onChange(e.target.value)}
						style={{
							...inputStyle,
							backgroundColor: "var(--vscode-dropdown-background)",
							color: "var(--vscode-dropdown-foreground)",
							border: "1px solid var(--vscode-dropdown-border)",
						}}
					>
						{field.options?.map((opt) => (
							<option key={opt} value={opt}>{opt}</option>
						))}
					</select>
					{field.description && <div style={descriptionStyle}>{field.description}</div>}
				</div>
			);

		case "array":
			const arrValue = Array.isArray(value) ? value.join(", ") : "";
			return (
				<div style={{ marginBottom: "12px" }}>
					<label style={labelStyle}>
						{field.label}{requiredMarker}{optionalLabel}
					</label>
					<input
						type="text"
						value={arrValue}
						onChange={(e) => {
							const arr = e.target.value
								.split(",")
								.map((s) => s.trim())
								.filter(Boolean);
							onChange(arr);
						}}
						placeholder={field.placeholder}
						style={inputStyle}
					/>
					<div style={descriptionStyle}>
						{field.description || "Separate multiple values with commas"}
					</div>
				</div>
			);

		default:
			return null;
	}
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const CaseInfoDashboard: React.FC = () => {
	const accessor = useAccessor();

	// Services - must be defined before callbacks that use them
	const fileOrganizerService = useMemo(() => {
		try {
			return accessor.get("IFileOrganizerService");
		} catch {
			return null;
		}
	}, [accessor]);

	const workspaceContextService = useMemo(() => {
		try {
			return accessor.get("IWorkspaceContextService");
		} catch {
			return null;
		}
	}, [accessor]);

	// State
	const [config, setConfig] = useState<Record<string, unknown> | null>(null);
	const [workspaceType, setWorkspaceType] = useState<WorkspaceType>("legal");
	const [isEditing, setIsEditing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [collapsedSections, setCollapsedSections] = useState<CollapsedSections>({});
	const [formData, setFormData] = useState<Record<string, unknown>>({});
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [externalChangeDetected, setExternalChangeDetected] = useState(false);
	const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
	const [showFixPrompt, setShowFixPrompt] = useState(false);

	// Function to reload config from disk
	const reloadConfig = useCallback(async () => {
		if (!fileOrganizerService || !workspaceContextService) return;

		try {
			const workspace = workspaceContextService.getWorkspace();
			if (!workspace.folders || workspace.folders.length === 0) return;

			const workspaceFolder = workspace.folders[0].uri;
			const exists = await fileOrganizerService.caseConfigExists(workspaceFolder);

			if (exists) {
				const loadedConfig = await fileOrganizerService.loadCaseConfig(workspaceFolder);
				if (loadedConfig) {
					setConfig(loadedConfig as Record<string, unknown>);
					const detectedType = detectWorkspaceType(loadedConfig as Record<string, unknown>);
					setWorkspaceType(detectedType);
					if (!isEditing) {
						setFormData(loadedConfig as Record<string, unknown>);
					}
				}
			}
		} catch (error) {
			console.error("[CaseInfoDashboard] Error reloading config:", error);
		}
	}, [fileOrganizerService, workspaceContextService, isEditing]);

	// Listen for external config changes (file modified outside of this panel)
	const configChangeCounter = useFileOrgConfigListener(() => {
		if (isEditing) {
			// User is editing - show conflict warning
			setExternalChangeDetected(true);
		} else {
			// Auto-reload when not editing
			reloadConfig();
		}
	});

	// Get template for current workspace type
	const template = useMemo(() => getTemplate(workspaceType), [workspaceType]);

	// Run validation when config or form data changes
	useEffect(() => {
		if (config && !isEditing) {
			const result = validateConfig(config, workspaceType);
			setValidationResult(result);
		} else if (formData && Object.keys(formData).length > 0) {
			const result = validateConfig(formData, workspaceType);
			setValidationResult(result);
		}
	}, [config, formData, workspaceType, isEditing]);

	// Initialize collapsed state from template defaults
	useEffect(() => {
		const initialCollapsed: CollapsedSections = {};
		template.sections.forEach((section) => {
			if (section.defaultCollapsed) {
				initialCollapsed[section.id] = true;
			}
		});
		setCollapsedSections(initialCollapsed);
	}, [template]);

	// Load config on mount
	useEffect(() => {
		const loadConfig = async () => {
			if (!fileOrganizerService || !workspaceContextService) return;

			try {
				setLoading(true);
				const workspace = workspaceContextService.getWorkspace();
				if (!workspace.folders || workspace.folders.length === 0) {
					setIsEditing(true);
					setLoading(false);
					return;
				}

				const workspaceFolder = workspace.folders[0].uri;
				const exists = await fileOrganizerService.caseConfigExists(workspaceFolder);

				if (exists) {
					const loadedConfig = await fileOrganizerService.loadCaseConfig(workspaceFolder);
					if (loadedConfig) {
						setConfig(loadedConfig as Record<string, unknown>);
						const detectedType = detectWorkspaceType(loadedConfig as Record<string, unknown>);
						setWorkspaceType(detectedType);
						setFormData(loadedConfig as Record<string, unknown>);
					}
				} else {
					setIsEditing(true);
				}
			} catch (error) {
				console.error("[CaseInfoDashboard] Error loading config:", error);
			} finally {
				setLoading(false);
			}
		};

		loadConfig();
	}, [fileOrganizerService, workspaceContextService]);

	// Handle template change
	const handleTemplateChange = useCallback((newType: WorkspaceType) => {
		setWorkspaceType(newType);
		if (!config) {
			// Create new config from template
			const newConfig = createConfigFromTemplate(newType);
			setFormData(newConfig);
		}
		setHasUnsavedChanges(true);
	}, [config]);

	// Toggle section collapse
	const toggleSection = useCallback((sectionId: string) => {
		setCollapsedSections((prev) => ({
			...prev,
			[sectionId]: !prev[sectionId],
		}));
	}, []);

	// Handle field change
	const handleFieldChange = useCallback((path: string, value: unknown) => {
		setFormData((prev) => {
			const newData = { ...prev };
			setNestedValue(newData, path, value);
			return newData;
		});
		setHasUnsavedChanges(true);
	}, []);

	// Save config
	const handleSave = useCallback(async () => {
		if (!fileOrganizerService || !workspaceContextService) return;

		const workspace = workspaceContextService.getWorkspace();
		if (!workspace.folders || workspace.folders.length === 0) {
			alert("No workspace folder open. Please open a folder first.");
			return;
		}

		const workspaceFolder = workspace.folders[0].uri;
		const configToSave = {
			...formData,
			version: "1.0",
			workspaceType,
			organizationSettings: (formData.organizationSettings as Record<string, unknown>) ?? {
				selectedTemplate: workspaceType,
				preserveOriginalNames: false,
				createBackup: true,
				targetFolder: ".organized",
			},
			updatedAt: new Date().toISOString(),
			createdAt: (formData.createdAt as string) || new Date().toISOString(),
		};

		try {
			await fileOrganizerService.saveCaseConfig(workspaceFolder, configToSave as Parameters<typeof fileOrganizerService.saveCaseConfig>[1]);
			setConfig(configToSave);
			setIsEditing(false);
			setHasUnsavedChanges(false);
			alert("Configuration saved successfully!");
		} catch (error) {
			console.error("[CaseInfoDashboard] Error saving:", error);
			alert("Error saving configuration. Check console for details.");
		}
	}, [fileOrganizerService, workspaceContextService, formData, workspaceType]);

	// Cancel editing
	const handleCancel = useCallback(() => {
		if (config) {
			setFormData(config);
			setWorkspaceType(detectWorkspaceType(config));
		}
		setIsEditing(false);
		setHasUnsavedChanges(false);
	}, [config]);

	// Render loading state
	if (loading) {
		return (
			<div style={{ padding: "24px", textAlign: "center" }}>
				<div style={{ fontSize: "14px", color: "var(--vscode-descriptionForeground)" }}>
					Loading configuration...
				</div>
			</div>
		);
	}

	// Render view or edit mode
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
			{/* Header */}
			<div
				style={{
					marginBottom: "24px",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
					{template.icon} {isEditing ? "Edit" : ""} {template.name} Configuration
				</h2>
				{!isEditing && config && (
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
				)}
			</div>

			{/* External Change Warning */}
			{externalChangeDetected && isEditing && (
				<div
					style={{
						marginBottom: "16px",
						padding: "12px",
						backgroundColor: "var(--vscode-inputValidation-warningBackground)",
						border: "1px solid var(--vscode-inputValidation-warningBorder)",
						borderRadius: "4px",
						fontSize: "12px",
					}}
				>
					<strong>⚠️ External Change Detected</strong>
					<p style={{ margin: "8px 0 0 0" }}>
						The configuration file was modified externally. Your unsaved changes may conflict.
					</p>
					<div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
						<button
							onClick={() => {
								reloadConfig();
								setExternalChangeDetected(false);
								setIsEditing(false);
								setHasUnsavedChanges(false);
							}}
							style={{
								padding: "4px 8px",
								backgroundColor: "var(--vscode-button-secondaryBackground)",
								color: "var(--vscode-button-secondaryForeground)",
								border: "none",
								borderRadius: "4px",
								cursor: "pointer",
								fontSize: "11px",
							}}
						>
							Discard My Changes
						</button>
						<button
							onClick={() => setExternalChangeDetected(false)}
							style={{
								padding: "4px 8px",
								backgroundColor: "transparent",
								color: "var(--vscode-descriptionForeground)",
								border: "1px solid var(--vscode-panel-border)",
								borderRadius: "4px",
								cursor: "pointer",
								fontSize: "11px",
							}}
						>
							Keep Editing
						</button>
					</div>
				</div>
			)}

			{/* Template Selector (only in edit mode or when no config) */}
			{(isEditing || !config) && (
				<div style={{ marginBottom: "24px" }}>
					<label style={labelStyle}>Workspace Type</label>
					<select
						value={workspaceType}
						onChange={(e) => handleTemplateChange(e.target.value as WorkspaceType)}
						style={{
							...inputStyle,
							backgroundColor: "var(--vscode-dropdown-background)",
							color: "var(--vscode-dropdown-foreground)",
							border: "1px solid var(--vscode-dropdown-border)",
						}}
					>
						{getTemplateOptions().map((opt) => (
							<option key={opt.id} value={opt.id}>
								{opt.icon} {opt.name}
							</option>
						))}
					</select>
					<div style={descriptionStyle}>{template.description}</div>
				</div>
			)}

			{/* Dynamic Sections */}
			{template.sections.map((section) => (
				<CollapsibleSection
					key={section.id}
					section={section}
					isCollapsed={collapsedSections[section.id] || false}
					onToggle={() => toggleSection(section.id)}
				>
					{section.fields.map((field) => (
						<DynamicField
							key={field.key}
							field={field}
							value={getNestedValue(formData, field.key)}
							onChange={(value) => handleFieldChange(field.key, value)}
							isEditing={isEditing || !config}
						/>
					))}
				</CollapsibleSection>
			))}

			{/* Action Buttons */}
			{(isEditing || !config) && (
				<div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
					<button
						onClick={handleSave}
						style={{
							flex: 1,
							padding: "10px",
							backgroundColor: "var(--vscode-button-background)",
							color: "var(--vscode-button-foreground)",
							border: "none",
							borderRadius: "4px",
							cursor: "pointer",
							fontSize: "13px",
							fontWeight: 500,
						}}
					>
						💾 Save Configuration
					</button>
					{config && (
						<button
							onClick={handleCancel}
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
			)}

			{/* Validation Issues */}
			{validationResult && validationResult.issues.length > 0 && (
				<div
					style={{
						marginTop: "24px",
						padding: "12px",
						backgroundColor: validationResult.isValid
							? "var(--vscode-inputValidation-warningBackground)"
							: "var(--vscode-inputValidation-errorBackground)",
						border: `1px solid ${validationResult.isValid
							? "var(--vscode-inputValidation-warningBorder)"
							: "var(--vscode-inputValidation-errorBorder)"}`,
						borderRadius: "4px",
						fontSize: "12px",
					}}
				>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
						<strong>
							{validationResult.isValid ? "⚠️ Warnings" : "❌ Validation Issues"} ({validationResult.issues.length})
						</strong>
						<button
							onClick={() => setShowFixPrompt(!showFixPrompt)}
							style={{
								padding: "4px 8px",
								backgroundColor: "var(--vscode-button-secondaryBackground)",
								color: "var(--vscode-button-secondaryForeground)",
								border: "none",
								borderRadius: "4px",
								cursor: "pointer",
								fontSize: "11px",
							}}
						>
							{showFixPrompt ? "Hide AI Fix Prompt" : "Get AI Fix Prompt"}
						</button>
					</div>
					<ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
						{validationResult.issues.slice(0, 5).map((issue, i) => (
							<li key={i} style={{ marginBottom: "4px" }}>
								{issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'} {issue.message}
							</li>
						))}
						{validationResult.issues.length > 5 && (
							<li style={{ color: "var(--vscode-descriptionForeground)" }}>
								...and {validationResult.issues.length - 5} more
							</li>
						)}
					</ul>

					{showFixPrompt && (
						<div style={{ marginTop: "12px" }}>
							<div style={{ marginBottom: "4px", fontWeight: 500 }}>
								📋 Copy this prompt and paste it to the AI:
							</div>
							<textarea
								readOnly
								value={generateFixPrompt(config || formData, validationResult.issues)}
								style={{
									width: "100%",
									height: "150px",
									padding: "8px",
									backgroundColor: "var(--vscode-input-background)",
									color: "var(--vscode-input-foreground)",
									border: "1px solid var(--vscode-input-border)",
									borderRadius: "4px",
									fontSize: "11px",
									fontFamily: "monospace",
									resize: "vertical",
								}}
								onClick={(e) => (e.target as HTMLTextAreaElement).select()}
							/>
							<button
								onClick={() => {
									navigator.clipboard.writeText(
										generateFixPrompt(config || formData, validationResult.issues)
									);
									alert("Prompt copied to clipboard!");
								}}
								style={{
									marginTop: "8px",
									padding: "6px 12px",
									backgroundColor: "var(--vscode-button-background)",
									color: "var(--vscode-button-foreground)",
									border: "none",
									borderRadius: "4px",
									cursor: "pointer",
									fontSize: "12px",
								}}
							>
								📋 Copy to Clipboard
							</button>
						</div>
					)}
				</div>
			)}

			{/* Tip */}
			<div
				style={{
					marginTop: "24px",
					padding: "12px",
					backgroundColor: "var(--vscode-inputValidation-infoBackground)",
					border: "1px solid var(--vscode-inputValidation-infoBorder)",
					borderRadius: "4px",
					fontSize: "12px",
				}}
			>
				<strong>💡 Tip:</strong> This configuration is automatically available to the AI
				when you chat (Ctrl+L), helping it understand your project context.
			</div>
		</div>
	);
};
