/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useState } from "react";

interface RuleBuilderProps {
	rules: any[];
	selectedFiles: any[];
	onRulesChange: (rules: any[]) => void;
}

export const RuleBuilder: React.FC<RuleBuilderProps> = ({
	rules,
	selectedFiles,
	onRulesChange,
}) => {
	const [namingPattern, setNamingPattern] = useState("{Description}");

	const handlePatternChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newPattern = e.target.value;
			setNamingPattern(newPattern);

			// Update rules with new pattern
			const updatedRules = rules.map((rule) =>
				rule.type === "rename"
					? {
							...rule,
							pattern: newPattern,
							action: { ...rule.action, nameFormat: newPattern },
					  }
					: rule
			);

			// If no rename rule exists, add one
			if (!updatedRules.some((r) => r.type === "rename")) {
				updatedRules.unshift({
					type: "rename",
					pattern: newPattern,
					conditions: [],
					action: { nameFormat: newPattern },
				});
			}

			onRulesChange(updatedRules);
		},
		[rules, onRulesChange]
	);

	const getPreviewName = useCallback(
		(file: any) => {
			const baseName = file.name.replace("." + file.extension, "");
			const projectName = baseName.split("_")[0] || "Unnamed";

			let fileType = "File";
			if (file.name.toLowerCase().includes("wireframe")) fileType = "Wireframe";
			else if (file.name.toLowerCase().includes("mockup")) fileType = "Mockup";
			else if (file.name.toLowerCase().includes("medical")) fileType = "Medical";
			else if (file.name.toLowerCase().includes("legal")) fileType = "Legal";
			else if (file.name.toLowerCase().includes("correspondence")) fileType = "Correspondence";
			else fileType = file.extension.toUpperCase();

			const versionMatch = file.name.match(/v?(\d+)/i);
			const version = versionMatch ? `v${versionMatch[1]}` : "v1";

			// Determine side from classification or keyword detection
			let side = "Unknown";
			if (file.classification && file.classification !== "Unknown") {
				side = file.classification;
			} else {
				const lowerName = file.name.toLowerCase();
				if (lowerName.includes("your") || lowerName.includes("my") || lowerName.includes("personal") ||
				    lowerName.includes("claimant") || lowerName.includes("treating")) {
					side = "YourSide";
				} else if (lowerName.includes("employer") || lowerName.includes("wcb") || lowerName.includes("ime") ||
				           lowerName.includes("defense") || lowerName.includes("review officer")) {
					side = "TheirSide";
				}
			}

			const dateStr = new Date().toISOString().split("T")[0];

			let result = namingPattern
				.replace("{Side}", side)
				.replace("{Category}", fileType)
				.replace("{ProjectName}", projectName)
				.replace("{FileType}", fileType)
				.replace("{Version}", version)
				.replace("{Date}", dateStr)
				.replace("{YYYY-MM-DD}", dateStr)
				.replace("{Description}", baseName) // Must come after other replacements to ensure full replacement
				.replace("{Name}", baseName);

			// Ensure file keeps its extension
			if (!result.endsWith("." + file.extension)) {
				result += "." + file.extension;
			}

			return result;
		},
		[namingPattern]
	);

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "24px",
			}}
		>
			{/* Naming Pattern */}
			<div>
				<h3
					style={{
						margin: "0 0 16px 0",
						fontSize: "16px",
						fontWeight: 600,
					}}
				>
					File Naming Pattern
				</h3>
				<div
					style={{
						padding: "16px",
						backgroundColor: "var(--vscode-input-background)",
						borderRadius: "4px",
					}}
				>
					<label
						style={{
							display: "block",
							marginBottom: "8px",
							fontSize: "12px",
							color: "var(--vscode-descriptionForeground)",
						}}
					>
						Pattern
					</label>
					<input
						type="text"
						value={namingPattern}
						onChange={handlePatternChange}
						style={{
							width: "100%",
							padding: "8px",
							backgroundColor: "var(--vscode-input-background)",
							color: "var(--vscode-input-foreground)",
							border: "1px solid var(--vscode-input-border)",
							borderRadius: "2px",
							fontSize: "14px",
							fontFamily: "var(--vscode-editor-font-family)",
						}}
						placeholder="{Description}"
					/>
					<div
						style={{
							marginTop: "8px",
							fontSize: "11px",
							color: "var(--vscode-descriptionForeground)",
							lineHeight: "1.5",
						}}
					>
						<strong>💡 Default: &#123;Description&#125;</strong> - Preserves
						your original filename
						<br />
						Available placeholders: &#123;Description&#125; (full original
						name), &#123;Side&#125;, &#123;Category&#125;, &#123;Date&#125;,
						&#123;ProjectName&#125;, &#123;FileType&#125;, &#123;Version&#125;,
						&#123;Name&#125;
					</div>
					<div
						style={{
							marginTop: "8px",
							padding: "8px",
							backgroundColor:
								"var(--vscode-inputValidation-warningBackground)",
							border: "1px solid var(--vscode-inputValidation-warningBorder)",
							borderRadius: "4px",
							fontSize: "11px",
							color: "var(--vscode-inputValidation-warningForeground)",
						}}
					>
						⚠️ <strong>Warning:</strong> Using patterns without
						&#123;Description&#125; will lose your original filenames and may
						cause file name collisions!
					</div>
				</div>
			</div>

			{/* Preview */}
			<div>
				<h3
					style={{
						margin: "0 0 16px 0",
						fontSize: "16px",
						fontWeight: 600,
					}}
				>
					Preview
				</h3>
				<div
					style={{
						padding: "16px",
						backgroundColor: "var(--vscode-input-background)",
						borderRadius: "4px",
						maxHeight: "400px",
						overflow: "auto",
					}}
				>
					{selectedFiles.length === 0 ? (
						<div
							style={{
								color: "var(--vscode-descriptionForeground)",
								fontSize: "12px",
							}}
						>
							No files selected
						</div>
					) : (
						<table
							style={{
								width: "100%",
								borderCollapse: "collapse",
								fontSize: "12px",
							}}
						>
							<thead>
								<tr
									style={{
										borderBottom: "1px solid var(--vscode-panel-border)",
									}}
								>
									<th
										style={{
											padding: "8px",
											textAlign: "left",
											fontWeight: 600,
										}}
									>
										Original
									</th>
									<th
										style={{
											padding: "8px",
											textAlign: "left",
											fontWeight: 600,
										}}
									>
										→
									</th>
									<th
										style={{
											padding: "8px",
											textAlign: "left",
											fontWeight: 600,
										}}
									>
										New Name
									</th>
								</tr>
							</thead>
							<tbody>
								{selectedFiles.map((file, index) => (
									<tr
										key={index}
										style={{
											borderBottom:
												index < selectedFiles.length - 1
													? "1px solid var(--vscode-panel-border)"
													: "none",
										}}
									>
										<td
											style={{
												padding: "8px",
												color: "var(--vscode-descriptionForeground)",
											}}
										>
											{file.name}
										</td>
										<td style={{ padding: "8px" }}>→</td>
										<td
											style={{
												padding: "8px",
												color: "var(--vscode-foreground)",
												fontWeight: 500,
											}}
										>
											{getPreviewName(file)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>

			{/* Auto-Tagging */}
			<div>
				<h3
					style={{
						margin: "0 0 16px 0",
						fontSize: "16px",
						fontWeight: 600,
					}}
				>
					Auto-Tagging Rules
				</h3>
				<div
					style={{
						padding: "16px",
						backgroundColor: "var(--vscode-input-background)",
						borderRadius: "4px",
					}}
				>
					<div
						style={{
							fontSize: "12px",
							color: "var(--vscode-descriptionForeground)",
						}}
					>
						{rules.filter((r) => r.type === "tag").length} tagging rule(s)
						configured
					</div>
					<div
						style={{
							marginTop: "12px",
							fontSize: "11px",
							color: "var(--vscode-descriptionForeground)",
						}}
					>
						Tags will be automatically applied based on file types and patterns
					</div>
				</div>
			</div>
		</div>
	);
};
