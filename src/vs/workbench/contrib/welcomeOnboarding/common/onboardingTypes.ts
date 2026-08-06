/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IProductOnboardingTheme } from '../../../../base/common/product.js';
import { IProductService } from '../../../../platform/product/common/productService.js';

/**
 * Step identifiers for the onboarding walkthrough.
 */
export const enum OnboardingStepId {
	SignIn = 'onboarding.signIn',
	/** SafeAppeals: who the user is / where they work / what law they practice. */
	Profile = 'onboarding.profile',
	/** SafeAppeals: agent mental model, approval literacy, hallucination inoculation. */
	AgentIntro = 'onboarding.agentIntro',
	/** SafeAppeals: honest zero-credit handoff (packs, balance, pricing). */
	CreditsHandoff = 'onboarding.creditsHandoff',
	/** SafeAppeals: local indexing for private search on this computer. */
	PrivateSearch = 'onboarding.privateSearch',
	/** SafeAppeals: readiness scan, optional install, and sample case without credits. */
	GetStarted = 'onboarding.getStarted',
}

/**
 * Returns a localized title for each step.
 */
export function getOnboardingStepTitle(stepId: OnboardingStepId): string {
	switch (stepId) {
		case OnboardingStepId.SignIn:
			return localize('onboarding.step.signIn', "Sign In");
		case OnboardingStepId.Profile:
			// SafeAppeals
			return localize('onboarding.step.profile', "Who You Are");
		case OnboardingStepId.AgentIntro:
			// SafeAppeals
			return localize('onboarding.step.agentIntro', "Meet Your AI Assistant");
		case OnboardingStepId.CreditsHandoff:
			// SafeAppeals
			return localize('onboarding.step.creditsHandoff', "What's Free, and What Isn't");
		case OnboardingStepId.PrivateSearch:
			// SafeAppeals
			return localize('onboarding.step.privateSearch', "Private Search on This Computer");
		case OnboardingStepId.GetStarted:
			// SafeAppeals
			return localize('onboarding.step.getStarted', "Get Started");
	}
}

/**
 * Returns a localized subtitle for each step.
 */
export function getOnboardingStepSubtitle(stepId: OnboardingStepId, productService: IProductService): string {
	switch (stepId) {
		case OnboardingStepId.SignIn:
			// SafeAppeals
			return localize('onboarding.step.signIn.subtitle', "One workspace for your entire appeal — documents, evidence, email, and an AI assistant that drafts while you review.");
		case OnboardingStepId.Profile:
			// SafeAppeals
			return localize('onboarding.step.profile.subtitle', "The AI agent tailors its help to your practice — saved only on this computer");
		case OnboardingStepId.AgentIntro:
			// SafeAppeals
			return localize('onboarding.step.agentIntro.subtitle', "It works like a junior colleague — it drafts, you review, you decide.");
		case OnboardingStepId.CreditsHandoff:
			// SafeAppeals
			return localize('onboarding.step.creditsHandoff.subtitle', "{0} is free to download and use — your account is free too. Email, calendar, and documents never cost anything; you only pay for AI credits.", productService.nameLong);
		case OnboardingStepId.PrivateSearch:
			// SafeAppeals
			return localize('onboarding.step.privateSearch.subtitle', "Index case files on this computer so search does not upload the whole file for every query");
		case OnboardingStepId.GetStarted:
			// SafeAppeals
			return localize('onboarding.step.getStarted.subtitle', "See what this computer needs for Private Search, then try a sample case — no credits required");
	}
}

/**
 * Ordered step IDs for the onboarding flow.
 */
const ALL_ONBOARDING_STEPS: readonly OnboardingStepId[] = [
	OnboardingStepId.SignIn,
	OnboardingStepId.Profile,
	OnboardingStepId.AgentIntro,
	OnboardingStepId.CreditsHandoff,
	OnboardingStepId.PrivateSearch,
	OnboardingStepId.GetStarted,
];

/**
 * SafeAppeals: honor product.json onboardingSkipSignInStep to omit the sign-in step.
 * Read through IProductService (not the static product module) so web embedder
 * overrides delivered via the server's productConfiguration are respected.
 */
export function getOnboardingSteps(productService: IProductService): readonly OnboardingStepId[] {
	return productService.onboardingSkipSignInStep
		? ALL_ONBOARDING_STEPS.filter(step => step !== OnboardingStepId.SignIn)
		: ALL_ONBOARDING_STEPS;
}

