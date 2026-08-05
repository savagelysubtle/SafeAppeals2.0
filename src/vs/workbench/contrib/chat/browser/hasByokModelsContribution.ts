/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKey, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { ChatEntitlementContextKeys } from '../../../services/chat/common/chatEntitlementService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { ChatContextKeys } from '../common/actions/chatContextKeys.js';
import { usesSafeAppealsCloudSetup } from '../common/chatSetupCloudHelpers.js';
import { ChatConfiguration } from '../common/constants.js';
import { COPILOT_VENDOR_ID, ILanguageModelsService, SAFEAPPEALS_CLOUD_VENDOR_ID } from '../common/languageModels.js';
import { ILanguageModelsConfigurationService } from '../common/languageModelsConfiguration.js';

/**
 * Owns the `github.copilot.hasByokModels` context key. The key is true iff:
 *  - `github.copilot.clientByokEnabled` is true (set by `ChatEntitlementService` + Copilot extension),
 *  - `chat.aiDisabled` is off, and
 *  - the language-models configuration has at least one non-Copilot vendor group (at any time),
 *    or — pre extension scan — the `chatNonCopilotModelsAreUserSelectable` signal is on.
 *  - SafeAppeals: or the `safeappeals-cloud` language-model vendor is registered (bypasses
 *    `clientByokEnabled` so Cloud models unblock the picker without GitHub Copilot sign-in).
 *
 * Strategy (avoids activating BYOK extensions just to gate UI):
 *  1. Restore the last persisted answer for correct warm-reload UI.
 *  2. Configured non-Copilot vendor groups are a positive signal at any time.
 *  3. Pre-registration only, also trust the `chatNonCopilotModelsAreUserSelectable` signal
 *     (post-registration it can be stale — model cache lags behind group removal).
 *  4. Only persist `false` after both extension scan and first config load complete, so startup
 *     latency doesn't clobber a previously-true answer.
 *
 * Eager so the key is bound before any sign-in UI renders.
 */
