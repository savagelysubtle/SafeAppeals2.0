/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { getOnboardingSteps, OnboardingStepId } from '../../common/onboardingTypes.js';

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
