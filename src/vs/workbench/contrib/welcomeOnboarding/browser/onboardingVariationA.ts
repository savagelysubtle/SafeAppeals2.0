/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
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
	ONBOARDING_IN_PROGRESS_STORAGE_KEY,
} from '../common/onboardingTypes.js';
import { IOnboardingService, OnboardingDismissReason } from '../common/onboardingService.js';
import {
	PROFILE_ROLES,
	VISIBLE_FIELDS_BY_GROUP,
	getPersonaGroup,
	renderProfileRule,
	type ProfileFieldKey,
	type ProfilePersonaGroupOrUnknown,
	type ProfileRole,
} from '../common/profileRuleTemplate.js';

/** Command that returns a JSON-serializable Private Search setup scan. */
const GET_SETUP_SCAN_COMMAND = 'safeappeals-rag.getSetupScan';
/** Command that installs missing Search pack / OCR models with user consent. */
const INSTALL_MISSING_MODELS_COMMAND = 'safeappeals-rag.installMissingModels';

/** Pricing page opened from the Credits & First Steps step. */
const CREDITS_PRICING_URL = 'https://safeappeals.com/#pricing';
/** Docs page explaining how AI credits work. */
const CREDITS_DOCS_URL = 'https://safeappeals.com/docs/credits';
/** Docs page for AI assistant disclosure and client-consent guidance. */
const AI_ASSISTANT_DOCS_URL = 'https://safeappeals.com/docs/ai-assistant';
/** APPLICATION-scope flag: user acknowledged hallucination risk in Meet Your AI Assistant. */
const AI_LITERACY_STORAGE_KEY = 'safeappeals.aiLiteracy.acknowledged';

/**
 * Credit pack shape returned by `safeappeals.cloud.getCreditPacks`. Mirrors
 * `CreditPack` in `extensions/safeappeals-authentication/src/api.ts`; kept as
 * a local interface because the workbench cannot import extension sources.
 */
interface OnboardingCreditPack {
	readonly id: string;
	readonly name: string;
	readonly credits: number;
	readonly price: number;
	readonly currency: string;
	readonly description: string;
	readonly popular?: boolean;
}

/** Mirrors `PrivateSearchSetupScan` in `extensions/safeappeals-rag/src/setupScan.ts`. */
type SetupScanSearchStatus = 'ready' | 'missing' | 'unavailable';
type SetupScanOcrStatus = 'ready' | 'missing-eligible' | 'ineligible' | 'unavailable';

interface PrivateSearchSetupScan {
	readonly searchPack: {
		readonly status: SetupScanSearchStatus;
		readonly readyModelIds: readonly string[];
		readonly missingModelIds: readonly string[];
		readonly diskMb: number;
	};
	readonly ocr: {
		readonly status: SetupScanOcrStatus;
		readonly diskMb: number;
	};
	readonly includeOcrInInstall: boolean;
}

/** Auth provider contributed by `extensions/safeappeals-authentication`. */
const SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID = 'safeappeals-cloud';
/**
 * Max wait for the extension host to register the cloud auth provider at startup.
 * Cold starts can lag; shorter waits strand the user on a spinner with no escape.
 */
const AUTH_PROVIDER_REGISTRATION_TIMEOUT_MS = 15_000;

/**
 * Canonical jurisdiction slugs mirrored from
 * `extensions/safeappeals-timeline/src/types.ts` (`JURISDICTIONS`).
 * Kept here because workbench cannot import the extension.
 */
const PROFILE_JURISDICTIONS = [
	'bc-wcb',
	'ontario-wsib',
	'alberta-wcb',
	'quebec-cnesst',
	'manitoba-wcb',
	'saskatchewan-wcb',
	'nova-scotia-wcb',
	'california-dwc',
	'texas-dwc',
	'new-york-wcb',
	'florida-dwc',
	'washington-lni',
	// Verified against official sources July 2026. Deliberately omitted superseded
	// names Q-COMP, the AAT (now ART), and Victoria Accident Compensation
	// Conciliation Service (now WIC); Scotland Employment Injury Assistance is
	// absent because it has not commenced.
	'uk-dwp-iidb',
	'uk-ftt-sscs',
	'ni-dfc-iidb',
	'ni-appeal-tribunal',
	'ie-dsp-oib',
	'ie-swao',
	'nsw-icare',
	'nsw-pic',
	'vic-worksafe',
	'vic-wic',
	'qld-workcover',
	'qld-wc-regulator',
	'qld-qirc',
	'wa-workcover',
	'wa-wc-arbitration',
	'sa-returntoworksa',
	'sa-saet',
	'tas-worksafe',
	'tascat-workers',
	'act-worksafe',
	'act-wc-arbitration',
	'nt-worksafe',
	'nt-work-health-ct',
	'au-comcare',
	'au-art',
	'nz-acc',
	'nz-acc-appeals',
	'za-comp-fund',
	'za-coida-tribunal',
] as const;

/** Display labels for PROFILE_JURISDICTIONS (mirrored from extension JURISDICTION_LABELS). */
const PROFILE_JURISDICTION_LABELS: Readonly<Record<string, string>> = {
	'bc-wcb': 'BC WCB',
	'ontario-wsib': 'Ontario WSIB',
	'alberta-wcb': 'Alberta WCB',
	'quebec-cnesst': 'Quebec CNESST',
	'manitoba-wcb': 'Manitoba WCB',
	'saskatchewan-wcb': 'Saskatchewan WCB',
	'nova-scotia-wcb': 'Nova Scotia WCB',
	'california-dwc': 'California DWC',
	'texas-dwc': 'Texas DWC',
	'new-york-wcb': 'New York WCB',
	'florida-dwc': 'Florida DWC',
	'washington-lni': 'Washington L&I',
	'uk-dwp-iidb': 'UK DWP IIDB',
	'uk-ftt-sscs': 'UK FTT SSCS',
	'ni-dfc-iidb': 'NI DfC IIDB',
	'ni-appeal-tribunal': 'NI Appeal Tribunal',
	'ie-dsp-oib': 'IE DSP OIB',
	'ie-swao': 'IE SWAO',
	'nsw-icare': 'NSW icare',
	'nsw-pic': 'NSW PIC',
	'vic-worksafe': 'VIC WorkSafe',
	'vic-wic': 'VIC WIC',
	'qld-workcover': 'QLD WorkCover',
	'qld-wc-regulator': 'QLD WC Regulator',
	'qld-qirc': 'QLD QIRC',
	'wa-workcover': 'WA WorkCover',
	'wa-wc-arbitration': 'WA WC Arbitration',
	'sa-returntoworksa': 'SA ReturnToWorkSA',
	'sa-saet': 'SA SAET',
	'tas-worksafe': 'TAS WorkSafe',
	'tascat-workers': 'TASCAT Workers',
	'act-worksafe': 'ACT WorkSafe',
	'act-wc-arbitration': 'ACT WC Arbitration',
	'nt-worksafe': 'NT WorkSafe',
	'nt-work-health-ct': 'NT Work Health Ct',
	'au-comcare': 'AU Comcare',
	'au-art': 'AU ART',
	'nz-acc': 'NZ ACC',
	'nz-acc-appeals': 'NZ ACC Appeals',
	'za-comp-fund': 'ZA Comp Fund',
	'za-coida-tribunal': 'ZA COIDA Tribunal',
};

/** Legacy display-name → slug aliases (mirrored from extension). */
const PROFILE_JURISDICTION_ALIASES: Readonly<Record<string, string>> = {
	'BC WCB': 'bc-wcb',
	'Ontario WSIB': 'ontario-wsib',
	'Alberta WCB': 'alberta-wcb',
	'Quebec CNESST': 'quebec-cnesst',
	'Manitoba WCB': 'manitoba-wcb',
	'Saskatchewan WCB': 'saskatchewan-wcb',
	'Nova Scotia WCB': 'nova-scotia-wcb',
	'California DWC': 'california-dwc',
	'Texas DWC': 'texas-dwc',
	'New York WCB': 'new-york-wcb',
	'Florida DWC': 'florida-dwc',
	'Washington L&I': 'washington-lni',
	'UK DWP IIDB': 'uk-dwp-iidb',
	'UK FTT SSCS': 'uk-ftt-sscs',
	'NI DfC IIDB': 'ni-dfc-iidb',
	'NI Appeal Tribunal': 'ni-appeal-tribunal',
	'IE DSP OIB': 'ie-dsp-oib',
	'IE SWAO': 'ie-swao',
	'NSW icare': 'nsw-icare',
	'NSW PIC': 'nsw-pic',
	'VIC WorkSafe': 'vic-worksafe',
	'VIC WIC': 'vic-wic',
	'QLD WorkCover': 'qld-workcover',
	'QLD WC Regulator': 'qld-wc-regulator',
	'QLD QIRC': 'qld-qirc',
	'WA WorkCover': 'wa-workcover',
	'WA WC Arbitration': 'wa-wc-arbitration',
	'SA ReturnToWorkSA': 'sa-returntoworksa',
	'SA SAET': 'sa-saet',
	'TAS WorkSafe': 'tas-worksafe',
	'TASCAT Workers': 'tascat-workers',
	'ACT WorkSafe': 'act-worksafe',
	'ACT WC Arbitration': 'act-wc-arbitration',
	'NT WorkSafe': 'nt-worksafe',
	'NT Work Health Ct': 'nt-work-health-ct',
	'AU Comcare': 'au-comcare',
	'AU ART': 'au-art',
	'NZ ACC': 'nz-acc',
	'NZ ACC Appeals': 'nz-acc-appeals',
	'ZA Comp Fund': 'za-comp-fund',
	'ZA COIDA Tribunal': 'za-coida-tribunal',
};

