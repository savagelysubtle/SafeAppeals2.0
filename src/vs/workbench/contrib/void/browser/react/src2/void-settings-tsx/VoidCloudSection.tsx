/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { AlertTriangle, Cloud, LogIn, LogOut, RefreshCw, User, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ProviderName } from "../../../../common/voidSettingsTypes.js";
import ErrorBoundary from "../sidebar-tsx/ErrorBoundary.js";
import { VoidButtonBgDarken } from "../util/inputs.js";
import { useAccessor, useSettingsState, useVoidCloudState } from "../util/services.js";

const LOW_CREDITS_THRESHOLD = 1000;

// Providers supported by SafeAppeals Cloud
const cloudSupportedProviderNames: ProviderName[] = ['anthropic', 'openAI', 'gemini'];

export const VoidCloudSection = () => {
  const accessor = useAccessor();
  const voidSettingsService = accessor.get('IVoidSettingsService');
  const settingsState = useSettingsState();
  const { authState, creditBalance, isOnline, signInWithGoogle, signOut, createCheckoutSession, refreshBalance } = useVoidCloudState();

  // Track signing in state locally (for spinner)
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if cloud providers need to be enabled
  const needsCloudSetup = authState.status === 'signed_in' && (
  !settingsState.globalSettings.voidCloudEnabled ||
  cloudSupportedProviderNames.some((pn) => !settingsState.globalSettings.voidCloudModeOfProvider[pn]) ||
  cloudSupportedProviderNames.some((pn) => !settingsState.settingsOfProvider[pn]._didFillInProviderSettings) ||
  cloudSupportedProviderNames.some((pn) =>
  settingsState.settingsOfProvider[pn].models.some((m) => m.isHidden)
  ) ||
  settingsState.modelSelectionOfFeature['Chat'] === null);


  // Auto-enable cloud mode for all supported providers when user is signed in
  // Runs whenever needsCloudSetup is true
  useEffect(() => {
    if (!needsCloudSetup) return;

    // Enable cloud globally
    if (!settingsState.globalSettings.voidCloudEnabled) {
      voidSettingsService.setGlobalSetting('voidCloudEnabled', true);
    }

    // Enable cloud mode for all supported providers
    const currentCloudModes = settingsState.globalSettings.voidCloudModeOfProvider;
    const needsCloudModeUpdate = cloudSupportedProviderNames.some((pn) => !currentCloudModes[pn]);

    if (needsCloudModeUpdate) {
      const newCloudModes = { ...currentCloudModes };
      for (const providerName of cloudSupportedProviderNames) {
        newCloudModes[providerName] = true;
      }
      voidSettingsService.setGlobalSetting('voidCloudModeOfProvider', newCloudModes);
    }

    // Enable all cloud-supported providers and unhide their models
    for (const providerName of cloudSupportedProviderNames) {
      // Unhide (enable) the first hidden model for this provider (one at a time to avoid state issues)
      const models = settingsState.settingsOfProvider[providerName].models;
      const firstHiddenModel = models.find((m) => m.isHidden);
      if (firstHiddenModel) {
        voidSettingsService.toggleModelHidden(providerName, firstHiddenModel.modelName);
        return; // Return early to let state update, effect will re-run
      }
    }

    // Auto-select a default model for Chat if none is selected
    const defaultCloudModel = { providerName: 'anthropic' as ProviderName, modelName: 'claude-sonnet-4.5' };

    if (settingsState.modelSelectionOfFeature['Chat'] === null) {
      voidSettingsService.setModelSelectionOfFeature('Chat', defaultCloudModel);
    }
    // Also set for Quick Edit (Ctrl+K) if not set
    if (settingsState.modelSelectionOfFeature['Ctrl+K'] === null) {
      voidSettingsService.setModelSelectionOfFeature('Ctrl+K', defaultCloudModel);
    }
  }, [needsCloudSetup, settingsState, voidSettingsService]);

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

  const handleRefreshBalance = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await refreshBalance();
    } catch (error) {
      console.error("Balance refresh failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshBalance]);

  const handleBuyCredits = useCallback(
    async (pack: "starter" | "pro" | "power") => {
      try {
        const nativeHostService = accessor.get("INativeHostService");
        const checkoutUrl = await createCheckoutSession(pack);
        await nativeHostService.openExternal(checkoutUrl);
      } catch (error) {
        console.error("Buy credits failed:", error);
      }
    },
    [accessor, createCheckoutSession]
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
			<div className="void-flex void-flex-col void-gap-4">
				<div className="void-flex void-items-center void-gap-2">
					<Cloud className="void-size-6 void-text-void-fg-1" />
					<h2 className="void-text-3xl">SafeAppeals Cloud</h2>
				</div>

				<p className="void-text-void-fg-3 void-text-sm void-max-w-[600px]">
					Use AI models without managing API keys. Purchase credits to access
					Claude, GPT-4, Gemini, and more. Your existing BYOK (Bring Your Own
					Key) setup will continue to work for free.
				</p>

				{/* Offline Banner */}
				{!isOnline &&
        <div className="void-max-w-[400px] void-bg-amber-900/30 void-border void-border-amber-600/50 void-rounded-lg void-p-3 void-flex void-items-center void-gap-3">
						<WifiOff className="void-size-5 void-text-amber-500 void-flex-shrink-0" />
						<div>
							<div className="void-text-amber-500 void-font-medium void-text-sm">No Internet Connection</div>
							<div className="void-text-amber-500/80 void-text-xs">
								Cloud features are unavailable. Check your network connection.
							</div>
						</div>
					</div>
        }

				{/* Status Section */}
				<div className="void-bg-void-bg-2 void-rounded-lg void-p-4 void-max-w-[400px]">
					{status === "signed_out" && !showSigningIn &&
          <div className="void-flex void-flex-col void-gap-3">
							<div className="void-flex void-items-center void-gap-2 void-text-void-fg-3">
								<User className="void-size-4" />
								<span>Not signed in</span>
							</div>
							<VoidButtonBgDarken
              className="void-px-4 void-py-2 void-flex void-items-center void-justify-center void-gap-2"
              onClick={handleSignIn}>
              
								<LogIn className="void-size-4" />
								Sign in with Google
							</VoidButtonBgDarken>
						</div>
          }

					{(status === "signing_in" || showSigningIn) &&
          <div className="void-flex void-flex-col void-gap-3">
							<div className="void-flex void-items-center void-gap-2 void-text-void-fg-3">
								<RefreshCw className="void-size-4 void-animate-spin" />
								<span>Signing in... Check your browser</span>
							</div>
							<p className="void-text-void-fg-3 void-text-xs">
								A browser window should open. Complete the sign-in there.
							</p>
						</div>
          }

					{status === "error" &&
          <div className="void-flex void-flex-col void-gap-3">
							<div className="void-text-red-500 void-text-sm">
								{authState.error || "An error occurred"}
							</div>
							<VoidButtonBgDarken
              className="void-px-4 void-py-2 void-flex void-items-center void-justify-center void-gap-2"
              onClick={handleSignIn}>
              
								<LogIn className="void-size-4" />
								Try again
							</VoidButtonBgDarken>
						</div>
          }

					{status === "signed_in" && user &&
          <div className="void-flex void-flex-col void-gap-4">
							{/* User Info */}
							<div className="void-flex void-items-center void-justify-between">
								<div className="void-flex void-items-center void-gap-2">
									<User className="void-size-4 void-text-void-fg-3" />
									<span className="void-text-void-fg-2">
										{user.displayName || user.email}
									</span>
								</div>
								<button
                className="void-text-void-fg-3 hover:void-text-void-fg-1 void-text-sm void-flex void-items-center void-gap-1"
                onClick={handleSignOut}>
                
									<LogOut className="void-size-3" />
									Sign out
								</button>
							</div>

							{/* Credits Balance */}
							<div className="void-bg-void-bg-1 void-rounded void-p-3">
								<div className="void-flex void-items-center void-justify-between void-mb-1">
									<div className="void-text-void-fg-3 void-text-xs void-uppercase void-tracking-wide">
										Credits Balance
									</div>
									<button
                  className="void-text-void-fg-3 hover:void-text-void-fg-1 void-p-1 void-rounded void-transition-colors"
                  onClick={handleRefreshBalance}
                  disabled={isRefreshing}
                  title="Refresh balance">
                  
										<RefreshCw className={`void-size-3 ${isRefreshing ? "void-animate-spin" : ""}`} />
									</button>
								</div>
								<div className="void-text-2xl void-font-semibold void-text-void-fg-1">
									{formatCredits(creditBalance)} tokens
								</div>
								{/* Low credits warning */}
								{creditBalance > 0 && creditBalance < LOW_CREDITS_THRESHOLD &&
              <div className="void-mt-2 void-flex void-items-center void-gap-2 void-text-amber-500 void-text-sm">
										<AlertTriangle className="void-size-4" />
										<span>Credits running low! Consider buying more.</span>
									</div>
              }
								{/* Zero credits warning */}
								{creditBalance === 0 &&
              <div className="void-mt-2 void-flex void-items-center void-gap-2 void-text-red-500 void-text-sm">
										<AlertTriangle className="void-size-4" />
										<span>No credits remaining. Buy credits to continue using cloud models.</span>
									</div>
              }
							</div>

							{/* Buy Credits */}
							<div className="void-flex void-flex-col void-gap-2">
								<div className="void-text-void-fg-3 void-text-sm">Buy more credits:</div>
								<div className="void-flex void-gap-2">
									<button
                  className="void-flex-1 void-bg-void-bg-1 hover:void-bg-void-bg-3 void-border void-border-void-border-1 void-rounded void-p-2 void-text-center void-transition-colors"
                  onClick={() => handleBuyCredits("starter")}>
                  
										<div className="void-font-medium">Starter</div>
										<div className="void-text-void-fg-3 void-text-xs">
											700K tokens • $30
										</div>
									</button>
									<button
                  className="void-flex-1 void-bg-void-bg-1 hover:void-bg-void-bg-3 void-border void-border-void-border-1 void-rounded void-p-2 void-text-center void-transition-colors void-relative"
                  onClick={() => handleBuyCredits("pro")}>
                  
										<div className="void-absolute -void-top-2 void-right-2 void-bg-green-600 void-text-white void-text-[10px] void-px-1.5 void-py-0.5 void-rounded">
											Best Value
										</div>
										<div className="void-font-medium">Pro</div>
										<div className="void-text-void-fg-3 void-text-xs">
											2M tokens • $65
										</div>
									</button>
									<button
                  className="void-flex-1 void-bg-void-bg-1 hover:void-bg-void-bg-3 void-border void-border-void-border-1 void-rounded void-p-2 void-text-center void-transition-colors void-relative"
                  onClick={() => handleBuyCredits("power")}>
                  
										<div className="void-absolute -void-top-2 void-right-2 void-bg-blue-600 void-text-white void-text-[10px] void-px-1.5 void-py-0.5 void-rounded">
											39% off
										</div>
										<div className="void-font-medium">Power</div>
										<div className="void-text-void-fg-3 void-text-xs">
											5M tokens • $130
										</div>
									</button>
								</div>
							</div>
						</div>
          }
				</div>

				{/* Info Box */}
				<div className="void-text-void-fg-3 void-text-xs void-max-w-[400px] void-bg-void-bg-2/50 void-rounded void-p-3">
					<strong>How it works:</strong> Credits are deducted based on token
					usage. Input tokens cost less than output tokens. Credits never
					expire. You can always use your own API keys for free.
				</div>
			</div>
		</ErrorBoundary>);

};

export default VoidCloudSection;