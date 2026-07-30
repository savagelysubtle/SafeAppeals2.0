/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { dirname, joinPath } from '../../../../base/common/resources.js';
import { $, append, addDisposableListener, EventType, clearNode, getActiveWindow, isHTMLElement } from '../../../../base/browser/dom.js';
import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';
import { URI } from '../../../../base/common/uri.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { ISelectOptionItem, SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { localize } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { defaultInputBoxStyles, defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { ChatConfiguration, defaultChatToolsEditsAutoApprove } from '../../chat/common/constants.js';
import { waitForAuthenticationProvider } from '../common/authProviderWait.js';
import {
	OnboardingStepId,
	getOnboardingSteps,
	getOnboardingStepTitle,
	getOnboardingStepSubtitle,
	ApprovalMode,
	ONBOARDING_APPROVAL_MODE_OPTIONS,
} from '../common/onboardingTypes.js';
import { IOnboardingService, OnboardingDismissReason } from '../common/onboardingService.js';

/** Pricing page opened from the Credits & First Steps step. */
const CREDITS_PRICING_URL = 'https://safeappeals.com/#pricing';
/** Docs page explaining how AI credits work. */
const CREDITS_DOCS_URL = 'https://safeappeals.com/docs/credits';
/** Docs page for AI assistant disclosure and client-consent guidance. */
const AI_ASSISTANT_DOCS_URL = 'https://safeappeals.com/docs/ai-assistant';
/** APPLICATION-scope flag: user acknowledged hallucination risk in Meet Your AI Assistant. */
const AI_LITERACY_STORAGE_KEY = 'safeappeals.aiLiteracy.acknowledged';

/** Auth provider contributed by `extensions/safeappeals-authentication`. */
const SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID = 'safeappeals-cloud';
/**
 * Max wait for the extension host to register the cloud auth provider at startup.
 * Cold starts can lag; shorter waits strand the user on a spinner with no escape.
 */
const AUTH_PROVIDER_REGISTRATION_TIMEOUT_MS = 15_000;

/** Where a Safe Appeals Cloud sign-in request was started from. */
const enum OnboardingSignInOrigin {
	SignInStep = 'signInStep',
	FooterNudge = 'footerNudge',
	CreditsStep = 'creditsStep',
}

/**
 * Compensation boards mirrored from `extensions/safeappeals-case/src/types.ts`
 * (`JURISDICTIONS`). Kept here because workbench cannot import the extension.
 */
const PROFILE_JURISDICTIONS = [
	'BC WCB',
	'Ontario WSIB',
	'Alberta WCB',
	'Quebec CNESST',
	'Manitoba WCB',
	'Saskatchewan WCB',
	'Nova Scotia WCB',
	'California DWC',
	'Texas DWC',
	'New York WCB',
	'Florida DWC',
	'Washington L&I',
] as const;

const PROFILE_COUNTRY_CANADA = 'Canada';
const PROFILE_COUNTRY_US = 'United States';
const PROFILE_COUNTRY_OTHER = 'Other';

/** Canonical English values persisted to `safeappeals.profile.role`. */
const PROFILE_ROLE_LAWYER = 'Lawyer';
const PROFILE_ROLE_PARALEGAL = 'Paralegal';
const PROFILE_ROLE_ADVOCATE = 'Advocate';
const PROFILE_ROLE_SELF = 'Representing Myself';

const PROFILE_ROLES = [
	PROFILE_ROLE_LAWYER,
	PROFILE_ROLE_PARALEGAL,
	PROFILE_ROLE_ADVOCATE,
	PROFILE_ROLE_SELF,
] as const;

const PROFILE_CANADA_PROVINCES = [
	'Alberta',
	'British Columbia',
	'Manitoba',
	'New Brunswick',
	'Newfoundland and Labrador',
	'Northwest Territories',
	'Nova Scotia',
	'Nunavut',
	'Ontario',
	'Prince Edward Island',
	'Quebec',
	'Saskatchewan',
	'Yukon',
] as const;

const PROFILE_US_STATES = [
	'Alabama',
	'Alaska',
	'Arizona',
	'Arkansas',
	'California',
	'Colorado',
	'Connecticut',
	'Delaware',
	'District of Columbia',
	'Florida',
	'Georgia',
	'Hawaii',
	'Idaho',
	'Illinois',
	'Indiana',
	'Iowa',
	'Kansas',
	'Kentucky',
	'Louisiana',
	'Maine',
	'Maryland',
	'Massachusetts',
	'Michigan',
	'Minnesota',
	'Mississippi',
	'Missouri',
	'Montana',
	'Nebraska',
	'Nevada',
	'New Hampshire',
	'New Jersey',
	'New Mexico',
	'New York',
	'North Carolina',
	'North Dakota',
	'Ohio',
	'Oklahoma',
	'Oregon',
	'Pennsylvania',
	'Rhode Island',
	'South Carolina',
	'South Dakota',
	'Tennessee',
	'Texas',
	'Utah',
	'Vermont',
	'Virginia',
	'Washington',
	'West Virginia',
	'Wisconsin',
	'Wyoming',
] as const;

const PROFILE_BOARDS_BY_STATE_PROVINCE: Readonly<Record<string, readonly string[]>> = {
	'British Columbia': ['BC WCB'],
	'Ontario': ['Ontario WSIB'],
	'Alberta': ['Alberta WCB'],
	'Quebec': ['Quebec CNESST'],
	'Manitoba': ['Manitoba WCB'],
	'Saskatchewan': ['Saskatchewan WCB'],
	'Nova Scotia': ['Nova Scotia WCB'],
	'California': ['California DWC'],
	'Texas': ['Texas DWC'],
	'New York': ['New York WCB'],
	'Florida': ['Florida DWC'],
	'Washington': ['Washington L&I'],
};

type ProfileFieldKey = 'name' | 'organization' | 'role' | 'practiceArea' | 'country' | 'stateProvince' | 'city' | 'jurisdiction';

type ProfileFieldDescriptor =
	| { readonly type: 'text'; readonly key: 'name' | 'organization' | 'practiceArea' | 'city'; readonly label: string; readonly placeholder: string }
	| { readonly type: 'pills'; readonly key: 'role'; readonly label: string }
	| { readonly type: 'select'; readonly key: 'country' | 'stateProvince' | 'jurisdiction'; readonly label: string };

/**
 * Boards for a state/province. When none match, returns the full list so the
 * dropdown is never empty.
 */
function profileBoardsForStateProvince(stateProvince: string): readonly string[] {
	const matched = stateProvince ? PROFILE_BOARDS_BY_STATE_PROVINCE[stateProvince] : undefined;
	if (matched && matched.length > 0) {
		return matched;
	}
	return PROFILE_JURISDICTIONS;
}

function profileSubdivisionsForCountry(country: string): readonly string[] | undefined {
	if (country === PROFILE_COUNTRY_CANADA) {
		return PROFILE_CANADA_PROVINCES;
	}
	if (country === PROFILE_COUNTRY_US) {
		return PROFILE_US_STATES;
	}
	return undefined;
}

function isKnownProfileCountry(country: string): boolean {
	return country === PROFILE_COUNTRY_CANADA || country === PROFILE_COUNTRY_US;
}

/**
 * Narrows a rendered SelectBox root to its `<select>` element across windows.
 */
function asSelectElement(el: Element | null): HTMLSelectElement | undefined {
	return isHTMLElement(el) && el.tagName === 'SELECT' ? el as HTMLSelectElement : undefined;
}

type OnboardingStepViewClassification = {
	owner: 'cwebster-99';
	comment: 'Tracks which onboarding step is viewed.';
	step: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The step identifier.' };
	stepNumber: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; isMeasurement: true; comment: 'The 1-based step index.' };
};

type OnboardingStepViewEvent = {
	step: string;
	stepNumber: number;
};

type OnboardingActionClassification = {
	owner: 'cwebster-99';
	comment: 'Tracks actions taken on the onboarding wizard.';
	action: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The action performed.' };
	step: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The step the action was performed on.' };
	argument: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Optional context such as theme id, extension id, or provider.' };
};

type OnboardingActionEvent = {
	action: string;
	step: string;
	argument: string | undefined;
};

/**
 * Variation A — Classic Wizard Modal
 *
 * A centered modal overlay with progress dots, clean step transitions,
 * and polished navigation. Sits on top of the agent sessions welcome
 * tab. When dismissed, the welcome tab is revealed underneath.
 *
 * Steps:
 * 1. Sign In — Safe Appeals Cloud (Google) identity, or continue without an account
 * 2. Profile — practice scoping and role
 * 3. Meet Your AI Assistant — data-flow disclosure, hallucination inoculation, approval mode
 * 4. Credits & First Steps — honest zero-credit handoff
 */
