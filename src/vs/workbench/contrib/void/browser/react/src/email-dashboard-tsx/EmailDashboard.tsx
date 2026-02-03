/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	Email,
	EmailCategory,
	EmailPriority,
} from "../../../../common/emailService.js";
import { useAccessor } from "../util/services.js";
import { EmailCard } from "./EmailCard.js";
import { EmailFilters } from "./EmailFilters.js";
import { EmailStats, EmailStatsData } from "./EmailStats.js";
import { EmailThread, EmailThread as EmailThreadType } from "./EmailThread.js";
import {
	EmailSortDirection,
	EmailSortField,
	EmailToolbar,
	EmailViewMode,
} from "./EmailToolbar.js";

// ============================================================================
// REUSABLE STYLES - VSCode Theme Variables
// ============================================================================

const containerStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-editor-background)",
	color: "var(--vscode-editor-foreground)",
};

const buttonPrimaryStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-button-background)",
	color: "var(--vscode-button-foreground)",
	border: "none",
	borderRadius: "8px",
	cursor: "pointer",
};

const descriptionStyle: React.CSSProperties = {
	color: "var(--vscode-descriptionForeground)",
};

export const EmailDashboard: React.FC = () => {
	const accessor = useAccessor();

	const [emails, setEmails] = useState<Email[]>([]);
	const [threads, setThreads] = useState<EmailThreadType[]>([]);
	const [displayMode, setDisplayMode] = useState<"flat" | "threads">("flat"); // New state for flat vs thread view
	const [isLoading, setIsLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCaseFolder, setSelectedCaseFolder] = useState<string | "all">(
		"all",
	);
	const [caseFolders, setCaseFolders] = useState<string[]>([]);
	const [viewMode, setViewMode] = useState<EmailViewMode>("list");
	const [sortField, setSortField] = useState<EmailSortField>("date");
	const [sortDirection, setSortDirection] =
		useState<EmailSortDirection>("desc");
	const [showFilters, setShowFilters] = useState(false);
	const [categoryFilter, setCategoryFilter] = useState<EmailCategory | "all">(
		"all",
	);
	const [priorityFilter, setPriorityFilter] = useState<EmailPriority | "all">(
		"all",
	);
	const [emailStats, setEmailStats] = useState<EmailStatsData>({
		totalEmails: 0,
		draftCount: 0,
		caseFolders: 0,
		needsReply: 0,
	});

	// Load emails and threads on mount or when display mode changes
	useEffect(() => {
		const loadData = async () => {
			setIsLoading(true);
			try {
				const emailService = accessor.get("IEmailService");
				const loadedEmails = await emailService.getEmails();
				console.log(
					"[EmailDashboard] Loaded emails with categories:",
					loadedEmails.map((e) => ({
						subject: e.subject.substring(0, 30),
						category: e.category,
						priority: e.priority,
						classifiedAt: e.classifiedAt,
					})),
				);
				setEmails(loadedEmails);

				// Load threads if in thread mode
				if (displayMode === "threads") {
					try {
						const emailThreadService = accessor.get("IEmailThreadService");
						const loadedThreads = await emailThreadService.getThreads();
						console.log(
							"[EmailDashboard] Loaded threads:",
							loadedThreads.length,
						);
						setThreads(loadedThreads);
					} catch (error) {
						console.error("[EmailDashboard] Failed to load threads:", error);
						setThreads([]);
					}
				}

				// Get unique case folders and stats
				const stats = await emailService.getStats();
				setCaseFolders(stats.caseFolders);
				setEmailStats({
					totalEmails: stats.totalEmails,
					draftCount: stats.draftCount,
					caseFolders: stats.caseFolders.length,
					needsReply: 0, // Placeholder - would need conversation tracking to implement
				});
			} catch (error) {
				console.error("[EmailDashboard] Failed to load emails:", error);
				// Service might not be ready, or emails table is empty
				setEmails([]);
				setThreads([]);
				setCaseFolders([]);
				setEmailStats({
					totalEmails: 0,
					draftCount: 0,
					caseFolders: 0,
					needsReply: 0,
				});
			} finally {
				setIsLoading(false);
			}
		};
		loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [displayMode]); // Reload when display mode changes

	const handleImportEmail = useCallback(async () => {
		try {
			const fileDialogService = accessor.get("IFileDialogService");
			const emailService = accessor.get("IEmailService");

			const result = await fileDialogService.showOpenDialog({
				title: "Import Email",
				filters: [
					{ name: "Email Files", extensions: ["eml", "pdf"] },
					{ name: "EML Files", extensions: ["eml"] },
					{ name: "PDF Files", extensions: ["pdf"] },
				],
				canSelectMany: true,
			});

			if (result && result.length > 0) {
				for (const uri of result) {
					await emailService.parseEmail(uri);
				}
				// Refresh email list and stats
				const loadedEmails = await emailService.getEmails();
				console.log(
					"[EmailDashboard] After import - emails with categories:",
					loadedEmails.map((e) => ({
						subject: e.subject.substring(0, 30),
						category: e.category,
						priority: e.priority,
						classifiedAt: e.classifiedAt,
					})),
				);
				setEmails(loadedEmails);

				// Refresh threads if in thread mode
				if (displayMode === "threads") {
					try {
						const emailThreadService = accessor.get("IEmailThreadService");
						const loadedThreads = await emailThreadService.getThreads();
						setThreads(loadedThreads);
					} catch (error) {
						console.error("[EmailDashboard] Failed to refresh threads:", error);
					}
				}

				const stats = await emailService.getStats();
				setCaseFolders(stats.caseFolders);
				setEmailStats({
					totalEmails: stats.totalEmails,
					draftCount: stats.draftCount,
					caseFolders: stats.caseFolders.length,
					needsReply: 0,
				});
			}
		} catch (error) {
			console.error("[EmailDashboard] Failed to import email:", error);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // accessor is stable

	const handleOpenEmail = useCallback(async (email: Email) => {
		try {
			const editorService = accessor.get("IEditorService");
			const URI = accessor.get("URI");
			const uri = URI.file(email.filePath);
			await editorService.openEditor({ resource: uri });
		} catch (error) {
			console.error("[EmailDashboard] Failed to open email:", error);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // accessor is stable

	const handleDeleteEmail = useCallback(async (emailId: string) => {
		try {
			const emailService = accessor.get("IEmailService");
			await emailService.deleteEmail(emailId);
			setEmails((prev) => prev.filter((e) => e.id !== emailId));
		} catch (error) {
			console.error("[EmailDashboard] Failed to delete email:", error);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // accessor is stable

	const handleDraftReply = useCallback(
		async (email: Email): Promise<string> => {
			const notificationService = accessor.get("INotificationService");

			try {
				const emailDraftService = accessor.get("IEmailDraftService");
				const cloudLLMRouter = accessor.get("ICloudLLMRouterService");
				const voidSettingsService = accessor.get("IVoidSettingsService");
				const fileOrganizerService = accessor.get("IFileOrganizerService");
				const ragService = accessor.get("IRAGService");
				const workspaceContextService = accessor.get(
					"IWorkspaceContextService",
				);

				// Get model selection from settings
				const modelSelection =
					voidSettingsService.state.modelSelectionOfFeature["Chat"];
				const modelSelectionOptions = modelSelection
					? voidSettingsService.state.optionsOfModelSelection["Chat"][
							modelSelection.providerName
						]?.[modelSelection.modelName]
					: undefined;
				const overridesOfModel = voidSettingsService.state.overridesOfModel;

				// Check if LLM is available (either cloud or BYOK)
				const canUseCloud = cloudLLMRouter.canUseCloud();
				const hasModel = !!modelSelection;

				if (!canUseCloud && !hasModel) {
					// Fallback to template if no LLM available
					notificationService.info(
						`Creating draft reply for "${email.subject}"...`,
					);

					const templateContent = `<p>Dear ${email.from || "Recipient"},</p>
<p></p>
<p>Thank you for your email regarding "${email.subject}".</p>
<p></p>
<p></p>
<p>Best regards,</p>`;

					await emailDraftService.saveDraft(email.id, templateContent);
					notificationService.info(
						`Draft created (configure a model or sign in to SafeAppeals Cloud for AI-powered replies)`,
					);
					return templateContent;
				}

				// Generate AI reply using CloudLLMRouterService
				notificationService.info(
					`Generating AI reply for "${email.subject}"...`,
				);

				// --- GATHER CASE CONTEXT ---
				let caseInfoContext = "";
				let signatureName = "";
				try {
					const workspaceFolders =
						workspaceContextService.getWorkspace().folders;
					if (workspaceFolders.length > 0) {
						const workspaceUri = workspaceFolders[0].uri;
						const caseInfo =
							await fileOrganizerService.loadCaseInfo(workspaceUri);
						if (caseInfo) {
							console.log(
								"[EmailDashboard] Loaded case info for AI reply:",
								caseInfo,
							);

							// Build case context from available fields
							const caseContextParts: string[] = [];

							// Basic case info
							const claimantName = caseInfo.claimantName || caseInfo.clientName;
							if (claimantName)
								caseContextParts.push(`Claimant Name: ${claimantName}`);
							if (caseInfo.caseNumber)
								caseContextParts.push(
									`Case/Claim Number: ${caseInfo.caseNumber}`,
								);
							const injuryDate = caseInfo.injuryDate || caseInfo.incidentDate;
							if (injuryDate)
								caseContextParts.push(`Date of Injury: ${injuryDate}`);
							if (caseInfo.caseType)
								caseContextParts.push(`Case Type: ${caseInfo.caseType}`);
							if (caseInfo.description)
								caseContextParts.push(`Description: ${caseInfo.description}`);

							// Party information
							if (caseInfo.parties) {
								if (caseInfo.parties.claimant?.name) {
									caseContextParts.push(`\nCLAIMANT SIDE:`);
									caseContextParts.push(
										`  Client: ${caseInfo.parties.claimant.name}`,
									);
									if (caseInfo.parties.claimant.lawyers?.length) {
										caseContextParts.push(
											`  Lawyers: ${caseInfo.parties.claimant.lawyers.join(", ")}`,
										);
									}
									if (caseInfo.parties.claimant.advocate?.length) {
										caseContextParts.push(
											`  Advocates: ${caseInfo.parties.claimant.advocate.join(", ")}`,
										);
										// Use first advocate as signature name
										signatureName = caseInfo.parties.claimant.advocate[0];
									}
									if (caseInfo.parties.claimant.doctors?.length) {
										caseContextParts.push(
											`  Treating Physicians: ${caseInfo.parties.claimant.doctors.join(", ")}`,
										);
									}
								}

								if (caseInfo.parties.employer?.name) {
									caseContextParts.push(`\nEMPLOYER/OPPOSING SIDE:`);
									caseContextParts.push(
										`  Employer: ${caseInfo.parties.employer.name}`,
									);
									if (caseInfo.parties.employer.lawyers?.length) {
										caseContextParts.push(
											`  Opposing Lawyers: ${caseInfo.parties.employer.lawyers.join(", ")}`,
										);
									}
								}

								if (caseInfo.parties.wcb?.organization) {
									caseContextParts.push(`\nWCB/INSURANCE:`);
									caseContextParts.push(
										`  Organization: ${caseInfo.parties.wcb.organization}`,
									);
									if (caseInfo.parties.wcb.adjudicators?.length) {
										caseContextParts.push(
											`  Adjudicators: ${caseInfo.parties.wcb.adjudicators.join(", ")}`,
										);
									}
								}

								if (caseInfo.parties.tribunal?.name) {
									caseContextParts.push(`\nTRIBUNAL:`);
									caseContextParts.push(
										`  Name: ${caseInfo.parties.tribunal.name}`,
									);
								}
							}

							if (caseContextParts.length > 0) {
								caseInfoContext = `
=== CASE INFORMATION ===
${caseContextParts.join("\n")}
========================
`;
							}
						}
					}
				} catch (caseError) {
					console.log("[EmailDashboard] No case info available:", caseError);
				}

				// --- SEARCH RAG FOR RELEVANT DOCUMENTS ---
				let ragContext = "";
				try {
					const emailContent =
						email.bodyText || email.bodyHtml?.replace(/<[^>]*>/g, "") || "";
					// Create a search query from the email subject and key content
					const searchQuery = `${email.subject} ${emailContent.substring(0, 500)}`;

					const workspaceId = ragService.getWorkspaceId();
					const ragResults = await ragService.search({
						query: searchQuery,
						scope: "workspace_all", // Search both core references and case documents
						limit: 5,
						workspaceId: workspaceId,
					});

					if (
						ragResults &&
						ragResults.answerContext &&
						ragResults.totalResults > 0
					) {
						console.log(
							"[EmailDashboard] RAG search found relevant documents:",
							ragResults.totalResults,
						);
						ragContext = `
=== RELEVANT CASE DOCUMENTS ===
The following excerpts from case documents may help inform your reply:

${ragResults.answerContext}

Sources: ${ragResults.attributions.map((a) => a.filename).join(", ")}
===============================
`;
					}
				} catch (ragError) {
					console.log(
						"[EmailDashboard] RAG search failed or no results:",
						ragError,
					);
				}

				// Create prompt for the LLM with enriched context
				const emailContent =
					email.bodyText ||
					email.bodyHtml?.replace(/<[^>]*>/g, "") ||
					"No content available";
				const emailContext = `
Subject: ${email.subject}
From: ${email.from}
Date: ${email.date instanceof Date ? email.date.toLocaleDateString() : email.date}

Email Content:
${emailContent}
`;

				// Build system prompt with case context
				const signatureInstruction = signatureName
					? `Sign the email as "${signatureName}" (case representative/advocate)`
					: "End with a professional closing (the user will add their signature)";

				let systemPrompt = `You are a professional legal assistant helping draft email replies for a workers' compensation case.
${caseInfoContext}
${ragContext}
Generate a professional, courteous reply to the following email. The reply should:
1. Acknowledge the sender's message appropriately
2. Address any questions or requests mentioned
3. Be appropriately formal for legal correspondence
4. Reference relevant case information when applicable (case numbers, dates, names)
5. Be concise but complete
6. ${signatureInstruction}

IMPORTANT GUIDELINES:
- If case information is provided, use the claimant's name and claim/case number appropriately when relevant
- If relevant documents are referenced in the context, incorporate that knowledge into your response
- Maintain a professional but empathetic tone appropriate for workers' compensation matters
- Do NOT make up specific dates, amounts, or facts that aren't provided in the context
- When referencing documents from the RAG context, you may cite them naturally (e.g., "As noted in the medical report...")

Format the response as HTML paragraphs (<p> tags).`;

				const userMessage = `Please draft a professional reply to this email:

${emailContext}

Generate the reply content only, formatted as HTML paragraphs.`;

				// Call the LLM
				let generatedContent = "";
				await new Promise<void>((resolve, reject) => {
					cloudLLMRouter.sendLLMMessage({
						messagesType: "chatMessages",
						messages: [
							{
								role: "user",
								content: userMessage,
							},
						],
						separateSystemMessage: systemPrompt,
						chatMode: null,
						onText: ({ fullText }) => {
							generatedContent = fullText;
						},
						onFinalMessage: ({ fullText }) => {
							generatedContent = fullText;
							resolve();
						},
						onError: ({ message }) => {
							reject(new Error(message));
						},
						onAbort: () => {
							reject(new Error("Request aborted"));
						},
						logging: { loggingName: "EmailDraftReply" },
						modelSelection: modelSelection,
						modelSelectionOptions: modelSelectionOptions,
						overridesOfModel: overridesOfModel,
					});
				});

				// Clean up the response - ensure it's wrapped in HTML
				if (!generatedContent.startsWith("<p>")) {
					generatedContent = generatedContent
						.split("\n\n")
						.filter((p) => p.trim())
						.map((p) => `<p>${p.trim()}</p>`)
						.join("\n");
				}

				// Save to draft service
				await emailDraftService.saveDraft(email.id, generatedContent);

				notificationService.info(`AI reply generated with case context!`);
				return generatedContent;
			} catch (error) {
				console.error("[EmailDashboard] Failed to generate AI reply:", error);
				notificationService.error(
					`Failed to generate AI reply: ${error instanceof Error ? error.message : "Unknown error"}`,
				);

				// Return empty string on error - EmailCard will handle showing the editor
				return "";
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		},
		[],
	); // accessor is stable

	const handleSearch = useCallback(async (query: string) => {
		setSearchQuery(query);
		if (!query.trim()) {
			// Reset to all emails
			const emailService = accessor.get("IEmailService");
			const loadedEmails = await emailService.getEmails();
			setEmails(loadedEmails);
			return;
		}

		try {
			const emailService = accessor.get("IEmailService");
			const results = await emailService.searchEmails(query);
			setEmails(results);
		} catch (error) {
			console.error("[EmailDashboard] Failed to search emails:", error);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // accessor is stable

	const handleToggleStar = useCallback(
		async (emailId: string): Promise<boolean> => {
			try {
				const emailService = accessor.get("IEmailService");
				const newStarredState = await emailService.toggleStar(emailId);
				// Update local state
				setEmails((prev) =>
					prev.map((e) =>
						e.id === emailId ? { ...e, isStarred: newStarredState } : e,
					),
				);
				return newStarredState;
			} catch (error) {
				console.error("[EmailDashboard] Failed to toggle star:", error);
				throw error;
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		},
		[],
	); // accessor is stable

	const handleSetReminder = useCallback(
		async (emailId: string, reminderDate: Date | null): Promise<void> => {
			try {
				const emailService = accessor.get("IEmailService");
				await emailService.setReminder(emailId, reminderDate);
				// Update local state
				setEmails((prev) =>
					prev.map((e) =>
						e.id === emailId
							? { ...e, reminderDate: reminderDate ?? undefined }
							: e,
					),
				);
			} catch (error) {
				console.error("[EmailDashboard] Failed to set reminder:", error);
				throw error;
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		},
		[],
	); // accessor is stable

	const handleUpdateThreadStatus = useCallback(
		async (
			threadId: string,
			status: "needs-reply" | "awaiting-response" | "resolved" | "active",
		): Promise<void> => {
			try {
				const emailThreadService = accessor.get("IEmailThreadService");
				await emailThreadService.updateThreadStatus(threadId, status);
				// Update local thread state
				setThreads((prev) =>
					prev.map((t) => (t.threadId === threadId ? { ...t, status } : t)),
				);
				console.log(
					`[EmailDashboard] Updated thread ${threadId} status to ${status}`,
				);
			} catch (error) {
				console.error(
					"[EmailDashboard] Failed to update thread status:",
					error,
				);
				throw error;
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		},
		[],
	); // accessor is stable

	// Filter and sort emails
	const filteredEmails = useMemo(() => {
		let result = [...emails];

		// Filter by case folder
		if (selectedCaseFolder !== "all") {
			result = result.filter(
				(e) =>
					e.caseFolderPath === selectedCaseFolder ||
					e.caseFolderPath.startsWith(selectedCaseFolder),
			);
		}

		// Filter by category
		if (categoryFilter !== "all") {
			result = result.filter((e) => e.category === categoryFilter);
		}

		// Filter by priority
		if (priorityFilter !== "all") {
			result = result.filter((e) => e.priority === priorityFilter);
		}

		// Sort
		result.sort((a, b) => {
			let comparison = 0;
			switch (sortField) {
				case "date":
					comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
					break;
				case "from":
					comparison = a.from.localeCompare(b.from);
					break;
				case "subject":
					comparison = a.subject.localeCompare(b.subject);
					break;
			}
			return sortDirection === "asc" ? comparison : -comparison;
		});

		return result;
	}, [
		emails,
		selectedCaseFolder,
		categoryFilter,
		priorityFilter,
		sortField,
		sortDirection,
	]);

	// Filter and sort threads
	const filteredThreads = useMemo(() => {
		let result = [...threads];

		// Filter by case folder
		if (selectedCaseFolder !== "all") {
			result = result.filter((t) =>
				t.emails.some(
					(e) =>
						e.caseFolderPath === selectedCaseFolder ||
						e.caseFolderPath.startsWith(selectedCaseFolder),
				),
			);
		}

		// Filter by category
		if (categoryFilter !== "all") {
			result = result.filter((t) =>
				t.emails.some((e) => e.category === categoryFilter),
			);
		}

		// Filter by priority
		if (priorityFilter !== "all") {
			result = result.filter((t) =>
				t.emails.some((e) => e.priority === priorityFilter),
			);
		}

		// Sort threads by latest date
		result.sort((a, b) => {
			const comparison =
				new Date(a.latestDate).getTime() - new Date(b.latestDate).getTime();
			return sortDirection === "asc" ? comparison : -comparison;
		});

		return result;
	}, [
		threads,
		selectedCaseFolder,
		categoryFilter,
		priorityFilter,
		sortDirection,
	]);

	if (isLoading) {
		return (
			<div
				className="flex items-center justify-center h-full p-8"
				style={containerStyle}
			>
				<div className="text-center">
					<div
						className="rounded-full h-10 w-10 border-2 mx-auto mb-4 animate-spin"
						style={{
							borderColor:
								"var(--vscode-button-background) transparent var(--vscode-button-background) transparent",
						}}
					/>
					<p style={descriptionStyle}>Loading emails...</p>
				</div>
			</div>
		);
	}

	if (emails.length === 0 && !searchQuery) {
		return (
			<div
				className="flex flex-col items-center justify-center h-full p-8"
				style={containerStyle}
			>
				<div className="text-center max-w-md">
					{/* Email Icon */}
					<div
						className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
						style={{
							backgroundColor: "var(--vscode-button-background)",
							opacity: 0.15,
							border: "2px solid var(--vscode-button-background)",
						}}
					>
						<svg
							width="40"
							height="40"
							viewBox="0 0 24 24"
							fill="none"
							stroke="var(--vscode-button-background)"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							style={{ opacity: 1 }}
						>
							<rect x="2" y="4" width="20" height="16" rx="2" />
							<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
						</svg>
					</div>

					<h2
						className="text-2xl font-bold mb-3"
						style={{ color: "var(--vscode-editor-foreground)" }}
					>
						Email Dashboard
					</h2>
					<p className="mb-8 text-base" style={descriptionStyle}>
						Import emails from your case files to manage correspondence and
						draft replies with AI assistance.
					</p>

					<button
						onClick={handleImportEmail}
						className="px-8 py-3 font-semibold text-base transition-all duration-200 hover:scale-105"
						style={{
							...buttonPrimaryStyle,
							padding: "12px 32px",
						}}
					>
						<span className="flex items-center gap-2">
							<i className="codicon codicon-add" />
							Import Emails
						</span>
					</button>

					<p className="mt-6 text-sm" style={descriptionStyle}>
						Supports .eml and .pdf email files
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col" style={containerStyle}>
			{/* Toolbar */}
			<EmailToolbar
				onImportEmail={handleImportEmail}
				searchQuery={searchQuery}
				onSearchChange={handleSearch}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				displayMode={displayMode}
				onDisplayModeChange={setDisplayMode}
				sortField={sortField}
				onSortFieldChange={setSortField}
				sortDirection={sortDirection}
				onSortDirectionChange={setSortDirection}
				showFilters={showFilters}
				onToggleFilters={() => setShowFilters(!showFilters)}
				emailCount={
					displayMode === "flat"
						? filteredEmails.length
						: filteredThreads.length
				}
				categoryFilter={categoryFilter}
				onCategoryFilterChange={setCategoryFilter}
				priorityFilter={priorityFilter}
				onPriorityFilterChange={setPriorityFilter}
			/>

			{/* Stats Bar */}
			<EmailStats stats={emailStats} />

			{/* Filters Panel (collapsible) */}
			{showFilters && (
				<EmailFilters
					caseFolders={caseFolders}
					selectedCaseFolder={selectedCaseFolder}
					onCaseFolderChange={setSelectedCaseFolder}
				/>
			)}

			{/* Email List or Thread List */}
			<div className="void-scrollbar flex-1 overflow-y-auto p-4">
				{displayMode === "flat" ? (
					// Flat email list view
					filteredEmails.length === 0 ? (
						<div className="text-center py-12">
							<p style={descriptionStyle}>
								{searchQuery
									? "No emails match your search."
									: "No emails in this folder."}
							</p>
						</div>
					) : (
						<div
							className={
								viewMode === "compact"
									? "space-y-1 max-w-4xl mx-auto"
									: "space-y-3 max-w-4xl mx-auto"
							}
						>
							{filteredEmails.map((email) => (
								<EmailCard
									key={email.id}
									email={email}
									viewMode={viewMode}
									onClick={() => handleOpenEmail(email)}
									onDelete={() => handleDeleteEmail(email.id)}
									onDraftReply={async () => handleDraftReply(email)}
									onToggleStar={() => handleToggleStar(email.id)}
									onSetReminder={(date) => handleSetReminder(email.id, date)}
								/>
							))}
						</div>
					)
				) : // Thread view
				filteredThreads.length === 0 ? (
					<div className="text-center py-12">
						<p style={descriptionStyle}>
							{searchQuery
								? "No threads match your search."
								: "No email threads in this folder."}
						</p>
					</div>
				) : (
					<div className="space-y-3 max-w-4xl mx-auto">
						{filteredThreads.map((thread) => (
							<EmailThread
								key={thread.threadId}
								thread={thread}
								onEmailClick={handleOpenEmail}
								onDeleteEmail={handleDeleteEmail}
								onDraftReply={handleDraftReply}
								onToggleStar={handleToggleStar}
								onSetReminder={handleSetReminder}
								onUpdateThreadStatus={handleUpdateThreadStatus}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
};
