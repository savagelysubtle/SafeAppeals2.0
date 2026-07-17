/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import {
  Check,
  ChevronRight,
  Cloud,
  ExternalLink,
  LogIn,
  RefreshCw } from
"lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileAccess } from "../../../../../../../base/common/network.js";
import { isLinux } from "../../../../../../../base/common/platform.js";
import { ColorScheme } from "../../../../../../../platform/theme/common/theme.js";
import {
  displayInfoOfProviderName,
  FeatureName,
  isFeatureNameDisabled,
  localProviderNames,
  ProviderName,
  providerNames } from
"../../../../common/voidSettingsTypes.js";
import ErrorBoundary from "../sidebar-tsx/ErrorBoundary.js";
import "../styles.css";
import { VoidButtonBgDarken } from "../util/inputs.js";
import {
  useAccessor,
  useIsDark,
  useSettingsState,
  useVoidCloudState } from
"../util/services.js";
import {
  ModelDump,
  OllamaSetupInstructions,
  OneClickSwitchButton,
  SettingsForProvider } from
"../void-settings-tsx/Settings.js";

const OVERRIDE_VALUE = false;

export const VoidOnboarding = () => {
  const voidSettingsState = useSettingsState();
  const isOnboardingComplete =
  voidSettingsState.globalSettings.isOnboardingComplete || OVERRIDE_VALUE;

  const isDark = useIsDark();

  return (
    <div className={`void-scope ${isDark ? "void-dark" : ""}`}>
			<div
        className={` void-bg-void-bg-3 void-fixed void-top-0 void-right-0 void-bottom-0 void-left-0 void-width-full void-z-[99999] void-transition-all void-duration-1000 ${


        isOnboardingComplete ? "void-opacity-0 void-pointer-events-none" : "void-opacity-100 void-pointer-events-auto"} `}




        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
        
				<ErrorBoundary>
					<VoidOnboardingContent />
				</ErrorBoundary>
			</div>
		</div>);

};

const VoidIcon = () => {
  const accessor = useAccessor();
  const themeService = accessor.get("IThemeService");

  const imgRef = useRef<HTMLImageElement | null>(null);

  // Get the image URI using FileAccess.asBrowserUri - this resolves to a browser-accessible URI
  const imageUri = useMemo(() => {
    try {
      return FileAccess.asBrowserUri(
        "vs/workbench/browser/media/logo_cube_noshadow.png"
      ).toString(true);
    } catch (e) {
      console.error("[VoidIcon] Failed to get image URI:", e);
      return "";
    }
  }, []);

  useEffect(() => {
    // void icon style
    const updateTheme = () => {
      const theme = themeService.getColorTheme().type;
      const isDark =
      theme === ColorScheme.DARK || theme === ColorScheme.HIGH_CONTRAST_DARK;
      if (imgRef.current) {
        imgRef.current.style.maxWidth = "220px";
        imgRef.current.style.opacity = "50%";
        imgRef.current.style.filter = isDark ? "" : "invert(1)"; //brightness(.5)
      }
    };
    updateTheme();
    const d = themeService.onDidColorThemeChange(updateTheme);
    return () => d.dispose();
  }, []);

  if (!imageUri) {
    return null;
  }

  return (
    <img
      ref={imgRef}
      src={imageUri}
      alt="Safe Appeals Logo"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain"
      }} />);


};

const FADE_DURATION_MS = 2000;

const FadeIn = ({
  children,
  className,
  delayMs = 0,
  durationMs,
  ...props





}: {children: React.ReactNode;delayMs?: number;durationMs?: number;className?: string;} & React.HTMLAttributes<HTMLDivElement>) => {
  const [opacity, setOpacity] = useState(0);

  const effectiveDurationMs = durationMs ?? FADE_DURATION_MS;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setOpacity(1);
    }, delayMs);

    return () => clearTimeout(timeout);
  }, [setOpacity, delayMs]);

  return (
    <div
      className={className}
      style={{
        opacity,
        transition: `opacity ${effectiveDurationMs}ms ease-in-out`
      }}
      {...props}>
      
			{children}
		</div>);

};

// Onboarding

// =============================================
//  New AddProvidersPage Component and helpers
// =============================================

const tabNames = ["Free", "Paid", "Local"] as const;

type TabName = (typeof tabNames)[number] | "Cloud/Other";

// Data for cloud providers tab
const cloudProviders: ProviderName[] = [
"googleVertex",
"liteLLM",
"microsoftAzure",
"awsBedrock",
"openAICompatible"];


// Data structures for provider tabs
const providerNamesOfTab: Record<TabName, ProviderName[]> = {
  Free: ["gemini", "openRouter"],
  Local: localProviderNames,
  Paid: providerNames.filter(
    (pn) =>
    !(
    [
    "gemini",
    "openRouter",
    ...localProviderNames,
    ...cloudProviders] as
    string[]).
    includes(pn)
  ) as ProviderName[],
  "Cloud/Other": cloudProviders
};

const descriptionOfTab: Record<TabName, string> = {
  Free: `Providers with a 100% free tier. Add as many as you'd like!`,
  Paid: `Connect directly with any provider (bring your own key).`,
  Local: `Active providers should appear automatically. Add as many as you'd like! `,
  "Cloud/Other": `Add as many as you'd like! Reach out for custom configuration requests.`
};