function profileNormalizeJurisdictionId(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return '';
	}
	if ((PROFILE_JURISDICTIONS as readonly string[]).includes(trimmed)) {
		return trimmed;
	}
	const fromAlias = PROFILE_JURISDICTION_ALIASES[trimmed];
	if (fromAlias) {
		return fromAlias;
	}
	for (const [id, label] of Object.entries(PROFILE_JURISDICTION_LABELS)) {
		if (label === trimmed) {
			return id;
		}
	}
	return trimmed;
}

function profileJurisdictionLabel(value: string): string {
	const normalized = profileNormalizeJurisdictionId(value);
	if (!normalized) {
		return '';
	}
	return PROFILE_JURISDICTION_LABELS[normalized] ?? normalized;
}

const PROFILE_COUNTRY_CANADA = 'Canada';
const PROFILE_COUNTRY_US = 'United States';
const PROFILE_COUNTRY_AUSTRALIA = 'Australia';
const PROFILE_COUNTRY_IRELAND = 'Ireland';
const PROFILE_COUNTRY_NEW_ZEALAND = 'New Zealand';
const PROFILE_COUNTRY_SOUTH_AFRICA = 'South Africa';
const PROFILE_COUNTRY_UK = 'United Kingdom';
const PROFILE_COUNTRY_OTHER = 'Other';