/**
 * Theme option for the onboarding personalization step.
 * Sourced from product.json via `onboardingThemes`.
 */
export type IOnboardingThemeOption = IProductOnboardingTheme;

/**
 * Approval mode chosen in the Meet Your AI Assistant step.
 * Writes `chat.tools.edits.autoApprove` with only the catch-all glob key varied.
 */
export const enum ApprovalMode {
	ReviewEveryChange = 'review-every-change',
	ApplyRoutineEdits = 'apply-routine-edits',
}

/**
 * Approval-mode option shown in the Meet Your AI Assistant step.
 */
export interface IApprovalModeOption {
	readonly id: ApprovalMode;
	readonly label: string;
	readonly description: string;
	readonly icon: string;
	readonly recommended?: boolean;
}

/**
 * Approval-mode options for the Meet Your AI Assistant step (consumed by T5).
 */
export const ONBOARDING_APPROVAL_MODE_OPTIONS: readonly IApprovalModeOption[] = [
	{
		id: ApprovalMode.ReviewEveryChange,
		label: localize('onboarding.approval.reviewEvery', "Review Every Change"),
		description: localize('onboarding.approval.reviewEvery.desc', "The assistant shows each edit and waits for your approval."),
		icon: 'check',
		recommended: true,
	},
	{
		id: ApprovalMode.ApplyRoutineEdits,
		label: localize('onboarding.approval.applyRoutine', "Apply Routine Edits Automatically"),
		description: localize('onboarding.approval.applyRoutine.desc', "The assistant applies small edits on its own; you can still undo. You can change this anytime in Settings."),
		icon: 'runAll',
	},
];

/**
 * Storage key for persisting onboarding completion state.
 * Set to `true` only on explicit complete or skip (not Esc/overlay dismiss).
 */
export const ONBOARDING_STORAGE_KEY = 'welcomeOnboarding.state';

/**
 * Storage key for counting Esc/overlay dismissals of the onboarding overlay.
 * Cap is enforced by the startup-page consumer; once reached, the wizard stops showing.
 */
export const ONBOARDING_DISMISS_ATTEMPTS_STORAGE_KEY = 'welcomeOnboarding.dismissAttempts';

/**
 * APPLICATION-scope flag: onboarding overlay is currently in progress.
 * Used on web to reopen the walkthrough after a hard reload (e.g. OAuth) kills the in-flight show.
 * Cleared on any explicit dismiss (complete/skip/Esc/overlay). Survives only across hard reloads.
 * Stored with StorageTarget.MACHINE — must not Settings Sync across devices.
 */
export const ONBOARDING_IN_PROGRESS_STORAGE_KEY = 'welcomeOnboarding.inProgress';

/**
 * Inputs for the startup-page decision of whether to show Welcome Onboarding.
 */
export interface IOnboardingShowGateInput {
	readonly skipWelcome: boolean;
	readonly completed: boolean;
	readonly isWeb: boolean;
	readonly inProgress: boolean;
	readonly experimentalOnboardingEnabled: boolean;
	readonly chatEntitlementHidden: boolean;
	readonly dismissAttempts: number;
	readonly dismissAttemptCap: number;
	readonly isFirstRun: boolean;
}

/**
 * Result of {@link shouldShowOnboarding}.
 */
export type OnboardingShowGateResult =
	| { readonly show: false }
	| { readonly show: true; readonly resumeAfterOAuthReload: boolean };

/**
 * Pure gate for tryShowOnboarding — web cold-start stays off; web resume only when
 * `inProgress` is set (hard reload mid-flow). Desktop keeps first-run / dismiss gates.
 */
export function shouldShowOnboarding(input: IOnboardingShowGateInput): OnboardingShowGateResult {
	if (input.skipWelcome || input.completed) {
		return { show: false };
	}

	const resumeAfterOAuthReload = input.isWeb && input.inProgress;
	if (input.isWeb && !resumeAfterOAuthReload) {
		return { show: false };
	}

	if (!input.experimentalOnboardingEnabled || input.chatEntitlementHidden) {
		return { show: false };
	}

	if (!resumeAfterOAuthReload) {
		if (input.dismissAttempts >= input.dismissAttemptCap) {
			return { show: false };
		}
		const hasIncompleteAttempt = input.dismissAttempts > 0;
		if (!input.isFirstRun && !hasIncompleteAttempt) {
			return { show: false };
		}
	}

	return { show: true, resumeAfterOAuthReload };
}
