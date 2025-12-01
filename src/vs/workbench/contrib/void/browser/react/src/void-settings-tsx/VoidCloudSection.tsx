/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useState } from "react";
import { Cloud, CreditCard, LogIn, LogOut, RefreshCw, User } from "lucide-react";
import { VoidButtonBgDarken } from "../util/inputs.js";
import { useAccessor } from "../util/services.js";
import ErrorBoundary from "../sidebar-tsx/ErrorBoundary.js";

interface CloudState {
	status: "signed_out" | "signing_in" | "signed_in" | "error";
	user: {
		email: string;
		displayName: string | null;
	} | null;
	credits: number;
	error: string | null;
}

export const VoidCloudSection = () => {
	const accessor = useAccessor();

	// Local state to track cloud status
	// In production, this would be connected to IVoidCloudService
	const [cloudState, setCloudState] = useState<CloudState>({
		status: "signed_out",
		user: null,
		credits: 0,
		error: null,
	});

	// These will be connected to the actual service
	const handleSignIn = useCallback(async () => {
		try {
			setCloudState((prev) => ({ ...prev, status: "signing_in", error: null }));

			// Get the cloud service - this will be properly injected
			const cloudService = accessor.get("IVoidCloudService");
			if (cloudService && "signInWithGoogle" in cloudService) {
				await (cloudService as any).signInWithGoogle();
			} else {
				// Fallback: open the auth URL manually
				const settingsService = accessor.get("IVoidSettingsService");
				const apiUrl =
					settingsService.state.globalSettings.voidCloudApiUrl ||
					"https://void-cloud-production.up.railway.app";
				const authUrl = `${apiUrl}/auth/google?redirect_uri=${encodeURIComponent(
					"safe-appeals-navigator://auth/callback"
				)}`;

				// Open in browser
				const nativeHostService = accessor.get("INativeHostService");
				await nativeHostService.openExternal(authUrl);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Sign in failed";
			setCloudState((prev) => ({
				...prev,
				status: "error",
				error: message,
			}));
		}
	}, [accessor]);

	const handleSignOut = useCallback(async () => {
		try {
			const cloudService = accessor.get("IVoidCloudService");
			if (cloudService && "signOut" in cloudService) {
				await (cloudService as any).signOut();
			}
			setCloudState({
				status: "signed_out",
				user: null,
				credits: 0,
				error: null,
			});
		} catch (error) {
			console.error("Sign out failed:", error);
		}
	}, [accessor]);

	const handleBuyCredits = useCallback(
		async (pack: "starter" | "pro") => {
			try {
				const cloudService = accessor.get("IVoidCloudService");
				if (cloudService && "createCheckoutSession" in cloudService) {
					const checkoutUrl = await (cloudService as any).createCheckoutSession(
						pack
					);
					const nativeHostService = accessor.get("INativeHostService");
					await nativeHostService.openExternal(checkoutUrl);
				}
			} catch (error) {
				console.error("Buy credits failed:", error);
			}
		},
		[accessor]
	);

	// Listen for auth state changes
	useEffect(() => {
		const cloudService = accessor.get("IVoidCloudService");
		if (!cloudService || !("onAuthStateChange" in cloudService)) {
			return;
		}

		const disposable = (cloudService as any).onAuthStateChange(
			(event: { status: string; user: any }) => {
				setCloudState((prev) => ({
					...prev,
					status: event.status as CloudState["status"],
					user: event.user,
				}));
			}
		);

		const balanceDisposable = (cloudService as any).onBalanceChange?.(
			(event: { balance: number }) => {
				setCloudState((prev) => ({
					...prev,
					credits: event.balance,
				}));
			}
		);

		return () => {
			disposable?.dispose?.();
			balanceDisposable?.dispose?.();
		};
	}, [accessor]);

	const formatCredits = (credits: number) => {
		if (credits >= 1000000) {
			return `${(credits / 1000000).toFixed(1)}M`;
		} else if (credits >= 1000) {
			return `${(credits / 1000).toFixed(0)}K`;
		}
		return credits.toString();
	};

	return (
		<ErrorBoundary>
			<div className="flex flex-col gap-4">
				<div className="flex items-center gap-2">
					<Cloud className="size-6 text-void-fg-1" />
					<h2 className="text-3xl">SafeAppeals Cloud</h2>
				</div>

				<p className="text-void-fg-3 text-sm max-w-[600px]">
					Use AI models without managing API keys. Purchase credits to access
					Claude, GPT-4, Gemini, and more. Your existing BYOK (Bring Your Own
					Key) setup will continue to work for free.
				</p>

				{/* Status Section */}
				<div className="bg-void-bg-2 rounded-lg p-4 max-w-[400px]">
					{cloudState.status === "signed_out" && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-2 text-void-fg-3">
								<User className="size-4" />
								<span>Not signed in</span>
							</div>
							<VoidButtonBgDarken
								className="px-4 py-2 flex items-center justify-center gap-2"
								onClick={handleSignIn}
							>
								<LogIn className="size-4" />
								Sign in with Google
							</VoidButtonBgDarken>
						</div>
					)}

					{cloudState.status === "signing_in" && (
						<div className="flex items-center gap-2 text-void-fg-3">
							<RefreshCw className="size-4 animate-spin" />
							<span>Signing in...</span>
						</div>
					)}

					{cloudState.status === "error" && (
						<div className="flex flex-col gap-3">
							<div className="text-red-500 text-sm">
								{cloudState.error || "An error occurred"}
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

					{cloudState.status === "signed_in" && cloudState.user && (
						<div className="flex flex-col gap-4">
							{/* User Info */}
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<User className="size-4 text-void-fg-3" />
									<span className="text-void-fg-2">
										{cloudState.user.displayName || cloudState.user.email}
									</span>
								</div>
								<button
									className="text-void-fg-3 hover:text-void-fg-1 text-sm flex items-center gap-1"
									onClick={handleSignOut}
								>
									<LogOut className="size-3" />
									Sign out
								</button>
							</div>

							{/* Credits Balance */}
							<div className="bg-void-bg-1 rounded p-3">
								<div className="text-void-fg-3 text-xs uppercase tracking-wide mb-1">
									Credits Balance
								</div>
								<div className="text-2xl font-semibold text-void-fg-1">
									{formatCredits(cloudState.credits)} tokens
								</div>
							</div>

							{/* Buy Credits */}
							<div className="flex flex-col gap-2">
								<div className="text-void-fg-3 text-sm">Buy more credits:</div>
								<div className="flex gap-2">
									<button
										className="flex-1 bg-void-bg-1 hover:bg-void-bg-3 border border-void-border-1 rounded p-2 text-center transition-colors"
										onClick={() => handleBuyCredits("starter")}
									>
										<div className="font-medium">Starter</div>
										<div className="text-void-fg-3 text-xs">
											250K tokens • $10
										</div>
									</button>
									<button
										className="flex-1 bg-void-bg-1 hover:bg-void-bg-3 border border-void-border-1 rounded p-2 text-center transition-colors relative"
										onClick={() => handleBuyCredits("pro")}
									>
										<div className="absolute -top-2 right-2 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded">
											Best Value
										</div>
										<div className="font-medium">Pro</div>
										<div className="text-void-fg-3 text-xs">
											750K tokens • $25
										</div>
									</button>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Info Box */}
				<div className="text-void-fg-3 text-xs max-w-[400px] bg-void-bg-2/50 rounded p-3">
					<strong>How it works:</strong> Credits are deducted based on token
					usage. Input tokens cost less than output tokens. Credits never
					expire. You can always use your own API keys for free.
				</div>
			</div>
		</ErrorBoundary>
	);
};

export default VoidCloudSection;

