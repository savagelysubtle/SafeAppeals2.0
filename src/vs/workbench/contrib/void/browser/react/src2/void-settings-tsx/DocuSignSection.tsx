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
  User } from
"lucide-react";
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
    "signed_out" | "signing_in" | "signed_in" | "error">(
    "signed_out");
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
			<div className="void-flex void-flex-col void-gap-4">
				<div className="void-flex void-items-center void-gap-2">
					<FileSignature className="void-size-6 void-text-void-fg-1" />
					<h2 className="void-text-3xl">DocuSign</h2>
				</div>

				<p className="void-text-void-fg-3 void-text-sm void-max-w-[600px]">
					Send documents for electronic signature directly from SafeAppeals.
					Connect your DocuSign account to enable e-signature workflows for your
					legal documents.
				</p>

				{/* Auth Section */}
				<div className="void-bg-void-bg-2 void-rounded-lg void-p-4 void-max-w-[400px]">
					{authStatus === "signed_out" && !isSigningIn &&
          <div className="void-flex void-flex-col void-gap-3">
							<div className="void-flex void-items-center void-gap-2 void-text-void-fg-3">
								<User className="void-size-4" />
								<span>Not connected to DocuSign</span>
							</div>

							{errorMessage &&
            <div className="void-text-amber-500 void-text-sm void-bg-amber-900/20 void-rounded void-p-2 void-flex void-items-start void-gap-2">
									<AlertCircle className="void-size-4 void-flex-shrink-0 void-mt-0.5" />
									<span>{errorMessage}</span>
								</div>
            }

							<VoidButtonBgDarken
              className="void-px-4 void-py-2 void-flex void-items-center void-justify-center void-gap-2"
              onClick={handleSignIn}
              disabled={!canSignIn}>
              
								<LogIn className="void-size-4" />
								Connect to DocuSign
							</VoidButtonBgDarken>
						</div>
          }

					{(authStatus === "signing_in" || isSigningIn) &&
          <div className="void-flex void-flex-col void-gap-3">
							<div className="void-flex void-items-center void-gap-2 void-text-void-fg-3">
								<RefreshCw className="void-size-4 void-animate-spin" />
								<span>Connecting...</span>
							</div>
							<p className="void-text-void-fg-3 void-text-xs">
								Authenticating with DocuSign...
							</p>
						</div>
          }

					{authStatus === "error" &&
          <div className="void-flex void-flex-col void-gap-3">
							<div className="void-text-red-500 void-text-sm void-flex void-items-start void-gap-2">
								<AlertCircle className="void-size-4 void-flex-shrink-0 void-mt-0.5" />
								<span>{errorMessage || "An error occurred"}</span>
							</div>

							<VoidButtonBgDarken
              className="void-px-4 void-py-2 void-flex void-items-center void-justify-center void-gap-2"
              onClick={handleSignIn}>
              
								<LogIn className="void-size-4" />
								Try again
							</VoidButtonBgDarken>
						</div>
          }

					{authStatus === "signed_in" &&
          <div className="void-flex void-flex-col void-gap-4">
							<div className="void-flex void-items-center void-justify-between">
								<div className="void-flex void-items-center void-gap-2">
									<User className="void-size-4 void-text-green-500" />
									<span className="void-text-void-fg-2">
										{userName || userEmail || "Connected"}
									</span>
								</div>
								<button
                className="void-text-void-fg-3 hover:void-text-void-fg-1 void-text-sm void-flex void-items-center void-gap-1"
                onClick={handleSignOut}>
                
									<LogOut className="void-size-3" />
									Disconnect
								</button>
							</div>

							<div className="void-bg-void-bg-1 void-rounded void-p-3">
								<div className="void-flex void-items-center void-gap-2 void-text-green-500">
									<div className="void-size-2 void-rounded-full void-bg-green-500" />
									<span className="void-text-sm">Connected to DocuSign</span>
								</div>
								<p className="void-text-xs void-text-void-fg-3 void-mt-2">
									with SafeAppeals key
								</p>
							</div>
						</div>
          }
				</div>

				{/* Info Box */}
				<div className="void-text-void-fg-3 void-text-xs void-max-w-[400px] void-bg-void-bg-2/50 void-rounded void-p-3">
					<strong>Note:</strong> SafeAppeals includes built-in DocuSign
					integration. Just click "Connect to DocuSign" to get started.
				</div>
			</div>
		</ErrorBoundary>);

};

export default DocuSignSection;