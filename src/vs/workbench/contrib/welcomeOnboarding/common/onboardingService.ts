/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IOnboardingService = createDecorator<IOnboardingService>('onboardingService');

/**
 * Why the onboarding overlay closed.
 * - `complete`: user finished the last step
 * - `skip`: user explicitly skipped (close control)
 * - `dismiss`: Esc or overlay click (transient; T8 uses an attempt counter)
 */
export type OnboardingDismissReason = 'complete' | 'skip' | 'dismiss';

export interface IOnboardingService {
	readonly _serviceBrand: undefined;

	/**
	 * Fires when the onboarding modal is dismissed.
	 * Carries the reason so callers can distinguish explicit complete/skip from Esc/overlay.
	 */
	readonly onDidDismiss: Event<OnboardingDismissReason>;

	/**
	 * Fires when the user completes the final onboarding step.
	 */
	readonly onDidComplete: Event<void>;

	/**
	 * Whether the onboarding overlay is currently visible.
	 */
	readonly isShowing: boolean;

	/**
	 * Show the onboarding modal.
	 */
	show(): void;
}