const featureNameMap: {display: string;featureName: FeatureName;}[] = [
{ display: "Chat", featureName: "Chat" },
{ display: "Quick Edit", featureName: "Ctrl+K" },
{ display: "Autocomplete", featureName: "Autocomplete" },
{ display: "Fast Apply", featureName: "Apply" },
{ display: "Source Control", featureName: "SCM" }];


// Providers supported by SafeAppeals Cloud
const cloudSupportedProviderNames: ProviderName[] = [
"anthropic",
"openAI",
"gemini"];


// Cloud Sign-in Section Component for Onboarding
const CloudSignInSection = () => {
  const accessor = useAccessor();
  const voidSettingsService = accessor.get("IVoidSettingsService");
  const { authState, signInWithGoogle } = useVoidCloudState();
  const settingsState = useSettingsState();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Check if cloud providers need to be enabled
  const needsCloudSetup =
  authState.status === "signed_in" && (
  !settingsState.globalSettings.voidCloudEnabled ||
  cloudSupportedProviderNames.some(
    (pn) => !settingsState.globalSettings.voidCloudModeOfProvider[pn]
  ) ||
  cloudSupportedProviderNames.some(
    (pn) =>
    !settingsState.settingsOfProvider[pn]._didFillInProviderSettings
  ) ||
  cloudSupportedProviderNames.some((pn) =>
  settingsState.settingsOfProvider[pn].models.some((m) => m.isHidden)
  ) ||
  settingsState.modelSelectionOfFeature["Chat"] === null);

  // Auto-enable cloud mode for all supported providers when user is signed in
  // Runs whenever needsCloudSetup is true
  useEffect(() => {
    if (!needsCloudSetup) return;

    // Enable cloud globally
    if (!settingsState.globalSettings.voidCloudEnabled) {
      voidSettingsService.setGlobalSetting("voidCloudEnabled", true);
    }

    // Enable cloud mode for all supported providers
    const currentCloudModes =
    settingsState.globalSettings.voidCloudModeOfProvider;
    const needsCloudModeUpdate = cloudSupportedProviderNames.some(
      (pn) => !currentCloudModes[pn]
    );

    if (needsCloudModeUpdate) {
      const newCloudModes = { ...currentCloudModes };
      for (const providerName of cloudSupportedProviderNames) {
        newCloudModes[providerName] = true;
      }
      voidSettingsService.setGlobalSetting(
        "voidCloudModeOfProvider",
        newCloudModes
      );
    }

    // Enable all cloud-supported providers and unhide their models
    for (const providerName of cloudSupportedProviderNames) {
      // Unhide (enable) the first hidden model for this provider (one at a time to avoid state issues)
      const models = settingsState.settingsOfProvider[providerName].models;
      const firstHiddenModel = models.find((m) => m.isHidden);
      if (firstHiddenModel) {
        voidSettingsService.toggleModelHidden(
          providerName,
          firstHiddenModel.modelName
        );
        return; // Return early to let state update, effect will re-run
      }
    }

    // Auto-select a default model for Chat if none is selected
    const defaultCloudModel = {
      providerName: "anthropic" as ProviderName,
      modelName: "claude-sonnet-4.5"
    };

    if (settingsState.modelSelectionOfFeature["Chat"] === null) {
      voidSettingsService.setModelSelectionOfFeature("Chat", defaultCloudModel);
    }
    // Also set for Quick Edit (Ctrl+K) if not set
    if (settingsState.modelSelectionOfFeature["Ctrl+K"] === null) {
      voidSettingsService.setModelSelectionOfFeature(
        "Ctrl+K",
        defaultCloudModel
      );
    }
  }, [needsCloudSetup, settingsState, voidSettingsService]);

  const handleSignIn = useCallback(async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in failed:", error);
    } finally {
      // Reset after a delay to allow state to update
      setTimeout(() => setIsSigningIn(false), 2000);
    }
  }, [signInWithGoogle]);

  const status = authState.status;
  const user = authState.session?.user;
  const showSigningIn =
  isSigningIn && status !== "signed_in" && status !== "error";

  if (status === "signed_in" && user) {
    return (
      <div className="void-w-full void-max-w-xl void-mb-6 void-bg-gradient-to-r void-from-blue-600/20 void-to-purple-600/20 void-rounded-lg void-p-4 void-border void-border-blue-500/30">
				<div className="void-flex void-items-center void-gap-3">
					<Cloud className="void-size-5 void-text-blue-400" />
					<div className="void-flex-1">
						<div className="void-text-sm void-font-medium void-text-void-fg-1">
							Signed in as {user.displayName || user.email}
						</div>
						<div className="void-text-xs void-text-void-fg-3">
							Claude, GPT-4, and Gemini models are now unlocked
						</div>
					</div>
					<Check className="void-size-5 void-text-emerald-500" />
				</div>
			</div>);

  }

  return (
    <div className="void-w-full void-max-w-xl void-mb-6 void-bg-gradient-to-r void-from-blue-600/20 void-to-purple-600/20 void-rounded-lg void-p-4 void-border void-border-blue-500/30">
			<div className="void-flex void-items-center void-gap-3 void-mb-3">
				<Cloud className="void-size-5 void-text-blue-400" />
				<div className="void-flex-1">
					<div className="void-text-sm void-font-medium void-text-void-fg-1">
						Use SafeAppeals Cloud
					</div>
					<div className="void-text-xs void-text-void-fg-3">
						Sign in to instantly access Claude, GPT-4, and Gemini models
					</div>
				</div>
			</div>

			{status === "signing_in" || showSigningIn ?
      <div className="void-flex void-items-center void-gap-2 void-text-void-fg-3 void-text-sm">
					<RefreshCw className="void-size-4 void-animate-spin" />
					<span>Signing in... Check your browser</span>
				</div> :
      status === "error" ?
      <div className="void-flex void-flex-col void-gap-2">
					<div className="void-text-red-400 void-text-xs">
						{authState.error || "Sign in failed"}
					</div>
					<VoidButtonBgDarken
          className="void-px-4 void-py-2 void-flex void-items-center void-justify-center void-gap-2 void-w-full"
          onClick={handleSignIn}>
          
						<LogIn className="void-size-4" />
						Try again
					</VoidButtonBgDarken>
				</div> :

      <VoidButtonBgDarken
        className="void-px-4 void-py-2 void-flex void-items-center void-justify-center void-gap-2 void-w-full void-bg-blue-600 hover:void-bg-blue-700"
        onClick={handleSignIn}>
        
					<LogIn className="void-size-4" />
					Sign in with Google
				</VoidButtonBgDarken>
      }
		</div>);

};

