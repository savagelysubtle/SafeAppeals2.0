/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import {
	getOnboardingSteps,
	IOnboardingShowGateInput,
	OnboardingStepId,
	shouldShowOnboarding,
} from '../../common/onboardingTypes.js';

suite('onboardingTypes', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('default step order is SignIn → Profile → AgentIntro → CreditsHandoff', () => {
		const productService = { onboardingSkipSignInStep: false } as Partial<IProductService> as IProductService;
		assert.deepStrictEqual(getOnboardingSteps(productService), [
			OnboardingStepId.SignIn,
			OnboardingStepId.Profile,
			OnboardingStepId.AgentIntro,
			OnboardingStepId.CreditsHandoff,
		]);
	});

	test('onboardingSkipSignInStep omits SignIn', () => {
		const productService = { onboardingSkipSignInStep: true } as Partial<IProductService> as IProductService;
		assert.deepStrictEqual(getOnboardingSteps(productService), [
			OnboardingStepId.Profile,
			OnboardingStepId.AgentIntro,
			OnboardingStepId.CreditsHandoff,
		]);
	});
});

suite('shouldShowOnboarding', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const baseDesktop: IOnboardingShowGateInput = {
		skipWelcome: false,
		completed: false,
		isWeb: false,
		inProgress: false,
		experimentalOnboardingEnabled: true,
		chatEntitlementHidden: false,
		dismissAttempts: 0,
		dismissAttemptCap: 2,
		isFirstRun: true,
	};

	test('desktop first-run shows', () => {
		assert.deepStrictEqual(shouldShowOnboarding(baseDesktop), { show: true, resumeAfterOAuthReload: false });
	});

	test('completed never shows', () => {
		assert.deepStrictEqual(shouldShowOnboarding({ ...baseDesktop, completed: true }), { show: false });
		assert.deepStrictEqual(shouldShowOnboarding({
			...baseDesktop,
			isWeb: true,
			inProgress: true,
			completed: true,
		}), { show: false });
	});

	test('web cold-start stays off without inProgress', () => {
		assert.deepStrictEqual(shouldShowOnboarding({
			...baseDesktop,
			isWeb: true,
			inProgress: false,
			isFirstRun: true,
		}), { show: false });
	});

	test('web resumes when inProgress even if not first-run', () => {
		assert.deepStrictEqual(shouldShowOnboarding({
			...baseDesktop,
			isWeb: true,
			inProgress: true,
			isFirstRun: false,
			dismissAttempts: 0,
		}), { show: true, resumeAfterOAuthReload: true });
	});

	test('web resume skips dismiss-attempt cap', () => {
		assert.deepStrictEqual(shouldShowOnboarding({
			...baseDesktop,
			isWeb: true,
			inProgress: true,
			isFirstRun: false,
			dismissAttempts: 99,
		}), { show: true, resumeAfterOAuthReload: true });
	});

	test('desktop respects dismiss-attempt cap', () => {
		assert.deepStrictEqual(shouldShowOnboarding({
			...baseDesktop,
			isFirstRun: false,
			dismissAttempts: 2,
		}), { show: false });
	});

	test('desktop incomplete attempt shows after Esc', () => {
		assert.deepStrictEqual(shouldShowOnboarding({
			...baseDesktop,
			isFirstRun: false,
			dismissAttempts: 1,
		}), { show: true, resumeAfterOAuthReload: false });
	});

	test('experimental off or entitlement hidden blocks', () => {
		assert.deepStrictEqual(shouldShowOnboarding({
			...baseDesktop,
			experimentalOnboardingEnabled: false,
		}), { show: false });
		assert.deepStrictEqual(shouldShowOnboarding({
			...baseDesktop,
			isWeb: true,
			inProgress: true,
			chatEntitlementHidden: true,
		}), { show: false });
	});
});
