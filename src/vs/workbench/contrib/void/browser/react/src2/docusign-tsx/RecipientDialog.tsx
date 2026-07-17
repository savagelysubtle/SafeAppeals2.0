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
  onSuccess
}: RecipientDialogProps) => {
  const accessor = useAccessor();

  // State
  const [recipients, setRecipients] = useState<RecipientEntry[]>([
  { id: crypto.randomUUID(), name: "", email: "", role: "signer" }]
  );
  const [emailSubject, setEmailSubject] = useState(`Please sign: ${filename}`);
  const [emailMessage, setEmailMessage] = useState(
    "Please review and sign this document."
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
    { id: crypto.randomUUID(), name: "", email: "", role: "signer" }]
    );
  }, []);

  // Remove a recipient
  const removeRecipient = useCallback((id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Update recipient field
  const updateRecipient = useCallback(
    (id: string, field: keyof RecipientEntry, value: string) => {
      setRecipients((prev) =>
      prev.map((r) => r.id === id ? { ...r, [field]: value } : r)
      );
    },
    []
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
          routingOrder: index + 1
        })
      );

      // Send document for signature
      const envelopeId = await docuSignService.sendDocumentForSignature(
        { toString: () => documentUri } as any, // URI type
        documentBase64,
        docuSignRecipients,
        emailSubject,
        emailMessage
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
  onClose]
  );

  // Render sign-in prompt if not authenticated
  if (!isSignedIn) {
    return (
      <div className="void-fixed void-inset-0 void-z-50 void-flex void-items-center void-justify-center void-bg-black/50">
				<div className="void-bg-[var(--vscode-editor-background)] void-border void-border-[var(--vscode-widget-border)] void-rounded-lg void-shadow-xl void-w-[400px] void-p-6">
					<div className="void-flex void-items-center void-justify-between void-mb-4">
						<h2 className="void-text-lg void-font-semibold void-text-[var(--vscode-foreground)]">
							DocuSign Sign In Required
						</h2>
						<button
              onClick={onClose}
              className="void-p-1 hover:void-bg-[var(--vscode-toolbar-hoverBackground)] void-rounded">
              
							<X className="void-w-4 void-h-4" />
						</button>
					</div>

					<p className="void-text-sm void-text-[var(--vscode-descriptionForeground)] void-mb-6">
						Please sign in to DocuSign to send documents for electronic
						signature.
					</p>

					<div className="void-flex void-justify-end void-gap-2">
						<VoidButtonBgDarken onClick={onClose}>Cancel</VoidButtonBgDarken>
						<VoidButtonBgDarken
              onClick={handleSignIn}
              className="!void-bg-blue-600 hover:!void-bg-blue-700">
              
							<LogIn className="void-w-4 void-h-4 void-mr-2" />
							Sign in to DocuSign
						</VoidButtonBgDarken>
					</div>
				</div>
			</div>);

  }

  return (
    <div className="void-fixed void-inset-0 void-z-50 void-flex void-items-center void-justify-center void-bg-black/50">
			<div className="void-bg-[var(--vscode-editor-background)] void-border void-border-[var(--vscode-widget-border)] void-rounded-lg void-shadow-xl void-w-[500px] void-max-h-[80vh] void-overflow-hidden void-flex void-flex-col">
				{/* Header */}
				<div className="void-flex void-items-center void-justify-between void-px-4 void-py-3 void-border-b void-border-[var(--vscode-widget-border)]">
					<div className="void-flex void-items-center void-gap-2">
						<Send className="void-w-5 void-h-5 void-text-blue-500" />
						<h2 className="void-text-lg void-font-semibold void-text-[var(--vscode-foreground)]">
							Send for Signature
						</h2>
					</div>
					<button
            onClick={onClose}
            className="void-p-1 hover:void-bg-[var(--vscode-toolbar-hoverBackground)] void-rounded"
            disabled={isSending}>
            
						<X className="void-w-4 void-h-4" />
					</button>
				</div>

				{/* Content */}
				<div className="void-flex-1 void-overflow-y-auto void-p-4 void-space-y-4">
					{/* Document info */}
					<div className="void-text-sm void-text-[var(--vscode-descriptionForeground)]">
						Document:{" "}
						<span className="void-font-medium void-text-[var(--vscode-foreground)]">
							{filename}
						</span>
					</div>

					{/* Email subject */}
					<div>
						<label className="void-block void-text-sm void-font-medium void-text-[var(--vscode-foreground)] void-mb-1">
							Email Subject
						</label>
						<VoidInputBox
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Enter email subject..."
              disabled={isSending} />
            
					</div>

					{/* Email message */}
					<div>
						<label className="void-block void-text-sm void-font-medium void-text-[var(--vscode-foreground)] void-mb-1">
							Message (optional)
						</label>
						<textarea
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              placeholder="Add a message for recipients..."
              disabled={isSending}
              className="void-w-full void-px-3 void-py-2 void-text-sm void-rounded void-border void-border-[var(--vscode-input-border)] void-bg-[var(--vscode-input-background)] void-text-[var(--vscode-input-foreground)] placeholder:void-text-[var(--vscode-input-placeholderForeground)] focus:void-outline-none focus:void-ring-1 focus:void-ring-[var(--vscode-focusBorder)] void-resize-none"
              rows={2} />
            
					</div>

					{/* Recipients */}
					<div>
						<div className="void-flex void-items-center void-justify-between void-mb-2">
							<label className="void-text-sm void-font-medium void-text-[var(--vscode-foreground)]">
								Recipients
							</label>
							<button
                onClick={addRecipient}
                disabled={isSending}
                className="void-flex void-items-center void-gap-1 void-text-xs void-text-blue-500 hover:void-text-blue-600">
                
								<Plus className="void-w-3 void-h-3" />
								Add Recipient
							</button>
						</div>

						<div className="void-space-y-3">
							{recipients.map((recipient, index) =>
              <div
                key={recipient.id}
                className="void-p-3 void-rounded void-border void-border-[var(--vscode-widget-border)] void-bg-[var(--vscode-input-background)]">
                
									<div className="void-flex void-items-center void-justify-between void-mb-2">
										<span className="void-text-xs void-text-[var(--vscode-descriptionForeground)]">
											Recipient {index + 1}
										</span>
										{recipients.length > 1 &&
                  <button
                    onClick={() => removeRecipient(recipient.id)}
                    disabled={isSending}
                    className="void-p-1 void-text-red-500 hover:void-text-red-600 hover:void-bg-red-500/10 void-rounded">
                    
												<Trash2 className="void-w-3 void-h-3" />
											</button>
                  }
									</div>

									<div className="void-grid void-grid-cols-2 void-gap-2 void-mb-2">
										<div>
											<div className="void-flex void-items-center void-gap-1 void-mb-1">
												<User className="void-w-3 void-h-3 void-text-[var(--vscode-descriptionForeground)]" />
												<span className="void-text-xs void-text-[var(--vscode-descriptionForeground)]">
													Name
												</span>
											</div>
											<VoidInputBox
                      value={recipient.name}
                      onChange={(e) =>
                      updateRecipient(recipient.id, "name", e.target.value)
                      }
                      placeholder="Full name"
                      disabled={isSending} />
                    
										</div>
										<div>
											<div className="void-flex void-items-center void-gap-1 void-mb-1">
												<Mail className="void-w-3 void-h-3 void-text-[var(--vscode-descriptionForeground)]" />
												<span className="void-text-xs void-text-[var(--vscode-descriptionForeground)]">
													Email
												</span>
											</div>
											<VoidInputBox
                      value={recipient.email}
                      onChange={(e) =>
                      updateRecipient(recipient.id, "email", e.target.value)
                      }
                      placeholder="email@example.com"
                      disabled={isSending} />
                    
										</div>
									</div>

									<div>
										<span className="void-text-xs void-text-[var(--vscode-descriptionForeground)]">
											Role
										</span>
										<select
                    value={recipient.role}
                    onChange={(e) =>
                    updateRecipient(recipient.id, "role", e.target.value)
                    }
                    disabled={isSending}
                    className="void-w-full void-mt-1 void-px-2 void-py-1 void-text-sm void-rounded void-border void-border-[var(--vscode-input-border)] void-bg-[var(--vscode-input-background)] void-text-[var(--vscode-input-foreground)]">
                    
											<option value="signer">Signer (must sign)</option>
											<option value="carbonCopy">CC (receives copy)</option>
										</select>
									</div>
								</div>
              )}
						</div>
					</div>

					{/* Error message */}
					{error &&
          <div className="void-p-3 void-rounded void-bg-red-500/10 void-border void-border-red-500/30 void-text-sm void-text-red-500">
							{error}
						</div>
          }
				</div>

				{/* Footer */}
				<div className="void-flex void-items-center void-justify-end void-gap-2 void-px-4 void-py-3 void-border-t void-border-[var(--vscode-widget-border)]">
					<VoidButtonBgDarken onClick={onClose} disabled={isSending}>
						Cancel
					</VoidButtonBgDarken>
					<VoidButtonBgDarken
            onClick={handleSend}
            disabled={isSending}
            className="!void-bg-blue-600 hover:!void-bg-blue-700 disabled:void-opacity-50">
            
						{isSending ?
            <>
								<span className="void-animate-spin void-mr-2">⏳</span>
								Sending...
							</> :

            <>
								<Send className="void-w-4 void-h-4 void-mr-2" />
								Send for Signature
							</>
            }
					</VoidButtonBgDarken>
				</div>
			</div>
		</div>);

};

export default RecipientDialog;