const AddProvidersPage = ({
  pageIndex,
  setPageIndex



}: {pageIndex: number;setPageIndex: (index: number) => void;}) => {
  const [currentTab, setCurrentTab] = useState<TabName>("Free");
  const settingsState = useSettingsState();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clear error message after 5 seconds
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (errorMessage) {
      timeoutId = setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
    }

    // Cleanup function to clear the timeout if component unmounts or error changes
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [errorMessage]);

  return (
    <div className="void-flex void-flex-col md:void-flex-row void-w-full void-h-[80vh] void-gap-6 void-max-w-[900px] void-mx-auto void-relative">
			{/* Left Column */}
			<div className="md:void-w-1/4 void-w-full void-flex void-flex-col void-gap-6 void-p-6 void-border-none void-border-void-border-2 void-h-full void-overflow-y-auto">
				{/* Tab Selector */}
				<div className="void-flex md:void-flex-col void-gap-2">
					{[...tabNames, "Cloud/Other"].map((tab) =>
          <button
            key={tab}
            className={`void-py-2 void-px-4 void-rounded-md void-text-left ${
            currentTab === tab ? "void-bg-void-button-primary/80 void-text-void-button-primary-text void-font-medium void-shadow-sm" : "void-bg-void-bg-2 hover:void-bg-void-bg-2/80 void-text-void-fg-1"} void-transition-all void-duration-200`}



            onClick={() => {
              setCurrentTab(tab as TabName);
              setErrorMessage(null); // Reset error message when changing tabs
            }}>
            
							{tab}
						</button>
          )}
				</div>

				{/* Feature Checklist */}
				<div className="void-flex void-flex-col void-gap-1 void-mt-4 void-text-sm void-opacity-80">
					{featureNameMap.map(({ display, featureName }) => {
            const hasModel =
            settingsState.modelSelectionOfFeature[featureName] !== null;
            return (
              <div key={featureName} className="void-flex void-items-center void-gap-2">
								{hasModel ?
                <Check className="void-w-4 void-h-4 void-text-emerald-500" /> :

                <div className="void-w-3 void-h-3 void-rounded-full void-flex void-items-center void-justify-center">
										<div className="void-w-1 void-h-1 void-rounded-full void-bg-white/70"></div>
									</div>
                }
								<span>{display}</span>
							</div>);

          })}
				</div>
			</div>

			{/* Right Column */}
			<div className="void-flex-1 void-flex void-flex-col void-items-center void-justify-start void-p-6 void-h-full void-overflow-y-auto">
				<div className="void-text-5xl void-mb-2 void-text-center void-w-full">Add a Provider</div>

				{/* Cloud Sign-in Option */}
				<ErrorBoundary>
					<CloudSignInSection />
				</ErrorBoundary>

				<div className="void-w-full void-max-w-xl void-flex void-items-center void-gap-4 void-mb-4">
					<div className="void-flex-1 void-h-px void-bg-void-border-2"></div>
					<span className="void-text-void-fg-3 void-text-sm">
						or add API keys manually
					</span>
					<div className="void-flex-1 void-h-px void-bg-void-border-2"></div>
				</div>

				<div className="void-w-full void-max-w-xl void-mt-4 void-mb-10">
					<div className="void-text-4xl void-font-light void-my-4 void-w-full">{currentTab}</div>
					<div className="void-text-sm void-opacity-80 void-text-void-fg-3 void-my-4 void-w-full">
						{descriptionOfTab[currentTab]}
					</div>
				</div>

				{providerNamesOfTab[currentTab].map((providerName) =>
        <div key={providerName} className="void-w-full void-max-w-xl void-mb-10">
						<div className="void-text-xl void-mb-2">
							Add {displayInfoOfProviderName(providerName).title}
							{providerName === "gemini" &&
            <span
              data-tooltip-id="void-tooltip-provider-info"
              data-tooltip-content="Gemini 2.5 Pro offers 25 free messages a day, and Gemini 2.5 Flash offers 500. We recommend using models down the line as you run out of free credits."
              data-tooltip-place="right"
              className="void-ml-1 void-text-xs void-align-top void-text-void-button-primary">
              
									*
								</span>
            }
							{providerName === "openRouter" &&
            <span
              data-tooltip-id="void-tooltip-provider-info"
              data-tooltip-content="OpenRouter offers 50 free messages a day, and 1000 if you deposit $10. Only applies to models labeled ':free'."
              data-tooltip-place="right"
              className="void-ml-1 void-text-xs void-align-top void-text-void-button-primary">
              
									*
								</span>
            }
						</div>
						<div>
							<SettingsForProvider
              providerName={providerName}
              showProviderTitle={false}
              showProviderSuggestions={true} />
            
						</div>
						{providerName === "ollama" && <OllamaSetupInstructions />}
					</div>
        )}

				{(currentTab === "Local" || currentTab === "Cloud/Other") &&
        <div className="void-w-full void-max-w-xl void-mt-8 void-bg-void-bg-2/50 void-rounded-lg void-p-6 void-border void-border-void-border-4">
						<div className="void-flex void-items-center void-gap-2 void-mb-4">
							<div className="void-text-xl void-font-medium">Models</div>
						</div>

						{currentTab === "Local" &&
          <div className="void-text-sm void-opacity-80 void-text-void-fg-3 void-my-4 void-w-full">
								Local models should be detected automatically. You can add
								custom models below.
							</div>
          }

						{currentTab === "Local" &&
          <ModelDump filteredProviders={localProviderNames} />
          }
						{currentTab === "Cloud/Other" &&
          <ModelDump filteredProviders={cloudProviders} />
          }
					</div>
        }

				{/* Navigation buttons in right column */}
				<div className="void-flex void-flex-col void-items-end void-w-full void-mt-auto void-pt-8">
					{errorMessage &&
          <div className="void-text-amber-400 void-mb-2 void-text-sm void-opacity-80 void-transition-opacity void-duration-300">
							{errorMessage}
						</div>
          }
					<div className="void-flex void-items-center void-gap-2">
						<PreviousButton onClick={() => setPageIndex(pageIndex - 1)} />
						{/* Skip button to bypass API key requirement */}
						<button
              onClick={() => {
                setPageIndex(pageIndex + 1);
                setErrorMessage(null);
              }}
              className="void-px-4 void-py-2 void-text-sm void-rounded-lg void-transition-all"
              style={{
                backgroundColor: "transparent",
                color: "var(--vscode-descriptionForeground)",
                border: "1px solid var(--vscode-panel-border)"
              }}>
              
							Skip for now
						</button>
						<NextButton
              onClick={() => {
                const isDisabled = isFeatureNameDisabled("Chat", settingsState);

                if (!isDisabled) {
                  setPageIndex(pageIndex + 1);
                  setErrorMessage(null);
                } else {
                  // Show error message
                  setErrorMessage(
                    "Please set up at least one Chat model before moving on."
                  );
                }
              }} />
            
					</div>
				</div>
			</div>
		</div>);

};
// =============================================
// 	OnboardingPage
// 		title:
// 			div
// 				"Welcome to Void"
// 			image
// 		content:<></>
// 		title
// 		content
// 		prev/next