export class OnboardingVariationA extends Disposable implements IOnboardingService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidComplete = this._register(new Emitter<void>());
	readonly onDidComplete: Event<void> = this._onDidComplete.event;

	private readonly _onDidDismiss = this._register(new Emitter<OnboardingDismissReason>());
	readonly onDidDismiss: Event<OnboardingDismissReason> = this._onDidDismiss.event;

	private overlay: HTMLElement | undefined;
	private card: HTMLElement | undefined;
	private bodyEl: HTMLElement | undefined;
	private progressContainer: HTMLElement | undefined;
	private stepLabelEl: HTMLElement | undefined;
	private titleEl: HTMLElement | undefined;
	private subtitleEl: HTMLElement | undefined;
	private contentEl: HTMLElement | undefined;
	private backButton: HTMLButtonElement | undefined;
	private nextButton: HTMLButtonElement | undefined;
	private closeButton: HTMLButtonElement | undefined;
	private footerLeft: HTMLElement | undefined;
	private _footerSignInBtn: HTMLButtonElement | undefined;
	private readonly _footerSignInDisposable = this._register(new MutableDisposable());

	private currentStepIndex = 0;
	private readonly steps: readonly OnboardingStepId[];
	private readonly disposables = this._register(new DisposableStore());
	private readonly stepDisposables = this._register(new DisposableStore());
	private previouslyFocusedElement: HTMLElement | undefined;
	private _isShowing = false;
	/** Incremented each time {@link show} builds a new overlay; stale async sign-in continuations compare against it. */
	private _showGeneration = 0;

	private readonly footerFocusableElements: HTMLElement[] = [];
	private readonly stepFocusableElements: HTMLElement[] = [];
	private _userSignedIn = false;
	private _signInInProgress = false;
	private _signedInAccountLabel: string | undefined;
	/** SafeAppeals: profile step state; persisted to safeappeals.profile.* on step leave. */
	private profilePrefilled = false;
	private readonly profileValues: Record<ProfileFieldKey, string> = {
		name: '',
		organization: '',
		role: '',
		practiceArea: '',
		country: '',
		stateProvince: '',
		city: '',
		jurisdiction: '',
	};
	/** When true, Country select is "Other" and a free-text country input is shown. */
	private profileCountryOtherMode = false;
	private profileStateControlHost: HTMLElement | undefined;
	private profileBoardControlHost: HTMLElement | undefined;
	private profileCountryOtherHost: HTMLElement | undefined;
	private profileStateControlStore: DisposableStore | undefined;
	private profileBoardControlStore: DisposableStore | undefined;
	private profileCountryOtherStore: DisposableStore | undefined;

	/** SafeAppeals: hallucination acknowledgment gates Continue on the Agent Intro step. */
	private _aiLiteracyAcknowledged = false;
	/** SafeAppeals: approval mode chosen on Meet Your AI Assistant (default = review every change). */
	private _selectedApprovalMode: ApprovalMode = ApprovalMode.ReviewEveryChange;
	/** True once the user has selected an approval option (or leave wrote the default). */
	private _approvalChoiceLogged = false;

	constructor(
		@ILayoutService private readonly layoutService: ILayoutService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@INotificationService private readonly notificationService: INotificationService,
		@IFileService private readonly fileService: IFileService,
		@IPathService private readonly pathService: IPathService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@ICommandService private readonly commandService: ICommandService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IProductService private readonly productService: IProductService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IAuthenticationService private readonly authenticationService: IAuthenticationService,
		@IStorageService private readonly storageService: IStorageService,
		@IAccessibilityService private readonly accessibilityService: IAccessibilityService,
	) {
		super();

		this.steps = getOnboardingSteps(this.productService);
		this._aiLiteracyAcknowledged = this.storageService.getBoolean(AI_LITERACY_STORAGE_KEY, StorageScope.APPLICATION, false);
	}

	get isShowing(): boolean {
		return this._isShowing;
	}

	show(): void {
		if (this.overlay) {
			return;
		}

		this._showGeneration++;
		this._isShowing = true;
		this.previouslyFocusedElement = getActiveWindow().document.activeElement as HTMLElement | undefined;

		const container = this.layoutService.activeContainer;

		// Overlay
		this.overlay = append(container, $('.onboarding-a-overlay'));
		this.overlay.setAttribute('role', 'dialog');
		this.overlay.setAttribute('aria-modal', 'true');
		this.overlay.setAttribute('aria-label', localize('onboarding.a.aria', "Welcome to {0}", this.productService.nameLong));
		this._syncReducedMotionClass();
		// Cleared with `disposables` in `_removeFromDOM` so restart/show does not leak listeners.
		this.disposables.add(this.accessibilityService.onDidChangeReducedMotion(() => {
			this._syncReducedMotionClass();
		}));

		// Card
		this.card = append(this.overlay, $('.onboarding-a-card'));

		// Close button (upper-right corner of card)
		this.closeButton = append(this.card, $<HTMLButtonElement>('button.onboarding-a-close-btn'));
		this.closeButton.type = 'button';
		this.closeButton.setAttribute('aria-label', localize('onboarding.close', "Close"));
		this.closeButton.appendChild(renderIcon(Codicon.close));

		// Header with progress
		const header = append(this.card, $('.onboarding-a-header'));
		this.progressContainer = append(header, $('.onboarding-a-progress'));
		this.stepLabelEl = append(this.progressContainer, $('span.onboarding-a-step-label'));
		this._renderProgress();

		// SafeAppeals: persistent brand mark visible on every step
		const headerBrand = append(header, $('.onboarding-a-header-brand'));
		const headerBrandIcon = append(headerBrand, $('span.onboarding-a-header-brand-icon'));
		headerBrandIcon.setAttribute('aria-hidden', 'true');
		const headerBrandName = append(headerBrand, $('span.onboarding-a-header-brand-name'));
		headerBrandName.textContent = this.productService.nameLong;

		// Body
		this.bodyEl = append(this.card, $('.onboarding-a-body'));
		this.titleEl = append(this.bodyEl, $('h2.onboarding-a-step-title'));
		this.subtitleEl = append(this.bodyEl, $('p.onboarding-a-step-subtitle'));
		this.contentEl = append(this.bodyEl, $('.onboarding-a-step-content'));
		this._renderStep();
		this._logStepView();

		// Footer
		const footer = append(this.card, $('.onboarding-a-footer'));

		this.footerLeft = append(footer, $('.onboarding-a-footer-left'));

		const footerRight = append(footer, $('.onboarding-a-footer-right'));

		this.backButton = append(footerRight, $<HTMLButtonElement>('button.onboarding-a-btn.onboarding-a-btn-secondary'));
		this.backButton.textContent = localize('onboarding.back', "Back");
		this.backButton.type = 'button';
		this.footerFocusableElements.push(this.backButton);

		this.nextButton = append(footerRight, $<HTMLButtonElement>('button.onboarding-a-btn.onboarding-a-btn-primary'));
		this.nextButton.type = 'button';
		this.footerFocusableElements.push(this.nextButton);
		this._updateButtonStates();

		// Event handlers
		this.disposables.add(addDisposableListener(this.closeButton, EventType.CLICK, () => {
			this._logAction('skip');
			this._dismiss('skip');
		}));
		this.disposables.add(addDisposableListener(this.backButton, EventType.CLICK, () => {
			this._logAction('back');
			this._prevStep();
		}));
		this.disposables.add(addDisposableListener(this.nextButton, EventType.CLICK, () => {
			if (this.nextButton?.disabled) {
				return;
			}
			if (this._isLastStep()) {
				this._logAction('complete');
				this._dismiss('complete');
			} else if (this.currentStepIndex === 0) {
				this._logAction('continueWithoutSignIn');
				this._nextStep();
			} else {
				this._logAction('next');
				this._nextStep();
			}
		}));

		this.disposables.add(addDisposableListener(this.overlay, EventType.MOUSE_DOWN, (e: MouseEvent) => {
			if (e.target === this.overlay) {
				this._dismiss('dismiss');
			}
		}));

		this.disposables.add(addDisposableListener(this.overlay, EventType.KEY_DOWN, (e: KeyboardEvent) => {
			const event = new StandardKeyboardEvent(e);

			// Prevent all keyboard shortcuts from reaching the keybinding service
			e.stopPropagation();

			if (event.keyCode === KeyCode.Escape) {
				e.preventDefault();
				this._dismiss('dismiss');
				return;
			}

			if (event.keyCode === KeyCode.Tab) {
				this._trapTab(e, event.shiftKey);
			}
		}));

		// Entrance animation
		this.overlay.classList.add('entering');
		getActiveWindow().requestAnimationFrame(() => {
			this.overlay?.classList.remove('entering');
			this.overlay?.classList.add('visible');
		});

		this._focusCurrentStepElement();
	}

	private _dismiss(reason: OnboardingDismissReason): void {
		if (!this.overlay) {
			return;
		}

		// SafeAppeals: don't lose profile input when dismissing from the profile step
		if (this.steps[this.currentStepIndex] === OnboardingStepId.Profile) {
			this._saveProfile();
		}

		this._logAction('dismiss', undefined, reason);

		this.overlay.classList.remove('visible');
		this.overlay.classList.add('exiting');

		let handled = false;
		const onTransitionEnd = () => {
			if (handled) {
				return;
			}
			handled = true;
			this._removeFromDOM();
			if (reason === 'complete') {
				this._onDidComplete.fire();
			}
			this._onDidDismiss.fire(reason);
		};

		this.overlay.addEventListener('transitionend', onTransitionEnd, { once: true });
		setTimeout(onTransitionEnd, 400);
	}

	private _nextStep(): void {
		if (this.currentStepIndex < this.steps.length - 1) {
			const leavingStep = this.steps[this.currentStepIndex];
			if (leavingStep === OnboardingStepId.SignIn) {
				this._signInInProgress = false;
			}
			if (leavingStep === OnboardingStepId.Profile) {
				this._saveProfile(); // SafeAppeals
			}
			if (leavingStep === OnboardingStepId.AgentIntro) {
				if (!this._aiLiteracyAcknowledged) {
					return;
				}
				// Log only if the user never clicked a card (default path); select already logged.
				this._writeApprovalMode(this._selectedApprovalMode, !this._approvalChoiceLogged);
			}
			this.currentStepIndex++;
			this._renderStep();
			this._renderProgress();
			this._updateButtonStates();
			this._focusCurrentStepElement();
			this._logStepView();
		}
	}

	private _prevStep(): void {
		if (this.currentStepIndex > 0) {
			this.currentStepIndex--;
			this._renderStep();
			this._renderProgress();
			this._updateButtonStates();
			this._focusCurrentStepElement();
			this._logStepView();
		}
	}

	private _isLastStep(): boolean {
		return this.currentStepIndex === this.steps.length - 1;
	}

	private _renderProgress(): void {
		if (!this.progressContainer || !this.stepLabelEl) {
			return;
		}

		clearNode(this.progressContainer);

		for (let i = 0; i < this.steps.length; i++) {
			const dot = append(this.progressContainer, $('span.onboarding-a-progress-dot'));
			if (i === this.currentStepIndex) {
				dot.classList.add('active');
			} else if (i < this.currentStepIndex) {
				dot.classList.add('completed');
			}
		}

		this.progressContainer.appendChild(this.stepLabelEl);
		this.stepLabelEl.textContent = localize(
			'onboarding.stepOf',
			"{0} of {1}",
			this.currentStepIndex + 1,
			this.steps.length
		);
	}

	private _renderStep(): void {
		if (!this.titleEl || !this.subtitleEl || !this.contentEl) {
			return;
		}

		this.stepDisposables.clear();
		this.stepFocusableElements.length = 0;

		const stepId = this.steps[this.currentStepIndex];
		const useSignInHero = stepId === OnboardingStepId.SignIn;
		this.titleEl.style.display = useSignInHero ? 'none' : '';
		this.subtitleEl.style.display = useSignInHero ? 'none' : '';
		this.titleEl.textContent = getOnboardingStepTitle(stepId);
		this.subtitleEl.textContent = getOnboardingStepSubtitle(stepId, this.productService);

		clearNode(this.contentEl);

		switch (stepId) {
			case OnboardingStepId.SignIn:
				this._renderSignInStep(this.contentEl);
				break;
			case OnboardingStepId.Profile:
				this._renderProfileStep(this.contentEl);
				break;
			case OnboardingStepId.AgentIntro:
				this._renderAgentIntroStep(this.contentEl);
				break;
			case OnboardingStepId.CreditsHandoff:
				this._renderCreditsHandoffStep(this.contentEl);
				break;
		}

		this.bodyEl?.setAttribute('aria-label', localize(
			'onboarding.step.aria',
			"Step {0} of {1}: {2}",
			this.currentStepIndex + 1,
			this.steps.length,
			getOnboardingStepTitle(stepId)
		));
	}

	private _updateButtonStates(): void {
		if (this.backButton) {
			this.backButton.style.display = this.currentStepIndex === 0 ? 'none' : '';
		}
		if (this.nextButton) {
			if (this.currentStepIndex === 0) {
				if (this._userSignedIn) {
					this.nextButton.className = 'onboarding-a-btn onboarding-a-btn-primary';
					this.nextButton.textContent = localize('onboarding.continue', "Continue");
				} else {
					this.nextButton.className = 'onboarding-a-btn onboarding-a-btn-secondary';
					this.nextButton.textContent = localize('onboarding.continueWithoutSignIn', "Continue Without an Account");
				}
			} else if (this._isLastStep()) {
				this.nextButton.className = 'onboarding-a-btn onboarding-a-btn-primary';
				this.nextButton.textContent = localize('onboarding.getStarted', "Get Started");
			} else {
				this.nextButton.className = 'onboarding-a-btn onboarding-a-btn-primary';
				this.nextButton.textContent = localize('onboarding.next', "Continue");
			}

			// SafeAppeals: Meet Your AI Assistant — Continue stays disabled until hallucination acknowledgment.
			const onAgentIntro = this.steps[this.currentStepIndex] === OnboardingStepId.AgentIntro;
			this.nextButton.disabled = onAgentIntro && !this._aiLiteracyAcknowledged;
		}
		if (this.footerLeft) {
			if (this._isLastStep()) {
				// Show sign-in nudge in footer
				if (!this._footerSignInBtn && !this._userSignedIn) {
					this._footerSignInBtn = append(this.footerLeft, $<HTMLButtonElement>('button.onboarding-a-signin-nudge-btn'));
					this._footerSignInBtn.type = 'button';
					this._footerSignInBtn.textContent = localize('onboarding.sessions.signInNudge', "Sign In to Sync Your Profile");
					// DOM order is footer-left (nudge) then footer-right (Back/Next).
					this.footerFocusableElements.unshift(this._footerSignInBtn);
					this._footerSignInDisposable.value = addDisposableListener(this._footerSignInBtn, EventType.CLICK, () => {
						this._logAction('signInNudge');
						void this._handleSignIn(OnboardingSignInOrigin.FooterNudge);
					});
				}
			} else {
				this._clearFooterSignInBtn();
			}
		}
	}

	// =====================================================================
	// Step: Sign In
	// =====================================================================

	private _renderSignInStep(container: HTMLElement): void {
		const wrapper = append(container, $('.onboarding-a-signin'));
		const brand = append(wrapper, $('.onboarding-a-signin-brand'));
		const brandIcon = append(brand, $('span.onboarding-a-signin-brand-icon'));
		brandIcon.setAttribute('role', 'img');
		brandIcon.setAttribute('aria-label', this.productService.nameLong);

		const content = append(wrapper, $('.onboarding-a-signin-content'));
		const contentMain = append(content, $('.onboarding-a-signin-content-main'));
		const title = append(contentMain, $('h2.onboarding-a-signin-title'));
		title.textContent = localize('onboarding.signIn.heroTitle', "Welcome to {0}", this.productService.nameLong);

		const subtitle = append(contentMain, $('p.onboarding-a-signin-subtitle'));
		subtitle.textContent = localize(
			'onboarding.signIn.heroSubtitle',
			"One workspace for your entire appeal — documents, evidence, email, and an AI assistant that drafts while you review."
		);

		const actions = append(contentMain, $('.onboarding-a-signin-actions'));

		if (this._userSignedIn) {
			const signedIn = append(actions, $('.onboarding-a-signin-confirmation'));
			signedIn.setAttribute('aria-live', 'polite');
			const icon = append(signedIn, $('span'));
			icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.check));
			icon.setAttribute('aria-hidden', 'true');
			const text = append(signedIn, $('span'));
			if (this._signedInAccountLabel) {
				text.textContent = localize(
					'onboarding.signIn.signedInAs',
					"You're signed in as {0}. You can continue to the next step.",
					this._signedInAccountLabel
				);
			} else {
				text.textContent = localize('onboarding.signIn.signedIn', "You're signed in. You can continue to the next step.");
			}
		} else if (this._signInInProgress) {
			this._renderSignInProgress(actions);
		} else {
			this._renderDefaultSignInActions(actions);
		}

		const explainer = append(contentMain, $('p.onboarding-a-signin-explainer'));
		explainer.textContent = localize(
			'onboarding.signIn.accountExplainer',
			"A free account keeps your settings and profile in sync. Creating cases and editing documents never requires an account."
		);

		const footer = append(wrapper, $('.onboarding-a-signin-footer'));
		const disclaimerCol = append(footer, $('.onboarding-a-signin-disclaimer-col'));
		this._renderSignInDisclaimer(append(disclaimerCol, $('.onboarding-a-signin-disclaimer')));
	}

	/**
	 * Renders the Safe Appeals Cloud terms disclaimer with linked policy labels.
	 */
	private _renderSignInDisclaimer(parent: HTMLElement): void {
		const termsLabel = localize('onboarding.signIn.disclaimer.terms', "Terms of Service");
		const privacyLabel = localize('onboarding.signIn.disclaimer.privacy', "Privacy Policy");
		const message = localize(
			'onboarding.signIn.disclaimer',
			"By signing in you agree to the {0} {1} and {2}.",
			this.productService.nameLong,
			termsLabel,
			privacyLabel
		);

		const termsIndex = message.indexOf(termsLabel);
		const privacyIndex = termsIndex === -1 ? -1 : message.indexOf(privacyLabel, termsIndex + termsLabel.length);
		if (termsIndex === -1 || privacyIndex === -1) {
			parent.append(message);
			return;
		}

		parent.append(message.slice(0, termsIndex));
		const termsLink = this._createInlineLink(parent, termsLabel, 'https://safeappeals.com/terms');
		this.stepDisposables.add(addDisposableListener(termsLink, EventType.CLICK, e => {
			e.preventDefault();
			this._logAction('docLinkClick', undefined, 'termsOfService');
			void this.openerService.open(URI.parse('https://safeappeals.com/terms'), { openExternal: true });
		}));
		parent.append(message.slice(termsIndex + termsLabel.length, privacyIndex));
		const privacyLink = this._createInlineLink(parent, privacyLabel, 'https://safeappeals.com/privacy');
		this.stepDisposables.add(addDisposableListener(privacyLink, EventType.CLICK, e => {
			e.preventDefault();
			this._logAction('docLinkClick', undefined, 'privacyPolicy');
			void this.openerService.open(URI.parse('https://safeappeals.com/privacy'), { openExternal: true });
		}));
		parent.append(message.slice(privacyIndex + privacyLabel.length));
	}

	private _renderDefaultSignInActions(actions: HTMLElement): void {
		const googleLabel = localize('onboarding.signIn.google', "Continue with Google");
		const googleBtn = this._registerStepFocusable(this._createSignInButton(actions, googleLabel, {
			emphasized: true,
			ariaLabel: googleLabel,
		}));
		this.stepDisposables.add(addDisposableListener(googleBtn, EventType.CLICK, () => {
			this._logAction('signIn', undefined, SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID);
			void this._handleSignIn(OnboardingSignInOrigin.SignInStep);
		}));
	}

	/**
	 * Async progress region shown while waiting on provider registration or the OAuth flow.
	 */
	private _renderSignInProgress(actions: HTMLElement): void {
		const container = append(actions, $('.onboarding-a-signin-progress'));
		container.setAttribute('aria-live', 'polite');
		const spinner = append(container, $('span'));
		spinner.classList.add(...ThemeIcon.asClassNameArray(Codicon.loading), 'codicon-modifier-spin');
		spinner.setAttribute('aria-hidden', 'true');
		const message = append(container, $('.onboarding-a-signin-progress-message'));
		message.textContent = localize('onboarding.signIn.progress', "Waiting for sign-in to complete…");
	}

	/**
	 * Creates the primary Google sign-in button for Safe Appeals Cloud.
	 */
	private _createSignInButton(parent: HTMLElement, label: string, options?: { emphasized?: boolean; ariaLabel?: string }): HTMLButtonElement {
		const btn = append(parent, $<HTMLButtonElement>('button.onboarding-a-signin-btn'));
		btn.type = 'button';
		btn.title = options?.ariaLabel ?? label;
		btn.setAttribute('aria-label', options?.ariaLabel ?? label);
		if (options?.emphasized) {
			btn.classList.add('primary');
		}

		const mark = append(btn, $('span.onboarding-a-provider-mark.google'));
		mark.setAttribute('aria-hidden', 'true');

		const labelEl = append(btn, $('span.onboarding-a-signin-btn-label'));
		labelEl.textContent = label;

		return btn;
	}

	/**
	 * Signs in via Safe Appeals Cloud (`safeappeals-cloud`).
	 *
	 * @param origin Which UI started the request — controls post-success behavior
	 * and must be captured up front because `createSession` can outlive the step.
	 */
	private async _handleSignIn(origin: OnboardingSignInOrigin): Promise<void> {
		if (this._signInInProgress) {
			return;
		}

		const generation = this._showGeneration;
		const stepIndex = this.currentStepIndex;
		const stepId = this.steps[stepIndex];

		this._signInInProgress = true;
		if (origin === OnboardingSignInOrigin.SignInStep) {
			this._refreshSignInStepUi();
		}

		/** Wizard still the same showing that started this request. */
		const isSameShowing = (): boolean => this._isShowing && this._showGeneration === generation;
		/** Same showing and still on the step that initiated sign-in. */
		const isContinuationValid = (): boolean => (
			isSameShowing()
			&& this.currentStepIndex === stepIndex
			&& this.steps[this.currentStepIndex] === stepId
		);

		try {
			const providerReady = await waitForAuthenticationProvider(
				this.authenticationService,
				SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID,
				AUTH_PROVIDER_REGISTRATION_TIMEOUT_MS,
				this.disposables,
			);

			if (!isContinuationValid()) {
				return;
			}

			if (!providerReady) {
				this._logAction('signInProviderTimeout', undefined, SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID);
				this.notificationService.notify({
					severity: Severity.Error,
					message: localize(
						'onboarding.signIn.providerTimeout',
						"Sign-in is not ready yet. Wait a moment and try again, or continue without an account."
					),
				});
				return;
			}

			const session = await this.authenticationService.createSession(SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID, [], {
				activateImmediate: true,
			});

			if (!isSameShowing()) {
				return;
			}

			this._userSignedIn = true;
			this._signedInAccountLabel = session.account.label;
			this._logAction('signInSuccess', undefined, SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID);

			if (!isContinuationValid()) {
				return;
			}

			switch (origin) {
				case OnboardingSignInOrigin.SignInStep:
					this._nextStep();
					break;
				case OnboardingSignInOrigin.FooterNudge:
					if (this._footerSignInBtn) {
						this._footerSignInBtn.style.display = 'none';
					}
					this._updateButtonStates();
					break;
				case OnboardingSignInOrigin.CreditsStep:
					this._renderStep();
					this._updateButtonStates();
					break;
			}
		} catch (error) {
			if (!isSameShowing()) {
				return;
			}

			if (isCancellationError(error)) {
				this._logAction('signInCancelled', undefined, SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID);
				return;
			}

			// Extension already surfaces a specific, actionable error toast.
			this._logAction('signInFailed', undefined, SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID);
		} finally {
			this._signInInProgress = false;
			if (isContinuationValid() && origin === OnboardingSignInOrigin.SignInStep && !this._userSignedIn) {
				this._refreshSignInStepUi();
			}
		}
	}

	/**
	 * Re-renders the sign-in step after async progress / failure without advancing steps.
	 */
	private _refreshSignInStepUi(): void {
		if (this.steps[this.currentStepIndex] === OnboardingStepId.SignIn && this.contentEl) {
			this._renderStep();
			this._updateButtonStates();
			this._focusCurrentStepElement();
		}
	}

	// =====================================================================
	// Step: Profile (SafeAppeals)
	// =====================================================================

	private static readonly PROFILE_FIELDS: ReadonlyArray<ProfileFieldDescriptor> = [
		{ type: 'text', key: 'name', label: localize('onboarding.profile.name', "Your Name"), placeholder: localize('onboarding.profile.name.placeholder', "As it should appear in drafted documents") },
		{ type: 'text', key: 'organization', label: localize('onboarding.profile.organization', "Firm / Organization"), placeholder: localize('onboarding.profile.organization.placeholder', "Leave empty if self-represented") },
		{ type: 'pills', key: 'role', label: localize('onboarding.profile.role', "Your Role") },
		{ type: 'text', key: 'practiceArea', label: localize('onboarding.profile.practiceArea', "Area of Law"), placeholder: localize('onboarding.profile.practiceArea.placeholder', "e.g. Workers' Compensation") },
		{ type: 'select', key: 'country', label: localize('onboarding.profile.country', "Country") },
		{ type: 'select', key: 'stateProvince', label: localize('onboarding.profile.stateProvince', "State / Province") },
		{ type: 'text', key: 'city', label: localize('onboarding.profile.city', "City"), placeholder: localize('onboarding.profile.city.placeholder', "e.g. Vancouver, Los Angeles") },
		{ type: 'select', key: 'jurisdiction', label: localize('onboarding.profile.jurisdiction', "Compensation Board / Tribunal") },
	];

	private static readonly PROFILE_KEYS: readonly ProfileFieldKey[] = [
		'name', 'organization', 'role', 'practiceArea', 'country', 'stateProvince', 'city', 'jurisdiction',
	];

	private _renderProfileStep(container: HTMLElement): void {
		if (!this.profilePrefilled) {
			this.profilePrefilled = true;
			for (const key of OnboardingVariationA.PROFILE_KEYS) {
				const value = this.configurationService.getValue<string>(`safeappeals.profile.${key}`);
				if (typeof value === 'string' && value) {
					this.profileValues[key] = value;
				}
			}
			this.profileCountryOtherMode = !!this.profileValues.country && !isKnownProfileCountry(this.profileValues.country);
		}

		this.profileStateControlHost = undefined;
		this.profileBoardControlHost = undefined;
		this.profileCountryOtherHost = undefined;
		this.profileStateControlStore = this.stepDisposables.add(new DisposableStore());
		this.profileBoardControlStore = this.stepDisposables.add(new DisposableStore());
		this.profileCountryOtherStore = this.stepDisposables.add(new DisposableStore());

		const layout = append(container, $('.onboarding-a-profile-layout'));

		// SafeAppeals: plain-language explainer for people who have never used
		// an AI assistant beyond a chatbot — explains that these answers are
		// automatically shared with the assistant in every conversation.
		const info = append(layout, $('.onboarding-a-profile-info'));
		const infoTitle = append(info, $('h3.onboarding-a-profile-info-title'));
		infoTitle.textContent = localize('onboarding.profile.info.title', "Why we ask");

		const infoIntro = append(info, $('p.onboarding-a-profile-info-text'));
		infoIntro.textContent = localize('onboarding.profile.info.intro', "Safe Appeals includes an AI assistant that works with you on your cases and documents — think of it as a junior colleague, not a chatbot.");

		const infoHow = append(info, $('p.onboarding-a-profile-info-text'));
		infoHow.textContent = localize('onboarding.profile.info.how', "Whatever you enter here is automatically shared with the assistant at the start of every conversation. It will already know who you are — you never have to introduce yourself or re-explain your practice.");

		const infoList = append(info, $('ul.onboarding-a-profile-info-list'));
		const infoPoints = [
			localize('onboarding.profile.info.point.drafts', "Drafted documents and letters use your name, firm, and jurisdiction automatically"),
			localize('onboarding.profile.info.point.relevant', "Answers are framed for your area of law instead of being generic"),
			localize('onboarding.profile.info.point.control', "Everything stays on this computer — change or clear it anytime"),
		];
		for (const point of infoPoints) {
			const item = append(infoList, $('li.onboarding-a-profile-info-item'));
			const icon = item.appendChild(renderIcon(Codicon.check));
			icon.setAttribute('aria-hidden', 'true');
			const text = append(item, $('span'));
			text.textContent = point;
		}

		const form = append(layout, $('.onboarding-a-profile'));

		for (const field of OnboardingVariationA.PROFILE_FIELDS) {
			if (field.type === 'text') {
				this._renderProfileTextField(form, field);
				continue;
			}
			if (field.type === 'pills') {
				this._renderProfileRoleField(form, field.label);
				continue;
			}
			if (field.key === 'country') {
				this._renderProfileCountryField(form, field.label);
				continue;
			}
			if (field.key === 'stateProvince') {
				this._renderProfileStateField(form, field.label);
				continue;
			}
			this._renderProfileBoardField(form, field.label);
		}

		const hint = append(form, $('div.onboarding-a-theme-hint'));
		hint.textContent = localize('onboarding.profile.hint', "All fields are optional and stay on this computer. The AI agent uses them when organizing cases and drafting documents. Change them anytime with the \"Set Up Profile\" command.");
	}

	/**
	 * Renders a labeled text InputBox for a profile field.
	 */
	private _renderProfileTextField(form: HTMLElement, field: Extract<ProfileFieldDescriptor, { type: 'text' }>): void {
		const fieldEl = append(form, $('.onboarding-a-profile-field'));
		const inputId = `onboarding-profile-${field.key}`;
		const label = append(fieldEl, $<HTMLLabelElement>('label.onboarding-a-section-label'));
		label.htmlFor = inputId;
		label.textContent = field.label;

		const inputBox = this.stepDisposables.add(new InputBox(fieldEl, undefined, {
			placeholder: field.placeholder,
			ariaLabel: field.label,
			inputBoxStyles: defaultInputBoxStyles,
		}));
		inputBox.inputElement.id = inputId;
		inputBox.value = this.profileValues[field.key];
		this._registerStepFocusable(inputBox.inputElement);
		this.stepDisposables.add(inputBox.onDidChange(value => {
			this.profileValues[field.key] = value;
		}));
	}

	/**
	 * Localized display label for a canonical profile role value.
	 */
	private _profileRoleLabel(role: string): string {
		switch (role) {
			case PROFILE_ROLE_LAWYER:
				return localize('onboarding.profile.role.lawyer', "Lawyer");
			case PROFILE_ROLE_PARALEGAL:
				return localize('onboarding.profile.role.paralegal', "Paralegal");
			case PROFILE_ROLE_ADVOCATE:
				return localize('onboarding.profile.role.advocate', "Advocate");
			case PROFILE_ROLE_SELF:
				return localize('onboarding.profile.role.self', "Representing Myself");
			default:
				return role;
		}
	}

	/**
	 * Role pills with radio-group semantics. Persists the English canonical
	 * value to `safeappeals.profile.role` (same pattern as country/board).
	 * Clicking the already-selected pill clears the field (optional like the rest).
	 */
	private _renderProfileRoleField(form: HTMLElement, labelText: string): void {
		const fieldEl = append(form, $('.onboarding-a-profile-field'));
		const label = append(fieldEl, $('div.onboarding-a-section-label'));
		label.id = 'onboarding-profile-role-label';
		label.textContent = labelText;

		const group = append(fieldEl, $('.onboarding-a-role-pills'));
		group.setAttribute('role', 'radiogroup');
		group.setAttribute('aria-labelledby', 'onboarding-profile-role-label');

		const clearHint = localize('onboarding.profile.role.clearHint', "Click again to clear");
		const selectedIndex = (PROFILE_ROLES as readonly string[]).indexOf(this.profileValues.role);
		const pills: HTMLElement[] = [];

		const syncRolePillState = (activeIndex: number) => {
			const noneSelected = activeIndex < 0;
			for (let j = 0; j < pills.length; j++) {
				const selected = j === activeIndex;
				pills[j].setAttribute('aria-checked', selected ? 'true' : 'false');
				pills[j].classList.toggle('selected', selected);
				// When cleared, keep index 0 tab-reachable so the group stays keyboard-usable.
				pills[j].setAttribute('tabindex', (selected || (noneSelected && j === 0)) ? '0' : '-1');
				if (selected) {
					pills[j].setAttribute('aria-description', clearHint);
				} else {
					pills[j].removeAttribute('aria-description');
				}
			}
		};

		for (let i = 0; i < PROFILE_ROLES.length; i++) {
			const role = PROFILE_ROLES[i];
			const pill = append(group, $<HTMLButtonElement>('button.onboarding-a-role-pill'));
			pill.type = 'button';
			pill.setAttribute('role', 'radio');
			pill.textContent = this._profileRoleLabel(role);
			this._registerStepFocusable(pill);
			pills.push(pill);

			this.stepDisposables.add(addDisposableListener(pill, EventType.CLICK, () => {
				// Toggle-off: re-clicking the selected pill clears the optional field.
				// Arrow-key nav only .click()s a *different* index, so it never hits this branch.
				if (this.profileValues.role === role) {
					this.profileValues.role = '';
					syncRolePillState(-1);
					return;
				}
				this.profileValues.role = role;
				syncRolePillState(i);
			}));
		}

		syncRolePillState(selectedIndex);
		this._setupRadioGroupNavigation(pills, Math.max(0, selectedIndex));
	}

	/**
	 * Sets up WAI-ARIA radio-group keyboard navigation on a set of elements:
	 * - Arrow keys move focus between items (with wrap-around)
	 * - Only the focused item has tabindex=0; the rest have tabindex=-1
	 * - Space/Enter on a focused item fires its click handler
	 *
	 * Home/End that resolve to the already-focused index are ignored (no
	 * re-click), so toggle-to-deselect on role pills cannot fire from keyboard
	 * navigation — only from an explicit activation of the selected pill.
	 */
	private _setupRadioGroupNavigation(items: HTMLElement[], selectedIndex: number): void {
		// Initialise roving tabindex: only the selected item is tab-reachable
		for (let i = 0; i < items.length; i++) {
			items[i].setAttribute('tabindex', i === selectedIndex ? '0' : '-1');
		}

		for (let i = 0; i < items.length; i++) {
			this.stepDisposables.add(addDisposableListener(items[i], EventType.KEY_DOWN, (e: KeyboardEvent) => {
				const event = new StandardKeyboardEvent(e);
				let newIndex: number | undefined;

				if (event.keyCode === KeyCode.RightArrow || event.keyCode === KeyCode.DownArrow) {
					newIndex = (i + 1) % items.length;
				} else if (event.keyCode === KeyCode.LeftArrow || event.keyCode === KeyCode.UpArrow) {
					newIndex = (i - 1 + items.length) % items.length;
				} else if (event.keyCode === KeyCode.Home) {
					newIndex = 0;
				} else if (event.keyCode === KeyCode.End) {
					newIndex = items.length - 1;
				}

				if (newIndex !== undefined) {
					e.preventDefault();
					e.stopPropagation();
					// Same-index Home/End must not re-click (would toggle-deselect role pills).
					if (newIndex === i) {
						return;
					}
					items[i].setAttribute('tabindex', '-1');
					items[newIndex].setAttribute('tabindex', '0');
					items[newIndex].focus();
					items[newIndex].click();
				}
			}));
		}
	}

	/**
	 * Country select (Canada / United States / Other) with optional free-text
	 * when Other is chosen.
	 */
	private _renderProfileCountryField(form: HTMLElement, labelText: string): void {
		const fieldEl = append(form, $('.onboarding-a-profile-field'));
		const inputId = 'onboarding-profile-country';
		const label = append(fieldEl, $<HTMLLabelElement>('label.onboarding-a-section-label'));
		label.htmlFor = inputId;
		label.textContent = labelText;

		const notSpecified = localize('onboarding.profile.notSpecified', "Not specified");
		const options: ISelectOptionItem[] = [
			{ text: notSpecified },
			{ text: PROFILE_COUNTRY_CANADA },
			{ text: PROFILE_COUNTRY_US },
			{ text: PROFILE_COUNTRY_OTHER },
		];
		let selected = 0;
		if (this.profileCountryOtherMode) {
			selected = 3;
		} else if (this.profileValues.country === PROFILE_COUNTRY_CANADA) {
			selected = 1;
		} else if (this.profileValues.country === PROFILE_COUNTRY_US) {
			selected = 2;
		}

		const selectBox = this.stepDisposables.add(new SelectBox(options, selected, this.contextViewService, defaultSelectBoxStyles, {
			ariaLabel: labelText,
		}));
		selectBox.render(fieldEl);
		const countrySelectEl = asSelectElement(fieldEl.lastElementChild);
		if (countrySelectEl) {
			countrySelectEl.id = inputId;
			this._registerStepFocusable(countrySelectEl);
		}
		this.stepDisposables.add(selectBox.onDidSelect(e => {
			if (e.index === 0) {
				this.profileCountryOtherMode = false;
				this.profileValues.country = '';
			} else if (e.index === 1) {
				this.profileCountryOtherMode = false;
				this.profileValues.country = PROFILE_COUNTRY_CANADA;
			} else if (e.index === 2) {
				this.profileCountryOtherMode = false;
				this.profileValues.country = PROFILE_COUNTRY_US;
			} else {
				this.profileCountryOtherMode = true;
				if (isKnownProfileCountry(this.profileValues.country)) {
					this.profileValues.country = '';
				}
			}
			this._syncProfileCountryOtherInput();
			this._rebuildProfileStateControl();
			this._rebuildProfileBoardControl();
		}));

		this.profileCountryOtherHost = append(fieldEl, $('.onboarding-a-profile-country-other'));
		this._syncProfileCountryOtherInput();
	}

	/**
	 * Shows or hides the free-text country input used when Country is Other.
	 */
	private _syncProfileCountryOtherInput(): void {
		const host = this.profileCountryOtherHost;
		const store = this.profileCountryOtherStore;
		if (!host || !store) {
			return;
		}
		store.clear();
		clearNode(host);
		host.style.display = this.profileCountryOtherMode ? '' : 'none';
		if (!this.profileCountryOtherMode) {
			return;
		}

		const otherLabel = localize('onboarding.profile.countryOther', "Country name");
		const inputId = 'onboarding-profile-country-other';
		const label = append(host, $<HTMLLabelElement>('label.onboarding-a-section-label'));
		label.htmlFor = inputId;
		label.textContent = otherLabel;

		const inputBox = store.add(new InputBox(host, undefined, {
			placeholder: localize('onboarding.profile.countryOther.placeholder', "e.g. Australia, Mexico"),
			ariaLabel: otherLabel,
			inputBoxStyles: defaultInputBoxStyles,
		}));
		inputBox.inputElement.id = inputId;
		inputBox.value = this.profileValues.country;
		this._registerStepFocusable(inputBox.inputElement);
		store.add(inputBox.onDidChange(value => {
			this.profileValues.country = value;
		}));
	}

	/**
	 * State / Province control — select for Canada/US, free text otherwise.
	 */
	private _renderProfileStateField(form: HTMLElement, labelText: string): void {
		const fieldEl = append(form, $('.onboarding-a-profile-field'));
		const inputId = 'onboarding-profile-stateProvince';
		const label = append(fieldEl, $<HTMLLabelElement>('label.onboarding-a-section-label'));
		label.htmlFor = inputId;
		label.textContent = labelText;

		this.profileStateControlHost = append(fieldEl, $('.onboarding-a-profile-state-control'));
		this._rebuildProfileStateControl();
	}

	/**
	 * Rebuilds the State / Province control after Country changes.
	 */
	private _rebuildProfileStateControl(): void {
		const host = this.profileStateControlHost;
		const store = this.profileStateControlStore;
		if (!host || !store) {
			return;
		}
		store.clear();
		clearNode(host);

		const labelText = localize('onboarding.profile.stateProvince', "State / Province");
		const inputId = 'onboarding-profile-stateProvince';
		const subdivisions = this.profileCountryOtherMode ? undefined : profileSubdivisionsForCountry(this.profileValues.country);

		if (!subdivisions) {
			// Other / unspecified country: free-text state/province.
			const inputBox = store.add(new InputBox(host, undefined, {
				placeholder: localize('onboarding.profile.stateProvince.placeholder', "e.g. British Columbia, California"),
				ariaLabel: labelText,
				inputBoxStyles: defaultInputBoxStyles,
			}));
			inputBox.inputElement.id = inputId;
			inputBox.value = this.profileValues.stateProvince;
			this._registerStepFocusable(inputBox.inputElement);
			store.add(inputBox.onDidChange(value => {
				this.profileValues.stateProvince = value;
				this._rebuildProfileBoardControl();
			}));
			return;
		}

		// Preserve state if still valid for the new country; otherwise reset.
		if (this.profileValues.stateProvince && !(subdivisions as readonly string[]).includes(this.profileValues.stateProvince)) {
			this.profileValues.stateProvince = '';
		}

		const notSpecified = localize('onboarding.profile.notSpecified', "Not specified");
		const options: ISelectOptionItem[] = [
			{ text: notSpecified },
			...subdivisions.map(s => ({ text: s })),
		];
		const selected = this.profileValues.stateProvince
			? options.findIndex(o => o.text === this.profileValues.stateProvince)
			: 0;

		const selectBox = store.add(new SelectBox(options, selected < 0 ? 0 : selected, this.contextViewService, defaultSelectBoxStyles, {
			ariaLabel: labelText,
		}));
		selectBox.render(host);
		const stateSelectEl = asSelectElement(host.firstElementChild);
		if (stateSelectEl) {
			stateSelectEl.id = inputId;
			this._registerStepFocusable(stateSelectEl);
		}
		store.add(selectBox.onDidSelect(e => {
			this.profileValues.stateProvince = e.index === 0 ? '' : e.selected;
			this._rebuildProfileBoardControl();
		}));
	}

	/**
	 * Compensation board / tribunal select, filtered by State / Province.
	 */
	private _renderProfileBoardField(form: HTMLElement, labelText: string): void {
		const fieldEl = append(form, $('.onboarding-a-profile-field'));
		const inputId = 'onboarding-profile-jurisdiction';
		const label = append(fieldEl, $<HTMLLabelElement>('label.onboarding-a-section-label'));
		label.htmlFor = inputId;
		label.textContent = labelText;

		this.profileBoardControlHost = append(fieldEl, $('.onboarding-a-profile-board-control'));
		this._rebuildProfileBoardControl();
	}

	/**
	 * Rebuilds board options when State / Province changes. Falls back to the
	 * full board list when the selected province has no matches.
	 */
	private _rebuildProfileBoardControl(): void {
		const host = this.profileBoardControlHost;
		const store = this.profileBoardControlStore;
		if (!host || !store) {
			return;
		}
		store.clear();
		clearNode(host);

		const labelText = localize('onboarding.profile.jurisdiction', "Compensation Board / Tribunal");
		const inputId = 'onboarding-profile-jurisdiction';
		const boards = profileBoardsForStateProvince(this.profileValues.stateProvince);

		// Known board that doesn't match the province filter → reset. Custom
		// (non-list) values are preserved and appended to the options below.
		if (
			this.profileValues.jurisdiction &&
			!(boards as readonly string[]).includes(this.profileValues.jurisdiction) &&
			(PROFILE_JURISDICTIONS as readonly string[]).includes(this.profileValues.jurisdiction)
		) {
			this.profileValues.jurisdiction = '';
		}

		const notSpecified = localize('onboarding.profile.notSpecified', "Not specified");
		const options: ISelectOptionItem[] = [
			{ text: notSpecified },
			...boards.map(b => ({ text: b })),
		];
		if (this.profileValues.jurisdiction && !options.some(o => o.text === this.profileValues.jurisdiction)) {
			options.push({ text: this.profileValues.jurisdiction });
		}
		const selected = this.profileValues.jurisdiction
			? options.findIndex(o => o.text === this.profileValues.jurisdiction)
			: 0;

		const selectBox = store.add(new SelectBox(options, selected < 0 ? 0 : selected, this.contextViewService, defaultSelectBoxStyles, {
			ariaLabel: labelText,
		}));
		selectBox.render(host);
		const boardSelectEl = asSelectElement(host.firstElementChild);
		if (boardSelectEl) {
			boardSelectEl.id = inputId;
			this._registerStepFocusable(boardSelectEl);
		}
		store.add(selectBox.onDidSelect(e => {
			this.profileValues.jurisdiction = e.index === 0 ? '' : e.selected;
		}));
	}

	/**
	 * SafeAppeals: persists the profile step to `safeappeals.profile.*` user
	 * settings and writes a user-level instructions file that the chat system
	 * attaches to every request (`~/.copilot/instructions` is a built-in
	 * location, see DEFAULT_INSTRUCTIONS_SOURCE_FOLDERS).
	 *
	 * Always writes — including empty values — so clearing the form clears
	 * stale settings and the instructions file on disk.
	 */
	private _saveProfile(): void {
		const entries = Object.entries(this.profileValues) as [ProfileFieldKey, string][];
		for (const [key, value] of entries) {
			this.configurationService.updateValue(`safeappeals.profile.${key}`, value.trim(), ConfigurationTarget.USER)
				.catch(() => { /* non-fatal */ });
		}
		this._writeProfileRule().catch(() => {
			// Settings still saved; surface the instructions-file failure with recovery.
			this.notificationService.notify({
				severity: Severity.Warning,
				message: localize(
					'onboarding.profile.ruleWriteFailed',
					"Your profile was saved, but {0} could not update the assistant's copy of it. Run \"Safe Appeals Case: Set Up Profile\" from the Command Palette to try again.",
					this.productService.nameLong
				),
			});
		});
		this._logAction('saveProfile');
	}

	/**
	 * Writes the user-level profile instructions file. Must stay byte-identical
	 * to `renderProfileRule` in `extensions/safeappeals-case/src/profile.ts`.
	 */
	private async _writeProfileRule(): Promise<void> {
		const home = await this.pathService.userHome();
		const target = joinPath(home, '.copilot', 'instructions', 'safeappeals-profile.instructions.md');

		const facts: string[] = [];
		const push = (label: string, value: string) => {
			if (value.trim()) {
				facts.push(`- **${label}:** ${value.trim()}`);
			}
		};
		push('Name', this.profileValues.name);
		push('Firm / organization', this.profileValues.organization);
		push('Role', this.profileValues.role);
		push('Practice area', this.profileValues.practiceArea);
		push('Country', this.profileValues.country);
		push('State / province', this.profileValues.stateProvince);
		push('City', this.profileValues.city);
		push('Compensation board / tribunal', this.profileValues.jurisdiction);

		const content = [
			'---',
			`description: 'Safe Appeals user profile — who the user is and how they practice'`,
			`applyTo: '**'`,
			'---',
			'',
			'# About the Safe Appeals user',
			'',
			'This profile was set up during the Safe Appeals welcome onboarding',
			'(rerun "Safe Appeals Case: Set Up Profile" to change it).',
			'',
			...facts,
			'',
			'When drafting documents, correspondence, or appeals, write from this',
			'person\'s perspective and jurisdiction unless the case brief (AGENTS.md',
			'in the case folder) says otherwise. Case-specific facts always take',
			'precedence over this profile.',
			'',
			'Flag every legal citation you produce as *unverified* and tell the user',
			'to confirm it against a primary source before relying on it.',
			'',
		].join('\n');

		await this.fileService.createFolder(dirname(target));
		await this.fileService.writeFile(target, VSBuffer.fromString(content));
	}

	// =====================================================================
	// Step: Meet Your AI Assistant
	// =====================================================================

	/**
	 * Renders the Meet Your AI Assistant step: data-flow disclosure first,
	 * plain-language capability cards, hallucination inoculation with a
	 * Continue-gating acknowledgment, then approval-mode choice.
	 */
	private _renderAgentIntroStep(container: HTMLElement): void {
		this._aiLiteracyAcknowledged = this.storageService.getBoolean(AI_LITERACY_STORAGE_KEY, StorageScope.APPLICATION, false);

		const wrapper = append(container, $('.onboarding-a-agent-intro'));

		this._renderAgentIntroDisclosure(wrapper);

		const features = append(wrapper, $('.onboarding-a-agent-intro-features'));
		this._createFeatureCard(
			features,
			Codicon.folderOpened,
			localize('onboarding.agentIntro.readsCase', "It reads your case file"),
			localize('onboarding.agentIntro.readsCase.desc', "When you ask a question, the assistant can read the documents in your case folder to answer with your facts — not generic law.")
		);
		this._createFeatureCard(
			features,
			Codicon.check,
			localize('onboarding.agentIntro.asksFirst', "It asks before changing anything"),
			localize('onboarding.agentIntro.asksFirst.desc', "The assistant never edits or creates a document without showing you the change first. You approve or reject every edit.")
		);
		this._createFeatureCard(
			features,
			Codicon.warning,
			localize('onboarding.agentIntro.canBeWrong', "It can be wrong")
		);

		this._renderAgentIntroInoculation(wrapper);
		this._renderAgentIntroApprovalMode(wrapper);

		const docsRow = append(wrapper, $('.onboarding-a-agent-intro-docs'));
		this._createDocLink(
			docsRow,
			localize('onboarding.agentIntro.learnMore', "Learn more about the AI assistant"),
			AI_ASSISTANT_DOCS_URL,
			'aiAssistantDocs'
		);
	}

	/**
	 * ABA Op. 512 / Florida Bar 24-1 aligned data-flow disclosure — shown
	 * before any AI capability framing. Softened retention wording only;
	 * do not strengthen to an unverified "not used to train" claim.
	 */
	private _renderAgentIntroDisclosure(parent: HTMLElement): void {
		const panel = append(parent, $('.onboarding-a-disclosure'));
		const heading = append(panel, $('h3.onboarding-a-disclosure-heading'));
		heading.textContent = localize('onboarding.agentIntro.disclosure.heading', "Where your information goes");

		const body = append(panel, $('p.onboarding-a-disclosure-body'));
		const privacyLabel = localize('onboarding.agentIntro.disclosure.privacy', "Privacy Policy");
		const bodyText = localize(
			'onboarding.agentIntro.disclosure.body',
			"Your case files stay on this computer. When you ask the AI assistant a question, the text you send — and any documents you attach — go to SafeAppeals Cloud to generate the answer, then to the AI model provider. Your prompts and documents are used only to generate your answer and are handled under the model provider's retention policy. You remain responsible for reviewing everything the assistant produces: its output is a drafting aid, not legal advice and not a court-ready filing. Read our {0} for details.",
			privacyLabel
		);
		const privacyIndex = bodyText.lastIndexOf(privacyLabel);
		if (privacyIndex === -1) {
			body.textContent = bodyText;
		} else {
			body.append(bodyText.slice(0, privacyIndex));
			const privacyLink = this._createInlineLink(body, privacyLabel, 'https://safeappeals.com/privacy');
			this.stepDisposables.add(addDisposableListener(privacyLink, EventType.CLICK, e => {
				e.preventDefault();
				this._logAction('docLinkClick', undefined, 'privacyPolicy');
				void this.openerService.open(URI.parse('https://safeappeals.com/privacy'), { openExternal: true });
			}));
			body.append(bodyText.slice(privacyIndex + privacyLabel.length));
		}

		const consentRow = append(panel, $('.onboarding-a-disclosure-consent'));
		const consentLink = this._createInlineLink(
			consentRow,
			localize('onboarding.agentIntro.consentGuidance', "Client-consent guidance for your practice"),
			AI_ASSISTANT_DOCS_URL
		);
		this.stepDisposables.add(addDisposableListener(consentLink, EventType.CLICK, e => {
			e.preventDefault();
			this._logAction('docLinkClick', undefined, 'clientConsentGuidance');
			void this.openerService.open(URI.parse(AI_ASSISTANT_DOCS_URL), { openExternal: true });
		}));
	}

	/**
	 * Calm-breaking inoculation block: fabricated citation example plus a
	 * checkbox that gates Continue. No timing dependence (WCAG 2.2.1).
	 */
	private _renderAgentIntroInoculation(parent: HTMLElement): void {
		const block = append(parent, $('.onboarding-a-inoculation'));
		block.setAttribute('role', 'note');

		const citation = append(block, $('blockquote.onboarding-a-inoculation-citation'));
		citation.textContent = localize(
			{
				key: 'onboarding.agentIntro.inoculation.citation',
				comment: [
					'SAFETY-CRITICAL: This citation is intentionally fabricated to teach hallucination risk. It must NOT be replaced with a real case. Translators may adapt only to an equally non-existent citation in the target jurisdiction\'s format.',
				],
			},
			"Dowell v. Ridgeline Freight Systems Inc., 212 Work. Comp. App. Rep. 4th 519 (2018)"
		);

		const caption = append(block, $('p.onboarding-a-inoculation-caption'));
		caption.textContent = localize(
			'onboarding.agentIntro.inoculation.caption',
			"This case does not exist — and neither does the reporter it claims to come from. The AI assembled it from real-looking pieces; this is called a hallucination, and lawyers have been sanctioned for filing citations like it."
		);

		const ackRow = append(block, $('label.onboarding-a-inoculation-ack'));
		const checkbox = this._registerStepFocusable(append(ackRow, $<HTMLInputElement>('input.onboarding-a-inoculation-checkbox')));
		checkbox.type = 'checkbox';
		checkbox.id = 'onboarding-ai-literacy-ack';
		checkbox.checked = this._aiLiteracyAcknowledged;

		const ackText = append(ackRow, $('span.onboarding-a-inoculation-ack-text'));
		ackText.textContent = localize(
			'onboarding.agentIntro.inoculation.ack',
			"I understand the assistant can cite cases and facts that do not exist. I will verify citations against a primary source before relying on them."
		);

		this.stepDisposables.add(addDisposableListener(checkbox, EventType.CHANGE, () => {
			this._aiLiteracyAcknowledged = checkbox.checked;
			this.storageService.store(AI_LITERACY_STORAGE_KEY, checkbox.checked, StorageScope.APPLICATION, StorageTarget.USER);
			if (checkbox.checked) {
				this._logAction('trustAccepted');
			}
			this._updateButtonStates();
		}));
	}

	/**
	 * Approval-mode radio cards. Writes the full default-shaped
	 * `chat.tools.edits.autoApprove` object with only the catch-all glob key varied.
	 */
	private _renderAgentIntroApprovalMode(parent: HTMLElement): void {
		const section = append(parent, $('.onboarding-a-ai-pref'));
		const label = append(section, $('div.onboarding-a-section-label'));
		label.id = 'onboarding-approval-mode-label';
		label.textContent = localize('onboarding.agentIntro.approval.label', "When the assistant edits a document");

		const cards = append(section, $('.onboarding-a-ai-pref-cards'));
		cards.setAttribute('role', 'radiogroup');
		cards.setAttribute('aria-labelledby', 'onboarding-approval-mode-label');

		const allCards: HTMLButtonElement[] = [];
		const recommendedLabel = localize('onboarding.agentIntro.approval.recommended', "Recommended");

		for (const option of ONBOARDING_APPROVAL_MODE_OPTIONS) {
			const card = this._registerStepFocusable(append(cards, $<HTMLButtonElement>('button.onboarding-a-ai-pref-card')));
			card.type = 'button';
			card.dataset.id = option.id;
			card.setAttribute('role', 'radio');
			const selected = option.id === this._selectedApprovalMode;
			card.setAttribute('aria-checked', selected ? 'true' : 'false');
			if (selected) {
				card.classList.add('selected');
			}
			allCards.push(card);

			const iconEl = append(card, $('span.onboarding-a-ai-pref-card-icon'));
			iconEl.setAttribute('aria-hidden', 'true');
			const icon = Codicon[option.icon as keyof typeof Codicon] ?? Codicon.check;
			iconEl.appendChild(renderIcon(icon));

			const titleEl = append(card, $('div.onboarding-a-ai-pref-card-title'));
			titleEl.textContent = option.label;
			if (option.recommended) {
				const badge = append(titleEl, $('span.onboarding-a-ai-pref-card-badge'));
				badge.textContent = recommendedLabel;
			}

			const descEl = append(card, $('div.onboarding-a-ai-pref-card-desc'));
			descEl.textContent = option.description;

			this.stepDisposables.add(addDisposableListener(card, EventType.CLICK, () => {
				this._selectedApprovalMode = option.id;
				for (const c of allCards) {
					const isSelected = c.dataset.id === option.id;
					c.classList.toggle('selected', isSelected);
					c.setAttribute('aria-checked', isSelected ? 'true' : 'false');
				}
				this._writeApprovalMode(option.id, true);
			}));
		}

		const selectedIndex = ONBOARDING_APPROVAL_MODE_OPTIONS.findIndex(o => o.id === this._selectedApprovalMode);
		this._setupRadioGroupNavigation(allCards, Math.max(0, selectedIndex));
	}

	/**
	 * Writes the full default-shaped auto-approve object with only the
	 * catch-all glob key varied. Copies the imported constant — never mutates it in place.
	 */
	private _writeApprovalMode(mode: ApprovalMode, logChoice: boolean): void {
		const autoApproveRoutine = mode === ApprovalMode.ApplyRoutineEdits;
		const value: Record<string, boolean> = { ...defaultChatToolsEditsAutoApprove, '**/*': autoApproveRoutine };
		void this.configurationService.updateValue(ChatConfiguration.AutoApproveEdits, value, ConfigurationTarget.USER)
			.catch(error => onUnexpectedError(error));
		if (logChoice) {
			this._logAction('approvalChoice', undefined, mode);
			this._approvalChoiceLogged = true;
		}
	}

	// =====================================================================
	// Step: Credits & First Steps
	// =====================================================================

	/**
	 * Renders the honest credits handoff: what is free, AI is metered, live
	 * balance when signed in, pricing/docs links, and a zero-cost first action.
	 */
	private _renderCreditsHandoffStep(container: HTMLElement): void {
		const wrapper = append(container, $('.onboarding-a-credits'));

		const copy = append(wrapper, $('p.onboarding-a-credits-copy'));
		copy.textContent = localize(
			'onboarding.credits.copy',
			"AI drafting and research run on credits. Your account starts with zero credits — nothing runs, and nothing is charged, until you choose to buy a pack. There is no subscription."
		);

		const balanceRegion = append(wrapper, $('.onboarding-a-credits-balance'));
		balanceRegion.setAttribute('aria-live', 'polite');
		balanceRegion.setAttribute('aria-atomic', 'true');
		this._renderCreditsBalanceRegion(balanceRegion);

		const linksRow = append(wrapper, $('.onboarding-a-credits-links'));
		this._createCreditsExternalLink(
			linksRow,
			localize('onboarding.credits.viewPricing', "View Pricing"),
			CREDITS_PRICING_URL,
			'viewPricing'
		);
		this._createCreditsExternalLink(
			linksRow,
			localize('onboarding.credits.howCreditsWork', "How Credits Work"),
			CREDITS_DOCS_URL,
			'howCreditsWork'
		);

		const firstAction = append(wrapper, $('.onboarding-a-credits-first-action'));
		const heading = append(firstAction, $('h3.onboarding-a-credits-first-heading'));
		heading.textContent = this._getCreditsRoleHeading();

		const firstActionHint = append(firstAction, $('p.onboarding-a-credits-first-hint'));
		firstActionHint.textContent = localize(
			'onboarding.credits.firstAction.hint',
			"Walk through a fictional sample appeal — case files, where chat opens, and how approvals look — without spending credits."
		);

		const actions = append(firstAction, $('.onboarding-a-credits-actions'));
		const sampleBtn = this._registerStepFocusable(append(actions, $<HTMLButtonElement>('button.onboarding-a-btn.onboarding-a-btn-primary')));
		sampleBtn.type = 'button';
		sampleBtn.textContent = localize('onboarding.credits.openSampleCase', "Open the Sample Case");
		this.stepDisposables.add(addDisposableListener(sampleBtn, EventType.CLICK, () => {
			void this._runCreditsFirstAction('safeappeals-case.openSampleCase', 'openSampleCase');
		}));

		const ownCaseBtn = this._registerStepFocusable(append(actions, $<HTMLButtonElement>('button.onboarding-a-btn.onboarding-a-btn-secondary')));
		ownCaseBtn.type = 'button';
		ownCaseBtn.textContent = localize('onboarding.credits.startOwnCase', "Start with My Own Case");
		this.stepDisposables.add(addDisposableListener(ownCaseBtn, EventType.CLICK, () => {
			void this._runCreditsFirstAction('safeappeals-case.initCase', 'startOwnCase');
		}));
	}

	/**
	 * Fills the balance region: live balance when signed in, or a sign-in path
	 * when not. Failed lookups never blank the step or show a fake zero.
	 */
	private _renderCreditsBalanceRegion(balanceRegion: HTMLElement): void {
		clearNode(balanceRegion);

		if (!this._userSignedIn) {
			const unsigned = append(balanceRegion, $('.onboarding-a-credits-unsigned'));
			const unsignedCopy = append(unsigned, $('p.onboarding-a-credits-unsigned-copy'));
			unsignedCopy.textContent = localize(
				'onboarding.credits.unsigned',
				"Sign in to see your credit balance and buy a pack when you are ready for AI help. Everything else stays free either way."
			);
			const signInBtn = this._registerStepFocusable(append(unsigned, $<HTMLButtonElement>('button.onboarding-a-btn.onboarding-a-btn-secondary')));
			signInBtn.type = 'button';
			signInBtn.textContent = localize('onboarding.credits.signIn', "Sign In");
			this.stepDisposables.add(addDisposableListener(signInBtn, EventType.CLICK, () => {
				this._logAction('creditsSignIn');
				void this._handleSignIn(OnboardingSignInOrigin.CreditsStep);
			}));
			return;
		}

		const status = append(balanceRegion, $('p.onboarding-a-credits-balance-status'));
		status.textContent = localize('onboarding.credits.checking', "Checking credit balance…");

		const actions = append(balanceRegion, $('.onboarding-a-credits-balance-actions'));
		const addCreditsBtn = this._registerStepFocusable(append(actions, $<HTMLButtonElement>('button.onboarding-a-btn.onboarding-a-btn-secondary')));
		addCreditsBtn.type = 'button';
		addCreditsBtn.textContent = localize('onboarding.credits.addCredits', "Add Credits");
		this.stepDisposables.add(addDisposableListener(addCreditsBtn, EventType.CLICK, () => {
			this._logAction('openCheckout');
			void this.commandService.executeCommand('safeappeals.cloud.openCheckout').catch(() => {
				this.notificationService.notify({
					severity: Severity.Info,
					message: localize('onboarding.credits.checkoutUnavailable', "Could not open checkout right now. Use View Pricing to see packs in your browser."),
				});
			});
		}));

		let cancelled = false;
		this.stepDisposables.add({ dispose: () => { cancelled = true; } });

		void this.commandService.executeCommand<{ balance: number; unit: string }>('safeappeals.cloud.getBalance')
			.then(result => {
				if (cancelled || !status.isConnected) {
					return;
				}
				if (result && typeof result.balance === 'number') {
					status.textContent = localize(
						'onboarding.credits.balance',
						"Your balance: {0} credits",
						result.balance.toLocaleString()
					);
					return;
				}
				status.textContent = localize(
					'onboarding.credits.balanceUnavailable',
					"Your balance could not be loaded right now. You can still explore the sample case for free, or buy a pack from View Pricing."
				);
			}, () => {
				if (cancelled || !status.isConnected) {
					return;
				}
				status.textContent = localize(
					'onboarding.credits.balanceUnavailable',
					"Your balance could not be loaded right now. You can still explore the sample case for free, or buy a pack from View Pricing."
				);
			});
	}

	/**
	 * Role-tailored first-action heading from the stored profile role, with a
	 * neutral fallback when the role is empty or unrecognized.
	 */
	private _getCreditsRoleHeading(): string {
		const fromProfile = this.profileValues.role?.trim() ?? '';
		const fromConfig = String(this.configurationService.getValue('safeappeals.profile.role') ?? '').trim();
		const role = (fromProfile || fromConfig).toLowerCase();

		if (!role) {
			return localize(
				'onboarding.credits.firstHeading.neutral',
				"Try the Sample Case — No Credits Needed"
			);
		}
		if (/\b(lawyer|attorney|counsel)\b/.test(role)) {
			return localize(
				'onboarding.credits.firstHeading.lawyer',
				"Try It on a Sample Matter — No Credits Needed"
			);
		}
		if (/\bparalegal\b/.test(role)) {
			return localize(
				'onboarding.credits.firstHeading.paralegal',
				"Try It on a Sample File — No Credits Needed"
			);
		}
		if (/\badvocate\b/.test(role)) {
			return localize(
				'onboarding.credits.firstHeading.advocate',
				"Try It on a Sample Case — No Credits Needed"
			);
		}
		if (/\b(worker|claimant|representing myself|self-represented|self represented)\b/.test(role)) {
			return localize(
				'onboarding.credits.firstHeading.claimant',
				"Explore a Sample Appeal — No Credits Needed"
			);
		}
		// Unrecognized free-text role: stay neutral rather than echoing arbitrary input.
		return localize(
			'onboarding.credits.firstHeading.neutral',
			"Try the Sample Case — No Credits Needed"
		);
	}

	/**
	 * Doc-style external link that opens via {@link IOpenerService} (Electron-safe).
	 */
	private _createCreditsExternalLink(parent: HTMLElement, label: string, href: string, linkId: string): void {
		const link = this._registerStepFocusable(append(parent, $<HTMLAnchorElement>('a.onboarding-a-doc-link')));
		link.textContent = label;
		link.href = href;
		link.target = '_blank';
		link.rel = 'noopener';
		link.prepend(renderIcon(Codicon.linkExternal));
		this.stepDisposables.add(addDisposableListener(link, EventType.CLICK, e => {
			e.preventDefault();
			this._logAction('docLinkClick', undefined, linkId);
			void this.openerService.open(URI.parse(href), { openExternal: true });
		}));
	}

	/**
	 * Runs a zero-cost first-action command, then completes the wizard on success.
	 */
	private async _runCreditsFirstAction(commandId: string, actionId: string): Promise<void> {
		this._logAction(actionId);
		try {
			await this.commandService.executeCommand(commandId);
			this._dismiss('complete');
		} catch {
			this.notificationService.notify({
				severity: Severity.Info,
				message: localize(
					'onboarding.credits.firstActionUnavailable',
					"That action is not available yet. Use Get Started to finish setup, then try again from the checklist."
				),
			});
		}
	}

	/**
	 * Renders a non-interactive capability row (icon + title + optional description).
	 */
	private _createFeatureCard(parent: HTMLElement, icon: ThemeIcon, title: string, description?: string): void {
		const card = append(parent, $('div.onboarding-a-feature-card'));
		const iconCol = append(card, $('div.onboarding-a-feature-icon'));
		iconCol.appendChild(renderIcon(icon));
		const textCol = append(card, $('div.onboarding-a-feature-text'));
		const titleEl = append(textCol, $('div.onboarding-a-feature-title'));
		titleEl.textContent = title;
		if (description) {
			const descEl = append(textCol, $('div.onboarding-a-feature-desc'));
			descEl.textContent = description;
		}
	}

	private _createDocLink(parent: HTMLElement, label: string, href: string, linkId?: string): void {
		const link = this._registerStepFocusable(append(parent, $<HTMLAnchorElement>('a.onboarding-a-doc-link')));
		link.textContent = label;
		link.href = href;
		link.target = '_blank';
		link.rel = 'noopener';
		link.prepend(renderIcon(Codicon.linkExternal));
		this.stepDisposables.add(addDisposableListener(link, EventType.CLICK, e => {
			e.preventDefault();
			if (linkId) {
				this._logAction('docLinkClick', undefined, linkId);
			}
			void this.openerService.open(URI.parse(href), { openExternal: true });
		}));
	}

	private _createInlineLink(parent: HTMLElement, label: string, href: string): HTMLAnchorElement {
		const link = this._registerStepFocusable(append(parent, $<HTMLAnchorElement>('a.onboarding-a-inline-link')));
		link.textContent = label;
		link.href = href;
		link.target = '_blank';
		link.rel = 'noopener';
		return link;
	}

	// =====================================================================
	// Accessibility helpers
	// =====================================================================

	/**
	 * Toggles the overlay `reduce-motion` class from `workbench.reduceMotion`
	 * / system preference via {@link IAccessibilityService}.
	 */
	private _syncReducedMotionClass(): void {
		this.overlay?.classList.toggle('reduce-motion', this.accessibilityService.isMotionReduced());
	}

	/**
	 * Removes the credits-step footer sign-in nudge and drops it from the focus trap.
	 */
	private _clearFooterSignInBtn(): void {
		if (!this._footerSignInBtn) {
			return;
		}
		const idx = this.footerFocusableElements.indexOf(this._footerSignInBtn);
		if (idx !== -1) {
			this.footerFocusableElements.splice(idx, 1);
		}
		this._footerSignInDisposable.clear();
		this._footerSignInBtn.remove();
		this._footerSignInBtn = undefined;
	}

	// =====================================================================
	// Focus trap
	// =====================================================================

	private _trapTab(e: KeyboardEvent, shiftKey: boolean): void {
		if (!this.overlay) {
			return;
		}

		const allFocusable = this._getFocusableElements();

		if (allFocusable.length === 0) {
			e.preventDefault();
			return;
		}

		const first = allFocusable[0];
		const last = allFocusable[allFocusable.length - 1];

		if (shiftKey && getActiveWindow().document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!shiftKey && getActiveWindow().document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	private _getFocusableElements(): HTMLElement[] {
		return [...(this.closeButton ? [this.closeButton] : []), ...this.stepFocusableElements, ...this.footerFocusableElements].filter(element => this._isTabbable(element));
	}

	private _focusCurrentStepElement(): void {
		const stepFocusable = this.stepFocusableElements.find(element => this._isTabbable(element));
		(stepFocusable ?? this.nextButton ?? this.closeButton)?.focus();
	}

	private _registerStepFocusable<T extends HTMLElement>(element: T): T {
		this.stepFocusableElements.push(element);
		return element;
	}

	private _isTabbable(element: HTMLElement): boolean {
		if (!element.isConnected || element.getAttribute('aria-hidden') === 'true' || element.tabIndex === -1 || element.hasAttribute('disabled')) {
			return false;
		}

		const computedStyle = getActiveWindow().getComputedStyle(element);
		return computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
	}

	// =====================================================================
	// Telemetry
	// =====================================================================

	private _logStepView(): void {
		const stepId = this.steps[this.currentStepIndex];
		this.telemetryService.publicLog2<OnboardingStepViewEvent, OnboardingStepViewClassification>('welcomeOnboarding.stepView', {
			step: stepId,
			stepNumber: this.currentStepIndex + 1,
		});
	}

	private _logAction(action: string, stepOverride?: OnboardingStepId, argument?: string): void {
		this.telemetryService.publicLog2<OnboardingActionEvent, OnboardingActionClassification>('welcomeOnboarding.actionExecuted', {
			action,
			step: stepOverride ?? this.steps[this.currentStepIndex],
			argument: argument ?? undefined,
		});
	}

	// =====================================================================
	// Cleanup
	// =====================================================================

	private _removeFromDOM(): void {
		if (this.overlay) {
			this.overlay.remove();
			this.overlay = undefined;
		}

		this.card = undefined;
		this.bodyEl = undefined;
		this.progressContainer = undefined;
		this.stepLabelEl = undefined;
		this.titleEl = undefined;
		this.subtitleEl = undefined;
		this.contentEl = undefined;
		this.backButton = undefined;
		this.nextButton = undefined;
		this.closeButton = undefined;
		this.footerLeft = undefined;
		this._clearFooterSignInBtn();
		this.footerFocusableElements.length = 0;
		this.stepFocusableElements.length = 0;
		this._signInInProgress = false;
		this._signedInAccountLabel = undefined;
		this._isShowing = false;
		this.disposables.clear();
		this.stepDisposables.clear();

		// Restore focus to the element that invoked the wizard (e.g. restart command).
		if (this.previouslyFocusedElement) {
			try {
				this.previouslyFocusedElement.focus();
			} catch {
				// Invoker may have been removed from the DOM while the wizard was open.
			}
			this.previouslyFocusedElement = undefined;
		}

		this.currentStepIndex = 0;
	}

	override dispose(): void {
		this._removeFromDOM();
		super.dispose();
	}
}