/** Known countries for the profile picker (Canada/US first, then alphabetical; Other is separate). */
const PROFILE_KNOWN_COUNTRIES = [
	PROFILE_COUNTRY_CANADA,
	PROFILE_COUNTRY_US,
	PROFILE_COUNTRY_AUSTRALIA,
	PROFILE_COUNTRY_IRELAND,
	PROFILE_COUNTRY_NEW_ZEALAND,
	PROFILE_COUNTRY_SOUTH_AFRICA,
	PROFILE_COUNTRY_UK,
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

const PROFILE_AUSTRALIA_STATES = [
	'Australian Capital Territory',
	'New South Wales',
	'Northern Territory',
	'Queensland',
	'South Australia',
	'Tasmania',
	'Victoria',
	'Western Australia',
] as const;

const PROFILE_UK_NATIONS = [
	'England',
	'Northern Ireland',
	'Scotland',
	'Wales',
] as const;

/**
 * Mirrored from extension `BOARDS_BY_STATE_PROVINCE`.
 * 'AU Comcare' / 'AU ART' repeat in every Australian entry on purpose: Comcare
 * is the Commonwealth scheme covering federal employees in every state, and the
 * flat repetition is preferred over a second indirection layer.
 */
const PROFILE_BOARDS_BY_STATE_PROVINCE: Readonly<Record<string, readonly string[]>> = {
	'British Columbia': ['bc-wcb'],
	'Ontario': ['ontario-wsib'],
	'Alberta': ['alberta-wcb'],
	'Quebec': ['quebec-cnesst'],
	'Manitoba': ['manitoba-wcb'],
	'Saskatchewan': ['saskatchewan-wcb'],
	'Nova Scotia': ['nova-scotia-wcb'],
	'California': ['california-dwc'],
	'Texas': ['texas-dwc'],
	'New York': ['new-york-wcb'],
	'Florida': ['florida-dwc'],
	'Washington': ['washington-lni'],
	'England': ['uk-dwp-iidb', 'uk-ftt-sscs'],
	'Scotland': ['uk-dwp-iidb', 'uk-ftt-sscs'],
	'Wales': ['uk-dwp-iidb', 'uk-ftt-sscs'],
	'Northern Ireland': ['ni-dfc-iidb', 'ni-appeal-tribunal'],
	'New South Wales': ['nsw-icare', 'nsw-pic', 'au-comcare', 'au-art'],
	'Victoria': ['vic-worksafe', 'vic-wic', 'au-comcare', 'au-art'],
	'Queensland': ['qld-workcover', 'qld-wc-regulator', 'qld-qirc', 'au-comcare', 'au-art'],
	'Western Australia': ['wa-workcover', 'wa-wc-arbitration', 'au-comcare', 'au-art'],
	'South Australia': ['sa-returntoworksa', 'sa-saet', 'au-comcare', 'au-art'],
	'Tasmania': ['tas-worksafe', 'tascat-workers', 'au-comcare', 'au-art'],
	'Australian Capital Territory': ['act-worksafe', 'act-wc-arbitration', 'au-comcare', 'au-art'],
	'Northern Territory': ['nt-worksafe', 'nt-work-health-ct', 'au-comcare', 'au-art'],
};

/** Mirrored from extension `BOARDS_BY_COUNTRY`. */
const PROFILE_BOARDS_BY_COUNTRY: Readonly<Record<string, readonly string[]>> = {
	'Canada': [
		'bc-wcb',
		'ontario-wsib',
		'alberta-wcb',
		'quebec-cnesst',
		'manitoba-wcb',
		'saskatchewan-wcb',
		'nova-scotia-wcb',
	],
	'United States': [
		'california-dwc',
		'texas-dwc',
		'new-york-wcb',
		'florida-dwc',
		'washington-lni',
	],
	'United Kingdom': [
		'uk-dwp-iidb',
		'uk-ftt-sscs',
		'ni-dfc-iidb',
		'ni-appeal-tribunal',
	],
	'Ireland': [
		'ie-dsp-oib',
		'ie-swao',
	],
	'Australia': [
		'nsw-icare',
		'nsw-pic',
		'vic-worksafe',
		'vic-wic',
		'qld-workcover',
		'qld-wc-regulator',
		'qld-qirc',
		'wa-workcover',
		'wa-wc-arbitration',
		'sa-returntoworksa',
		'sa-saet',
		'tas-worksafe',
		'tascat-workers',
		'act-worksafe',
		'act-wc-arbitration',
		'nt-worksafe',
		'nt-work-health-ct',
		'au-comcare',
		'au-art',
	],
	'New Zealand': [
		'nz-acc',
		'nz-acc-appeals',
	],
	'South Africa': [
		'za-comp-fund',
		'za-coida-tribunal',
	],
};

type ProfileTextFieldKey = 'name' | 'organization' | 'practiceArea' | 'focusArea' | 'citationStyle' | 'city';

type ProfileFieldDescriptor =
	| { readonly type: 'text'; readonly key: ProfileTextFieldKey; readonly label: string; readonly placeholder: string }
	| { readonly type: 'pills'; readonly key: 'role'; readonly label: string }
	| { readonly type: 'select'; readonly key: 'country' | 'stateProvince' | 'jurisdiction'; readonly label: string };

/**
 * Resolves boards for a country and optional subdivision. Mirrors extension
 * `boardsFor`: subdivision → country → all boards when country empty → empty
 * for Other / unrecognised.
 */
function profileBoardsFor(country: string, stateProvince: string): readonly string[] {
	if (stateProvince) {
		const bySubdivision = PROFILE_BOARDS_BY_STATE_PROVINCE[stateProvince];
		if (bySubdivision && bySubdivision.length > 0) {
			return bySubdivision;
		}
	}
	if (country) {
		const byCountry = PROFILE_BOARDS_BY_COUNTRY[country];
		if (byCountry && byCountry.length > 0) {
			return byCountry;
		}
		return [];
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
	if (country === PROFILE_COUNTRY_AUSTRALIA) {
		return PROFILE_AUSTRALIA_STATES;
	}
	if (country === PROFILE_COUNTRY_UK) {
		return PROFILE_UK_NATIONS;
	}
	return undefined;
}

function isKnownProfileCountry(country: string): boolean {
	return (PROFILE_KNOWN_COUNTRIES as readonly string[]).includes(country);
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
 * 1. Sign In — Safe Appeals Cloud (Google or Outlook) identity, or continue without an account
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
	/** Footer hint explaining why Continue is disabled on the Agent Intro step. */
	private _agentIntroAckHint: HTMLElement | undefined;
	/** Lives only as long as the Agent Intro step is rendered; cleared in `_renderStep`. */
	private _aiLiteracyCheckbox: HTMLInputElement | undefined;

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
		focusArea: '',
		citationStyle: '',
		country: '',
		stateProvince: '',
		city: '',
		jurisdiction: '',
		operatingSystem: 'Windows',
	};
	/** When true, Country select is "Other" and a free-text country input is shown. */
	private profileCountryOtherMode = false;
	/** When true, Board select is "Other" and a free-text jurisdiction input is shown. */
	private profileBoardOtherMode = false;
	/** Host for role-conditional profile fields; cleared and rebuilt on role change. */
	private profileFormFieldsHost: HTMLElement | undefined;
	/** Disposables for the role-conditional field region (not stepDisposables — avoids leaks on pill click). */
	private profileFormFieldsStore: DisposableStore | undefined;
	private profileStateControlHost: HTMLElement | undefined;
	private profileBoardControlHost: HTMLElement | undefined;
	private profileCountryOtherHost: HTMLElement | undefined;
	private profileBoardOtherHost: HTMLElement | undefined;
	private profileStateControlStore: DisposableStore | undefined;
	private profileBoardControlStore: DisposableStore | undefined;
	private profileCountryOtherStore: DisposableStore | undefined;
	private profileBoardOtherStore: DisposableStore | undefined;

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
		// Persist only after mount so a throw during build does not stick a resume flag.
		// MACHINE: local to this browser/profile; must not Settings Sync. Cleared on any dismiss;
		// survives only a hard reload that kills the overlay without running dismiss cleanup.
		this.storageService.store(ONBOARDING_IN_PROGRESS_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
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
			if (this.nextButton?.getAttribute('aria-disabled') === 'true') {
				this._focusAgentIntroAck();
				return;
			}
			if (this._isLastStep()) {
				this._logAction('complete');
				this._dismiss('complete');
			} else if (this.steps[this.currentStepIndex] === OnboardingStepId.SignIn) {
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

		// The web workbench cancels every wheel event on the container this overlay
		// mounts into, to suppress the macOS back/forward swipe gesture. That also
		// cancels native scrolling of the step content, so keep wheel events from
		// reaching it; `overscroll-behavior` on the scroller prevents the gesture
		// the container-level handler exists to block.
		this.disposables.add(addDisposableListener(this.overlay, EventType.WHEEL, (e: WheelEvent) => {
			e.stopPropagation();
		}, { passive: true }));

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

		// After OAuth reload, SecretStorage may already hold a session while createSession never resolved.
		void this._hydrateSignInFromExistingSession();

		// Exchange may finish after the first hydrate (pending PKCE restore + orphaned callback).
		// Listen until signed in or the overlay is dismissed (_removeFromDOM clears disposables).
		this.disposables.add(this.authenticationService.onDidChangeSessions(e => {
			if (e.providerId !== SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID) {
				return;
			}
			if (!this._isShowing || this._userSignedIn) {
				return;
			}
			const added = e.event.added?.length ?? 0;
			const changed = e.event.changed?.length ?? 0;
			if (!added && !changed) {
				return;
			}
			void this._hydrateSignInFromExistingSession();
		}));
	}

	private _dismiss(reason: OnboardingDismissReason): void {
		if (!this.overlay) {
			return;
		}

		// SafeAppeals: don't lose profile input when dismissing from the profile step
		if (this.steps[this.currentStepIndex] === OnboardingStepId.Profile) {
			this._saveProfile();
		}

		// Any explicit dismiss (complete/skip/Esc/overlay) clears the resume flag.
		// Only a hard reload mid-flow leaves it set so web can reopen after OAuth.
		this.storageService.remove(ONBOARDING_IN_PROGRESS_STORAGE_KEY, StorageScope.APPLICATION);

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

	/**
	 * If a Safe Appeals Cloud session already exists (e.g. restored after web OAuth reload),
	 * mark signed-in and advance past the Sign In step so onboarding matches desktop UX.
	 */
	private async _hydrateSignInFromExistingSession(): Promise<void> {
		if (this._userSignedIn) {
			return;
		}

		const generation = this._showGeneration;

		try {
			const providerReady = await waitForAuthenticationProvider(
				this.authenticationService,
				SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID,
				AUTH_PROVIDER_REGISTRATION_TIMEOUT_MS,
				this.disposables,
			);

			if (!this._isShowing || this._showGeneration !== generation) {
				return;
			}

			if (!providerReady) {
				return;
			}

			const sessions = await this.authenticationService.getSessions(
				SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID,
				undefined,
				undefined,
				true,
			);

			if (!this._isShowing || this._showGeneration !== generation || this._userSignedIn) {
				return;
			}

			if (sessions.length === 0) {
				return;
			}

			this._userSignedIn = true;
			this._signedInAccountLabel = sessions[0].account.label;
			this._signInInProgress = false;
			this._logAction('signInHydrated', undefined, SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID);

			if (this.steps[this.currentStepIndex] === OnboardingStepId.SignIn) {
				this._nextStep();
			} else {
				// Not on Sign In (e.g. Credits) — still mark signed-in and refresh dependent UI.
				this._renderStep();
				this._updateButtonStates();
			}
		} catch (error) {
			onUnexpectedError(error);
		}
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
		this._aiLiteracyCheckbox = undefined;

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
			case OnboardingStepId.PrivateSearch:
				this._renderPrivateSearchStep(this.contentEl);
				break;
			case OnboardingStepId.GetStarted:
				this._renderGetStartedStep(this.contentEl);
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
		const onSignInStep = this.steps[this.currentStepIndex] === OnboardingStepId.SignIn;
		const onAgentIntro = this.steps[this.currentStepIndex] === OnboardingStepId.AgentIntro;
		const showAgentIntroAckHint = onAgentIntro && !this._aiLiteracyAcknowledged;

		if (this.backButton) {
			this.backButton.style.display = this.currentStepIndex === 0 ? 'none' : '';
		}
		if (this.nextButton) {
			if (onSignInStep) {
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

			// SafeAppeals: Meet Your AI Assistant — Continue is blocked until the
			// hallucination acknowledgment. Marked `aria-disabled` rather than
			// `disabled` so it keeps its place in the tab order; a natively disabled
			// button is skipped, and the reason in `aria-describedby` would never be
			// announced to the keyboard user it is meant for.
			if (showAgentIntroAckHint) {
				this.nextButton.setAttribute('aria-disabled', 'true');
				this.nextButton.setAttribute('aria-describedby', 'onboarding-a-agent-intro-ack-hint');
			} else {
				this.nextButton.removeAttribute('aria-disabled');
				this.nextButton.removeAttribute('aria-describedby');
			}
		}
		if (this.footerLeft) {
			if (this._isLastStep()) {
				this._clearAgentIntroAckHint();
			} else if (showAgentIntroAckHint) {
				this._showAgentIntroAckHint();
			} else {
				this._clearAgentIntroAckHint();
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
			"A free SafeAppeals Cloud account unlocks email, calendar, and documents. You only pay for AI credits."
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
		const outlookLabel = localize('onboarding.signIn.outlook', "Continue with Outlook");
		const googleBtn = this._registerStepFocusable(this._createSignInButton(actions, googleLabel, {
			emphasized: true,
			ariaLabel: googleLabel,
			providerMark: 'google',
		}));
		this.stepDisposables.add(addDisposableListener(googleBtn, EventType.CLICK, () => {
			this._logAction('signIn', undefined, 'google');
			void this._handleSignIn('google');
		}));
		const outlookBtn = this._registerStepFocusable(this._createSignInButton(actions, outlookLabel, {
			emphasized: false,
			ariaLabel: outlookLabel,
			providerMark: 'outlook',
		}));
		this.stepDisposables.add(addDisposableListener(outlookBtn, EventType.CLICK, () => {
			this._logAction('signIn', undefined, 'microsoft');
			void this._handleSignIn('microsoft');
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
		message.textContent = localize('onboarding.signIn.progress', "Finish signing in to SafeAppeals Cloud in your browser — we'll bring you back automatically.");
	}

	/**
	 * Creates a SafeAppeals Cloud sign-in button (Google or Outlook).
	 */
	private _createSignInButton(parent: HTMLElement, label: string, options?: {
		emphasized?: boolean;
		ariaLabel?: string;
		providerMark?: 'google' | 'outlook' | 'safeappeals-cloud';
	}): HTMLButtonElement {
		const btn = append(parent, $<HTMLButtonElement>('button.onboarding-a-signin-btn'));
		btn.type = 'button';
		btn.title = options?.ariaLabel ?? label;
		btn.setAttribute('aria-label', options?.ariaLabel ?? label);
		if (options?.emphasized) {
			btn.classList.add('primary');
		}

		const markClass = options?.providerMark ?? 'safeappeals-cloud';
		const mark = append(btn, $(`span.onboarding-a-provider-mark.${markClass}`));
		mark.setAttribute('aria-hidden', 'true');

		const labelEl = append(btn, $('span.onboarding-a-signin-btn-label'));
		labelEl.textContent = label;

		return btn;
	}

	/**
	 * Signs in via Safe Appeals Cloud (`safeappeals-cloud`).
	 * @param identityProvider When set, skips the provider quick pick (Google vs Outlook).
	 */
	private async _handleSignIn(identityProvider?: 'google' | 'microsoft'): Promise<void> {
		if (this._signInInProgress) {
			return;
		}

		const generation = this._showGeneration;
		const stepIndex = this.currentStepIndex;
		const stepId = this.steps[stepIndex];

		this._signInInProgress = true;
		this._refreshSignInStepUi();

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

			const existingSessions = await this.authenticationService.getSessions(SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID);
			for (const session of existingSessions) {
				await this.authenticationService.removeSession(SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID, session.id);
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

			const identityScopes = identityProvider
				? [`provider:${identityProvider}`]
				: [];
			const session = await this.authenticationService.createSession(
				SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID,
				identityScopes,
				{ activateImmediate: true },
			);

			if (!isSameShowing()) {
				return;
			}

			this._userSignedIn = true;
			this._signedInAccountLabel = session.account.label;
			this._logAction('signInSuccess', undefined, SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID);

			if (!isContinuationValid()) {
				return;
			}

			this._nextStep();
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
			if (isContinuationValid() && !this._userSignedIn) {
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

	private static readonly PROFILE_KEYS: readonly ProfileFieldKey[] = [
		'name', 'organization', 'role', 'practiceArea', 'focusArea', 'citationStyle',
		'country', 'stateProvince', 'city', 'jurisdiction', 'operatingSystem',
	];

	private _renderProfileStep(container: HTMLElement): void {
		if (!this.profilePrefilled) {
			this.profilePrefilled = true;
			for (const key of OnboardingVariationA.PROFILE_KEYS) {
				const value = this.configurationService.getValue<string>(`safeappeals.profile.${key}`);
				if (typeof value === 'string' && value) {
					this.profileValues[key] = key === 'jurisdiction'
						? profileNormalizeJurisdictionId(value)
						: value;
				}
			}
			this.profileCountryOtherMode = !!this.profileValues.country && !isKnownProfileCountry(this.profileValues.country);
			this.profileBoardOtherMode = !!this.profileValues.jurisdiction
				&& !(PROFILE_JURISDICTIONS as readonly string[]).includes(this.profileValues.jurisdiction);
		}

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
		infoHow.textContent = localize('onboarding.profile.info.how', "Whatever you enter here is automatically shared with the assistant at the start of every conversation. It will already know who you are — you never have to introduce yourself or re-explain your work.");

		const infoList = append(info, $('ul.onboarding-a-profile-info-list'));
		const infoPoints = [
			localize('onboarding.profile.info.point.drafts', "Drafted documents and letters use your name, organization, and jurisdiction automatically"),
			localize('onboarding.profile.info.point.relevant', "Answers are framed for your field instead of being generic"),
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
		this.profileFormFieldsHost = append(form, $('.onboarding-a-profile-fields'));
		this.profileFormFieldsStore = this.stepDisposables.add(new DisposableStore());
		this._renderProfileFormFields();

		const hint = append(form, $('div.onboarding-a-theme-hint'));
		hint.textContent = localize('onboarding.profile.hint', "All fields are optional and stay on this computer. The AI agent uses them when organizing cases and drafting documents. Change them anytime with the \"Set Up Profile\" command.");
	}

	/**
	 * Rebuilds profile fields for the current persona group (including role pills).
	 * Clears {@link profileFormFieldsStore} so repeated pill clicks do not leak.
	 * Hidden-field values stay in {@link profileValues} (not blanked on role change).
	 * Role is in every {@link VISIBLE_FIELDS_BY_GROUP} set, so pills stay visible.
	 */
	private _renderProfileFormFields(): void {
		const host = this.profileFormFieldsHost;
		const store = this.profileFormFieldsStore;
		if (!host || !store) {
			return;
		}

		store.clear();
		clearNode(host);

		this.profileStateControlHost = undefined;
		this.profileBoardControlHost = undefined;
		this.profileCountryOtherHost = undefined;
		this.profileBoardOtherHost = undefined;
		this.profileStateControlStore = store.add(new DisposableStore());
		this.profileBoardControlStore = store.add(new DisposableStore());
		this.profileCountryOtherStore = store.add(new DisposableStore());
		this.profileBoardOtherStore = store.add(new DisposableStore());

		const group = getPersonaGroup(this.profileValues.role);
		const visible = VISIBLE_FIELDS_BY_GROUP[group];

		for (const key of visible) {
			if (key === 'name') {
				this._renderProfileTextField(host, store, {
					type: 'text',
					key: 'name',
					label: localize('onboarding.profile.name', "Your Name"),
					placeholder: localize('onboarding.profile.name.placeholder', "As it should appear in drafted documents"),
				});
				continue;
			}
			if (key === 'organization') {
				this._renderProfileTextField(host, store, {
					type: 'text',
					key: 'organization',
					label: this._organizationLabel(group),
					placeholder: localize('onboarding.profile.organization.placeholder', "Leave empty if not applicable"),
				});
				continue;
			}
			if (key === 'role') {
				this._renderProfileRoleField(host, store, localize('onboarding.profile.role', "Your Role"));
				continue;
			}
			if (key === 'practiceArea') {
				this._renderProfileTextField(host, store, {
					type: 'text',
					key: 'practiceArea',
					label: localize('onboarding.profile.practiceArea', "Area of Law"),
					placeholder: localize('onboarding.profile.practiceArea.placeholder', "e.g. Workers' Compensation"),
				});
				continue;
			}
			if (key === 'focusArea') {
				this._renderProfileTextField(host, store, {
					type: 'text',
					key: 'focusArea',
					label: this._focusAreaLabel(this.profileValues.role),
					placeholder: localize('onboarding.profile.focusArea.placeholder', "Optional"),
				});
				continue;
			}
			if (key === 'citationStyle') {
				this._renderProfileTextField(host, store, {
					type: 'text',
					key: 'citationStyle',
					label: localize('onboarding.profile.citationStyle', "Citation Style"),
					placeholder: localize('onboarding.profile.citationStyle.placeholder', "e.g. APA, MLA, McGill Guide"),
				});
				continue;
			}
			if (key === 'country') {
				this._renderProfileCountryField(host, store, localize('onboarding.profile.country', "Country"));
				continue;
			}
			if (key === 'stateProvince') {
				this._renderProfileStateField(host, store, localize('onboarding.profile.stateProvince', "State / Province"));
				continue;
			}
			if (key === 'city') {
				this._renderProfileTextField(host, store, {
					type: 'text',
					key: 'city',
					label: localize('onboarding.profile.city', "City"),
					placeholder: localize('onboarding.profile.city.placeholder', "e.g. Vancouver, Los Angeles"),
				});
				continue;
			}
			if (key === 'jurisdiction') {
				this._renderProfileBoardField(host, store, localize('onboarding.profile.jurisdiction', "Compensation Board / Tribunal"));
			}
			if (key === 'operatingSystem') {
				this._renderProfileOperatingSystemField(host, store, localize('onboarding.profile.operatingSystem', "Operating System"));
			}
		}
	}

	/**
	 * Localized organization field label for the active persona group.
	 */
	private _organizationLabel(group: ProfilePersonaGroupOrUnknown): string {
		switch (group) {
			case 'education':
				return localize('onboarding.profile.organization.school', "School / Institution");
			case 'research':
				return localize('onboarding.profile.organization.institution', "Institution / Affiliation");
			case 'office':
				return localize('onboarding.profile.organization.company', "Company / Organization");
			case 'developer':
				return localize('onboarding.profile.organization.team', "Company / Team");
			case 'legal':
			case 'self':
			case 'unknown':
			default:
				return localize('onboarding.profile.organization', "Firm / Organization");
		}
	}

	/**
	 * Localized focus-area label for the selected role (education / research / office / developer).
	 */
	private _focusAreaLabel(role: string): string {
		switch (role as ProfileRole) {
			case 'Student':
				return localize('onboarding.profile.focusArea.student', "Field of Study");
			case 'Teacher':
				return localize('onboarding.profile.focusArea.teacher', "Subject / Level");
			case 'Researcher':
				return localize('onboarding.profile.focusArea.researcher', "Research Field");
			case 'Office Worker':
				return localize('onboarding.profile.focusArea.office', "Works On");
			case 'Software Developer':
				return localize('onboarding.profile.focusArea.developer', "Languages / Stack");
			default:
				return localize('onboarding.profile.focusArea', "Focus Area");
		}
	}

	/**
	 * Renders a labeled text InputBox for a profile field into the given store.
	 */
	private _renderProfileTextField(form: HTMLElement, store: DisposableStore, field: Extract<ProfileFieldDescriptor, { type: 'text' }>): void {
		const fieldEl = append(form, $('.onboarding-a-profile-field'));
		const inputId = `onboarding-profile-${field.key}`;
		const label = append(fieldEl, $<HTMLLabelElement>('label.onboarding-a-section-label'));
		label.htmlFor = inputId;
		label.textContent = field.label;

		const inputBox = store.add(new InputBox(fieldEl, undefined, {
			placeholder: field.placeholder,
			ariaLabel: field.label,
			inputBoxStyles: defaultInputBoxStyles,
		}));
		inputBox.inputElement.id = inputId;
		inputBox.value = this.profileValues[field.key];
		this._registerStepFocusable(inputBox.inputElement);
		store.add(inputBox.onDidChange(value => {
			this.profileValues[field.key] = value;
		}));
	}

	/**
	 * Localized display label for a canonical profile role value.
	 */
	private _profileRoleLabel(role: string): string {
		switch (role) {
			case 'Lawyer':
				return localize('onboarding.profile.role.lawyer', "Lawyer");
			case 'Paralegal':
				return localize('onboarding.profile.role.paralegal', "Paralegal");
			case 'Advocate':
				return localize('onboarding.profile.role.advocate', "Advocate");
			case 'Appeals Representative':
				return localize('onboarding.profile.role.appealsRep', "Appeals Representative");
			case 'Union Representative':
				return localize('onboarding.profile.role.unionRep', "Union Representative");
			case 'Injured Worker':
				return localize('onboarding.profile.role.injuredWorker', "Injured Worker");
			case 'Representing Myself':
				return localize('onboarding.profile.role.self', "Representing Myself");
			case 'Student':
				return localize('onboarding.profile.role.student', "Student");
			case 'Teacher':
				return localize('onboarding.profile.role.teacher', "Teacher");
			case 'Researcher':
				return localize('onboarding.profile.role.researcher', "Researcher");
			case 'Office Worker':
				return localize('onboarding.profile.role.officeWorker', "Office Worker");
			case 'Software Developer':
				return localize('onboarding.profile.role.softwareDeveloper', "Software Developer");
			default:
				return role;
		}
	}

	/**
	 * Role pills with radio-group semantics. Persists the English canonical
	 * value to `safeappeals.profile.role` (same pattern as country/board).
	 * Clicking the already-selected pill clears the field (optional like the rest).
	 * Present for every persona group; pill click rebuilds the form field region.
	 */
	private _renderProfileRoleField(form: HTMLElement, store: DisposableStore, labelText: string): void {
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

			store.add(addDisposableListener(pill, EventType.CLICK, () => {
				// Toggle-off: re-clicking the selected pill clears the optional field.
				// Arrow-key nav only .click()s a *different* index, so it never hits this branch.
				// Update role first, then rebuild — rebuild disposes this listener via store.clear().
				if (this.profileValues.role === role) {
					this.profileValues.role = '';
				} else {
					this.profileValues.role = role;
				}
				this._renderProfileFormFields();
				const roleGroup = this.profileFormFieldsHost?.querySelector('.onboarding-a-role-pills');
				const focusPill = roleGroup?.querySelector<HTMLElement>('.onboarding-a-role-pill.selected')
					?? roleGroup?.querySelector<HTMLElement>('.onboarding-a-role-pill');
				focusPill?.focus();
			}));
		}

		syncRolePillState(selectedIndex);
		this._setupRadioGroupNavigation(pills, Math.max(0, selectedIndex), store);
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
	private _setupRadioGroupNavigation(items: HTMLElement[], selectedIndex: number, store: DisposableStore = this.stepDisposables): void {
		// Initialise roving tabindex: only the selected item is tab-reachable
		for (let i = 0; i < items.length; i++) {
			items[i].setAttribute('tabindex', i === selectedIndex ? '0' : '-1');
		}

		for (let i = 0; i < items.length; i++) {
			store.add(addDisposableListener(items[i], EventType.KEY_DOWN, (e: KeyboardEvent) => {
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
	 * Country select (known markets + Other) with optional free-text when Other
	 * is chosen.
	 */
	private _renderProfileCountryField(form: HTMLElement, store: DisposableStore, labelText: string): void {
		const fieldEl = append(form, $('.onboarding-a-profile-field'));
		const inputId = 'onboarding-profile-country';
		const label = append(fieldEl, $<HTMLLabelElement>('label.onboarding-a-section-label'));
		label.htmlFor = inputId;
		label.textContent = labelText;

		const notSpecified = localize('onboarding.profile.notSpecified', "Not specified");
		const options: ISelectOptionItem[] = [
			{ text: notSpecified },
			...PROFILE_KNOWN_COUNTRIES.map(c => ({ text: c })),
			{ text: PROFILE_COUNTRY_OTHER },
		];
		let selected = 0;
		if (this.profileCountryOtherMode) {
			selected = options.length - 1;
		} else if (this.profileValues.country) {
			const idx = options.findIndex(o => o.text === this.profileValues.country);
			selected = idx < 0 ? 0 : idx;
		}

		const selectBox = store.add(new SelectBox(options, selected, this.contextViewService, defaultSelectBoxStyles, {
			ariaLabel: labelText,
		}));
		const selectWrapper = append(fieldEl, $('.onboarding-a-profile-select'));
		selectBox.render(selectWrapper);
		const countrySelectEl = asSelectElement(selectWrapper.lastElementChild);
		if (countrySelectEl) {
			countrySelectEl.id = inputId;
			this._registerStepFocusable(countrySelectEl);
		}
		store.add(selectBox.onDidSelect(e => {
			if (e.index === 0) {
				this.profileCountryOtherMode = false;
				this.profileValues.country = '';
			} else if (e.index === options.length - 1) {
				this.profileCountryOtherMode = true;
				if (isKnownProfileCountry(this.profileValues.country)) {
					this.profileValues.country = '';
				}
			} else {
				this.profileCountryOtherMode = false;
				this.profileValues.country = e.selected;
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
	private _renderProfileStateField(form: HTMLElement, _store: DisposableStore, labelText: string): void {
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
	 * Compensation board / tribunal select, filtered by country / subdivision,
	 * with an Other free-text escape hatch.
	 */
	private _renderProfileBoardField(form: HTMLElement, _store: DisposableStore, labelText: string): void {
		const fieldEl = append(form, $('.onboarding-a-profile-field'));
		const inputId = 'onboarding-profile-jurisdiction';
		const label = append(fieldEl, $<HTMLLabelElement>('label.onboarding-a-section-label'));
		label.htmlFor = inputId;
		label.textContent = labelText;

		this.profileBoardControlHost = append(fieldEl, $('.onboarding-a-profile-board-control'));
		this.profileBoardOtherHost = append(fieldEl, $('.onboarding-a-profile-board-other'));
		this._rebuildProfileBoardControl();
	}

	/**
	 * Rebuilds board options when Country or State / Province changes. Uses
	 * country/subdivision resolution; Other / unrecognised countries yield an
	 * empty board list (Not specified + typed escape hatch only).
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
		// Other-country mode stores free text (possibly empty); treat empty Other
		// as unrecognised so the board list stays empty rather than all boards.
		const countryForBoards = this.profileCountryOtherMode
			? (this.profileValues.country || PROFILE_COUNTRY_OTHER)
			: this.profileValues.country;
		const boards = profileBoardsFor(countryForBoards, this.profileValues.stateProvince);
		const otherLabel = localize('onboarding.profile.jurisdictionOther.option', "Other (type your own)…");

		// Known board that doesn't match the filter → reset. Custom (non-list)
		// values reopen in the typed Other state below.
		if (
			this.profileValues.jurisdiction &&
			!(boards as readonly string[]).includes(this.profileValues.jurisdiction) &&
			(PROFILE_JURISDICTIONS as readonly string[]).includes(this.profileValues.jurisdiction)
		) {
			this.profileValues.jurisdiction = '';
		}
		if (
			this.profileValues.jurisdiction &&
			!(boards as readonly string[]).includes(this.profileValues.jurisdiction) &&
			!(PROFILE_JURISDICTIONS as readonly string[]).includes(this.profileValues.jurisdiction)
		) {
			this.profileBoardOtherMode = true;
		}

		const notSpecified = localize('onboarding.profile.notSpecified', "Not specified");
		const options: ISelectOptionItem[] = [
			{ text: notSpecified },
			...boards.map(b => ({ text: profileJurisdictionLabel(b) })),
			{ text: otherLabel },
		];
		let selected = 0;
		if (this.profileBoardOtherMode) {
			selected = options.length - 1;
		} else if (this.profileValues.jurisdiction) {
			const label = profileJurisdictionLabel(this.profileValues.jurisdiction);
			const idx = options.findIndex(o => o.text === label);
			selected = idx < 0 ? 0 : idx;
		}

		const selectBox = store.add(new SelectBox(options, selected, this.contextViewService, defaultSelectBoxStyles, {
			ariaLabel: labelText,
		}));
		selectBox.render(host);
		const boardSelectEl = asSelectElement(host.firstElementChild);
		if (boardSelectEl) {
			boardSelectEl.id = inputId;
			this._registerStepFocusable(boardSelectEl);
		}
		// Selecting Other only toggles the free-text input; the option list itself
		// is unchanged, so this must not rebuild (and therefore dispose) the
		// SelectBox that is currently dispatching this event.
		store.add(selectBox.onDidSelect(e => {
			if (e.index === 0) {
				this.profileBoardOtherMode = false;
				this.profileValues.jurisdiction = '';
			} else if (e.index === options.length - 1) {
				this.profileBoardOtherMode = true;
				if (
					(boards as readonly string[]).includes(this.profileValues.jurisdiction)
					|| (PROFILE_JURISDICTIONS as readonly string[]).includes(this.profileValues.jurisdiction)
				) {
					this.profileValues.jurisdiction = '';
				}
			} else {
				this.profileBoardOtherMode = false;
				const boardIndex = e.index - 1;
				this.profileValues.jurisdiction = boards[boardIndex] ?? profileNormalizeJurisdictionId(e.selected);
			}
			this._syncProfileBoardOtherInput();
		}));

		this._syncProfileBoardOtherInput();
	}

	/**
	 * Shows or hides the free-text board input used when Board / Tribunal is Other.
	 */
	private _syncProfileBoardOtherInput(): void {
		const host = this.profileBoardOtherHost;
		const store = this.profileBoardOtherStore;
		if (!host || !store) {
			return;
		}
		store.clear();
		clearNode(host);
		host.style.display = this.profileBoardOtherMode ? '' : 'none';
		if (!this.profileBoardOtherMode) {
			return;
		}

		const otherLabel = localize('onboarding.profile.jurisdictionOther', "Board / tribunal name");
		const inputId = 'onboarding-profile-jurisdiction-other';
		const label = append(host, $<HTMLLabelElement>('label.onboarding-a-section-label'));
		label.htmlFor = inputId;
		label.textContent = otherLabel;

		const inputBox = store.add(new InputBox(host, undefined, {
			placeholder: localize('onboarding.profile.jurisdictionOther.placeholder', "e.g. WSIB, WorkSafeBC"),
			ariaLabel: otherLabel,
			inputBoxStyles: defaultInputBoxStyles,
		}));
		inputBox.inputElement.id = inputId;
		inputBox.value = profileJurisdictionLabel(this.profileValues.jurisdiction) || this.profileValues.jurisdiction;
		this._registerStepFocusable(inputBox.inputElement);
		store.add(inputBox.onDidChange(value => {
			this.profileValues.jurisdiction = profileNormalizeJurisdictionId(value) || value.trim();
		}));
	}


	/**
	 * Operating System select (Windows, Linux, Mac) with Windows as default.
	 * Helps the AI generate platform-appropriate file paths and terminal commands.
	 */
	private _renderProfileOperatingSystemField(form: HTMLElement, store: DisposableStore, labelText: string): void {
		const fieldEl = append(form, $('.onboarding-a-profile-field'));
		const inputId = 'onboarding-profile-operatingSystem';
		const label = append(fieldEl, $<HTMLLabelElement>('label.onboarding-a-section-label'));
		label.htmlFor = inputId;
		label.textContent = labelText;

		const notSpecified = localize('onboarding.profile.notSpecified', "Not specified");
		const options: ISelectOptionItem[] = [
			{ text: notSpecified },
			{ text: 'Windows' },
			{ text: 'Linux' },
			{ text: 'Mac' },
		];
		let selected = 0;
		if (this.profileValues.operatingSystem) {
			const idx = options.findIndex(o => o.text === this.profileValues.operatingSystem);
			selected = idx < 0 ? 0 : idx;
		} else {
			// Default to Windows
			selected = 1;
		}

		const selectBox = store.add(new SelectBox(options, selected, this.contextViewService, defaultSelectBoxStyles, {
			ariaLabel: labelText,
		}));
		const selectWrapper = append(fieldEl, $('.onboarding-a-profile-select'));
		selectBox.render(selectWrapper);
		const osSelectEl = asSelectElement(selectWrapper.lastElementChild);
		if (osSelectEl) {
			osSelectEl.id = inputId;
			this._registerStepFocusable(osSelectEl);
		}
		store.add(selectBox.onDidSelect(e => {
			if (e.index === 0) {
				this.profileValues.operatingSystem = '';
			} else {

				this.profileValues.operatingSystem = e.selected;
			}
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
		this.profileValues.jurisdiction = profileNormalizeJurisdictionId(this.profileValues.jurisdiction)
			|| this.profileValues.jurisdiction.trim();
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
					"Your profile was saved, but {0} could not update the assistant's copy of it. Run \"Safe Appeals Timeline: Set Up Profile\" from the Command Palette to try again.",
					this.productService.nameLong
				),
			});
		});
		this._logAction('saveProfile');
	}

	/**
	 * Writes the user-level profile instructions file via the shared
	 * {@link renderProfileRule} template (byte-identical to the extension path).
	 */
	private async _writeProfileRule(): Promise<void> {
		const home = await this.pathService.userHome();
		const target = joinPath(home, '.copilot', 'instructions', 'safeappeals-profile.instructions.md');
		// Settings store slugs; the human-readable rule uses display labels.
		const content = renderProfileRule({
			...this.profileValues,
			jurisdiction: profileJurisdictionLabel(this.profileValues.jurisdiction)
				|| this.profileValues.jurisdiction,
		});

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
	 * before any AI capability framing.
	 *
	 * Every clause below is traceable to the gateway in `void-cloud/`: it forwards
	 * the message array to LiteLLM and persists only `log_usage_with_cost`
	 * (model, token counts, cost, latency), and the Supabase schema has no column
	 * that could hold prompt or completion text. Do NOT claim the upstream
	 * provider discards the request — OpenAI, Anthropic and Google all retain API
	 * traffic for abuse monitoring by default, and zero-retention is a per-provider
	 * contract SafeAppeals has not confirmed.
	 */
	private _renderAgentIntroDisclosure(parent: HTMLElement): void {
		const panel = append(parent, $('.onboarding-a-disclosure'));
		const heading = append(panel, $('h3.onboarding-a-disclosure-heading'));
		heading.textContent = localize('onboarding.agentIntro.disclosure.heading', "Where your information goes");

		const body = append(panel, $('p.onboarding-a-disclosure-body'));
		const privacyLabel = localize('onboarding.agentIntro.disclosure.privacy', "Privacy Policy");
		const bodyText = localize(
			'onboarding.agentIntro.disclosure.body',
			"Your case files stay on this computer. When you ask the AI assistant a question, the text of your question — and any documents you attach — pass through SafeAppeals to the AI provider that generates the answer. SafeAppeals does not keep any of it: we record which model you used and how many tokens it cost, and nothing of what you wrote or what the assistant answered. The provider receives your question in order to answer it and does not use it to train its models; how long it holds the request is governed by that provider's own policy, which is worth reading before you send confidential client information. You remain responsible for reviewing everything the assistant produces: its output is a drafting aid, not legal advice and not a court-ready filing. Read our {0} for details.",
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
		this._aiLiteracyCheckbox = checkbox;

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
		this._setupRadioGroupNavigation(allCards, Math.max(0, selectedIndex), this.stepDisposables);
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
	 * balance when signed in, and pricing/docs links.
	 */
	private _renderCreditsHandoffStep(container: HTMLElement): void {
		const wrapper = append(container, $('.onboarding-a-credits'));

		const copy = append(wrapper, $('p.onboarding-a-credits-copy'));
		copy.textContent = localize(
			'onboarding.credits.copy',
			"AI drafting and research run on credits — 1 credit equals 1 token (input and output both count). Every account starts at zero, so nothing runs and nothing is charged until you buy a pack below. There is no subscription."
		);

		const balanceRegion = append(wrapper, $('.onboarding-a-credits-balance'));
		balanceRegion.setAttribute('aria-live', 'polite');
		balanceRegion.setAttribute('aria-atomic', 'true');
		this._renderCreditsBalanceRegion(balanceRegion);

		const packsHeading = append(wrapper, $('h3.onboarding-a-credits-packs-heading'));
		packsHeading.textContent = localize('onboarding.credits.packs.heading', "Credit Packs");
		const packsRegion = append(wrapper, $('.onboarding-a-credits-packs'));
		packsRegion.setAttribute('aria-live', 'polite');
		this._renderCreditsPacksRegion(packsRegion);

		const linksRow = append(wrapper, $('.onboarding-a-credits-links'));
		this._createCreditsExternalLink(
			linksRow,
			localize('onboarding.credits.howCreditsWork', "How Credits Work"),
			CREDITS_DOCS_URL,
			'howCreditsWork'
		);
		this._createCreditsExternalLink(
			linksRow,
			localize('onboarding.credits.viewPricing', "View Pricing"),
			CREDITS_PRICING_URL,
			'viewPricing'
		);
	}

	// =====================================================================
	// Step: Private Search on This Computer
	// =====================================================================

	/**
	 * Explains local Private Search indexing — informational only; Continue lives in the footer.
	 */
	private _renderPrivateSearchStep(container: HTMLElement): void {
		const wrapper = append(container, $('.onboarding-a-private-search'));

		const intro = append(wrapper, $('p.onboarding-a-private-search-intro'));
		intro.textContent = localize(
			'onboarding.privateSearch.intro',
			"Private Search builds a local index so you can find passages in case files without uploading the whole file for every search. Cloud chat still only sends what you ask."
		);

		const list = append(wrapper, $('ul.onboarding-a-profile-info-list'));
		const points = [
			localize('onboarding.privateSearch.point.localIndex', "The index stays on this computer"),
			localize('onboarding.privateSearch.point.searchTools', "Search tools (~350 MB) are optional and download only with your consent"),
			localize('onboarding.privateSearch.point.ocrTools', "Scanned-PDF tools (~7 GB) install only if this computer is eligible — also consent-only"),
			localize('onboarding.privateSearch.point.skip', "You can skip this step and set up Private Search later"),
		];
		for (const point of points) {
			const item = append(list, $('li.onboarding-a-profile-info-item'));
			const icon = item.appendChild(renderIcon(Codicon.check));
			icon.setAttribute('aria-hidden', 'true');
			const text = append(item, $('span'));
			text.textContent = point;
		}
	}

	// =====================================================================
	// Step: Get Started
	// =====================================================================

	/**
	 * Scans Private Search readiness on this computer, then offers install / setup / sample-case actions.
	 */
	private _renderGetStartedStep(container: HTMLElement): void {
		const wrapper = append(container, $('.onboarding-a-get-started'));

		const statusRegion = append(wrapper, $('.onboarding-a-get-started-status'));
		statusRegion.setAttribute('aria-live', 'polite');
		statusRegion.setAttribute('aria-atomic', 'true');

		const checking = append(statusRegion, $('p.onboarding-a-get-started-checking'));
		checking.textContent = localize('onboarding.getStarted.checking', "Checking this computer…");
		const checkingHint = append(statusRegion, $('p.onboarding-a-get-started-checking-hint'));
		checkingHint.textContent = localize(
			'onboarding.getStarted.checkingHint',
			"This can take up to 2 minutes. The screen may look still — the check is still running."
		);

		let cancelled = false;
		this.stepDisposables.add({ dispose: () => { cancelled = true; } });

		void this.commandService.executeCommand<PrivateSearchSetupScan>(GET_SETUP_SCAN_COMMAND)
			.then(scan => {
				if (cancelled || !statusRegion.isConnected) {
					return;
				}
				this._renderGetStartedScanStatus(statusRegion, scan ?? this._unavailablePrivateSearchSetupScan());
				this._renderGetStartedActions(wrapper, scan ?? this._unavailablePrivateSearchSetupScan());
			}, () => {
				if (cancelled || !statusRegion.isConnected) {
					return;
				}
				const scan = this._unavailablePrivateSearchSetupScan();
				this._renderGetStartedScanStatus(statusRegion, scan);
				this._renderGetStartedActions(wrapper, scan);
			});
	}

	private _unavailablePrivateSearchSetupScan(): PrivateSearchSetupScan {
		// Mirrors DEFAULT_SEARCH_PACK_DISK_MB / DEFAULT_OCR_DISK_MB in safeappeals-rag
		// (workbench cannot import the extension module).
		return {
			searchPack: {
				status: 'unavailable',
				readyModelIds: [],
				missingModelIds: [],
				diskMb: 350,
			},
			ocr: {
				status: 'unavailable',
				diskMb: 7000,
			},
			includeOcrInInstall: false,
		};
	}

	private _renderGetStartedScanStatus(statusRegion: HTMLElement, scan: PrivateSearchSetupScan): void {
		clearNode(statusRegion);

		const searchLine = append(statusRegion, $('p.onboarding-a-get-started-status-line'));
		searchLine.textContent = this._formatSetupScanSearchStatus(scan.searchPack.status);

		const ocrLine = append(statusRegion, $('p.onboarding-a-get-started-status-line'));
		ocrLine.textContent = this._formatSetupScanOcrStatus(scan.ocr.status);
	}

	private _formatSetupScanSearchStatus(status: SetupScanSearchStatus): string {
		switch (status) {
			case 'ready':
				return localize('onboarding.getStarted.searchStatus.ready', "Search tools: ready");
			case 'missing':
				return localize('onboarding.getStarted.searchStatus.missing', "Search tools: not installed");
			case 'unavailable':
				return localize('onboarding.getStarted.searchStatus.unavailable', "Search tools: unavailable");
		}
	}

	private _formatSetupScanOcrStatus(status: SetupScanOcrStatus): string {
		switch (status) {
			case 'ready':
				return localize('onboarding.getStarted.ocrStatus.ready', "Scanned-PDF tools: ready");
			case 'missing-eligible':
				return localize('onboarding.getStarted.ocrStatus.missingEligible', "Scanned-PDF tools: eligible — not installed");
			case 'ineligible':
				return localize('onboarding.getStarted.ocrStatus.ineligible', "Scanned-PDF tools: not eligible on this computer");
			case 'unavailable':
				return localize('onboarding.getStarted.ocrStatus.unavailable', "Scanned-PDF tools: unavailable");
		}
	}

	private _isPrivateSearchSetupComplete(scan: PrivateSearchSetupScan): boolean {
		if (scan.searchPack.status !== 'ready') {
			return false;
		}
		return scan.ocr.status === 'ready' || scan.ocr.status === 'ineligible';
	}

	private _canInstallMissingPrivateSearchModels(scan: PrivateSearchSetupScan): boolean {
		if (scan.searchPack.status === 'unavailable' && scan.ocr.status === 'unavailable') {
			return false;
		}
		return !this._isPrivateSearchSetupComplete(scan);
	}

	private _renderGetStartedActions(wrapper: HTMLElement, scan: PrivateSearchSetupScan): void {
		const actionsHost = append(wrapper, $('.onboarding-a-credits-first-action'));
		const actions = append(actionsHost, $('.onboarding-a-credits-actions'));

		if (this._canInstallMissingPrivateSearchModels(scan)) {
			const installBtn = this._registerStepFocusable(append(actions, $<HTMLButtonElement>('button.onboarding-a-btn.onboarding-a-btn-primary')));
			installBtn.type = 'button';
			installBtn.textContent = localize('onboarding.getStarted.installMissing', "Install What's Missing");
			this.stepDisposables.add(addDisposableListener(installBtn, EventType.CLICK, () => {
				this._logAction('installMissing', OnboardingStepId.GetStarted);
				void this.commandService.executeCommand(INSTALL_MISSING_MODELS_COMMAND).catch(() => {
					this.notificationService.notify({
						severity: Severity.Info,
						message: localize(
							'onboarding.getStarted.installMissingUnavailable',
							"Could not start installation right now. Try Set Up Private Search for the guided checklist."
						),
					});
				});
			}));
		}

		const setupBtn = this._registerStepFocusable(append(actions, $<HTMLButtonElement>('button.onboarding-a-btn.onboarding-a-btn-secondary')));
		setupBtn.type = 'button';
		setupBtn.textContent = localize('onboarding.credits.setupPrivateSearch', "Set Up Private Search");
		this.stepDisposables.add(addDisposableListener(setupBtn, EventType.CLICK, () => {
			void this._runCreditsSoftPrivateSearchAction(OnboardingStepId.GetStarted);
		}));

		const tutorialsBtn = this._registerStepFocusable(append(actions, $<HTMLButtonElement>('button.onboarding-a-btn.onboarding-a-btn-primary')));
		tutorialsBtn.type = 'button';
		tutorialsBtn.textContent = localize('onboarding.getStarted.tutorials', "Tutorials");
		this.stepDisposables.add(addDisposableListener(tutorialsBtn, EventType.CLICK, () => {
			void this._runGetStartedTutorials();
		}));

		const ownCaseBtn = this._registerStepFocusable(append(actions, $<HTMLButtonElement>('button.onboarding-a-btn.onboarding-a-btn-secondary')));
		ownCaseBtn.type = 'button';
		ownCaseBtn.textContent = localize('onboarding.credits.startOwnCase', "Start with My Own Case");
		this.stepDisposables.add(addDisposableListener(ownCaseBtn, EventType.CLICK, () => {
			void this._runCreditsFirstAction('workbench.action.chat.open', 'startOwnCase', OnboardingStepId.GetStarted);
		}));

		const hint = append(actionsHost, $('p.onboarding-a-credits-first-hint'));
		hint.textContent = localize(
			'onboarding.getStarted.tutorialsHint',
			"Tutorials use the sample case — no credits, AI does not run."
		);
	}

	/**
	 * Opens Private Search Setup (and/or Getting Started) without completing the wizard.
	 * Distinct from {@link _runCreditsFirstAction}, which dismisses onboarding on success.
	 */
	private async _runCreditsSoftPrivateSearchAction(stepOverride?: OnboardingStepId): Promise<void> {
		this._logAction('setupPrivateSearch', stepOverride);
		try {
			await this.commandService.executeCommand('safeappeals-rag.setupLocalSearch');
		} catch {
			try {
				await this.commandService.executeCommand(
					'workbench.action.openWalkthrough',
					'safeappeals.safeappeals-timeline#safeappealsTimelineSetup',
					false
				);
			} catch {
				this.notificationService.notify({
					severity: Severity.Info,
					message: localize(
						'onboarding.credits.privateSearchUnavailable',
						"Private Search Setup is not available yet. Open Get Started after welcome to finish Local AI setup from the checklist."
					),
				});
			}
		}
	}

	/**
	 * Fills the balance region: live balance when signed in; a quiet note when
	 * not (no sign-in CTA — step 1 owns that; buying a pack below prompts sign-in
	 * itself). Failed lookups never blank the step or show a fake zero.
	 */
	private _renderCreditsBalanceRegion(balanceRegion: HTMLElement): void {
		clearNode(balanceRegion);

		if (!this._userSignedIn) {
			const unsignedCopy = append(balanceRegion, $('p.onboarding-a-credits-unsigned-copy'));
			unsignedCopy.textContent = localize(
				'onboarding.credits.unsignedNoCta',
				"Buying a pack below will ask you to sign in first — everything else here stays free either way."
			);
			return;
		}

		const status = append(balanceRegion, $('p.onboarding-a-credits-balance-status'));
		status.textContent = localize('onboarding.credits.checking', "Checking credit balance…");

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
					"Your balance could not be loaded right now. You can still buy a pack below, or continue and try the sample case on the last step."
				);
			}, () => {
				if (cancelled || !status.isConnected) {
					return;
				}
				status.textContent = localize(
					'onboarding.credits.balanceUnavailable',
					"Your balance could not be loaded right now. You can still buy a pack below, or continue and try the sample case on the last step."
				);
			});
	}

	/**
	 * Loads and renders the live credit pack list from the cloud packs API
	 * (`safeappeals.cloud.getCreditPacks`) — never hardcoded prices. Guards
	 * against a step change mid-flight the same way the balance fetch does.
	 */
	private _renderCreditsPacksRegion(host: HTMLElement): void {
		clearNode(host);

		const loading = append(host, $('p.onboarding-a-credits-packs-status'));
		loading.textContent = localize('onboarding.credits.packs.loading', "Loading credit packs…");

		let cancelled = false;
		this.stepDisposables.add({ dispose: () => { cancelled = true; } });

		void this.commandService.executeCommand<OnboardingCreditPack[]>('safeappeals.cloud.getCreditPacks')
			.then(packs => {
				if (cancelled || !host.isConnected) {
					return;
				}
				if (!Array.isArray(packs) || packs.length === 0) {
					this._renderCreditsPacksFallback(host);
					return;
				}
				this._renderCreditsPacksList(host, packs);
			}, () => {
				if (cancelled || !host.isConnected) {
					return;
				}
				this._renderCreditsPacksFallback(host);
			});
	}

	/**
	 * Renders compact pack rows (name + popular badge, credits, price,
	 * description, Buy button) — not heavy marketing cards.
	 */
	private _renderCreditsPacksList(host: HTMLElement, packs: readonly OnboardingCreditPack[]): void {
		clearNode(host);

		for (const pack of packs) {
			const row = append(host, $('.onboarding-a-credits-pack'));
			if (pack.popular) {
				row.classList.add('onboarding-a-credits-pack-popular');
			}

			const meta = append(row, $('.onboarding-a-credits-pack-meta'));
			const nameRow = append(meta, $('.onboarding-a-credits-pack-name'));
			const nameEl = append(nameRow, $('span.onboarding-a-credits-pack-name-text'));
			nameEl.textContent = pack.name;
			if (pack.popular) {
				const badge = append(nameRow, $('span.onboarding-a-credits-pack-badge'));
				badge.textContent = localize('onboarding.credits.packs.popular', "Popular");
			}

			const details = append(meta, $('span.onboarding-a-credits-pack-details'));
			details.textContent = localize(
				'onboarding.credits.packs.detail',
				"{0} — {1}",
				this._formatCreditsAmount(pack.credits),
				this._formatPackPrice(pack.price, pack.currency)
			);

			const desc = append(meta, $('span.onboarding-a-credits-pack-desc'));
			desc.textContent = pack.description;

			const buyBtnClass = pack.popular ? 'onboarding-a-btn-primary' : 'onboarding-a-btn-secondary';
			const buyBtn = this._registerStepFocusable(append(row, $<HTMLButtonElement>(`button.onboarding-a-btn.${buyBtnClass}.onboarding-a-credits-pack-buy`)));
			buyBtn.type = 'button';
			buyBtn.textContent = localize('onboarding.credits.packs.buy', "Buy");
			buyBtn.setAttribute('aria-label', localize('onboarding.credits.packs.buyAria', "Buy {0}", pack.name));
			this.stepDisposables.add(addDisposableListener(buyBtn, EventType.CLICK, () => {
				this._openCreditsCheckout(pack.id);
			}));
		}
	}

	/**
	 * Shown when the live pack list fails to load or comes back empty — keeps
	 * a purchase path available via the quick-pick fallback in `openCheckout`.
	 */
	private _renderCreditsPacksFallback(host: HTMLElement): void {
		clearNode(host);

		const fallback = append(host, $('p.onboarding-a-credits-packs-status'));
		fallback.textContent = localize(
			'onboarding.credits.packs.unavailable',
			"Credit packs could not be loaded right now."
		);

		const chooseBtn = this._registerStepFocusable(append(host, $<HTMLButtonElement>('button.onboarding-a-btn.onboarding-a-btn-secondary')));
		chooseBtn.type = 'button';
		chooseBtn.textContent = localize('onboarding.credits.packs.choosePack', "Choose a Pack");
		this.stepDisposables.add(addDisposableListener(chooseBtn, EventType.CLICK, () => {
			this._openCreditsCheckout();
		}));
	}

	/**
	 * Opens Stripe checkout for an optional pack id via the cloud extension
	 * command. `openCheckout` handles sign-in (createIfNone) itself when
	 * needed — this is a purchase path, not a Sign In CTA.
	 */
	private _openCreditsCheckout(packId?: string): void {
		this._logAction('openCheckout', undefined, packId);
		void this.commandService.executeCommand('safeappeals.cloud.openCheckout', packId).catch(() => {
			this.notificationService.notify({
				severity: Severity.Info,
				message: localize('onboarding.credits.checkoutUnavailable', "Could not open checkout right now. Use View Pricing to see packs in your browser."),
			});
		});
	}

	/**
	 * Formats a credit amount with locale thousands separators, e.g. "10,000 credits".
	 */
	private _formatCreditsAmount(n: number): string {
		return localize('onboarding.credits.packs.creditsAmount', "{0} credits", n.toLocaleString());
	}

	/**
	 * Formats a pack price as `$X.XX`, appending the currency code when it is
	 * not USD (the common case is left unadorned).
	 */
	private _formatPackPrice(price: number, currency: string): string {
		const amount = `$${price.toFixed(2)}`;
		return currency.toUpperCase() === 'USD' ? amount : `${amount} ${currency}`;
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
	 * Opens Tutorials (sample case walkthrough). Dismisses the overlay first so
	 * same-window tour UI is not covered. Distinct error copy from
	 * {@link _runCreditsFirstAction} — checklist/setup messaging is wrong here.
	 */
	private async _runGetStartedTutorials(): Promise<void> {
		this._logAction('openTutorials', OnboardingStepId.GetStarted);
		// Dismiss before openTutorials: when the sample is already open, the
		// command runs takeTour() in-window and would otherwise await under the overlay.
		this._dismiss('complete');
		try {
			await this.commandService.executeCommand('safeappeals-timeline.openTutorials');
		} catch {
			this.notificationService.notify({
				severity: Severity.Info,
				message: localize(
					'onboarding.getStarted.tutorialsUnavailable',
					"Tutorials could not open. Try Help → Tutorials after trusting the folder, or Close Folder and try again."
				),
			});
		}
	}

	/**
	 * Runs a zero-cost first-action command, then completes the wizard on success.
	 */
	private async _runCreditsFirstAction(commandId: string, actionId: string, stepOverride?: OnboardingStepId): Promise<void> {
		this._logAction(actionId, stepOverride);
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
	 * Shows a footer hint that Continue is blocked until the AI literacy checkbox is checked.
	 */
	private _showAgentIntroAckHint(): void {
		if (!this.footerLeft) {
			return;
		}
		if (!this._agentIntroAckHint) {
			this._agentIntroAckHint = append(this.footerLeft, $('span.onboarding-a-footer-hint'));
			this._agentIntroAckHint.id = 'onboarding-a-agent-intro-ack-hint';
		}
		this._agentIntroAckHint.textContent = localize(
			'onboarding.agentIntro.ackRequired',
			"Confirm the statement above to continue."
		);
	}

	/**
	 * Sends focus to the acknowledgment the user must tick before Continue works,
	 * so pressing a blocked Continue points at what is blocking it.
	 */
	private _focusAgentIntroAck(): void {
		this._aiLiteracyCheckbox?.focus();
	}

	/**
	 * Clears the Agent Intro Continue-blocked footer hint.
	 */
	private _clearAgentIntroAckHint(): void {
		if (!this._agentIntroAckHint) {
			return;
		}
		this._agentIntroAckHint.remove();
		this._agentIntroAckHint = undefined;
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
		return [...(this.closeButton ? [this.closeButton] : []), ...this._getTabbableStepElements(), ...this.footerFocusableElements].filter(element => this._isTabbable(element));
	}

	private _focusCurrentStepElement(): void {
		const stepFocusable = this._getTabbableStepElements()[0];
		(stepFocusable ?? this.nextButton ?? this.closeButton)?.focus();
	}

	/**
	 * Live step controls in visual order. Controls that get rebuilt in place —
	 * State / Province and Board / Tribunal, which re-render when Country
	 * changes — re-register at the end of the list, so registration order is not
	 * tab order; sort by document position instead.
	 */
	private _getTabbableStepElements(): HTMLElement[] {
		return [...new Set(this.stepFocusableElements.filter(element => this._isTabbable(element)))]
			.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
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
		this._clearAgentIntroAckHint();
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