// 	OnboardingPage
// 		title:
// 			div
// 				"How would you like to use Void?"
// 		content:
// 			ModelQuestionContent
// 				|
// 					div
// 						"I want to:"
// 					div
// 						"Use the smartest models"
// 						"Keep my data fully private"
// 						"Save money"
// 						"I don't know"
// 				| div
// 					| div
// 						"We recommend using "
// 						"Set API"
// 					| div
// 						""
// 					| div
//
// 		title
// 		content
// 		prev/next
//
// 	OnboardingPage
// 		title
// 		content
// 		prev/next

const NextButton = ({
  onClick,
  ...props
}: {onClick: () => void;} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  // Create a new props object without the disabled attribute
  const { disabled, ...buttonProps } = props;

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onDoubleClick={onClick}
      className={`void-px-6 void-py-2 void-bg-zinc-100 ${
      disabled ? "void-bg-zinc-100/40 void-cursor-not-allowed" : "hover:void-bg-zinc-100"} void-rounded void-text-black void-duration-600 void-transition-all `}


      {...disabled && {
        "data-tooltip-id": "void-tooltip",
        "data-tooltip-content":
        "Please enter all required fields or choose another provider", // (double-click to proceed anyway, can come back in Settings)
        "data-tooltip-place": "top"
      }}
      {...buttonProps}>
      
			Next
		</button>);

};

const PreviousButton = ({
  onClick,
  ...props
}: {onClick: () => void;} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      onClick={onClick}
      className="void-px-6 void-py-2 void-rounded void-text-void-fg-3 void-opacity-80 hover:void-brightness-115 void-duration-600 void-transition-all"
      {...props}>
      
			Back
		</button>);

};

const OnboardingPageShell = ({
  top,
  bottom,
  content,
  hasMaxWidth = true,
  className = ""






}: {top?: React.ReactNode;bottom?: React.ReactNode;content?: React.ReactNode;hasMaxWidth?: boolean;className?: string;}) => {
  return (
    <div
      className={`void-h-[80vh] void-text-lg void-flex void-flex-col void-gap-4 void-w-full void-mx-auto ${
      hasMaxWidth ? "void-max-w-[600px]" : ""} ${
      className}`}>
      
			{top && <FadeIn className="void-w-full void-mb-auto void-pt-16">{top}</FadeIn>}
			{content && <FadeIn className="void-w-full void-my-auto">{content}</FadeIn>}
			{bottom && <div className="void-w-full void-pb-8">{bottom}</div>}
		</div>);

};

