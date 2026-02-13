/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import {
	AlertCircle,
	FileSignature,
	LogIn,
	LogOut,
	RefreshCw,
	User,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import ErrorBoundary from "../sidebar-tsx/ErrorBoundary.js";
import { VoidButtonBgDarken } from "../util/inputs.js";
import { useAccessor, useSettingsState } from "../util/services.js";

export const DocuSignSection: React.FC = () => {
	const accessor = useAccessor();
	const settingsState = useSettingsState();
	const voidSettingsService = accessor.get("IVoidSettingsService");
	const docuSignService = accessor.get("IDocuSignService");

	// Auth state
	const [authStatus, setAuthStatus] = useState<
		"signed_out" | "signing_in" | "signed_in" | "error"
	>("signed_out");
	const [userName, setUserName] = useState<string | null>(null);
	const [userEmail, setUserEmail] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isSigningIn, setIsSigningIn] = useState(false);

	// Listen for bundled config loaded

	// Sync with DocuSign service auth state
	useEffect(() => {
		const authState = docuSignService.authState;
		setAuthStatus(authState.status);
		setUserName(authState.session?.user?.name || null);
		setUserEmail(authState.session?.user?.email || null);
		setErrorMessage(authState.error || null);

		const disposable = docuSignService.onAuthStateChange((event) => {
			setAuthStatus(event.status);
			setUserName(event.user?.name || null);
			setUserEmail(event.user?.email || null);
			if (event.status === "signed_in") {
				setIsSigningIn(false);
			}
		});

		return () => disposable.dispose();
	}, [docuSignService]);

	const handleSignIn = useCallback(async () => {
		console.log("[DocuSignSection] handleSignIn clicked");

		try {
			setIsSigningIn(true);
			setErrorMessage(null);

			await docuSignService.startOAuthFlow();
		} catch (error: any) {
			const message = error.message || "Sign in failed";
			setErrorMessage(message);
			setIsSigningIn(false);
		}
	}, [docuSignService]);

	const handleSignOut = useCallback(async () => {
		try {
			await docuSignService.signOut();
		} catch (error) {
			console.error("[DocuSignSection] Sign out failed:", error);
		}
	}, [docuSignService]);

	// determine if sign-in is available (assume yes for bundled)
	const canSignIn = true;

	return (
		<ErrorBoundary>
			<div className="flex flex-col gap-4">
				<div className="flex items-center gap-2">
					<FileSignature className="size-6 text-void-fg-1" />
					<h2 className="text-3xl">DocuSign</h2>
				</div>

				<p className="text-void-fg-3 text-sm max-w-[600px]">
					Send documents for electronic signature directly from SafeAppeals.
					Connect your DocuSign account to enable e-signature workflows for your
					legal documents.
				</p>

				{/* Auth Section */}
				<div className="bg-void-bg-2 rounded-lg p-4 max-w-[400px]">
					{authStatus === "signed_out" && !isSigningIn && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-2 text-void-fg-3">
								<User className="size-4" />
								<span>Not connected to DocuSign</span>
							</div>

							{errorMessage && (
								<div className="text-amber-500 text-sm bg-amber-900/20 rounded p-2 flex items-start gap-2">
									<AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
									<span>{errorMessage}</span>
								</div>
							)}

							<VoidButtonBgDarken
								className="px-4 py-2 flex items-center justify-center gap-2"
								onClick={handleSignIn}
								disabled={!canSignIn}
							>
								<LogIn className="size-4" />
								Connect to DocuSign
							</VoidButtonBgDarken>
						</div>
					)}

					{(authStatus === "signing_in" || isSigningIn) && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-2 text-void-fg-3">
								<RefreshCw className="size-4 animate-spin" />
								<span>Connecting...</span>
							</div>
							<p className="text-void-fg-3 text-xs">
								Authenticating with DocuSign...
							</p>
						</div>
					)}

					{authStatus === "error" && (
						<div className="flex flex-col gap-3">
							<div className="text-red-500 text-sm flex items-start gap-2">
								<AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
								<span>{errorMessage || "An error occurred"}</span>
							</div>

							<VoidButtonBgDarken
								className="px-4 py-2 flex items-center justify-center gap-2"
								onClick={handleSignIn}
							>
								<LogIn className="size-4" />
								Try again
							</VoidButtonBgDarken>
						</div>
					)}

					{authStatus === "signed_in" && (
						<div className="flex flex-col gap-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<User className="size-4 text-green-500" />
									<span className="text-void-fg-2">
										{userName || userEmail || "Connected"}
									</span>
								</div>
								<button
									className="text-void-fg-3 hover:text-void-fg-1 text-sm flex items-center gap-1"
									onClick={handleSignOut}
								>
									<LogOut className="size-3" />
									Disconnect
								</button>
							</div>

							<div className="bg-void-bg-1 rounded p-3">
								<div className="flex items-center gap-2 text-green-500">
									<div className="size-2 rounded-full bg-green-500" />
									<span className="text-sm">Connected to DocuSign</span>
								</div>
								<p className="text-xs text-void-fg-3 mt-2">
									with SafeAppeals key
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Info Box */}
				<div className="text-void-fg-3 text-xs max-w-[400px] bg-void-bg-2/50 rounded p-3">
					<strong>Note:</strong> SafeAppeals includes built-in DocuSign
					integration. Just click "Connect to DocuSign" to get started.
				</div>
			</div>
		</ErrorBoundary>
	);
};

export default DocuSignSection;
