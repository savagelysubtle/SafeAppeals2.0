/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { LogIn, Mail, Plus, Send, Trash2, User, X } from "lucide-react";
import { useCallback, useState } from "react";
import { IDocuSignRecipientInput } from "../../../../common/docuSign/docuSignTypes.js";
import { VoidButtonBgDarken, VoidInputBox } from "../util/inputs.js";
import { useAccessor } from "../util/services.js";

interface RecipientDialogProps {
	/** Document filename for display */
	filename: string;
	/** Base64 encoded document content */
	documentBase64: string;
	/** Document URI for tracking */
	documentUri: string;
	/** Callback when dialog is closed */
	onClose: () => void;
	/** Callback when envelope is sent successfully */
	onSuccess?: (envelopeId: string) => void;
}

interface RecipientEntry {
	id: string;
	name: string;
	email: string;
	role: "signer" | "carbonCopy";
}

/**
 * Dialog component for adding recipients to a DocuSign envelope
 */
export const RecipientDialog = ({
	filename,
	documentBase64,
	documentUri,
	onClose,
	onSuccess,
}: RecipientDialogProps) => {
	const accessor = useAccessor();

	// State
	const [recipients, setRecipients] = useState<RecipientEntry[]>([
		{ id: crypto.randomUUID(), name: "", email: "", role: "signer" },
	]);
	const [emailSubject, setEmailSubject] = useState(`Please sign: ${filename}`);
	const [emailMessage, setEmailMessage] = useState(
		"Please review and sign this document.",
	);
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isSignedIn, setIsSignedIn] = useState(false);

	// Check auth state on mount
	useState(() => {
		const docuSignService = accessor.get("IDocuSignService");
		setIsSignedIn(docuSignService?.isSignedIn() ?? false);
	});

	// Add a new recipient
	const addRecipient = useCallback(() => {
		setRecipients((prev) => [
			...prev,
			{ id: crypto.randomUUID(), name: "", email: "", role: "signer" },
		]);
	}, []);

	// Remove a recipient
	const removeRecipient = useCallback((id: string) => {
		setRecipients((prev) => prev.filter((r) => r.id !== id));
	}, []);

	// Update recipient field
	const updateRecipient = useCallback(
		(id: string, field: keyof RecipientEntry, value: string) => {
			setRecipients((prev) =>
				prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
			);
		},
		[],
	);

	// Validate recipients
	const validateRecipients = (): string | null => {
		if (recipients.length === 0) {
			return "Please add at least one recipient.";
		}

		for (const recipient of recipients) {
			if (!recipient.name.trim()) {
				return "All recipients must have a name.";
			}
			if (!recipient.email.trim()) {
				return "All recipients must have an email address.";
			}
			// Basic email validation
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) {
				return `Invalid email address: ${recipient.email}`;
			}
		}

		return null;
	};

	// Handle DocuSign sign-in
	const handleSignIn = useCallback(async () => {
		try {
			const docuSignService = accessor.get("IDocuSignService");
			await docuSignService.signIn();
		} catch (err) {
			console.error("DocuSign sign in failed:", err);
			setError("Failed to sign in to DocuSign");
		}
	}, [accessor]);

	// Handle send
	const handleSend = useCallback(async () => {
		setError(null);

		// Validate
		const validationError = validateRecipients();
		if (validationError) {
			setError(validationError);
			return;
		}

		if (!emailSubject.trim()) {
			setError("Please enter an email subject.");
			return;
		}

		setIsSending(true);

		try {
			const docuSignService = accessor.get("IDocuSignService");

			// Convert recipients to DocuSign format
			const docuSignRecipients: IDocuSignRecipientInput[] = recipients.map(
				(r, index) => ({
					email: r.email.trim(),
					name: r.name.trim(),
					role: r.role,
					routingOrder: index + 1,
				}),
			);

			// Send document for signature
			const envelopeId = await docuSignService.sendDocumentForSignature(
				{ toString: () => documentUri } as any, // URI type
				documentBase64,
				docuSignRecipients,
				emailSubject,
				emailMessage,
			);

			console.log("[RecipientDialog] Envelope created:", envelopeId);

			// Success callback
			onSuccess?.(envelopeId);
			onClose();
		} catch (err) {
			console.error("Failed to send for signature:", err);
			setError(err instanceof Error ? err.message : "Failed to send document");
		} finally {
			setIsSending(false);
		}
	}, [
		recipients,
		emailSubject,
		emailMessage,
		accessor,
		documentBase64,
		documentUri,
		onSuccess,
		onClose,
	]);

	// Render sign-in prompt if not authenticated
	if (!isSignedIn) {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
				<div className="bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border)] rounded-lg shadow-xl w-[400px] p-6">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-semibold text-[var(--vscode-foreground)]">
							DocuSign Sign In Required
						</h2>
						<button
							onClick={onClose}
							className="p-1 hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded"
						>
							<X className="w-4 h-4" />
						</button>
					</div>

					<p className="text-sm text-[var(--vscode-descriptionForeground)] mb-6">
						Please sign in to DocuSign to send documents for electronic
						signature.
					</p>

					<div className="flex justify-end gap-2">
						<VoidButtonBgDarken onClick={onClose}>Cancel</VoidButtonBgDarken>
						<VoidButtonBgDarken
							onClick={handleSignIn}
							className="!bg-blue-600 hover:!bg-blue-700"
						>
							<LogIn className="w-4 h-4 mr-2" />
							Sign in to DocuSign
						</VoidButtonBgDarken>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div className="bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border)] rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-[var(--vscode-widget-border)]">
					<div className="flex items-center gap-2">
						<Send className="w-5 h-5 text-blue-500" />
						<h2 className="text-lg font-semibold text-[var(--vscode-foreground)]">
							Send for Signature
						</h2>
					</div>
					<button
						onClick={onClose}
						className="p-1 hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded"
						disabled={isSending}
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-4 space-y-4">
					{/* Document info */}
					<div className="text-sm text-[var(--vscode-descriptionForeground)]">
						Document:{" "}
						<span className="font-medium text-[var(--vscode-foreground)]">
							{filename}
						</span>
					</div>

					{/* Email subject */}
					<div>
						<label className="block text-sm font-medium text-[var(--vscode-foreground)] mb-1">
							Email Subject
						</label>
						<VoidInputBox
							value={emailSubject}
							onChange={(e) => setEmailSubject(e.target.value)}
							placeholder="Enter email subject..."
							disabled={isSending}
						/>
					</div>

					{/* Email message */}
					<div>
						<label className="block text-sm font-medium text-[var(--vscode-foreground)] mb-1">
							Message (optional)
						</label>
						<textarea
							value={emailMessage}
							onChange={(e) => setEmailMessage(e.target.value)}
							placeholder="Add a message for recipients..."
							disabled={isSending}
							className="w-full px-3 py-2 text-sm rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)] resize-none"
							rows={2}
						/>
					</div>

					{/* Recipients */}
					<div>
						<div className="flex items-center justify-between mb-2">
							<label className="text-sm font-medium text-[var(--vscode-foreground)]">
								Recipients
							</label>
							<button
								onClick={addRecipient}
								disabled={isSending}
								className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
							>
								<Plus className="w-3 h-3" />
								Add Recipient
							</button>
						</div>

						<div className="space-y-3">
							{recipients.map((recipient, index) => (
								<div
									key={recipient.id}
									className="p-3 rounded border border-[var(--vscode-widget-border)] bg-[var(--vscode-input-background)]"
								>
									<div className="flex items-center justify-between mb-2">
										<span className="text-xs text-[var(--vscode-descriptionForeground)]">
											Recipient {index + 1}
										</span>
										{recipients.length > 1 && (
											<button
												onClick={() => removeRecipient(recipient.id)}
												disabled={isSending}
												className="p-1 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded"
											>
												<Trash2 className="w-3 h-3" />
											</button>
										)}
									</div>

									<div className="grid grid-cols-2 gap-2 mb-2">
										<div>
											<div className="flex items-center gap-1 mb-1">
												<User className="w-3 h-3 text-[var(--vscode-descriptionForeground)]" />
												<span className="text-xs text-[var(--vscode-descriptionForeground)]">
													Name
												</span>
											</div>
											<VoidInputBox
												value={recipient.name}
												onChange={(e) =>
													updateRecipient(recipient.id, "name", e.target.value)
												}
												placeholder="Full name"
												disabled={isSending}
											/>
										</div>
										<div>
											<div className="flex items-center gap-1 mb-1">
												<Mail className="w-3 h-3 text-[var(--vscode-descriptionForeground)]" />
												<span className="text-xs text-[var(--vscode-descriptionForeground)]">
													Email
												</span>
											</div>
											<VoidInputBox
												value={recipient.email}
												onChange={(e) =>
													updateRecipient(recipient.id, "email", e.target.value)
												}
												placeholder="email@example.com"
												disabled={isSending}
											/>
										</div>
									</div>

									<div>
										<span className="text-xs text-[var(--vscode-descriptionForeground)]">
											Role
										</span>
										<select
											value={recipient.role}
											onChange={(e) =>
												updateRecipient(recipient.id, "role", e.target.value)
											}
											disabled={isSending}
											className="w-full mt-1 px-2 py-1 text-sm rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]"
										>
											<option value="signer">Signer (must sign)</option>
											<option value="carbonCopy">CC (receives copy)</option>
										</select>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Error message */}
					{error && (
						<div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-sm text-red-500">
							{error}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--vscode-widget-border)]">
					<VoidButtonBgDarken onClick={onClose} disabled={isSending}>
						Cancel
					</VoidButtonBgDarken>
					<VoidButtonBgDarken
						onClick={handleSend}
						disabled={isSending}
						className="!bg-blue-600 hover:!bg-blue-700 disabled:opacity-50"
					>
						{isSending ? (
							<>
								<span className="animate-spin mr-2">⏳</span>
								Sending...
							</>
						) : (
							<>
								<Send className="w-4 h-4 mr-2" />
								Send for Signature
							</>
						)}
					</VoidButtonBgDarken>
				</div>
			</div>
		</div>
	);
};

export default RecipientDialog;