const OllamaDownloadOrRemoveModelButton = ({
  modelName,
  isModelInstalled,
  sizeGb




}: {modelName: string;isModelInstalled: boolean;sizeGb: number | false | "not-known";}) => {
  // for now just link to the ollama download page
  return (
    <a
      href={`https://ollama.com/library/${modelName}`}
      target="_blank"
      rel="noopener noreferrer"
      className="void-flex void-items-center void-justify-center void-text-void-fg-2 hover:void-text-void-fg-1">
      
			<ExternalLink className="void-w-3.5 void-h-3.5" />
		</a>);

};

const YesNoText = ({ val }: {val: boolean | null;}) => {
  return (
    <div
      className={
      val === true ? "void-text void-text-emerald-500" :

      val === false ? "void-text-rose-600" : "void-text void-text-amber-300"}>



      
			{val === true ? "Yes" : val === false ? "No" : "Yes*"}
		</div>);

};

const abbreviateNumber = (num: number): string => {
  if (num >= 1000000) {
    // For millions
    return Math.floor(num / 1000000) + "M";
  } else if (num >= 1000) {
    // For thousands
    return Math.floor(num / 1000) + "K";
  } else {
    // For numbers less than 1000
    return num.toString();
  }
};

const PrimaryActionButton = ({
  children,
  className,
  ringSize,
  ...props



}: {children: React.ReactNode;ringSize?: undefined | "xl" | "screen";} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      type="button"
      className={` void-flex void-items-center void-justify-center void-text-white dark:void-text-black void-bg-black/90 dark:void-bg-white/90 ${






      ringSize === "xl" ? ` void-gap-2 void-px-16 void-py-8 void-transition-all void-duration-300 void-ease-in-out ` :




      ringSize === "screen" ? ` void-gap-2 void-px-16 void-py-8 void-transition-all void-duration-1000 void-ease-in-out ` :




      ringSize === undefined ? ` void-gap-1 void-px-4 void-py-2 void-transition-all void-duration-300 void-ease-in-out ` : ""} void-rounded-lg void-group ${









      className} `}

      {...props}>
      
			{children}
			<ChevronRight
        className={` void-transition-all void-duration-300 void-ease-in-out void-transform group-hover:void-translate-x-1 group-active:void-translate-x-1 `} />






      
		</button>);

};

type WantToUseOption = "smart" | "private" | "cheap" | "all";