export class HasByokModelsContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.hasByokModels';

	private static readonly STORAGE_KEY_LAST_KNOWN = 'chat.hasByokModels.lastKnown';

	private static readonly TRACKED_KEYS = new Set([
		ChatEntitlementContextKeys.clientByokEnabled.key,
		ChatContextKeys.nonCopilotLanguageModelsAreUserSelectable.key,
	]);

	private readonly _hasByokModels: IContextKey<boolean>;
	private readonly _usesSafeAppealsCloudSetup: IContextKey<boolean>;
	private _extensionsRegistered = false;
	private _configurationLoaded = false;

	constructor(
		@ILanguageModelsConfigurationService private readonly _languageModelsConfigurationService: ILanguageModelsConfigurationService,
		@ILanguageModelsService private readonly _languageModelsService: ILanguageModelsService,
		@IContextKeyService private readonly _contextKeyService: IContextKeyService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IStorageService private readonly _storageService: IStorageService,
		@IAuthenticationService private readonly _authenticationService: IAuthenticationService,
		@IExtensionService extensionService: IExtensionService,
	) {
		super();

		this._hasByokModels = ChatEntitlementContextKeys.hasByokModels.bindTo(this._contextKeyService);
		this._usesSafeAppealsCloudSetup = ChatContextKeys.usesSafeAppealsCloudSetup.bindTo(this._contextKeyService);

		this._restore();
		this._update();

		extensionService.whenInstalledExtensionsRegistered().then(() => {
			if (!this._store.isDisposed) {
				this._extensionsRegistered = true;
				this._update();
			}
		});

		this._languageModelsConfigurationService.whenReady.then(() => {
			if (!this._store.isDisposed) {
				this._configurationLoaded = true;
				this._update();
			}
		});

		this._register(Event.any(
			Event.filter(this._configurationService.onDidChangeConfiguration, e => e.affectsConfiguration(ChatConfiguration.AIDisabled)),
			Event.filter(this._contextKeyService.onDidChangeContext, e => e.affectsSome(HasByokModelsContribution.TRACKED_KEYS)),
			this._languageModelsConfigurationService.onDidChangeLanguageModelGroups,
			// SafeAppeals: re-evaluate when cloud LM vendor is contributed or removed
			this._languageModelsService.onDidChangeLanguageModelVendors,
			this._authenticationService.onDidRegisterAuthenticationProvider,
			this._authenticationService.onDidUnregisterAuthenticationProvider,
		)(() => this._update()));
	}

	private _updateSafeAppealsCloudSetupContext(hasByokModels: boolean): void {
		if (this._isAiDisabled()) {
			this._usesSafeAppealsCloudSetup.set(false);
			return;
		}
		this._usesSafeAppealsCloudSetup.set(usesSafeAppealsCloudSetup({
			getVendors: () => this._languageModelsService.getVendors(),
			hasByokModels,
			isAuthenticationProviderRegistered: (id) => this._authenticationService.isAuthenticationProviderRegistered(id),
		}));
	}

	private _isAiDisabled(): boolean {
		return !!this._configurationService.getValue<boolean>(ChatConfiguration.AIDisabled);
	}

	private _isClientByokEnabled(): boolean {
		return !!this._contextKeyService.getContextKeyValue<boolean>(ChatEntitlementContextKeys.clientByokEnabled.key);
	}

	/** SafeAppeals: true when our cloud LM vendor is registered (extension contribution). */
	private _hasSafeAppealsCloudVendor(): boolean {
		return this._languageModelsService.getVendors().some(v => v.vendor === SAFEAPPEALS_CLOUD_VENDOR_ID);
	}

	private _restore(): void {
		if (this._isAiDisabled()) {
			this._hasByokModels.set(false);
			this._updateSafeAppealsCloudSetupContext(false);
			return;
		}
		// SafeAppeals: cloud vendor bypasses clientByokEnabled before the Copilot BYOK gate
		if (this._hasSafeAppealsCloudVendor()) {
			this._hasByokModels.set(true);
			this._updateSafeAppealsCloudSetupContext(true);
			return;
		}
		// SafeAppeals: do not hard-false on restore when clientByokEnabled is off — vendors
		// are empty before extensions parse; keep lastKnown to avoid cold-start flicker.
		const lastKnown = this._storageService.getBoolean(HasByokModelsContribution.STORAGE_KEY_LAST_KNOWN, StorageScope.APPLICATION, false);
		this._hasByokModels.set(lastKnown);
		this._updateSafeAppealsCloudSetupContext(lastKnown);
	}

	private _setResult(value: boolean): void {
		this._hasByokModels.set(value);
		this._updateSafeAppealsCloudSetupContext(value);
		this._storageService.store(HasByokModelsContribution.STORAGE_KEY_LAST_KNOWN, value, StorageScope.APPLICATION, StorageTarget.MACHINE);
	}

	private _update(): void {
		if (this._isAiDisabled()) {
			this._setResult(false);
			return;
		}

		// SafeAppeals: cloud vendor bypasses clientByokEnabled before the Copilot BYOK gate
		if (this._hasSafeAppealsCloudVendor()) {
			this._setResult(true);
			return;
		}

		if (!this._isClientByokEnabled()) {
			// SafeAppeals: before extensions settle, getVendors() is empty — hard-false would
			// persist and wipe lastKnown every launch for cloud-only users. Keep restored value.
			if (!this._extensionsRegistered) {
				return;
			}
			this._setResult(false);
			return;
		}

		const hasByokVendor = this._languageModelsConfigurationService.getLanguageModelsProviderGroups().some(g => g.vendor !== COPILOT_VENDOR_ID);
		if (hasByokVendor) {
			this._setResult(true);
			return;
		}

		// Pre-registration only: trust the user-selectable signal as an optimistic positive.
		// Post-registration it can be stale (model cache lags behind group removal), so ignore.
		if (!this._extensionsRegistered && this._contextKeyService.getContextKeyValue<boolean>(ChatContextKeys.nonCopilotLanguageModelsAreUserSelectable.key)) {
			this._setResult(true);
			return;
		}

		// Defer negative result until startup signals have settled.
		if (this._extensionsRegistered && this._configurationLoaded) {
			this._setResult(false);
		}
	}
}
