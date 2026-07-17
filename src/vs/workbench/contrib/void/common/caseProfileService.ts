/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';

export interface CaseProfile {
	id: string;
	name: string;
	description?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface ICaseProfileService {
	readonly _serviceBrand: undefined;

	/**
	 * Get the current case profile
	 */
	getCaseProfile(): Promise<CaseProfile | null>;

	/**
	 * Set the current case profile
	 */
	setCaseProfile(profile: CaseProfile): Promise<void>;

	/**
	 * Delete the current case profile
	 */
	deleteCaseProfile(): Promise<void>;

	/**
	 * Event fired when the case profile changes
	 */
	readonly onDidChangeCaseProfile: Event<CaseProfile | null>;
}

export const ICaseProfileService = createDecorator<ICaseProfileService>('caseProfileService');

export class CaseProfileService extends Disposable implements ICaseProfileService {
	readonly _serviceBrand: undefined;

	private readonly _onDidChangeCaseProfile = this._register(new Emitter<CaseProfile | null>());
	readonly onDidChangeCaseProfile: Event<CaseProfile | null> = this._onDidChangeCaseProfile.event;

	constructor() {
		super();
	}

	async getCaseProfile(): Promise<CaseProfile | null> {
		// Stub implementation - returns null as no case profile functionality is implemented
		return null;
	}

	async setCaseProfile(profile: CaseProfile): Promise<void> {
		// Stub implementation - does nothing as no case profile functionality is implemented
		this._onDidChangeCaseProfile.fire(profile);
	}

	async deleteCaseProfile(): Promise<void> {
		// Stub implementation - does nothing as no case profile functionality is implemented
		this._onDidChangeCaseProfile.fire(null);
	}
}

registerSingleton(ICaseProfileService, CaseProfileService, InstantiationType.Eager);