// Onboarding Case Info Page Component
const OnboardingCaseInfoPage = ({
  pageIndex,
  setPageIndex



}: {pageIndex: number;setPageIndex: (index: number) => void;}) => {
  const accessor = useAccessor();
  const [claimantName, setClaimantName] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [caseType, setCaseType] = useState("Workers Compensation");
  const [advocate, setAdvocate] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [caseManager, setCaseManager] = useState("");
  const [reviewOfficer, setReviewOfficer] = useState("");
  const [employerRepresentative, setEmployerRepresentative] = useState("");
  const [yourSideKeywords, setYourSideKeywords] = useState(
    "claimant, treating, personal"
  );
  const [theirSideKeywords, setTheirSideKeywords] = useState(
    "employer, wcb, ime, defense"
  );

  const fileOrganizerService = useMemo(() => {
    try {
      return accessor.get("IFileOrganizerService");
    } catch (error) {
      console.error(
        "[OnboardingCaseInfo] Failed to get FileOrganizerService:",
        error
      );
      return null;
    }
  }, [accessor]);

  const workspaceContextService = useMemo(() => {
    try {
      return accessor.get("IWorkspaceContextService");
    } catch (error) {
      console.error(
        "[OnboardingCaseInfo] Failed to get IWorkspaceContextService:",
        error
      );
      return null;
    }
  }, [accessor]);

  const handleSave = useCallback(async () => {
    if (!fileOrganizerService || !workspaceContextService) {
      setPageIndex(pageIndex + 1);
      return;
    }

    const workspace = workspaceContextService.getWorkspace();
    if (!workspace.folders || workspace.folders.length === 0) {
      // No workspace open, just proceed
      setPageIndex(pageIndex + 1);
      return;
    }

    const workspaceFolder = workspace.folders[0].uri;

    // Process names for keyword arrays
    const advocateNames = advocate ?
    advocate.
    split(",").
    map((s) => s.trim()).
    filter(Boolean) :
    [];
    const caseManagerNames = caseManager ?
    caseManager.
    split(",").
    map((s) => s.trim()).
    filter(Boolean) :
    [];
    const reviewOfficerNames = reviewOfficer ?
    reviewOfficer.
    split(",").
    map((s) => s.trim()).
    filter(Boolean) :
    [];
    const employerRepNames = employerRepresentative ?
    employerRepresentative.
    split(",").
    map((s) => s.trim()).
    filter(Boolean) :
    [];

    // Only save if claimant name is provided
    if (claimantName.trim()) {
      const config: any = {
        version: "1.0" as const,
        caseInfo: {
          caseNumber: caseNumber || undefined,
          claimantName: claimantName || undefined,
          caseType,
          parties: {
            claimant: {
              name: claimantName || "Claimant",
              advocate: advocateNames.length > 0 ? advocateNames : undefined
            },
            employer: employerName ?
            {
              name: employerName,
              caseManager:
              caseManagerNames.length > 0 ? caseManagerNames : undefined,
              reviewOfficer:
              reviewOfficerNames.length > 0 ?
              reviewOfficerNames :
              undefined,
              employerRepresentative:
              employerRepNames.length > 0 ? employerRepNames : undefined
            } :
            undefined
          },
          keywords: {
            yourSide: [
            ...new Set([
            ...yourSideKeywords.
            split(",").
            map((s) => s.trim()).
            filter(Boolean),
            ...advocateNames]
            )],

            theirSide: [
            ...new Set([
            ...theirSideKeywords.
            split(",").
            map((s) => s.trim()).
            filter(Boolean),
            ...caseManagerNames,
            ...reviewOfficerNames,
            ...employerRepNames]
            )],

            medical: [
            "medical",
            "doctor",
            "physician",
            "diagnosis",
            "treatment",
            "mri",
            "xray"],

            legal: [
            "legal",
            "court",
            "decision",
            "appeal",
            "ruling",
            "judgment"],

            evidence: ["evidence", "study", "research", "expert", "report"]
          }
        },
        organizationSettings: {
          selectedTemplate: "workers-comp-full",
          preserveOriginalNames: true,
          createBackup: true,
          targetFolder: "./organized"
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await fileOrganizerService.saveCaseConfig(workspaceFolder, config);
      } catch (error) {
        console.error("[OnboardingCaseInfo] Error saving case config:", error);
      }
    }

    setPageIndex(pageIndex + 1);
  }, [
  fileOrganizerService,
  workspaceContextService,
  claimantName,
  caseNumber,
  caseType,
  advocate,
  employerName,
  caseManager,
  reviewOfficer,
  employerRepresentative,
  yourSideKeywords,
  theirSideKeywords,
  pageIndex,
  setPageIndex]
  );

  return (
    <div className="void-flex void-flex-col void-w-full void-h-[80vh] void-gap-6 void-max-w-[900px] void-mx-auto void-relative">
			<div className="void-text-5xl void-mb-2 void-text-center void-w-full">
				Set Up Case Information
			</div>
			<div className="void-text-sm void-opacity-80 void-text-void-fg-3 void-mb-6 void-text-center void-max-w-2xl void-mx-auto">
				This helps the AI understand your case and automatically organize your
				files. You can skip this and set it up later.
			</div>

			<div className="void-flex-1 void-flex void-flex-col void-items-center void-justify-start void-p-6 void-h-full void-overflow-y-auto">
				<div className="void-w-full void-max-w-xl void-space-y-6">
					{/* Basic Info */}
					<div className="void-bg-void-bg-2/50 void-rounded-lg void-p-4 void-border void-border-void-border-4">
						<div className="void-text-sm void-font-medium void-mb-4">Basic Information</div>
						<div className="void-space-y-4">
							<div>
								<label className="void-block void-text-sm void-mb-2">
									Claimant Name{" "}
									<span className="void-text-void-fg-3 void-text-xs">(optional)</span>
								</label>
								<input
                  type="text"
                  value={claimantName}
                  onChange={(e) => setClaimantName(e.target.value)}
                  placeholder="e.g., John Smith"
                  className="void-w-full void-px-3 void-py-2 void-bg-void-bg-1 void-border void-border-void-border-2 void-rounded void-text-void-fg-1" />
                
							</div>
							<div>
								<label className="void-block void-text-sm void-mb-2">
									Case Number{" "}
									<span className="void-text-void-fg-3 void-text-xs">(optional)</span>
								</label>
								<input
                  type="text"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="e.g., 39573881"
                  className="void-w-full void-px-3 void-py-2 void-bg-void-bg-1 void-border void-border-void-border-2 void-rounded void-text-void-fg-1" />
                
							</div>
							<div>
								<label className="void-block void-text-sm void-mb-2">Case Type</label>
								<select
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value)}
                  className="void-w-full void-px-3 void-py-2 void-bg-void-bg-1 void-border void-border-void-border-2 void-rounded void-text-void-fg-1">
                  
									<option value="Workers Compensation">
										Workers Compensation
									</option>
									<option value="Personal Injury">Personal Injury</option>
									<option value="Disability Claim">Disability Claim</option>
									<option value="Employment Dispute">Employment Dispute</option>
									<option value="Other">Other</option>
								</select>
							</div>
						</div>
					</div>

					{/* Your Side */}
					<div className="void-bg-void-bg-2/50 void-rounded-lg void-p-4 void-border void-border-void-border-4">
						<div className="void-text-sm void-font-medium void-mb-2">Your Side</div>
						<div className="void-text-xs void-opacity-80 void-mb-4">
							People helping you or the claimant
						</div>
						<div>
							<label className="void-block void-text-sm void-mb-2">
								Advocate{" "}
								<span className="void-text-void-fg-3 void-text-xs">(optional)</span>
							</label>
							<input
                type="text"
                value={advocate}
                onChange={(e) => setAdvocate(e.target.value)}
                placeholder="e.g., Jane Doe, John Smith"
                className="void-w-full void-px-3 void-py-2 void-bg-void-bg-1 void-border void-border-void-border-2 void-rounded void-text-void-fg-1" />
              
						</div>
					</div>

					{/* Their Side */}
					<div className="void-bg-void-bg-2/50 void-rounded-lg void-p-4 void-border void-border-void-border-4">
						<div className="void-text-sm void-font-medium void-mb-2">Their Side</div>
						<div className="void-text-xs void-opacity-80 void-mb-4">The opposing party</div>
						<div className="void-space-y-4">
							<div>
								<label className="void-block void-text-sm void-mb-2">
									Employer Name{" "}
									<span className="void-text-void-fg-3 void-text-xs">(optional)</span>
								</label>
								<input
                  type="text"
                  value={employerName}
                  onChange={(e) => setEmployerName(e.target.value)}
                  placeholder="e.g., ABC Corporation"
                  className="void-w-full void-px-3 void-py-2 void-bg-void-bg-1 void-border void-border-void-border-2 void-rounded void-text-void-fg-1" />
                
							</div>
							<div>
								<label className="void-block void-text-sm void-mb-2">
									Case Manager{" "}
									<span className="void-text-void-fg-3 void-text-xs">(optional)</span>
								</label>
								<input
                  type="text"
                  value={caseManager}
                  onChange={(e) => setCaseManager(e.target.value)}
                  placeholder="e.g., Sarah Johnson"
                  className="void-w-full void-px-3 void-py-2 void-bg-void-bg-1 void-border void-border-void-border-2 void-rounded void-text-void-fg-1" />
                
							</div>
							<div>
								<label className="void-block void-text-sm void-mb-2">
									Review Officer{" "}
									<span className="void-text-void-fg-3 void-text-xs">(optional)</span>
								</label>
								<input
                  type="text"
                  value={reviewOfficer}
                  onChange={(e) => setReviewOfficer(e.target.value)}
                  placeholder="e.g., Michael Brown"
                  className="void-w-full void-px-3 void-py-2 void-bg-void-bg-1 void-border void-border-void-border-2 void-rounded void-text-void-fg-1" />
                
							</div>
							<div>
								<label className="void-block void-text-sm void-mb-2">
									Employer Representative{" "}
									<span className="void-text-void-fg-3 void-text-xs">(optional)</span>
								</label>
								<input
                  type="text"
                  value={employerRepresentative}
                  onChange={(e) => setEmployerRepresentative(e.target.value)}
                  placeholder="e.g., Robert Williams"
                  className="void-w-full void-px-3 void-py-2 void-bg-void-bg-1 void-border void-border-void-border-2 void-rounded void-text-void-fg-1" />
                
							</div>
						</div>
					</div>
				</div>

				{/* Navigation buttons */}
				<div className="void-flex void-flex-col void-items-end void-w-full void-mt-auto void-pt-8">
					<div className="void-flex void-items-center void-gap-2">
						<PreviousButton onClick={() => setPageIndex(pageIndex - 1)} />
						<button
              onClick={() => setPageIndex(pageIndex + 1)}
              className="void-px-6 void-py-2 void-rounded void-text-void-fg-3 void-opacity-80 hover:void-brightness-115 void-duration-600 void-transition-all">
              
							Skip
						</button>
						<NextButton onClick={handleSave} />
					</div>
				</div>
			</div>
		</div>);

};

