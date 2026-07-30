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
	/** SafeAppeals: honest zero-credit handoff and first zero-cost action. */
	CreditsHandoff = 'onboarding.creditsHandoff',
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
			return localize('onboarding.step.creditsHandoff.subtitle', "{0} is free to download and use. Organizing cases, editing documents, tracking time, email, and calendar never cost anything.", productService.nameLong);
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
