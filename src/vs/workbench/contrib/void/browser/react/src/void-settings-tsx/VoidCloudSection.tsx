/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useState } from "react";
import { AlertTriangle, Cloud, LogIn, LogOut, RefreshCw, User, WifiOff } from "lucide-react";
import { VoidButtonBgDarken } from "../util/inputs.js";
import { useAccessor, useVoidCloudState } from "../util/services.js";
import ErrorBoundary from "../sidebar-tsx/ErrorBoundary.js";

const LOW_CREDITS_THRESHOLD = 1000;

export const VoidCloudSection = () => {
	const accessor = useAccessor();
	const { authState, creditBalance, isOnline, signInWithGoogle, signOut, createCheckoutSession } = useVoidCloudState();

	// Track signing in state locally (for spinner)
	const [isSigningIn, setIsSigningIn] = useState(false);

	const handleSignIn = useCallback(async () => {
		try {
			setIsSigningIn(true);
			await signInWithGoogle();
		} catch (error) {
			console.error("Sign in failed:", error);
		}
		// Note: isSigningIn will be reset when authState changes
	}, [signInWithGoogle]);

	const handleSignOut = useCallback(async () => {
		try {
			await signOut();
		} catch (error) {
			console.error("Sign out failed:", error);
		}
	}, [signOut]);

	const handleBuyCredits = useCallback(
		async (pack: "starter" | "pro") => {
			try {
				const nativeHostService = accessor.get("INativeHostService");
				await nativeHostService.openExternal("https://safeappeals-cloud.vercel.app");
			} catch (error) {
				console.error("Buy credits failed:", error);
			}
		},
		[accessor]
	);

	const formatCredits = (credits: number) => {
		if (credits >= 1000000) {
			return `${(credits / 1000000).toFixed(1)}M`;
		} else if (credits >= 1000) {
			return `${(credits / 1000).toFixed(0)}K`;
		}
		return credits.toString();
	};

	// Determine display status
	const status = authState.status;
	const user = authState.session?.user;
	const showSigningIn = isSigningIn && status !== 'signed_in' && status !== 'error';

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

				{/* Offline Banner */}
				{!isOnline && (
					<div className="max-w-[400px] bg-amber-900/30 border border-amber-600/50 rounded-lg p-3 flex items-center gap-3">
						<WifiOff className="size-5 text-amber-500 flex-shrink-0" />
						<div>
							<div className="text-amber-500 font-medium text-sm">No Internet Connection</div>
							<div className="text-amber-500/80 text-xs">
								Cloud features are unavailable. Check your network connection.
							</div>
						</div>
					</div>
				)}

				{/* Status Section */}
				<div className="bg-void-bg-2 rounded-lg p-4 max-w-[400px]">
					{status === "signed_out" && !showSigningIn && (
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

					{(status === "signing_in" || showSigningIn) && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-2 text-void-fg-3">
								<RefreshCw className="size-4 animate-spin" />
								<span>Signing in... Check your browser</span>
							</div>
							<p className="text-void-fg-3 text-xs">
								A browser window should open. Complete the sign-in there.
							</p>
						</div>
					)}

					{status === "error" && (
						<div className="flex flex-col gap-3">
							<div className="text-red-500 text-sm">
								{authState.error || "An error occurred"}
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

					{status === "signed_in" && user && (
						<div className="flex flex-col gap-4">
							{/* User Info */}
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<User className="size-4 text-void-fg-3" />
									<span className="text-void-fg-2">
										{user.displayName || user.email}
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
									{formatCredits(creditBalance)} tokens
								</div>
								{/* Low credits warning */}
								{creditBalance > 0 && creditBalance < LOW_CREDITS_THRESHOLD && (
									<div className="mt-2 flex items-center gap-2 text-amber-500 text-sm">
										<AlertTriangle className="size-4" />
										<span>Credits running low! Consider buying more.</span>
									</div>
								)}
								{/* Zero credits warning */}
								{creditBalance === 0 && (
									<div className="mt-2 flex items-center gap-2 text-red-500 text-sm">
										<AlertTriangle className="size-4" />
										<span>No credits remaining. Buy credits to continue using cloud models.</span>
									</div>
								)}
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
											700K tokens • $30
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
											1.4M tokens • $60
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