const VoidOnboardingContent = () => {
  const accessor = useAccessor();
  const voidSettingsService = accessor.get("IVoidSettingsService");
  const voidMetricsService = accessor.get("IMetricsService");

  const voidSettingsState = useSettingsState();

  const [pageIndex, setPageIndex] = useState(0);

  // page 1 state
  const [wantToUseOption, setWantToUseOption] =
  useState<WantToUseOption>("smart");

  // Replace the single selectedProviderName with four separate states
  // page 2 state - each tab gets its own state
  const [selectedIntelligentProvider, setSelectedIntelligentProvider] =
  useState<ProviderName>("anthropic");
  const [selectedPrivateProvider, setSelectedPrivateProvider] =
  useState<ProviderName>("ollama");
  const [selectedAffordableProvider, setSelectedAffordableProvider] =
  useState<ProviderName>("gemini");
  const [selectedAllProvider, setSelectedAllProvider] =
  useState<ProviderName>("anthropic");

  // Helper function to get the current selected provider based on active tab
  const getSelectedProvider = (): ProviderName => {
    switch (wantToUseOption) {
      case "smart":
        return selectedIntelligentProvider;
      case "private":
        return selectedPrivateProvider;
      case "cheap":
        return selectedAffordableProvider;
      case "all":
        return selectedAllProvider;
    }
  };

  // Helper function to set the selected provider for the current tab
  const setSelectedProvider = (provider: ProviderName) => {
    switch (wantToUseOption) {
      case "smart":
        setSelectedIntelligentProvider(provider);
        break;
      case "private":
        setSelectedPrivateProvider(provider);
        break;
      case "cheap":
        setSelectedAffordableProvider(provider);
        break;
      case "all":
        setSelectedAllProvider(provider);
        break;
    }
  };

  const providerNamesOfWantToUseOption: { [wantToUseOption in
  WantToUseOption]: ProviderName[] } =
  {
    smart: ["anthropic", "openAI", "gemini", "openRouter"],
    private: ["ollama", "vLLM", "openAICompatible", "lmStudio"],
    cheap: ["gemini", "deepseek", "openRouter", "ollama", "vLLM"],
    all: providerNames
  };

  const selectedProviderName = getSelectedProvider();
  const didFillInProviderSettings =
  selectedProviderName &&
  voidSettingsState.settingsOfProvider[selectedProviderName].
  _didFillInProviderSettings;
  const isApiKeyLongEnoughIfApiKeyExists =
  selectedProviderName &&
  voidSettingsState.settingsOfProvider[selectedProviderName].apiKey ?
  voidSettingsState.settingsOfProvider[selectedProviderName].apiKey.
  length > 15 :
  true;
  const isAtLeastOneModel =
  selectedProviderName &&
  voidSettingsState.settingsOfProvider[selectedProviderName].models.length >=
  1;

  const didFillInSelectedProviderSettings = !!(
  didFillInProviderSettings &&
  isApiKeyLongEnoughIfApiKeyExists &&
  isAtLeastOneModel);


  const prevAndNextButtons =
  <div className="void-max-w-[600px] void-w-full void-mx-auto void-flex void-flex-col void-items-end">
			<div className="void-flex void-items-center void-gap-2">
				<PreviousButton
        onClick={() => {
          setPageIndex(pageIndex - 1);
        }} />
      
				<NextButton
        onClick={() => {
          setPageIndex(pageIndex + 1);
        }} />
      
			</div>
		</div>;


  const lastPagePrevAndNextButtons =
  <div className="void-max-w-[600px] void-w-full void-mx-auto void-flex void-flex-col void-items-end">
			<div className="void-flex void-items-center void-gap-2">
				<PreviousButton
        onClick={() => {
          setPageIndex(pageIndex - 1);
        }} />
      
				<PrimaryActionButton
        onClick={() => {
          voidSettingsService.setGlobalSetting("isOnboardingComplete", true);
          voidMetricsService.capture("Completed Onboarding", {
            selectedProviderName,
            wantToUseOption
          });
        }}
        ringSize={
        voidSettingsState.globalSettings.isOnboardingComplete ?
        "screen" :
        undefined
        }>
        
					Enter Safe Appeals
				</PrimaryActionButton>
			</div>
		</div>;


  // cannot be md
  const basicDescOfWantToUseOption: { [wantToUseOption in
  WantToUseOption]: string } =
  {
    smart: "Models with the best performance on benchmarks.",
    private: "Host on your computer or local network for full data privacy.",
    cheap: "Free and affordable options.",
    all: ""
  };

  // can be md
  const detailedDescOfWantToUseOption: { [wantToUseOption in
  WantToUseOption]: string } =
  {
    smart: "Most intelligent and best for agent mode.",
    private:
    "Private-hosted so your data never leaves your computer or network. [Email us](mailto:founders@voideditor.com) for help setting up at your company.",
    cheap:
    "Use great deals like Gemini 2.5 Pro, or self-host a model with Ollama or vLLM for free.",
    all: ""
  };

  // Modified: initialize separate provider states on initial render instead of watching wantToUseOption changes
  useEffect(() => {
    if (selectedIntelligentProvider === undefined) {
      setSelectedIntelligentProvider(
        providerNamesOfWantToUseOption["smart"][0]
      );
    }
    if (selectedPrivateProvider === undefined) {
      setSelectedPrivateProvider(providerNamesOfWantToUseOption["private"][0]);
    }
    if (selectedAffordableProvider === undefined) {
      setSelectedAffordableProvider(providerNamesOfWantToUseOption["cheap"][0]);
    }
    if (selectedAllProvider === undefined) {
      setSelectedAllProvider(providerNamesOfWantToUseOption["all"][0]);
    }
  }, []);

  // reset the page to page 0 if the user redos onboarding
  useEffect(() => {
    if (!voidSettingsState.globalSettings.isOnboardingComplete) {
      setPageIndex(0);
    }
  }, [setPageIndex, voidSettingsState.globalSettings.isOnboardingComplete]);

  const contentOfIdx: {[pageIndex: number]: React.ReactNode;} = {
    0:
    <OnboardingPageShell
      content={
      <div className="void-flex void-flex-col void-items-center void-gap-8">
						<div className="void-text-5xl void-font-light void-text-center">
							Welcome to Safe Appeals
						</div>

						{/* Slice of Void image */}
						<div className="void-max-w-md void-w-full void-h-[30vh] void-mx-auto void-flex void-items-center void-justify-center">
							{!isLinux && <VoidIcon />}
						</div>

						<FadeIn delayMs={1000}>
							<PrimaryActionButton
            onClick={() => {
              setPageIndex(1);
            }}>
            
								Get Started
							</PrimaryActionButton>
						</FadeIn>
					</div>
      } />,



    1:
    <OnboardingPageShell
      hasMaxWidth={false}
      content={
      <AddProvidersPage pageIndex={pageIndex} setPageIndex={setPageIndex} />
      } />,


    2:
    <OnboardingPageShell
      hasMaxWidth={false}
      content={
      <OnboardingCaseInfoPage
        pageIndex={pageIndex}
        setPageIndex={setPageIndex} />

      } />,


    3:
    <OnboardingPageShell
      content={
      <div>
						<div className="void-text-5xl void-font-light void-text-center">
							Settings and Themes
						</div>

						<div className="void-mt-8 void-text-center void-flex void-flex-col void-items-center void-gap-4 void-w-full void-max-w-md void-mx-auto">
							<h4 className="void-text-void-fg-3 void-mb-4">
								Transfer your settings from an existing editor?
							</h4>
							<OneClickSwitchButton
            className="void-w-full void-px-4 void-py-2"
            fromEditor="VS Code" />
          
							<OneClickSwitchButton
            className="void-w-full void-px-4 void-py-2"
            fromEditor="Cursor" />
          
							<OneClickSwitchButton
            className="void-w-full void-px-4 void-py-2"
            fromEditor="Windsurf" />
          
						</div>
					</div>
      }
      bottom={lastPagePrevAndNextButtons} />


  };

  return (
    <div
      key={pageIndex}
      className="void-w-full void-h-[80vh] void-text-left void-mx-auto void-flex void-flex-col void-items-center void-justify-center">
      
			<ErrorBoundary>{contentOfIdx[pageIndex]}</ErrorBoundary>
		</div>);

};