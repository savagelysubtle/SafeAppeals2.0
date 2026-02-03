/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import {
	AlertCircle,
	Check,
	ChevronDown,
	ChevronUp,
	FileSignature,
	Key,
	KeyRound,
	LogIn,
	LogOut,
	RefreshCw,
	Settings,
	Shield,
	User,
	UserCircle,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import ErrorBoundary from "../sidebar-tsx/ErrorBoundary.js";
import {
	VoidButtonBgDarken,
	VoidSimpleInputBox,
	VoidSwitch,
} from "../util/inputs.js";
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

	// Settings
	const [integrationKey, setIntegrationKey] = useState("");
	const [userId, setUserId] = useState("");
	const [environment, setEnvironment] = useState<"demo" | "production">("demo");
	const [useCustomKey, setUseCustomKey] = useState(false);
	const [showAdvanced, setShowAdvanced] = useState(false);

	// Private key state
	const [privateKeyInput, setPrivateKeyInput] = useState("");
	const [hasPrivateKey, setHasPrivateKey] = useState(false);
	const [isStoringKey, setIsStoringKey] = useState(false);
	const [keyError, setKeyError] = useState<string | null>(null);
	const [keySuccess, setKeySuccess] = useState(false);

	// Consent state
	const [consentStatus, setConsentStatus] = useState<
		"unknown" | "granted" | "required" | "error"
	>("unknown");
	const [isCheckingConsent, setIsCheckingConsent] = useState(false);

	// Check if bundled key is available
	const [hasBundledKey, setHasBundledKey] = useState(
		docuSignService.hasBundledIntegrationKey(),
	);

	// Listen for bundled config loaded
	useEffect(() => {
		setHasBundledKey(docuSignService.hasBundledIntegrationKey());

		const disposable = docuSignService.onBundledConfigLoaded((hasKey) => {
			setHasBundledKey(hasKey);
			console.log("[DocuSignSection] Bundled config loaded, hasKey:", hasKey);
		});

		return () => disposable.dispose();
	}, [docuSignService]);

	// Check if private key is configured
	useEffect(() => {
		const checkPrivateKey = async () => {
			try {
				const hasKey = await docuSignService.hasPrivateKey();
				setHasPrivateKey(hasKey);
			} catch (error) {
				console.error("[DocuSignSection] Error checking private key:", error);
			}
		};
		checkPrivateKey();
	}, [docuSignService]);

	// Load current settings
	useEffect(() => {
		const docuSignSettings = settingsState.globalSettings.docuSign;
		if (docuSignSettings) {
			setIntegrationKey(docuSignSettings.integrationKey || "");
			setUserId(docuSignSettings.userId || "");
			setEnvironment(docuSignSettings.environment || "demo");
			setUseCustomKey(docuSignSettings.useCustomKey || false);
			setConsentStatus(docuSignSettings.consentStatus || "unknown");
		}
	}, [settingsState.globalSettings.docuSign]);

	// Sync with DocuSign service auth state
	useEffect(() => {
		const authState = docuSignService.authState;
		setAuthStatus(authState.status);
		setUserName(authState.session?.user?.name || null);
		setUserEmail(authState.session?.user?.email || null);
		setErrorMessage(authState.error || null);

		// Check for consent_required error
		if (authState.error === "consent_required") {
			setConsentStatus("required");
		}

		const disposable = docuSignService.onAuthStateChange((event) => {
			setAuthStatus(event.status);
			setUserName(event.user?.name || null);
			setUserEmail(event.user?.email || null);
			if (event.status === "signed_in") {
				setIsSigningIn(false);
				setConsentStatus("granted");
			}
		});

		return () => disposable.dispose();
	}, [docuSignService]);

	const handleSignIn = useCallback(async () => {
		// Validate configuration
		const effectiveIntegrationKey = useCustomKey
			? integrationKey
			: hasBundledKey
				? "bundled"
				: "";

		if (useCustomKey && !integrationKey) {
			setErrorMessage("Please enter your DocuSign Integration Key");
			setShowAdvanced(true);
			return;
		}

		if (!useCustomKey && !hasBundledKey) {
			setErrorMessage(
				"DocuSign is not configured. Please configure in Advanced Settings.",
			);
			setUseCustomKey(true);
			setShowAdvanced(true);
			return;
		}

		// For JWT flow, we need User ID and private key
		if (!userId && useCustomKey) {
			setErrorMessage("Please enter your DocuSign User ID");
			setShowAdvanced(true);
			return;
		}

		if (!hasPrivateKey && useCustomKey) {
			setErrorMessage("Please configure your DocuSign private key");
			setShowAdvanced(true);
			return;
		}

		try {
			setIsSigningIn(true);
			setErrorMessage(null);
			await docuSignService.signIn();
		} catch (error: any) {
			const message = error.message || "Sign in failed";
			if (message.includes("consent_required")) {
				setConsentStatus("required");
				setErrorMessage("Please grant consent before signing in");
			} else {
				setErrorMessage(message);
			}
			setIsSigningIn(false);
		}
	}, [
		docuSignService,
		integrationKey,
		userId,
		hasPrivateKey,
		useCustomKey,
		hasBundledKey,
	]);

	const handleSignOut = useCallback(async () => {
		try {
			await docuSignService.signOut();
		} catch (error) {
			console.error("[DocuSignSection] Sign out failed:", error);
		}
	}, [docuSignService]);

	const handleSaveSettings = useCallback(() => {
		voidSettingsService.setGlobalSetting("docuSign", {
			integrationKey,
			userId,
			environment,
			accountId: settingsState.globalSettings.docuSign?.accountId || "",
			useCustomKey,
			authMode: "jwt",
			consentStatus,
			privateKeyConfigured: hasPrivateKey,
		});
	}, [
		voidSettingsService,
		integrationKey,
		userId,
		environment,
		useCustomKey,
		consentStatus,
		hasPrivateKey,
		settingsState.globalSettings.docuSign?.accountId,
	]);

	const handleToggleUseCustomKey = useCallback(
		(value: boolean) => {
			setUseCustomKey(value);
			voidSettingsService.setGlobalSetting("docuSign", {
				...settingsState.globalSettings.docuSign,
				useCustomKey: value,
			});
		},
		[voidSettingsService, settingsState.globalSettings.docuSign],
	);

	const handleStorePrivateKey = useCallback(async () => {
		if (!privateKeyInput.trim()) {
			setKeyError("Please paste your private key");
			return;
		}

		setIsStoringKey(true);
		setKeyError(null);
		setKeySuccess(false);

		try {
			const result = await docuSignService.storePrivateKey(privateKeyInput);
			if (result.success) {
				setHasPrivateKey(true);
				setPrivateKeyInput("");
				setKeySuccess(true);
				setTimeout(() => setKeySuccess(false), 3000);
			} else {
				setKeyError(result.error || "Failed to store private key");
			}
		} catch (error: any) {
			setKeyError(error.message || "Failed to store private key");
		} finally {
			setIsStoringKey(false);
		}
	}, [docuSignService, privateKeyInput]);

	const handleGrantConsent = useCallback(async () => {
		try {
			await docuSignService.openConsentPage();
		} catch (error: any) {
			setErrorMessage(error.message || "Failed to open consent page");
		}
	}, [docuSignService]);

	const handleCheckConsent = useCallback(async () => {
		setIsCheckingConsent(true);
		try {
			const status = await docuSignService.checkConsent();
			setConsentStatus(status);
			if (status === "granted") {
				// Update settings
				voidSettingsService.setGlobalSetting("docuSign", {
					...settingsState.globalSettings.docuSign,
					consentStatus: "granted",
				});
			}
		} catch (error) {
			console.error("[DocuSignSection] Error checking consent:", error);
		} finally {
			setIsCheckingConsent(false);
		}
	}, [
		docuSignService,
		voidSettingsService,
		settingsState.globalSettings.docuSign,
	]);

	// Determine if sign-in is available
	const canSignIn =
		(hasBundledKey || (useCustomKey && !!integrationKey)) &&
		(hasBundledKey || (!!userId && hasPrivateKey));

	const needsConsent = consentStatus === "required";

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

							{needsConsent && (
								<div className="bg-blue-900/20 rounded p-3 border border-blue-500/30">
									<div className="flex items-center gap-2 text-blue-400 text-sm mb-2">
										<Shield className="size-4" />
										<span>Consent Required</span>
									</div>
									<p className="text-xs text-void-fg-3 mb-2">
										You need to grant DocuSign permission to use JWT
										authentication.
									</p>
									<VoidButtonBgDarken
										className="px-3 py-1.5 text-sm flex items-center gap-2"
										onClick={handleGrantConsent}
									>
										<KeyRound className="size-3" />
										Grant Consent
									</VoidButtonBgDarken>
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

							{!hasBundledKey && !useCustomKey && (
								<p className="text-xs text-amber-500">
									DocuSign requires configuration. Click "Advanced Settings"
									below.
								</p>
							)}
						</div>
					)}

					{(authStatus === "signing_in" || isSigningIn) && (
						<div className="flex flex-col gap-3">
							<div className="flex items-center gap-2 text-void-fg-3">
								<RefreshCw className="size-4 animate-spin" />
								<span>Connecting...</span>
							</div>
							<p className="text-void-fg-3 text-xs">
								Authenticating with DocuSign using JWT...
							</p>
						</div>
					)}

					{authStatus === "error" && (
						<div className="flex flex-col gap-3">
							<div className="text-red-500 text-sm flex items-start gap-2">
								<AlertCircle className="size-4 flex-shrink-0 mt-0.5" />
								<span>{errorMessage || "An error occurred"}</span>
							</div>

							{needsConsent && (
								<VoidButtonBgDarken
									className="px-4 py-2 flex items-center justify-center gap-2"
									onClick={handleGrantConsent}
								>
									<Shield className="size-4" />
									Grant Consent
								</VoidButtonBgDarken>
							)}

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
									Using JWT authentication
									{useCustomKey ? " with custom key" : " with SafeAppeals key"}
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Advanced Settings Toggle */}
				<button
					className="text-void-fg-3 hover:text-void-fg-1 text-sm flex items-center gap-1 w-fit"
					onClick={() => setShowAdvanced(!showAdvanced)}
				>
					{showAdvanced ? (
						<ChevronUp className="size-3" />
					) : (
						<ChevronDown className="size-3" />
					)}
					<Settings className="size-3" />
					Advanced Settings
				</button>

				{/* Advanced Settings Panel */}
				{showAdvanced && (
					<div className="bg-void-bg-2 rounded-lg p-4 max-w-[500px]">
						<div className="flex flex-col gap-4">
							{/* Use Custom Key Toggle */}
							<div className="flex items-center justify-between">
								<div>
									<div className="text-sm text-void-fg-2">
										Use my own Integration Key
									</div>
									<p className="text-xs text-void-fg-3">
										{hasBundledKey
											? "Override the default SafeAppeals DocuSign integration"
											: "Required - SafeAppeals bundled key not configured"}
									</p>
								</div>
								<VoidSwitch
									value={useCustomKey}
									onChange={handleToggleUseCustomKey}
									disabled={!hasBundledKey}
								/>
							</div>

							{/* Custom Key Settings */}
							{(useCustomKey || !hasBundledKey) && (
								<>
									<div className="border-t border-void-border-1 pt-4">
										{/* Integration Key */}
										<div className="mb-4">
											<label className="block text-sm text-void-fg-2 mb-1 flex items-center gap-1">
												<Key className="size-3" />
												Integration Key (Client ID)
											</label>
											<VoidSimpleInputBox
												value={integrationKey}
												setValue={setIntegrationKey}
												placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
												type="password"
											/>
											<p className="text-xs text-void-fg-3 mt-1">
												Get this from the{" "}
												<a
													href="https://admindemo.docusign.com/apps-and-keys"
													target="_blank"
													rel="noopener noreferrer"
													className="text-blue-400 hover:underline"
												>
													DocuSign Admin Console
												</a>
											</p>
										</div>

										{/* User ID */}
										<div className="mb-4">
											<label className="block text-sm text-void-fg-2 mb-1 flex items-center gap-1">
												<UserCircle className="size-3" />
												User ID (GUID)
											</label>
											<VoidSimpleInputBox
												value={userId}
												setValue={setUserId}
												placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
											/>
											<p className="text-xs text-void-fg-3 mt-1">
												Find this in{" "}
												<a
													href="https://admindemo.docusign.com/apps-and-keys"
													target="_blank"
													rel="noopener noreferrer"
													className="text-blue-400 hover:underline"
												>
													DocuSign Admin Console
												</a>{" "}
												under "API and Keys"
											</p>
										</div>

										{/* Private Key */}
										<div className="mb-4">
											<label className="block text-sm text-void-fg-2 mb-1 flex items-center gap-1">
												<KeyRound className="size-3" />
												RSA Private Key
											</label>

											{hasPrivateKey ? (
												<div className="flex items-center gap-2 bg-green-900/20 rounded p-2 text-green-400 text-sm">
													<Check className="size-4" />
													<span>Private key configured</span>
												</div>
											) : (
												<>
													<textarea
														className="w-full h-24 bg-void-bg-1 border border-void-border-1 rounded p-2 text-xs font-mono text-void-fg-2 resize-none"
														placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvQ...&#10;-----END PRIVATE KEY-----"
														value={privateKeyInput}
														onChange={(e) => setPrivateKeyInput(e.target.value)}
													/>
													<div className="flex items-center gap-2 mt-2">
														<VoidButtonBgDarken
															className="px-3 py-1.5 text-sm flex items-center gap-2"
															onClick={handleStorePrivateKey}
															disabled={isStoringKey}
														>
															{isStoringKey ? (
																<RefreshCw className="size-3 animate-spin" />
															) : (
																<Key className="size-3" />
															)}
															Store Key Securely
														</VoidButtonBgDarken>
														{keySuccess && (
															<span className="text-green-400 text-xs flex items-center gap-1">
																<Check className="size-3" />
																Stored!
															</span>
														)}
													</div>
													{keyError && (
														<p className="text-red-400 text-xs mt-1">
															{keyError}
														</p>
													)}
												</>
											)}
											<p className="text-xs text-void-fg-3 mt-1">
												Generate in DocuSign Admin &gt; Apps &gt; [Your App]
												&gt; Generate RSA
											</p>
										</div>

										{/* Environment */}
										<div className="mb-4">
											<label className="block text-sm text-void-fg-2 mb-1">
												Environment
											</label>
											<div className="flex gap-2">
												<button
													className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
														environment === "demo"
															? "bg-void-bg-3 text-void-fg-1 border border-void-border-1"
															: "bg-void-bg-1 text-void-fg-3 border border-transparent hover:border-void-border-1"
													}`}
													onClick={() => setEnvironment("demo")}
												>
													Demo / Sandbox
												</button>
												<button
													className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
														environment === "production"
															? "bg-void-bg-3 text-void-fg-1 border border-void-border-1"
															: "bg-void-bg-1 text-void-fg-3 border border-transparent hover:border-void-border-1"
													}`}
													onClick={() => setEnvironment("production")}
												>
													Production
												</button>
											</div>
											<p className="text-xs text-void-fg-3 mt-1">
												Use Demo for testing, Production for real signatures.
											</p>
										</div>

										{/* Consent Status */}
										<div className="mb-4">
											<label className="block text-sm text-void-fg-2 mb-1 flex items-center gap-1">
												<Shield className="size-3" />
												Consent Status
											</label>
											<div className="flex items-center gap-2">
												<div
													className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
														consentStatus === "granted"
															? "bg-green-900/20 text-green-400"
															: consentStatus === "required"
																? "bg-amber-900/20 text-amber-400"
																: "bg-void-bg-1 text-void-fg-3"
													}`}
												>
													{consentStatus === "granted" && (
														<Check className="size-4" />
													)}
													{consentStatus === "required" && (
														<AlertCircle className="size-4" />
													)}
													<span>
														{consentStatus === "granted"
															? "Consent granted"
															: consentStatus === "required"
																? "Consent required"
																: "Unknown"}
													</span>
												</div>
												{consentStatus !== "granted" && (
													<>
														<VoidButtonBgDarken
															className="px-3 py-1.5 text-sm"
															onClick={handleGrantConsent}
														>
															Grant Consent
														</VoidButtonBgDarken>
														<VoidButtonBgDarken
															className="px-3 py-1.5 text-sm"
															onClick={handleCheckConsent}
															disabled={isCheckingConsent}
														>
															{isCheckingConsent ? (
																<RefreshCw className="size-3 animate-spin" />
															) : (
																"Check"
															)}
														</VoidButtonBgDarken>
													</>
												)}
											</div>
										</div>

										{/* Save Button */}
										<VoidButtonBgDarken
											className="px-4 py-2 w-full"
											onClick={handleSaveSettings}
										>
											Save Settings
										</VoidButtonBgDarken>
									</div>

									{/* Setup Instructions */}
									<div className="text-void-fg-3 text-xs bg-void-bg-1 rounded p-3">
										<strong>JWT Authentication Setup:</strong>
										<ol className="list-decimal list-inside mt-2 space-y-1">
											<li>
												Go to{" "}
												<a
													href="https://admindemo.docusign.com/apps-and-keys"
													target="_blank"
													rel="noopener noreferrer"
													className="text-blue-400 hover:underline"
												>
													DocuSign Admin Console
												</a>
											</li>
											<li>Click "Add App and Integration Key"</li>
											<li>Copy your Integration Key (Client ID)</li>
											<li>Click "Generate RSA" and copy the private key</li>
											<li>Note your User ID from "API and Keys"</li>
											<li>
												Add redirect URI:{" "}
												<code className="bg-void-bg-2 px-1 rounded">
													safe-appeals-navigator://docusign/consent
												</code>
											</li>
											<li>Click "Grant Consent" and approve in browser</li>
										</ol>
									</div>
								</>
							)}
						</div>
					</div>
				)}

				{/* Info Box - only show when not showing advanced */}
				{!showAdvanced && hasBundledKey && (
					<div className="text-void-fg-3 text-xs max-w-[400px] bg-void-bg-2/50 rounded p-3">
						<strong>Note:</strong> SafeAppeals includes built-in DocuSign
						integration using JWT authentication. Just click "Connect to
						DocuSign" to get started. If you need to use your own credentials,
						click "Advanced Settings".
					</div>
				)}
			</div>
		</ErrorBoundary>
	);
};

export default DocuSignSection;
